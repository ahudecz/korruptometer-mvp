# Sealed-box backout — staging exercise — 2026-04-30

Launch-gate T220. Exercises the `SUBMISSIONS_SEALED_BOX_ENABLED=false` path
on staging and confirms that flipping the flag off cleanly reverts to the
Phase-2 sym-enc submission flow plus the Phase-2 truthful form copy
(FR-085, SC-036).

## Status

`PENDING` — must be exercised on staging before spec-Phase-4 ships.

## Procedure

1. **Set** `SUBMISSIONS_SEALED_BOX_ENABLED=true` on the preview branch.
   Deploy. Verify `/bejelentes` shows the strong-promise copy and submitting
   a tip writes `bodyCipher` columns.
2. **Flip** `SUBMISSIONS_SEALED_BOX_ENABLED=false`. Redeploy.
3. **Verify**:
   * `/bejelentes` reverts to the Phase-2 truthful copy
     (snapshot test T213 should have already proven this).
   * Submitting a fresh tip writes `reporterEmailEnc` (sym-enc) and
     `bodyCipher` is NULL.
   * In-flight tips written under flag-on remain sealed-box encrypted —
     they continue to render correctly in `/admin` after the flag flip
     because the editor's local key still recovers them.
4. **Inspect** Sentry for the 30-min window post-flip. No new errors
   should originate from sealed-box code paths.
5. **Restore** flag-on, redeploy. Verify the path is symmetric.

## Evidence

| Field | Value |
|-------|-------|
| Flag-on deploy ID | _to be recorded_ |
| Flag-off deploy ID | _to be recorded_ |
| Flag-off submission ref | _to be recorded_ |
| Form copy reverted | _PASS / FAIL_ |
| Phase-2 columns written | _PASS / FAIL_ |
| In-flight sealed rows still readable | _PASS / FAIL_ |
| Sentry noise post-flip | _0 / N errors_ |
| Operator | _to be recorded_ |
| Notes | |

## Recurrence

Re-rehearse before any production rollout that flips the flag.
