---
description: "All-phase task list for Korruptométer — Phase 1 read-only public site, Phase 2 submissions + admin, Phase 3 scrapers + aggregator + KPI rollup, Phase 4 durable client-side encryption"
---

# Tasks: Korruptométer — Phases 1–4 (Public Site, Submissions, Editorial Pipeline, Durable Encryption)

**Input**: Design documents from `/specs/001-korruptometer-mvp/`
**Prerequisites**: plan.md (loaded), spec.md (loaded). No `data-model.md`, `contracts/`, or `quickstart.md` files exist; entities and API surface are extracted from plan.md §Data model and §API surface, plus spec.md Phase-2/3/4 §Key Entities.

**Tests**: Tests are explicitly required by the spec across every phase — currency-magnitude snapshot tests (FR-012, SC-005), automated accessibility audits (FR-022, SC-004), security-headers snapshot test (FR-023, FR-059), the DB-pool 100-RPS burst test (SC-002, SC-006, Phase 1 verification step 8), Phase-2 trust-posture verification (SC-014, SC-015, SC-018, SC-019), Phase-3 scrape/aggregate/rollup integration tests (SC-022 through SC-030), and Phase-4 sealed-box / rotation / backout tests (SC-031 through SC-036), plus Playwright E2E flows for each user story.

**Organization**: Tasks are grouped by spec-phase and within that by user story so each story can be implemented and validated independently. The internal "Phase N" headings below are an organizational ordering of waves; they are not the same as the spec.md "Phase 2/3/4" terminology — every section header annotates which spec-phase it belongs to. Story labels run **US1–US4 = spec-Phase-1**, **US5–US9 = spec-Phase-2**, **US10–US14 = spec-Phase-3**, **US15–US19 = spec-Phase-4**. All paths are absolute against the repo root `/home/attilah/Coding/corruption-tracker-mockups/`; the active codebase lives under `app/` per plan.md §Repository layout.

**Story-label mapping**:
- US1 ↔ Browse and filter the case database (P1, spec-Phase-1)
- US2 ↔ Homepage at-a-glance overview (P2, spec-Phase-1)
- US3 ↔ Rogues' gallery (P3, spec-Phase-1)
- US4 ↔ `/hamarosan` deferred-content stub (P3, spec-Phase-1)
- US5 ↔ Anonymous citizen submission (P1, spec-Phase-2 = spec.md US 2.1)
- US6 ↔ Editor review and triage (P1, spec-Phase-2 = spec.md US 2.2)
- US7 ↔ Bootstrap admin + editor onboarding (P2, spec-Phase-2 = spec.md US 2.3)
- US8 ↔ Stale-submission alerts (P2, spec-Phase-2 = spec.md US 2.4)
- US9 ↔ GDPR retention sweep (P1, spec-Phase-2 = spec.md US 2.5)
- US10 ↔ News feed at `/hirek` (P1, spec-Phase-3 = spec.md US 3.1)
- US11 ↔ Article-to-case linking (P2, spec-Phase-3 = spec.md US 3.2)
- US12 ↔ Hourly KPI rollup (P1, spec-Phase-3 = spec.md US 3.3)
- US13 ↔ Scraper observability (P2, spec-Phase-3 = spec.md US 3.4)
- US14 ↔ `/admin/dsr` queue (P3, spec-Phase-3 = spec.md US 3.5)
- US15 ↔ Sealed-box submission encryption (P1, spec-Phase-4 = spec.md US 4.1)
- US16 ↔ Lost-key recovery state (P2, spec-Phase-4 = spec.md US 4.2)
- US17 ↔ Key rotation re-seal (P2, spec-Phase-4 = spec.md US 4.3)
- US18 ↔ Form copy upgrade (P3, spec-Phase-4 = spec.md US 4.4)
- US19 ↔ Backout feature flag (P2, spec-Phase-4 = spec.md US 4.5)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in the same wave)
- **[Story]**: Maps to the user-story phase (US1, US2, US3, US4)
- Every implementation task lists the exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pin the mockup, scaffold the monorepo, wire tooling.

- [ ] T001 Initialize git repo at `/home/attilah/Coding/corruption-tracker-mockups/`, write `.gitignore` (`node_modules/`, `.env*`, `.next/`, `dist/`, `.turbo/`, `app/supabase/.branches/`), commit the three existing mockup directories untouched, then `git tag mockup-port-base-v1` so every `01-tesla/index.html:NNNN` line ref resolves against a stable snapshot (FR-026, plan §Decisions item 4).
- [ ] T002 [P] Create monorepo skeleton: `app/package.json`, `app/pnpm-workspace.yaml` (workspaces for `apps/*` and `packages/*`), `app/turbo.json` (build/lint/test/typecheck pipelines).
- [ ] T003 [P] Scaffold Next.js 15 (App Router, TypeScript, ESM) at `app/apps/web/` with `app/apps/web/package.json` and `app/apps/web/tsconfig.json` extending the shared base.
- [ ] T004 [P] Initialize internal packages `app/packages/db/`, `app/packages/shared/`, `app/packages/ui/` each with `package.json` and `tsconfig.json` extending `app/tsconfig.base.json`.
- [ ] T005 [P] Author `app/.env.example` with Phase-1-required vars grouped + commented per phase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` with `?pgbouncer=true&connection_limit=1`, `DIRECT_URL`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `BOOTSTRAP_ADMIN_EMAIL`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`); add `app/.env.local` to `.gitignore`.
- [ ] T006 [P] Configure ESLint (`app/.eslintrc.cjs`), Prettier (`app/.prettierrc`), TypeScript strict mode (`app/tsconfig.base.json`).
- [ ] T007 [P] Configure Vitest at `app/vitest.config.ts` with workspace test discovery; add `test`/`typecheck` scripts to `app/package.json`.
- [ ] T008 [P] Configure Playwright at `app/apps/web/playwright.config.ts` and install `@axe-core/playwright`; create `app/apps/web/tests/e2e/` directory with a placeholder `smoke.spec.ts`.
- [ ] T009 [P] Run `supabase init` to produce `app/supabase/config.toml`; create empty `app/supabase/migrations/` directory.
- [ ] T010 [P] Add Drizzle Kit config at `app/packages/db/drizzle.config.ts` pointing schema to `app/packages/db/schema.ts` and `out` to `app/supabase/migrations/`; add `db:generate`, `db:push`, `db:check`, `db:seed` scripts to `app/packages/db/package.json`.
- [ ] T011 [P] Create `app/apps/web/vercel.json` with the Next.js build preset (the same project will later host the Inngest endpoint at `/api/inngest`; Phase 1 does not register any functions).
- [ ] T012 [P] Add `app/CODEOWNERS` requiring explicit review on `app/supabase/migrations/**` and `app/packages/db/schema.ts`.
- [ ] T013 [P] Initialize Sentry for Next.js: `app/apps/web/sentry.server.config.ts`, `app/apps/web/sentry.client.config.ts`, `app/apps/web/sentry.edge.config.ts`, and `app/apps/web/instrumentation.ts`, all reading `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` from env.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, formatters, security headers, semantic shell, seed — every user-story phase below depends on these.

**⚠️ CRITICAL**: No US1/US2/US3/US4 work can begin until Phase 2 is complete.

- [ ] T014 Define Drizzle schema for `Case`, `RogueProfile`, `NewsArticle`, `Source`, `KpiSnapshot` (per plan §Data model — Phase-1 tables only) in `app/packages/db/schema.ts`, including enums (`status`, `sector`, `detention`, `tag`), BigInt amount, and the foreign keys required by FR-007/008/009.
- [ ] T015 Generate the initial migration via `pnpm --filter @korr/db db:generate` and edit `app/supabase/migrations/0001_init.sql` to prepend `CREATE EXTENSION IF NOT EXISTS unaccent`, `pg_trgm`, `pgcrypto`, `pgsodium` (idempotent; required by FR-002).
- [ ] T016 Add `app/supabase/migrations/0002_case_search.sql` creating a generated `searchVector` `tsvector` column on `Case` over `unaccent(name || ' ' || position || ' ' || region)` and a GIN index on it (FR-002).
- [ ] T017 Implement Hungarian formatters in `app/packages/shared/format.ts`: `fmtFt` with explicit `Ft` / `e Ft` / `M Ft` / `Mrd Ft` magnitude buckets using `Math.floor(n / 10**k)` (never `Intl` compact notation), `fmtDate` and `fmtNumber` via `Intl.{DateTimeFormat,NumberFormat}('hu-HU')`, plus `initials` (FR-012, FR-013).
- [ ] T018 [P] Add snapshot tests for `fmtFt` covering each magnitude bucket and the boundary inputs (`999 Ft → "999 Ft"`, `1 000 Ft → "1 e Ft"`, `999 999 Ft → "999 e Ft"`, `1 000 000 Ft → "1 M Ft"`, `999 999 999 Ft → "999 M Ft"`, `1 000 000 000 Ft → "1 Mrd Ft"`) in `app/packages/shared/format.test.ts` (FR-012, SC-005).
- [ ] T019 [P] Implement an Upstash rate-limit factory in `app/packages/shared/ratelimit.ts` exposing `qSearchLimiter` (60/IP/min) and `cursorLimiter` (120/IP/min) per `@upstash/ratelimit` (FR-016, FR-017, SC-009).
- [ ] T020 [P] Implement opaque cursor encode/decode in `app/packages/shared/cursor.ts` enforcing the `(sortKey, id)` tuple shape per `sort` value (`amount_desc | amount_asc | year_desc | name_asc`) so tied amounts paginate stably (FR-006, edge case "tied-amount sort stability").
- [ ] T021 [P] Add Supabase client factories for the web app at `app/apps/web/src/lib/supabase/server.ts`, `client.ts`, and `service.ts` per `@supabase/ssr` patterns (anon-key for SSR reads; service-role only inside route handlers and the seed script).
- [ ] T022 [P] Configure security headers + strict CSP in `app/apps/web/next.config.js`: `default-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `base-uri 'self'`, `script-src 'self' 'nonce-<runtime>'`, `connect-src 'self' https://*.ingest.sentry.io`, `img-src 'self' data:`, plus `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Content-Type-Options: nosniff` (FR-023).
- [ ] T023 [P] Add a header-snapshot test in `app/apps/web/tests/e2e/security-headers.spec.ts` that hits each public route and asserts the full required header set + CSP directive list; build fails on drift (FR-023).
- [ ] T024 [P] Author the root layout at `app/apps/web/app/layout.tsx` setting `<html lang="hu">`, semantic landmarks (`<header>`, `<main>`, `<footer>`), a visible-on-focus skip-link to `#fooldal`, and global font/CSS-vars import (FR-014, FR-019, FR-020).
- [ ] T025 [P] Port mockup CSS variables, base typography, focus-ring rules, and the colour palette from `01-tesla/index.html` (at tag `mockup-port-base-v1`) into `app/apps/web/app/globals.css`; ensure visible focus indicators on every interactive element (FR-020).
- [ ] T026 Implement `app/packages/db/seed.ts` porting the 12 cases + their `RogueProfile` rows from `01-tesla/index.html:1955-2282` (pinned tag), seeding the five `Source` rows (Telex / 444 / HVG / Magyar Hang / Átlátszó), inserting the single `KpiSnapshot` row with realistic totals + `bySector` JSON for the donut, and inserting a small set of `NewsArticle` rows linked to a few seeded cases so case-detail can render the article list in Phase 1 (FR-001, FR-009, FR-011, plan §Assumptions).
- [ ] T027 [P] Implement `GET /healthz` route handler in `app/apps/web/app/healthz/route.ts` issuing `SELECT 1` against Postgres, returning 200/503, and `Cache-Control: no-store` (FR-018).

**Checkpoint**: Schema migrated + seed runs locally + formatters snapshot-tested + security headers in place. User-story phases can now begin.

---

## Phase 3: User Story 1 — Browse and filter the corruption-case database (Priority: P1) 🎯 MVP

**Goal**: Citizens, journalists, and researchers can search by name (accent-insensitive), filter by status/region/sector/min-amount/min-sentence/year-range, sort, page through cursor-stable results, and open a case-detail view with rogue profile + linked articles. URL state is the single source of truth.

**Independent Test**: Visit `/adatbazis`, exercise every filter + sort against the 12 seeded cases, confirm result counts match expectations, click into a case and verify the detail page; copy a filtered URL into a fresh browser session and confirm identical state restored.

### Tests for User Story 1

- [ ] T028 [P] [US1] Define Zod schema for `/api/cases` query params (`q`, `status`, `region`, `sector`, `minAmount`, `minSentenceYears`, `caseYearFrom`, `caseYearTo`, `sort`, `limit`, `cursor`) with HU-locale-aware validators in `app/packages/shared/schemas/cases.ts`.
- [ ] T029 [P] [US1] Add Vitest unit tests for cursor stability under tied amounts in `app/packages/shared/cursor.test.ts` (FR-006, edge case "tied-amount sort stability").
- [ ] T030 [P] [US1] Add Playwright E2E `app/apps/web/tests/e2e/case-database.spec.ts` covering: accent-insensitive search ("orban" → "Orbán" and reverse), multi-filter combination, amount-desc sort with tied amounts paging forward and back, URL-share round-trip across browser contexts, case-detail navigation, Hungarian empty-state for zero-result filters (US1 acceptance scenarios 1–6, SC-001, SC-007).
- [ ] T031 [P] [US1] Add axe accessibility test `app/apps/web/tests/e2e/a11y-database.spec.ts` asserting zero serious/critical violations on `/adatbazis` and `/adatbazis/[id]` (FR-022, SC-004).

