---
description: "Phase-1 task list for Korruptométer — read-only public site"
---

# Tasks: Korruptométer — Phase 1 Read-Only Public Site

**Input**: Design documents from `/specs/001-korruptometer-mvp/`
**Prerequisites**: plan.md (loaded), spec.md (loaded). No `data-model.md`, `contracts/`, or `quickstart.md` files exist; entities and API surface are extracted from plan.md §Data model and §API surface.

**Tests**: Tests are explicitly required by the spec — currency-magnitude snapshot tests (FR-012, SC-005), automated accessibility audits (FR-022, SC-004), security-headers snapshot test (FR-023), the DB-pool 100-RPS burst test (SC-002, SC-006, Phase 1 verification step 8), and Playwright E2E flows for each user story. They are included below.

**Organization**: Tasks are grouped by user story (US1–US4 from spec.md) so each story can be implemented and validated independently. All paths are absolute against the repo root `/home/attilah/Coding/corruption-tracker-mockups/`; the active codebase lives under `app/` per plan.md §Repository layout.

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
