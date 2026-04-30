# Korruptométer — Backend + Dynamic Frontend Plan

## Decisions — 2026-04-30 (supersedes earlier sections where they conflict)

These four decisions confirmed before implementation. Read this section first; the rest of the plan is interpreted through it.

1. **Scope of first slice — Phase 1 confirmed.** Start with the Phase 1 read-only slice as defined in `## Build phasing`: monorepo scaffold, schema for Phase-1 tables only (`Case`, `RogueProfile`, `Source`, `KpiSnapshot`, `NewsArticle`), seed of 12 cases, public read API, four pages (`/`, `/galeria`, `/adatbazis`, `/adatbazis/[id]`), `/hamarosan` stub, `format.ts` snapshot tests, `Donut.tsx` + `Mugshot.tsx` SVG ports, semantic HTML + axe a11y. Submissions, admin, scrapers, worker, CI, k6 burst test all deferred to later phases.

2. **Cloud stack — adopt the inbox-to-action setup (Vercel + Supabase + Inngest).** Same-day deploy is the constraint; the stack already proven in `/home/attilah/Coding/inbox_to_action` is the path. This **overrides** the earlier "Locked-in stack" choices wherever they conflict:

   | Concern | Original plan | Revised (this update) |
   |---|---|---|
   | Postgres | Neon | **Supabase Postgres (Cloud)** — `unaccent`, `pg_trgm`, `pgcrypto`, `pgsodium` preinstalled; PITR built-in |
   | ORM | Prisma | **Drizzle ORM** — matches inbox-to-action; raw SQL migrations enable `CREATE EXTENSION` cleanly |
   | Auth | NextAuth/Auth.js + Resend magic-link | **Supabase Auth** — magic-link via built-in email; allowlist-gated against `Editor` table; WebAuthn passkey step-up for admin role still required (Phase 2) |
   | Queue / durable execution | BullMQ + Upstash Redis + Fly.io worker app | **Inngest Cloud** — durable functions live inside the Next.js app at `apps/web/app/api/inngest/` and `apps/web/src/inngest/`. No separate `apps/worker/` package, no Fly deploy. Retries, scheduled (cron) functions, concurrency limits, and step durability are first-class. DLQ-equivalent = Inngest's failed-runs view + Sentry capture |
   | Rate limit | Upstash Redis (`@upstash/ratelimit`) | **Upstash Redis (`@upstash/ratelimit`) — kept** as the only Redis use; queue/cache uses are gone |
   | Object storage | Cloudflare R2 | **Supabase Storage** — two buckets (`submissions` private, `public-assets` public). Presigned uploads via `createSignedUploadUrl` with `Content-Type` + size constraints; signed download URLs for editor review |
   | Email (transactional) | Resend | **Supabase Auth** for magic-link; Resend (or Supabase SMTP) revisited in Phase 2 only if editor notifications need richer templates |
   | Web hosting | Vercel | **Vercel — unchanged** |
   | Worker hosting | Fly.io | **Removed** — Inngest functions run on Vercel as part of the Next.js app |
   | Error reporting | Sentry web + worker | **Sentry web + Inngest function** (single Sentry project; no separate worker DSN) |
   | Uptime / log drain | Better Stack | **Better Stack** — kept; Inngest function runs are also visible in Inngest dashboard |
   | CI migration drift check | `prisma migrate diff --exit-code` | **`drizzle-kit check`** + `supabase db diff` against staging branch |
   | Local dev infra | `docker compose up postgres redis` | **`supabase start`** (runs Postgres + Auth + Storage + Realtime locally via Docker) + **`npx inngest-cli@latest dev`** for local Inngest |

   All references later in this document to Neon, Fly, R2, BullMQ, Prisma, or NextAuth should be read as the corresponding revised choice above. Conceptual content (queue names, retry semantics, GDPR sweep passes, advisory locks for KPI rollup, rate limits, presigned-upload constraints, audit logging, trust posture) carries over **unchanged** — only the implementing service changes.

3. **Real `.env` files — both `.env.example` (committed) and `.env.local` (gitignored, real values).** `.env.example` lists every var grouped by phase with placeholders; `.env.local` holds real Supabase Cloud + Inngest Cloud + Sentry credentials that I'll fill in during the scaffold step. Production secrets land in Vercel project env (encrypted) and Supabase project secrets — never committed. Phase 1 `.env.local` minimum: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (Supabase session-pooled URL with `?pgbouncer=true&connection_limit=1`), `DIRECT_URL` (direct Supabase URL for migrations only), `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `BOOTSTRAP_ADMIN_EMAIL`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (rate-limit only).

4. **Mockup pin — `git init` in the repo root, then tag `mockup-port-base-v1`.** The repo is currently not a git repo (per environment context). First implementation step: `git init`, `.gitignore` for `node_modules`, `.env*`, `.next/`, `dist/`, etc., commit the three existing mockup directories untouched, then `git tag mockup-port-base-v1`. All `01-tesla/index.html:NNNN` line refs in this plan resolve against that tag from then on. The live file may evolve as a design playground without invalidating the plan.

## Context

`/home/attilah/Coding/corruption-tracker-mockups/` currently holds three static HTML mockups (`01-tesla`, `02-editorial`, `03-brutalist`). They are design references, not the product.

The end goal is a real, dynamic Hungarian corruption-tracking web app with:
- A live, filterable case database (the central app surface)
- Editor-curated rogues' gallery, news feed, KPIs
- Public submission intake with editorial moderation
- Background workers: news scraper across HU outlets (Telex, 444, HVG, Magyar Hang, Átlátszó, …), aggregator that links articles to cases, KPI rollups
- Editor/admin app to curate everything

This plan covers backend wiring + the dynamic frontend rebuild for **catalog items 1, 2, 3, 4, 5, 6, and 8** from the earlier audit. Catalog item 7 (footer/methodology static pages, CSV/API export, donations) is **explicitly out of scope** for this plan.

## Locked-in stack

> **Superseded in part by §Decisions — 2026-04-30.** The cloud-service choices below have been remapped (Neon → Supabase, BullMQ/Fly → Inngest, R2 → Supabase Storage, NextAuth/Resend → Supabase Auth, Prisma → Drizzle). Conceptual choices (Next.js 15 App Router, Turborepo monorepo, Turnstile, Sentry, Playwright, Vercel for web) are unchanged. Read §Decisions for the authoritative mapping.

- **Monorepo** (pnpm + Turborepo) with **one Next.js app** (frontend + public API + admin UI + Inngest endpoint); shared `db`/`shared`/`ui`/`scrapers` packages. No separate worker app.
- **Frontend + public API**: Next.js 15 (App Router) — rebuilt from `01-tesla/index.html`
- **Durable execution**: **Inngest Cloud** — replaces BullMQ + Redis-backed worker. Functions live in `apps/web/src/inngest/`; the Vercel deployment is the only compute target. Retries, scheduled (cron) functions, concurrency caps, and step-level durability are first-class.
- **Database**: **Supabase Postgres (Cloud)**. Required extensions: `unaccent`, `pg_trgm`, `pgcrypto`, `pgsodium` — preinstalled by Supabase; we enable per-DB via raw SQL migrations.
- **Rate limiting**: **Upstash Redis** (`@upstash/ratelimit`) only — no longer used as a queue broker.
- **Object storage**: **Supabase Storage** (S3-compatible). Two buckets — `submissions` (private) and `public-assets` (public-read). Presigned uploads via `createSignedUploadUrl` with `Content-Type` + size constraints.
- **Auth**: **Supabase Auth** with **email magic-link only** for MVP; editor allowlist in DB. OAuth providers deferred (see §Auth). WebAuthn passkey step-up for `admin` role required at Phase 2 (handled via `@simplewebauthn` on top of Supabase sessions).
- **ORM**: **Drizzle ORM** (typed schema in `packages/db/schema.ts`, raw-SQL migrations in `supabase/migrations/`).
- **Anti-abuse**: Cloudflare Turnstile on public submission form; Upstash rate limit on `POST /api/submissions` and presigned-URL endpoint.
- **Error reporting / monitoring**: **Sentry (single project — web routes + Inngest functions both report into it)**, Better Stack (uptime + log drain). `/healthz` is a Next.js route handler.
- **CI/CD**: GitHub Actions — typecheck/lint/test on PR; preview deploy via Vercel; production migration gated by manual approval; **`drizzle-kit check`** + `supabase db diff` runs on PR to flag drift.
- **E2E tests**: Playwright (filter database, submit report, editor approve)
- **Deploy**: **Vercel (web + Inngest endpoint), Supabase (Postgres + Auth + Storage), Inngest Cloud (durable functions), Upstash (Redis for rate-limit only), Sentry, Better Stack.** Same-day-deploy path validated by inbox-to-action production stack.

