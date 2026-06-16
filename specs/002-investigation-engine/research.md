# Research: Investigation Engine

**Branch**: `002-investigation-engine` | **Spec**: [spec.md](./spec.md) | **Date**: 2026-05-15

Spec is fully clarified (see `spec.md#Clarifications`). No `NEEDS CLARIFICATION` markers remain. This document records the technology / pattern decisions that flow from the spec and the constitution before Phase 1 design.

---

## 1. LLM for claim extraction (Slice A)

**Decision**: Anthropic `claude-haiku-4-5` (model id `claude-haiku-4-5`) called via `@anthropic-ai/sdk` with structured-output (JSON schema) responses. Reuses the same SDK and pattern as `app/packages/db/src/kmdb-llm-tighten.ts`.

**Rationale**:
- Already in use in this repo for K-Monitor person tightening — a known-good cost/latency profile (≈4–6 s per call on typical article sizes, matches the spec assumption SC-061).
- Structured output keeps the parser deterministic and lets the extractor refuse malformed responses without a free-text post-processor.
- Haiku 4.5 is the cheapest model that delivers acceptable extraction quality at the spec's 33 k-article backlog scale.

**Alternatives considered**:
- Sonnet 4.6 — better quality, ~5× cost; spec's daily-spend ceiling (FR-005) would force a smaller throughput; rejected for steady-state extraction.
- Opus 4.7 — overkill for atomic-claim extraction; reserved (if needed) for the bounded hypothesis loop in Slice H.
- Local LLM (Llama 3, etc.) — operational overhead is incompatible with the Vercel + Inngest stack mandated by constitution Principle III.

**Extractor version**: a string of the form `{model}@{promptHash8}` (e.g., `haiku-4-5@a1b2c3d4`) computed at build time from the prompt template and the JSON schema; stored on every `ArticleClaim` row and used as part of the idempotency key (FR-002, FR-003).

---

## 2. Hypothesis-loop runtime (Slice H)

**Decision**: An Inngest function `investigation.hypothesis-loop` triggered by a reviewer-initiated `investigation.hypothesis.requested` event. Inside the function, the agent uses Anthropic tool-use with `claude-haiku-4-5` (escalatable to Sonnet 4.6 via env) bounded by three hard caps enforced in the function body — not as soft limits passed to the model:

1. ≤ 8 successful `tool_use` blocks per run.
2. ≤ 50 000 total tokens (sum of input + output across all messages in the run).
3. ≤ 90 seconds wall clock (`Date.now()` snapshot at start; checked before each tool dispatch).

Cap-bound termination writes an `InvestigationLead` row with `kind='hypothesis'`, `status='open'`, `createdBy='agent'`, `finding` naming the cap.

**Rationale**:
- Inngest gives us durable retries plus a hard concurrency cap (a single env-tunable `INVESTIGATION_HYPOTHESIS_CONCURRENCY`, defaults to 2) without standing up a separate worker. Matches constitution Principle III ("no separate `apps/worker/` package").
- The three caps map 1:1 to FR-021 / FR-023; enforcing them in code (not as prompt instructions) means the bounds hold even on prompt-injected article text.
- Tool definitions:
  - `read_cached_external_record(sourceSystem, externalId)` — DB read, no network.
  - `fetch_external_record(sourceSystem, query)` — calls the free-tier adapter; respects per-source-system concurrency-1 and the 2-second per-host gate from FR-016.
  - `compute_benchmark(dimension, cohortSpec)` — runs the benchmark engine; idempotent on `(dimension, cohortHash)`.
  - `record_lead(question, finding)` — writes an `InvestigationLead` (counts against the wall clock but is not network I/O).

**Alternatives considered**:
- Vercel AI SDK agents — adds another dependency, no clear win over the Anthropic SDK we already use.
- LangChain — explicit non-goal; opaque agent loops contradict FR-020 (every output must have an auditable explanation).
- Plain `setTimeout` + LLM loop inside a Next.js route handler — fails Vercel's hard 60-s function timeout and has no retry/observability.

---

## 3. External-record adapters & freshness windows (Slices C–E)

**Decision**: One adapter per free-tier source system, each implementing a uniform interface:

```ts
type Adapter = {
  sourceSystem: 'TED' | 'EKR' | 'KE' | 'palyazat' | 'ecegjegyzek'
    | 'opencorporates' | 'integritas' | 'olaf' | 'ksh' | 'eurostat'
    | 'kmonitor' | 'atlatszo' | 'webarchive';
  freshnessDays: number;     // staleness threshold (FR-015)
  perHostGateMs: number;     // ≥ 2000 (FR-016)
  fetch(query: AdapterQuery): Promise<RawExternalRecord>;
  parse(raw: RawExternalRecord): NormalizedExternalRecord;
};
```

