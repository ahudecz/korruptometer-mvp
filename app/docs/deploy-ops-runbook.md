# Deploy ops runbook

This is the single checklist a deploy operator runs through to take this
codebase from a fresh clone to a working production. It covers
spec-Phase-1/2/3/4 tasks T227–T247 (Phase 29 in `tasks.md`).

Each step lists the concrete command + where to record the evidence. None
of these steps live in code other than the CI workflow file (T227); they
live in vendor dashboards, secrets stores, and short-form runbooks.

## Status

`PENDING` — must be exercised end-to-end before the next production
deploy.

## CI / verification infrastructure

### T227 — `app/.github/workflows/ci.yml`

Already shipped. Runs typecheck, lint, vitest, build, audit, Playwright
on every PR + push to main. Postgres service container brings up a clean
DB so the integration tests have somewhere to talk to.

Verify by opening any PR and watching the workflow run.

### T228 — `pnpm audit --prod` allowlist gate

Already shipped as a step in the CI workflow. Reads
`app/.audit-allowlist.json`. Empty allowlist by default; advisories must
either be fixed or have a justified entry with `expires` ≤ 90 days.

## Cloud account provisioning

### T229 — Supabase Cloud (production)

```sh
# 1. Create the project in the Supabase dashboard, region = eu-west-1.
# 2. Run migrations in order:
supabase link --project-ref <prod-ref>
supabase db push   # this picks up app/supabase/migrations/0001..0010
# 3. Create buckets:
supabase storage buckets create submissions --private
supabase storage buckets create public-assets --public
# 4. Configure pgbouncer pooler (default).
```

Capture the project ref + region in `app/docs/supabase-prod-setup.md`.

### T230 — Vercel project

* Link this repo to a new Vercel project. Root directory = `app/`.
* Build command = `pnpm --filter @korr/web build` (matches
  `app/apps/web/vercel.json`).
* Set every env var listed in `app/.env.example` for both Production +
  Preview environments.
* Project Settings → Logs → Retention = ≤7 days. Record the screenshot
  SHA in `app/docs/log-retention.md`.

### T231 — Inngest Cloud

* Create a new Inngest project. Generate
  `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` from the dashboard.
* Paste both into Vercel Production + Preview secrets.
* Project Settings → Logs → Retention = ≤7 days.

### T232 — Sentry

* Create a project. Set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in
  Vercel.
* Project Settings → Data Privacy → Event retention = ≤7 days.
* Verify the PII-scrub `beforeSend` hook is active in
  `apps/web/sentry.{server,edge,client}.config.ts`.

### T233 — Better Stack

* Create six monitors per `app/docs/observability.md` (DLQ depth for the
  six Inngest functions).
* Replace each `BETTERSTACK_MON_ID_xxx` placeholder with the real numeric
  ID returned by Better Stack.
* Set the rolling-delete policy on log retention to ≤7 days.

This step closes T176.

### T234 — Cloudflare Turnstile

* Create a Turnstile site. Set `TURNSTILE_SITE_KEY` (public) +
  `TURNSTILE_SECRET` (server) in Vercel.
* Domain whitelist: `korruptometer.hu` + the Vercel preview wildcard
  (`*.vercel.app`).

### T235 — Cloudmersive

* Create an account. Set `CLOUDMERSIVE_API_KEY` in Vercel.
* Run the EICAR smoke (T131) on staging immediately.

### T236 — Upstash Redis (REST)

* Create an instance. Set `UPSTASH_REDIS_REST_URL` +
  `UPSTASH_REDIS_REST_TOKEN` in Vercel.
* Without these, `packages/shared/src/ratelimit.ts` falls back to an
  in-memory limiter — fine for dev, **NOT** acceptable in production.

### T237 — Slack

* Create incoming webhooks for `#korr-editor` and `#korr-pager-duty`.
* Set `SLACK_EDITOR_WEBHOOK` in Vercel (Production + Preview).

## Secrets generation

### T238 — `PII_ENC_KEY`

```sh
openssl rand -base64 32
```

Store in Vercel Production + Supabase Vault only. Never commit. Document
the rotation rehearsal in
`app/docs/pii-key-rotation-staging-2026-04-30.md`.

### T239 — `INTERNAL_REVALIDATE_SECRET`, `CI_DBSTAT_TOKEN`

```sh
openssl rand -hex 32   # 32 bytes hex for each
```

Store in Vercel.

### T240 — `BOOTSTRAP_ADMIN_EMAIL`

* Set to the editor-in-chief's email in Vercel Production.
* After first deploy, that admin completes WebAuthn passkey enrolment
  (launch-gate T130).
* Within 24h, a second admin enrols a passkey per
  `app/docs/admin-recovery.md`.

## First-deploy operations

### T241 — register Inngest cron functions

After the first Vercel production deploy completes:

```sh
curl -fsS https://<prod-host>/api/inngest
```

Verify each cron function appears in the Inngest dashboard with the
correct schedule:

* `scrape-news` — `*/30 * * * *`
* `aggregate-link-articles` — event-driven
* `aggregate-kpi-rollup` — `0 * * * *` + `kpi.recompute` event
* `worker-heartbeat` — `*/5 * * * *`
* `gdpr-retention-sweep` — `15 3 * * *` + `gdpr.retention-sweep` event
* `auditlog-partition-maintenance` — `0 6 25 * *`
* `submission-intake` — event-driven
* `submission-publish` — event-driven
* `submissions-rotate-seal` — event-driven

### T242 — seed production sources

```sh
DATABASE_URL=<prod> pnpm --filter @korr/db db:seed
```

Verify `enabled = true` for each of the five outlets.

### T243 — robots.txt audit

For each of `telex.hu`, `444.hu`, `hvg.hu`, `hang.hu`, `atlatszo.hu`:

```sh
curl -sA 'Korruptometer-Bot/1.0' https://<host>/robots.txt
```

Confirm none of the feed paths in `packages/scrapers/src/<outlet>.ts` are
disallowed. Capture the results in `app/docs/robots-audit-2026-04-30.md`.

### T244 — aggregator threshold tuning

Re-run T182 against prod-seeded data. Replace placeholder precision/
recall in `app/docs/aggregator-tuning-2026-04-30.md`. Adjust
`LINK_AUTO_THRESHOLD` upward in 0.05 increments and redeploy if precision
< 0.9.

### T245 — production smoke

* `/healthz` returns 200 within 5-min startup grace.
* Next scheduled `scrape.news` runs within 30 min and writes
  `ScraperRun` rows for all 5 sources.
* Induced 5-failure outlet trips the editor Slack alert within 15 min.

Capture evidence in `app/docs/production-smoke-2026-04-30.md`.

## Browser verification

### T246 — public routes

`/`, `/hirek`, `/adatbazis`, `/adatbazis/<sample-id>`, `/galeria`,
`/bejelentes`, `/hamarosan`. No console errors, no failed requests, no
missing assets. Capture screenshots in
`app/docs/browser-verify-public-2026-04-30.md`.

### T247 — admin routes

`/admin`, `/admin/scraper-runs`, `/admin/dsr`, `/admin/editors`,
`/admin/submission/<id>`, `/admin/security/passkey`,
`/admin/sealed-box/rotate`. Capture in
`app/docs/browser-verify-admin-2026-04-30.md`.

## Why we don't run these from this session

Every step above requires real account credentials at vendor dashboards
and shared-secret material that should never live in the repo or in
agent context. The deploy operator runs through this list during a
scheduled deploy window with the editor-in-chief on a call. The codebase
side is ready — what remains is the operator + dashboards.