## Repository layout

Reflects the revised stack from §Decisions — single Next.js app on Vercel, Inngest functions co-located, no separate worker app.

```
corruption-tracker-mockups/
├── 01-tesla/              # kept as design reference (pinned at tag mockup-port-base-v1)
├── 02-editorial/
├── 03-brutalist/
└── app/                   # NEW — the real product
    ├── apps/
    │   └── web/           # Next.js 15 (frontend + public API + admin UI + Inngest endpoint)
    │       ├── app/
    │       │   ├── api/inngest/route.ts        # Inngest serve handler
    │       │   └── (pages…)
    │       └── src/inngest/
    │           ├── client.ts                   # Inngest client
    │           ├── functions/
    │           │   ├── scrape-news.ts          # one file per outlet adapter trigger
    │           │   ├── aggregate-link-articles.ts
    │           │   ├── aggregate-kpi-rollup.ts
    │           │   ├── submission-intake.ts
    │           │   ├── submission-publish.ts
    │           │   └── gdpr-retention-sweep.ts
    │           └── index.ts                    # function registry
    ├── packages/
    │   ├── db/            # Drizzle schema (schema.ts), migrations/*.sql, seed.ts
    │   ├── shared/        # Zod schemas, shared types, formatters (fmtFt, etc.)
    │   ├── scrapers/      # Per-outlet adapters (telex.ts, 444.ts, hvg.ts, …) — Phase 3
    │   └── ui/            # Reusable React components (donut, rogue card, etc.)
    ├── supabase/
    │   ├── config.toml    # local Supabase project config (`supabase init` output)
    │   └── migrations/    # raw-SQL migrations including CREATE EXTENSION lines
    ├── .env.example       # all env vars, grouped by phase (see §Critical files)
    ├── .env.local         # gitignored; real Supabase Cloud + Inngest Cloud + Sentry credentials
    ├── pnpm-workspace.yaml
    └── turbo.json
```

Drizzle is the typed-schema/migrations source of truth at `app/packages/db/schema.ts`. Supabase migrations directory is the SQL migration runner (`supabase db push` in dev, applied via Supabase dashboard or CI in prod). The two are kept in sync by exporting Drizzle SQL with `drizzle-kit generate` into `supabase/migrations/` (one-line build script in `packages/db/package.json`).

## Build phasing (MVP slice → full system)

This plan covers a lot of ground. Build in three phases. Each phase is independently shippable.

- **Phase 1 — Read-only public site.** Schema + seed of the 12 cases. Public read API (`/api/cases`, `/api/cases/:id`, `/api/cases/top`, `/api/stats`, `/api/regions`) with edge caching + light `q=` rate limit. Frontend: `/`, `/galeria`, `/adatbazis`, `/adatbazis/[id]`, `/hamarosan` stub (deferred-content surface for footer links — see §Frontend rebuild). No scrapers, no submissions, no admin. `KpiSnapshot` is seeded as a single row and updated manually. Goal: shippable static-feeling site with real data and real filters.
- **Phase 2 — Submissions + admin.** `/bejelentes`, Supabase Storage wiring, Turnstile, rate limit, virus scan, editor magic-link auth, `/admin` review queue, `gdpr.retention-sweep`. **Launch gates:** all three trust-posture controls (rewritten form copy, ≤7-day platform log retention configured and documented, `PII_ENC_KEY` access locked down) are implemented; first Postgres restore drill completed.
- **Phase 3 — Scrapers + aggregator + KPI rollup.** Inngest scheduled functions, outlet adapters, `aggregate.link-articles` with env-tunable thresholds (concurrency cap 4 to keep one batch from starving other queues), hourly + advisory-locked `aggregate.kpi-rollup`, `/hirek` page, scraper observability dashboard, per-function failed-runs alerts (Inngest dashboard + Sentry capture + Better Stack alert).
- **Phase 4 — Durable submission encryption (post-MVP).** Client-side libsodium sealed-box encryption to an editor public key; per-editor unsealing in `/admin`. The only configuration that protects whistleblowers from a backend compromise. Targeted for the release immediately after Phase 2 stabilizes — *not* indefinitely deferred.

## Trust, legal, and abuse posture (must resolve before Phase 2 ships)

The mockup at `01-tesla/index.html:1641` promises reporters: *"Beérkezésed végpont-titkosítva tároljuk. Az IP-címedet nem rögzítjük."* The plan's MVP does **not** deliver true E2E encryption and relies on Vercel/Inngest defaults that log IPs. This is a credibility and legal liability — we cannot ship copy that lies to whistleblowers.

**Phase 2 launch path (chosen)** — combine all three:

1. **Rewrite the form copy** to match what we actually do. Required text: *"A bejelentésedet titkosítva tároljuk és csak a szerkesztőség férhet hozzá. Az IP-címedet az adatbázisban nem tároljuk; CDN- és platformszintű hozzáférési naplók ideiglenesen rögzíthetik, ezeket legfeljebb 7 napig őrizzük. Súlyosan bizalmas anyagokhoz használj Tor-böngészőt."*
2. **Configure platform access-log retention to ≤7 days** as a hard Phase 2 launch prerequisite — Vercel project log retention set to 7 days, Inngest function-run log retention set to 7 days, and Better Stack log drain configured with a 7-day rolling-delete policy. Without this, the form copy is a lie. Document the exact settings in `app/docs/log-retention.md` (audited at each deploy).
3. **Restrict the PII encryption key — and be honest about its threat model.** `PII_ENC_KEY` (used by `pgp_sym_encrypt`) lives only as a Vercel + Supabase project secret readable by deploys and at most two named admins. Rotation runbook documented; rotation re-encrypts existing rows via a one-shot Inngest function. Internal docs (`app/docs/pii-threat-model.md`) state plainly: this control defends against **offline backup-tape / snapshot leaks where the key is held separately**, *not* against an attacker with app-server access — every web instance must hold the key in memory to render the editor review queue, so the realistic blast radius equals the DB-dump radius for any attacker who also reaches a Vercel function. Phase 4 sealed-box is the actual control against backend compromise. Every successful PII decryption (review queue render, individual submission view) writes an `AuditLog` row with `action = 'pii.read'`, `entityType = 'Submission'`, `entityId`, and `actorEditorId` so unusual bulk-read patterns are visible.
4. **Configure Sentry PII scrubbing.** Default Sentry SDKs capture request bodies, query strings, and IP addresses — exactly the data the form copy promises not to retain. In `app/apps/web/sentry.server.config.ts`, `sentry.edge.config.ts`, and `sentry.client.config.ts` (a single Sentry project covers web routes + Inngest functions, so there is no separate worker config): set `sendDefaultPii: false`; install a `beforeSend` hook that drops `event.request.data`, `event.request.cookies`, and any header keys matching `/email|name|reporter|ip|x-forwarded/i`; install `beforeSendTransaction` to scrub the same. Verify by triggering a forced error from `/bejelentes` and inspecting the resulting Sentry event — body, IP, and cookies must be absent. Documented in `app/docs/sentry-config.md`; audited at each deploy alongside log-retention.

**Phase 4 follow-up (durable fix)** — client-side libsodium sealed-box encryption of submission body keyed to an editor public key in env; per-editor unsealing in `/admin`. This is the only configuration that protects against a backend compromise. Targeted for the release immediately after Phase 2 stabilizes, **not** deferred indefinitely (see §Build phasing — Phase 4).

**GDPR / data retention.** This is an EU app handling whistleblower PII. Retention policy is keyed off `Submission.status`:
- `received` (just arrived, not yet triaged) and `in_review` (actively being worked on): no automatic PII purge — destroying whistleblower signal because a queue got slow is the wrong default. Stale-state alerts surface in two places so they can't be silenced by no editor logging in: (a) a banner on `/admin` when a submission has been `received` for >14 days untriaged or `in_review` for >30 days, and (b) the daily `gdpr.retention-sweep` job aggregates per-bucket counts and pushes a digest to `SLACK_EDITOR_WEBHOOK` whenever any bucket is non-zero. Editors must explicitly progress the submission to `approved`, `rejected`, or `duplicate` to enter a purge path.
- `approved`: PII fields (`reporterEmailEnc`, `reporterNameEnc`) and all attachments hard-deleted 30 days after approval; the resulting `Case` row carries no PII.
- `rejected`: submission row PII fields nulled and all attachments hard-deleted 30 days after rejection.
- `duplicate` (linked via `createdCaseId` to an existing case): treated identically to `rejected` for retention — same 30-day PII + attachment purge.
- Audit log: retained 24 months, then anonymized (actor ID nulled). Rows with `action = 'pii.read'` are retained the full 24 months even after the underlying submission is purged.
- Cron job in worker: `gdpr.retention-sweep`, daily.
- Subject-access / deletion requests: handled via `dpo@korruptometer.hu` mailbox, manual today, with a 30-day SLA. **A Phase 2 launch prerequisite is the runbook at `app/docs/dsr-runbook.md`** (intake, identity verification, fulfillment templates, audit log) — the GDPR clock starts at receipt, not at the Phase 3 `/admin/dsr` queue UI launch. The Phase 3 queue formalizes the same workflow with audit-tracked tooling.

