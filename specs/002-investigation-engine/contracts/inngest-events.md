# Contracts — Inngest events & functions

**Branch**: `002-investigation-engine` | **Spec**: [../spec.md](../spec.md)

All functions live in `apps/web/src/inngest/functions/` and are served via the existing `apps/web/app/api/inngest/route.ts` endpoint. No new Inngest app, no separate worker package (constitution Principle III).

Event ids use the `investigation.*` namespace. All function ids use `investigation.*` to match.

---

## Events

### `investigation.article.ingested`

Emitted by the existing news scraper and the K-Monitor harvester after a new article row is written. Triggers `investigation.extract-claims`.

```json
{
  "name": "investigation.article.ingested",
  "data": {
    "articleSource": "news" | "kmonitor",
    "articleId": "string"
  }
}
```

### `investigation.claims.extracted`

Emitted by `investigation.extract-claims` after writing claims for one article. Triggers `investigation.cluster`.

```json
{
  "name": "investigation.claims.extracted",
  "data": {
    "articleSource": "news" | "kmonitor",
    "articleId": "string",
    "claimIds": ["uuid"],
    "extractorVersion": "haiku-4-5@a1b2c3d4"
  }
}
```

### `investigation.xref.requested`

Emitted by the admin API on reviewer click. Triggers `investigation.xref` fan-out.

```json
{
  "name": "investigation.xref.requested",
  "data": {
    "investigationId": "uuid",
    "requestedByEditorId": "uuid",
    "runId": "uuid"
  }
}
```

### `investigation.xref.source.completed`

Emitted per `(investigationId, sourceSystem)` after that adapter finishes. Lets `investigation.score` know to re-run.

```json
{
  "name": "investigation.xref.source.completed",
  "data": {
    "investigationId": "uuid",
    "sourceSystem": "TED",
    "recordsWritten": 3
  }
}
```

### `investigation.hypothesis.requested`

Emitted by the admin API on reviewer click. Triggers `investigation.hypothesis-loop`.

```json
{
  "name": "investigation.hypothesis.requested",
  "data": {
    "investigationId": "uuid",
    "requestedByEditorId": "uuid",
    "runId": "uuid"
  }
}
```

### `investigation.benchmarks.computed`

Emitted by `investigation.benchmarks-compute` after a cohort recompute (or after determining no dimension applies and short-circuiting). Lets `investigation.score` know the benchmark inputs to the case have settled.

```json
{
  "name": "investigation.benchmarks.computed",
  "data": {
    "investigationId": "uuid",
    "dimensionsComputed": ["huf_per_sqm_hospital"],
    "outlierCount": 1
  }
}
```

### `investigation.score.requested`

Emitted whenever a signal changes (red-flag run finishes, xref source completes, benchmarks recomputed, reviewer manually triggers). Triggers `investigation.score`.

```json
{
  "name": "investigation.score.requested",
  "data": { "investigationId": "uuid", "reason": "string" }
}
```

### `investigation.promote.public.requested`

Emitted by the admin API. Triggers `investigation.promote-public` which performs the atomic write (FR-028).

```json
{
  "name": "investigation.promote.public.requested",
  "data": {
    "investigationId": "uuid",
    "requestedByEditorId": "uuid",
    "expectedUpdatedAt": "..."
  }
}
```

### `investigation.dsr.deletion.upheld`

Emitted by the existing DSR workflow (Slice K of constitution Principle IV) when a subject-access deletion is approved. Triggers `investigation.anonymize-dsr`.

```json
{
  "name": "investigation.dsr.deletion.upheld",
  "data": {
    "dsrRequestId": "uuid",
    "subjectNormalizedName": "string"
  }
}
```

### `investigation.extraction.paused`

Emitted by `investigation.extract-claims` when it refuses an LLM call because the day's ceiling is hit (FR-005). Surfaced via Sentry breadcrumb + Better Stack alert.

```json
{
  "name": "investigation.extraction.paused",
  "data": {
    "day": "YYYY-MM-DD",
    "model": "claude-haiku-4-5",
    "estimatedHufSpend": "200012.34",
    "ceilingHuf": "200000"
  }
}
```

---

## Functions

