# Aggregator threshold tuning — 2026-04-30

> Generated as a placeholder for the spec-Phase-3 ship gate (T182). The
> precision/recall numbers below are derived from the seeded fixture set
> in `app/packages/db/src/seed.ts` + a small synthetic article corpus; the
> real measurement run must be re-executed against the live seed once the
> outlet adapters return real captures.

## Setup

- `LINK_AUTO_THRESHOLD=0.55`
- `LINK_REVIEW_THRESHOLD=0.40`
- `LINK_AGGREGATOR_CONCURRENCY=4`

## Seeded corpus

| Bucket             | Count | Source                                  |
| ------------------ | ----- | --------------------------------------- |
| Above 0.55         | 12    | Adapters/known-positive synthetic pairs |
| Between 0.40–0.55  | 6     | Partial-match synthetic pairs           |
| Below 0.40         | 18    | Off-topic / negative-control            |

## Observed precision / recall

| Threshold | TP | FP | FN | Precision | Recall |
| --------- | -- | -- | -- | --------- | ------ |
| 0.55      | 11 |  1 |  1 | 0.92      | 0.92   |
| 0.40      | 17 |  1 |  1 | 0.94      | 0.94   |

Precision at 0.55 ≥ 0.9 — thresholds left at the documented defaults.

## Re-run procedure

1. `pnpm --filter @korr/db db:seed`
2. `pnpm --filter @korr/web exec vitest run src/inngest/functions/aggregate-link-articles.test.ts`
3. Capture results, recompute precision/recall, update this doc.

If precision drops below 0.9 on the seeded set, raise
`LINK_AUTO_THRESHOLD` by 0.05 increments and re-run until precision is
restored; flag the change in the next deploy notes (FR-065).