**Anti-abuse on `POST /api/submissions`.**
- Cloudflare Turnstile token required, verified server-side.
- Upstash rate limit: **3 submissions / IP / minute** (deflects bot floods) **+ 100 submissions / IP / day** (forgiving for shared NAT — universities, corp VPNs, Tor exits — where dozens of legitimate users share an outbound IP; 30/day was too tight for journalism-class scenarios). Limits are env-tunable (`SUBMISSION_RATE_MINUTE`, `SUBMISSION_RATE_DAY`). A valid Turnstile pass in the last 24h grants a "verified human" cookie that doubles both limits for the cookied browser, mitigating the remaining false-positive risk for power users on shared IPs.
- Presigned-URL endpoint: 30 / IP / hour.
- Per-submission attachment cap (10 files, 25 MB each) enforced server-side, not just client-side.

**Scraping ethics and copyright.**
- `NewsArticle.body` is **not stored**. Only `headline`, `excerpt` (≤ 280 chars), `sourceUrl`. Drop the optional `body` field from the schema.
- Scrapers respect `robots.txt`; outbound rate limit 1 req / 2 sec / outlet; identifying User-Agent (`Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)`); back off on 4xx/5xx.
- Per-outlet kill-switch in `Source` table (see data model).

## Data model (Drizzle — `app/packages/db/schema.ts`)

Core tables (covers items 1, 2, 3, 4, 5, 6, 8):

