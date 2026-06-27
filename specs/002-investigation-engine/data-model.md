# Data Model: Investigation Engine

**Branch**: `002-investigation-engine` | **Spec**: [spec.md](./spec.md) | **Date**: 2026-05-15

All schema lives in `app/packages/db/src/schema.ts` (single-file Drizzle schema). The raw-SQL migration is `app/supabase/migrations/0011_investigation_engine.sql`.

Existing entities reused without modification: `cases` (the wanted-poster public surface, written by Slice K promotion), `auditLogs` (extended with new `action` values, no schema change), `editors` (the reviewer identity), `newsArticles` and `kMonitorArticles` (the two parent sources for claims). Existing entity `kMonitorPersonCandidates` continues to run alongside the new engine — both layers feed investigation creation independently.

---

## New enums

```sql
CREATE TYPE article_source AS ENUM ('news', 'kmonitor');

CREATE TYPE corruption_mechanism AS ENUM (
  'overpricing',
  'no_bid',
  'kickback',
  'amendment_inflation',
  'phantom_service',
  'related_party',
  'other'
);

CREATE TYPE amount_basis AS ENUM ('stated', 'computed', 'estimated');

CREATE TYPE investigation_status AS ENUM ('new', 'dismissed', 'merged');

CREATE TYPE disclosure_tier AS ENUM ('internal', 'journalist', 'prosecutor', 'public');

CREATE TYPE external_source_system AS ENUM (
  'TED',
  'EKR',
  'KE',
  'palyazat',
  'ecegjegyzek',
  'opencorporates',
  'integritas',
  'olaf',
  'ksh',
  'eurostat',
  'kmonitor',
  'atlatszo',
  'webarchive',
  'manual_opten',
  'manual_other'
);

CREATE TYPE relevance AS ENUM ('corroborates', 'contradicts', 'context', 'benchmark');

CREATE TYPE evidence_grade AS ENUM (
  'rumor',
  'opinion_press',
  'opposition_politician',
  'investigative_journalism',
  'prosecutor_statement',
  'audit_report',
  'court_document'
);

CREATE TYPE redflag_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE redflag_verdict AS ENUM ('pass', 'fail', 'not_applicable');

CREATE TYPE lead_kind AS ENUM ('hypothesis', 'search_lead', 'reviewer_question', 'escalation', 'cluster_ambiguous');

CREATE TYPE lead_status AS ENUM ('open', 'tested', 'resolved', 'rejected');

CREATE TYPE lead_actor_kind AS ENUM ('agent', 'reviewer', 'system');

CREATE TYPE party_kind AS ENUM ('person', 'entity');
```

---

## ArticleExtractionRun

Idempotency marker for article extraction. One row per `(articleSource, articleId, extractorVersion)` — including when the LLM returns **zero** claims. This is the row that `investigation.extract-claims` probes before deciding whether to call the LLM, so the zero-claim edge case (spec.md:133) also short-circuits and obeys FR-002 / SC-003.

| Column | Type | Notes |
|---|---|---|
| `articleSource` | `article_source` NOT NULL | `'news'` or `'kmonitor'` |
| `articleId` | `text` NOT NULL | parent article id (polymorphic, same shape as `ArticleClaim`) |
| `extractorVersion` | `text` NOT NULL | `{model}@{promptHash8}`; matches `ArticleClaim.extractorVersion` |
| `claimCount` | `integer` NOT NULL | 0 is valid (article yielded no extractable claims) |
| `extractedAt` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `model` | `text` NOT NULL | the model id that produced the run |
| `inputTokens` | `integer` NOT NULL | for this call (also written into `DailyLlmUsage` in the same txn) |
| `outputTokens` | `integer` NOT NULL | |
| `estimatedHufSpend` | `numeric(14, 2)` NOT NULL | |

**Indexes / constraints**:
- `PRIMARY KEY (articleSource, articleId, extractorVersion)` — idempotency probe key.
- `INDEX (articleSource, articleId, extractedAt DESC)` — "latest run" lookup for the article admin viewer (FR-003 / S1.3 side-by-side diff view).
- `CHECK (claimCount >= 0)`.

**Lifecycle**:
- Inserted by `investigation.extract-claims` after every successful extraction call — including a valid zero-claim parse. Insert is part of the same Postgres transaction that writes the `ArticleClaim` rows and the `DailyLlmUsage` upsert.
- Deleted by `investigation.orphan-cleanup` when the parent article disappears (FR-006), in lockstep with the matching `ArticleClaim` rows.
- NOT deleted when the extractor version is bumped — both old and new rows are retained so the article admin viewer can render side-by-side diffs (FR-003).

---

## ArticleClaim

One atomic corruption allegation extracted from one article. Polymorphic article reference via `(articleSource, articleId)` — no FK; orphan cleanup is the `investigation.orphan-cleanup` janitor (FR-006).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `defaultRandom()` |
| `articleSource` | `article_source` NOT NULL | `'news'` or `'kmonitor'` |
| `articleId` | `text` NOT NULL | `NewsArticle.id` (text) or `KMonitorArticle.newsId::text` |
| `claimOrdinal` | `integer` NOT NULL | 1-based order within the article |
| `extractorVersion` | `text` NOT NULL | `{model}@{promptHash8}`; idempotency key component |
| `mechanism` | `corruption_mechanism` NOT NULL | |
| `allegedAmountHuf` | `bigint` NULL | nullable — see FR-009 |
| `amountBasis` | `amount_basis` NULL | non-null iff `allegedAmountHuf IS NOT NULL` (check constraint) |
| `parties` | `jsonb` NOT NULL | `Array<{ kind: party_kind, name: string, normalizedName: string, role: string }>`; at least one entry (check) |
| `evidenceQuote` | `text` NOT NULL | verbatim quote from article body |
| `sourceUrl` | `text` NOT NULL | canonical URL of the article |
| `paragraphLocator` | `text` NOT NULL | e.g., `"p:14"` or a CSS-selector-style locator |
| `model` | `text` NOT NULL | the model id that produced the row |
| `confidence` | `integer` NOT NULL | 0–100 |
| `createdAt` | `timestamptz` NOT NULL DEFAULT `now()` | |

