# Server-memory no-plaintext evidence — 2026-04-30

Launch-gate T223. Captures the assertion result + heap-dump excerpt from
running T194 against the staging deploy with `SUBMISSIONS_SEALED_BOX_ENABLED=true`
(SC-032).

## Status

`PENDING` — must be exercised on staging before spec-Phase-4 ships.

## Procedure

1. Deploy the staging branch with `SUBMISSIONS_SEALED_BOX_ENABLED=true` and
   the CI-only `/api/_internal/memdump` endpoint enabled (token-gated).
2. Submit a test tip with a known canary string — e.g.
   `CANARY:9f3c1b87-0c7e-4f9e-8e64-2d6c4d6c4d6c`.
3. Within 100 ms of the POST returning, hit `/api/_internal/memdump?token=…`.
   The endpoint streams a V8 heap snapshot.
4. Run `grep -F 'CANARY:9f3c1b87…' heap.heapsnapshot`. Assert zero matches.
5. Repeat with the canary embedded in (a) the form summary, (b) the
   reporter email, (c) the reporter name, (d) an attachment filename.
   All four must produce zero matches.

## Evidence

| Field | Value |
|-------|-------|
| Deploy ID | _to be recorded_ |
| Canary string | _to be recorded_ |
| Submission ref | _to be recorded_ |
| Heap snapshot SHA-256 | _to be recorded_ |
| `grep` result | _0 matches expected_ |
| Operator | _to be recorded_ |
| Notes | |

## Why this matters

Sealed-box only protects submissions from server access if the application
server never has plaintext at rest in memory either. A canary present in
the heap dump after the POST returns means our routing code is decrypting
where it shouldn't — that's a launch-blocking bug.

## Recurrence

Re-run after any change to `app/apps/web/app/api/submissions/route.ts`,
`packages/shared/src/sealed-box.ts`, or the form's client-side seal call.