Per-source-system concurrency-1 is enforced via a Postgres advisory lock keyed by `hash('external-fetch:' || sourceSystem)`. The per-host 2-s gate is enforced by a tiny in-memory `lastFetchedAt[host]` map inside the Inngest function instance — combined with Inngest's `concurrency: { key: 'event.data.sourceSystem', limit: 1 }`, this is sufficient (each function instance handles one source-system at a time).

**Default freshness windows** (env-tunable per source, defaults from the spec):

| Source                | Days |
|-----------------------|------|
| TED, EKR, KE          | 30   |
| palyazat.gov.hu       | 30   |
| e-cégjegyzék, OpenCorporates | 90 |
| Integritás, OLAF      | 60   |
| KSH STADAT, Eurostat  | 180  |
| K-Monitor, Átlátszó   | 60   |
| Web archive           | 365  |

**Rationale**: Each adapter encapsulates URL drift; constitution Principle VII (two-step migrations) does not apply to adapter code paths but the "last-verified" dated comment requirement from spec Assumptions does.

**Alternatives considered**:
- A single generic HTTP fetcher with per-source config in JSON — would push parsing into runtime branching; rejected because the parse step varies too widely (TED uses TED XML, OpenCorporates JSON, web archive HTML).
- Pre-built libraries (e.g., `node-opencorporates`) — vendor coverage for the EU-specific registries (TED, EKR, KE, palyazat, Integritás, OLAF) is thin or non-existent; we own the adapters anyway.

**Paid registries** (OPTEN, deep-ownership tier): NOT implemented as adapters at all. The "Escalate deep ownership lookup" action (FR-014) writes an `InvestigationLead` with `kind='escalation'`; the operator runs the paid lookup by hand and pastes the result back through an admin form that writes an `ExternalRecord` with `sourceSystem='manual:opten'` and the same provenance fields.

---

## 4. Clustering (Slice B)

**Decision**: A deterministic, rule-based clusterer implemented as a Postgres-side query plus a small TypeScript orchestrator. No ML / embeddings.

**Algorithm** (one pass per new claim):
1. Normalize every party name on the new claim with `unaccent(lower(name))` plus stripping of common Hungarian honorifics (`dr.`, `id.`, `ifj.`). Existing party normalization on KMonitorPersonCandidate already does this; reuse the helper.
2. Find candidate investigations where at least one existing claim has an overlapping normalized name.
3. Apply the FR-008 / FR-009 predicates:
   - Default path: name overlap ≥ 1, amounts (if both present) within 2× band, article dates within ±180 days.
   - Unknown-amount path (new claim has null amount AND no existing claim on the candidate carries an amount): name overlap ≥ 2 distinct names, article dates within ±90 days.
4. If exactly one candidate passes → attach.
5. If two or more pass → write a `needs_reviewer` lead (FR-010), do not attach.
6. If zero pass → create a new investigation with `status='new'` (FR-011, FR-011a).

**Rationale**:
- Deterministic predicates are auditable (FR-020 ethos). Embeddings would be opaque and the spec explicitly forbids opaque scoring (FR-020/025).
- Postgres `pg_trgm` on `displayName` and the existing `unaccent`-based normalization give the candidate prefilter in one indexed query.

**Alternatives considered**:
- Embedding-based clustering — opaque, hard to explain to reviewers, and contradicts FR-020.
- Always-merge with reviewer review-after-the-fact — too costly to undo and reverses the spec's intent (FR-010 declines on ambiguity).

---

## 5. Benchmark engine (Slice F)

**Decision**: A constrained list of benchmark dimensions encoded as a TypeScript discriminated union. Each dimension has:
- A name (`huf_per_sqm_hospital`, `huf_per_km_road`, …).
- A cohort spec (filters over the `ExternalRecord` table: source systems, record types, date range).
- A deterministic `cohortHash = sha256(JSON.stringify({dimension, cohortSpec}))` used as the upsert key on the `Benchmark` table (FR-017).
- A p10/p50/p90 + n computation done in SQL (`percentile_cont`) against the cohort.

Adding a new dimension is a code change reviewed in PR (FR-018) — not free-text input.

**Rationale**: Putting the dimensions in code keeps them code-reviewed, type-checked, and migration-free; the `Benchmark` table is just a cache of computed results keyed by `cohortHash`.

**Alternatives considered**:
- Reviewer-entered cohort specs in the admin UI — opens the door to spurious benchmarks; rejected by FR-018.
- ML-driven outlier detection — opaque scoring, contradicts FR-020.