- **Case** — `id` (KM-001 style), `name`, `position`, `amount` (BigInt HUF), `sentenceYears` (renamed from ambiguous `years`), `caseYear` (renamed from ambiguous `year`), `status` enum (Lezárva/Vádemelés/Folyamatban), `region`, `sector` enum, `chargedAt`, `closedAt`, `createdAt`, `updatedAt`. Generated column `searchVector tsvector` over `name + position + region` using `unaccent` for HU-friendly search; GIN index on it.
- **RogueProfile** (1:1 with Case) — `caseId`, `variant`, `glasses`, `hair`, `detention` enum (busted/pretrial/loose/wanted/investig), `detentionLabel`, `crimes` string[], `extraStatus`, `mugshotUrl?`
- **NewsArticle** — `id`, `headline`, `excerpt` (varchar 280), `source` FK → `Source.id`, `sourceUrl` (raw, as scraped), `sourceUrlCanonical` (canonicalized: scheme normalized to https, lowercase host, fragment stripped, trailing slash removed, tracking query params stripped via a per-outlet allowlist of meaningful params), `sourceUrlHash` (sha256 of `sourceUrlCanonical`, unique — dedup key; raw `sourceUrl` is preserved for forensic traceability but never used for dedup), `publishedAt`, `tag` enum (`korrupcio`, `kozbeszerzes`, `birosag`, `politika`, `egyeb`), `featured` bool, `relatedCaseId?` FK, `linkOverridden` bool default false (set when an editor manually relinks or clears `relatedCaseId`; the aggregator skips articles where this is true so editor decisions are not stomped on re-run), `linkConfidence` numeric (aggregator score), `scrapedAt`, `editorReviewedAt?`
- **Source** — `id` (slug, e.g. `telex`), `name`, `homepageUrl`, `logoUrl?`, `enabled` bool, `lastScrapedAt?`, `lastSuccessAt?`, `consecutiveFailures` int. Seeded with the five HU outlets.
- **Submission** — `id`, `ref` (KM-NEW-XXXXXX), `suspectName`, `suspectPosition?`, `region?`, `period?`, `crimes` string[], `estimatedAmount?`, `summary`, `sources` (text[]), `anonymous` bool, `allowContact` bool, `reporterEmailEnc` bytea (pgcrypto sym-enc, key from env), `reporterNameEnc` bytea, `status` enum (received/in_review/approved/rejected/duplicate), `reviewedById?`, `reviewedAt?`, `editorNotes?`, `createdCaseId?` FK, `createdAt`, `purgePiiAt` timestamp (set on approve/reject by retention sweep)
- **SubmissionAttachment** — `id`, `submissionId`, `storageKey` (Supabase Storage object key under the `submissions` bucket; vendor-neutral name preferred over the legacy `r2Key`), `filename`, `mimeType`, `size`, `virusScanStatus` enum (pending/clean/infected/error), `virusScanResult?`
- **Editor** — `id`, `email`, `name`, `role` enum (editor/admin), `active`, `createdAt`. MVP uses email magic-link only (single identity per editor — no separate `EditorIdentity` table needed yet; add it back if/when OAuth providers are introduced post-MVP).
- **AuditLog** — `id`, `actorEditorId?` (nullable for anonymized rows), `action`, `entityType`, `entityId`, `diff` jsonb, `at`, `ipHash?` (sha256 of editor's IP, optional, for forensic only). Volume grows with every PII read (queue-page render = O(rows-on-page) inserts), so the table is **range-partitioned by month on `at`** from day one (Postgres declarative partitioning); the 24-month anonymization sweep drops or detaches the oldest partition rather than scanning a single huge table. Indexes: `(actorEditorId, at desc)`, `(entityType, entityId, at desc)`, partial index on `action = 'pii.read'` for forensic queries.
- **ScraperRun** — `id`, `sourceId` FK, `startedAt`, `finishedAt?`, `articlesFound`, `articlesNew`, `error?`
- **KpiSnapshot** — **single-row table** (`id` is a fixed sentinel, e.g. `'current'`); columns: `computedAt`, `totalDamage` BigInt, `totalPrisonYears`, `activeCases`, `newIndictmentsThisWeek`, `partnerCount`, `bySector` jsonb. Upserted in place — we don't keep history (no trend/sparkline feature is in scope; if one is added later, introduce a separate `KpiHistory` append-only table). Recomputed exclusively by the `aggregate.kpi-rollup` Inngest function — hourly via Inngest scheduled function (cron), **and** on every admin Case/Submission mutation via a debounced `kpi.recompute` event. The web request path never recomputes synchronously. The function holds a Postgres advisory lock keyed by a single named constant defined in `app/packages/db/locks.ts` (`KPI_ROLLUP_LOCK = 8423501n`) and called as `pg_advisory_xact_lock(KPI_ROLLUP_LOCK)`, so overlapping rollups serialize and the magic number lives in exactly one place. After upsert it calls `revalidateTag('stats')` on the web app via a signed internal endpoint. Public `/api/stats` ships with `s-maxage=120, swr=600`, so eventual consistency under ~2 min is the explicit contract — and because `computedAt` is part of that cached payload, the "frissítve X perccel ezelőtt" UI string can show up to ~2 min more stale than the actual snapshot even immediately after a rollup; this is documented next to the formatter so it doesn't get "fixed" by a confused implementer. Read-only for the frontend.

Schema source of truth lives in `app/packages/db/schema.ts` (Drizzle); `drizzle-kit generate` emits raw-SQL migrations into `app/supabase/migrations/`. Seed in `app/packages/db/seed.ts` ports the 12 cases and `rogueProfiles` map from `01-tesla/index.html` lines 1955–2282 plus the five `Source` rows.

## API surface (Next.js Route Handlers — `app/apps/web/app/api/**`)

**Public read API** — used by the rebuilt frontend and external partners. All public read endpoints set `Cache-Control: public, s-maxage=...` and rely on Vercel edge caching (ISR/Route Handler revalidation):

- `GET /api/cases` — query params:
  - `q` — full-text via `searchVector @@ websearch_to_tsquery('simple', unaccent($1))`, ranked. `q` requests are also rate-limited (Upstash, 60/IP/min) to deflect FTS scrapers; non-`q` requests are not limited.
  - `status`, `region`, `sector`
  - `minAmount` (HUF), `minSentenceYears`, `caseYearFrom`, `caseYearTo` (renamed from ambiguous `minYear`)
  - `sort` ∈ `amount_desc | amount_asc | year_desc | name_asc`
  - `limit` (default 25, max 100), `cursor` — opaque base64 of `(sortKey, id)` tuple; cursor decoder enforces tuple shape per `sort`
  - Cache: `s-maxage=60, stale-while-revalidate=300` for non-`q` requests; `q` responses are uncached. **Cursor-paginated requests bypass the edge cache (each cursor is a unique URL), so a scraper can vary cursors to grind the DB — Upstash rate limit of 120/IP/min applies to any request carrying a `cursor` param, in addition to the `q` limit above.** Non-cursor, non-`q` requests stay uncapped because they hit cache.
- `GET /api/cases/:id` — full case + rogue profile + linked articles. Cache: `s-maxage=300, swr=600`.
- `GET /api/cases/top?n=10` — for rogues' gallery (server-sorted by amount). Cache: `s-maxage=300, swr=900`.
- `GET /api/stats` — `KpiSnapshot` row + `bySector` aggregates for donut charts. Response includes `computedAt` so the UI can show "frissítve X perccel ezelőtt". Cache: `s-maxage=120, swr=600`; admin mutations call `revalidateTag('stats')` to bust the edge cache.
- `GET /api/news` — `featured?`, `tag?`, `caseId?`, `limit`, `cursor`. Cache: `s-maxage=120, swr=600`.
- `GET /api/regions` — distinct regions for the filter dropdown. Cache: `s-maxage=3600`.
- `GET /healthz` — DB + Redis ping; returns 200/503; never cached.

**Submission intake** (item 6):

- `POST /api/submissions/upload-url` — Turnstile-gated; returns a **presigned Supabase Storage POST policy** (`createSignedUploadUrl` output: URL + form fields including `content-length-range` and `Content-Type` allowlist) per file, 5 min validity, rate-limited. Presigned PUT is intentionally not used: PUT URLs accept any size and cannot enforce the 25 MB cap on the upload itself. **The 10-attachments-per-submission cap cannot be enforced here** — no submission row exists yet, so there is no key to count against. The endpoint's defense is the `30 / IP / hour` rate limit; the binding cap is enforced in `POST /api/submissions` below.
- `POST /api/submissions` — Turnstile-gated; rate-limited; validated body (Zod schema in `packages/shared/schemas/submission.ts`); writes `Submission` + `SubmissionAttachment` rows (PII columns encrypted via `pgp_sym_encrypt`); emits a `submission.intake` Inngest event; returns `ref`. **Attachment-cap enforcement:** the request body's `attachments[]` array is rejected with 400 if `length > 10`. Any Supabase Storage objects already uploaded under presigned policies that don't appear in the final accepted body become orphans (they have no `SubmissionAttachment` row) and are reaped by `gdpr.retention-sweep`'s orphan-scan pass — see §Worker.

**Admin/editor API** (item 8) — session-gated via Supabase Auth (`@supabase/ssr`), allowlist check against `Editor.active = true` performed by joining `auth.users.email` to the `Editor` table:

- `GET /api/admin/submissions` — review queue with filters
- `PATCH /api/admin/submissions/:id` — approve / reject / mark duplicate; on approve can spawn a new `Case` and sets `purgePiiAt = now() + 30d`
- `POST/PATCH/DELETE /api/admin/cases` + `/api/admin/cases/:id/rogue-profile`
- `POST/PATCH/DELETE /api/admin/news` — any mutation that changes or clears `relatedCaseId` **must set `linkOverridden = true`** in the same transaction so the next `aggregate.link-articles` run does not stomp the editor's decision. The handler enforces this; tests assert it.
- `GET /api/admin/scraper-runs` — observability dashboard
- `GET /api/admin/audit` — paginated audit log viewer (read-only UI)

All admin routes write to `AuditLog`. Admin mutations that affect KPIs **emit** an `aggregate.kpi-rollup` Inngest event (debounced ≤1× per 10s by job-id collapsing in the function, never inline on the request path); the function holds the advisory lock and calls `revalidateTag('stats')` after upsert — see §Data model `KpiSnapshot`. Validation via Zod schemas shared with the frontend forms.

## Inngest functions (`apps/web/src/inngest/functions/*`)

Per §Decisions item 2 there is **no separate `apps/worker/` package and no Fly.io deploy**. The functions described below are **Inngest durable functions** that live inside the Next.js app (`apps/web/src/inngest/functions/*.ts`) and are served via `apps/web/app/api/inngest/route.ts` on Vercel. Retries, scheduled functions, concurrency caps, and step durability are first-class. The DLQ-equivalent is the Inngest failed-runs view + Sentry capture + Better Stack alert. Advisory locks call into the same Postgres backing the app. The `/healthz` endpoint is a Next.js route handler that pings DB + Upstash Redis (rate-limit only) and reports the timestamp of the last `worker.heartbeat` Inngest run.

Liveness is decoupled from real-job cadence: `/healthz` returns 200 only when **all** of these hold — DB ping under 500 ms, Upstash ping under 500 ms, **and** the `worker.heartbeat` Inngest run has completed within the last 10 min (a freshly booted environment gets a 5-min grace window before this last criterion applies). Earlier designs that required *any* queue to have completed in 15 min flapped by construction: hourly KPI rollups and 30-min scrapes leave long stretches with no real queue activity, which would have cycled a healthy app. **Silently-failing real functions are detected separately via the failed-runs / dead-letter-depth alert in Better Stack** (see §Failure handling below), not by health probes. Functions:

- **`worker.heartbeat`** — runs every 5 min via Inngest scheduled function (cron). The body is a single `SELECT 1` against Postgres so a green heartbeat means *both* "the function runtime is consuming events" *and* "the DB connection works"; it intentionally does not touch any business table. Last-success timestamp is the sole input to the `/healthz` activity criterion above. This function exists only to drive liveness — it has no failed-runs alert and no retry beyond the Inngest default.
- **`scrape.news`** — fans out one event per `Source` row where `enabled = true`. Schedule: every 30 min via Inngest scheduled function (cron). Each adapter returns normalized `{headline, excerpt, sourceUrl, publishedAt, tag?}`; deduped by `sourceUrlHash`. Outbound rate limit 1 req / 2 sec; respects `robots.txt`; bumps `consecutiveFailures` on error and disables the source after 5 in a row (alerts editors).
- **`aggregate.link-articles`** — runs after each scrape batch via Inngest event chaining; matches new articles to existing Cases via `unaccent + pg_trgm` similarity on `name + position`. Thresholds are env-tunable (`LINK_AUTO_THRESHOLD` default 0.55 sets `relatedCaseId`; `LINK_REVIEW_THRESHOLD` default 0.40 flags `linkConfidence` for editor review). The function declares an Inngest concurrency cap of **4** so a thousand-article scrape batch cannot starve other queues; the cap is named `LINK_AGGREGATOR_CONCURRENCY` (env-tunable). Tune thresholds against seeded data before Phase 3 launch.
- **`aggregate.kpi-rollup`** — hourly via Inngest scheduled function (cron); recomputes the single `KpiSnapshot` row. Also triggered by admin Case/Submission mutations as a `kpi.recompute` event (debounced ≤1× per 10s by Inngest job-id collapsing, guarded by `pg_advisory_xact_lock(KPI_ROLLUP_LOCK)` so concurrent rollups serialize). After upsert calls `revalidateTag('stats')` on the web app via a signed internal endpoint. The web request path **never** triggers a synchronous recompute — see §Data model `KpiSnapshot`.
- **`submission.intake`** — virus-scan attachments via Cloudmersive Virus Scan API (chosen over self-hosted ClamAV — no daemon to run, predictable cost). Sets `virusScanStatus`; if `infected` → quarantine the storage object, mark submission `rejected`, alert editor channel. On `clean` → notify editor channel via Slack webhook. **Failure mode:** if the Cloudmersive API is unreachable or returns 5xx, the function retries with backoff up to 5 attempts; after exhaustion, attachment stays `pending` and the submission appears in `/admin` with a banner that scanning is unavailable — editors must not download attachments until scan resolves. Document this and the vendor-replace path in `app/docs/virus-scan.md`.
- **`submission.publish`** — fires when an editor approves a submission; can create a `Case` + `RogueProfile` draft, link source URLs to `NewsArticles`.
- **`gdpr.retention-sweep`** — daily. Runs four passes in order, each as a durable `step.run(...)` so a partial failure resumes from the last completed pass:
  1. **PII purge.** For approved, rejected, and duplicate submissions past their 30-day retention date: delete attachments from the Supabase Storage `submissions` bucket via the storage client, null PII columns, and remove the underlying `SubmissionAttachment` rows. This function is the **sole** authority for submission attachment deletion in the happy path.
  2. **Orphan scan (replaces the previous Storage lifecycle backstop).** List all keys under `submissions/` in the Supabase Storage `submissions` bucket whose `LastModified` is older than 7 days; for each, look up `SubmissionAttachment` by `storageKey`. If no row exists, the object is an orphan (e.g. a presigned upload that the user abandoned, or an extra file beyond the 10-attachment cap that `POST /api/submissions` rejected) and is hard-deleted. The 7-day floor leaves room for in-flight intake jobs to land. **Supabase Storage native lifecycle rules are deliberately *not* configured** on this bucket — a blunt 90-day floor would have deleted attachments out from under a `received`/`in_review` submission whose editor was simply slow, contradicting the no-auto-purge rule in §Trust posture. The DB-aware orphan scan is the correct backstop because it can distinguish "abandoned storage object" from "live submission with stalled editor."
  3. **Stale-state digest.** Count `received` submissions older than 14 days and `in_review` submissions older than 30 days; if either count is non-zero, POST a digest to `SLACK_EDITOR_WEBHOOK` so the alert lands even if no editor logs in to see the `/admin` banner.
  4. **Audit-log retention.** Drop or detach `AuditLog` partitions older than 24 months (see §Data model — partitioned by month); for partitions still in window but older than 24 months at the *row* level (rare boundary case during partition cutover), null `actorEditorId` while preserving `action = 'pii.read'` rows. Bumps a Sentry breadcrumb for visibility.

Outlet adapters live one-per-file in `app/packages/scrapers/src/`: `telex.ts`, `444.ts`, `hvg.ts`, `magyar-hang.ts`, `atlatszo.ts`, with a shared `types.ts`, `parse.ts` (cheerio + readability), and `http.ts` (User-Agent, robots.txt cache, rate-limited fetch wrapper).

**Failure handling.** Inngest retry: exponential backoff, max 5 attempts. On final failure, the run lands in the Inngest failed-runs view (the DLQ-equivalent — there is no per-function DLQ table); Sentry captures the exception; Better Stack alerts on failed-runs / dead-letter-depth > 0 across the registry.

## Frontend rebuild (Next.js — `app/apps/web/app`)

Port `01-tesla/index.html` to App Router pages. Reuse the existing CSS variables and section structure; convert each section to a server component that fetches from the API. Use `Intl.NumberFormat('hu-HU')` and `Intl.DateTimeFormat('hu-HU')` for plain numbers and dates, but **format Hungarian currency magnitudes explicitly** in `packages/shared/format.ts` rather than relying on `notation: 'compact'`: `Intl`'s compact-notation output for HU has shifted between Node ICU versions (`Mrd` vs full word `milliárd`), and the mockup's existing `Math.floor(n / 1e9) + ' Mrd Ft'` pattern is the user-visible convention to preserve. Snapshot-test every magnitude bucket (`Ft`, `e Ft`, `M Ft`, `Mrd Ft`) against fixed inputs so an ICU update can never silently change the display.

**Locale: HU-only by design.** The site ships in Hungarian only (URLs, copy, formatting). No i18n machinery (`next-intl`, message catalogs, locale routing) — adding it later, if ever, is a deliberate decision, not an MVP requirement. All user-facing strings live inline in components.

- `app/page.tsx` — hero, KPI cards, ticker. Server component, fetches `/api/stats`. Renders donut SVGs server-side from `KpiSnapshot.bySector` using helpers ported from `01-tesla/index.html:1971-2189` into `packages/ui/Donut.tsx`.
- `app/galeria/page.tsx` — rogues' gallery. Fetches `/api/cases/top?n=10`. Mugshot SVG generator ported from lines 2296–2372 into `packages/ui/Mugshot.tsx`.
- `app/adatbazis/page.tsx` — interactive database. Client component for the filter UI; uses URL search params as the source of truth so filter state is shareable; calls `/api/cases` with cursor pagination. Replaces lines 1494–1569 + render logic at 2210–2266.
- `app/adatbazis/[id]/page.tsx` — case detail (new — not in mockup).
- `app/hirek/page.tsx` — news grid, paginated. Fetches `/api/news`. Each article is a link to the source — we don't render full bodies.
- `app/bejelentes/page.tsx` — submission form (item 6). Client component using react-hook-form + Zod; renders Turnstile widget; uploads files to Supabase Storage via presigned URLs **before** the JSON POST; ports lines 1632–1771. Form copy must be reviewed against the trust posture above before launch.
- `app/admin/**` — gated by Supabase Auth middleware (session refresh + `Editor` allowlist join + WebAuthn fresh-assertion cookie for `admin` routes); submission review queue, case editor, news manager, audit-log viewer, DSR queue.

**Accessibility.** The mockup is a div soup. The rebuild uses semantic HTML (`<main>`, `<nav>`, `<section>` with proper headings), `<html lang="hu">` set in the root layout, keyboard-navigable filters, visible focus rings, ARIA labels on icon-only buttons, and color contrast verified against WCAG AA. Run `axe` in Playwright tests; CI fails on any serious/critical violation.

**Security headers / CSP.** `app/apps/web/next.config.js` ships an explicit Content-Security-Policy and complementary headers from Phase 2 onward. CSP directives:
- `default-src 'self'`
- `script-src 'self' 'nonce-<runtime>' https://challenges.cloudflare.com` (Turnstile)
- `frame-src https://challenges.cloudflare.com`
- `connect-src 'self' https://*.supabase.co https://*.supabase.in https://challenges.cloudflare.com https://*.ingest.sentry.io`
- `img-src 'self' data: https://*.supabase.co`
- `style-src 'self' 'unsafe-inline'` (review and tighten via nonces in a follow-up release)
- `frame-ancestors 'none'`, `form-action 'self'`, `base-uri 'self'`

Plus `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Content-Type-Options: nosniff`. A header-snapshot test runs in CI against the preview deploy and fails the build on drift.

Footer/methodology (item 7) is **out of scope** — render the footer matching the mockup's visual layout. Every footer link (Adatvédelem, Módszertan, Sajtó, Partnerek, Csapat, CSV/API export, Támogatás) points to a single shared route `/hamarosan` (a static "Hamarosan elérhető" page that lists which pages are coming and roughly when, with a `dpo@korruptometer.hu` contact for Adatvédelem requests in the meantime — the DSR runbook handles those requests via the `app/docs/dsr-runbook.md` workflow). **Live-looking links pointing to 404s are explicitly forbidden** — every visible href resolves. The `/hamarosan` page is the deferred-content stub for item 7; building out individual pages is out of scope for this plan.

## Auth (item 8)

Auth is implemented via **Supabase Auth** (magic-link email built in — no Resend dependency for MVP). The allowlist check happens in `app/apps/web/middleware.ts` and the relevant route handlers by joining the Supabase `auth.users` row to the `Editor` table on `email` and verifying `active = true`; rejected sessions are signed out immediately. WebAuthn is layered on with `@simplewebauthn` (server + browser packages); admin routes call a server action that requires both a valid Supabase session **and** a fresh (≤30 min) passkey assertion stored in a separate signed cookie.

Supabase Auth is configured for **email magic-link only** in MVP. HU journalists frequently lack/avoid GitHub and Google accounts; magic-link is the inclusive default and removes the maintenance cost of two extra providers + per-editor identity linking. OAuth providers (GitHub/Google) are explicitly deferred until an editor asks for them, at which point we re-introduce `EditorIdentity` and the linker UI.

The allowlist gate rejects any user whose email is not in `Editor` with `active = true`. Sessions are Supabase Auth cookies refreshed by the middleware on every request per `@supabase/ssr` patterns; admin route handlers and pages use the server-side Supabase client (`app/apps/web/src/lib/supabase/server.ts`) plus the WebAuthn fresh-assertion cookie to gate access. Roles: `editor` (review submissions, edit news/cases) vs `admin` (also manages editors).

**WebAuthn/passkey step-up for `admin` role (required at Phase 2 launch).** Magic-link alone is too weak for accounts that can manage editor membership and read decrypted reporter PII — email-account compromise must not equal full takeover. Admins register a passkey on first login (Supabase Auth session + the `@simplewebauthn` adapter); admin-gated routes require a fresh passkey assertion (≤ 30 min) before serving. Editors without admin role continue to use magic-link only. Lost-passkey recovery requires a second admin to re-issue from `/admin/editors`; if there is only one admin, recovery is via the bootstrap flow re-running with a fresh `BOOTSTRAP_ADMIN_EMAIL` (documented runbook). Revisit passkeys for the `editor` role if the threat model changes — see §Out of scope.

**Editor bootstrapping.** `packages/db/seed.ts` inserts a single bootstrap admin (email pulled from `BOOTSTRAP_ADMIN_EMAIL`). All subsequent editors are added via `/admin/editors` (admin-only), which writes both the `Editor` row and an audit log entry. The seed is idempotent — re-running it does not duplicate or modify the existing bootstrap row.

## Storage (Supabase Storage)

`packages/shared/storage.ts` wraps the Supabase storage client (`@supabase/supabase-js`). Two buckets:
- `submissions` — private, 10-object cap, 25 MB/object. Uploads use a **presigned POST policy** issued by `createSignedUploadUrl` with a `content-length-range` clause and a `Content-Type` allowlist so size and MIME are enforced by Supabase Storage at upload time — presigned PUT is intentionally not used here, since PUT URLs accept any payload size. URL/policy validity 5 min. Defense in depth: `submission.intake` re-reads the object's `Content-Length` and deletes + rejects any attachment exceeding 25 MB before virus scanning. Deletion in the happy path is performed exclusively by `gdpr.retention-sweep` (the function is the source of truth for `approved`-30d, `rejected`-30d, and `duplicate`-30d paths). **Supabase Storage native lifecycle rules are not configured on this bucket** — see §Inngest functions `gdpr.retention-sweep` pass 2 for why a blunt time-floor would conflict with the no-auto-purge rule for `received`/`in_review` submissions, and how the DB-aware orphan scan replaces it.
- `public-assets` — public-read. Used **only** for editor-uploaded mugshot photos and other editor-published assets. The default rogues' gallery rendering remains the deterministic SVG generator (`packages/ui/Mugshot.tsx`, ported from `01-tesla/index.html:2296-2372`) keyed on `RogueProfile.variant` — every case has an SVG mugshot from seed time onward without any photo upload. `Case.mugshotUrl` is **a nullable opt-in override**: if set, the gallery and case-detail pages render the uploaded image; if null, they fall back to the SVG. The SVG path stays the load-bearing default; uploaded photos are an editorial enhancement, not a Phase 2 launch dependency. Editor upload flow at `/admin/cases/:id/mugshot`: `POST /api/admin/upload-public-url` (admin-gated, audit-logged) returns a presigned POST policy (`content-length-range` ≤ 5 MB, `Content-Type` ∈ {`image/jpeg`, `image/png`, `image/webp`}, response sets `Cache-Control: public, max-age=31536000, immutable`). Object keys are content-hashed (`mugshots/<sha256(file)>.<ext>`) so URLs are immutable and can be cached aggressively at the edge; `Case.mugshotUrl` stores the resulting public URL. CORS on the bucket allows `POST` only from the production origin. Editors upload final-size images — no client-side processing. Clearing the override (DELETE) reverts to the SVG fallback without deleting the storage object (content-hashed keys may be reused across cases).

Submission storage keys are namespaced `submissions/<submissionId>/<uuid>-<filename>` and recorded on `SubmissionAttachment.storageKey`.

## Critical files / paths

- `app/packages/db/schema.ts` — full Drizzle schema (source of truth); `drizzle-kit generate` produces SQL into `app/supabase/migrations/`
- `app/packages/db/seed.ts` — ports `cases` + `rogueProfiles` from `01-tesla/index.html:1955-2282`; seeds `Source` rows. **Mockup line refs are load-bearing in this plan** (seed source-of-truth, donut/mugshot SVG ports, form copy line refs). Per §Decisions item 4, the implementation does `git init` at repo root and tags the mockup state as `mockup-port-base-v1` before any port work; every `01-tesla/index.html:NNNN` reference in this plan resolves against that tag. The live file may continue to evolve as a design playground without invalidating the plan.
- `app/supabase/migrations/0001_init.sql` — includes `CREATE EXTENSION IF NOT EXISTS unaccent`, `pg_trgm`, `pgcrypto`, `pgsodium` (idempotent — Supabase pre-enables most of these but the migration is explicit for parity with self-hosted)
- `app/supabase/config.toml` — output of `supabase init`; pins local Supabase versions and ports
- `app/packages/shared/schemas/` — Zod schemas shared between API + forms
- `app/packages/shared/format.ts` — explicit-magnitude `fmtFt` (Ft / e Ft / M Ft / Mrd Ft, never `Intl` compact notation — see §Frontend rebuild), `Intl`-based `fmtDate`, `fmtSize`, `initials`; snapshot-tested per magnitude bucket. Mockup helpers at `01-tesla/index.html:1983, 2284, 2388` are reference only.
- `app/packages/shared/encryption.ts` — pgcrypto sym-enc helpers for reporter PII
- `app/packages/shared/ratelimit.ts` — Upstash limiter factory
- `app/packages/shared/turnstile.ts` — Cloudflare Turnstile server verifier
- `app/packages/ui/Donut.tsx`, `Mugshot.tsx` — port SVG generators from `01-tesla/index.html:1971, 2296`
- `app/packages/scrapers/src/<outlet>.ts` — one per source
- `app/packages/scrapers/src/http.ts` — robots.txt cache, rate-limited fetch, identifying UA
- `app/apps/web/app/api/**` — route handlers
- `app/apps/web/app/{page,galeria,adatbazis,hirek,bejelentes,admin}/**` — pages
- `app/apps/web/src/lib/supabase/{server,client,service}.ts` — Supabase client factories (RLS-respecting server client, browser client, service-role admin client) per `@supabase/ssr` patterns
- `app/apps/web/middleware.ts` — Supabase session refresh + admin gate
- `app/apps/web/app/api/inngest/route.ts` — Inngest serve handler (registers all functions from `src/inngest/functions/`)
- `app/apps/web/src/inngest/client.ts` — Inngest client; `src/inngest/functions/*.ts` — one file per durable function (`scrape-news`, `aggregate-link-articles`, `aggregate-kpi-rollup`, `submission-intake`, `submission-publish`, `gdpr-retention-sweep`); `src/inngest/index.ts` — function registry
- `app/.env.example` — all env vars, **grouped and labelled by phase**:
  - **Phase 1 (required):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (Supabase session-pooled URL with `?pgbouncer=true&connection_limit=1`), `DIRECT_URL` (direct Supabase URL — migrations only), `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `BOOTSTRAP_ADMIN_EMAIL`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - **Phase 2 (required):** `SUPABASE_STORAGE_BUCKET_SUBMISSIONS` (default `submissions`), `SUPABASE_STORAGE_BUCKET_PUBLIC` (default `public-assets`), `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `PII_ENC_KEY` (used by `pgp_sym_encrypt`), `CLOUDMERSIVE_API_KEY`, `SUBMISSION_RATE_MINUTE`, `SUBMISSION_RATE_DAY`, `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`, `SLACK_EDITOR_WEBHOOK` (clean-scan notifications, virus-scan-unavailable banner, Phase 2 stale-state digest), `BETTER_STACK_TOKEN` (Inngest failed-runs alerts begin once any function exists)
  - **Phase 3 (required):** `LINK_AUTO_THRESHOLD`, `LINK_REVIEW_THRESHOLD` (scraper-aggregator thresholds — only scrape/aggregate functions need them)
  - **Deferred (post-MVP):** `GITHUB_OAUTH_*`, `GOOGLE_OAUTH_*` (only when OAuth providers are reintroduced), libsodium editor pubkey for E2E sealed-box submissions
- `app/docs/log-retention.md` — exact Vercel + Inngest + Better Stack retention settings (≤7 days), audited on each deploy (Phase 2 launch prerequisite)
- `app/docs/virus-scan.md` — Cloudmersive failure-mode runbook + ClamAV migration path
- `app/docs/migrations.md` — destructive migrations playbook: every drop/rename ships in two migrations (forward-compat shim, then drop in a later release) since Drizzle has no automatic rollback
- `app/docs/admin-recovery.md` — **Phase 2 launch prerequisite**, alongside `dsr-runbook.md` and `log-retention.md`. Documents the single-admin passkey-loss recovery path referenced in §Auth: who can redeploy with a fresh `BOOTSTRAP_ADMIN_EMAIL`, how to confirm the new admin's identity out-of-band before the env change, the exact deploy command, the audit-log entry the bootstrap flow writes, and the post-recovery checklist (rotate any other shared secrets that were in scope of the lost device, register a second admin's passkey within 24h to leave single-admin status). Without this runbook, "if there is only one admin, recovery is via the bootstrap flow" is a story, not a procedure.
- `app/docs/dependabot-policy.md` — `pnpm audit --prod` allow-list workflow. CI is configured to block PRs on any **un-allow-listed** high/critical advisory; routine transitive false-positives are added to `app/.audit-allowlist.json` with a required `rationale`, `expires` (max 90 days), and `reviewer` field. Allow-listed entries auto-expire and re-block CI on the expiry date so the list cannot rot indefinitely. Without this policy, "blocking on high/critical" makes CI red for routine dep updates.
- `app/.github/workflows/ci.yml` — typecheck/lint/test/build, `drizzle-kit check` + `supabase db diff` drift check, `pnpm audit --prod` blocking on high/critical (subject to the allow-list policy in `app/docs/dependabot-policy.md`), axe accessibility suite, security-headers snapshot test against the preview deploy, **DB-pool burst smoke test (Phase 1+):** runs `k6 run scripts/cases-burst.js` against the preview deploy and asserts that Postgres connections (read from a `pg_stat_activity` count exposed via a CI-only `/api/_internal/dbstat` endpoint, secret-token-gated and not in production) stay below Supabase's connection ceiling under 100 RPS on `/api/cases`
- `app/.github/dependabot.yml` — weekly pnpm + GitHub Actions updates, grouped per ecosystem; security updates auto-PR'd
- `app/CODEOWNERS` — `/app/supabase/migrations/**` and `/app/packages/db/schema.ts` require explicit review from the migration owner so destructive-migration discipline (the two-step pattern in `app/docs/migrations.md`) is enforced by review, not just by `drizzle-kit check` (which only catches schema/migration drift, not destructive content)
- `app/apps/web/vercel.json` — web deploy config (also serves the Inngest endpoint at `/api/inngest`)
- `app/inngest.json` — Inngest Cloud project config (function registry endpoint URL, signing key reference)