### Implementation for User Story 1

- [ ] T032 [US1] Implement `GET /api/cases` route handler at `app/apps/web/app/api/cases/route.ts`: parse query via T028 schema; full-text search `searchVector @@ websearch_to_tsquery('simple', unaccent($1))` ranked; tuple-cursor pagination per `sort`; apply `qSearchLimiter` to any request carrying `q`, `cursorLimiter` to any request carrying `cursor`; emit `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` only when both `q` and `cursor` are absent, otherwise `no-store`; reject 429 with a Hungarian message body (FR-002, FR-003, FR-004, FR-005, FR-006, FR-015, FR-016, FR-017, SC-002, SC-009).
- [ ] T033 [P] [US1] Implement `GET /api/cases/[id]` route handler at `app/apps/web/app/api/cases/[id]/route.ts` returning the case row, its 1:1 `RogueProfile`, and any `NewsArticle` rows where `relatedCaseId = :id`, with `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` (FR-007, FR-015).
- [ ] T034 [P] [US1] Implement `GET /api/regions` at `app/apps/web/app/api/regions/route.ts` returning distinct `Case.region` values for the filter dropdown, `Cache-Control: public, s-maxage=3600` (FR-003, FR-015).
- [ ] T035 [US1] Implement the database list page at `app/apps/web/app/adatbazis/page.tsx` (server entry — initial fetch + SSR HTML) and the client filter UI at `app/apps/web/app/adatbazis/case-filters.tsx`: URL search-params as the only filter source, accent-insensitive HU search input, status/region/sector selects, `minAmount` / `minSentenceYears` / `caseYearFrom` / `caseYearTo` inputs, sort select, cursor "load more" button, Hungarian empty-state copy when zero results (FR-002, FR-003, FR-004, FR-005, FR-014, FR-019, US1 acceptance scenarios 1–4, 6).
- [ ] T036 [US1] Implement the case-detail page at `app/apps/web/app/adatbazis/[id]/page.tsx` rendering the case fields with `fmtFt`/`fmtDate`/`fmtNumber`, the rogue profile (`Mugshot` falls back to deterministic SVG when `mugshotUrl` is null — Phase 1 always uses the SVG), detention label, charges list, and a list of linked `NewsArticle` rows (headline + source + publishedAt + outbound link); semantic `<article>` + heading hierarchy (FR-007, FR-014, FR-019, US1 acceptance scenario 5).

**Checkpoint**: User Story 1 fully usable — the database is browsable, filterable, shareable by URL, and case detail pages render with rogue profile + linked articles.

---

## Phase 4: User Story 2 — At-a-glance corruption overview on the homepage (Priority: P2)

**Goal**: First-time visitors land on the homepage and see hero KPIs, sector donut breakdowns, and an honest "frissítve X perccel ezelőtt" freshness label sourced from `KpiSnapshot.computedAt`.

**Independent Test**: Open `/`, confirm the five hero KPIs (total damage, prison years, active cases, new indictments this week, partner count) render non-zero values, donuts visualise the seeded `bySector` JSON, the freshness label is present, and currency uses the Hungarian magnitude convention (`Ft` / `e Ft` / `M Ft` / `Mrd Ft`).

### Tests for User Story 2

- [ ] T037 [P] [US2] Add Playwright E2E `app/apps/web/tests/e2e/home.spec.ts` asserting all five hero KPIs render, donut SVGs are present, the freshness label text matches the relative-time helper, and a sample number formatted as `"850 M Ft"` appears (US2 acceptance scenarios 1–4).
- [ ] T038 [P] [US2] Add axe accessibility test `app/apps/web/tests/e2e/a11y-home.spec.ts` for `/` (FR-022, SC-004).

### Implementation for User Story 2

- [ ] T039 [P] [US2] Port the donut SVG generator from `01-tesla/index.html:1971-2189` (pinned tag) into `app/packages/ui/Donut.tsx` as a deterministic React component taking `{slices: {label, value, color}[]}`.
- [ ] T040 [P] [US2] Implement Hungarian relative-time helper "frissítve X perccel ezelőtt" in `app/packages/shared/relative-time.ts` with snapshot tests in `app/packages/shared/relative-time.test.ts`; document the up-to-2-min cache-lag contract from `s-maxage=120` so the label never overstates freshness (FR-010, SC-008).
- [ ] T041 [US2] Implement `GET /api/stats` route handler at `app/apps/web/app/api/stats/route.ts` returning `{ computedAt, totalDamage, totalPrisonYears, activeCases, newIndictmentsThisWeek, partnerCount, bySector }` from the single-row `KpiSnapshot`, tagged for future `revalidateTag('stats')`, with `Cache-Control: public, s-maxage=120, stale-while-revalidate=600` (FR-009, FR-011, FR-015).
- [ ] T042 [US2] Implement the homepage at `app/apps/web/app/page.tsx` as a server component fetching `/api/stats`: hero KPI cards using `fmtFt` + `fmtNumber`, sector donut grid using `Donut.tsx`, recent-activity ticker, and the freshness label using T040 (FR-009, FR-010, FR-014, FR-019, US2 acceptance scenarios 1–4).

**Checkpoint**: Homepage renders the hero overview from real DB data — independently shippable on top of Phase 2 even without US1's database UI.

---

## Phase 5: User Story 3 — Rogues' gallery of top offenders (Priority: P3)

**Goal**: `/galeria` shows the top 10 cases by amount with deterministic SVG mugshots, charges, and detention labels.

**Independent Test**: Open `/galeria`; confirm exactly 10 cards render in amount-desc order, each card's mugshot is the deterministic SVG keyed to its `RogueProfile.variant`, and detention labels match the mockup convention.

### Tests for User Story 3

- [ ] T043 [P] [US3] Add Playwright E2E + axe in `app/apps/web/tests/e2e/galeria.spec.ts` covering top-N ordering, deterministic mugshot rendering across two reloads (same DOM), detention-label text, and zero serious/critical axe violations (US3 acceptance scenarios 1–3, FR-022).

### Implementation for User Story 3

- [ ] T044 [P] [US3] Port the deterministic mugshot SVG generator from `01-tesla/index.html:2296-2372` (pinned tag) into `app/packages/ui/Mugshot.tsx` keyed on `RogueProfile.variant` (and the optional `glasses` / `hair` attrs); same input must always produce the identical SVG (FR-008).
- [ ] T045 [US3] Implement `GET /api/cases/top` at `app/apps/web/app/api/cases/top/route.ts` accepting `n` (default 10, max 50), server-sorted by `amount` desc, joined with `RogueProfile`, `Cache-Control: public, s-maxage=300, stale-while-revalidate=900` (FR-008, FR-015).
- [ ] T046 [US3] Implement the gallery page at `app/apps/web/app/galeria/page.tsx` as a server component fetching `/api/cases/top?n=10` and rendering rogue cards with `Mugshot.tsx`, charges, and detention label per the mockup style (FR-008, FR-014, FR-019, US3 acceptance scenarios 1–3).

**Checkpoint**: Wall-of-shame view shippable independently of US1's filter UI.

---

## Phase 6: User Story 4 — Deferred-content stub for unbuilt pages (Priority: P3)

**Goal**: Every visible footer link resolves to either a real page or the shared `/hamarosan` "Hamarosan elérhető" stub; no 404s.

**Independent Test**: From any public page, click every visible footer link in the deferred-content set (Adatvédelem, Módszertan, Sajtó, Partnerek, Csapat, CSV/API export, Támogatás); each returns 200 with the stub content and a `dpo@korruptometer.hu` mailbox.

### Tests for User Story 4

- [ ] T047 [P] [US4] Add Playwright crawl `app/apps/web/tests/e2e/footer-links.spec.ts` that visits each public page (`/`, `/galeria`, `/adatbazis`, `/adatbazis/[id]`, `/hamarosan`) and asserts every visible footer `<a href>` returns HTTP 200 (US4 acceptance scenario 1, SC-003, FR-024, edge case "footer-link drift").

### Implementation for User Story 4

- [ ] T048 [P] [US4] Implement the shared site footer at `app/packages/ui/site-footer.tsx` listing the seven deferred-content links, all pointing to `/hamarosan` (FR-024).
- [ ] T049 [US4] Implement the `/hamarosan` stub at `app/apps/web/app/hamarosan/page.tsx` listing forthcoming pages (Adatvédelem, Módszertan, Sajtó, Partnerek, Csapat, CSV/API export, Támogatás), the explanatory copy in Hungarian, and the `dpo@korruptometer.hu` contact for data-privacy enquiries (FR-024, FR-025, US4 acceptance scenario 2).
- [ ] T050 [US4] Wire `SiteFooter` into the root layout at `app/apps/web/app/layout.tsx` so every public page renders it (FR-024).

**Checkpoint**: All four user stories independently functional. Phase 1 is feature-complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Performance proof, accessibility & security gates, CI plumbing, helpers used across stories.

- [ ] T051 [P] Add k6 burst script `app/scripts/cases-burst.js` driving 60 s of 100 RPS against `/api/cases` mixing `q=`, filter, and cursor traffic; assert p95 latency < 400 ms and 0% error rate (SC-002, SC-006, Phase 1 verification step 8).
- [ ] T052 [P] Add CI-only Postgres-stat endpoint at `app/apps/web/app/api/_internal/dbstat/route.ts`, gated behind `process.env.CI_DBSTAT_TOKEN` and refusing to serve when `process.env.VERCEL_ENV === 'production'`, exposing `pg_stat_activity` count for the k6 burst test to assert against (SC-006, plan §Critical files).
- [ ] T053 [P] Wire `revalidateTag('stats')` behind a signed internal endpoint at `app/apps/web/app/api/_internal/revalidate/route.ts` (HMAC-token-gated) so future Phase-3 KPI rollups can bust the homepage cache; Phase 1 calls it manually after a `KpiSnapshot` upsert (FR-011).
- [ ] T054 [P] Author CI workflow at `app/.github/workflows/ci.yml`: typecheck, lint, vitest (incl. format snapshot tests), build, `drizzle-kit check`, `supabase db diff`, axe Playwright suite, security-headers snapshot, k6 burst smoke (SC-002, SC-004, SC-006, FR-022, FR-023).
- [ ] T055 [P] Add unit tests for the rate-limit factory in `app/packages/shared/ratelimit.test.ts` asserting the 60/min `q=` limit and 120/min cursor limit return 429-shaped responses on the 61st / 121st call respectively (FR-016, FR-017, SC-009).
- [ ] T056 [P] Add Playwright "share-the-URL" test `app/apps/web/tests/e2e/url-share.spec.ts` opening a generated filtered URL in a fresh browser context and asserting an identical view on first load (SC-007).
- [ ] T057 [P] Configure axe colour-contrast rule + WCAG-AA tagset in `app/apps/web/tests/e2e/axe-config.ts` and reuse it across every a11y spec so the CI gate enforces FR-021 / SC-004 for `/`, `/galeria`, `/adatbazis`, `/adatbazis/[id]`, `/hamarosan`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1, T001–T013)**: T001 (git tag) blocks every subsequent task that reads pinned mockup line refs (T026, T039, T044). T002–T013 can otherwise run in parallel after T001.
- **Foundational (Phase 2, T014–T027)**: Depends on Setup. T014 → T015 → T016 are sequential (schema before migration before search index). T026 (seed) requires T014, T015, T016 plus T001. Everything else within Phase 2 is parallelizable across distinct files.
- **User Stories (Phases 3–6)**: All depend only on Phase 2 completion. They can be implemented in parallel by different developers; sequential priority order is P1 → P2 → P3.
- **Polish (Phase 7)**: T054 (CI workflow) is best done last so it gates real artefacts; other Phase 7 tasks can run in parallel and overlap user-story work.

### User Story Dependencies

- **US1 (P1)**: Independent. Requires Phase 2 (`Case` schema + `searchVector` + cursor + ratelimit + format helpers).
- **US2 (P2)**: Independent. Requires Phase 2 (`KpiSnapshot` seed + format helpers).
- **US3 (P3)**: Independent. Requires Phase 2 (`Case` + `RogueProfile` schema + seed).
- **US4 (P3)**: Independent of the other stories' code paths but the footer it owns is rendered by every other page; if shipped first the deferred-content links are immediately live, if shipped last the footer is added in T050 with no other changes required.

### Within Each User Story

- Schemas and tests can land alongside or before implementation.
- API route → page consumer is the one hard ordering inside each story (e.g. T032 before T035 in US1).

### Parallel Opportunities

- All Setup tasks marked `[P]` can run in parallel after T001.
- Phase 2: T017–T027 (excluding the schema chain T014→T015→T016 and the seed T026) all touch distinct files and are parallelizable.
- Once Phase 2 finishes, US1, US2, US3, and US4 phases can be picked up by separate developers in parallel.
- Within each user story, every `[P]`-marked task targets a distinct file.

---

## Parallel Example: User Story 1

