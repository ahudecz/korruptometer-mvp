# Tasks: Investigation Engine

**Input**: Design documents from `/specs/002-investigation-engine/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/admin-investigations.md, contracts/inngest-events.md, quickstart.md

**Tests**: Included. The plan pins Vitest (unit + Inngest function tests) and Playwright + axe for new admin routes — generated as explicit tasks per slice.

**Organization**: Tasks are grouped by user story (US1–US6) to enable independent implementation, testing, and demo of each slice.

All paths are relative to the repository root `/home/attilah/Coding/corruption-tracker/`. The Next.js app lives under `app/` (see `plan.md` Structure Decision).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment variables, CODEOWNERS, and the public-tier feature flag scaffolding that the engine depends on but does not yet exercise.

- [X] T001 Append the eleven new env vars (`ANTHROPIC_API_KEY`, `INVESTIGATION_EXTRACTOR_MODEL`, `INVESTIGATION_EXTRACTOR_PROMPT_VERSION`, `LLM_DAILY_CEILING_HUF`, `EXTRACTION_CONCURRENCY`, `HYPOTHESIS_CONCURRENCY`, `HYPOTHESIS_MAX_TOOL_CALLS`, `HYPOTHESIS_MAX_TOKENS`, `HYPOTHESIS_MAX_WALL_MS`, `HYPOTHESIS_MODEL`, `REFRESH_STALE_TOP_N`, `PUBLIC_TIER_ENABLED`) to `app/.env.example` with the defaults from `quickstart.md` §2 (`PUBLIC_TIER_ENABLED=false`, `LLM_DAILY_CEILING_HUF=200000` for prod / `50000` dev hint comment).
- [X] T002 [P] Add CODEOWNERS entries in `CODEOWNERS` covering `app/apps/web/app/galeria/**`, `app/apps/web/src/lib/public-render/**`, `app/docs/public-tier-redaction-policy.md`, and `app/supabase/migrations/0011_investigation_engine.sql` so counsel-sensitive paths require counsel-tagged review (FR-033).
- [X] T003 [P] Wire `PUBLIC_TIER_ENABLED` parsing through `app/apps/web/src/lib/env.ts` (existing file) so downstream code reads a typed boolean; default `false` and assert at Vercel build time per `research.md` §10.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, shared types, Inngest registration, and pure helpers that every user story imports. Until this phase ships, no user story can be implemented.

**Critical**: No US-tagged work begins until Phase 2 is complete.

- [X] T004 Author the additive raw-SQL migration `app/supabase/migrations/0011_investigation_engine.sql` with the 14 enums and 10 tables from `data-model.md` in the documented dependency order (`ArticleExtractionRun`, `ArticleClaim`, `Investigation`, `InvestigationArticleLink`, `ExternalRecord`, `RedFlagCheck`, `InvestigationLead`, `InvestigationPublicCaseLink`, `Benchmark`, `DailyLlmUsage`), every index, every `CHECK` constraint, and `CREATE EXTENSION IF NOT EXISTS pg_trgm` as belt-and-braces.
- [X] T005 Extend the Drizzle schema in `app/packages/db/src/schema.ts` to mirror the migration: 14 `pgEnum` declarations, 10 `pgTable` declarations, every index and constraint, and the inferred `$inferSelect` / `$inferInsert` types. Export every new table and enum from the file's existing barrel.
- [X] T006 [P] Create `app/packages/shared/src/investigation.ts` with the wire-format DTOs (Investigation list item, Investigation detail bundle, ArticleClaim, ExternalRecord, RedFlagCheck, InvestigationLead, Benchmark) shared between admin API routes and the admin UI; re-export from `app/packages/shared/src/index.ts`.
- [X] T007 [P] Create `app/apps/web/src/lib/investigation/extractor-version.ts` that computes the build-time `{model}@{promptHash8}` string from `INVESTIGATION_EXTRACTOR_MODEL` + the prompt template + the JSON schema (research.md §1).
- [X] T008 [P] Create `app/apps/web/src/lib/investigation/normalize-name.ts` that re-exports / wraps the existing K-Monitor `unaccent(lower(name))` + Hungarian-honorific-strip helper so cluster predicates and adapter queries share one normalizer (research.md §4).
- [X] T009 [P] Create `app/apps/web/src/lib/investigation/concurrency.ts` exposing `withOptimisticUpdate(tx, table, id, expectedUpdatedAt, mutation)` that performs the `WHERE id = ? AND updatedAt = ?` UPDATE pattern from research.md §6 and throws a typed `StaleRowError` on rowcount 0; consumed by every state-changing route (FR-031c).
- [X] T010 [P] Create `app/packages/scrapers/src/adapters/types.ts` with the `AdapterQuery`, `RawExternalRecord`, and `Adapter` interfaces from `contracts/inngest-events.md` §Adapter contract; export from `app/packages/scrapers/src/index.ts`.
- [X] T011 Register a stub for each of the 11 Inngest functions in `app/apps/web/src/inngest/index.ts` (importing the still-empty function files so registration order is fixed early); the implementations land in the per-story phases. Function ids per `contracts/inngest-events.md` §Functions.
- [X] T012 Edit `app/apps/web/app/admin/(authed)/admin-tabs.tsx` to insert an `Investigations` tab linking to `/admin/investigations` **before** the existing `K-Monitor persons` tab (FR-012). The new route's page lands in Phase 4 — the tab can show a placeholder until then.

**Checkpoint**: Schema, types, helpers, Inngest registry, and the admin tab are wired. User stories can now proceed.

---

## Phase 3: User Story 1 — Structured claims for every article (Priority: P1) 🎯 MVP

**Goal**: Per-article LLM extraction writes idempotent `ArticleClaim` rows under a versioned extractor, with a daily HUF kill switch and a side-by-side viewer.

**Independent Test**: Ingest one news article → confirm N ≥ 0 `ArticleClaim` rows appear in the article admin viewer with quote + URL + locator (FR-036). Re-fire the same `investigation.article.ingested` event → zero new rows and `DailyLlmUsage.callCount` unchanged. Bump `INVESTIGATION_EXTRACTOR_PROMPT_VERSION` and re-fire → a new claim set appears with the old one still visible. Set `LLM_DAILY_CEILING_HUF=10` → next ingest emits `investigation.extraction.paused` and writes no claims.

### Tests for User Story 1

- [X] T013 [P] [US1] Vitest unit test for the extractor-version hasher in `app/apps/web/tests/inngest/investigation-extract-claims.test.ts` covering: (a) idempotency short-circuit on duplicate `(articleSource, articleId, extractorVersion)`, (b) zero-claim run still writes an `ArticleExtractionRun` marker, (c) daily-ceiling block emits the paused event and writes nothing.
- [X] T014 [P] [US1] Vitest unit test for the orphan-cleanup janitor in `app/apps/web/tests/inngest/investigation-orphan-cleanup.test.ts` covering: (a) claim rows whose parent article disappears are deleted, (b) rows with `createdAt > now() - interval '1 hour'` are skipped to avoid racing with in-flight extraction.
- [X] T015 [P] [US1] Vitest route test for `GET /api/admin/articles/:source/:id/claims` in `app/apps/web/tests/api/admin/articles-claims.test.ts` covering: latest-run flag, zero-claim run renders as `claimCount: 0` (not hidden), 404 on missing article.

### Implementation for User Story 1

- [X] T016 [US1] Create `app/apps/web/src/lib/investigation/llm-spend.ts` that reads the day's `DailyLlmUsage` row with `SELECT … FOR UPDATE`, returns `{ paused: boolean, currentSpendHuf, ceilingHuf }`, and upserts the post-call totals — feeds FR-004 / FR-005.
- [X] T017 [US1] Create `app/apps/web/src/lib/investigation/extract-prompt.ts` holding the structured-output JSON schema for atomic claims (mechanism enum, parties array with `kind`/`name`/`normalizedName`/`role`, paragraph locator, amount basis) plus the Hungarian-aware extraction prompt (research.md §1).
- [X] T018 [US1] Implement `app/apps/web/src/inngest/functions/investigation-extract-claims.ts` per the signature in `contracts/inngest-events.md` §Function signatures: idempotency probe via `ArticleExtractionRun`, daily-ceiling check, Anthropic call with structured output, FR-036 validator (reject claims missing quote/URL/locator), atomic write of `ArticleClaim` rows + `ArticleExtractionRun` + `DailyLlmUsage` upsert in one txn, emit `investigation.claims.extracted` (claimIds may be empty), `Sentry.addBreadcrumb` per FR-007.
- [X] T019 [P] [US1] Implement `app/apps/web/src/inngest/functions/investigation-orphan-cleanup.ts` (nightly `0 4 * * *`): delete `ArticleClaim` rows whose `(articleSource, articleId)` has no parent row in `newsArticles` / `kMonitorArticles`; skip claims with `createdAt > now() - interval '1 hour'`; also drop the matching `ArticleExtractionRun` rows (FR-006).
- [X] T020 [P] [US1] Wire the news scraper and the K-Monitor harvester to emit `investigation.article.ingested` after a successful article write. **Pre-verify** the insertion point in each scraper before editing: run `rg -n "insert.*newsArticles|insert.*kMonitorArticles" app/apps/web/src/inngest/functions/` and place the emit *immediately after* the successful insert/upsert (post-commit, inside the same Inngest `step.run` if one wraps the write). Expected files: `scrape-news.ts` and the K-Monitor traversal function(s) (`kmonitor-traverse-tag.ts` / `kmonitor-traverse-approved-tags.ts`); if any of these paths have drifted, fall back to whichever function holds the actual `db.insert(...).returning()` call. Emit `{ articleSource, articleId }`.
- [X] T021 [P] [US1] Implement `app/apps/web/app/api/admin/articles/[source]/[id]/claims/route.ts` (`GET`) per `contracts/admin-investigations.md` last section: returns the article header plus every `ArticleExtractionRun` (newest first), with each run's `ArticleClaim` array and `isCurrent` flag derived from the latest `extractorVersion` across the system.
- [X] T022 [P] [US1] Implement `app/apps/web/app/api/admin/investigations/llm-usage/route.ts` (`GET`) returning `{ ceilingHuf, rows, extractionPaused }` for the last `days=N` (default 30) per the contract.
- [X] T023 [US1] Build the claims panel under the existing article admin viewer: a new component `app/apps/web/app/admin/(authed)/articles/[id]/claims-panel.tsx` (or the K-Monitor article equivalent route) that renders one card per claim with mechanism, amount + basis, parties chip list, evidence quote, and a clickable `sourceUrl` anchored to `paragraphLocator`. Per FR-038, the panel MUST refuse to render any claim missing `sourceUrl`, `paragraphLocator`, or `evidenceQuote` (defense-in-depth: the schema CHECK already enforces this, but the UI guard prevents accidental degradation in future changes). Show the side-by-side diff when more than one `extractorVersion` is present.
- [X] T024 [P] [US1] Build the LLM-spend admin view at `app/apps/web/app/admin/(authed)/investigations/llm-usage/page.tsx` rendering the per-day table and a banner when `extractionPaused` is true (Acceptance Scenario S1.4 / FR-005 operator signal).

**Checkpoint**: Slice A is independently demoable end-to-end via `quickstart.md` §4 and §7.

---

## Phase 4: User Story 2 — Investigation queue with clustered claims (Priority: P2)

**Goal**: Cluster claims into investigations with deterministic predicates, surface them in an admin queue, and write `cluster_ambiguous` leads when a claim matches two cases.

**Independent Test**: Seed three articles naming the same official with amounts in a 2× band within 90 days → one investigation row with `articleCount = 3`. Add a fourth article whose only named party matches an unrelated investigation → a `cluster_ambiguous` lead appears, no auto-merge.

### Tests for User Story 2

- [X] T025 [P] [US2] Vitest unit test for clustering predicates in `app/apps/web/tests/inngest/investigation-cluster.test.ts`: default-path (FR-008), unknown-amount tighter path (FR-009), ambiguity → lead (FR-010), zero match → new investigation (FR-011).
- [X] T026 [P] [US2] Vitest route test for `GET /api/admin/investigations` in `app/apps/web/tests/api/admin/investigations-list.test.ts`: status / tier / `q` filters, cursor pagination, the three sort modes.
- [X] T027 [P] [US2] Vitest route test for `POST /api/admin/investigations/:id/status` in `app/apps/web/tests/api/admin/investigations-status.test.ts`: dismiss path, merge path (sets `mergedIntoId`), `If-Match` mismatch returns 409 `stale`.

### Implementation for User Story 2

- [X] T028 [US2] Implement `app/apps/web/src/lib/investigation/cluster.ts`: the deterministic match-predicate functions (default 2× / ±180 d / name overlap ≥ 1; unknown-amount ±90 d / name overlap ≥ 2), candidate fetch via `pg_trgm` on `primaryPersonNormalized` plus jsonb-gin scan of `ArticleClaim.parties`, and the resolution function returning `{ kind: 'attach', investigationId } | { kind: 'ambiguous', candidateIds } | { kind: 'new' }` (research.md §4).
- [X] T029 [US2] Implement `app/apps/web/src/inngest/functions/investigation-cluster.ts` triggered by `investigation.claims.extracted`: for each new claim, takes a Postgres advisory lock keyed on the deterministic primary-name list, applies `cluster.ts`, then attaches to one investigation OR writes a `cluster_ambiguous` `InvestigationLead` OR creates a new `Investigation` with `status='new'` plus its `InvestigationArticleLink`. Bump `articleCount` and `primaryPersonName`/`primaryPersonNormalized` on attach. Audit-log `investigation.created` on first create.
- [X] T030 [P] [US2] Implement `app/apps/web/app/api/admin/investigations/route.ts` (`GET`) with the query params, cursor decoder (per constitution Principle VI), and the response shape from the contract.
- [X] T031 [P] [US2] Implement `app/apps/web/app/api/admin/investigations/[id]/route.ts` (`GET`) returning the investigation header, attached articles (joined through `InvestigationArticleLink` to `NewsArticle` / `KMonitorArticle`), every `ArticleClaim` (current `extractorVersion` only), and an empty placeholder for `externalRecords` / `redFlags` / `leads` / `benchmarks` / `history` / `availableActions = []` (later phases fill these).
- [X] T032 [US2] Implement `app/apps/web/app/api/admin/investigations/[id]/status/route.ts` (`POST`) with `If-Match` optimistic-concurrency check via `withOptimisticUpdate`, dismiss path, merge path validating `mergedIntoId` exists and is not the same row, audit-log `investigation.status.changed` or `investigation.merged`.
- [X] T033 [P] [US2] Implement `app/apps/web/app/api/admin/investigations/[id]/summary/route.ts` (`PATCH`) with `If-Match`; audit `investigation.summary.updated` with the `before/after.summary` diff in the audit-log metadata field.
- [X] T034 [US2] Build the admin queue page at `app/apps/web/app/admin/(authed)/investigations/page.tsx` with the filter bar (`filters.tsx`) and a server-component table reading from the list API. Rows link to the detail page.
- [X] T035 [US2] Build the detail-page shell at `app/apps/web/app/admin/(authed)/investigations/[id]/page.tsx`: header (status badge, primary person/entity, article count, two score chips that are TBD this phase), a `claims-panel.tsx` (parallels US1's article-level claims panel but joined by investigation), and a `leads-panel.tsx` listing `cluster_ambiguous` rows with a "resolve" button (the resolve endpoint ships in US4).

**Checkpoint**: Slice B demoable per `quickstart.md` §5; the tab is now functional.

---

## Phase 5: User Story 3 — External evidence & benchmark deviations (Priority: P3)

**Goal**: Cross-reference free-tier registries on demand, attach `ExternalRecord` rows with full provenance, compute p10/p50/p90 cohort benchmarks, and let reviewers escalate paid lookups by hand.

**Independent Test**: On a seeded investigation with one named contractor, click "Run cross-reference" → at least one `ExternalRecord` with `sourceSystem='TED'` and `fetchedAt` within the last 30 days. For a contract amount that exceeds p90 of a hospital-construction cohort, the benchmarks panel shows the deviation with `n`, p10/p50/p90. Click "Escalate deep ownership lookup" → an `InvestigationLead` with `kind='escalation'` appears; pasting the result back writes an `ExternalRecord` with `sourceSystem='manual_opten'`.

### Tests for User Story 3

- [X] T036 [P] [US3] Vitest unit test per-adapter in `app/packages/scrapers/tests/adapters/<source>.test.ts` (one file per adapter, 13 total): fetch happy path against a recorded fixture, parse-failure path, per-host 2 s gate respected.
- [X] T037 [P] [US3] Vitest function test for `investigation.xref` in `app/apps/web/tests/inngest/investigation-xref.test.ts`: fan-out emits one step per applicable source, advisory-lock blocks parallel calls to the same source.
- [X] T038 [P] [US3] Vitest function test for `investigation.benchmarks-compute` in `app/apps/web/tests/inngest/investigation-benchmarks-compute.test.ts`: cohort hash is deterministic, percentile math matches `percentile_cont` reference, short-circuit emit when no dimension applies.

### Implementation for User Story 3

- [X] T039 [P] [US3] Create `app/apps/web/src/lib/investigation/source-lock.ts` exposing `withSourceSystemLock(sourceSystem, fn)` that wraps `pg_advisory_xact_lock(hashtext('external-fetch:' || sourceSystem))` so per-source-system concurrency-1 is enforced at the DB level (FR-016).
- [X] T040 [P] [US3] Create `app/apps/web/src/lib/investigation/benchmarks.ts` with the constrained dimension registry (`huf_per_sqm_hospital`, `huf_per_km_road`, `huf_per_mw_solar`, …), the cohort-spec generators, and the `cohortHash = sha256(JSON.stringify({dimension, cohortSpec}))` upsert key (FR-017 / FR-018).
- [X] T041 [P] [US3] Implement `app/packages/scrapers/src/adapters/ted.ts` against the TED public XML feed with the dated `// last-verified: 2026-05-15` comment, `Korruptometer-Bot/1.0` UA, `freshnessDays: 30`, `perHostGateMs: 2000`.
- [X] T042 [P] [US3] Implement `app/packages/scrapers/src/adapters/ekr.ts` (same conventions, `freshnessDays: 30`).
- [X] T043 [P] [US3] Implement `app/packages/scrapers/src/adapters/ke.ts` (Közbeszerzési Értesítő, `freshnessDays: 30`).
- [X] T044 [P] [US3] Implement `app/packages/scrapers/src/adapters/palyazat.ts` (`freshnessDays: 30`).
- [X] T045 [P] [US3] Implement `app/packages/scrapers/src/adapters/ecegjegyzek.ts` (`freshnessDays: 90`).
- [X] T046 [P] [US3] Implement `app/packages/scrapers/src/adapters/opencorporates.ts` (free-tier only, `freshnessDays: 90`).
- [X] T047 [P] [US3] Implement `app/packages/scrapers/src/adapters/integritas.ts` (`freshnessDays: 60`).
- [X] T048 [P] [US3] Implement `app/packages/scrapers/src/adapters/olaf.ts` (`freshnessDays: 60`).
- [X] T049 [P] [US3] Implement `app/packages/scrapers/src/adapters/ksh.ts` (KSH STADAT, `freshnessDays: 180`).
- [X] T050 [P] [US3] Implement `app/packages/scrapers/src/adapters/eurostat.ts` (`freshnessDays: 180`).
- [X] T051 [P] [US3] Implement `app/packages/scrapers/src/adapters/kmonitor-adapter.ts` reading from the existing K-Monitor own-datasets snapshot (`freshnessDays: 60`).
- [X] T052 [P] [US3] Implement `app/packages/scrapers/src/adapters/atlatszo.ts` (`freshnessDays: 60`).
- [X] T053 [P] [US3] Implement `app/packages/scrapers/src/adapters/webarchive.ts` (`freshnessDays: 365`).
- [X] T054 [US3] Implement `app/apps/web/src/inngest/functions/investigation-xref.ts` triggered by `investigation.xref.requested`: fans out one `step.invoke` per source system (`global: 4`), each step calls the matching adapter under `withSourceSystemLock`, upserts results into `ExternalRecord` keyed on `(investigationId, sourceSystem, externalId)`, recomputes `Investigation.oldestExternalRecordFetchedAt`, emits `investigation.xref.source.completed` per source.
- [X] T055 [US3] Implement `app/apps/web/src/inngest/functions/investigation-benchmarks-compute.ts` triggered by `investigation.xref.source.completed`: look up applicable dimensions from `benchmarks.ts`, compute the cohort via `percentile_cont` in SQL against `ExternalRecord WHERE relevance='benchmark'`, upsert `Benchmark` by `cohortHash`, emit `investigation.benchmarks.computed` (with `dimensionsComputed=[]` short-circuit when no dimension applies).
- [X] T056 [US3] Implement `app/apps/web/src/inngest/functions/investigation-refresh-stale-external.ts` (nightly `0 3 * * *` Europe/Budapest): SELECT investigations ORDER BY `articleCount DESC, oldestExternalRecordFetchedAt ASC` LIMIT `REFRESH_STALE_TOP_N` (default 100); for each, emit `investigation.xref.requested` so the same fan-out path is reused (FR-015).
- [X] T057 [P] [US3] Implement `app/apps/web/app/api/admin/investigations/[id]/xref/route.ts` (`POST`, `If-Match`, emits `investigation.xref.requested`, returns 202 with the expected source-systems list, audit `investigation.xref.requested`).
- [X] T058 [P] [US3] Implement `app/apps/web/app/api/admin/investigations/[id]/escalate/route.ts` (`POST`, `If-Match`, body `{ lookupKind, note }`, writes `InvestigationLead{ kind:'escalation', createdBy:'reviewer', actorEditorId }`, audit `investigation.escalation.requested`).
- [X] T059 [P] [US3] Implement `app/apps/web/app/api/admin/investigations/[id]/external-records/route.ts` (`POST`, `If-Match`, body per contract, server computes `fetchHash` from canonicalized `rawPayload` and sets `fetchedAt = now()`, writes `ExternalRecord`, audit `investigation.escalation.writeback` when `sourceSystem` starts with `manual_`).
- [X] T060 [P] [US3] Extend the detail-page GET in `app/apps/web/app/api/admin/investigations/[id]/route.ts` to populate `externalRecords` and `benchmarks` arrays (joined with cohort outlier flag) and add `run_xref` / `escalate_paid_lookup` / `write_paid_result` to `availableActions`.
- [X] T061 [P] [US3] Build `app/apps/web/app/admin/(authed)/investigations/[id]/external-records-panel.tsx` rendering one card per record with source-system badge, clickable `canonicalUrl`, `fetchedAt`, `relevance`, and `evidenceGrade` chips. Per FR-038, the panel MUST refuse to render any record whose `canonicalUrl` or `fetchedAt` is missing (matches the schema CHECK, but the UI guard makes the invariant explicit).
- [X] T062 [P] [US3] Build `app/apps/web/app/admin/(authed)/investigations/[id]/benchmarks-panel.tsx` rendering per-dimension cohort cards with `n`, p10/p50/p90, `isOutlier` flag, and the cohort spec readable on hover (FR-017).
- [X] T063 [US3] Wire the action bar buttons on the detail page: "Run cross-reference" (POST /xref), "Escalate deep ownership lookup" (POST /escalate), "Write paid-lookup result" (modal → POST /external-records). Surface 409 `stale` as a reload prompt.

**Checkpoint**: Slice C–F demoable per `quickstart.md` §6.

---

## Phase 6: User Story 4 — Red-flag rules and a bounded hypothesis agent (Priority: P3)

**Goal**: A declarative rule engine produces auditable verdicts in Hungarian; a bounded hypothesis loop runs inside ≤ 8 tool calls / ≤ 50 k tokens / ≤ 90 s wall clock and writes a `needs_reviewer` lead when any cap fires.

**Independent Test**: On an investigation whose TED record shows one bidder → `single_bidder` fires `fail` with a Hungarian observation and a link to the TED record. Click "Run hypothesis loop" → terminates inside the caps; either writes findings or a cap-hit lead naming which cap fired. A second click while the first is in flight → 409 `loop_in_flight`.

### Tests for User Story 4

- [X] T064 [P] [US4] Vitest unit test for `redflag-rules.ts` in `app/apps/web/tests/lib/redflag-rules.test.ts`: each rule's pass / fail / not-applicable branches against a fixture investigation; FR-020 invariant (every verdict has a non-empty `observationHu`).
- [X] T065 [P] [US4] Vitest function test for `investigation.hypothesis-loop` in `app/apps/web/tests/inngest/investigation-hypothesis-loop.test.ts`: cap on tool calls (fake-clock with the SDK mocked), cap on tokens, cap on wall clock; `seenLiveCalls` de-dups `(sourceSystem, externalId)`; second concurrent call rejected.
- [X] T066 [P] [US4] Vitest route test for `POST /api/admin/investigations/leads/:leadId/resolve` in `app/apps/web/tests/api/admin/leads-resolve.test.ts`: resolve and reject paths, audit row written.

### Implementation for User Story 4

- [X] T067 [US4] Implement `app/apps/web/src/lib/investigation/redflag-rules.ts` with the declarative rule set (single-bidder, amendment > 20 %, related-party award, contractor founded < 6 months before contract, single-source dominance, plus the benchmark-deviation rule reading `Benchmark`). Each rule returns `{ ruleId, severity, verdict, observationHu, supportingRecordIds }`. Hungarian observation strings are mandatory (FR-019 / FR-020).
- [X] T068 [US4] Implement `app/apps/web/src/inngest/functions/investigation-redflags.ts` invoked directly from the route (synchronous-ish via `inngest.send`): runs the rule registry, upserts `RedFlagCheck` rows by `(investigationId, ruleId)`, emits `investigation.score.requested`.
- [X] T069 [US4] Implement `app/apps/web/src/inngest/functions/investigation-hypothesis-loop.ts` per the signature in `contracts/inngest-events.md`: enforce the three caps in code, four tools (`read_cached_external_record`, `fetch_external_record`, `compute_benchmark`, `record_lead`), per-run `seenLiveCalls` set, write an `InvestigationLead{ kind:'hypothesis', createdBy:'agent', capFired }` on cap-fire; `retries: 0` (FR-023 — never auto-resume).
- [X] T070 [P] [US4] Implement `app/apps/web/app/api/admin/investigations/[id]/redflags/route.ts` (`POST`): triggers the redflags function and returns 200 with the latest `RedFlagCheck[]` (synchronous, no audit row).
- [X] T071 [P] [US4] Implement `app/apps/web/app/api/admin/investigations/[id]/hypothesis-loop/route.ts` (`POST`, `If-Match`): emits `investigation.hypothesis.requested`, returns 202 with `runId`, surfaces 409 `loop_in_flight` when the Inngest concurrency key collides.
- [X] T072 [P] [US4] Implement `app/apps/web/app/api/admin/investigations/leads/[leadId]/resolve/route.ts` (`POST`): body `{ status:'resolved'|'rejected', finding }`, updates the lead row, audit `investigation.lead.resolved`.
- [X] T073 [P] [US4] Extend the detail-page GET to populate `redFlags` and `leads` arrays and add `run_redflags` / `run_hypothesis_loop` to `availableActions`.
- [X] T074 [P] [US4] Build `app/apps/web/app/admin/(authed)/investigations/[id]/redflags-panel.tsx` rendering each verdict with a pass/fail/n-a chip, the Hungarian observation, and clickable links to every supporting external record. Refuse to render any verdict whose `supportingRecordIds` array is empty AND `observationHu` is empty (FR-038).
- [X] T075 [P] [US4] Extend `app/apps/web/app/admin/(authed)/investigations/[id]/leads-panel.tsx` (from Phase 4) to render hypothesis leads with `capFired` chip and a resolve dialog calling the resolve route.
- [X] T076 [US4] Wire the action bar buttons "Run red-flag rules" (POST /redflags) and "Run hypothesis loop" (POST /hypothesis-loop) with the 409 `loop_in_flight` UX prompt.

**Checkpoint**: Slice G + H demoable per `quickstart.md` §8 + §9.

---

## Phase 7: User Story 5 — Two-axis scoring with transparent components (Priority: P4)

**Goal**: Persist and render two independent scores (quantity / quality) with the FR-024 staleness decay; never aggregate them into a single opaque number.

**Independent Test**: An investigation with two distinct corroborating sources and one medium-severity red flag shows `quantityScore` reflecting weighted independent-signal count and `qualityScore` reflecting the highest evidence grade present. With one record 600 days old, that record's contribution is 0.5×.

### Tests for User Story 5

- [X] T077 [P] [US5] Vitest unit test for `score.ts` in `app/apps/web/tests/lib/score.test.ts`: distinct-source weighting, red-flag-severity contribution, 540-day staleness decay (0.5×), `qualityScore = max(evidenceGrade)`.
- [X] T078 [P] [US5] Vitest function test for `investigation.score` in `app/apps/web/tests/inngest/investigation-score.test.ts`: re-runs on each `investigation.score.requested`, bumps `updatedAt`, never writes a single aggregate score.

### Implementation for User Story 5

- [X] T079 [US5] Implement `app/apps/web/src/lib/investigation/score.ts` per `data-model.md` §Score-component derivation: `quantityScore` from distinct `(sourceSystem, relevance='corroborates')` records with staleness decay + medium-or-higher failing red-flag rules; `qualityScore` = max ordinal of `ExternalRecord.evidenceGrade`.
- [X] T080 [US5] Implement `app/apps/web/src/inngest/functions/investigation-score.ts` triggered by `investigation.score.requested` (and fan-in on `investigation.benchmarks.computed`): recomputes both components, updates `Investigation.quantityScore` / `qualityScore` / `updatedAt` in one statement.
- [X] T081 [P] [US5] Emit `investigation.score.requested` from the existing trigger points: end of `investigation.xref` per source, end of `investigation.redflags`, end of `investigation.benchmarks-compute`.
- [X] T082 [P] [US5] Render the two score chips on the detail page header (`app/apps/web/app/admin/(authed)/investigations/[id]/page.tsx`): "Quantity: X.XX" and "Quality: <grade>", never combined. Use the existing `fmtFt`-style helper for HUF when needed, and a Hungarian-labeled grade chip otherwise.

**Checkpoint**: Slice I demoable per `quickstart.md` §10.

---

## Phase 8: User Story 6 — Disclosure-tier promotion with legal gates (Priority: P4)

**Goal**: Promote investigations to journalist / prosecutor / public tiers behind server-side predicates and (for public) an atomic four-write transaction; public-tier render stays off behind env flag + CODEOWNERS + counsel policy doc. Depromotion soft-deletes; re-promotion creates a fresh case id.

**Independent Test**: On an investigation whose journalist predicate passes (quantity ≥ 2, quality ≥ `investigative_journalism`), promote → tier flips, audit logged, journalist filter shows the row, no email/webhook fires. On a case where the predicate doesn't pass, the button is hidden. Promote to public with `PUBLIC_TIER_ENABLED=false` → succeeds internally (Case row exists) but `/galeria/<id>` returns 404. Depromote → soft-deleted case stays in history; re-promote → new case id, both ids in history panel.

### Tests for User Story 6

- [X] T083 [P] [US6] Vitest function test for `investigation.promote-public` in `app/apps/web/tests/inngest/investigation-promote-public.test.ts`: re-evaluates predicate at commit time (FR-026 / FR-031c), all five writes commit together (Case, dependents, rollup refresh, Investigation, `InvestigationPublicCaseLink`), idempotency on a second promotion attempt (409 `already_promoted`), depromote → re-promote yields a fresh case id with the prior soft-deleted row visible **and** both link rows present in `InvestigationPublicCaseLink` (the older one with `depromotedAt` set, the newer one with `depromotedAt=null`).
- [X] T084 [P] [US6] Vitest route test for `POST /api/admin/investigations/:id/promote` in `app/apps/web/tests/api/admin/investigations-promote.test.ts`: 422 `predicate_failed` when score floor breaks between page load and click; 409 `stale` on `If-Match` mismatch.
- [X] T085 [P] [US6] Vitest function test for `investigation.anonymize-dsr` in `app/apps/web/tests/inngest/investigation-anonymize-dsr.test.ts`: investigation row stays with `[redacted]` + null normalized name; every `ArticleClaim` naming the subject is hard-deleted (FR-034 / FR-035); audit row written.
- [X] T086 [P] [US6] Playwright + axe test in `app/apps/web/tests/playwright/admin-investigations.spec.ts` against `/admin/investigations` and `/admin/investigations/:id` — fails the run on any serious or critical violation (constitution accessibility gate).

### Implementation for User Story 6

- [X] T087 [US6] Implement `app/apps/web/src/inngest/functions/investigation-promote-public.ts` per `contracts/inngest-events.md`: one Postgres transaction performs (1) `INSERT Case`, (2) `INSERT` `CasePerson` / `CaseEntity` dependents derived from investigation parties, (3) refresh the per-jurisdiction rollup the existing `/api/admin/cases` mutation uses, (4) `UPDATE Investigation` with `publicCaseId` / `disclosureTier='public'` / new `updatedAt`, (5) `INSERT InvestigationPublicCaseLink { investigationId, publicCaseId, promotedAt, promotedByEditorId }` so the history panel can render every prior case id (FR-030, S6.4). `revalidateTag('stats')` runs after commit. Re-evaluates the FR-026 predicate inside the txn.
- [X] T088 [US6] Implement `app/apps/web/src/inngest/functions/investigation-anonymize-dsr.ts` triggered by `investigation.dsr.deletion.upheld`: for every investigation that names the subject, set `primaryPersonName = '[redacted]'`, `primaryPersonNormalized = NULL`, mechanically replace the subject in `summary`; hard-delete every `ArticleClaim` whose `parties` JSON names the subject; audit `investigation.anonymized` (FR-034 / FR-035).
- [X] T089 [P] [US6] Implement `app/apps/web/app/api/admin/investigations/[id]/promote/route.ts` (`POST`, `If-Match`): for journalist / prosecutor tiers, runs synchronously (predicate check → `UPDATE Investigation` → audit `investigation.tier.promoted.<tier>`); for public, emits `investigation.promote.public.requested` and returns 202. Surfaces 409 `already_promoted` (FR-029), 422 `predicate_failed` (FR-026).
- [X] T090 [P] [US6] Implement `app/apps/web/app/api/admin/investigations/[id]/depromote/route.ts` (`POST`, `If-Match`): soft-deletes the linked `Case` row, keeps `publicCaseId` on the investigation, sets `disclosureTier='internal'`, sets the matching `InvestigationPublicCaseLink.depromotedAt = now()` for the current `(investigationId, publicCaseId)`, audit `investigation.tier.depromoted.public` (FR-030).
- [X] T091 [P] [US6] Server-evaluate the promotion predicates inside the detail-page GET (`availableActions`): `promote_journalist`, `promote_prosecutor`, `promote_public`, `depromote_public` only appear when their predicate passes (FR-027); add the public-tier corroborating-source check (`TED`/`EKR`/`palyazat`/`integritas`/`olaf` with `relevance='corroborates'`).
- [X] T092 [P] [US6] Build `app/apps/web/app/admin/(authed)/investigations/[id]/action-bar.tsx` rendering tier buttons keyed off `availableActions`. Never render a button whose action is absent.
- [X] T093 [P] [US6] Build `app/apps/web/app/admin/(authed)/investigations/[id]/history-panel.tsx` listing every public `Case` row this investigation has been linked to (including soft-deleted ones) with `promotedAt` / `depromotedAt`. Source the list from `InvestigationPublicCaseLink WHERE investigationId = ? ORDER BY promotedAt DESC` joined to the (possibly soft-deleted) `Case` row for headline display (FR-030, S6.4).
- [X] T094 [US6] Create the placeholder counsel-policy file pointer `app/docs/public-tier-redaction-policy.md` (one paragraph: "Awaiting counsel sign-off — public-tier render path is gated until this document is replaced.") so the CI check in T002 has something to attach to. The real policy text is written by counsel out-of-band before the public-tier flag flips.
- [X] T095 [US6] Gate `app/apps/web/app/galeria/[id]/page.tsx` (and any new `/public/cases/*` route this feature touches) on `PUBLIC_TIER_ENABLED` — return 404 when false, render normally when true (FR-032).

**Checkpoint**: Slice J + K demoable per `quickstart.md` §11; `/galeria/<id>` still 404s with the flag off.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Validation chain, observability, a11y, and the quickstart smoke run.

- [X] T096 [P] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` from repo root and fix every regression introduced by the feature.
- [X] T097 [P] Walk the full `quickstart.md` end-to-end on a clean local stack, log a per-section PASS/FAIL note (constitution Honesty Protocol), and attach the result to the PR.
- [X] T098 [P] Add Sentry breadcrumb instrumentation to every Inngest function (consistent `category: 'investigation.<slice>'`, `data: { investigationId, articleSource, articleId, ... }`) per FR-007; verify breadcrumbs land in Sentry under a test event.
- [X] T099 [P] Verify the CODEOWNERS check in T002 actually blocks a probe PR that touches `apps/web/app/galeria/**` without counsel approval; document the green/red signal in the PR description.
- [X] T100 Manual smoke: confirm the `availableActions` server contract refuses to render any tier button whose predicate fails between page load and click (Edge Case "Promotion predicate becomes false between page load and click" — server-side rejection with 422 `predicate_failed`).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies; start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks every user story.
- **Phase 3 (US1, P1) MVP**: Depends on Phase 2.
- **Phase 4 (US2, P2)**: Depends on Phase 2 + US1 (clustering reads `ArticleClaim`).
- **Phase 5 (US3, P3)**: Depends on Phase 2 + US2 (xref runs against an Investigation).
- **Phase 6 (US4, P3)**: Depends on Phase 2 + US3 (red flags and hypothesis loop both read `ExternalRecord`).
- **Phase 7 (US5, P4)**: Depends on US3 + US4 (signals come from both phases).
- **Phase 8 (US6, P4)**: Depends on US5 (predicates read the two scores) and the existing public `Case` schema.
- **Phase 9 (Polish)**: Depends on every preceding phase.

### User Story Dependency Map

```
US1 (claims) ─→ US2 (clustering) ─→ US3 (xref+benchmarks) ─┬─→ US5 (scoring) ─→ US6 (promotion)
                                                            └─→ US4 (rules+hypothesis) ─→ US5
```

This matches the slice ordering in the plan: A → B → C–F → G–H → I → J–K.

### Within Each User Story

- Pure helpers (`lib/investigation/*.ts`) before Inngest functions before API routes before UI panels.
- Unit tests for helpers / Inngest functions land alongside the code they cover, NOT before (the plan does not request TDD).
- Playwright + axe runs at the end of US6 because the full surface is only present then.

### Parallel Opportunities

- T002 / T003 in Phase 1.
- T006 / T007 / T008 / T009 / T010 in Phase 2 (different files, no inter-dependency).
- T013–T015 (US1 tests), T020–T022 / T024 (US1 routes + view), and T019 (orphan-cleanup) are all parallelizable once T018 (the extract function) is drafted.
- US2: T025–T027 (tests) and T030 / T031 / T033 (routes) parallel.
- US3 adapters T041–T053 are independent files; the entire batch is `[P]`.
- US3 routes T057–T062 parallel after T054/T055 land.
- US4 tests T064–T066 parallel; routes T070–T075 parallel after T067–T069.
- US5 tests T077–T078 parallel; T081 / T082 parallel after T080.
- US6 tests T083–T086 parallel; routes T089–T093 parallel after T087/T088.
- Polish T096–T099 fully parallel.

---

## Parallel Example: User Story 3 adapters

```bash
# Launch all 13 free-tier adapter implementations together:
Task: "T041 [P] [US3] Implement app/packages/scrapers/src/adapters/ted.ts"
Task: "T042 [P] [US3] Implement app/packages/scrapers/src/adapters/ekr.ts"
Task: "T043 [P] [US3] Implement app/packages/scrapers/src/adapters/ke.ts"
Task: "T044 [P] [US3] Implement app/packages/scrapers/src/adapters/palyazat.ts"
Task: "T045 [P] [US3] Implement app/packages/scrapers/src/adapters/ecegjegyzek.ts"
Task: "T046 [P] [US3] Implement app/packages/scrapers/src/adapters/opencorporates.ts"
Task: "T047 [P] [US3] Implement app/packages/scrapers/src/adapters/integritas.ts"
Task: "T048 [P] [US3] Implement app/packages/scrapers/src/adapters/olaf.ts"
Task: "T049 [P] [US3] Implement app/packages/scrapers/src/adapters/ksh.ts"
Task: "T050 [P] [US3] Implement app/packages/scrapers/src/adapters/eurostat.ts"
Task: "T051 [P] [US3] Implement app/packages/scrapers/src/adapters/kmonitor-adapter.ts"
Task: "T052 [P] [US3] Implement app/packages/scrapers/src/adapters/atlatszo.ts"
Task: "T053 [P] [US3] Implement app/packages/scrapers/src/adapters/webarchive.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 + Phase 2.
2. Phase 3 (US1).
3. Stop, walk `quickstart.md` §4 + §7, demo: every ingested article now shows structured claims and the daily kill switch works.

### Incremental Delivery

1. MVP (US1) → demo "structured claims for every article".
2. + US2 → demo "Investigations queue with clustered claims".
3. + US3 → demo "external evidence and benchmark deviations".
4. + US4 → demo "red flags and bounded hypothesis loop".
5. + US5 → demo "two-axis scoring".
6. + US6 → demo "tier promotion gated by predicate, env flag, and CODEOWNERS".

Each slice independently demoable. No slice depends on a later slice's UI.

### Parallel Team Strategy

After Phase 2 completes:

- Engineer A: US1 → US2 (extraction → clustering).
- Engineer B: starts US3 adapters in parallel as soon as US2 detail page exists (T031), since adapters do not depend on the clustering result.
- Engineer C: US4 rule engine in parallel once at least one `ExternalRecord` exists in the test fixture.
- Re-converge for US5 + US6.

---

## Notes

- `[P]` tasks touch different files and have no dependency on incomplete tasks.
- `[USn]` tags map each task to a single user story for traceability.
- Every state-changing API route requires `If-Match: <updatedAt>` per FR-031c — already encoded in the API tasks.
- Every reviewer state-change writes one `AuditLog` row before the response (FR-031).
- The extraction kill switch (FR-005) is the only exception: pause is triggered by env state, not by a UI click, and therefore is not audit-logged on its own.
- Public-tier render code (`PUBLIC_TIER_ENABLED=true`) MUST NOT ship in this feature's PRs until counsel approves `app/docs/public-tier-redaction-policy.md` out-of-band — T094 plants the placeholder only.
- The migration in T004 lands in its own PR ahead of the application code that depends on it (constitution Principle VII).

---

# Addendum 2026-05-19 — Damage→Evidence Spine

**Spec section**: `spec.md` §"Addendum 2026-05-19 — Damage→Evidence Spine" (US-7/US-8/US-9, FR-039..FR-058, SC-013..SC-020).
**Plan section**: `plan.md` §"Addendum 2026-05-19 — Damage→Evidence Spine".

Tasks are numbered T101+ and tagged by the addendum's user stories: `[US7]` (damage estimate), `[US8]` (auditable score), `[US9]` (job state + UX). The addendum ships in four migration phases mirroring `spec.md` §"Migration phasing":

- **Phase 10** — Setup + data layer + backfill (zero UI risk).
- **Phase 11** — User Story 7 (damage estimate).
- **Phase 12** — User Story 8 (auditable score) + User Story 9 (job state + next-step + i18n).
- **Phase 13** — Deprecate legacy KPI and opaque score bar.
- **Phase 14** — Polish, cross-link badges, snapshot tests, quickstart walk.

---

## Phase 10: Setup, Data Layer & Backfill

**Purpose**: Add the new tables, the recompute function, and a one-shot backfill — without touching any UI. After this phase the legacy detail page still renders unchanged.

- [ ] T101 [Addendum] Append the addendum env vars to `app/.env.example`: `DAMAGE_RECOMPUTE_DEBOUNCE_MS=30000` (FR-048), `DAMAGE_COHORT_MIN_N=10` (FR-041), `JOB_STATE_POLL_INTERVAL_MS=2000` (FR-054), `NEXT_STEP_BANNER_ENABLED=true`. Document defaults; production set in `plan.md` §Technical Context (addendum).
- [ ] T102 [P] [Addendum] Author the additive raw-SQL migration `app/supabase/migrations/0012_damage_evidence_spine.sql` creating the three new tables — `DamageEstimate` (1:1 with Investigation, jsonb `components`, `inputsHash` text, `confidence` enum, `totalLowHuf`/`totalHighHuf` bigint, `computedAt` timestamptz), `SignalContribution` (N:1 with Investigation, indexed on `(investigationId)`), `InvestigationJobState` (unique on `(investigationId, jobKind)`, `state` enum, `summary`/`errorMessage` text, `inngestRunId` text). Add four enums: `damage_confidence`, `damage_method`, `damage_mechanism` (mirrors existing `claim_mechanism` — alias is fine), `job_state`, `job_kind`. Add a partial index `WHERE state = 'running'` on `InvestigationJobState` for the polling endpoint.
- [ ] T103 [Addendum] Extend the Drizzle schema in `app/packages/db/src/schema.ts` to mirror migration 0012: three `pgTable` declarations, the new enums, the inferred select/insert types, exported through the file's existing barrel. Add a typed `DamageComponentSchema` (zod or plain TS) co-located in `app/packages/shared/src/investigation.ts` so the jsonb shape is checked at write time.
- [ ] T104 [P] [Addendum] Extend `app/packages/shared/src/investigation.ts` with the wire-format DTOs: `DamageEstimateDto` (totals + components array + confidence + `computedAt`), `DamageComponentDto` (mechanism, low/high, method, inputs, formula, citation, notes), `SignalContributionDto`, `InvestigationJobStateDto`, `NextStepBannerDto` (`kind`, `messageHu`, `actionHref?`, `actionLabelHu?`). Re-export from `app/packages/shared/src/index.ts`.
- [ ] T105 [P] [Addendum] Create `app/apps/web/src/lib/investigation/damage-citations.ts` with the frozen citation tuples `{ studyId, lowFrac, highFrac, sourceUrl, lastVerifiedAt }` for OECD 2022 single-bidder premium and World Bank government corruption study. Include a `// last-verified: 2026-05-19` comment pattern.
- [ ] T106 [P] [Addendum] Create `app/apps/web/src/lib/investigation/damage.ts` exposing pure functions: `computeOverpricing(record, cohort)` (FR-041), `computeAmendmentDelta(record)` (FR-042), `computeSingleBidderPremium(record, flag)` (FR-043), `computeRelatedPartyEstimate(record, flag)` (FR-044), `computePhantomService(claim, record?)` (FR-045), `dedupClaims(claims)` (FR-046), `capComponentsByContract(components, externalRecord)` (FR-047 with documented priority order), and an aggregator `assembleEstimate(inputs) → DamageEstimateDto`. Every component object must carry its Hungarian `formula` string and a citation when applicable.
- [ ] T107 [P] [Addendum] Create `app/apps/web/src/lib/investigation/signal-contributions.ts` that derives `SignalContribution` rows from existing inputs (external records, red-flag checks, claim corroborations, benchmark deviations) per FR-022/023/024 + the new FR-050. Export `deriveSignals(investigationId) → SignalContributionDto[]` and `sumSignals(rows) → number` (used by the invariant assertion in T108).
- [ ] T108 [P] [Addendum] Create `app/apps/web/src/lib/investigation/job-state.ts` exposing `startJob(tx, investigationId, jobKind, inngestRunId)`, `completeJob(tx, investigationId, jobKind, summaryHu)`, `failJob(tx, investigationId, jobKind, errorCodeOrMessage)` — each writes one row to `InvestigationJobState` inside the caller's `step.run` and emits a Sentry breadcrumb. `failJob` runs the input through the i18n translator (T110) so the stored `errorMessage` is always Hungarian.
- [ ] T109 [P] [Addendum] Create `app/apps/web/src/lib/investigation/next-step.ts` implementing the FR-055 priority selector: `pickNextStep(state) → NextStepBannerDto | null` where `state` is the page-level aggregate (`jobStates`, `externalRecordsFreshness`, `availableActions`, predicate booleans). The picker is pure and deterministic, with the documented priority order as a single switch.
- [ ] T110 [P] [Addendum] Create `app/apps/web/src/lib/investigation/i18n-errors.ts` exposing `tError(code: string) → string` that maps every internal error code or HTTP status to a Hungarian phrase (FR-056). Include a frozen registry — anything not in the registry returns the catch-all `"Ismeretlen hiba történt — próbáld újra később."` and emits a Sentry breadcrumb of `category: 'investigation.error.untranslated'`.
- [ ] T111 [Addendum] Implement `app/apps/web/src/inngest/functions/investigation-damage-recompute.ts` per FR-048: triggered by `investigation.claim.changed` / `investigation.external-record.changed` / `investigation.redflag.changed` / `investigation.benchmark.changed` events (events are added in T113); debounced by `investigationId` with `DAMAGE_RECOMPUTE_DEBOUNCE_MS`; reads inputs, computes `inputsHash`, short-circuits when unchanged, otherwise calls `damage.assembleEstimate` and upserts the row; writes `InvestigationJobState{ jobKind:'damage_recompute' }` via `job-state.ts`. Concurrency key = `investigationId` so concurrent input changes collapse into one recompute.
- [ ] T112 [Addendum] Register the new function in `app/apps/web/src/inngest/index.ts` import block (matches the T011 pattern).
- [ ] T113 [Addendum] Wire the input-change events: at the end of `investigation-extract-claims.ts`, `investigation-xref.ts`, `investigation-redflags.ts`, and `investigation-benchmarks-compute.ts`, emit one of `investigation.{claim,external-record,redflag,benchmark}.changed` carrying `{ investigationId }`. **Pre-verify** the existing emit sites with `rg -n "inngest.send" app/apps/web/src/inngest/functions/investigation-*.ts` before editing so the new emits sit alongside the existing `score.requested` emits without duplicating.
- [X] T114 [Addendum] Author a one-shot Inngest backfill function `investigation-damage-backfill` (registered locally for one run, then removed): scans every `Investigation`, emits one `damage-recompute` event per row at 50/sec, logs progress. Run once on staging, verify count = total investigations, then on production behind the existing operator approval flow.
- [X] T115 [Addendum] Author and run a one-shot SQL assertion against the staging DB: `SELECT investigation_id, quantity_score, ROUND((SELECT SUM(effective_weight) FROM "SignalContribution" sc WHERE sc.investigation_id = i.id)::numeric, 2) AS sum_signals FROM "Investigation" i WHERE ABS(quantity_score - <sum>) > 0.01;` — must return zero rows. If not, write the drift cases to a CSV and triage. (Backs SC-016, FR-051.)

**Checkpoint**: Schema, helpers, recompute function, and event wiring shipped. Backfill complete. Legacy UI still rendering unchanged. SC-016 invariant verified on staging.

---

## Phase 11: User Story 7 — Damage estimate with a traceable formula (Priority: P2)

**Goal**: Render a HUF damage range as the dominant number on the detail page, broken down by mechanism with every line drillable to its supporting evidence.

**Independent Test**: Spec US-7 acceptance scenarios 1–4 (TED + cohort overpricing; single-bidder industry estimate; cap when components exceed `contract_value`; cohort-too-thin emits a lead, no component).

### Tests for User Story 7

- [X] T116 [P] [US7] Vitest unit tests in `app/apps/web/tests/lib/damage.test.ts` covering every formula in T106: overpricing low/high math, amendment ±20 %, single-bidder 5–15 %, related-party 5–15 %, phantom-service consolidation with and without contract anchor, dedup of claim-groups, cap priority `overpricing > amendment > kickback > no_bid > phantom_service` (matches `plan.md` §Re-evaluation addendum), cohort `n < 10` short-circuit.
- [X] T117 [P] [US7] Vitest function test in `app/apps/web/tests/inngest/investigation-damage-recompute.test.ts`: (a) debounce keyed on `investigationId` collapses concurrent input changes, (b) `inputsHash` short-circuits on unchanged inputs, (c) writes `DamageEstimate` row with sum equal to component sums, (d) writes `cohort_too_thin` lead when applicable, (e) writes `claim_record_conflict` lead when claim amount disagrees with `ExternalRecord.valueHuf` (spec Edge Case addendum).
- [X] T118 [P] [US7] Vitest route test in `app/apps/web/tests/api/admin/damage-estimate.test.ts` for `GET /api/admin/investigations/[id]/damage-estimate`: 200 with full DTO, 404 on missing investigation, header carries `Last-Modified: <computedAt>`.

### Implementation for User Story 7

- [X] T119 [P] [US7] Implement `app/apps/web/app/api/admin/investigations/[id]/damage-estimate/route.ts` (`GET`) returning `DamageEstimateDto`. Joins `DamageEstimate` with the dereferenced input records (claims, external records, benchmark cohorts) so the UI can render input links without a second round-trip.
- [X] T120 [US7] Build `app/apps/web/app/admin/(authed)/investigations/[id]/damage-panel.tsx`: hero (total range + confidence chip), one collapsible row per `DamageComponent` with method, Hungarian formula, citation, and a clickable input list. Empty-state when `components.length === 0`. **Phase 2 dual-render**: this panel renders **above** the existing claims/external-records panels (spec §Migration phasing).
- [X] T121 [P] [US7] Edit `app/apps/web/app/admin/(authed)/investigations/[id]/page.tsx` to fetch `DamageEstimateDto` server-side and render the damage panel above existing panels (gated behind `process.env.NEXT_PUBLIC_DAMAGE_PANEL_ENABLED ?? 'true'` so it can be flipped off if a regression shows up in dual-render).
- [X] T122 [P] [US7] Edit `app/apps/web/app/admin/(authed)/investigations/page.tsx` queue KPI block: keep rendering the legacy "Becsült kár" sum (Phase 2 dual-render) but **also** render the new sum `SUM(DamageEstimate.totalLowHuf)..SUM(DamageEstimate.totalHighHuf)` next to it as `(új számítás: X..Y Mrd Ft)` for reviewer comparison. The legacy sum is removed in Phase 13 (T143).
- [X] T123 [US7] Wire the cross-link badges (minimal): each `DamageComponent.inputs.claimIds[]` link opens the matching claim in the claims panel via in-page anchor + scroll; same for `externalRecordIds[]` and `benchmarkCohortId`. The full propagation (badges *on* the claim/record rows themselves) ships in Phase 14 (T149).

**Checkpoint**: Slice US-7 demoable per spec US-7 Independent Test. SC-013 and SC-014 verifiable in the UI. The Phase 2 dual-render keeps the legacy panels working.

---

## Phase 12: User Story 8 (auditable score) + User Story 9 (job state + UX)

**Goal**: Replace the opaque score bar with an auditable table; surface real-time job state per pipeline stage; render exactly one next-step banner; eliminate raw error codes from the reviewer surface.

**Independent Test**: Spec US-8 + US-9 acceptance scenarios.

### Tests

- [X] T124 [P] [US8] Vitest unit tests in `app/apps/web/tests/lib/signal-contributions.test.ts`: derive rows from a fixture investigation, assert `Σ effectiveWeight = Investigation.quantityScore ± 0.01` across 50 fixture cases (covers FR-051 invariant + SC-016).
- [X] T125 [P] [US8] Vitest route test in `app/apps/web/tests/api/admin/signal-contributions.test.ts` for `GET /api/admin/investigations/[id]/signal-contributions`: returns the array, response includes the headline `quantityScore` for client-side invariant check, 404 on missing investigation.
- [X] T126 [P] [US9] Vitest unit tests in `app/apps/web/tests/lib/next-step.test.ts`: priority order (failed > stale > missing-xref > missing-redflags > newly-passing predicate > none); exactly one banner returned across 30 fixture states (SC-019).
- [X] T127 [P] [US9] Vitest unit tests in `app/apps/web/tests/lib/i18n-errors.test.ts`: snapshot test over the full registry; unknown codes return the catch-all string; **no raw HTTP code or English word appears in any registry value** (SC-018).
- [X] T128 [P] [US9] Vitest route test in `app/apps/web/tests/api/admin/job-state.test.ts` for `GET /api/admin/investigations/[id]/job-state`: returns the per-jobKind state array, indexed lookup on the partial index, 200 ≤ 100 ms in CI bench.
- [X] T129 [P] [US9] Playwright test extending `app/apps/web/tests/playwright/admin-investigations.spec.ts`: trigger `POST /xref` → assert pipeline row flips to `running` within 3 s → assert `done` or `failed` within 30 s without a manual reload (SC-017). Also asserts the existing axe checks still pass.

### Implementation

- [X] T130 [P] [US8] Implement `app/apps/web/app/api/admin/investigations/[id]/signal-contributions/route.ts` (`GET`) returning `{ quantityScore, rows: SignalContributionDto[] }`.
- [X] T131 [US8] Build `app/apps/web/app/admin/(authed)/investigations/[id]/signal-table.tsx`: the four-column table (Jelzés / Súly / Staleness / Eff.) with a visible SUM and footnote for `× < 1.0` rows. Renders **above** the existing opaque score chip during Phase 2 dual-render. The opaque chip is removed in Phase 13 (T144).
- [X] T132 [P] [US9] Implement `app/apps/web/app/api/admin/investigations/[id]/job-state/route.ts` (`GET`): when called with `Accept: text/event-stream`, opens an SSE stream that emits `JobStateChanged` events on every relevant Postgres `NOTIFY`; otherwise returns a snapshot JSON for poll-mode clients. Stream auto-closes after 60 s so Vercel's request-timeout does not kill it mid-flight.
- [X] T133 [US9] Build `app/apps/web/app/admin/(authed)/investigations/[id]/pipeline-panel.tsx`: one row per `jobKind` with state chip, started/finished timestamps, summary or error string. Subscribes to the SSE stream from T132 with a 2 s-poll fallback (when SSE drops). Replaces the binary checklist; the old checklist code is deleted in Phase 13 (T145).
- [X] T134 [US9] Build `app/apps/web/app/admin/(authed)/investigations/[id]/next-step-banner.tsx` calling `pickNextStep(state)` server-side and rendering exactly the returned `NextStepBannerDto` (or nothing). Single yellow-bordered line above the panels.
- [X] T135 [P] [US9] Update `app/apps/web/app/admin/(authed)/investigations/[id]/action-bar.tsx` (existing): pipe every error path through `tError()` so the rendered string is always Hungarian; remove the in-component `LABELS` map and import from `i18n-errors.ts`'s registry. (Action-name labels stay where they are — only error strings move.)
- [X] T136 [US9] Add hover-cards (FR-057) to the three tier-promotion buttons in `action-bar.tsx`. Use a lightweight inline `<details>` or the existing tooltip primitive — no new dependency. Content matches `plan.md` §Project Structure (addendum)'s described copy.
- [X] T137 [P] [US9] Add `Sentry.addBreadcrumb({ category: 'investigation.error.untranslated', data: { code } })` inside `tError()`'s catch-all branch (FR-056 enforcement signal).
- [X] T138 [US9] Wire `InvestigationJobState` writes into the existing async-firing routes: `xref`, `redflags`, `hypothesis-loop`, `benchmarks-compute`. Each route's Inngest function now calls `startJob` at entry and `completeJob`/`failJob` at exit (inside `step.run`). **Pre-verify** existing function exit paths with `rg -n "step.run\|return\|throw" app/apps/web/src/inngest/functions/investigation-{xref,redflags,hypothesis-loop,benchmarks-compute}.ts` to make sure every return/throw is covered.
- [X] T139 [P] [US9] Edit `app/apps/web/app/admin/(authed)/investigations/[id]/page.tsx` to render `<NextStepBanner>` above the action bar and `<PipelinePanel>` between the existing detail-page sections. Same `NEXT_PUBLIC_DAMAGE_PANEL_ENABLED` flag controls visibility during dual-render.

**Checkpoint**: Slice US-8 + US-9 demoable per their Independent Tests. SC-016, SC-017, SC-018, SC-019 verifiable.

---

## Phase 13: Deprecate Legacy Surface

**Goal**: Remove the legacy queue KPI computation and the opaque score chip / binary checklist after one sprint of Phase 2 dual-render has shown the new surface is correct.

- [X] T140 [Addendum] Audit one sprint of staging telemetry: confirm zero `score_invariant_drift` leads in `InvestigationLead`, zero `investigation.error.untranslated` breadcrumbs in Sentry, zero reviewer-reported regressions on the new damage panel.
- [ ] T141 [Addendum] Walk a reviewer through `quickstart.md` §5 and §6 with the new surface and capture per-section PASS/FAIL notes (constitution Honesty Protocol). Block T142–T146 on a clean walk.
- [X] T142 [Addendum] Remove the legacy "Becsült kár" KPI computation in `app/apps/web/app/admin/(authed)/investigations/page.tsx`: delete the `SUM(ArticleClaim.allegedAmountHuf)` SQL and the duplicate KPI tile (FR-049 deprecation step).
- [X] T143 [Addendum] Remove the comparison line `(új számítás: X..Y Mrd Ft)` added in T122 and promote the new sum to the primary KPI tile.
- [X] T144 [Addendum] Remove the opaque `<ScoreChip>` (or equivalent legacy component) from `app/apps/web/app/admin/(authed)/investigations/[id]/page.tsx`; `signal-table.tsx` is now the only quantity-score surface (FR-052).
- [X] T145 [Addendum] Remove the binary pipeline checklist from `app/apps/web/app/admin/(authed)/investigations/[id]/page.tsx`; `pipeline-panel.tsx` is now the only pipeline surface.
- [X] T146 [Addendum] Remove `NEXT_PUBLIC_DAMAGE_PANEL_ENABLED` flag and its conditionals. The new surface is now the only surface.

**Checkpoint**: Legacy UI removed. Single source of truth for damage, score, pipeline, and errors.

---

## Phase 14: Polish, Cross-Link Badges, Quickstart Walk

**Purpose**: Finish the cross-link badge propagation, harden the i18n surface with a snapshot test, and walk the spec end-to-end.

- [X] T147 [P] [Addendum] Extend `claims-panel.tsx` (existing): each `ArticleClaim` row whose id appears in any `DamageComponent.inputs.claimIds[]` renders a badge `"🔗 hozzájárul: <mechanism> (<low>–<high> Mrd Ft)"` linking to the damage panel anchor (FR-058).
- [X] T148 [P] [Addendum] Extend `external-records-panel.tsx` (existing): same badge pattern for `ExternalRecord` ids appearing in `DamageComponent.inputs.externalRecordIds[]`. Multiple-component case: comma-separate the badge labels.
- [X] T149 [P] [Addendum] Extend `benchmarks-panel.tsx` (existing): for each `BenchmarkResult`, render the cohort spec inline (`n`, `p10/p50/p90`, time-window) — already required by FR-058. Source-link back to the damage component when the cohort is used.
- [X] T150 [P] [Addendum] Extend `redflags-panel.tsx` (existing): render the `effectiveWeight` next to each verdict that contributed to the score (badge `"súly: 0.80 → eff. 0.80"`) linking to the signal table.
- [X] T151 [P] [Addendum] Add a snapshot test in `app/apps/web/tests/playwright/admin-investigations.spec.ts` rendering the detail page over the full error-fixture set and grep-asserting that **no raw HTTP code, no English error string, and no internal error code** appears in the rendered DOM (SC-018 enforcement at the page level, not just the unit level).
- [X] T152 [P] [Addendum] Add a Playwright assertion that exactly one next-step banner is rendered per state across the 30 fixture states from T126 (SC-019 at the page level).
- [X] T153 [Addendum] Update `quickstart.md` with three new sections: §15 Damage estimate walkthrough (US-7), §16 Auditable score table (US-8), §17 Job state + next-step banner (US-9). Mirror the per-section PASS/FAIL note style.
- [X] T154 [Addendum] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` from repo root and fix every regression introduced by the addendum. Attach the per-step result to the PR.
- [ ] T155 [Addendum] Walk the full updated `quickstart.md` (§1–§17) on a clean local stack, log a per-section PASS/FAIL note, and attach the result to the PR (constitution Honesty Protocol).
- [X] T156 [Addendum] Verify the new tables' RLS posture matches the existing admin tables (no public-tier read path) and the new endpoints inherit the admin-API rate-limit floor (probe each `GET /api/admin/investigations/[id]/{damage-estimate,signal-contributions,job-state}` from an unauthenticated session and confirm 401).

**Checkpoint**: Addendum complete. SC-013..SC-020 all verifiable. Quickstart end-to-end passes.

---

## Addendum: Dependencies & Execution Order

### Phase dependencies (addendum)

- **Phase 10 (Setup + Data + Backfill)**: Depends on Phase 9 (the original engine must be shipped and stable). Blocks every addendum user story.
- **Phase 11 (US-7)**: Depends on Phase 10.
- **Phase 12 (US-8 + US-9)**: Depends on Phase 10. US-8 and US-9 can run in parallel; both are gated by the data layer in Phase 10, not by each other.
- **Phase 13 (Deprecate)**: Depends on Phase 11 + Phase 12 + one sprint of dual-render telemetry.
- **Phase 14 (Polish)**: Depends on Phase 13.

### User story dependency map (addendum)

```
US7 (damage estimate) ─┐
                       ├─→ Phase 13 deprecate ─→ Phase 14 polish
US8 (auditable score) ─┤
US9 (job state + UX) ──┘
```

### Parallel opportunities (addendum)

- T102 / T104 / T105 / T106 / T107 / T108 / T109 / T110 in Phase 10 (different files).
- T116 / T117 / T118 in Phase 11 (tests parallel).
- T124–T129 (tests across US-8 and US-9) all parallel.
- T130 / T132 / T135 / T137 / T139 (independent routes/files) parallel.
- T147–T152 (badge propagation + snapshot tests across panels) parallel.

### Within each addendum user story

- Pure helpers (`lib/investigation/{damage,signal-contributions,job-state,next-step,i18n-errors}.ts`) before Inngest function before API routes before UI panels — matches the parent doc's convention.
- Phase 2 dual-render shipping rules: new panels are added **above** the legacy ones, never replacing them inline. Phase 13 is the only step that deletes legacy code.

---

## Addendum: Notes

- `[Addendum]` tag identifies tasks that belong to this addendum but are not scoped to a single addendum user story.
- `[US7]` / `[US8]` / `[US9]` tags match `spec.md` §"Addendum 2026-05-19 — Damage→Evidence Spine".
- Every state-changing addendum route (`damage-estimate` GETs are read-only and exempt) inherits the `If-Match` optimistic-concurrency rule from FR-031c. The recompute function is event-driven and does not pass through `If-Match`.
- The migration in T102 lands in its own PR ahead of the application code (constitution Principle VII, matches the T004 pattern).
- The backfill in T114 runs once on staging, once on production behind the existing operator approval flow — it is a one-shot Inngest function, not a recurring job.
- The legacy "Becsült kár" KPI computation MUST NOT be removed until Phase 13 — the dual-render gives reviewers a sprint to flag regressions.
- The OECD and World Bank citations stored in `damage-citations.ts` are frozen at the values approved in `spec.md` §Assumptions (addendum); changes require an entry in the addendum's Clarifications section and counsel re-sign-off before they ship.