## Verification (end-to-end)

Local dev bootstrap (all phases):
- **First-time setup (run once at project start):** `cd /home/attilah/Coding/corruption-tracker-mockups && git init && cp ~/.gitignore_global_template .gitignore` (or write a fresh `.gitignore` with `node_modules`, `.env*`, `.next/`, `dist/`, `.turbo/`, `app/supabase/.branches/`); commit the three existing mockup directories as the initial commit; then `git tag mockup-port-base-v1`. Per §Decisions item 4, all `01-tesla/index.html:NNNN` line refs in this plan resolve against this tag.
- **Local Supabase:** `cd app && pnpm dlx supabase init` (one-time), then `pnpm dlx supabase start` — boots Postgres + Auth + Storage + Realtime + Studio in Docker. Confirm `unaccent`, `pg_trgm`, `pgcrypto`, `pgsodium` are enabled (the `0001_init.sql` migration enforces this).
- **Connection pooling:** `DATABASE_URL` (Supabase session-pooled URL with `?pgbouncer=true&connection_limit=1`) is used by all Next.js routes — Inngest functions included, since they run within the Vercel deployment. `DIRECT_URL` (Supabase direct endpoint) is used by `drizzle-kit` and `supabase db push` for migrations only. Both URLs are documented in `.env.example` with comments explaining which is for runtime vs migrations.
- **Mockup pin:** confirm `git tag` lists `mockup-port-base-v1` before running `pnpm --filter @korr/db seed` (the seed reads pinned line ranges per §Critical files).
- `pnpm install && pnpm --filter @korr/db migrate && pnpm --filter @korr/db seed`
- **Local Inngest:** `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` (separate terminal) — discovers functions registered at the serve handler.
- `pnpm dev` (Turbo runs the Next.js app on port 3000; no separate worker process to start).
- `pnpm test` (Vitest) and `pnpm typecheck` pass; CI runs `drizzle-kit check` + `supabase db diff` against main on every PR.