**Indexes / constraints**:
- `UNIQUE (articleSource, articleId, claimOrdinal, extractorVersion)` — FR-002 idempotency.
- `INDEX (articleSource, articleId)` — read claims for an article.
- `INDEX USING gin (parties jsonb_path_ops)` — name overlap probe.
- `CHECK (length(evidenceQuote) > 0 AND length(sourceUrl) > 0 AND length(paragraphLocator) > 0)` — FR-036.
- `CHECK ((allegedAmountHuf IS NULL) = (amountBasis IS NULL))` — paired nullability.

**Lifecycle**:
- Created by `investigation.extract-claims` Inngest function.
- Deleted by `investigation.orphan-cleanup` when the parent article disappears (FR-006).
- Deleted by `investigation.anonymize-dsr` for any claim that names a subject of an upheld deletion request (FR-035).

---

## Investigation

A cluster of claims describing the same real-world case.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `defaultRandom()` |
| `status` | `investigation_status` NOT NULL DEFAULT `'new'` | FR-011a |
| `mergedIntoId` | `uuid` NULL FK → `Investigation.id` | non-null iff `status = 'merged'` (check) |
| `primaryPersonName` | `text` NULL | denormalized for queue display |
| `primaryPersonNormalized` | `text` NULL | indexed for trigram search |
| `primaryEntityName` | `text` NULL | the contracting authority / contractor |
| `summary` | `text` NULL | reviewer-edited |
| `quantityScore` | `numeric(6, 2)` NOT NULL DEFAULT `0` | FR-024 |
| `qualityScore` | `evidence_grade` NULL | FR-024; null until first scoring run |
| `disclosureTier` | `disclosure_tier` NOT NULL DEFAULT `'internal'` | |
| `publicCaseId` | `text` NULL FK → `Case.id` ON DELETE SET NULL | set on public promotion |
| `articleCount` | `integer` NOT NULL DEFAULT `0` | denormalized; bumped by clustering. Drives nightly-refresh priority (FR-015) |
| `oldestExternalRecordFetchedAt` | `timestamptz` NULL | denormalized; tiebreak for nightly-refresh priority (FR-015) |
| `createdAt` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updatedAt` | `timestamptz` NOT NULL DEFAULT `now()` | optimistic-concurrency key (FR-031c) |

**Indexes / constraints**:
- `INDEX (status)` — queue filter.
- `INDEX (disclosureTier, status)` — tier-filtered views.
- `INDEX (articleCount DESC, oldestExternalRecordFetchedAt ASC)` — nightly refresh priority order (FR-015).
- `INDEX USING gist (primaryPersonNormalized gist_trgm_ops)` — primary-person search.
- `INDEX (mergedIntoId) WHERE mergedIntoId IS NOT NULL` — sparse FK index.
- `CHECK ((status = 'merged') = (mergedIntoId IS NOT NULL))` — paired state.

**State transitions** (status):

```
   ┌─────────────────────────────┐
   │       (clustering)          │
   │             │               │
   │             ▼               │
   │           NEW               │
   │           │ │               │
   │   reviewer│ │reviewer       │
   │   dismiss │ │merge          │
   │           ▼ ▼               │
   │     DISMISSED  MERGED       │
   │       (no exit)  (no exit)  │
   └─────────────────────────────┘
