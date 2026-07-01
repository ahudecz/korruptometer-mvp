# Contracts — Admin Investigation API

**Branch**: `002-investigation-engine` | **Spec**: [../spec.md](../spec.md)

All routes live under `apps/web/app/api/admin/investigations/` and are gated by the existing Supabase magic-link session + admin-role check; reviewer-action routes additionally require a fresh (≤ 30 min) WebAuthn assertion per constitution Principle I.

All requests/responses are JSON. All timestamps are ISO-8601 strings with `Z` suffix. All ids are UUIDs unless noted. All money values are HUF `bigint` rendered as strings.

State-changing routes (anything that is not `GET`) require `If-Match: <updatedAt-iso>` for optimistic concurrency (FR-031c). Server returns `409 Conflict` if stale.

Every state-changing route writes an `AuditLog` row before returning success.

---

## GET `/api/admin/investigations`

List investigations for the admin queue (FR-012).

**Query params**:
| Name | Type | Default | Notes |
|---|---|---|---|
| `status` | `'new' \| 'dismissed' \| 'merged' \| 'all'` | `'new'` | |
| `tier` | `'internal' \| 'journalist' \| 'prosecutor' \| 'public' \| 'all'` | `'all'` | |
| `q` | `string` | — | Trigram on `primaryPersonNormalized` |
| `sort` | `'recent' \| 'quantity' \| 'article_count'` | `'recent'` | |
| `cursor` | `string` (base64-encoded tuple) | — | per constitution Principle VI cursor decoder |
| `limit` | `1..50` | `20` | |

**200 OK**:
```json
{
  "items": [
    {
      "id": "uuid",
      "status": "new",
      "primaryPersonName": "Kovács László",
      "primaryEntityName": "Példa Kft.",
      "articleCount": 3,
      "quantityScore": "1.50",
      "qualityScore": "opinion_press",
      "disclosureTier": "internal",
      "publicCaseId": null,
      "createdAt": "2026-05-15T08:00:00Z",
      "updatedAt": "2026-05-15T09:12:00Z"
    }
  ],
  "nextCursor": "base64..." | null
}
```

Cache: none (admin). Rate-limited per the existing admin-API floor.

---

## GET `/api/admin/investigations/:id`

Full investigation detail.

**200 OK**:
```json
{
  "investigation": { /* same shape as list item, plus: */
    "summary": "string | null",
    "mergedIntoId": "uuid | null"
  },
  "articles": [
    {
      "source": "news",
      "id": "string",
      "headline": "string",
      "sourceUrl": "string",
      "role": "primary"
    }
  ],
  "claims": [
    {
      "id": "uuid",
      "articleSource": "news",
      "articleId": "string",
      "claimOrdinal": 1,
      "extractorVersion": "haiku-4-5@a1b2c3d4",
      "mechanism": "overpricing",
      "allegedAmountHuf": "1500000000" | null,
      "amountBasis": "stated" | null,
      "parties": [{ "kind": "person", "name": "...", "normalizedName": "...", "role": "..." }],
      "evidenceQuote": "string",
      "sourceUrl": "string",
      "paragraphLocator": "p:14",
      "confidence": 78,
      "createdAt": "..."
    }
  ],
  "externalRecords": [
    {
      "id": "uuid",
      "sourceSystem": "TED",
      "externalId": "string",
      "canonicalUrl": "string",
      "fetchedAt": "...",
      "fetchHash": "sha256...",
      "recordType": "contract_notice",
      "relevance": "corroborates" | null,
      "evidenceGrade": "audit_report" | null,
      "rawPayload": { /* normalized */ }
    }
  ],
  "redFlags": [
    {
      "ruleId": "single_bidder",
      "severity": "high",
      "verdict": "fail",
      "observationHu": "string",
      "supportingRecordIds": ["uuid"],
      "evaluatedAt": "..."
    }
  ],
  "leads": [
    {
      "id": "uuid",
      "kind": "hypothesis",
      "status": "open",
      "question": "string",
      "finding": "string | null",
      "createdBy": "agent",
      "capFired": "wall_clock" | null,
      "createdAt": "...",
      "resolvedAt": "... | null"
    }
  ],
  "benchmarks": [
    {
      "cohortHash": "string",
      "dimension": "huf_per_sqm_hospital",
      "investigationValue": "850000",
      "p10": "210000",
      "p50": "380000",
      "p90": "620000",
      "n": 41,
      "computedAt": "...",
      "isOutlier": true
    }
  ],
  "history": {
    "publicCases": [
      { "id": "case-id-1", "promotedAt": "...", "depromotedAt": "..." },
      { "id": "case-id-2", "promotedAt": "...", "depromotedAt": null }
    ]
  },
  "availableActions": ["promote_journalist", "escalate_paid_lookup", "run_xref"]
}
```

`availableActions` is the server-evaluated list — the UI uses it to hide actions whose predicate fails (FR-027). The set of possible actions:

