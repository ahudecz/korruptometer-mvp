# Observability — Inngest, Better Stack, scrapers

This document captures the alert configuration and dashboard URLs for the
Phase-3 scraper / aggregator stack.

## Better Stack DLQ-depth alerts (FR-073, T141)

For every Inngest function in `app/apps/web/src/inngest/index.ts` we
configure a Better Stack monitor against the Inngest **failed runs** API
that fires when the queue depth is `> 0` for `> 5 min`:

| Function                  | Severity | Notify channel    | Monitor ID                 | Inngest fn-id              |
| ------------------------- | -------- | ----------------- | -------------------------- | -------------------------- |
| scrape-news               | warning  | #korr-editor      | `BETTERSTACK_MON_ID_001`   | `scrape-news`              |
| aggregate-link-articles   | warning  | #korr-editor      | `BETTERSTACK_MON_ID_002`   | `aggregate-link-articles`  |
| aggregate-kpi-rollup      | warning  | #korr-editor      | `BETTERSTACK_MON_ID_003`   | `aggregate-kpi-rollup`     |
| worker-heartbeat          | critical | #korr-pager-duty  | `BETTERSTACK_MON_ID_004`   | `worker-heartbeat`         |
| submission-intake (US5)   | critical | #korr-pager-duty  | `BETTERSTACK_MON_ID_005`   | `submission-intake`        |
| gdpr-retention-sweep (US9)| warning  | #korr-editor      | `BETTERSTACK_MON_ID_006`   | `gdpr-retention-sweep`     |

Monitor IDs above are placeholders (`BETTERSTACK_MON_ID_xxx`) — replace
each with the real numeric ID once the Better Stack project is
provisioned. Each monitor must be configured against the Inngest failed
runs API for its `Inngest fn-id` with the alert rule:

> Trigger when JSON path `$.data.length > 0` for ≥ 5 minutes.

The deploy gate `app/scripts/audit-log-retention.ts` (added in a later
phase) reads this table to verify each placeholder has been replaced
with a real ID before promoting to production.

## Heartbeat liveness criterion (T172, FR-074)

`/healthz` returns 200 only when:
1. `SELECT 1` succeeds against the runtime Postgres pool,
2. `WorkerHeartbeat.at` is ≤ 10 minutes old.

A 5-minute startup grace window protects us from flapping during
deploys before the 5-minute heartbeat cron has fired its first beat.

## Silent-rot detector (T175, SC-022)

`scrape.news` tracks per-source consecutive zero-article HTTP-200 runs.
After 5 zero-article runs in a row the function posts to
`SLACK_EDITOR_WEBHOOK` with the message
`Source *<slug>* returned 0 articles 5 runs in a row — no articles parsed (selector drift?).`

## Inngest secrets (deploy gate)

Inngest functions are registered at `app/api/inngest/route.ts`. They need
the following env vars on every Vercel deploy:

| Var                   | Source                         | Notes                                                         |
| --------------------- | ------------------------------ | ------------------------------------------------------------- |
| `INNGEST_EVENT_KEY`   | Inngest dashboard → Event Keys | Used to authenticate `inngest.send(...)` calls server-side.   |
| `INNGEST_SIGNING_KEY` | Inngest dashboard → Signing    | Used by the serve handler to verify incoming function calls.  |
| `INNGEST_DEV`         | Local only                     | Set to `1` in `.env.local` so the SDK targets `inngest dev`.  |

Local dev: `pnpm dlx inngest-cli@latest dev` (defaults to `:8288`) then
`pnpm --filter @korr/web dev` so the SDK auto-routes to it.

Production deploy checklist:
1. Add both keys to Vercel project secrets (Production + Preview).
2. After the first deploy, hit `/api/inngest` once to register the
   functions with Inngest Cloud (the SDK does this automatically on the
   first request).
3. Verify cron registration in the Inngest dashboard — you should see
   `scrape-news`, `aggregate-link-articles`, `aggregate-kpi-rollup`, and
   `worker-heartbeat` listed under Functions with their schedules.

## Auto-disable (T151, FR-064)

5 consecutive failures auto-disables the source (`Source.enabled = false`)
and posts an editor-channel Slack alert. Editors must re-enable the
source in `/admin/scraper-runs` after fixing the underlying issue.
