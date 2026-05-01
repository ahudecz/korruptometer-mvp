# Spec-Phase-4 launch gates — 2026-04-30

Launch-gate T225. Captures the final security audit run before the
sealed-box flag is flipped on in production.

## Status

`PENDING` — must be exercised on staging before spec-Phase-4 ships.

## Components

* **Security headers snapshot** — full header set + CSP directives
  including `https://challenges.cloudflare.com`. Run via
  `pnpm --filter @korr/web test:e2e -- security-headers.spec.ts`.
* **axe a11y** — every public route + `/admin/*` route. Zero
  serious/critical violations.
* **k6 burst** — 60 s of 100 RPS against `/api/cases`; p95 < 400 ms,
  0 % error rate (SC-002, SC-006).
* **Sealed-box integration** — happy path, orphan recipient,
  rotation idempotency, envelope-size monitor.
* **Memory-snapshot** — server has no plaintext in heap (T223).
* **Recipient-resolution coverage** — every `Submission` row has a
  computed `recipientResolution` field on next admin-queue render
  (T224, SC-033).

## Evidence

| Component | Result | Evidence link |
|-----------|--------|---------------|
| Security headers | _PASS / FAIL_ | `app/apps/web/tests/e2e/security-headers.spec.ts` |
| axe a11y | _PASS / FAIL_ | Playwright run output |
| k6 burst | _PASS / FAIL_ | k6 summary JSON |
| Sealed-box happy path | _PASS / FAIL_ | T192 |
| Sealed-box orphan | _PASS / FAIL_ | T202 |
| Sealed-box rotation | _PASS / FAIL_ | T207 |
| Memory-snapshot | _PASS / FAIL_ | `app/docs/server-memory-no-plaintext-2026-04-30.md` |
| Recipient-resolution | _PASS / FAIL_ | T224 |

## Sign-off

| Role | Name | Date |
|------|------|------|
| Editor-in-chief | _pending_ | |
| Lead engineer | _pending_ | |
| Security | _pending_ | |

Once every component is `PASS` and every sign-off is recorded, the flag
flip in production goes ahead in the same release window as the form-copy
upgrade (T226).