```

- Only the clustering job creates `NEW` rows (FR-011a).
- Only reviewer actions transition to `DISMISSED` or `MERGED`; the clustering job MUST NOT auto-transition away from `NEW` (FR-011a).
- `MERGED` rows stay (audit) and point at the survivor via `mergedIntoId`.
- No transition out of `DISMISSED` or `MERGED`.

**Tier transitions** (disclosureTier):

- Initial: `internal`.
- Forward: `internal → journalist`, `internal → prosecutor`, `internal → public` (each gated by the FR-026 predicate).
- Back: `public → internal` (depromotion soft-deletes the linked `Case` row, FR-030).
- Sideways: `journalist ↔ prosecutor` allowed (both metadata-only, FR-031b).

---

## InvestigationArticleLink

Many-to-many between investigations and the articles whose claims feed them.

| Column | Type | Notes |
|---|---|---|
| `investigationId` | `uuid` NOT NULL FK → `Investigation.id` ON DELETE CASCADE | |
| `articleSource` | `article_source` NOT NULL | |
| `articleId` | `text` NOT NULL | |
| `role` | `text` NOT NULL DEFAULT `'primary'` | `'primary'` / `'corroborating'` / `'context'` |
| `createdAt` | `timestamptz` NOT NULL DEFAULT `now()` | |

**Indexes / constraints**:
- `PRIMARY KEY (investigationId, articleSource, articleId)`.
- `INDEX (articleSource, articleId)` — reverse lookup (orphan cleanup, DSR).

---

## ExternalRecord

One piece of external evidence attached to one investigation (FR-013).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `defaultRandom()` |
| `investigationId` | `uuid` NOT NULL FK → `Investigation.id` ON DELETE CASCADE | |
| `sourceSystem` | `external_source_system` NOT NULL | |
| `externalId` | `text` NOT NULL | source-system-specific id |
| `canonicalUrl` | `text` NOT NULL | FR-037 |
| `fetchedAt` | `timestamptz` NOT NULL | FR-037 |
| `fetchHash` | `text` NOT NULL | sha256 of the raw payload; FR-037 |
| `recordType` | `text` NOT NULL | `'contract_notice'`, `'company'`, `'audit_finding'`, … |
| `rawPayload` | `jsonb` NOT NULL | the unmodified normalized response |
| `relevance` | `relevance` NULL | `corroborates` / `contradicts` / `context` / `benchmark` |
| `evidenceGrade` | `evidence_grade` NULL | null when the source system itself doesn't imply a grade |
| `createdAt` | `timestamptz` NOT NULL DEFAULT `now()` | |

**Indexes / constraints**:
- `UNIQUE (investigationId, sourceSystem, externalId)` — upsert key on nightly refresh.
- `INDEX (sourceSystem, fetchedAt)` — staleness sweeps.
- `INDEX (investigationId, sourceSystem)` — case-page render.
- `CHECK (length(canonicalUrl) > 0 AND length(fetchHash) > 0)` — FR-037.

---

## RedFlagCheck

One rule evaluated against one investigation.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `defaultRandom()` |
| `investigationId` | `uuid` NOT NULL FK → `Investigation.id` ON DELETE CASCADE | |
| `ruleId` | `text` NOT NULL | stable id (e.g., `'single_bidder'`) |
| `severity` | `redflag_severity` NOT NULL | |
| `verdict` | `redflag_verdict` NOT NULL | |
| `observationHu` | `text` NOT NULL | plain Hungarian (FR-019, FR-020) |
| `supportingRecordIds` | `uuid[]` NOT NULL DEFAULT `'{}'` | references `ExternalRecord.id` |
| `evaluatedAt` | `timestamptz` NOT NULL DEFAULT `now()` | |

**Indexes / constraints**:
- `UNIQUE (investigationId, ruleId)` — one current verdict per rule per case (re-runs upsert).
- `INDEX (investigationId, severity)` — score contributor lookup.
- `CHECK (length(observationHu) > 0)` — FR-020.

---

## InvestigationLead

A hypothesis, search lead, reviewer question, escalation request, or cluster-ambiguity flag.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `defaultRandom()` |
| `investigationId` | `uuid` NOT NULL FK → `Investigation.id` ON DELETE CASCADE | |
| `kind` | `lead_kind` NOT NULL | |
| `status` | `lead_status` NOT NULL DEFAULT `'open'` | |
| `question` | `text` NOT NULL | the hypothesis or question |
| `testedAgainst` | `jsonb` NULL | adapter calls / cohort spec / cache reads |
| `finding` | `text` NULL | the agent's or reviewer's answer |
| `createdBy` | `lead_actor_kind` NOT NULL | `agent` / `reviewer` / `system` |
| `actorEditorId` | `uuid` NULL FK → `Editor.id` ON DELETE SET NULL | non-null when `createdBy='reviewer'` |
| `capFired` | `text` NULL | `'tool_calls'` / `'tokens'` / `'wall_clock'` for hypothesis caps (FR-023) |
| `createdAt` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `resolvedAt` | `timestamptz` NULL | |

**Indexes / constraints**:
- `INDEX (investigationId, status)` — case-page lead list.
- `INDEX (status, createdAt)` — needs-reviewer queue.
- `CHECK ((createdBy = 'reviewer') = (actorEditorId IS NOT NULL))`.

---

## InvestigationPublicCaseLink

Append-only history of every public `Case` row a given investigation has ever been linked to (FR-030, Acceptance Scenario S6.4). `Investigation.publicCaseId` remains the *current* link (single FK, set on promote, preserved on depromote, overwritten on re-promote); this table records the full chain so the history panel can render both the soft-deleted prior case and the current one.

| Column | Type | Notes |
|---|---|---|
| `investigationId` | `uuid` NOT NULL FK → `Investigation.id` ON DELETE CASCADE | |
| `publicCaseId` | `text` NOT NULL | references `Case.id`; **no FK** because the Case row may be soft-deleted out-of-band and the link must survive |
| `promotedAt` | `timestamptz` NOT NULL DEFAULT `now()` | when `investigation.promote-public` committed |
| `depromotedAt` | `timestamptz` NULL | when `investigation.depromote.public` ran; null while the link is the current one |
| `promotedByEditorId` | `uuid` NULL FK → `Editor.id` ON DELETE SET NULL | reviewer who triggered the promotion |

**Indexes / constraints**:
- `PRIMARY KEY (investigationId, publicCaseId)`.
- `INDEX (investigationId, promotedAt DESC)` — history-panel render order.

**Lifecycle**:
- Inserted by `investigation.promote-public` inside the same Postgres transaction that performs the four FR-028 writes (so the link history is committed atomically with the case itself).
- `depromotedAt` set by `investigation.depromote.public`; the row is **not** deleted.
- On re-promotion, a fresh row is inserted with a new `publicCaseId`; the prior row's `depromotedAt` is left intact.

---

## Benchmark

A cached cohort of comparable contracts with computed p10 / p50 / p90 and n (FR-017, FR-018).

| Column | Type | Notes |
|---|---|---|
| `cohortHash` | `text` PK | sha256(JSON.stringify({dimension, cohortSpec})) — upsert key |
| `dimension` | `text` NOT NULL | from the constrained list (e.g., `'huf_per_sqm_hospital'`) |
| `cohortSpec` | `jsonb` NOT NULL | filters that defined the cohort |
| `p10` | `numeric` NOT NULL | |
| `p50` | `numeric` NOT NULL | |
| `p90` | `numeric` NOT NULL | |
| `n` | `integer` NOT NULL | sample size |
| `memberRecordIds` | `uuid[]` NOT NULL | references `ExternalRecord.id` |
| `computedAt` | `timestamptz` NOT NULL DEFAULT `now()` | |

**Indexes / constraints**:
- `INDEX (dimension, computedAt)` — admin view of recent benchmarks.

---

## DailyLlmUsage

Per-day, per-model aggregate of input tokens, output tokens, and estimated HUF spend (FR-004, FR-005).

| Column | Type | Notes |
|---|---|---|
| `day` | `date` NOT NULL | local day, Europe/Budapest |
| `model` | `text` NOT NULL | |
| `inputTokens` | `bigint` NOT NULL DEFAULT `0` | |
| `outputTokens` | `bigint` NOT NULL DEFAULT `0` | |
| `estimatedHufSpend` | `numeric(14, 2)` NOT NULL DEFAULT `0` | |
| `callCount` | `integer` NOT NULL DEFAULT `0` | |
| `firstCallAt` | `timestamptz` NULL | |
| `lastCallAt` | `timestamptz` NULL | |

**Indexes / constraints**:
- `PRIMARY KEY (day, model)`.
- `INDEX (day)` — admin spend view.

---

## Extensions to existing entities

### AuditLog

No schema change. New `action` enum values used (the column is `text`, no migration needed):

```
investigation.claim.extracted
investigation.created
investigation.lead.created
investigation.lead.resolved
investigation.status.changed
investigation.summary.updated
investigation.merged
investigation.xref.requested
investigation.hypothesis.requested
investigation.escalation.requested
investigation.escalation.writeback
investigation.tier.promoted.journalist
investigation.tier.promoted.prosecutor
investigation.tier.promoted.public
investigation.tier.depromoted.public
investigation.anonymized
```

Per constitution Principle IV, `AuditLog` is range-partitioned by month and rows with `action = 'pii.read'` are retained 24 months; the new actions follow the default 24-month partition rotation.

### Case

No schema change. Investigation → Case history is captured in the new `InvestigationPublicCaseLink` table above; no back-reference column on `Case` is introduced (keeps the migration additive and avoids touching a Phase-1 entity).

---

## Migration plan

`app/supabase/migrations/0011_investigation_engine.sql`, additive only:

1. `CREATE TYPE` for every new enum (14 enums above).
2. `CREATE TABLE` for the 10 new tables in dependency order:
   1. `ArticleExtractionRun`
   2. `ArticleClaim`
   3. `Investigation`
   4. `InvestigationArticleLink` (FK → Investigation)
   5. `ExternalRecord` (FK → Investigation)
   6. `RedFlagCheck` (FK → Investigation; uses `ExternalRecord.id` only in array column, no FK)
   7. `InvestigationLead` (FK → Investigation, Editor)
   8. `InvestigationPublicCaseLink` (FK → Investigation, Editor)
   9. `Benchmark`
   10. `DailyLlmUsage`
3. `CREATE INDEX` for every index listed above.
4. `CREATE EXTENSION IF NOT EXISTS pg_trgm` — already enabled per `0002_case_search.sql`, kept as belt-and-braces.

No `DROP`, `ALTER … DROP COLUMN`, `RENAME`, or `NOT NULL` backfill — constitution Principle VII's two-step rule does not bind, but the migration still ships in its own PR ahead of the application code that depends on the new shape.

---

## Soft-delete & anonymization rules

- `Investigation` rows are never hard-deleted by application code (only by future operator action, out of scope).
- `Case` rows are soft-deleted (existing convention; verified during Slice K) on public-tier depromotion (FR-030).
- DSR (FR-034) anonymizes:
  - `Investigation.primaryPersonName` → `'[redacted]'`
  - `Investigation.primaryPersonNormalized` → `null`
  - `Investigation.summary` → mechanical name-replacement pass
  - The investigation row stays; its audit-log refs stay resolvable.
- DSR (FR-035) cascades to claim rows: `ArticleClaim` rows whose `parties` JSON names the subject are hard-deleted.

---

## Score-component derivation (FR-024, computed; not stored as discrete signals)

- `quantityScore` = Σ over distinct `(sourceSystem)` in `ExternalRecord` with `relevance='corroborates'` of `1.0 × stalenessDecay(record.fetchedAt)`, plus Σ over `RedFlagCheck` rows with `verdict='fail'` AND `severity IN ('medium','high','critical')` of `1.0`, where `stalenessDecay(fetchedAt)` = `1.0` if `now() - fetchedAt ≤ 540 days` else `0.5`.
- `qualityScore` = max ordinal of `evidenceGrade` across all `ExternalRecord` rows on the investigation (the enum's natural order).

Both components are recomputed by the `investigation.score` Inngest function on an event-driven basis (cross-reference finishes, red-flag run finishes, reviewer manually triggers a recompute) and persisted on `Investigation.quantityScore` / `qualityScore`. Each recompute bumps `Investigation.updatedAt`.

> **Superseded by the 2026-05-19 addendum below.** From the addendum forward, the score's *components* are persisted as discrete `SignalContribution` rows (FR-050) so the headline `quantityScore` is an auditable SUM, not an opaque single field. The summation rule above stays correct; the change is that each summand is now visible in its own row.

---

## Addendum 2026-05-19 — Damage→Evidence Spine

**Spec section**: [spec.md](./spec.md) §"Addendum 2026-05-19 — Damage→Evidence Spine" (US-7/US-8/US-9, FR-039..FR-058, SC-013..SC-020).
**Plan section**: [plan.md](./plan.md) §"Addendum 2026-05-19 — Damage→Evidence Spine".

This addendum adds three tables and four enums, in a separate additive migration `app/supabase/migrations/0012_damage_evidence_spine.sql`. Nothing in the original schema is altered. The original `Investigation.quantityScore` / `qualityScore` columns stay; the addendum adds the **derivation rows** that make those numbers auditable.

Existing entities reused without modification: `Investigation` (read on every recompute), `ArticleClaim` (read for `claim_consolidation` and `phantom_service` components), `ExternalRecord` (read for `benchmark_deviation` and `amendment_delta` components, and for `claim_corroboration` / `benchmark_deviation` signals), `RedFlagCheck` (read for `industry_estimate` components and for `red_flag` signals), `Benchmark` (read for `benchmark_deviation` cohort math).

---

### New enums (addendum)

```sql
CREATE TYPE damage_confidence AS ENUM ('low', 'medium', 'high');