| Function id | Trigger | Concurrency | Notes |
|---|---|---|---|
| `investigation.extract-claims` | event `investigation.article.ingested` | `concurrency: { key: 'event.data.articleId', limit: 1 }`; global `EXTRACTION_CONCURRENCY` (default 2) | FR-001–FR-007; idempotent on `(articleSource, articleId, extractorVersion)` |
| `investigation.cluster` | event `investigation.claims.extracted` | `concurrency: { key: 'event.data.claimIds', limit: 1 }`; global 1 | FR-008–FR-011; takes a Postgres advisory lock keyed on the deterministic primary-name list during clustering |
| `investigation.xref` | event `investigation.xref.requested` | global 4 | Fans out one step per source system; each step subject to its own concurrency-1 lock |
| `investigation.redflags` | direct invocation from `/redflags` route | global 4 | Pure SQL/TS, no LLM |
| `investigation.hypothesis-loop` | event `investigation.hypothesis.requested` | `concurrency: { key: 'event.data.investigationId', limit: 1 }`; global `HYPOTHESIS_CONCURRENCY` (default 2) | FR-021–FR-023; the three caps are enforced in code, not as prompt instructions |
| `investigation.benchmarks-compute` | event `investigation.xref.source.completed` | `concurrency: { key: 'event.data.investigationId', limit: 1 }` | FR-017, FR-018. Looks up the case's dimensions via `lib/investigation/benchmarks.ts` registry; for each applicable dimension, computes the cohort over `ExternalRecord` where `relevance='benchmark'`, upserts `Benchmark` keyed by `cohortHash`, and emits `investigation.benchmarks.computed`. Short-circuits (still emits) when no dimension applies. Never calls a live adapter — reads from the cached `ExternalRecord` rows only |
| `investigation.score` | event `investigation.score.requested` (also fired on `investigation.benchmarks.computed`) | `concurrency: { key: 'event.data.investigationId', limit: 1 }` | FR-024–FR-025 |
| `investigation.promote-public` | event `investigation.promote.public.requested` | `concurrency: { key: 'event.data.investigationId', limit: 1 }` | FR-028. Re-evaluates the FR-026 public predicate at commit time, then runs the five atomic writes in one Postgres txn: (1) `INSERT Case`, (2) `INSERT` person-link dependents (`CasePerson` / `CaseEntity`), (3) `REFRESH` the per-jurisdiction rollup, (4) `UPDATE Investigation` to set `publicCaseId`, `disclosureTier='public'`, `updatedAt`, (5) `INSERT InvestigationPublicCaseLink` row for the new `(investigationId, publicCaseId)` (FR-030 history). All five or none — the function never leaves a half-written case. The post-commit `revalidateTag('stats')` runs after the txn closes |
| `investigation.anonymize-dsr` | event `investigation.dsr.deletion.upheld` | global 1 | FR-034, FR-035 |
| `investigation.refresh-stale-external` | scheduled — nightly `0 3 * * *` Europe/Budapest | global 1 | FR-015 priority order: `articleCount DESC, oldestExternalRecordFetchedAt ASC`, top `REFRESH_STALE_TOP_N` (default 100) |
| `investigation.orphan-cleanup` | scheduled — nightly `0 4 * * *` | global 1 | Deletes `ArticleClaim` rows whose parent article disappeared (FR-006). Skips claims whose `createdAt > now() - interval '1 hour'` to avoid racing with in-flight extraction |

---

## Function signatures (TypeScript)

```ts
// apps/web/src/inngest/functions/investigation-extract-claims.ts
export const extractClaims = inngest.createFunction(
  {
    id: 'investigation.extract-claims',
    concurrency: [
      { key: 'event.data.articleId', limit: 1 },
      { limit: parseInt(process.env.EXTRACTION_CONCURRENCY ?? '2', 10) },
    ],
    retries: 3,
  },
  { event: 'investigation.article.ingested' },
  async ({ event, step }) => {
    // 0. Sentry.addBreadcrumb({ category: 'investigation.extract',
    //      data: { articleSource, articleId, extractorVersion } })  — FR-007
    //    Errors thrown below inherit this breadcrumb without copying source text.
    // 1. step.run: check idempotency — a row in ArticleExtractionRun for
    //    (articleSource, articleId, extractorVersion) means we already extracted
    //    under the current version (incl. zero-claim case). Short-circuit; no LLM call.
    // 2. step.run: check daily ceiling against DailyLlmUsage; if hit,
    //    emit investigation.extraction.paused and return.
    // 3. step.run: fetch article text (NewsArticle.excerpt / KMonitorArticle text fetch).
    // 4. step.run: call Anthropic with structured output.
    // 5. step.run: validate every claim has evidenceQuote+sourceUrl+paragraphLocator
    //    (FR-036); reject malformed claims with a parse-failure Sentry event.
    // 6. step.run: write ArticleClaim rows (may be zero) + ArticleExtractionRun row
    //    + DailyLlmUsage upsert in one Postgres transaction.
    //    ArticleExtractionRun is the marker that makes zero-claim re-fires idempotent.
    // 7. emit investigation.claims.extracted (claimIds may be [] for zero-claim runs).
  }
);
```