```
run_xref
run_redflags
run_hypothesis_loop
escalate_paid_lookup
write_paid_result
promote_journalist
promote_prosecutor
promote_public
depromote_public
dismiss
merge_into
edit_summary
```

---

## POST `/api/admin/investigations/:id/status`

Reviewer changes status to `dismissed` or executes a manual merge.

**Body**:
```json
{ "status": "dismissed" }
```
or
```json
{ "status": "merged", "mergedIntoId": "uuid" }
```

**Headers**: `If-Match: <updatedAt>` required.

**200 OK**: updated investigation row.

**409 Conflict**: `{ "error": "stale", "currentUpdatedAt": "..." }` — UI prompts reload.

**422 Unprocessable**: `{ "error": "invalid_transition", "detail": "string" }` (e.g., from `dismissed` back to `new`).

**Audit**: `investigation.status.changed` or `investigation.merged`.

---

## POST `/api/admin/investigations/:id/xref`

Trigger external-evidence cross-reference (Slices C–E). Returns immediately; the actual fetch fans out across the per-source Inngest functions with concurrency-1 per source (FR-016).

**Body**: empty.

**202 Accepted**: `{ "runId": "uuid", "expectedSources": ["TED", "EKR", ...] }`.

**Headers**: `If-Match: <updatedAt>` required.

**Audit**: `investigation.xref.requested`.

---

## POST `/api/admin/investigations/:id/redflags`

Trigger the declarative red-flag rule engine (Slice G). Synchronous (the rule engine is pure SQL + TS, no network).

**Body**: empty.

**200 OK**: `{ "results": [ /* RedFlagCheck[] */ ] }`.

**Audit**: none (idempotent recompute, internal).

---

## POST `/api/admin/investigations/:id/hypothesis-loop`

Trigger a single bounded hypothesis-loop run (Slice H). Returns immediately; the agent runs inside the `investigation.hypothesis-loop` Inngest function with the FR-021 caps.

**Body**: empty.

**202 Accepted**: `{ "runId": "uuid" }`.

**Headers**: `If-Match: <updatedAt>` required.

**Audit**: `investigation.hypothesis.requested`.

**Concurrency**: the Inngest function enforces `concurrency: { key: 'event.data.investigationId', limit: 1 }` — a second click while a run is in flight is rejected by the function and surfaces as `409 Conflict` on the API (`error: "loop_in_flight"`).

---

## POST `/api/admin/investigations/:id/escalate`

Reviewer logs a paid-lookup escalation (FR-014). Does NOT call any paid registry.

**Body**:
```json
{ "lookupKind": "deep_ownership", "note": "string" }
```

**201 Created**: the new `InvestigationLead` row.

**Headers**: `If-Match: <updatedAt>` required.

**Audit**: `investigation.escalation.requested`.

---

## POST `/api/admin/investigations/:id/external-records`

Reviewer/operator paste-back of a manual lookup result (paid registry, web archive snapshot, etc.).

**Body**:
```json
{
  "sourceSystem": "manual_opten",
  "externalId": "string",
  "canonicalUrl": "string",
  "recordType": "company",
  "rawPayload": { /* json */ },
  "relevance": "corroborates" | "contradicts" | "context" | "benchmark" | null,
  "evidenceGrade": "audit_report" | null,
  "linkedLeadId": "uuid" | null
}
```

The server computes `fetchHash` from the canonicalized `rawPayload` and sets `fetchedAt = now()`.

**201 Created**: the new `ExternalRecord` row.

**Headers**: `If-Match: <updatedAt>` required.

**Audit**: `investigation.escalation.writeback` (when `sourceSystem` starts with `manual_`).

---

## POST `/api/admin/investigations/:id/promote`

Promote the investigation to a disclosure tier.

**Body**:
```json
{ "tier": "journalist" | "prosecutor" | "public" }
```

**Headers**: `If-Match: <updatedAt>` required.

**200 OK**: updated investigation, including `publicCaseId` if `tier='public'`.

**409 Conflict**:
- `{ "error": "stale", ... }` — updatedAt advanced.
- `{ "error": "already_promoted", "publicCaseId": "..." }` — second public promotion attempt (FR-029).

**422 Unprocessable**: `{ "error": "predicate_failed", "detail": { "quantityScore": "1.50", "qualityScore": "opinion_press", "required": { "quantityScore": 2, "qualityScore": "investigative_journalism" } } }`. Server re-evaluates the predicate at click time (FR-026, FR-031c).

**Audit**: `investigation.tier.promoted.<tier>`. For `public`, all five FR-028 writes commit together in one Postgres transaction — none of them is visible until the others succeed:

