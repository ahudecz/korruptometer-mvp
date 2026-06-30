# Quickstart — populate local DB from cloud & run the case pages

## 0. The situation (verified 2026-06-29)

- **Local dev DB** = a local Postgres at `127.0.0.1:5432/nextjs_db` (this is what
  `app/.env.local` `DATABASE_URL` points at). It was **empty of cases**:
  0 `Investigation` / `DamageEstimate` / `ScandalCatalog`, 415 `NewsArticle`.
- **Cloud (prod) data** lives in the Supabase project
  `ndqmbinasykkaqmpplnt` (same project as `NEXT_PUBLIC_SUPABASE_URL`):
  **939 `ScandalCatalog`**, 1598 `Investigation`, 1447 `DamageEstimate`,
  2650 `InvestigationArticleLink`, 1221 `NewsArticle`.
- `ScandalCatalog` is a **VIEW** — never copy it; it rebuilds itself from
  `Investigation` + `DamageEstimate`.

### Why the obvious routes failed (so we don't retry them)

- **Direct connection** `db.<ref>.supabase.co` resolves **IPv6-only**; this
  machine has no IPv6 route → `getaddrinfo ENOTFOUND`.
- **Pooler** (`aws-0-eu-west-1.pooler.supabase.com`, IPv4) reaches the project,
  but we don't hold the **cloud DB password** (the 12-char `SPORT…` value is the
  *local* `nextjs_db` password, reused by mistake — it auth-fails on cloud).
- **Node `fetch` to the REST API** fails TLS validation
  (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) because a TLS-intercepting AV/proxy on this
  machine breaks Node's chain — **the OS HTTP stack works fine** (curl/Invoke-
  WebRequest return 200).

> Note: `SPORT…` (local DB password) leaked into an earlier error log. It only
> guards the local dev Postgres, so risk is low — rotate it if you like. The
> **cloud** password was never exposed. `PROD_DATABASE_URL` in `.env.local` holds
> a wrong password and is unused — you can delete that line.

## 1. The working method: service-role REST pull → local Postgres

We pull via the Supabase **service-role key** (already in `app/.env.local`,
proven working) over PostgREST, and insert into local Postgres. No cloud password,
no prod impact. The script is `app/migrate-cloud-to-local.mjs`.

```bash
cd app
NODE_TLS_REJECT_UNAUTHORIZED=0 node --dns-result-order=ipv4first migrate-cloud-to-local.mjs
```

- `NODE_TLS_REJECT_UNAUTHORIZED=0` — works around the local TLS-intercept (only
  this one-off local pull; do not use in app code).
- `--dns-result-order=ipv4first` — avoid the dead IPv6 path.
- The script pulls all rows first (so a failure never truncates), then loads
  inside one transaction with `session_replication_role = replica` (FK/triggers
  off) after `TRUNCATE … CASCADE`. Idempotent: re-run any time to refresh.
- Tables copied: `Source`, `OffenceTypeRef`, `NewsArticle`, `Investigation`,
  `DamageEstimate`, `InvestigationArticleLink`. (The `KMonitor*` tables are **not
  exposed** to PostgREST → skipped; only needed later for the auto related-persons
  layer. To include them, expose them in the Supabase API settings or pull them
  via a future direct-DB route.)

After it runs it prints `ScandalCatalog (view): 939 ügy` and the top cases.

## 3. Run the app locally

```bash
cd app
pnpm install        # if needed
pnpm --filter @korr/web dev   # or: cd apps/web && pnpm dev
# open http://localhost:3000/adatbazis  and a detail page
```

## 4. (Approval-gated) damage-quality pass over the 80–3750 Mrd band

Only after you OK the Anthropic spend (Haiku):

```bash
cd app
# dry run first — prints the plan, no writes, no DB mutation
DRY_RUN=1 REPRICE_THRESHOLD_HUF=80000000000 \
  pnpm --filter @korr/db exec tsx src/catalog-reprice-damage.ts
# then apply, and clean baked numbers from names
pnpm --filter @korr/db exec tsx src/catalog-reprice-damage.ts
pnpm --filter @korr/db exec tsx src/catalog-fix-names.ts
```

This is what fixes the "3750 Mrd plusz költségvetés" class of artifacts at the
data level; the `<DamageFigure>` display rule (FR-005) protects the UI even before
this runs.