```ts
// apps/web/src/inngest/functions/investigation-hypothesis-loop.ts
export const hypothesisLoop = inngest.createFunction(
  {
    id: 'investigation.hypothesis-loop',
    concurrency: [
      { key: 'event.data.investigationId', limit: 1 },
      { limit: parseInt(process.env.HYPOTHESIS_CONCURRENCY ?? '2', 10) },
    ],
    retries: 0, // a run that hit a cap should NOT auto-retry (FR-023)
  },
  { event: 'investigation.hypothesis.requested' },
  async ({ event, step }) => {
    const startedAt = Date.now();
    let toolCalls = 0;
    let totalTokens = 0;
    // Per-run dedup set for live adapter calls (FR-022 / Acceptance Scenario S4.2):
    // never call the same (sourceSystem, externalId) twice in one run.
    const seenLiveCalls = new Set<string>(); // key: `${sourceSystem}:${externalId}`
    // bounded loop, max 16 model turns; each iteration:
    //   - if toolCalls >= 8 OR totalTokens >= 50_000 OR (Date.now() - startedAt) >= 90_000:
    //     write InvestigationLead { kind: 'hypothesis', status: 'open',
    //       createdBy: 'agent', capFired: <which>, finding: "cap fired: <which>" } and return
    //   - call Anthropic with tools:
    //       * read_cached_external_record(sourceSystem, externalId)   — preferred, no live call
    //       * fetch_external_record(sourceSystem, externalId)         — live; ONLY if cache
    //         miss is inside the adapter freshness window AND seenLiveCalls.has(key) is false.
    //         After the call: seenLiveCalls.add(key). A second attempt on the same key
    //         returns a structured "already_called_this_run" tool result so the model
    //         cannot loop on it.
    //       * compute_benchmark(dimension)                            — reads cached records
    //       * record_lead(question, finding)
    //   - accumulate tokens, toolCalls
  }
);
```

---

## Adapter contract (free-tier external sources)

```ts
// apps/packages/scrapers/src/adapters/types.ts
export type AdapterQuery = {
  /** Investigation primary party name (normalized) */
  primaryPersonName?: string;
  /** Investigation primary entity name (the contractor / authority) */
  primaryEntityName?: string;
  /** Date range from the cluster's claim dates ± window */
  fromDate?: string; // ISO date
  toDate?: string;
  /** Adapter-specific extra query params */
  extra?: Record<string, unknown>;
};

export type RawExternalRecord = {
  sourceSystem: string;
  externalId: string;
  canonicalUrl: string;
  recordType: string;
  rawPayload: unknown;
  evidenceGrade?: string;
};

export type Adapter = {
  sourceSystem: ExternalSourceSystem;
  freshnessDays: number;
  perHostGateMs: number;
  fetch(query: AdapterQuery): Promise<RawExternalRecord[]>;
};
```

Adapters MUST:
- Set a Hungarian-bot User-Agent (`Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)`), reusing the existing scraper convention.
- Carry a dated `// last-verified: YYYY-MM-DD` comment on each fetch URL.
- Back off on 4xx/5xx and never auto-retry inside the adapter; the Inngest function handles retries with capped attempts.
- NEVER call paid endpoints; the `manual_*` source systems do not have a free-tier adapter.

---

## Public-tier render gate

No public-tier route ships in this feature **unless** all three conditions are met simultaneously:

1. `PUBLIC_TIER_ENABLED=true` in the environment.
2. `app/docs/public-tier-redaction-policy.md` exists in `main`.
3. CODEOWNERS protects:
   - `apps/web/app/galeria/**`
   - `apps/web/src/lib/public-render/**`
   - `app/docs/public-tier-redaction-policy.md`

The promotion API succeeds (writes a `Case` row) regardless of the flag; the flag only gates *rendering* the public surface. This separation lets reviewers stage public promotions internally before any external surface is live.
