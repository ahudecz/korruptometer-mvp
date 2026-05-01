# Sealed-box rollout runbook (Phase 4)

`SUBMISSIONS_SEALED_BOX_ENABLED` is the per-environment kill switch that
gates Phase 4. This runbook documents the rollout sequence and the rollback
command (FR-085).

## Pre-rollout checklist

* `EditorKey` rows exist for every active editor with `revokedAt = NULL`.
* The "view current recipients" UI on `/admin/security/passkey` lists all
  active editors.
* The staging exercise (T220) has been documented in
  `app/docs/sealed-box-backout-staging-YYYY-MM-DD.md` with both flag-on
  and flag-off paths verified.
* The form-copy snapshot test (T213) has been updated to expect both the
  Phase-2 truthful copy (flag off) and the Phase-4 strong-promise copy
  (flag on).
* Editorial sign-off recorded in `app/docs/trust-posture-signoff.md`.

## Rollout sequence

### Step 1 — Staging on, prod off

```sh
vercel env add SUBMISSIONS_SEALED_BOX_ENABLED true preview
vercel env rm  SUBMISSIONS_SEALED_BOX_ENABLED production || true
vercel deploy
```

Verify on the preview URL:

* `/bejelentes` shows the Phase-4 strong-promise copy.
* Submitting a tip writes `bodyCipher` columns; `reporterEmailEnc` is NULL.
* Admin queue can decrypt locally after passkey assertion.

### Step 2 — Production on

```sh
vercel env add SUBMISSIONS_SEALED_BOX_ENABLED true production
vercel deploy --prod
```

Within the same release window:

* Confirm the form copy upgrade ships with the migration.
* Confirm `app/apps/web/app/bejelentes/trust-copy.tsx` renders the
  strong-promise text on production.
* Run the production smoke test (T245).

### Step 3 — Observability checks

* Sentry: zero new errors from sealed-box code paths in the first 30
  minutes.
* `/admin`: every submission row has either a Phase-2 readable PII column
  (legacy) or a sealed-box envelope (new); no row is half-and-half.
* Better Stack: `submission.intake` queue depth ≤ pre-rollout baseline + 10
  for the first hour.

## Rollback command

```sh
vercel env rm SUBMISSIONS_SEALED_BOX_ENABLED production
vercel deploy --prod
```

The flag is read at the start of every request and not re-checked mid-flow
(per T219). After the rollback deploy:

* New submissions follow the Phase-2 path (`reporterEmailEnc` columns).
* The form copy reverts to the Phase-2 truthful text.
* In-flight submissions written under the flag-on path remain sealed-box
  encrypted — editors can still decrypt them client-side.

## Why we don't auto-rollback

A flag flip while a submission is in-flight could write a half-and-half
row (sealed-box ciphertext + legacy plaintext). The Vitest test in T218
proves the flag is captured at request start so this can't happen, but
auto-rollback during request handling could undo that guarantee. Manual
rollback after the request finishes is safe; mid-request is not.

## Post-rollback recovery

If we have to roll back:

1. Open an incident ticket. Record the symptom that triggered the rollback.
2. Reproduce on staging with the flag on. Fix the code.
3. Re-run the staging exercise (T220). Document.
4. Re-run the rollout sequence above.

## Backout exercise log

Append a row each time the backout is exercised on staging:

| Date | Operator | Result | Notes |
|------|----------|--------|-------|
| (T220 placeholder) | | | |
