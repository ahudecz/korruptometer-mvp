# Deploy status — 2026-05-01

Snapshot of what's been provisioned for Korruptométer's first production
deploy and what remains. Source of truth for the next deploy session.

## Live

| Resource | URL / ID |
|----------|----------|
| GitHub repo | https://github.com/ahudecz/korruptometer-mvp (private, default branch `main`) |
| Vercel project | https://vercel.com/attilas-projects-55bd7268/korruptometer |
| Production deploy | **https://korruptometer.vercel.app** ← homepage shows real KPIs |
| Auto-deploy on | every push to `main` |
| Supabase project | `korruptometer` (ref `ndqmbinasykkaqmpplnt`, region `eu-west-1`) — all 5 migrations applied, seeded with 12 cases / 5 sources / 6 articles / 1 KPI snapshot / 1 admin |
| Sentry project | https://konvenient.sentry.io/projects/korruptometer (own DSN, isolated within konvenient org) |
| Cloudflare Turnstile | widget `korruptometer`, hostname `korruptometer.vercel.app` |
| Inngest custom env | `korruptometer` (slug `korruptometer-02e97c6e`) — own event + signing keys |

## Vendor decisions

Per "don't reuse, create new ones": every vendor resource above is a **new
project / env / widget** within the user's existing accounts. Org-level
billing still rolls up to konvenient/ahudecz, but events, errors, signatures,
and rate-limit counters are isolated.

## Vercel env vars set (production + preview)

```
DATABASE_URL                          (Supabase pooler URL)
DIRECT_URL                            (Supabase direct URL)
NEXT_PUBLIC_SUPABASE_URL              https://ndqmbinasykkaqmpplnt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY         (208 chars)
SUPABASE_SERVICE_ROLE_KEY             (219 chars)
SUPABASE_STORAGE_BUCKET_SUBMISSIONS   submissions
SUPABASE_STORAGE_BUCKET_PUBLIC        public-assets

PII_ENC_KEY                           (32B base64, generated locally)
INTERNAL_REVALIDATE_SECRET            (32B hex, generated locally)
CI_DBSTAT_TOKEN                       (32B hex, generated locally)

INNGEST_EVENT_KEY                     (own event key for korruptometer env)
INNGEST_SIGNING_KEY                   signkey-test-c9e6...

SENTRY_DSN                            https://dbdae4ff…@o4510906182270976.ingest.de.sentry.io/4511314102190160
NEXT_PUBLIC_SENTRY_DSN                (same)

TURNSTILE_SITE_KEY                    0x4AAAAAADG4-eh6IhpnSxYj
TURNSTILE_SECRET                      0x4AAAAAADG4-…

WEBAUTHN_RP_ID                        korruptometer.vercel.app
WEBAUTHN_RP_NAME                      Korruptométer
WEBAUTHN_ORIGIN                       https://korruptometer.vercel.app

BOOTSTRAP_ADMIN_EMAIL                 ahudecz@gmail.com
SUBMISSIONS_SEALED_BOX_ENABLED        false (Phase 2 path)
LINK_AUTO_THRESHOLD                   0.55
LINK_REVIEW_THRESHOLD                 0.40
LINK_AGGREGATOR_CONCURRENCY           4
SEALED_BOX_ROW_BUDGET_BYTES           1048576
```

## Verified end-to-end

| Endpoint | Status |
|----------|--------|
| `/` | 200, hero KPIs render (50,9 Mrd Ft total damage, 75 prison years, 8 active cases) |
| `/healthz` | 200, `{"status":"ok"}` |
| `/api/stats` | returns real data with correct shape |
| `/api/cases?limit=2` | returns seeded `KM-003`, `KM-006` rows |

## Inngest sync — pending

`POST /api/admin/_internal/run-retention-sweep` and the cron functions
need Inngest to register the deployed app via `https://korruptometer.vercel.app/api/inngest`.
The first sync attempt failed signature verification — fixed by removing
`INNGEST_ENV` (custom envs route by signing key only). Retry from
https://app.inngest.com/env/korruptometer-02e97c6e/apps/sync-new with
`https://korruptometer.vercel.app/api/inngest` after the next deploy
completes.

## Still missing (no account)

| Vendor | Required for | Workaround until provisioned |
|--------|--------------|-------------------------------|
| Cloudmersive | virus-scan in `submission.intake` | attachments stay `pending` (banner shows in admin); see `app/docs/virus-scan.md` |
| Upstash Redis | distributed rate limiting | falls back to per-process in-memory limiter — not safe for multi-region |
| Slack incoming webhook | editor channel digests | every `postSlackDigest` call no-ops with a logged reason |
| Better Stack | DLQ-depth alerts | nothing fires when an Inngest queue stalls |

The MVP runs without these — they gate Phase-2/3 features (submissions,
scrapers' silent-rot alerting). Site is fully functional for read-only
public traffic right now.

## Next steps when you're back at the keyboard

1. Confirm the Inngest sync (one click on the dashboard after deploy `6297242`+ is live).
2. Optionally sign up for Cloudmersive / Upstash / Slack webhook / Better Stack and paste keys via `vercel env add`.
3. Run `pnpm --filter @korr/web exec playwright test` against the prod URL to capture the Phase-1 launch-gate evidence.