---

## 6. Optimistic concurrency on investigations (FR-031c)

**Decision**: Every state-changing write on `Investigation` (status change, tier promotion, summary edit, manual merge, score recompute initiated by reviewer) is implemented as a `WHERE id = ? AND updatedAt = ?` UPDATE that also bumps `updatedAt = now()` in the same statement. A row-count of 0 means the row advanced; the API responds 409 Conflict and the UI shows a reload prompt.

**Rationale**:
- Simpler than a row-version counter; `updatedAt` is already a constitution-mandated convention.
- Lead rows (`InvestigationLead`) are naturally one-row-per-action and require no concurrency control (FR-031c, last sentence).

**Alternatives considered**:
- Row-level locks (`SELECT … FOR UPDATE`) — serializes reviewers on the same investigation; rejected because the reviewer audience is small and conflicts are rare.
- Last-write-wins — explicit non-goal of FR-031c ("no silent overwrite").

---

## 7. Polymorphic article reference (FR-006, FR-035)

**Decision**: `ArticleClaim.articleSource` is an enum (`news` | `kmonitor`) and `ArticleClaim.articleId` is `text` (matches `NewsArticle.id` which is `text`, and `KMonitorArticle.newsId::text` for kmonitor articles). No foreign key — a janitor Inngest function (`investigation.orphan-cleanup`, nightly) deletes claim rows whose parent article no longer exists. The same janitor handles the FR-006 cascade.

**Rationale**:
- A real FK is impossible across two parent tables.
- The K-Monitor harvester re-snapshots and can legitimately drop articles; we already have the precedent of nullable references with janitor cleanup elsewhere in the codebase (e.g., `decidedBy` on `KMonitorPersonCandidate`).
- The janitor runs nightly and explicitly skips rows whose parent was deleted *after* extraction started this hour (Edge Case: "Janitor runs while extraction is in flight").

**Alternatives considered**:
- A single `Article` parent table covering both sources — too invasive for an additive feature; would force a Phase-3 schema migration that depends on Phase-3 code (forbidden by constitution Principle VII).
- DB-side triggers — opaque, harder to test, and the janitor already exists.

---

## 8. Daily LLM spend kill switch (FR-005)

**Decision**: A single `DailyLlmUsage` row per `(date, model)`, upserted by the extraction Inngest function inside the same transaction that writes the claims. Before each LLM call, the function reads the current day's row with `SELECT … FOR UPDATE` inside a short transaction; if `estimatedHufSpend >= LLM_DAILY_CEILING_HUF`, the function emits an `investigation.extraction.paused` event (Sentry breadcrumb + Better Stack alert) and returns without calling the model.

