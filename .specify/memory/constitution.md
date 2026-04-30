<!--
Sync Impact Report
==================
Version change: TEMPLATE (placeholders only) → 1.0.0
Bump rationale: First concrete fill of the constitution; per semver guidance, the
initial published version of a previously empty/template document is 1.0.0.

Modified principles (template slot → concrete principle):
  - [PRINCIPLE_1_NAME] → I. Trust Posture Above Convenience (NON-NEGOTIABLE)
  - [PRINCIPLE_2_NAME] → II. Phased Shippability
  - [PRINCIPLE_3_NAME] → III. Single Next.js App on the Inbox-to-Action Stack
  - [PRINCIPLE_4_NAME] → IV. Data Minimization & GDPR Retention by Default
  - [PRINCIPLE_5_NAME] → V. Eventual-Consistency on KPIs; Web Request Path Never Recomputes
Added principles (beyond template's 5 slots):
  - VI. Edge-First Reads, Rate-Limited Writes, Verified-Human Path
  - VII. Two-Step Destructive Migrations & Editor-Decision Preservation

Added sections:
  - Additional Standards & Constraints (replaces [SECTION_2_NAME])
  - Development Workflow & Quality Gates (replaces [SECTION_3_NAME])

Removed sections: none

Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ no edit needed (Constitution Check
    gate is dynamic and references this file by path)
  - .specify/templates/spec-template.md — ✅ no edit needed (no
    principle-specific content)
  - .specify/templates/tasks-template.md — ✅ no edit needed (phase-organized
    structure aligns with Principle II)
  - .specify/templates/commands/*.md — ⚠ not present in this repo (skipped)
  - README.md / docs/quickstart.md — ⚠ not present in this repo (skipped)

Follow-up TODOs: none. All template placeholders replaced.
-->

# Korruptométer Constitution

## Core Principles

### I. Trust Posture Above Convenience (NON-NEGOTIABLE)

Whistleblower-facing copy MUST exactly describe what the system does, and
configuration MUST enforce every promise the copy makes. Shipping copy that
overstates the system's protections is treated as a credibility and legal
failure mode the project cannot recover from.

Phase 2 (submissions + admin) MUST NOT ship until **all** of the following are
green and documented:

- The `/bejelentes` form copy matches the truthful Phase-2 text exactly:
  *"A bejelentésedet titkosítva tároljuk és csak a szerkesztőség férhet hozzá.
  Az IP-címedet az adatbázisban nem tároljuk; CDN- és platformszintű
  hozzáférési naplók ideiglenesen rögzíthetik, ezeket legfeljebb 7 napig
  őrizzük. Súlyosan bizalmas anyagokhoz használj Tor-böngészőt."*
- Vercel + Inngest + Better Stack access-log retention is configured at
  ≤ 7 days and audited at each deploy via `app/docs/log-retention.md`.
- `PII_ENC_KEY` lives only in platform secrets (Vercel + Supabase), readable
  by deploys and at most two named admins; rotation runbook present and
  exercised once on staging. The threat model is documented in
  `app/docs/pii-threat-model.md` and states plainly that this control defends
  against offline backup-tape leaks, **not** against an attacker with
  app-server access.
- Sentry SDKs run with `sendDefaultPii: false` plus `beforeSend` /
  `beforeSendTransaction` hooks that drop request bodies, cookies, and headers
  matching `/email|name|reporter|ip|x-forwarded/i`; verified by triggering a
  forced error from `/bejelentes` and inspecting the resulting Sentry event.
- Every successful PII decryption (review-queue render, individual submission
  view) writes an `AuditLog` row with `action = 'pii.read'`,
  `entityType = 'Submission'`, `entityId`, and `actorEditorId`.
- Admin-role accounts use WebAuthn passkey step-up (≤ 30 min freshness)
  layered on top of the Supabase magic-link session; lost-passkey recovery
  follows the runbook in `app/docs/admin-recovery.md`.
- The first Postgres restore drill and Supabase Storage restore drill are
  complete (RPO ≤ 5 min, RTO ≤ 1 h documented).

Phase 4 (libsodium client-side sealed-box submission encryption) is the
durable fix; the Phase-2 `pgp_sym_encrypt` configuration is interim and is
explicitly modeled as not protecting against backend compromise. Phase 4 is
**explicitly NOT deferred** indefinitely: it ships in the release immediately
after Phase 2 stabilizes.

### II. Phased Shippability

Work ships in four independently deployable phases. Each phase is a real,
demoable product slice; no "big bang" launch is permitted.

- **Phase 1 — Read-only public site.** Schema + seed of the 12 cases; public
  read API; pages `/`, `/galeria`, `/adatbazis`, `/adatbazis/[id]`,
  `/hamarosan` stub. No scrapers, no submissions, no admin, no `/bejelentes`.
- **Phase 2 — Submissions + admin.** Gated by every Phase-2 prerequisite in
  Principle I.
- **Phase 3 — Scrapers + aggregator + KPI rollup.** Outlet adapters,
  `aggregate.link-articles`, hourly + advisory-locked `aggregate.kpi-rollup`,
  `/hirek` page, scraper observability, per-queue DLQs and alerts.
- **Phase 4 — Durable submission encryption.** Client-side libsodium
  sealed-box encryption to a multi-recipient editor-public-key envelope;
  per-editor unsealing in `/admin`; key-rotation worker job.

Phases MUST NOT entangle: Phase 1 ships with no scraper, submission, or admin
code paths beyond the `/hamarosan` stub; Phase 2 does not depend on Phase 3
infrastructure; Phase 3 does not depend on Phase 4 cryptography.

Rationale: same-day-deploy is the operating constraint, and shipping a
narrow slice with real data and real filters beats shipping nothing.

### III. Single Next.js App on the Inbox-to-Action Stack

The product runs as **one Next.js 15 (App Router) application on Vercel**.
Inngest durable functions live inside that app at
`apps/web/src/inngest/functions/*.ts` and are served via
`apps/web/app/api/inngest/route.ts`. There is **no** separate `apps/worker/`
package and **no** Fly.io deploy.

Locked-in services (the inbox-to-action stack):

- **Database**: Supabase Postgres (Cloud) — `unaccent`, `pg_trgm`, `pgcrypto`,
  `pgsodium` enabled via raw-SQL migration.
- **Storage**: Supabase Storage — `submissions` (private) and `public-assets`
  (public-read) buckets; presigned uploads via `createSignedUploadUrl` with
  `Content-Type` allowlist + size constraint.
- **Auth**: Supabase Auth (email magic-link only for MVP), allowlist-gated
  against the `Editor` table; WebAuthn passkey step-up for `admin` role.
- **ORM**: Drizzle ORM — typed schema in `app/packages/db/schema.ts`; raw-SQL
  migrations under `app/supabase/migrations/`.
- **Durable execution**: Inngest Cloud (durable steps, scheduled functions,
  concurrency caps, retries). The Inngest dashboard + Sentry capture +
  Better Stack alert is the DLQ-equivalent.
- **Rate limiting**: Upstash Redis (`@upstash/ratelimit`) — rate-limit only.
  Redis MUST NOT be used as a queue broker or cache at any phase.
- **Hosting**: Vercel (web + Inngest endpoint), Supabase (Postgres + Auth +
  Storage), Inngest Cloud, Upstash, Sentry, Better Stack.

Connection pooling is enforced: every runtime path uses `DATABASE_URL`
(Supabase session-pooled, `?pgbouncer=true&connection_limit=1`); `DIRECT_URL`
is reserved for `drizzle-kit` and `supabase db push` migrations only. Both
URLs are documented in `.env.example` with comments explaining which is for
runtime vs migrations.

Stack substitutions (Neon, Fly, R2, BullMQ, Prisma, NextAuth, Resend) MUST
NOT be reintroduced; an exception requires a constitution amendment with
recorded rationale.

### IV. Data Minimization & GDPR Retention by Default

The system MUST minimize collected and retained data, and MUST NOT auto-purge
data that whistleblowers depend on.

Mandatory rules:

- Reporter PII columns (`Submission.reporterEmailEnc`,
  `Submission.reporterNameEnc`) are stored as `bytea` encrypted via
  `pgp_sym_encrypt` from the first migration that introduces them. Plaintext
  reporter PII MUST NOT exist in any table at any phase.
- `NewsArticle.body` is **not stored**. Only `headline`, `excerpt` (≤ 280
  chars), `source`, `sourceUrl`, `sourceUrlCanonical`, and `sourceUrlHash` are
  persisted. Adding a `body` column requires a constitution amendment.
- Submission retention is keyed off `Submission.status`:
  - `received` and `in_review`: **no automatic PII purge**. Stale-state
    alerts surface them in two places: `/admin` banner (>14d for `received`,
    >30d for `in_review`) and the daily `gdpr.retention-sweep` Slack digest
    via `SLACK_EDITOR_WEBHOOK`.
  - `approved`, `rejected`, `duplicate`: PII fields nulled and all
    attachments hard-deleted exactly 30 days after the status transition,
    by the `gdpr.retention-sweep` Inngest function.
- `gdpr.retention-sweep` is the **sole** authority for submission attachment
  deletion in the happy path; Supabase Storage native lifecycle rules MUST
  NOT be configured on the `submissions` bucket. Orphan reaping of abandoned
  presigned-upload objects uses a DB-aware scan: keys older than 7 days with
  no `SubmissionAttachment` row referencing them are hard-deleted.
- `AuditLog` is **range-partitioned by month on `at`** from day one. Rows
  with `action = 'pii.read'` are retained the full 24 months even after the
  underlying submission is purged; the 24-month sweep drops/detaches the
  oldest partition rather than scanning a single huge table.
- DSR (subject-access / deletion) requests start the GDPR 30-day clock at
  receipt at `dpo@korruptometer.hu`, processed via the runbook at
  `app/docs/dsr-runbook.md` (Phase-2 launch prerequisite). The Phase-3
  `/admin/dsr` UI formalizes the same workflow with audit-tracked tooling.

Rationale: a blunt time-floor (e.g., R2 lifecycle rule, 90-day bucket purge)
would delete attachments out from under a `received`/`in_review` submission
whose editor was simply slow, contradicting the no-auto-purge rule.

### V. Eventual-Consistency on KPIs; Web Request Path Never Recomputes

`KpiSnapshot` is a **single-row table** (`id = 'current'`) recomputed
exclusively by the `aggregate.kpi-rollup` Inngest function. The web request
path MUST NOT trigger a synchronous recompute under any circumstance.

Rules:

- The rollup function holds a Postgres advisory lock keyed by a single named
  constant defined in `app/packages/db/locks.ts`
  (`KPI_ROLLUP_LOCK = 8423501n`), called as
  `pg_advisory_xact_lock(KPI_ROLLUP_LOCK)`. The magic number lives in exactly
  one file. Concurrent rollups serialize.
- The function runs hourly via Inngest scheduled function **and** is
  enqueued by admin Case/Submission mutations, debounced ≤ 1× per 10 s by
  job-id collapsing.
- After upsert, the function calls `revalidateTag('stats')` on the web app
  via a signed internal endpoint.
- `/api/stats` ships with `Cache-Control: public, s-maxage=120,
  stale-while-revalidate=600`. Eventual consistency under ~ 2 min is the
  explicit, documented contract.
- The "frissítve X perccel ezelőtt" UI string can show up to ~ 2 min more
  stale than the actual `KpiSnapshot.computedAt`, even immediately after a
  rollup; this is documented next to the formatter in
  `app/packages/shared/format.ts` so it is not "fixed" by a confused
  implementer.
- A separate `KpiHistory` append-only table is **out of scope** until a
  trend/sparkline feature is actually scoped. Adding it requires a
  constitution amendment.

Rationale: synchronous KPI recompute on the request path is a self-DoS
waiting to happen; the documented eventual-consistency contract makes the
system's behavior predictable instead of accidental.

### VI. Edge-First Reads, Rate-Limited Writes, Verified-Human Path

All public read endpoints MUST set `Cache-Control: public, s-maxage=…` and
rely on Vercel edge caching. Admin mutations MUST bust the cache via the
appropriate `revalidateTag` call.

Rate-limit floor (env-tunable where noted, but never weaker than these
defaults):

- `GET /api/cases?q=…` — 60/IP/min via Upstash. Non-`q` requests are
  uncapped because they hit cache.
- Cursor-paginated requests (any request carrying a `cursor` param) — 120/IP/
  min, in addition to the `q` limit, because each cursor is a unique URL and
  bypasses the edge cache.
- `POST /api/submissions` — `SUBMISSION_RATE_MINUTE` (default 3/IP/min) and
  `SUBMISSION_RATE_DAY` (default 100/IP/day, deliberately forgiving for
  shared-NAT scenarios — universities, corp VPNs, Tor exits — where 30/day
  was too tight). A valid Turnstile pass in the last 24 h grants a
  "verified-human" cookie that doubles both limits for the cookied browser.
- Presigned-URL endpoint — 30/IP/hour.

Anti-abuse defense in depth on `POST /api/submissions`:

- Cloudflare Turnstile token required, verified server-side.
- Per-submission attachment cap (10 files, 25 MB each) enforced
  server-side at `POST /api/submissions`, not just client-side. The
  presigned-URL endpoint cannot enforce the 10-file cap (no submission row
  exists yet); the rate limit is its only defense and any orphan objects are
  reaped by `gdpr.retention-sweep`.
- Defense in depth on size: `submission.intake` re-reads the object's
  `Content-Length` and deletes + rejects any attachment exceeding 25 MB
  before virus scanning.

Cursor decoders MUST validate the tuple shape per `sort` value; mismatched
cursor shapes return 400, never 500.

Rationale: the edge cache is the first defense against grind; rate limits
target the cache-bypass paths (`q=`, `cursor=`); Turnstile + verified-human
cookie keep journalism-class shared-NAT users from being false-positives.

### VII. Two-Step Destructive Migrations & Editor-Decision Preservation

Drizzle migrations have **no automatic rollback**. Destructive migrations
(drops, renames, `NOT NULL` on backfilled columns) MUST ship in two
migrations:

1. A forward-compat shim migration (e.g., add new column, dual-write,
   backfill).
2. A drop/rename migration in a follow-up release after the app code that
   depends on the new shape has fully deployed.

Combining an app-breaking schema change with code that depends on it in a
single PR is forbidden. The runbook is `app/docs/migrations.md`. The
`CODEOWNERS` file requires explicit migration-owner review on
`app/supabase/migrations/**` and `app/packages/db/schema.ts`.

CI MUST run `drizzle-kit check` and `supabase db diff` against the staging
branch on every PR; drift fails the build.

Editor-decision preservation: any admin mutation that changes or clears
`NewsArticle.relatedCaseId` MUST set `linkOverridden = true` in the same
transaction. The `aggregate.link-articles` function MUST skip articles
where `linkOverridden = true`. Tests in `apps/web/app/api/admin/news/**`
MUST assert this. Editor decisions outrank automated link aggregation —
re-running the aggregator after a deploy MUST NOT stomp human curation.

## Additional Standards & Constraints

**Locale.** The site ships in Hungarian only — URLs, copy, formatters. No
i18n machinery (`next-intl`, message catalogs, locale routing) until an
explicit feature requests it. Currency magnitudes are formatted by the
explicit-magnitude `fmtFt` in `app/packages/shared/format.ts` (Ft / e Ft /
M Ft / Mrd Ft); `Intl.NumberFormat({ notation: 'compact' })` is **forbidden**
for currency because HU compact output has shifted between Node ICU
versions. Every magnitude bucket MUST be snapshot-tested.

**Accessibility.** Pages use semantic HTML (`<main>`, `<nav>`, `<section>`
with proper heading hierarchy), `<html lang="hu">` set in the root layout,
keyboard-navigable filters, visible focus rings, ARIA labels on icon-only
buttons, and WCAG-AA contrast. Playwright runs `axe` on `/`, `/galeria`,
`/adatbazis`, `/adatbazis/[id]`, `/hirek`, and `/admin/scraper-runs`. CI
fails on any serious or critical violation.

**Security headers / CSP.** From Phase 2 onward, `app/apps/web/next.config.js`
ships explicit headers: `Strict-Transport-Security: max-age=63072000;
includeSubDomains; preload`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(), microphone=(), geolocation=()`,
`X-Content-Type-Options: nosniff`, plus a CSP that defaults `default-src`
to `'self'`, allows Turnstile (`script-src` + `frame-src
https://challenges.cloudflare.com`), Supabase Storage, and Sentry
(`connect-src`), and sets `frame-ancestors 'none'`, `form-action 'self'`,
`base-uri 'self'`. A header-snapshot test runs in CI against the preview
deploy and fails on drift.

**Backups, restore drills, and observability.** Supabase PITR enabled,
14-day retention. Quarterly restore drills (Postgres + Storage); the first
of each is a Phase-2 launch prerequisite. `RPO ≤ 5 min, RTO ≤ 1 h`
documented. Sentry is a single project covering web routes + Inngest
functions; Better Stack provides uptime + log drain. `/healthz` is a Next.js
route handler that pings DB + Upstash and reports the timestamp of the last
`worker.heartbeat` Inngest run.

**Scraping ethics.** Outlet scrapers respect `robots.txt`; outbound rate
limit ≤ 1 req / 2 sec per outlet; identifying User-Agent
(`Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)`); back off on
4xx/5xx; per-outlet kill-switch via `Source.enabled`. Five consecutive
failures auto-disable the source and alert editors.

**Mockup pin.** All `01-tesla/index.html:NNNN` line references in plans
resolve against the git tag `mockup-port-base-v1`. Re-tagging or deleting
that tag requires a constitution amendment.

## Development Workflow & Quality Gates

**Required CI gates** (`app/.github/workflows/ci.yml`) — every PR MUST pass
all of these before merge:

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (Vitest), `pnpm build`.
- `drizzle-kit check` + `supabase db diff` against the staging branch
  (Principle VII drift check).
- Playwright + `axe` accessibility suite on the Phase-relevant pages.
- Security-headers snapshot test against the preview deploy
  (Phase-2 onward).
- `pnpm audit --prod` blocking on any **un-allow-listed** high or critical
  advisory. Allow-listed entries in `app/.audit-allowlist.json` MUST carry
  `rationale`, `expires` (max 90 days), and `reviewer`. Allow-listed entries
  auto-expire and re-block CI on the expiry date.
- DB-pool burst smoke test (Phase 1+): `k6 run scripts/cases-burst.js` for
  60 s at 100 RPS against `/api/cases` mixing `q`, filter, and cursor
  variants. Postgres connection count (sampled via the secret-token-gated,
  CI-only `/api/_internal/dbstat` endpoint) MUST stay below the configured
  Supabase pool ceiling; p95 latency < 400 ms; error rate 0 %.

**Environment file discipline.** `app/.env.example` (committed) lists every
var grouped and labelled by phase. `app/.env.local` (gitignored) holds real
Supabase + Inngest + Sentry credentials for local dev. Production secrets
land in Vercel project env (encrypted) and Supabase project secrets — never
committed, never logged.

**Local dev bootstrap.**
- `pnpm dlx supabase init` (one-time), then `pnpm dlx supabase start` —
  boots Postgres + Auth + Storage + Realtime + Studio in Docker.
- `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` in a
  separate terminal.
- `pnpm install && pnpm --filter @korr/db migrate && pnpm --filter @korr/db
  seed && pnpm dev`.

**Phase-2 launch prerequisites checklist** (every item green and signed off
before the Phase-2 deploy tag is cut):

- `app/docs/log-retention.md` shows Vercel + Inngest + Better Stack at
  ≤ 7 days, audited.
- `/bejelentes` form copy matches the Principle-I text exactly.
- `PII_ENC_KEY` rotation runbook exercised on staging.
- `app/docs/pii-threat-model.md` published.
- `app/docs/dsr-runbook.md` published.
- `app/docs/admin-recovery.md` published.
- Sentry PII scrubbing verified end-to-end via forced `/bejelentes` error.
- Bootstrap admin has registered a passkey; admin routes refuse access
  without a fresh (≤ 30 min) WebAuthn assertion.
- Cloudmersive virus-scan key works against an EICAR test file.
- Postgres restore drill complete.
- Supabase Storage restore drill complete.
- Security-headers snapshot test passes against the preview deploy.

**Out of scope (deferred — adding any of these to a phase requires a
constitution amendment):** footer/methodology pages and CSV/API export and
donations/partners/team/sajtó pages (catalog item 7); SecureDrop integration;
IP-stripping reverse proxy; OAuth providers (GitHub, Google) for editor
sign-in; passkeys for the non-admin `editor` role; mobile native app;
self-service DSR portal; `KpiHistory` trend tables; `hunspell_hu`
Hungarian-language stemming.

**Explicitly NOT deferred** (called out because shorthand summaries
sometimes mis-bucket them as "future"): client-side libsodium sealed-box
submission encryption (Phase 4 above); per-platform log-retention
configuration (Phase-2 launch gate above).

## Governance

This constitution supersedes ad-hoc decisions, individual preference, and
inherited documentation. When this file conflicts with any other document,
this file wins until amended.

**Amendment procedure.** Amendments are PRs that:

1. Modify this file with the proposed change.
2. Bump `Version` per the versioning policy below and update
   `Last Amended` to today's date (ISO `YYYY-MM-DD`).
3. Update or refresh dependent artifacts: `.specify/templates/plan-template.md`,
   `.specify/templates/spec-template.md`, `.specify/templates/tasks-template.md`,
   any `app/docs/*.md` runbooks the change touches, and any
   `app/.github/workflows/*` gates the change requires.
4. Prepend a Sync Impact Report HTML comment to this file documenting the
   version change, modified principles, added/removed sections, and the
   propagation status of every dependent artifact (`✅ updated` or
   `⚠ pending`).

**Versioning policy.** Semantic versioning of this document:

- **MAJOR** — backward-incompatible governance or principle removals,
  redefinitions that invalidate prior project decisions, or stack
  substitutions covered by Principle III.
- **MINOR** — a new principle or section is added, or guidance materially
  expanded.
- **PATCH** — clarifications, wording, typo fixes, or non-semantic
  refinements that preserve the intent of every existing rule.

If a bump is ambiguous, the PR author proposes reasoning and the reviewer
selects.

**Compliance review.** Every PR that touches schema, migrations,
secrets/env, retention logic, scraper adapters, rate limits, the
`/bejelentes` form copy, or Inngest function semantics MUST include a brief
"Constitution check" note in the PR description naming the principles it
exercises and linking the relevant gate (CI step, runbook, or audit-log
assertion). The review explicitly verifies the named principles. Reviewers
MUST block merges whose interpretation requires silently expanding scope
beyond the named principle (e.g., reintroducing Redis as a queue, adding
`NewsArticle.body`, or shipping a `Submission`-bypass code path).

**Runtime guidance.** This file is the source of truth. The plan at
`/home/attilah/.claude/plans/create-a-plan-for-zippy-reef.md` is the
in-flight implementation reference; where the plan and this constitution
disagree on a principle, this constitution wins, and the plan is updated to
match in the same PR.

**Version**: 1.0.0 | **Ratified**: 2026-04-30 | **Last Amended**: 2026-04-30