CREATE TYPE damage_method AS ENUM (
  'benchmark_deviation',
  'claim_consolidation',
  'amendment_delta',
  'industry_estimate'
);

CREATE TYPE signal_source_kind AS ENUM (
  'external_record',
  'red_flag',
  'claim_corroboration',
  'benchmark_deviation'
);

CREATE TYPE job_kind AS ENUM (
  'xref',
  'redflags',
  'hypothesis_loop',
  'benchmarks',
  'damage_recompute'
);

CREATE TYPE job_state AS ENUM ('idle', 'running', 'done', 'failed');
```

`damage_mechanism` is **not** introduced — the existing `corruption_mechanism` enum (declared near the top of this document) is reused for `DamageComponent.mechanism` inside the `DamageEstimate.components` jsonb. Reuse keeps the mechanism vocabulary single-sourced; if a future mechanism is added it lives in `corruption_mechanism` and is automatically valid here.

---

### DamageEstimate

One row per investigation. Holds the cached HUF damage range and the breakdown components. Re-computed (debounced, ≤ 30 s) on any change to its inputs (FR-048). The components themselves live in a `jsonb` array so adding a new `damage_method` does not require a schema change.

| Column | Type | Notes |
|---|---|---|
| `investigationId` | `uuid` PK FK → `Investigation.id` ON DELETE CASCADE | one estimate per investigation |
| `totalLowHuf` | `bigint` NOT NULL | Σ `components[*].lowHuf`, clamped ≥ 0 |
| `totalHighHuf` | `bigint` NOT NULL | Σ `components[*].highHuf`, clamped ≥ `totalLowHuf` |
| `confidence` | `damage_confidence` NOT NULL | derived from highest `evidence_grade` on attached records + cohort `n` (see §Damage estimate derivation) |
| `components` | `jsonb` NOT NULL | array of `DamageComponent` (shape below); at least one entry required when the row exists |
| `inputsHash` | `text` NOT NULL | sha256 of the canonicalized JSON of `{claimIds[], externalRecordIds[], redFlagIds[], benchmarkCohortHashes[]}` — debounce short-circuit key |
| `computedAt` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `componentCount` | `integer` GENERATED ALWAYS AS (`jsonb_array_length(components)`) STORED | denormalized for the queue KPI's COUNT-NULL filter (avoids `jsonb_array_length` in WHERE) |

**`DamageComponent` jsonb shape** (validated at write time by `damage.ts`; not enforced by the database):

```ts
{
  mechanism: corruption_mechanism,           // reuses existing enum
  lowHuf: string,                            // bigint serialized as string (jsonb does not carry bigint precision)
  highHuf: string,
  method: damage_method,
  inputs: {
    claimIds?: string[],                     // ArticleClaim.id
    externalRecordIds?: string[],            // ExternalRecord.id
    benchmarkCohortHash?: string,            // Benchmark.cohortHash
    formula: string,                         // Hungarian, human-readable; mandatory
    citation?: { studyId: string, sourceUrl: string, lastVerifiedAt: string },
  },
  notes: string                              // Hungarian, ≤ 200 chars; "" allowed
}
```

**Indexes / constraints**:
- `PRIMARY KEY (investigationId)` — 1:1 with Investigation, also the upsert key.
- `INDEX (computedAt)` — queue KPI sums over recent rows; nightly drift audit.
- `INDEX (componentCount) WHERE componentCount = 0` — partial index, supports the "no estimate yet" filter on the queue.
- `CHECK (totalLowHuf >= 0 AND totalHighHuf >= totalLowHuf)`.
- `CHECK (jsonb_typeof(components) = 'array' AND jsonb_array_length(components) >= 0)` — empty array allowed (means "no evidence yet"); the row itself is mandatory once the function has run at least once.
- `CHECK (length(inputsHash) = 64)` — sha256 hex length.

**Lifecycle**:
- Created and upserted by `investigation.damage-recompute` Inngest function (FR-048). The function reads inputs, computes `inputsHash`, and short-circuits when the hash matches the stored value.
- Cascade-deleted with the parent `Investigation` (ON DELETE CASCADE). DSR (FR-034) anonymizes the parent investigation but leaves the row in place — the cached totals are aggregated from already-anonymized inputs and do not need a separate redaction pass.
- Never written by the application directly; the route `POST /api/admin/investigations/[id]/recompute-damage` (if it ever ships) emits an event and returns 202.

---

### SignalContribution

One row per signal that contributes to `Investigation.quantityScore` (FR-050). Each row is the audited summand behind the headline score. Together they satisfy the invariant `Investigation.quantityScore = Σ effectiveWeight ± 0.01` (FR-051, SC-016).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `defaultRandom()` |
| `investigationId` | `uuid` NOT NULL FK → `Investigation.id` ON DELETE CASCADE | |
| `sourceKind` | `signal_source_kind` NOT NULL | which class of evidence produced the signal |
| `sourceId` | `text` NOT NULL | id of the underlying row — `ExternalRecord.id` / `RedFlagCheck.id` / `ArticleClaim.id` / `Benchmark.cohortHash` |
| `baseWeight` | `numeric(4, 2)` NOT NULL | per FR-022 / FR-023 — `1.00` for a corroborating external record, `0.50–1.00` for a failing red flag depending on severity, etc. |
| `stalenessMultiplier` | `numeric(3, 2)` NOT NULL | per FR-024 — `1.00` when source ≤ 540 days, `0.50` when > 540 days; granular bands documented in `score.ts` |
| `effectiveWeight` | `numeric(5, 2)` GENERATED ALWAYS AS (`baseWeight * stalenessMultiplier`) STORED | denormalized for the score table render and the invariant SUM |
| `addedAt` | `timestamptz` NOT NULL DEFAULT `now()` | |

**Indexes / constraints**:
- `INDEX (investigationId)` — score table render (read every row for a given case).
- `UNIQUE (investigationId, sourceKind, sourceId)` — one row per (case, signal); a re-run upserts.
- `INDEX (sourceKind, sourceId)` — reverse lookup when a source row changes (used to invalidate the cache on the originating side).
- `CHECK (baseWeight >= 0 AND baseWeight <= 5.00)` — sanity guard.
- `CHECK (stalenessMultiplier > 0 AND stalenessMultiplier <= 1.00)`.

**Lifecycle**:
- Written by `investigation.score` (existing function, extended): on each recompute, deletes existing rows for the investigation and re-inserts the current set inside one transaction. The `Investigation.quantityScore` UPDATE happens in the same txn so the invariant cannot drift mid-write.
- Cascade-deleted with the parent `Investigation`. The DSR anonymization path (FR-034 / FR-035) deletes `ArticleClaim` rows that name the subject, which in turn causes the next `investigation.score` re-run to omit any `claim_corroboration` signals that referenced those claims; rows for surviving signals (external records, red flags) stay.

> **Note on the original score-component derivation paragraph** (above the addendum): the SUM formula is unchanged; the change is *where* the summands live. Before this addendum the SUM existed only inside `score.ts` and the result was persisted on `Investigation.quantityScore`. From this addendum forward, each summand is also persisted as a `SignalContribution` row so the score panel can render the breakdown without re-deriving it.

---

### InvestigationJobState

One row per (`investigationId`, `jobKind`) — the latest state of each reviewer-triggered Inngest run for an investigation (FR-053). The detail-page pipeline panel reads from this table; the polling/SSE endpoint streams its changes.

| Column | Type | Notes |
|---|---|---|
| `investigationId` | `uuid` NOT NULL FK → `Investigation.id` ON DELETE CASCADE | |
| `jobKind` | `job_kind` NOT NULL | `'xref'` / `'redflags'` / `'hypothesis_loop'` / `'benchmarks'` / `'damage_recompute'` |
| `state` | `job_state` NOT NULL DEFAULT `'idle'` | |
| `startedAt` | `timestamptz` NULL | non-null when `state IN ('running','done','failed')` |
| `finishedAt` | `timestamptz` NULL | non-null when `state IN ('done','failed')` |
| `inngestRunId` | `text` NULL | the Inngest run that owns this state — null for synthetic `'idle'` initial rows |
| `summary` | `text` NULL | Hungarian one-liner on `done` (e.g., `"4 új TED rekord, 8.3 s."`) |
| `errorMessage` | `text` NULL | Hungarian-translated on `failed` — already passed through `tError()` so this column never contains an internal code or English string (FR-056) |
| `updatedAt` | `timestamptz` NOT NULL DEFAULT `now()` | bumped on every transition |

**Indexes / constraints**:
- `PRIMARY KEY (investigationId, jobKind)` — exactly one row per case+kind; transitions are upserts on the PK.
- `INDEX (state, updatedAt) WHERE state = 'running'` — partial index used by the polling/SSE endpoint to find live jobs cheaply.
- `CHECK ((state IN ('running','done','failed')) = (startedAt IS NOT NULL))` — paired nullability.
- `CHECK ((state IN ('done','failed')) = (finishedAt IS NOT NULL))` — paired nullability.
- `CHECK ((state = 'done') >= (summary IS NOT NULL))` — `done` MUST carry a Hungarian summary.
- `CHECK ((state = 'failed') >= (errorMessage IS NOT NULL))` — `failed` MUST carry a Hungarian error message.

**State transitions**:

```
                       startJob()
              ┌───────────────────────┐
              ▼                       │
   idle ──→ running ──→ done          │
              │                       │
              └──→ failed ────────────┘
                       (next call resets to running)