1. `INSERT` into `Case` (the wanted-poster public row) with a fresh id.
2. `INSERT` person-link dependents that the existing `Case` schema requires (`CasePerson` / `CaseEntity` rows derived from the investigation's parties).
3. `REFRESH` the per-jurisdiction rollup (`CaseJurisdictionStats` or equivalent — same materialized view the existing `/api/admin/cases` mutation refreshes).
4. `UPDATE Investigation SET publicCaseId = <new>, disclosureTier = 'public', updatedAt = now()` for the source investigation.
5. `INSERT InvestigationPublicCaseLink (investigationId, publicCaseId, promotedAt, promotedByEditorId)` — append-only history that survives later soft-delete + re-promotion (FR-030).

The post-commit `revalidateTag('stats')` runs outside the transaction (constitution Principle V).

---

## POST `/api/admin/investigations/:id/depromote`

Public-tier depromotion only. Soft-deletes the linked Case row (FR-030).

**Body**: empty.

**Headers**: `If-Match: <updatedAt>` required.

**200 OK**: updated investigation; `publicCaseId` is preserved (the soft-deleted Case row stays for audit) and the row's `disclosureTier` reverts to `internal`.

**Audit**: `investigation.tier.depromoted.public`.

---

## PATCH `/api/admin/investigations/:id/summary`

Reviewer edits the case summary.

**Body**: `{ "summary": "string" }`.

**Headers**: `If-Match: <updatedAt>` required.

**200 OK**: updated investigation.

**Audit**: `investigation.summary.updated`; the audit-log row's `metadata` field carries the `before/after.summary` diff.

---

## POST `/api/admin/investigations/leads/:leadId/resolve`

Reviewer resolves a lead (cluster-ambiguous, hypothesis cap-hit, escalation, etc.).

**Body**:
```json
{ "status": "resolved" | "rejected", "finding": "string" }
```

**200 OK**: updated lead row.

**Audit**: `investigation.lead.resolved`.

---

## GET `/api/admin/articles/:source/:id/claims`

All claim sets ever extracted from one article, grouped by extractor version (FR-003, Acceptance Scenario S1.3). Backs the article admin viewer's side-by-side diff when the extractor version is bumped. Reads from `ArticleExtractionRun` so articles with zero extractable claims still appear here with `claimCount: 0`.

**Path params**:
- `:source` — `'news'` or `'kmonitor'`.
- `:id` — parent article id (text).

**200 OK**:
```json
{
  "article": {
    "source": "news",
    "id": "string",
    "headline": "string",
    "sourceUrl": "string"
  },
  "extractionRuns": [
    {
      "extractorVersion": "haiku-4-5@a1b2c3d4",
      "isCurrent": true,
      "extractedAt": "2026-05-15T08:12:00Z",
      "claimCount": 3,
      "model": "claude-haiku-4-5",
      "claims": [ /* same shape as the per-investigation claim entry */ ]
    },
    {
      "extractorVersion": "haiku-4-5@aabbccdd",
      "isCurrent": false,
      "extractedAt": "2026-04-30T14:02:00Z",
      "claimCount": 2,
      "model": "claude-haiku-4-5",
      "claims": [ ]
    },
    {
      "extractorVersion": "haiku-4-5@a1b2c3d4",
      "isCurrent": true,
      "extractedAt": "2026-05-12T11:30:00Z",
      "claimCount": 0,
      "model": "claude-haiku-4-5",
      "claims": []
    }
  ]
}
```

`isCurrent` is `true` for the most recent extractor version observed across the system (read from a settings row or the latest `ArticleExtractionRun.extractorVersion` aggregate, whichever the implementation picks). Older runs are listed in `extractedAt DESC` order. Zero-claim runs render with `claimCount: 0` and an empty `claims` array, so the UI shows "no claims extracted under this version" rather than hiding the run.

**404**: article not found.

Cache: none (admin). Rate-limited per the existing admin-API floor.

---

## GET `/api/admin/investigations/llm-usage`

Per-day LLM spend admin view (FR-004).

**Query params**: `days=7..90` (default 30).

**200 OK**:
```json
{
  "ceilingHuf": "200000",
  "rows": [
    { "day": "2026-05-14", "model": "claude-haiku-4-5",
      "inputTokens": "1234567", "outputTokens": "54321",
      "estimatedHufSpend": "112340.50", "callCount": 412 }
  ],
  "extractionPaused": false
}
```

---

## Error envelope

Every 4xx/5xx response uses:

```json
{ "error": "<machine_code>", "detail": "string | object | null" }
```

Standard codes:
- `unauthorized` (401) — missing or expired Supabase session.
- `forbidden` (403) — admin role missing or WebAuthn assertion stale.
- `not_found` (404).
- `stale` (409) — optimistic-concurrency conflict.
- `already_promoted` (409) — FR-029.
- `loop_in_flight` (409) — hypothesis loop already running for this investigation.
- `predicate_failed` (422) — promotion predicate fails (FR-026).
- `invalid_transition` (422) — illegal state change.
- `rate_limited` (429).
- `server_error` (500).