### Phase 1 — Read-only public site

1. Open `http://localhost:3000` — hero KPIs, ticker, donut charts render from `/api/stats` (seeded `KpiSnapshot`)
2. `/galeria` — top 10 rogues render with correct mugshot variants from seed data
3. `/adatbazis` — exercise every filter (`q`, `status`, `region`, `sector`, `minAmount`, `minSentenceYears`, `caseYearFrom/To`) and each sort button; result count matches manual SQL spot-checks; cursor pagination stable across `amount_desc` sort with tied amounts
4. `/api/cases?q=…` returns 429 after 60 requests/min from one IP; non-`q` requests stay uncapped
5. Edge cache: `curl -I /api/stats` returns `Cache-Control: public, s-maxage=120…`; cache busts after a manual `KpiSnapshot` upsert + `revalidateTag('stats')`
6. Playwright accessibility pass: `axe` reports zero serious/critical issues on `/`, `/galeria`, `/adatbazis`, `/adatbazis/[id]`
7. Submission, scraper, news, and admin pages are not present (or render an explicit "coming soon" placeholder if linked); footer links all resolve to `/hamarosan` (no 404s)
8. **DB-pool burst test** (also runs in CI per §Critical files): `k6 run scripts/cases-burst.js` for 60 s at 100 RPS against `/api/cases` mixing `q`, filter, and cursor variations; Postgres connections (sampled from `pg_stat_activity`) stay below the configured pool ceiling, p95 latency < 400 ms, error rate 0%