```

- Transitions written by `lib/investigation/job-state.ts` helpers (`startJob` / `completeJob` / `failJob`), always inside `step.run` so a retry replays the same transition.
- `damage_recompute` follows the same shape as the four reviewer-triggered kinds, with the difference that the job is event-debounced rather than button-triggered.
- Cascade-deleted with the parent `Investigation`.

---

### Extensions to existing entities (addendum)

#### Investigation

No schema change. The existing `quantityScore` / `qualityScore` / `updatedAt` columns stay; their write path now also writes the corresponding `SignalContribution` rows in the same transaction. The FR-051 invariant `quantityScore = Σ SignalContribution.effectiveWeight ± 0.01` is asserted by the `investigation.score` function on every write and audited by a nightly drift sweep (see §Drift handling below).

#### AuditLog

No schema change. New `action` enum values used (the column is `text`, no migration needed):

```
investigation.damage.recomputed              # written by investigation.damage-recompute on a non-short-circuit run
investigation.damage.cap_applied             # written when FR-047 caps a component; metadata names the capped mechanism
investigation.signal.invariant_drift         # written when |quantityScore − Σ effectiveWeight| > 0.01 on a write
investigation.job.failed                     # written when an Inngest job ends in 'failed' state
investigation.citation.source_unreachable    # written by the nightly drift sweep when a stored citation URL 4xx/5xx's
```

All new actions follow the default 24-month partition rotation (constitution Principle IV).

#### InvestigationLead

No schema change. The new lead kinds emitted by the addendum reuse the existing `lead_kind` enum's `'reviewer_question'` slot — that value is generic enough to carry the addendum's structured findings via `testedAgainst` jsonb. The specific lead reasons surfaced in the UI are derived from the lead's `testedAgainst.reason` field rather than a new enum value, to keep the migration additive:

```
testedAgainst.reason = 'cohort_too_thin'         # FR-041 — emitted when n < 10 suppresses a benchmark_deviation component
testedAgainst.reason = 'claim_record_conflict'   # spec Edge Case (addendum) — emitted when claim.allegedAmountHuf disagrees with ExternalRecord.valueHuf
testedAgainst.reason = 'cohort_window_drift'     # spec Edge Case (addendum) — emitted when cohort time window overlaps < 50% with the contract's award year
testedAgainst.reason = 'score_invariant_drift'   # written alongside investigation.signal.invariant_drift audit row
```

The reviewer-facing UI maps these reason strings to Hungarian labels through `i18n-errors.ts`'s registry — the same translator that satisfies FR-056.

---

### Migration plan (addendum)

`app/supabase/migrations/0012_damage_evidence_spine.sql`, additive only:

1. `CREATE TYPE` for the four new enums (`damage_confidence`, `damage_method`, `signal_source_kind`, `job_kind`, `job_state`). Five `CREATE TYPE` statements total.
2. `CREATE TABLE` for the three new tables, in dependency order:
   1. `DamageEstimate` (FK → Investigation)
   2. `SignalContribution` (FK → Investigation)
   3. `InvestigationJobState` (FK → Investigation)
3. `CREATE INDEX` for every index above (5 indexes total across the three tables, including the two partial indexes).
4. Backfill (one-shot, run separately from the DDL migration so the migration is pure DDL):
   - Insert one `InvestigationJobState{ state: 'idle' }` row per (investigationId, jobKind) for every existing investigation × every `job_kind` value. ~33 k × 5 = ~165 k rows. Fast on Postgres; runs inside a single SQL `INSERT … SELECT … FROM "Investigation" CROSS JOIN unnest(enum_range(NULL::job_kind))`.
   - Emit one `investigation.damage-recompute` event per existing investigation (via the `investigation-damage-backfill` one-shot Inngest function described in `tasks.md` T114), at 50/sec. The backfill populates `DamageEstimate` and `SignalContribution` lazily through the same recompute path that handles steady-state writes.

No `DROP`, `ALTER … DROP COLUMN`, `RENAME`, or `NOT NULL` backfill — constitution Principle VII's two-step rule does not bind. The migration ships in its own PR ahead of the application code that depends on it (matching the `0011` pattern).

---

### Soft-delete & anonymization rules (addendum)

- `DamageEstimate`, `SignalContribution`, `InvestigationJobState`: all cascade-delete with the parent `Investigation` (`ON DELETE CASCADE`). None of them are soft-deleted independently.
- DSR (FR-034) anonymization of an `Investigation` leaves the three new tables in place: they hold derived data computed from already-anonymized inputs and carry no personal data themselves.
- DSR (FR-035) deletion of an `ArticleClaim` triggers an `investigation.damage-recompute` and an `investigation.score` re-run on the next inputs-changed event — the recompute observes the now-missing claim and omits it from both the damage components and the signal contributions. No explicit cascade is required; the upsert pattern handles it.
- The `errorMessage` column on `InvestigationJobState` stores Hungarian error strings that come from `tError()` — never a raw stack trace, never a query string. DSR therefore does not need to scrub this column.

---

### Damage estimate derivation

The `investigation.damage-recompute` function computes `DamageEstimate` from these inputs (all read-only):

1. **Per-component formulas** (FR-041 .. FR-045):
   - **`benchmark_deviation` (overpricing)** — when an `ExternalRecord` carries `valueHuf` + a dimension AND a matching `Benchmark` row has `n ≥ 10`: `lowHuf = max(0, valueHuf − p90 × quantity)`, `highHuf = max(0, valueHuf − p10 × quantity)`. If `n < 10`, suppress the component and emit a `cohort_too_thin` lead instead.
   - **`amendment_delta`** — when an `ExternalRecord` carries ≥ 1 value-increasing amendment in its `rawPayload`: `mid = Σ amendment_increase`, `lowHuf = mid × 0.80`, `highHuf = mid × 1.20`.
   - **`industry_estimate` (single bidder / no bid)** — when a `RedFlagCheck` for `'single_bidder'` or `'no_bid'` has `verdict = 'fail'` and the linked record carries a `valueHuf`: `lowHuf = valueHuf × 0.05`, `highHuf = valueHuf × 0.15`. Citation: OECD 2022 single-bidder premium.
   - **`industry_estimate` (related party)** — when a `RedFlagCheck` for `'related_party'` has `verdict = 'fail'`: `lowHuf = valueHuf × 0.05`, `highHuf = valueHuf × 0.15`. Citation: World Bank government corruption study.
   - **`claim_consolidation` (phantom service)** — when one or more `ArticleClaim` rows have `mechanism = 'phantom_service'` and `allegedAmountHuf IS NOT NULL`: `lowHuf = min(claim.allegedAmountHuf, contract_value OR +∞)`, `highHuf = max(claim.allegedAmountHuf over consolidated group)`. Without a contract anchor, multiply by `0.7` and `1.3` respectively.

2. **Claim deduplication** (FR-046): claim-groups are formed by `(vendor_normalized, year, amount within ±20%)`; the group's amount is the highest-confidence claim's amount — never summed.

3. **Cross-component cap** (FR-047): when multiple components reference the same `ExternalRecord`, the sum of their `highHuf` MUST NOT exceed that record's `valueHuf`. The cap is applied to the lowest-priority component first, where the priority order is `overpricing > amendment_inflation > kickback > no_bid > phantom_service`. Each cap emits an audit row `investigation.damage.cap_applied` naming the capped mechanism.

4. **Confidence derivation**:
   - `'high'` if at least one input record has `evidence_grade ∈ {audit_report, court_document}` AND every benchmark cohort used has `n ≥ 30`.
   - `'medium'` if at least one input record has `evidence_grade ∈ {investigative_journalism, prosecutor_statement}` OR a benchmark cohort has `n ≥ 10`.
   - `'low'` otherwise.

5. **Totals**: `totalLowHuf = Σ components[*].lowHuf`, `totalHighHuf = Σ components[*].highHuf`. Both clamped ≥ 0; `totalHighHuf` clamped ≥ `totalLowHuf` as a final guard.

6. **`inputsHash`** = sha256 of the canonicalized JSON of `{claimIds: sorted(), externalRecordIds: sorted(), redFlagIds: sorted(), benchmarkCohortHashes: sorted()}`. When the hash matches the stored row's `inputsHash`, the function short-circuits and writes nothing.

---

### Signal contribution derivation

The `investigation.score` function (extended for this addendum) emits `SignalContribution` rows from these inputs:

| `sourceKind` | Selection rule | `baseWeight` |
|---|---|---|
| `external_record` | one row per `ExternalRecord` with `relevance = 'corroborates'`, grouped by `sourceSystem` so multiple records from the same system count once | `1.00` |
| `red_flag` | one row per `RedFlagCheck` with `verdict = 'fail'` AND `severity ∈ ('medium','high','critical')` | `severity == 'medium' → 0.50`, `'high' → 0.80`, `'critical' → 1.00` |
| `claim_corroboration` | one row per distinct `(articleSource, articleId)` once two or more `ArticleClaim` rows from different articles name the same primary party and mechanism | `0.50` |
| `benchmark_deviation` | one row per `Benchmark` with `n ≥ 10` that fired as an outlier (computed by `benchmarks.ts`) | `0.50` |

`stalenessMultiplier` is computed from the source row's `fetchedAt` / `createdAt` / `evaluatedAt` per FR-024: `1.00` when ≤ 540 days, `0.50` when > 540 days (the existing decay; granular bands documented in `score.ts` apply unchanged).

`effectiveWeight` is the generated column. The `Investigation.quantityScore` UPDATE uses `(SELECT COALESCE(SUM(effective_weight), 0) FROM "SignalContribution" WHERE investigation_id = $1)` inside the same transaction that wrote the SignalContribution rows, so the FR-051 invariant cannot drift between the two writes.

---

### Drift handling

The FR-051 invariant `Investigation.quantityScore = Σ SignalContribution.effectiveWeight ± 0.01` is enforced in three places:

1. **At write time**: `investigation.score` recomputes both sides in the same transaction. Mechanical drift is impossible by construction.
2. **On render**: the detail-page server-component sums the rows it fetched and emits a `Sentry.addBreadcrumb({ category: 'investigation.signal.invariant_drift' })` if the SUM disagrees with the headline. Non-blocking; the page still renders.
3. **Nightly sweep**: a one-statement audit query (already drafted in `tasks.md` T115) runs against the DB, lists drifted rows to a Sentry alert, and writes one `investigation.signal.invariant_drift` audit row per drifted investigation plus a `score_invariant_drift` lead. The on-call engineer triages from there.

The drift channel is named explicitly because the addendum's UX promises depend on it — without a working drift signal, the "auditable score" claim is rhetorical.

---

### Cross-references

- The addendum's user stories, FRs, and SCs live in [spec.md](./spec.md) §"Addendum 2026-05-19 — Damage→Evidence Spine".
- The migration phasing, test-and-implementation tasks, and dependency map live in [tasks.md](./tasks.md) §"Addendum 2026-05-19 — Damage→Evidence Spine" (T101 .. T156).
- The constitution re-check and the post-design re-evaluation live in [plan.md](./plan.md) §"Addendum 2026-05-19 — Damage→Evidence Spine".
