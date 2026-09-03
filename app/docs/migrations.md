# Migrations playbook

Drizzle generates SQL into `app/supabase/migrations/`. We ship migrations via
Supabase CLI; production applies them in order on every deploy. This file
documents how to land destructive changes safely.

## The hard rule

**Never combine app-breaking schema with consumer code in a single PR.**

A migration is "app-breaking" if any of the following is true after it
applies:

* a column the running app reads is removed or renamed
* a NOT NULL constraint is added to a column the running app may insert NULL
  into
* an enum value the running app emits is removed
* a table is dropped or renamed

For each of these, ship a **forward-compat shim PR first**, deploy it, verify
it's green, then ship the destructive PR.

## Two-PR pattern

Example: removing the legacy `Submission.reporterEmailEnc` column once the
Phase-4 sealed-box columns have backfilled.

### PR 1 — forward-compat shim

* Migration that adds a new state (e.g. `bodyCipher` columns, nullable).
* App code reads BOTH columns, prefers the new one when present.
* Deploy. Verify production reads the new column where it exists and falls
  back to the legacy column otherwise.

### PR 2 — destructive migration + cleanup

* Backfill SQL: copy any remaining legacy data into the new format. For
  Phase 4 this is operationally driven (editors re-seal in the queue) — the
  migration is a placeholder + checklist comment.
* Migration that drops the legacy column.
* App code drops the fallback path.
* Deploy.

## Applying migrations (the runner)

Migrations 0048–0055 were applied by hand, one `psql -f` at a time. That left
no record of what had run, no way to notice a landed migration being edited
afterwards, and no way for anyone without the live connection string to apply
anything. `packages/db/src/apply-migrations.ts` replaces it.

```sh
pnpm migrate                    # dry run: what is pending, nothing is written
pnpm migrate -- --apply         # apply the pending ones, in order
pnpm migrate -- --baseline 0055 --apply   # one-off: mark up to 0055 as already
                                          # applied WITHOUT running them
```

The target comes from `MIGRATION_DATABASE_URL` in `app/.env.migrations.local`
(gitignored). Use the **direct** connection string, not the transaction pooler.
A deliberately separate variable from `DATABASE_URL`, so a migration never
depends on which env file happens to be loaded.

What it guarantees:

* A ledger table, `_applied_migration`, records filename, SHA-256 and time. The
  database itself now says what has run.
* Editing a migration that already ran is refused. The fix for a landed
  migration is a new migration, never an edit.
* Dry run is the default; `--apply` is required to write.
* A non-local target also needs `ALLOW_PROD_WRITE=1`, the same rule
  `packages/db/src/guard.ts` applies to maintenance scripts.
* Each migration runs in its own transaction. A failure rolls that one back and
  stops before the rest.

**On a fresh live database the baseline step comes first.** Live already
carries 0001–0055 from the manual era; running them again would be noise at
best. `--baseline 0055 --apply` writes them into the ledger without executing
them, and from then on only genuinely new files run.

## Running locally

```sh
pnpm --filter @korr/db db:generate    # produces a new SQL file
pnpm --filter @korr/db db:check       # diff against Drizzle's introspection
pnpm --filter @korr/db db:push        # apply to the local Supabase branch
```

For Supabase staging, prefer `supabase db push` against a feature branch over
`db:push` — branches give you a clean rollback path.

## Before merging a migration

1. Run `pnpm --filter @korr/db db:check` and paste the diff into the PR.
2. Run the staging restore drill (latest snapshot → fresh branch → smoke
   test) at least once per spec phase. Document each run in
   `app/docs/restore-drills/postgres-YYYY-MM-DD.md`.
3. Migrations on `app/packages/db/src/schema.ts` and
   `app/supabase/migrations/**` require an explicit reviewer per
   `app/CODEOWNERS`.

## Rollback

We don't generate down-migrations because Supabase branches are the
rollback mechanism: roll forward to the previous branch, restore from the
nightly snapshot if the data shape diverged. Document each rollback in the
launch-gate restore-drill folder.

## Specific destructive migrations on the roadmap

| Migration | When | Two-PR plan |
|-----------|------|-------------|
| `0011_drop_legacy_pii_columns.sql` | After Phase-4 sealed-box backfill is verified zero-row-residual | PR 1 = `0009_submissions_sealed_box_columns.sql` (already shipped); PR 2 = drop |
| `auditLog_drop_pre_2024_partitions.sql` | First time `auditLog_*` partitions older than 24 months exist | PR 1 = nothing — partition retention is built in to the GDPR sweep; PR 2 = N/A |