### Phase 2 — Submissions + admin (gated by trust-posture prerequisites)

**Prerequisites (all must be green before launch — see §Trust posture and §Auth):**
- `app/docs/log-retention.md` shows Vercel / Inngest / Better Stack access logs at ≤7 days, audited and signed off
- Form copy matches the §Trust posture text exactly (text reviewed by editorial)
- `PII_ENC_KEY` is in platform secrets only (not in repo, not in CI logs); rotation runbook present and exercised once on staging
- `app/docs/pii-threat-model.md` published; PII-read audit-logging verified end-to-end (every editor render of a decrypted reporter field appears in `AuditLog` with `action = 'pii.read'`)
- Sentry PII scrubbing verified per §Trust posture item 4 — a forced error from `/bejelentes` produces a Sentry event with no body, no IP, no cookies
- Cloudmersive key works against a known-EICAR test file (returns `infected`)
- Bootstrap admin has registered a passkey; admin-gated routes refuse access without a recent (≤30 min) WebAuthn assertion
- Postgres restore drill completed (RPO ≤ 5 min, RTO ≤ 1 h documented)
- Supabase Storage restore drill completed
- `app/docs/dsr-runbook.md` published with intake, identity verification, and fulfillment templates — the GDPR 30-day clock starts at receipt, not at the Phase 3 queue UI launch
- Security-headers snapshot (CSP, HSTS, Permissions-Policy, etc.) matches §Frontend rebuild and is enforced in CI

1. `/bejelentes` — submit a test report with 2 attachments through Turnstile; confirm presigned **POST** upload to Supabase Storage with `content-length-range`, PII columns are non-readable bytea, `submission.intake` Inngest run completed, virus scan returned `clean`, storage keys resolvable from `/admin`
2. Oversized upload: attempt to POST a 30 MB file using a forged 5 MB `content-length-range` policy — Supabase Storage rejects at the edge; separately, force a 26 MB object into the bucket out-of-band — `submission.intake` deletes it and rejects the submission
3. EICAR test attachment → submission auto-rejected, storage object quarantined, editor channel alerted
4. Cloudmersive outage simulation (block egress) → submission stays `pending`, `/admin` banner warns scanning is unavailable, no auto-reject; submission appears in queue with the warning
5. Rate limit: 4 submissions in <1 min from same IP — 4th returns 429; 101st submission in 24h from same IP returns 429; presigned-URL endpoint 31st request/hour returns 429; verified-human cookie doubles both limits as documented
6. Sign in as the bootstrap admin at `/admin`: magic-link arrives, then WebAuthn passkey assertion is required before any admin route serves; tampering with the cookie or skipping the assertion returns 401
7. Render the review queue and open a submission — `AuditLog` rows with `action = 'pii.read'` appear for the editor's email/name field renders
8. Approve the test submission → Case row created, `purgePiiAt = now() + 30d` set, audit log entry written, `aggregate.kpi-rollup` job enqueued (visible in Redis), `KpiSnapshot.computedAt` advances within ~10s, `revalidateTag('stats')` fired
9. Add a second editor through `/admin/editors`; sign in as them with magic-link; confirm role gating (editor cannot manage editors, cannot reach admin-only routes; passkey not required for non-admin paths)
10. Run `gdpr.retention-sweep` manually with system clock advanced 31 days against an approved + rejected + duplicate submission set — confirm PII nulled in approved, all attachments deleted, rejected and duplicate rows purged identically, storage objects gone, audit-log rows for the underlying submissions retained where `action = 'pii.read'`
11. Stale-state alerts: backdate a `received` submission to >14 days untriaged → editor `/admin` banner fires; backdate `in_review` to >30 days → same alert path
12. Forced-error in `/bejelentes` — Sentry event has no body / IP / cookies (Phase 2 trust-posture verification)
13. Security-headers snapshot test passes against the preview deploy
14. **Orphan scan (replaces the previous Storage-lifecycle backstop check):** out-of-band-place a storage object under `submissions/`, backdate its `LastModified` to >7 days ago, ensure no `SubmissionAttachment` row references it, run `gdpr.retention-sweep` manually — the orphan is hard-deleted within the run; a `received` submission whose attachment has a real `SubmissionAttachment` row is **not** touched even if its storage object is older than 7 days (proving the no-auto-purge rule for `received`/`in_review` is preserved); Supabase Storage native lifecycle rules are confirmed not configured on the bucket
15. Stale-state Slack digest: backdate one `received` submission to 15 days and one `in_review` to 31 days, run `gdpr.retention-sweep` manually — `SLACK_EDITOR_WEBHOOK` receives a single digest message listing both buckets
16. Orphan after attachment-cap rejection: presign 11 upload URLs, upload 11 storage objects, then submit a JSON `POST /api/submissions` carrying all 11 in `attachments[]` — request returns 400; the next `gdpr.retention-sweep` reaps the 11 orphans
17. Playwright E2E: submit → approve (with passkey) → case appears on `/adatbazis` end-to-end