```bash
# After Phase 2 is green, kick US1 off in parallel:
Task T028 [US1]: "Define Zod schema for /api/cases in app/packages/shared/schemas/cases.ts"
Task T029 [US1]: "Cursor-stability unit tests in app/packages/shared/cursor.test.ts"
Task T030 [US1]: "Playwright E2E in app/apps/web/tests/e2e/case-database.spec.ts"
Task T031 [US1]: "axe a11y test in app/apps/web/tests/e2e/a11y-database.spec.ts"

# Then implementation (T032 must land before T035 since the page consumes the API):
Task T032 [US1]: "GET /api/cases route handler in app/apps/web/app/api/cases/route.ts"
Task T033 [US1] [P]: "GET /api/cases/[id] in app/apps/web/app/api/cases/[id]/route.ts"
Task T034 [US1] [P]: "GET /api/regions in app/apps/web/app/api/regions/route.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational — **blocks all stories**.
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Run T030 (E2E) + T031 (a11y) + T023 (security headers) against the preview deploy.
5. Ship — the database is the journalistic centre of the product per spec.md "If only this story shipped, the site would already deliver its core mission."

### Incremental Delivery

1. Phase 1 + Phase 2 → foundation green.
2. + US1 → MVP ship (filterable database with case detail).
3. + US2 → homepage hero adds emotional first impression.
4. + US3 → gallery for shareable engagement.
5. + US4 → footer credibility (no broken links) — small, can also ship at any earlier point alongside US1.
6. + Phase 7 polish → CI gates harden, k6 proves SC-002 / SC-006.

### Parallel Team Strategy

- One developer owns Phase 1 + Phase 2 end-to-end (a single chain — schema, migration, formatters, seed).
- Once Phase 2 lands, four developers can pick up US1, US2, US3, US4 in parallel.
- A fifth developer authors Phase 7 (CI workflow, k6 script, axe config) overlapping US work — these touch only `app/.github/`, `app/scripts/`, `app/apps/web/tests/e2e/axe-config.ts`, etc.

---

## Out-of-Scope Reminder

Per spec.md "Out of Scope" and plan.md §Build phasing, the following are **not** in this task list and will be handled by future feature specs:

- Public submission intake (`/bejelentes`) — Phase 2 of plan.md.
- Editor admin UI / `/admin/**` — Phase 2.
- News scrapers + article-to-case aggregator + KPI rollup worker + `/hirek` page — Phase 3.
- Durable client-side libsodium sealed-box encryption — Phase 4.
- Footer/methodology static pages, public CSV/API export, donations — covered for Phase 1 by the `/hamarosan` stub in US4.

---

## Notes

- Every PASS in the validation chain (lint → typecheck → vitest → build → Playwright/axe → k6 burst) needs evidence per `~/.claude/CLAUDE.md` Honesty Protocol. "UI exists" is not "PASS"; only direct verification against the running preview is.
- All `01-tesla/index.html:NNNN` references resolve against the `mockup-port-base-v1` git tag created in T001. Live edits to the mockup file thereafter do not invalidate the plan.
- Currency-magnitude formatter must never delegate to `Intl.NumberFormat` `notation: 'compact'`; the `Math.floor(n / 10**k)` ladder is the contract per FR-012 and is guarded by T018's snapshot tests.
- HU-only by design: no i18n machinery, no locale routing, no message catalogues (FR-014).

---

## Phase 8: Spec-Phase-2 Foundational (Submissions + Editorial Admin)

**Purpose**: Schema additions, secrets, env vars, helpers, security-header upgrades, Inngest wiring, and operational docs that every Phase-2 user story depends on. Spec-Phase-2 launch is **gated** by §Trust posture prerequisites — those gates land in Phase 14 below.

**⚠️ CRITICAL**: No US5/US6/US7/US8/US9 work can begin until Phase 8 is complete; spec-Phase-2 cannot ship until Phase 14 launch gates are all green.

- [ ] T058 Extend Drizzle schema for `Submission`, `SubmissionAttachment`, `Editor`, `AuditLog`, with enums (submission `status`, virus-scan `status`, editor `role`) in `app/packages/db/schema.ts`; mark PII columns as `bytea` and the `AuditLog` table as range-partitioned by month on `at` (FR-033, FR-049, FR-052, FR-054, plan §Data model).
- [ ] T059 Generate the Phase-2 migration via `pnpm --filter @korr/db db:generate` and edit `app/supabase/migrations/0003_submissions_admin.sql` to add the new tables, the `AuditLog` monthly partitioning DDL (parent + first-month partition + a 12-month materialised partitions block), the indexes (`(actorEditorId, at desc)`, `(entityType, entityId, at desc)`, partial on `action='pii.read'`), and `purgePiiAt` defaulting NULL (FR-052, FR-054, plan §Data model).
- [ ] T060 [P] Add a partition-maintenance Inngest scheduled function `app/apps/web/src/inngest/functions/auditlog-partition-maintenance.ts` that creates next month's `AuditLog` partition on the 25th of each month (FR-052, plan §Data model — partitioned by month).
- [ ] T061 [P] Append spec-Phase-2 env vars to `app/.env.example` under a labelled `# Phase 2 (required)` block: `SUPABASE_STORAGE_BUCKET_SUBMISSIONS`, `SUPABASE_STORAGE_BUCKET_PUBLIC`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `PII_ENC_KEY`, `CLOUDMERSIVE_API_KEY`, `SUBMISSION_RATE_MINUTE`, `SUBMISSION_RATE_DAY`, `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`, `SLACK_EDITOR_WEBHOOK`, `BETTER_STACK_TOKEN` (plan §Critical files).
- [ ] T062 [P] Implement PII enc/dec helpers using `pgp_sym_encrypt` / `pgp_sym_decrypt` against `PII_ENC_KEY` in `app/packages/shared/encryption.ts`; refuse to start if the env var is unset (FR-033, plan §Critical files).
- [ ] T063 [P] Implement Cloudflare Turnstile server verifier in `app/packages/shared/turnstile.ts` posting to the `siteverify` endpoint and surfacing structured failures (FR-028).
- [ ] T064 [P] Extend the rate-limit factory in `app/packages/shared/ratelimit.ts` with `submissionMinuteLimiter` (default 3/IP/min) and `submissionDayLimiter` (default 100/IP/day), both tunable via `SUBMISSION_RATE_MINUTE` / `SUBMISSION_RATE_DAY`, plus `presignLimiter` (30/IP/hour); add a `verified-human cookie doubles both caps` flag-aware variant (FR-031, FR-032, SC-012).
- [ ] T065 [P] Implement Supabase Storage helpers in `app/packages/shared/storage.ts`: `createSubmissionUploadUrl` (signed POST policy, `Content-Type` allowlist, `content-length-range` 0..25 MB, 5 min validity), `createSignedDownloadUrl`, `deleteObject`, and `listOrphans(prefix, olderThanDays)`; document the deliberate "no Supabase Storage native lifecycle rules — orphan scan in `gdpr.retention-sweep` is the backstop" choice in a header comment (FR-029, plan §Storage).
- [ ] T066 [P] Implement Slack-webhook helper in `app/packages/shared/slack.ts` posting digests to `SLACK_EDITOR_WEBHOOK`; surface failures to Sentry but never throw on the request path (FR-052, US 2.4 / US 2.5 acceptance).
- [ ] T067 [P] Implement Cloudmersive virus-scan client in `app/packages/shared/virus-scan.ts` with retry-with-backoff up to 5 attempts; expose `scanObject(bucket, key)` returning `{status: 'clean'|'infected'|'pending'|'error', detail?}` (FR-034, FR-035).
- [ ] T068 Author Supabase Auth wiring in `app/apps/web/middleware.ts`: refresh sessions per `@supabase/ssr`, gate `/admin/**` by joining `auth.users.email` to the `Editor` allowlist with `active = true`, and reject otherwise with a clear "your email is not on the editor allowlist" page (FR-040).
- [ ] T069 [P] Implement WebAuthn passkey registration + assertion server endpoints under `app/apps/web/app/api/admin/webauthn/{register,assert}/route.ts` using `@simplewebauthn/server`; persist credentials on the `Editor` row (or a sibling `EditorCredential` table — choose at implementation and reflect in `0003_submissions_admin.sql`); set a fresh-assertion cookie valid ≤ 30 min (FR-041, plan §Auth).
- [ ] T070 [P] Implement WebAuthn client UI at `app/apps/web/app/admin/security/passkey/page.tsx` for first-login passkey enrolment + step-up assertion (FR-041).
- [ ] T071 [P] Implement Sentry PII-scrubbing config: edit `app/apps/web/sentry.server.config.ts`, `sentry.edge.config.ts`, `sentry.client.config.ts` to set `sendDefaultPii: false`, install a `beforeSend` hook that drops `event.request.data`, `event.request.cookies`, and any header matching `/email|name|reporter|ip|x-forwarded/i`, plus the equivalent `beforeSendTransaction` (FR-038, SC-014).
- [ ] T072 [P] Add a Playwright forced-error verification at `app/apps/web/tests/e2e/sentry-pii-scrub.spec.ts` that hits a `/bejelentes` test endpoint which always 500s, captures the resulting Sentry event id via the SDK's `lastEventId()`, fetches the event from Sentry's API, and asserts body / IP / cookies / matching headers are absent (FR-038, SC-014).
- [ ] T073 Update CSP in `app/apps/web/next.config.js` for spec-Phase-2: `script-src 'self' 'nonce-<runtime>' https://challenges.cloudflare.com`, `frame-src https://challenges.cloudflare.com`, `connect-src 'self' https://*.supabase.co https://*.supabase.in https://challenges.cloudflare.com https://*.ingest.sentry.io`, `img-src 'self' data: https://*.supabase.co`; update the header-snapshot test in `app/apps/web/tests/e2e/security-headers.spec.ts` to assert the new directive set (FR-059, plan §Frontend rebuild).
- [ ] T074 [P] Implement Inngest client at `app/apps/web/src/inngest/client.ts`, the serve handler at `app/apps/web/app/api/inngest/route.ts`, and the function registry at `app/apps/web/src/inngest/index.ts`; wire `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` from env (plan §Decisions item 2, §Critical files).
- [ ] T075 [P] Author `app/docs/log-retention.md` documenting the exact Vercel project log retention setting (≤7 days), the Inngest function-run log retention setting (≤7 days), the Better Stack rolling-delete policy, and the audit step at every deploy. The deploy-time assertion script in T133 reads each platform's setting and fails CI on drift (FR-037, SC-019, Constitution Principle I, plan §Trust posture item 2).
- [ ] T076 [P] Author `app/docs/dsr-runbook.md` covering DSR intake at `dpo@korruptometer.hu`, identity verification template, fulfillment templates, audit-log entries to write, and the 30-day SLA (FR-055, plan §Trust posture, US 2.5 launch gate).
- [ ] T077 [P] Author `app/docs/admin-recovery.md` documenting the single-admin passkey-loss recovery path: out-of-band identity verification, fresh `BOOTSTRAP_ADMIN_EMAIL` redeploy command, the audit-log entry the bootstrap flow writes, post-recovery checklist (rotate shared secrets in scope, register a second admin's passkey within 24h) (FR-044, plan §Auth).
- [ ] T078 [P] Author `app/docs/pii-threat-model.md` stating plainly that the symmetric-key control defends only against offline-backup leaks where the key is held separately, NOT against an attacker with app-server access; flag spec-Phase-4 sealed-box as the durable answer (FR-058, plan §Trust posture item 3).
- [ ] T079 [P] Author `app/docs/virus-scan.md` covering the Cloudmersive failure-mode runbook (retry budget, pending-scan UX, vendor-replace path to ClamAV) (FR-035, plan §Worker `submission.intake`).
- [ ] T080 [P] Author `app/docs/migrations.md` documenting the destructive-migrations playbook (forward-compat shim, then drop in a follow-up release; never combine app-breaking schema with consumer code in a single PR) (plan §Backup, recovery, and migrations).
- [ ] T081 [P] Author `app/docs/dependabot-policy.md` and `app/.audit-allowlist.json` (empty allowlist with schema reference); document `pnpm audit --prod` workflow with `rationale`, `expires` (≤90 days), `reviewer` fields and auto-expiry re-blocking (plan §Critical files).

**Checkpoint**: Phase-2 schema migrated, env vars documented, all helpers exported, CSP refreshed, runbooks published. User stories US5–US9 can now begin.

---

## Phase 9: User Story 5 — Anonymous citizen submits a corruption tip (Priority: P1)

**Goal**: A citizen can complete `/bejelentes` end-to-end (Turnstile pass → presigned uploads → JSON POST → reference shown) and the row lands with PII encrypted, attachments virus-scanned, and the form copy honestly describing what is and isn't retained.

**Independent Test**: From a clean browser session, submit a test report with two attachments through the live form; confirm a `KM-NEW-XXXXXX` reference is returned, the report appears in `/admin` with attachments downloadable post-scan, the form copy on screen matches the §Trust posture text exactly, no IP address has been written to the database, the reporter PII columns are unreadable bytea, and a 4th submission within 60 seconds returns 429.

### Tests for User Story 5

- [ ] T082 [P] [US5] Define Zod schema for the submission body in `app/packages/shared/schemas/submission.ts`: structured fields (suspect name, optional position/region/period, crimes list, optional estimated amount), free-text summary, optional source URLs, anonymity flag, allow-contact flag, attachments array length 0..10 (FR-027, FR-030).
- [ ] T083 [P] [US5] Add Vitest coverage for the rate-limit envelope in `app/packages/shared/ratelimit.test.ts` asserting 4th submission/min and 101st submission/day return 429-shaped responses, presign endpoint 31st/hour returns 429, and the verified-human cookie doubles both caps (FR-031, FR-032, SC-012).
- [ ] T084 [P] [US5] Add Playwright E2E `app/apps/web/tests/e2e/submission-happy-path.spec.ts` covering the entire flow: render `/bejelentes`, mock-pass Turnstile, attach two valid files, submit, assert `KM-NEW-XXXXXX` displayed, then assert via API that the row exists, PII columns are bytea, no IP recorded; runs against a Supabase staging URL with a known Turnstile test secret (US 5 acceptance scenarios 1, 2, 6, 7, 9; SC-010, SC-011).
- [ ] T085 [P] [US5] Add Playwright spec `app/apps/web/tests/e2e/submission-attachment-cap.spec.ts` that presigns 11 upload URLs, uploads 11 storage objects, then POSTs `/api/submissions` with all 11 in `attachments[]`; assert HTTP 400 and assert next retention sweep run reaps the orphans (US 5 acceptance scenario 3, FR-030, edge case "Attachment-cap bypass").
- [ ] T086 [P] [US5] Add Playwright spec `app/apps/web/tests/e2e/submission-eicar.spec.ts` that uploads a known EICAR test file, runs `submission.intake` synchronously via an Inngest test runner, and asserts the storage object is quarantined, the submission is `rejected`, and the editor channel webhook fired (US 5 acceptance scenario 5, FR-034, SC-013).
- [ ] T087 [P] [US5] Add Playwright spec `app/apps/web/tests/e2e/submission-form-copy.spec.ts` snapshot-asserting the trust-posture text appears verbatim on `/bejelentes` (US 5 acceptance scenario 8, FR-036).
- [ ] T088 [P] [US5] Add axe accessibility test `app/apps/web/tests/e2e/a11y-bejelentes.spec.ts` for `/bejelentes` (FR-022, SC-004).

### Implementation for User Story 5

- [ ] T089 [US5] Implement `POST /api/submissions/upload-url` route at `app/apps/web/app/api/submissions/upload-url/route.ts`: Turnstile-gate via T063, apply `presignLimiter`, return a signed POST policy from `createSubmissionUploadUrl` per file with strict `Content-Type` allowlist + `content-length-range` (FR-028, FR-029, FR-032).
- [ ] T090 [US5] Implement `POST /api/submissions` route at `app/apps/web/app/api/submissions/route.ts`: Turnstile-gate, apply `submissionMinuteLimiter` and `submissionDayLimiter` (with verified-human-cookie awareness), Zod-validate via T082, reject with 400 when `attachments.length > 10`, write `Submission` row (PII columns encrypted via T062), write `SubmissionAttachment` rows, generate `ref = KM-NEW-XXXXXX`, enqueue an Inngest `submission.intake` event, return `{ref}` (FR-027, FR-028, FR-030, FR-031, FR-033, FR-039).
- [ ] T091 [P] [US5] Implement the `submission.intake` Inngest function at `app/apps/web/src/inngest/functions/submission-intake.ts`: per attachment call T067 virus-scan; on `infected` quarantine the storage object, mark `Submission.status = 'rejected'`, post Slack alert; on `clean` post a Slack notification; on persistent vendor outage leave attachments `pending` and surface a banner via DB-flag (FR-034, FR-035, plan §Worker `submission.intake`).
- [ ] T092 [P] [US5] Implement defense-in-depth oversize check in `submission.intake`: re-read each attachment's `Content-Length` from Storage HEAD, delete + reject any object > 25 MB before scanning; cover with a Vitest test in `app/apps/web/src/inngest/functions/submission-intake.test.ts` (US 5 edge case "Forged content-length range", plan §Storage).
- [ ] T093 [US5] Build the `/bejelentes` page at `app/apps/web/app/bejelentes/page.tsx` (server) + client form at `app/apps/web/app/bejelentes/submission-form.tsx` using `react-hook-form` + Zod, render Cloudflare Turnstile widget, upload files via presigned POST policy **before** the JSON POST, then call `POST /api/submissions`; on success render the `KM-NEW-XXXXXX` reference and a "save this number" panel (FR-027, FR-039, US 5 acceptance scenarios 1, 2, 8).
- [ ] T094 [P] [US5] Render the trust-posture text verbatim in `app/apps/web/app/bejelentes/trust-copy.tsx` and pin it via the snapshot test from T087; the component is the single source of truth for this string in the UI (FR-036, US 5 acceptance scenario 8).

**Checkpoint**: Public submission flow shippable end-to-end, gated by Phase 14 launch gates.

---

## Phase 10: User Story 6 — Editor reviews and triages submissions (Priority: P1)

**Goal**: An allowlisted editor signs in with magic link, satisfies WebAuthn step-up where their role requires it, opens a submission, sees decrypted PII (with audit-log written), and chooses approve / reject / mark duplicate.

**Independent Test**: As the bootstrap admin, sign in with magic link, satisfy WebAuthn passkey step-up, render the queue, open a submission and confirm a `pii.read` audit row was written, approve it, confirm a `Case` + `RogueProfile` are created, `Submission.status = 'approved'`, `purgePiiAt = now() + 30d`, and a KPI rollup is enqueued.

### Tests for User Story 6

- [ ] T095 [P] [US6] Add Playwright E2E `app/apps/web/tests/e2e/admin-review-queue.spec.ts` covering: magic-link sign-in, WebAuthn step-up, render queue, open submission (assert `pii.read` audit-log row appears), approve → Case row appears, reject → `purgePiiAt` set, mark duplicate → `createdCaseId` linked (US 6 acceptance scenarios 1, 3–6).
- [ ] T096 [P] [US6] Add Vitest integration test `app/apps/web/src/lib/admin/pii-audit.test.ts` proving 100% coverage: every code path that decrypts reporter PII for editor-rendering writes an `AuditLog` row with `action = 'pii.read'`, `entityType = 'Submission'`, `entityId`, and `actorEditorId` (FR-049, SC-015).
- [ ] T097 [P] [US6] Add Playwright spec `app/apps/web/tests/e2e/admin-role-gating.spec.ts` asserting `editor`-only sessions get HTTP 403 on admin-only routes and HTTP 401 on admin-gated routes lacking a fresh passkey assertion (US 6 acceptance scenarios 7, 8; FR-041, FR-042; SC-018).
- [ ] T098 [P] [US6] Add axe accessibility test `app/apps/web/tests/e2e/a11y-admin-queue.spec.ts` for `/admin` (FR-022, SC-004).

### Implementation for User Story 6

- [ ] T099 [US6] Implement `GET /api/admin/submissions` at `app/apps/web/app/api/admin/submissions/route.ts`: Supabase-session-gated, allowlist-checked, role-aware filters + pagination, returns ciphertext columns to client (decryption lives server-side only when an editor explicitly opens a row in T100) (FR-040, FR-045).
- [ ] T100 [US6] Implement `GET /api/admin/submissions/[id]` route at `app/apps/web/app/api/admin/submissions/[id]/route.ts` returning the submission with decrypted PII via T062; **the SAME handler writes the `pii.read` `AuditLog` row in the same transaction** as the decrypt; reject with 401 if WebAuthn step-up is missing (FR-041, FR-049, SC-015).
- [ ] T101 [US6] Implement `PATCH /api/admin/submissions/[id]` at the same path: actions `approve`, `reject`, `duplicate` (with `caseId`); approve creates `Case` + `RogueProfile`, sets `purgePiiAt = now() + 30d`, writes audit-log entry, enqueues `aggregate.kpi-rollup` Inngest event; reject sets `status = 'rejected'` + `purgePiiAt`; duplicate sets `status = 'duplicate'` + `createdCaseId` and applies the same retention path as reject (FR-046, FR-047, FR-048, FR-050).
- [ ] T102 [P] [US6] Implement `submission.publish` Inngest function at `app/apps/web/src/inngest/functions/submission-publish.ts` triggered by approve to optionally finalise the new Case + RogueProfile draft fields the editor approved (plan §Worker `submission.publish`).
- [ ] T103 [US6] Build the admin layout at `app/apps/web/app/admin/layout.tsx`: applies the middleware allowlist gate, requires fresh WebAuthn assertion for `admin` role, surfaces a banner when virus-scan provider is unavailable (FR-035, FR-040, FR-041, FR-042).
- [ ] T104 [P] [US6] Build the magic-link sign-in page at `app/apps/web/app/admin/login/page.tsx` using Supabase Auth's email magic link; reject non-allowlisted emails with the documented HU message (FR-040, US 6 acceptance scenario 2).
- [ ] T105 [US6] Build the admin queue page at `app/apps/web/app/admin/page.tsx` (server) + queue UI at `app/apps/web/app/admin/queue/queue-list.tsx`: list submissions with filters, open-submission drawer fetches `GET /api/admin/submissions/[id]` (which writes the `pii.read` audit row), action buttons call `PATCH /api/admin/submissions/[id]` (FR-045, US 6 acceptance scenarios 1, 3–6).
- [ ] T106 [P] [US6] Render an explicit "PII has been purged per retention policy" state in the queue when a submission's PII columns are NULL but `pii.read` audit rows still exist (US 6 edge case "Editor reads a `pii.read`-purged submission").

**Checkpoint**: Editorial workflow shippable.

---

## Phase 11: User Story 7 — Bootstrap admin and editor onboarding (Priority: P2)

**Goal**: Seed creates exactly one admin idempotently from `BOOTSTRAP_ADMIN_EMAIL`; admin can invite editors via `/admin/editors`; new editors reach the queue but cannot manage editor membership.

**Independent Test**: Run seed against a clean DB with `BOOTSTRAP_ADMIN_EMAIL` set; confirm exactly one admin row. Re-run seed; confirm no duplicate. Add a second editor via `/admin/editors`; sign in as them; confirm queue access and 403 on editor-management.

### Tests for User Story 7

- [ ] T107 [P] [US7] Add Vitest test `app/packages/db/seed.bootstrap.test.ts` running the seed twice against a fresh test DB; assert exactly one admin row exists with the configured email (US 7 acceptance scenarios 1, 2; FR-043).
- [ ] T108 [P] [US7] Add Playwright spec `app/apps/web/tests/e2e/admin-editor-onboarding.spec.ts` covering: admin invites a second editor, second editor signs in via magic link, reaches queue, gets 403 on `/admin/editors` (US 7 acceptance scenarios 3, 4).

### Implementation for User Story 7

- [ ] T109 [US7] Extend `app/packages/db/seed.ts` to upsert a single bootstrap `Editor` row from `process.env.BOOTSTRAP_ADMIN_EMAIL` with role `admin` and `active = true`, idempotent (re-runs do not modify the existing row); fail clearly if the env var is unset (FR-043, US 7 acceptance scenarios 1, 2).
- [ ] T110 [P] [US7] Implement `GET/POST/PATCH/DELETE /api/admin/editors` at `app/apps/web/app/api/admin/editors/route.ts` (admin-role-only, WebAuthn-gated): list editors, invite a new editor, toggle active, change role; every mutation writes an audit-log entry (FR-042, plan §API surface).
- [ ] T111 [US7] Build `/admin/editors` UI at `app/apps/web/app/admin/editors/page.tsx`: invite form, editor table, action buttons (US 7 acceptance scenarios 3, 4).
- [ ] T112 [P] [US7] Document the single-admin recovery exercise in `app/docs/admin-recovery.md` (extending T077): step-by-step verification that the bootstrap flow can re-issue admin access when only one admin exists and they have lost their device (FR-044, US 7 acceptance scenario 5).

**Checkpoint**: Multi-editor newsroom workflow live.

---

## Phase 12: User Story 8 — Stale submissions surface to editors (Priority: P2)

**Goal**: A submission stuck in `received` for > 14 days, or in `in_review` for > 30 days, raises a banner on `/admin` AND is included in a daily Slack digest sent to `SLACK_EDITOR_WEBHOOK` (so silence is impossible).

**Independent Test**: Backdate a `received` submission to 15 days old and an `in_review` submission to 31 days old; render `/admin` (banner appears) and run `gdpr.retention-sweep` manually (a single Slack digest message is posted listing both buckets).

### Tests for User Story 8

- [ ] T113 [P] [US8] Add Playwright spec `app/apps/web/tests/e2e/admin-stale-banner.spec.ts` backdating two submissions and asserting the banner appears on `/admin` (US 8 acceptance scenario 1).
- [ ] T114 [P] [US8] Add Vitest integration test `app/apps/web/src/inngest/functions/gdpr-retention-sweep.stale.test.ts` running the digest pass: with both buckets non-empty → exactly one Slack POST containing per-bucket counts; with both buckets empty → zero Slack POSTs (US 8 acceptance scenarios 2, 3; SC-021).

### Implementation for User Story 8

- [ ] T115 [US8] Implement the stale-state banner component at `app/apps/web/app/admin/stale-banner.tsx` querying counts via a server action; render it in `app/apps/web/app/admin/layout.tsx` (FR-052, US 8 acceptance scenario 1).
- [ ] T116 [P] [US8] Implement the stale-state digest pass inside the `gdpr.retention-sweep` Inngest function (extends T118 below) computing per-bucket counts and POSTing once per non-empty day to `SLACK_EDITOR_WEBHOOK` via T066 (FR-052, US 8 acceptance scenarios 2, 3; SC-021).
- [ ] T117 [P] [US8] Add a SQL view `submission_stale_counts` in `app/supabase/migrations/0004_submission_stale_view.sql` returning the two counts, used by T115 and T116 (plan §Trust posture, US 8).

**Checkpoint**: Stale-submission alerting live.

---

## Phase 13: User Story 9 — GDPR retention sweep purges PII on schedule (Priority: P1)

**Goal**: A daily worker runs four passes in order: (1) PII purge for approved/rejected/duplicate past `purgePiiAt`; (2) orphan-storage purge for objects > 7 days old with no `SubmissionAttachment` row; (3) stale-state Slack digest (from US8); (4) `AuditLog` partition retention. PII-read audit rows are kept the full 24-month window even after the underlying submission is purged.

**Independent Test**: Seed an approved + rejected + duplicate submission with `purgePiiAt` 31 days in the past plus an orphan storage object 8 days old; run the sweep; confirm PII nulled, attachments deleted, orphan removed, audit `pii.read` rows retained, and a `received` submission with a real `SubmissionAttachment` row whose object is older than 7 days is **not** touched.

### Tests for User Story 9

- [ ] T118 [P] [US9] Add Vitest integration test `app/apps/web/src/inngest/functions/gdpr-retention-sweep.test.ts` exercising every pass against a seeded fixture (approved/rejected/duplicate past retention, orphan object, untriaged `received` with attachment older than 7 days, audit-log rows older than 24 months); assert SC-016 / SC-017 hold and PII-read audit rows are retained per FR-054 (US 9 acceptance scenarios 1–6).
- [ ] T119 [P] [US9] Add Playwright spec `app/apps/web/tests/e2e/retention-sweep-eicar-orphan.spec.ts` exercising the orphan-after-attachment-cap path: presign 11 upload URLs, upload 11 objects, submit a body carrying all 11 (rejected with 400), then run the sweep manually and assert all 11 storage objects are gone (FR-052, plan §Verification Phase 2 step 16).

### Implementation for User Story 9

- [ ] T120 [US9] Implement the `gdpr.retention-sweep` Inngest scheduled function at `app/apps/web/src/inngest/functions/gdpr-retention-sweep.ts` running daily; structure it as four ordered steps (`step.run('pii-purge', …)`, `step.run('orphan-scan', …)`, `step.run('stale-digest', …)`, `step.run('partition-retention', …)`) so each pass is durable and resumable (FR-052, plan §Worker `gdpr.retention-sweep`).
- [ ] T121 [US9] Pass 1 — PII purge: for `Submission` rows with `status ∈ {approved, rejected, duplicate}` and `purgePiiAt < now()`, NULL `reporterEmailEnc` + `reporterNameEnc`, delete underlying storage objects via `deleteObject`, delete every `SubmissionAttachment` row referencing them; idempotent (FR-052, FR-053, US 9 acceptance scenarios 1–3).
- [ ] T122 [US9] Pass 2 — Orphan scan: list keys under `submissions/` with `LastModified < now() - 7d`, look up each by `storageKey` in `SubmissionAttachment`; for objects with no row, hard-delete; receivability of `received`/`in_review` submissions whose `SubmissionAttachment` rows DO exist must be preserved even when the underlying object is older than 7 days (FR-052, FR-053, US 9 acceptance scenarios 4, 5; SC-017).
- [ ] T123 [US9] Pass 3 — wire to T116 (stale-state digest already implemented in US8) so it runs as the third step of this function (FR-052, SC-021).
- [ ] T124 [US9] Pass 4 — Audit-log partition retention: detach or drop `AuditLog` partitions older than 24 months; for boundary rows still in window but older than 24 months at the row level, NULL `actorEditorId` while retaining `action = 'pii.read'` rows untouched; emit a Sentry breadcrumb (FR-052, FR-054, US 9 acceptance scenario 6).
- [ ] T125 [P] [US9] Add a manual-trigger admin endpoint `POST /api/admin/_internal/run-retention-sweep` at `app/apps/web/app/api/admin/_internal/run-retention-sweep/route.ts` (admin-role + WebAuthn-gated, audit-logged) that fires the Inngest event for ad-hoc sweeps (US 9 launch-gate exercise).

**Checkpoint**: GDPR sweep covers every retention path; spec-Phase-2 user-story implementation done — Phase 14 launch gates remain.

---

## Phase 14: Spec-Phase-2 Launch Gates (Polish & Trust-Posture Verification)

**Purpose**: Spec.md "Prerequisites (all must be green before launch)" — drills, sign-offs, and verification CI must all pass before the form copy is truthful and the Phase-2 deploy ships.

- [ ] T126 [P] Run the first Postgres restore drill against a Supabase staging branch: take a snapshot, restore to a new branch, run smoke tests (seed data + a test submission flow), document time-to-restore in `app/docs/restore-drills/postgres-2026-04-30.md` (FR-056, SC-020).
- [ ] T127 [P] Run the first storage restore drill: pick a random `submissions/` object from the latest sibling-region snapshot, restore to a staging bucket, verify byte-equal restore, document in `app/docs/restore-drills/storage-2026-04-30.md` (FR-057, SC-020).
- [ ] T128 [P] Verify and sign off the trust-posture text matches the §Trust posture quote exactly in `app/apps/web/app/bejelentes/trust-copy.tsx`; capture the editorial sign-off in `app/docs/trust-posture-signoff.md` (FR-036, US 5 acceptance scenario 8).
- [ ] T129 [P] Verify `PII_ENC_KEY` is set in Vercel + Supabase production secrets only (not in repo, not in CI logs); exercise the rotation runbook once on staging by re-encrypting a seeded submission set; document the run in `app/docs/pii-key-rotation-staging-2026-04-30.md` (plan §Trust posture item 3).
- [ ] T130 [P] Bootstrap admin registers a passkey on the admin's device; admin-gated routes refuse access without a fresh ≤30-min assertion (verified manually); capture evidence in `app/docs/passkey-bootstrap-2026-04-30.md` (FR-041, SC-018).
- [ ] T131 [P] Cloudmersive integration smoke: upload a known EICAR file end-to-end and confirm `infected` status in the admin queue; capture evidence in `app/docs/cloudmersive-eicar-2026-04-30.md` (FR-034, SC-013).
- [ ] T132 Update the CI workflow at `app/.github/workflows/ci.yml` to add: T072 forced-Sentry-error scrub verification, T118 sweep test, T095 admin-review E2E, T087 form-copy snapshot test, the security-headers snapshot for the new CSP (FR-037, FR-038, FR-049, FR-052, SC-014, SC-015, SC-019).
- [ ] T133 Verify `app/docs/log-retention.md` settings match deploy reality (Vercel ≤7d, Inngest ≤7d, Better Stack ≤7d) at the spec-Phase-2 deploy and add a deploy-time assertion script at `app/scripts/audit-log-retention.ts` invoked from CI (FR-037, SC-019, Constitution Principle I).

**Checkpoint**: All §Trust-posture launch gates green. Spec-Phase-2 ships.

---

## Phase 15: Spec-Phase-3 Foundational (Scrapers + Aggregator + KPI Rollup Worker Stack)

**Purpose**: Worker package, outbound HTTP wrapper, URL canonicalisation, scraper observability scaffolding, advisory-lock constants, env vars, and Inngest function registry growth that every Phase-3 user story depends on.

**⚠️ CRITICAL**: No US10/US11/US12/US13/US14 work can begin until Phase 15 is complete.

- [ ] T134 [P] Add spec-Phase-3 env vars to `app/.env.example` under a labelled `# Phase 3 (required)` block: `LINK_AUTO_THRESHOLD` (default 0.55), `LINK_REVIEW_THRESHOLD` (default 0.40), `LINK_AGGREGATOR_CONCURRENCY` (default 4 — Inngest concurrency cap on `aggregate.link-articles` so a thousand-article scrape batch cannot starve other queues); document tuning workflow against seeded data (FR-065, plan §Inngest functions `aggregate.link-articles`).
- [ ] T135 [P] Initialize `app/packages/scrapers/` with `package.json`, `tsconfig.json` extending the shared base, and `src/types.ts` defining the `ScrapedArticle` shape (`{headline, excerpt, sourceUrl, publishedAt, tag?}`) (plan §Worker, plan §Repository layout).
- [ ] T136 [P] Implement the rate-limited HTTP wrapper at `app/packages/scrapers/src/http.ts`: identifying User-Agent (`Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)`), `robots.txt` cache (re-fetched per outlet daily), per-outlet outbound rate of ≤1 req / 2 sec, exponential backoff on 4xx/5xx (FR-061).
- [ ] T137 [P] Implement URL canonicalisation in `app/packages/scrapers/src/canonicalize.ts`: scheme → `https`, lowercase host, strip fragment, strip trailing slash, apply per-outlet allowlist of meaningful query params; emit `sha256(canonicalUrl)` for the dedup hash (FR-063).
- [ ] T138 [P] Implement parse helpers at `app/packages/scrapers/src/parse.ts` using cheerio + readability; cap `excerpt` to 280 chars; expose extraction primitives reused by per-outlet adapters (FR-062).
- [ ] T139 [P] Add the `KPI_ROLLUP_LOCK = 8423501n` constant in `app/packages/db/locks.ts`; export it as the single source of truth used by `pg_advisory_xact_lock` callers (FR-068, plan §Data model `KpiSnapshot`).
- [ ] T140 [P] Add the `ScraperRun` table to `app/packages/db/schema.ts` and produce migration `app/supabase/migrations/0005_scraper_runs.sql` with indexes on `(sourceId, startedAt desc)` (plan §Data model `ScraperRun`).
- [ ] T141 [P] Add Better Stack DLQ-depth alert configuration in `app/docs/observability.md`: alert when any Inngest failed-runs queue depth > 0 for > 5 min; capture screenshot of dashboard config in the doc (FR-073, plan §Worker — Failure handling).

**Checkpoint**: Worker stack scaffolded. User stories US10–US14 can now begin.

---

## Phase 16: User Story 10 — Continually-updated news feed (Priority: P1)

**Goal**: `/hirek` renders cards from the seeded outlets (Telex, 444, HVG, Magyar Hang, Átlátszó); each shows headline, ≤280-char excerpt, source slug, publication time, optional tag, and an outbound link. Article body is never stored.

**Independent Test**: Trigger a manual scrape against each enabled outlet; confirm `NewsArticle` rows appear, no body text stored, the cards on `/hirek` link out to original articles, filters by outlet and tag narrow the list.

### Tests for User Story 10

- [ ] T142 [P] [US10] Add Vitest unit tests for canonicalisation in `app/packages/scrapers/src/canonicalize.test.ts`: scheme/host normalisation, fragment + trailing-slash strip, per-outlet allowlist, dedup hash stability across observations of the same article (FR-063, SC-024).
- [ ] T143 [P] [US10] Add Vitest fixture-based tests per outlet in `app/packages/scrapers/src/<outlet>.test.ts` (one per `telex`, `444`, `hvg`, `magyar-hang`, `atlatszo`) using saved HTML fixtures under `app/packages/scrapers/__fixtures__/` to assert headline + excerpt + URL extraction is correct (FR-062).
- [ ] T144 [P] [US10] Add Playwright spec `app/apps/web/tests/e2e/hirek.spec.ts` asserting `/hirek` renders cards from at least three outlets, each with no body text, outlet + tag filters narrow the list, and pagination works (US 10 acceptance scenarios 1–3).
- [ ] T145 [P] [US10] Add axe accessibility test `app/apps/web/tests/e2e/a11y-hirek.spec.ts` for `/hirek` (FR-022, SC-004).

### Implementation for User Story 10

- [ ] T146 [P] [US10] Implement Telex adapter at `app/packages/scrapers/src/telex.ts` (FR-061, FR-062).
- [ ] T147 [P] [US10] Implement 444 adapter at `app/packages/scrapers/src/444.ts` (FR-061, FR-062).
- [ ] T148 [P] [US10] Implement HVG adapter at `app/packages/scrapers/src/hvg.ts` (FR-061, FR-062).
- [ ] T149 [P] [US10] Implement Magyar Hang adapter at `app/packages/scrapers/src/magyar-hang.ts` (FR-061, FR-062).
- [ ] T150 [P] [US10] Implement Átlátszó adapter at `app/packages/scrapers/src/atlatszo.ts` (FR-061, FR-062).
- [ ] T151 [US10] Implement the `scrape.news` Inngest scheduled function at `app/apps/web/src/inngest/functions/scrape-news.ts` running every 30 min (cron) for every `Source` row where `enabled = true`: fan out per-source, persist new `NewsArticle` rows deduped by `sourceUrlHash`, write a `ScraperRun` row recording timing and counts, bump `Source.lastScrapedAt`, set `Source.lastSuccessAt` on success and increment `consecutiveFailures` on error; auto-disable the source after 5 consecutive failures and POST a Slack alert (FR-060, FR-064, SC-025).
- [ ] T152 [US10] Implement `GET /api/news` at `app/apps/web/app/api/news/route.ts` with query params `featured?`, `tag?`, `caseId?`, `limit`, `cursor`; `Cache-Control: public, s-maxage=120, stale-while-revalidate=600` (FR-071).
- [ ] T153 [US10] Build `/hirek` at `app/apps/web/app/hirek/page.tsx` (server) + filter UI at `app/apps/web/app/hirek/news-filters.tsx` (client); URL-search-param-driven state; outlet + tag filters; pagination; never render full bodies (FR-071, FR-062, US 10 acceptance scenarios 1–3).

**Checkpoint**: `/hirek` shippable independently of US11/US12.

---

## Phase 17: User Story 11 — Linked articles surface on the relevant case (Priority: P2)

**Goal**: Aggregator runs after each scrape; matches new articles to existing cases via `unaccent + pg_trgm`; `LINK_AUTO_THRESHOLD` sets `relatedCaseId` automatically, `LINK_REVIEW_THRESHOLD` flags `linkConfidence` for editor review; editor relinks survive subsequent runs.

**Independent Test**: Run the aggregator after a scrape; confirm articles ≥ auto threshold get `relatedCaseId` set; manually relink an article via `PATCH /api/admin/news` and confirm the next aggregator run preserves the editor's choice.

### Tests for User Story 11

- [ ] T154 [P] [US11] Add Vitest integration test `app/apps/web/src/inngest/functions/aggregate-link-articles.test.ts`: fixture seeds Cases + new Articles spanning above/between/below thresholds; assert `relatedCaseId` set / `linkConfidence` recorded / no linking respectively (US 11 acceptance scenarios 1, 2; FR-065).
- [ ] T155 [P] [US11] Add Vitest test `app/apps/web/src/inngest/functions/aggregate-link-articles.override.test.ts` proving `linkOverridden = true` rows are skipped on subsequent runs — 0 stomps observed (US 11 acceptance scenario 3, FR-066, SC-026).
- [ ] T156 [P] [US11] Add Vitest test `app/apps/web/app/api/admin/news/route.test.ts` proving any admin write that changes or clears `NewsArticle.relatedCaseId` sets `linkOverridden = true` in the same transaction (FR-051, US 11 acceptance scenario 3).

### Implementation for User Story 11

- [ ] T157 [US11] Implement `aggregate.link-articles` Inngest function at `app/apps/web/src/inngest/functions/aggregate-link-articles.ts`: run after each `scrape.news` batch via Inngest event chaining; declare an Inngest `concurrency` cap of `LINK_AGGREGATOR_CONCURRENCY` (default 4) so a thousand-article batch cannot starve other queues (per plan §Inngest functions); trigram similarity on `unaccent(name || ' ' || position)` vs article (`headline || ' ' || excerpt`); when similarity ≥ `LINK_AUTO_THRESHOLD` set `relatedCaseId`; when between thresholds record `linkConfidence` only; skip rows where `linkOverridden = true` (FR-065, FR-066, SC-026).
- [ ] T158 [US11] Implement `POST/PATCH/DELETE /api/admin/news` at `app/apps/web/app/api/admin/news/route.ts`: editor-role-gated; **every mutation that changes or clears `relatedCaseId` MUST set `linkOverridden = true` in the same transaction** (FR-051, US 11 acceptance scenario 3).
- [ ] T159 [P] [US11] Update the case-detail page `app/apps/web/app/adatbazis/[id]/page.tsx` to render the `relatedCaseId`-linked `NewsArticle` rows produced by the aggregator (the Phase-1 implementation already renders any rows present; this task confirms it covers articles auto-linked by the aggregator and adds a "linked by editor" / "auto-linked" badge keyed off `linkOverridden`) (FR-007, US 11 acceptance scenarios 1–3).

**Checkpoint**: Article-to-case linking reliable; editor decisions sticky.

---

## Phase 18: User Story 12 — Hourly KPI rollup keeps the homepage automatically fresh (Priority: P1)

**Goal**: `KpiSnapshot` is recomputed hourly via cron AND on every admin Case/Submission mutation (debounced ≤1× per 10s and serialised by `KPI_ROLLUP_LOCK`). After every successful rollup, the cached `/api/stats` payload is invalidated.

**Independent Test**: Approve a submission; observe rollup job enqueued, `KpiSnapshot.computedAt` advances within ≤10s, cached `/api/stats` invalidated, homepage label correctly shows the new lag without overstating freshness.

### Tests for User Story 12

- [ ] T160 [P] [US12] Add Vitest integration test `app/apps/web/src/inngest/functions/aggregate-kpi-rollup.test.ts` exercising: cron-fire path, admin-mutation-enqueue path with debounce (10 parallel approves → at most 2 actual rollups), and final snapshot equal to a verifying SQL aggregate (US 12 acceptance scenarios 1–3, SC-028).
- [ ] T161 [P] [US12] Add Vitest test `app/apps/web/src/inngest/functions/aggregate-kpi-rollup.lock.test.ts` proving the function holds `pg_advisory_xact_lock(KPI_ROLLUP_LOCK)`; second concurrent invocation observes the lock and serialises (FR-068, US 12 acceptance scenario 3).
- [ ] T162 [P] [US12] Add Playwright spec `app/apps/web/tests/e2e/homepage-freshness.spec.ts` asserting the "frissítve X perccel ezelőtt" label after a forced rollup never overstates freshness (US 12 acceptance scenario 4, SC-027).

### Implementation for User Story 12

- [ ] T163 [US12] Implement `aggregate.kpi-rollup` Inngest function at `app/apps/web/src/inngest/functions/aggregate-kpi-rollup.ts`: hourly cron schedule; also triggered by `kpi.recompute` events (debounced ≤1×/10s by job-id collapsing); guarded by `pg_advisory_xact_lock(KPI_ROLLUP_LOCK)`; recompute the single-row `KpiSnapshot` via SQL aggregates (totalDamage, totalPrisonYears, activeCases, newIndictmentsThisWeek, partnerCount, bySector); after upsert call `revalidateTag('stats')` via the signed internal endpoint from T053 (FR-067, FR-068, FR-069, FR-070).
- [ ] T164 [P] [US12] Update `PATCH /api/admin/submissions/[id]` (T101), `POST/PATCH/DELETE /api/admin/cases` (new file `app/apps/web/app/api/admin/cases/route.ts`), and `POST/PATCH/DELETE /api/admin/news` (T158) to enqueue a `kpi.recompute` Inngest event on every successful mutation that affects KPI totals; the request path MUST NOT call any rollup synchronously (FR-050, FR-070).
- [ ] T165 [P] [US12] Update homepage `app/apps/web/app/page.tsx` (T042) to honour the `s-maxage=120` cache contract by re-using T040's relative-time helper and explicitly NOT calling any rollup on render (FR-070, US 12 acceptance scenario 4).

**Checkpoint**: KPI freshness automated; homepage trustworthy after submission-driven mutations.

---

## Phase 19: User Story 13 — Scrapers run reliably with editor-visible observability (Priority: P2)

**Goal**: `/admin/scraper-runs` shows per-source last-scraped, last-success, consecutive-failures, articles-found / articles-new on the most recent run, and any error payload. Outlets failing 5× in a row auto-disable. Per-queue failed-runs alerts fire on depth > 0. `worker.heartbeat` decouples liveness from real-job cadence.

**Independent Test**: Force a scraper to fail 5× consecutively → source disabled, alert fires; force `submission.intake` to silently fail → DLQ alert fires but `/healthz` stays 200 (heartbeat is the sole liveness criterion).

### Tests for User Story 13

- [ ] T166 [P] [US13] Add Playwright spec `app/apps/web/tests/e2e/admin-scraper-runs.spec.ts` rendering `/admin/scraper-runs` with seeded `ScraperRun` data and asserting every required column is shown (US 13 acceptance scenario 1; FR-072).
- [ ] T167 [P] [US13] Add Vitest test `app/apps/web/src/inngest/functions/scrape-news.disable.test.ts` driving five consecutive failures for a fake source and asserting `Source.enabled = false`, Slack alert posted, and no further `scrape.news` events enqueued for that source (US 13 acceptance scenario 2, FR-064, SC-025).
- [ ] T168 [P] [US13] Add Vitest test `app/apps/web/src/inngest/functions/heartbeat.test.ts` proving `worker.heartbeat` runs every 5 min, executes `SELECT 1`, and updates a heartbeat timestamp; `/healthz` returns 200 only when the heartbeat is fresh (FR-074, SC-029).
- [ ] T169 [P] [US13] Add Playwright spec `app/apps/web/tests/e2e/healthz-decoupled.spec.ts` proving a silently-failing real queue does NOT flip `/healthz`; only a stale heartbeat does (US 13 edge case "Heartbeat-job-only liveness flap"; SC-029).
- [ ] T170 [P] [US13] Add Vitest test `app/apps/web/src/inngest/functions/silent-rot.test.ts` proving "no articles parsed in N runs" alert fires within 15 min of the fifth such run when an outlet returns 200s with empty parse results (SC-022, US 13 edge case).

### Implementation for User Story 13

- [ ] T171 [US13] Implement `worker.heartbeat` Inngest function at `app/apps/web/src/inngest/functions/heartbeat.ts` running every 5 min; execute `SELECT 1`, write a row to a singleton `worker_heartbeat` table (or upsert a single row keyed by `'singleton'`); add a small migration for that table at `app/supabase/migrations/0006_worker_heartbeat.sql` (FR-074, SC-029).
- [ ] T172 [US13] Update `GET /healthz` (T027) to require the heartbeat freshness criterion: 200 only when `now() - max(heartbeat.at) ≤ 10 min`, with a 5-min startup grace window; otherwise 503 (FR-074, SC-029).
- [ ] T173 [P] [US13] Implement `GET /api/admin/scraper-runs` at `app/apps/web/app/api/admin/scraper-runs/route.ts` returning per-source dashboard rows joined to the latest `ScraperRun` (FR-072).
- [ ] T174 [P] [US13] Build `/admin/scraper-runs` UI at `app/apps/web/app/admin/scraper-runs/page.tsx` rendering the dashboard table with sort + status badges (FR-072, US 13 acceptance scenario 1).
- [ ] T175 [P] [US13] Implement the silent-rot alert: extend `scrape.news` (T151) to count consecutive zero-article runs per source, and after 5 consecutive zero-article (HTTP 200) runs post a Slack alert tagged "no articles parsed" (US 13 edge case "Outlet HTML structure changes", SC-022).
- [ ] T176 [P] [US13] Configure Better Stack DLQ-depth alerts (per the doc in T141) by setting up an external monitor against Inngest's failed-runs API; document the configured monitor IDs in `app/docs/observability.md` (FR-073, SC-030).

**Checkpoint**: Scraper observability + correctly-decoupled liveness; per-queue failed-runs alerts fire on depth > 0.

---

## Phase 20: User Story 14 — DSR queue formalises the Phase-2 mailbox (Priority: P3)

**Goal**: The Phase-2 manual `dpo@…` runbook is upgraded to a queue at `/admin/dsr`; each lifecycle transition writes an audit-log entry; the 30-day SLA is visible in the queue.

**Independent Test**: Open a DSR in the queue; process it through intake → identity verification → fulfillment → closure; confirm an audit-log row exists for each transition and the SLA countdown displays the remaining days.

### Tests for User Story 14

- [ ] T177 [P] [US14] Add Playwright spec `app/apps/web/tests/e2e/admin-dsr-queue.spec.ts` covering the full lifecycle and audit-log assertions (US 14 acceptance scenario 1; FR-075).
- [ ] T178 [P] [US14] Add axe accessibility test `app/apps/web/tests/e2e/a11y-admin-dsr.spec.ts` for `/admin/dsr` (FR-022, SC-004).

### Implementation for User Story 14

- [ ] T179 [US14] Add a `DsrRequest` table in `app/packages/db/schema.ts` and migration `app/supabase/migrations/0007_dsr_request.sql`: `id`, `subjectEmailHash`, `kind` (`access` | `deletion`), `status` (`received` | `verified` | `fulfilled` | `closed`), `slaDeadline`, `assignedEditorId?`, `notes`, `createdAt` (FR-075, US 14 acceptance).
- [ ] T180 [P] [US14] Implement `GET/POST/PATCH /api/admin/dsr` at `app/apps/web/app/api/admin/dsr/route.ts`: editor-role-gated; every state transition writes an `AuditLog` entry (FR-075).
- [ ] T181 [US14] Build `/admin/dsr` UI at `app/apps/web/app/admin/dsr/page.tsx` rendering the queue with SLA countdown badges, lifecycle transition buttons, and templated fulfillment text linked to T076 (FR-075, US 14 acceptance scenario 1).

**Checkpoint**: DSR queue formalised end-to-end with audit discipline.

---

## Phase 21: Spec-Phase-3 Polish

**Purpose**: Production smoke per phase, observability hardening, threshold tuning evidence.

- [ ] T182 [P] Capture threshold-tuning evidence: run the aggregator against the seeded data set with `LINK_AUTO_THRESHOLD = 0.55` and `LINK_REVIEW_THRESHOLD = 0.40`, document precision/recall observations in `app/docs/aggregator-tuning-2026-04-30.md`, adjust thresholds if precision < 0.9 on the seeded sample (FR-065, plan §Inngest functions `aggregate.link-articles`).
- [ ] T183 [P] Production smoke: confirm `/healthz` returns 200, the next scheduled `scrape.news` runs within 30 min of deploy, an induced 5-failure outlet trips the editor alert within 15 min (plan §Verification "Production smoke", SC-025).
- [ ] T184 [P] Update CI to run the full Phase-3 test suite (T142–T170) plus T184a and gate on green; extend `app/.github/workflows/ci.yml` accordingly (plan §Critical files).
- [ ] T184a [P] Add Vitest integration test `app/apps/web/src/inngest/functions/scrape-aggregate-cycle.test.ts` measuring scrape→aggregate cycle latency: drive N≥20 simulated scrape batches against the seeded fixture (using a mocked outlet adapter so test latency is deterministic), record `ScraperRun.startedAt` → `aggregate.link-articles` step finish for each cycle, and assert p95 elapsed-ms ≤ 300000 (5 min) and p100 ≤ 600000 (10 min) under normal-load fixture sizing. Surface the per-run distribution as a JSON artefact uploaded by CI so regressions are visible in the workflow log (SC-023, FR-060, FR-065).

**Checkpoint**: Spec-Phase-3 ships.

---

## Phase 22: Spec-Phase-4 Foundational (Durable Client-Side Submission Encryption)

**Purpose**: libsodium client + server primitives, per-environment feature flag, editor-key registry, migration scaffolding for the sealed-box transition.

**⚠️ CRITICAL**: No US15/US16/US17/US18/US19 work can begin until Phase 22 is complete.

- [ ] T185 [P] Add libsodium dependency to `app/apps/web/package.json` (`libsodium-wrappers-sumo`); add the Phase-4 feature flag `SUBMISSIONS_SEALED_BOX_ENABLED` (per-environment, default `false`) to `app/.env.example` under a labelled `# Phase 4` block (FR-085, plan §Critical files).
- [ ] T186 [P] Add an `EditorKey` table in `app/packages/db/schema.ts` and migration `app/supabase/migrations/0008_editor_key.sql`: `id`, `editorId`, `publicKey` (bytea), `revokedAt?`, `createdAt`; current-recipient view `editor_recipient_keys` selecting non-revoked rows (FR-077, plan §Trust posture Phase 4).
- [ ] T187 [P] Add sealed-box columns to the `Submission` table in `app/packages/db/schema.ts`: `bodyCipher` bytea, `reporterEmailCipher` bytea, `reporterNameCipher` bytea, `recipientFingerprints` text[]; **keep** `pgp_sym_encrypt`-based columns alongside (`reporterEmailEnc`, `reporterNameEnc`, `summary`) until the backfill migration in T194 lands (FR-076, FR-086, plan §Build phasing — Phase 4).
- [ ] T188 [P] Add migration `app/supabase/migrations/0009_submissions_sealed_box_columns.sql` adding the new columns nullable; the backfill + drop of the legacy columns ships in a follow-up migration per the destructive-migrations policy in `app/docs/migrations.md` (FR-086, plan §Backup, recovery, and migrations).
- [ ] T189 [P] Implement client-side libsodium helpers at `app/apps/web/src/lib/sealed-box/{seal,unseal,fingerprint}.ts`: `seal(plaintext, recipientPublicKeys[])` returns the multi-recipient envelope, `unseal(envelope, mySecretKey)` recovers plaintext, `fingerprint(publicKey)` produces a 16-byte tag used in `recipientFingerprints[]` (FR-076, FR-077).
- [ ] T190 [P] Implement client-side passkey-derived secret store at `app/apps/web/src/lib/sealed-box/key-store.ts`: derive a symmetric key from the editor's WebAuthn assertion (large-blob extension if available, otherwise PRF extension) and use it to encrypt the editor's libsodium secret key at rest in IndexedDB; the server NEVER sees the secret key (FR-078, plan §Trust posture Phase 4).
- [ ] T191 [P] Implement `GET /api/editor-recipients` at `app/apps/web/app/api/editor-recipients/route.ts` returning the **public** half of the current editor recipient list (active + non-revoked); `Cache-Control: public, s-maxage=60` (FR-077, US 15 acceptance scenario 1).

**Checkpoint**: Phase-4 primitives in place; user-story phases can begin.

---

## Phase 23: User Story 15 — Whistleblower submissions are unreadable on the server (Priority: P1)

**Goal**: `/bejelentes` encrypts `summary` and reporter PII in the browser before any HTTP request leaves the user agent; the application server never receives plaintext or any editor private key. After Phase-4 launch, direct DB inspection without an editor private key recovers zero plaintext bytes.

**Independent Test**: Submit a `/bejelentes` report after Phase 4 ships; from a Postgres client (no editor private key in scope), confirm `bodyCipher`, `reporterEmailCipher`, and `reporterNameCipher` are sealed-box ciphertexts and recover zero plaintext bytes.

### Tests for User Story 15

- [ ] T192 [P] [US15] Add Playwright E2E `app/apps/web/tests/e2e/sealed-box-happy-path.spec.ts` running with `SUBMISSIONS_SEALED_BOX_ENABLED=true`: submit a tip; assert the network payload to `POST /api/submissions` contains opaque ciphertexts (no plaintext markers from a known canary string); from a SQL client confirm no plaintext bytes recoverable; sign in as the seeded admin, unlock the local key, render the queue, decrypt and read the tip; assert a `pii.read` audit-log row was written via the signed client-driven call (US 15 acceptance scenarios 1, 3, 4; SC-031).
- [ ] T193 [P] [US15] Add Vitest sanity test `app/apps/web/src/lib/sealed-box/sealed-box.test.ts` proving seal/unseal round-trip with multi-recipient envelopes; an unintended-recipient secret key cannot recover plaintext (FR-077, SC-031).
- [ ] T194 [P] [US15] Add a runtime memory-snapshot smoke test `app/apps/web/tests/e2e/server-memory-no-plaintext.spec.ts` that submits a known-canary tip, dumps the server-side process memory at the moment of POST handling (via a CI-only `/api/_internal/memdump` endpoint, secret-token-gated, never enabled in production), and asserts the canary bytes do not appear (SC-032).

### Implementation for User Story 15

- [ ] T195 [US15] Update the `/bejelentes` client form (T093) to call `seal(...)` from T189 against the public-key list fetched from T191 before any network request leaves the browser, when `SUBMISSIONS_SEALED_BOX_ENABLED=true`; otherwise fall back to the Phase-2 path unchanged (FR-076, FR-085, US 15 acceptance scenario 1, US 19 acceptance scenarios 1, 2).
- [ ] T196 [US15] Update `POST /api/submissions` (T090) to accept the new sealed-box-shaped body when the flag is on: write `bodyCipher`, `reporterEmailCipher`, `reporterNameCipher`, and `recipientFingerprints[]`; reject mixed-format bodies (must be entirely one path or the other); the server NEVER decrypts these fields (FR-076, edge case "Reporter submits while flag flips").
- [ ] T197 [US15] Update `GET /api/admin/submissions/[id]` (T100) to return the ciphertext columns directly when the flag is on; the editor's browser unseals locally; the server still writes the `AuditLog` `pii.read` row when the client makes a signed call confirming a successful decryption (FR-079, US 15 acceptance scenarios 3, 4).
- [ ] T198 [US15] Update the admin queue UI (T105) to call `unseal(...)` client-side after the editor's local key is unlocked via T190; render plaintext only in the editor's browser; before reading PII fire a signed `POST /api/admin/submissions/[id]/audit-pii-read` call so the existing forensic trail is preserved (FR-079).
- [ ] T199 [P] [US15] Implement the signed audit endpoint `POST /api/admin/submissions/[id]/audit-pii-read` at `app/apps/web/app/api/admin/submissions/[id]/audit-pii-read/route.ts` (admin-session-gated, HMAC-token-validated) that writes an `AuditLog` row with `action='pii.read'` (FR-079, SC-015).
- [ ] T200 [US15] Author migration `app/supabase/migrations/0010_submissions_sealed_box_backfill.sql`: backfill is operationally driven by editors re-sealing existing rows from the queue (manual one-shot) — the migration is a placeholder + checklist comment; the destructive follow-up `0011_drop_legacy_pii_columns.sql` ships only after backfill is verified zero-row-residual (FR-086, plan §Build phasing — Phase 4).
- [ ] T201 [P] [US15] Browser-capability gate: in `/bejelentes`, when libsodium / required WebCrypto primitives are unsupported, BLOCK submission with an honest error message; never silently fall back to a plaintext path (US 15 edge case "Browser cannot perform required cryptography").

**Checkpoint**: Sealed-box submissions live; backend compromise no longer exposes submission contents.

---

## Phase 24: User Story 16 — Lost-key recovery is graceful, not silent failure (Priority: P2)

**Goal**: A submission whose recipient list points only to a now-unavailable editor's key renders an explicit "sealed to a key no current editor holds" state — never a 500 or a silently-blank cell.

**Independent Test**: Seed a submission whose ciphertext is addressed only to an editor whose row has been deactivated and whose `EditorKey` is revoked; render `/admin`; assert the explicit state appears in the queue cell.

### Tests for User Story 16

- [ ] T202 [P] [US16] Add Playwright spec `app/apps/web/tests/e2e/sealed-box-orphan.spec.ts` exercising the orphan-recipient state (US 16 acceptance scenario 1; SC-033).
- [ ] T203 [P] [US16] Add Vitest test `app/apps/web/src/lib/sealed-box/recipient-resolution.test.ts` proving the queue handler classifies a submission as "orphan-recipient" iff none of `recipientFingerprints[]` match any active `EditorKey` (FR-080, SC-033).

### Implementation for User Story 16

- [ ] T204 [US16] Update the queue handler (T100, T197) to compute a `recipientResolution` field per row by intersecting `recipientFingerprints[]` with active `editor_recipient_keys.fingerprint`; surface `'orphan-recipient'` when the intersection is empty (FR-080, SC-033).
- [ ] T205 [US16] Update the admin queue UI (T105, T198) to render the explicit "sealed to a key no current editor holds" cell for `recipientResolution = 'orphan-recipient'` rows, with the documented multi-recipient/quorum-unseal recovery procedure linked from the cell (FR-080, FR-082, US 16 acceptance scenario 1, 2).
- [ ] T206 [P] [US16] Author `app/docs/sealed-box-recovery.md` documenting the multi-recipient envelope, quorum unsealing, and the single-admin device-loss path; mark "exercised on staging YYYY-MM-DD" before launch (FR-082, US 16 acceptance scenario 2).

**Checkpoint**: Lost-key state is honest and operationally documented.

---

## Phase 25: User Story 17 — Key rotation re-seals in-flight submissions (Priority: P2)

**Goal**: When the editor recipient list changes (add or remove), an idempotent rotation Inngest job re-seals every in-flight submission ciphertext to the new list within one job run; an editor revoked mid-rotation cannot decrypt rows whose re-sealing has completed; an editor added during rotation can decrypt every completed row.

**Independent Test**: Add or remove an editor; trigger the rotation job; confirm 100% of in-flight rows are re-sealed; interrupt the run, restart, confirm the second invocation idempotently completes the work with 0 corrupted rows.

### Tests for User Story 17

- [ ] T207 [P] [US17] Add Vitest integration test `app/apps/web/src/inngest/functions/sealed-box-rotation.test.ts`: seed N submissions sealed to a base recipient list, rotate (add one, remove one), assert every row's `recipientFingerprints[]` matches the new list; interrupt at row N/2, resume, assert idempotent completion (US 17 acceptance scenarios 1, 2; SC-034).
- [ ] T208 [P] [US17] Add Vitest test `app/apps/web/src/inngest/functions/sealed-box-rotation.envelope-size.test.ts` asserting envelope size with N=20 recipients fits within the configured row-size limit; if envelope size > 90% of limit, surface a Sentry breadcrumb (US 17 edge case "Envelope-size growth").

### Implementation for User Story 17

- [ ] T209 [US17] Implement `submissions.rotate-seal` Inngest function at `app/apps/web/src/inngest/functions/sealed-box-rotation.ts` triggered when the editor recipient list changes (or manually via admin endpoint): batch-process in-flight submissions; for each, fetch the current row's plaintext via a quorum of editors collaborating in-browser (or a designated rotation-time editor presence) and re-seal; idempotent + resumable via Inngest step durability (FR-081, SC-034).
- [ ] T210 [P] [US17] Implement `POST /api/admin/sealed-box/rotate` at `app/apps/web/app/api/admin/sealed-box/rotate/route.ts` (admin-role + WebAuthn-gated, audit-logged) that fires the rotation event (FR-081).
- [ ] T211 [P] [US17] Build `/admin/sealed-box/rotate` UI at `app/apps/web/app/admin/sealed-box/rotate/page.tsx` orchestrating the in-browser re-seal flow (collect plaintext from designated editors, re-seal, POST progress) (FR-081).
- [ ] T212 [P] [US17] Add an envelope-size monitoring helper in `app/packages/shared/sealed-box-monitor.ts` capturing the size of every emitted envelope and posting a Sentry breadcrumb when it exceeds 90% of the configured row-size budget (US 17 edge case).

**Checkpoint**: Rotation works idempotently; envelope-size monitored.

---

## Phase 26: User Story 18 — Form copy upgrade ships in lockstep with the schema migration (Priority: P3)

**Goal**: The Phase-2 truthful-but-modest copy is upgraded to the strong promise *"Beérkezésed végpont-titkosítva tároljuk"* in the **same** release as the Phase-4 schema migration — never before, never after. Editorial signs off in writing.

**Independent Test**: Inspect the production deploy log for the Phase-4 release; confirm the form-copy commit and the schema migration commit ship in the same deployment; confirm an editorial sign-off is recorded.

### Tests for User Story 18

- [ ] T213 [P] [US18] Update the form-copy snapshot test in `app/apps/web/tests/e2e/submission-form-copy.spec.ts` (T087) to be flag-aware: when `SUBMISSIONS_SEALED_BOX_ENABLED=false`, expect the Phase-2 truthful text; when `true`, expect the Phase-4 strong-promise text exactly: *"Beérkezésed végpont-titkosítva tároljuk és csak a szerkesztőség férhet hozzá. Az IP-címedet az adatbázisban nem tároljuk; CDN- és platformszintű hozzáférési naplók ideiglenesen rögzíthetik, ezeket legfeljebb 7 napig őrizzük. Súlyosan bizalmas anyagokhoz használj Tor-böngészőt."* (FR-083, US 18 acceptance scenario 1).

### Implementation for User Story 18

- [ ] T214 [US18] Update `app/apps/web/app/bejelentes/trust-copy.tsx` (T094) to render the strong promise when `SUBMISSIONS_SEALED_BOX_ENABLED=true`, the truthful text otherwise; the snapshot test in T213 is the single guard against silent drift (FR-083, US 18 acceptance scenario 1).
- [ ] T215 [P] [US18] Capture the editorial sign-off for the form-copy upgrade in `app/docs/trust-posture-signoff.md` with date and signatory; update it in the same PR that flips the flag (FR-083).
- [ ] T216 [US18] Update `app/docs/pii-threat-model.md` (T078) to reflect the durable Phase-4 control: backend compromise no longer equals submission-content exposure; document the residual risks (compromise of an editor device unlocked at the time, compromise of the team password manager / shared editor key store) (FR-084).

**Checkpoint**: Copy upgrade lands with the migration, never before.

---

## Phase 27: User Story 19 — Backout flag for safe rollout (Priority: P2)

**Goal**: Phase-4 ships behind `SUBMISSIONS_SEALED_BOX_ENABLED`; flipping it off in production reverts new submissions to the Phase-2 sym-enc path and reverts the form copy, until any issue is resolved. The flag is exercised on staging before production.

**Independent Test**: On staging, flip the flag off → submit a test report → confirm the request follows the Phase-2 path and the form copy reverts to the Phase-2 truthful text. Capture deploy-log evidence. Then flip on in production in the same release window with documented evidence of the staging exercise.

### Tests for User Story 19

- [ ] T217 [P] [US19] Add Playwright spec `app/apps/web/tests/e2e/sealed-box-flag-off.spec.ts` running with `SUBMISSIONS_SEALED_BOX_ENABLED=false`: assert the request body is the Phase-2 shape (no sealed-box ciphertexts; PII columns are bytea via T062), and the form copy is the Phase-2 truthful text (US 19 acceptance scenario 1, FR-085).
- [ ] T218 [P] [US19] Add Vitest test `app/apps/web/src/lib/sealed-box/flag-flip-isolation.test.ts` asserting a request started with the flag on but completed after the flag flipped off either follows the original path end-to-end or fails visibly — never writes a row whose ciphertext format is half one path and half the other (US 19 edge case "Reporter submits while flag flips").

### Implementation for User Story 19

- [ ] T219 [US19] Wire `SUBMISSIONS_SEALED_BOX_ENABLED` into the relevant code paths (T195, T196, T214) so flipping it off cleanly reverts to the Phase-2 path; the flag is read at the start of every request and not re-checked mid-flow within a single request (FR-085, US 19 acceptance scenario 1; US 19 edge case).
- [ ] T220 [P] [US19] Exercise the backout on staging: flip the flag off, submit a test, confirm Phase-2 path, capture evidence in `app/docs/sealed-box-backout-staging-2026-04-30.md` (FR-085, SC-036, US 19 acceptance scenario 2).
- [ ] T221 [P] [US19] Document the production rollout sequence in `app/docs/sealed-box-rollout-runbook.md`: staging-exercise gate, deploy command, observability checks, the flag-off rollback command (FR-085).

**Checkpoint**: Backout path tested; production rollout safe.

---

## Phase 28: Spec-Phase-4 Launch Gates (Polish & Final Verification)

**Purpose**: Final sealed-box verification, documentation, observability, and CI gating before spec-Phase-4 ships.

- [ ] T222 [P] Update CI to run the Phase-4 test suite (T192–T218) and gate on green; extend `app/.github/workflows/ci.yml` accordingly (FR-085, plan §Critical files).
- [ ] T223 [P] Produce the final memory-snapshot evidence by running T194 against the staging deploy and capturing the assertion result + JFR/heap-dump excerpt in `app/docs/server-memory-no-plaintext-2026-04-30.md` (SC-032).
- [ ] T224 [P] Verify recipient-resolution coverage on production data: at the same time as flag-on rollout, confirm `recipientResolution` is computed for 100% of `Submission` rows during the next admin-queue render (SC-033).
- [ ] T225 [P] Final security audit: run a full security-headers snapshot, axe a11y suite, k6 burst test, and Phase-4 sealed-box integration suite against the production-equivalent staging deploy; capture results in `app/docs/launch-gates-spec-phase-4-2026-04-30.md` (FR-022, FR-023, FR-059, SC-002, SC-006, SC-031, SC-032, SC-033, SC-034, SC-035, SC-036).
- [ ] T226 Once all of the above are green and the editorial sign-off (T215) is recorded, ship spec-Phase-4 in production within the same release window as the form-copy upgrade (FR-083, FR-085, SC-035).

**Checkpoint**: All four spec-phases shipped. The promise on `/bejelentes` is now backed by cryptography, not by access control on a server-held key.

---

## Dependencies & Execution Order — Phases 8–28

### Spec-Phase Ordering

- **spec-Phase-1** (current Phase 1–7, T001–T057) → **spec-Phase-2** (Phase 8–14, T058–T133) → **spec-Phase-3** (Phase 15–21, T134–T184) → **spec-Phase-4** (Phase 22–28, T185–T226). Each spec-phase is independently shippable; consumers depend on the previous spec-phase's user-story implementations only where explicitly noted (e.g. T159 extends the Phase-1 case-detail page with aggregator-linked articles).

### Within Spec-Phase-2 (Phase 8–14)

- **Phase 8 Foundational (T058–T081)**: T058 → T059 (schema before migration); T058 + T059 + T064 + T065 + T067 + T068 + T074 block T089–T094 (US5 implementation). T069–T070 block US6 (T099–T106). T058 (Editor) blocks T109 (US7). T058 (AuditLog partitioning) + T060 + T066 block US9 (T120–T125).
- **US5–US9 (Phase 9–13)**: All depend on Phase 8 only. US5, US6, US7 are mutually parallelizable (different files). US8 depends on US9 partially because the US8 digest pass is implemented in T116 inside the US9 sweep function (T120) — schedule US9 first or interleave.
- **Phase 14 Launch Gates (T126–T133)**: All depend on US5–US9 implementations being complete; CI updates (T132, T133) are the last step before launch.

### Within Spec-Phase-3 (Phase 15–21)

- **Phase 15 Foundational (T134–T141)**: Independent of spec-Phase-2 user stories but depends on Phase 8 Inngest wiring (T074). T140 (ScraperRun migration) blocks US10 (T151) and US13 (T173).
- **US10–US14**: All depend on Phase 15 only. US12 depends on `KPI_ROLLUP_LOCK` from T139 and on the admin mutation endpoints from spec-Phase-2 (T101, T158, plus the new T164's `app/apps/web/app/api/admin/cases/route.ts`); the Phase-1 KPI cache plumbing (T053) is reused. US11 depends on T158 (admin news mutation) and the aggregator (T157). US13 depends on US10 (real `scrape.news` runs) and the heartbeat function (T171). US14 is independent of the others.
- **Phase 21 Polish (T182–T184)**: All depend on US10–US14 being complete.

### Within Spec-Phase-4 (Phase 22–28)

- **Phase 22 Foundational (T185–T191)**: Depends on Phase 8 schema (`Editor`, `Submission`). T186 + T191 block US15.
- **US15–US19**: US15 (sealed-box happy path) is the foundation for US16, US17, US18, US19. US16 is independent of US17 once US15 lands. US17 depends on US15 + the rotation infrastructure. US18 (form copy upgrade) and US19 (backout flag) both gate on US15 plumbing being live.
- **Phase 28 Launch Gates (T222–T226)**: Last step before flag-on rollout in production.

### Parallel Opportunities Across Phases 8–28

- Within Phase 8, T060–T081 (excluding the schema chain T058 → T059) all touch distinct files and run in parallel.
- Within each user-story phase, every `[P]`-marked task targets a distinct file.
- Documentation tasks (T075–T081, T112, T206, T215, T216, T221, T222–T225) are nearly always parallelizable.

---

## Implementation Strategy — Phases 8–28

### MVP First Across All Spec-Phases

1. **Spec-Phase-1 ships** with US1 (the database) as the journalistic centre.
2. **Spec-Phase-2 ships** once US5 + US6 + US9 + Phase 14 launch gates are green; US7 + US8 can land in the same release or follow shortly after.
3. **Spec-Phase-3 ships** once US10 + US12 + Phase 21 polish are green; US11 + US13 + US14 land in the same release or follow.
4. **Spec-Phase-4 ships** once US15 + US19 (backout exercised on staging) + Phase 28 launch gates + editorial sign-off are green; US16 + US17 + US18 (form-copy upgrade) ship in the same release as US15 by design (T214 — flag-aware) so the copy upgrade is in lockstep with the migration.

### Incremental Delivery

1. spec-Phase-1: Phase 1 + Phase 2 → US1 (MVP) → US2 → US3 → US4 → Phase 7 polish.
2. spec-Phase-2: Phase 8 → US5 + US6 + US9 (MVP for spec-Phase-2) → US7 + US8 → Phase 14 launch gates.
3. spec-Phase-3: Phase 15 → US10 + US12 (MVP for spec-Phase-3) → US11 + US13 → US14 → Phase 21 polish.
4. spec-Phase-4: Phase 22 → US15 + US19 (MVP for spec-Phase-4 = sealed-box on with safe backout) → US16 + US17 → US18 + Phase 28 launch gates.

### Parallel Team Strategy

- One developer owns each spec-phase Foundational chain (T058–T081, T134–T141, T185–T191) end-to-end.
- Once each Foundational chain lands, multiple developers can pick up the user-story phases in parallel.
- A dedicated developer owns the launch-gate / polish phases (Phase 14, Phase 21, Phase 28) and the CI workflow updates (T132, T184, T222) overlapping user-story work.

---

## Out-of-Scope Reminder — All Phases

Per spec.md "Out of Scope" (covering all four phases) and plan.md §Build phasing / §Out of scope, the following remain **not** in this task list and are not part of this feature:

- **Catalogue item 7** — footer/methodology static pages, public CSV/API export, donations, partners/team/sajtó pages. Covered for spec-Phase-1 by `/hamarosan` (US4); revisited only when an explicit feature spec is opened.
- **SecureDrop integration** — sealed-box submission encryption (US15) covers the primary whistleblower threat model.
- **IP-stripping reverse proxy** — replaced by ≤7-day platform access-log retention (FR-037, T075, T133).
- **OAuth providers (GitHub, Google) for editor sign-in** — magic-link only across all phases.
- **WebAuthn passkeys for the `editor` role** — only required for `admin` (FR-041, T069); revisit if threat model changes.
- **Self-service DSR portal for reporters** — Phase 2 ships the manual mailbox runbook (T076), Phase 3 ships the editor queue (US14); no reporter-facing self-service portal.
- **Mobile-native app** — responsive web is the target across all phases.
- **Trend / historical KPI charts** — `KpiSnapshot` is single-row by design; introducing a `KpiHistory` table is a deliberate later decision, not part of this four-phase scope.
- **Hungarian-language stemming via `hunspell_hu`** — `simple` + `unaccent` is acceptable across all phases.

---

## Notes — Phases 8–28

- Every PASS in the validation chain (lint → typecheck → vitest → build → Playwright/axe → k6 burst → spec-phase-specific integration suites) needs evidence per `~/.claude/CLAUDE.md` Honesty Protocol. "UI exists" is not "PASS"; only direct verification against the running preview is.
- The `submission.intake` failure mode (Cloudmersive vendor outage) is intentionally **not** a 5xx on the request path — submissions stay `pending` and a banner surfaces in `/admin` until the scan resolves. Editors must not download attachments while pending. This is captured in T067 + T091 + T103 and documented in `app/docs/virus-scan.md` (T079).
- The PII-read audit-log discipline is preserved across spec-phases: in spec-Phase-2 the server writes the row in the same transaction as the decrypt (T100); in spec-Phase-4 the client writes via a signed call (T199) since the server no longer decrypts. The forensic trail is identical from the auditor's perspective.
- Storage native lifecycle rules are deliberately **not** configured on the `submissions` bucket across all spec-phases — the DB-aware orphan scan (T122) is the sole authority for happy-path deletion. A blunt time-floor would conflict with the no-auto-purge rule for `received` / `in_review` (FR-053).
- The advisory lock for KPI rollup (T139) is the sole serializer for concurrent rollups; the magic number `KPI_ROLLUP_LOCK = 8423501n` lives in exactly one file (`app/packages/db/locks.ts`) per plan §Data model.
- Heartbeat-decoupled liveness (T171, T172) is intentional: silently-failing real queues are detected via DLQ-depth alerts (T141, T176), not by `/healthz`. Health probes that depend on real-queue cadence flap by construction (per plan §Worker `worker.heartbeat`).
- The Phase-4 form-copy upgrade is editorially gated and ships in the **same** release as the schema migration (T214 — flag-aware) — never before, never after.
- All tasks are written so they are immediately executable without additional context: file paths are exact, FR / SC / US references are explicit, and dependencies are stated inline.