The next day's first call sees a row that doesn't exist yet (or the prior day's row) and proceeds normally — no manual reset.

**Rationale**: Matches the existing daily-counter pattern used elsewhere in the codebase and keeps the kill-switch logic local to the extraction function.

**Alternatives considered**:
- A separate Inngest scheduled function that flips a feature flag — adds latency between the breach and the pause.
- A Redis counter — constitution Principle III forbids using Redis as anything other than a rate-limiter.

---

## 9. Public-tier promotion atomicity (FR-028)

**Decision**: Public-tier promotion runs inside a single Postgres transaction that:
1. Re-evaluates the promotion predicate (FR-026, FR-031c re-check at click time).
2. Inserts the new `Case` row (the existing wanted-poster surface).
3. Inserts dependents (`Case_*` joins — currently `cases` only has direct columns, no dependent rows; if Slice K adds any, they go in this txn).
4. Refreshes the per-jurisdiction rollup (already a single-row upsert, debounced by Inngest elsewhere — but the synchronous refresh on promotion is allowed because it is an admin write path, not a public read path; constitution Principle V applies to web request path KPIs, not to admin mutations).
5. Updates `Investigation.publicCaseId` and `Investigation.disclosureTier='public'`.
6. Writes the `AuditLog` row with `action='investigation.promoted.public'`.

If any step fails, the transaction rolls back — no half-written case.

**Rationale**: Constitution Principle V forbids synchronous recompute on the *web request path*; admin promotion is not a web request path, and the spec requires atomicity (FR-028). The `revalidateTag('stats')` call happens *after* commit, outside the txn.

---

## 10. Public-tier render gate (FR-032, FR-033)

**Decision**: A boolean `PUBLIC_TIER_ENABLED` env var (default `false` in every environment, asserted at Vercel build time). Public-tier render code paths (`apps/web/app/galeria/[id]` once Slice K touches them, and any new `/public/cases/*` route added by this feature) read this flag at request time; when off, they return a 404. CODEOWNERS on:
- `apps/web/app/galeria/**`
- Any new file under `apps/web/app/public/**` (if Slice K introduces one)
- `apps/web/src/lib/public-render/**`
- `app/supabase/migrations/0011_investigation_engine_*.sql` (the public-case-link migration)

requires a counsel-approved reviewer. The counsel-approved redaction policy lives at `app/docs/public-tier-redaction-policy.md` (created in Slice K; the file's mere existence is checked by CI before any public-tier render path is allowed to ship).

**Rationale**: Triple defense — env flag off + CODEOWNERS + counsel doc — matches the spec's three-line public-tier gate (FR-033) and is consistent with constitution Principle I (trust posture above convenience).

---

## 11. Investigations queue tab ordering (FR-012)

**Decision**: Edit `apps/web/app/admin/(authed)/admin-tabs.tsx` to add an `Investigations` tab before the existing `K-Monitor persons` tab. The new tab links to `/admin/investigations`. The legacy K-Monitor persons tab and its routes are unchanged.

**Rationale**: Minimal invasion of the existing admin shell; matches the spec's "primary entry point" requirement without breaking back-compat.

---

## 12. Audit log integration (FR-031)

**Decision**: Reuse the existing `AuditLog` table (already partitioned by month per constitution Principle IV) for every new state-changing reviewer action. New `action` enum values introduced by this feature:

- `investigation.claim.extracted` (system, not reviewer — but logged for observability)
- `investigation.created` (system, from clustering)
- `investigation.lead.created`
- `investigation.lead.resolved`
- `investigation.status.changed` (reviewer-only)
- `investigation.merged` (reviewer-only)
- `investigation.xref.requested` (reviewer-only)
- `investigation.hypothesis.requested` (reviewer-only)
- `investigation.escalation.requested` (reviewer-only)
- `investigation.escalation.writeback` (reviewer-only, the paid-result paste-back)
- `investigation.tier.promoted.{journalist|prosecutor|public}` (reviewer-only)
- `investigation.tier.depromoted.public` (reviewer-only)
- `investigation.anonymized` (system, from DSR sweep)

The `actorEditorId` field on `AuditLog` carries the reviewer's id for reviewer actions and is null for system actions. No new audit-log table.

**Rationale**: Constitution Principle IV mandates one audit log; the existing table already partitions by month and retains pii-read actions 24 months, which subsumes our needs.

---

## 13. Project layout decisions

- All new schema lives in `app/packages/db/src/schema.ts` (single-file schema convention preserved).
- New raw-SQL migration: `app/supabase/migrations/0011_investigation_engine.sql` (additive — new tables + enums only; no destructive ops, so the two-step constitution rule does not apply but the migration still ships separately from the code that depends on it per Principle VII).
- New Inngest functions go in `app/apps/web/src/inngest/functions/`:
  - `investigation-extract-claims.ts` (Slice A)
  - `investigation-cluster.ts` (Slice B)
  - `investigation-xref.ts` (Slices C–E, fan-out per source system)
  - `investigation-benchmark.ts` (Slice F)
  - `investigation-redflags.ts` (Slice G)
  - `investigation-hypothesis-loop.ts` (Slice H)
  - `investigation-score.ts` (Slice I)
  - `investigation-promote-public.ts` (Slice K, atomic write)
  - `investigation-orphan-cleanup.ts` (FR-006, FR-035)
  - `investigation-anonymize-dsr.ts` (FR-034)
  - `investigation-refresh-stale-external.ts` (FR-015, nightly batch)
- New admin routes under `app/apps/web/app/admin/(authed)/investigations/`.
- New admin APIs under `app/apps/web/app/api/admin/investigations/`.
- New shared types in `app/packages/shared/src/investigation.ts` (DTOs shared between API routes and admin UI).
- External-record adapters in `app/packages/scrapers/src/adapters/` (`ted.ts`, `ekr.ts`, `ke.ts`, `palyazat.ts`, `ecegjegyzek.ts`, `opencorporates.ts`, `integritas.ts`, `olaf.ts`, `ksh.ts`, `eurostat.ts`, `kmonitor-adapter.ts`, `atlatszo.ts`, `webarchive.ts`). The `@korr/scrapers` package already exists; we extend it rather than create a new one.

**Rationale**: One Next.js app on the inbox-to-action stack (constitution Principle III). No new packages.

---

## 14. Resolved spec ambiguities — none

All five clarifications recorded in `spec.md#Clarifications` (admin role model, status lifecycle, tier handoff surface, optimistic concurrency, refresh prioritization) flow directly into Phase 1 design. No further questions need to be answered before tasks generation.