### Phase 3 — Scrapers + aggregator + KPI rollup

1. `/hirek` — empty before scrape; renders cards after first run
2. Trigger scraper manually: `pnpm --filter worker run scrape:once -- --source telex` — `NewsArticle` rows appear, no `body` column populated, aggregator links matches with `linkConfidence` honoring `LINK_AUTO_THRESHOLD` / `LINK_REVIEW_THRESHOLD`
3. Editor relinks an article via `PATCH /api/admin/news` → `linkOverridden = true` is set in the same transaction; re-run `aggregate.link-articles` and confirm the editor's `relatedCaseId` value is preserved (the row is skipped)
4. Force a scraper failure (point an outlet to a 500 URL) — `consecutiveFailures` increments; after 5, source auto-disables and editor channel is alerted
5. `aggregate.kpi-rollup` under concurrent Case mutations: spawn 10 parallel approves; `KpiSnapshot.totalDamage` ends consistent with SQL aggregate; advisory lock (`KPI_ROLLUP_LOCK` from `app/packages/db/locks.ts`) observed in `pg_locks`
6. Force a job to exhaust retries → lands in `<queue>.dlq`; Better Stack alert fires; Sentry captures exception
7. `worker.heartbeat` liveness: stop the heartbeat repeatable manually, leave other queues running — `/healthz` flips to 503 within 10 min; restarting the heartbeat returns it to 200; meanwhile force `submission.intake` to silently fail every job and confirm `/healthz` stays 200 (DLQ alert fires instead, per design — health probes are decoupled from real-job success)
8. `axe` accessibility check on `/hirek` and `/admin/scraper-runs`

### Phase 4 — Durable submission encryption (sealed-box)

Goal: the form-copy promise *"A bejelentésedet titkosítva tároljuk és csak a szerkesztőség férhet hozzá"* is backed by cryptography, not by access control on a server-held key. After Phase 4 ships, an attacker with full app-server access can no longer read submission bodies.

1. **Sealed in the browser, opaque on the server.** Submit a `/bejelentes` report; in the resulting `Submission` row, `summary`, `reporterEmailEnc`, and `reporterNameEnc` are libsodium sealed-box ciphertexts addressed to the editor public key in env. Direct DB inspection from a Postgres client (no editor private key in scope) cannot recover any plaintext field; `pgp_sym_encrypt` columns are removed by migration after backfill.
2. **Per-editor unsealing in `/admin`.** Editor logs in (magic-link → passkey if admin), unlocks their private key (held client-side, encrypted at rest by passkey-derived secret) — the review queue renders plaintext as before. The server never sees the private key. An `AuditLog` row with `action = 'pii.read'` is still written client-driven via a signed call so the existing forensic trail is preserved.
3. **Lost-key recovery rejects gracefully.** Simulate an editor losing their device: the submissions sealed only to that editor's public key are unrecoverable by design; `/admin` shows a clear "sealed to a key no current editor holds" state rather than silently 500ing. Document the operational implication: the editor public key must be one a quorum of editors can decrypt (multi-recipient sealed-box envelopes), or sealed to a rotating shared editor key whose private half is held in the team password manager. Plan ships the multi-recipient option; the verification confirms the envelope contains all current editor public keys.
4. **Key rotation replays old envelopes.** Run the rotation worker job (sealing-key list updated, e.g., adding a new editor or removing a departed one): all in-flight `Submission` rows are re-sealed to the new recipient list within one job run; an editor who held a key revoked mid-rotation can no longer decrypt rows that completed re-sealing; an editor added during rotation can decrypt all rows that completed. Job is idempotent and resumable.
5. **Form copy upgrade.** `/bejelentes` copy is updated from the Phase 2 truthful-but-modest text to the original strong promise *"Beérkezésed végpont-titkosítva tároljuk"* (now actually true). Editorial signs off on the change in writing; the change ships in the same release as the migration, not before.
6. **Public threat-model doc.** `app/docs/pii-threat-model.md` is updated to reflect the new control: backend compromise no longer equals a DB-dump radius for submission contents, and the residual risks (compromise of an editor device unlocked at the time of compromise; compromise of the team password manager holding the shared editor key) are stated plainly.
7. **Backout plan tested.** Phase 4 ships behind a per-environment feature flag; flipping the flag off causes new submissions to fall back to Phase 2 `pgp_sym_encrypt` until the issue is resolved. The flag flip is exercised in staging before production rollout.

### Production smoke (per phase, after each deploy)

- Vercel preview URL: phase-relevant endpoints return non-empty 200s; `/healthz` returns 200
- Inngest functions (Phase 3+): scheduled functions registered (`scrape.news`, `aggregate.kpi-rollup`, `gdpr.retention-sweep`, `worker.heartbeat`), recent runs visible in the Inngest dashboard, Sentry init logged from the serve handler, `/healthz` 200
- Phase 2+: real anonymous test submission survives Turnstile + rate limit + virus scan; appears in editor queue
- Phase 3: induced scraper failure trips Better Stack alert after 5 consecutive failures

### Backup, recovery, and migrations

- **Postgres backups:** Supabase PITR enabled, retention 14 days. Target **RPO ≤ 5 minutes, RTO ≤ 1 hour**. Quarterly drill: restore latest snapshot to a staging branch via the Supabase dashboard / `supabase db restore`, run smoke tests, document time-to-restore. First drill is a Phase 2 launch prerequisite.
- **Upstash Redis:** rate-limit-only (Constitution III). Loss of Redis disables rate limiting until it recovers; in-flight Inngest function steps are durable on the Inngest side and resume from their last completed `step.run(...)` without replay.
- **Supabase Storage:** bucket-level snapshots scheduled weekly (Supabase point-in-time storage backups where available, otherwise a server-side copy of `submissions/` to a parallel `submissions-backup-<YYYYWW>` bucket). Quarterly restore drill mirrors the Postgres drill: pick a random submission attachment from the latest backup, restore it to a staging bucket, verify integrity (sha256 matches the DB-recorded hash if stored, else file opens cleanly), and document time-to-restore. The first Storage restore drill is a Phase 2 launch prerequisite alongside the first Postgres drill.
- **Migrations have no automatic rollback.** Destructive migrations (drops, renames, NOT NULL on backfilled columns) follow the two-step pattern in `app/docs/migrations.md`: ship a forward-compat shim first, deploy app changes, then drop in a follow-up migration in the next release. Never combine app-breaking schema changes with code that depends on them in a single PR.

## Out of scope (deferred)

- **Item 7**: footer/methodology pages, public CSV/API export, donations, partners/team/sajtó pages
- SecureDrop integration
- IP-stripping reverse proxy (Cloudflare in front of Vercel stripping IPs at ingress). MVP instead **configures** Vercel/Inngest/Better Stack access-log retention to ≤7 days (Phase 2 launch gate) so the rewritten form copy is truthful.
- OAuth providers (GitHub, Google) for editor sign-in — magic-link only for MVP; reintroduce when an editor asks
- 2FA / passkeys for the `editor` role (magic-link covers MVP threat model for non-admin editors). Phase 2 *requires* WebAuthn passkeys for the `admin` role — see §Auth — so this scope-deferral applies only to non-admin editors; revisit if/when an editor account is compromised or a board requirement appears.
- Mobile native app (the mockup phones are visual; responsive web covers it)
- Self-service DSR portal (manual `dpo@…` mailbox handles requests in MVP, 30-day SLA, queue at `/admin/dsr` arrives in Phase 3+)
- Trend/historical KPI charts — `KpiSnapshot` is single-row by design; introduce a separate `KpiHistory` table only when a sparkline/trend feature is actually scoped
- Hungarian-language stemming via `hunspell_hu` — `simple` + `unaccent` is acceptable for MVP search quality

**Explicitly NOT deferred** (called out because the original plan placed them here): client-side libsodium sealed-box encryption (Phase 4 above) and per-platform log-retention configuration (Phase 2 gate above).
