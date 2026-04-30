# Feature Specification: Korruptométer — Phase 1 Read-Only Public Site

**Feature Branch**: `001-korruptometer-mvp`
**Created**: 2026-04-30
**Status**: Draft
**Input**: User description: "based on ~/.claude/plans/create-a-plan-for-zippy-reef.md"

> **Scope note.** The reference plan (`~/.claude/plans/create-a-plan-for-zippy-reef.md`) is structured as four phases. This specification covers **Phase 1 only** — the read-only public site that turns the existing static mockup at `01-tesla/index.html` into a real, dynamic Hungarian corruption-tracking website backed by a real database. Phases 2 (public submissions + editor admin), 3 (news scrapers + aggregator + KPI rollup), and 4 (durable submission encryption) are explicitly out of scope here and will be handled by subsequent feature specs. See **Out of Scope** at the bottom.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse and filter the corruption-case database (Priority: P1)

A Hungarian citizen, journalist, or researcher visits the site to investigate publicly-known corruption cases involving Hungarian public figures. They open the case database, search by name (e.g. "Orbán"), narrow by region, sector, status, minimum financial damage, minimum sentence length, and case-year range, sort by amount or year, and page through results. Selecting a case opens its detail page showing the full rogue profile (mugshot, charges, status) and any linked news articles.

**Why this priority**: This is the central app surface and the reason a citizen lands on the site. Without a working, filterable database the site has no journalistic value — KPI dashboards and rogues' galleries are summaries of *this* dataset. If only this story shipped, the site would already deliver its core mission.

**Independent Test**: Visit the site, open the database page, exercise every filter and sort option against the seeded set of 12 cases, confirm results match expectations, click into a case and verify its detail page renders the rogue profile plus any linked articles. Filter state survives page refresh because it lives in the URL (shareable links).

**Acceptance Scenarios**:

1. **Given** the database page is loaded with 12 seeded cases, **When** the visitor types "orban" (no diacritic) into search, **Then** results matching "Orbán" appear (Hungarian-aware, accent-insensitive search).
2. **Given** the visitor selects status = "Folyamatban" and sector = "Kozbeszerzes", **When** filters apply, **Then** only cases matching both criteria are listed and the result count reflects the filtered set.
3. **Given** the visitor sorts by amount-descending with multiple cases having identical amounts, **When** they page forward and back, **Then** ordering is stable across pages (no duplicates, no skipped rows).
4. **Given** the visitor copies the current URL after applying filters, **When** they paste it into a new browser session, **Then** the same filter state is restored on load.
5. **Given** the visitor clicks a case row, **When** the case detail page renders, **Then** they see the case's name, position, amount (Hungarian-formatted), sentence years, case year, status, region, sector, dates, the associated rogue profile (variant, glasses, hair, detention state, crimes list), and any linked news articles for that case.
6. **Given** filters yield zero results, **When** the page renders, **Then** the visitor sees a clear empty-state message in Hungarian (not a blank page or an error).

---

### User Story 2 — At-a-glance corruption overview on the homepage (Priority: P2)

A first-time visitor lands on the homepage to understand "how much corruption are we tracking?" without having to read any case. They see hero KPIs (total damage in HUF, total prison years, active cases, new indictments this week, partner count), a sector breakdown rendered as donut charts, and a ticker of recent activity. The freshness of the figures ("frissítve X perccel ezelőtt") is visible.

**Why this priority**: Drives the visitor's emotional first impression and primes the rest of the site. Without a working database (User Story 1) the KPIs would be empty, so this is P2; but it is the front door for press, partners, and casual readers.

**Independent Test**: Open the homepage; confirm KPI numbers render, donut charts display sector breakdowns, the freshness label is present, and currency magnitudes use Hungarian conventions (`Ft`, `e Ft`, `M Ft`, `Mrd Ft`).

**Acceptance Scenarios**:

1. **Given** the seeded snapshot exists, **When** the homepage loads, **Then** all five hero KPIs render with non-zero values.
2. **Given** sector breakdown data exists, **When** the homepage renders, **Then** donut charts visualise the breakdown using the same SVG style as the mockup.
3. **Given** an editor (in a future phase) updates a case, **When** the snapshot is refreshed, **Then** the homepage reflects the new totals within a published staleness window (the "frissítve X perccel ezelőtt" label honestly communicates the lag).
4. **Given** a number is in the millions, **When** it renders, **Then** it shows as e.g. `"850 M Ft"`, not as `"850M"` or `"850 millió"` (preserves the mockup's Hungarian magnitude convention).

---

### User Story 3 — Rogues' gallery of top offenders (Priority: P3)

A visitor opens the gallery page to see the "wall of shame" — the top ten cases by amount, each with a recognisable mugshot, charges, and detention state. The visual design echoes the mockup's distinctive style.

**Why this priority**: A high-engagement summary view that drives social sharing and recall. It is downstream of the case database (User Story 1), so it ships after that is in place.

**Independent Test**: Open the gallery page; confirm the top 10 cases by amount render with the correct deterministic mugshot variants and detention labels.

**Acceptance Scenarios**:

1. **Given** 12 cases are seeded, **When** the gallery page loads, **Then** exactly the top 10 by amount render in descending order.
2. **Given** each case has a `RogueProfile`, **When** the gallery renders, **Then** every card shows a mugshot SVG keyed to the profile's `variant` (deterministic — same input always produces the same mugshot).
3. **Given** a case has a detention status of "wanted", **When** its card renders, **Then** the visible detention label matches the mockup convention.

---

### User Story 4 — Deferred-content stub for unbuilt pages (Priority: P3)

A visitor clicks a footer link (Adatvédelem, Módszertan, Sajtó, Partnerek, Csapat, CSV/API export, Támogatás) that is not yet implemented in Phase 1. Instead of a 404 they land on a polite "Hamarosan elérhető" stub that lists which pages are coming and provides a `dpo@korruptometer.hu` contact for data-privacy requests.

**Why this priority**: Live-looking links pointing to 404s damage credibility on a journalism-class site. P3 because it is a small page, but its absence breaks the trust contract.

**Independent Test**: Click every visible footer link from any public page; confirm each resolves to the stub (HTTP 200 with the stub content), no 404s.

**Acceptance Scenarios**:

1. **Given** the visitor is on any public page, **When** they click any footer link in the deferred-content set, **Then** they reach the `Hamarosan elérhető` stub (200 status).
2. **Given** the stub renders, **When** the visitor reads it, **Then** they see (a) which pages are coming, (b) a `dpo@…` mailbox for data-privacy enquiries.

---

### Edge Cases

- **Hungarian search edge cases.** Search must be accent-insensitive both ways: "orban" → "Orbán", "Orbán" → "Orbán". Multi-token queries ("rogan szilárd") match across `name + position + region`.
- **Tied-amount sort stability.** Cursor pagination must remain stable when many cases share the same amount (use a tuple sort key, never amount alone).
- **Empty result sets.** Any filter combination yielding zero rows renders a Hungarian empty-state, not a blank or error page.
- **Currency magnitude boundaries.** Values that straddle bucket boundaries (999 Ft → 1 e Ft, 999 999 Ft → 1 M Ft, 999 M Ft → 1 Mrd Ft) format predictably and identically in test snapshots.
- **Burst traffic.** A traffic spike (e.g. press coverage) must not exhaust database connections — the most common public read paths must be served from cache so unmoving traffic does not translate to database load.
- **Search-bot / scraper abuse.** Repeated `q=`-search requests from a single source must be rate-limited so a scraper cannot grind the search index, while ordinary cached browsing remains uncapped.
- **Cursor-paginated scrape attack.** A scraper can vary cursors to bypass the edge cache; cursor requests are rate-limited per source.
- **Stale snapshot.** The "frissítve X perccel ezelőtt" label must be honest about the actual lag of the cached aggregate snapshot, even if that lag is up to a couple of minutes greater than the underlying snapshot's `computedAt`.
- **Footer-link drift.** A future page rename must not produce a 404; every visible href resolves to either a real page or the `/hamarosan` stub.

## Requirements *(mandatory)*

### Functional Requirements

#### Public read access — case database

- **FR-001**: System MUST expose a publicly browsable database of corruption cases seeded from the mockup's 12 reference cases (see plan, `01-tesla/index.html:1955-2282` pinned at tag `mockup-port-base-v1`).
- **FR-002**: Visitors MUST be able to search cases by free-text query against name, position, and region; search MUST be Hungarian-language-aware (accent-insensitive matching of, e.g., "orban" → "Orbán").
- **FR-003**: Visitors MUST be able to filter the case list by status (Lezárva / Vádemelés / Folyamatban), region, sector, minimum financial damage in HUF, minimum sentence years, and case-year range.
- **FR-004**: Visitors MUST be able to sort the case list by amount (ascending / descending), case-year descending, or name ascending.
- **FR-005**: Filter and sort state MUST be reflected in the URL so any list view is shareable as a link and survives page refresh.
- **FR-006**: System MUST paginate large result sets using a cursor strategy that remains stable across pages even when many rows share the same sort-key value.
- **FR-007**: System MUST provide a case-detail view that shows the full case record, its 1:1 rogue profile (mugshot variant, glasses, hair, detention state, charges list), and any news articles linked to that case.
- **FR-008**: System MUST surface a top-N (default: 10) rogues' gallery page sorted by amount descending; each card MUST show the deterministic mugshot SVG keyed to the rogue profile's variant, the case's detention label, and the case's charges.

#### Aggregate overview

- **FR-009**: System MUST display an aggregate overview on the homepage including: total damage (HUF), total prison years, active cases, new indictments in the trailing week, partner count, and a by-sector breakdown rendered as donut charts.
- **FR-010**: The homepage MUST display the freshness of the aggregate overview as a Hungarian relative-time label ("frissítve X perccel ezelőtt") computed from the snapshot's recorded compute time.
- **FR-011**: For Phase 1, the aggregate snapshot is a single record updated by editorial process out-of-band; the system does not recompute it on the request path. Eventual consistency under approximately two minutes is the acceptable contract for the publicly-cached aggregate response, and the freshness label MUST honestly reflect this lag.

#### Hungarian formatting

- **FR-012**: System MUST format all monetary values in Hungarian currency-magnitude convention: `Ft`, `e Ft`, `M Ft`, `Mrd Ft`. The formatter MUST be deterministic and pinned to the mockup's existing `floor(n / 1eK)` pattern; it MUST NOT delegate to a locale's compact-notation output, since that output has drifted between locale-data versions. Each magnitude bucket MUST be snapshot-tested against fixed inputs so a locale-data update can never silently change the display.
- **FR-013**: System MUST format dates and plain numbers using Hungarian locale conventions.
- **FR-014**: System MUST be a Hungarian-only experience. No locale-routing, no message-catalogue infrastructure, no language switcher; all user-facing strings live inline in components in Hungarian.

#### Performance, availability, and abuse posture

- **FR-015**: The most heavily-trafficked public read endpoints (case list without `q=`, top-N gallery, aggregate snapshot, news list, region list, case detail) MUST be cached at the network edge with explicit, documented cache-lifetime ranges so that ordinary browsing traffic does not produce per-request database load.
- **FR-016**: Free-text search requests (`q=`) MUST be rate-limited per source IP (publicly documented limit) and MUST NOT be cached at the edge.
- **FR-017**: Cursor-paginated requests MUST be rate-limited per source IP (separately from `q=`) because each cursor produces a unique URL that bypasses cache.
- **FR-018**: System MUST expose a public health endpoint that pings the database and reports liveness/readiness; the endpoint MUST never be cached.

#### Accessibility, semantic HTML, and CSP

- **FR-019**: The site MUST use semantic HTML elements (`<main>`, `<nav>`, `<section>` with proper heading hierarchy) and MUST set the document language to Hungarian. The mockup's div-soup structure MUST NOT be carried into the rebuild.
- **FR-020**: All interactive elements MUST be keyboard-navigable with visible focus indicators; icon-only controls MUST carry accessible labels.
- **FR-021**: Colour contrast MUST meet WCAG AA on all public pages.
- **FR-022**: An automated accessibility audit MUST report zero serious or critical violations on every public page (`/`, `/galeria`, `/adatbazis`, `/adatbazis/[id]`, `/hamarosan`); the build pipeline MUST fail on any such violation.
- **FR-023**: System MUST set a strict Content-Security-Policy and complementary security response headers (transport-security, referrer policy, permissions policy, content-type-sniff protection, frame-ancestors none, form-action self, base-uri self) on every public response. The header set MUST be snapshot-checked against the preview deploy and any drift MUST fail the build.

#### Footer and deferred content

- **FR-024**: Every visible link in the footer MUST resolve to a real page (HTTP 200). Links to features that are deferred to later phases (Adatvédelem, Módszertan, Sajtó, Partnerek, Csapat, CSV/API export, Támogatás) MUST point to a single shared `/hamarosan` ("Hamarosan elérhető") stub page; no 404s are permitted on visible navigation.
- **FR-025**: The `/hamarosan` stub MUST list which pages are forthcoming and provide a `dpo@korruptometer.hu` contact for data-privacy enquiries while the dedicated Adatvédelem page is still pending.

#### Source pinning

- **FR-026**: The mockup at `01-tesla/index.html` MUST be pinned via a git tag (`mockup-port-base-v1`) before any port work begins, so that every line-number reference in the implementation plan resolves against a stable snapshot. The live mockup file may continue to evolve as a design playground without invalidating the plan.

### Key Entities *(Phase 1 data model)*

- **Case** — the core record of a corruption case under public scrutiny. Identified by a stable code (e.g. `KM-001`). Carries the suspect's display name, position/role, financial damage in HUF, sentence length in years, the case year, the case status (Lezárva / Vádemelés / Folyamatban), the region, the sector, and the dates of charging and (where applicable) closure. The seed dataset is twelve cases ported from the mockup.
- **RogueProfile** — a 1:1 visual-identity record per case, used by the rogues' gallery and the case-detail page. Carries the mugshot variant (drives the deterministic SVG mugshot), glasses/hair attributes, detention state (e.g. busted / pretrial / loose / wanted / under-investigation), the human-readable detention label, the list of charges, an extra-status note, and an optional override URL for an editor-uploaded mugshot photo.
- **NewsArticle** — a record of a press article relevant to one or more cases. Phase-1 schema only; the scraping and aggregation that populates it ships in Phase 3. Carries a headline, a short excerpt (no full body, by editorial-ethics design), the source slug, the original source URL plus a canonicalised form for deduplication, the publication time, a thematic tag, a featured flag, an optional link to a related case, an editor-override flag (so editor decisions are never stomped by automated re-linking in later phases), and an aggregator-generated link-confidence score. The body of the article is intentionally never stored.
- **Source** — a press outlet from which `NewsArticle` rows originate (e.g. Telex, 444, HVG, Magyar Hang, Átlátszó). Carries the slug, display name, homepage URL, optional logo, an enabled flag, and last-scrape timing fields. Seeded with the five outlets named in the plan.
- **KpiSnapshot** — a single-row aggregate record consumed by the homepage. Carries the compute time, total damage, total prison years, active-case count, new-indictments-this-week count, partner count, and the sector-breakdown payload that powers the donut charts. Phase-1 contract is a manually-maintained record; the automatic recompute pipeline ships in Phase 3.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can locate a specific case by typing a partial name (with or without diacritics) and reach its detail page in **under 30 seconds** of opening the homepage.
- **SC-002**: 95% of search requests return results in **under 1 second** under typical conditions; 95% of filter-only (no-search) list requests return in **under 400 milliseconds** under sustained 100-requests-per-second traffic.
- **SC-003**: Every footer link on every public page resolves to a real page; **zero broken links** detected by an automated crawl on the preview deploy.
- **SC-004**: Automated accessibility scan reports **zero serious or critical issues** across all public pages (`/`, `/galeria`, `/adatbazis`, `/adatbazis/[id]`, `/hamarosan`); CI gate enforces this.
- **SC-005**: Currency-magnitude formatter renders **100% of test inputs** correctly across `Ft`, `e Ft`, `M Ft`, and `Mrd Ft` magnitude buckets, verified by snapshot tests against fixed inputs.
- **SC-006**: Under a 60-second 100-RPS burst against the case-list endpoint mixing search, filter, and cursor traffic, the system maintains **0% error rate** and database connection count stays below the configured pool ceiling.
- **SC-007**: A user who applies filters and shares the resulting URL with a colleague gives that colleague **the identical view** on first load — filter state is fully encoded in the URL, never in private session storage.
- **SC-008**: Aggregate snapshot freshness, as reported by the homepage label, **never overstates** how recently the data was computed (the label may show a value up to ~2 minutes more stale than reality due to the public cache's TTL, but it must not show a fresher value than the underlying snapshot's computed-at).
- **SC-009**: Free-text search and cursor-pagination endpoints reject the **101st request per minute** from a single source IP with a clear rate-limit response, while non-`q=` non-cursor requests at the same IP remain unaffected (because they are served from cache).

## Assumptions

- **Scope is Phase 1 only.** Public submissions, editor admin, news scraping, aggregator, KPI rollup worker, and durable submission encryption are explicitly later-phase scope (Phases 2–4 of the plan) and out of scope for this spec.
- **Hungarian-only.** No internationalisation infrastructure ships in Phase 1; all content is Hungarian. Adding a second locale later, if ever, is a deliberate and separate decision.
- **Twelve seeded cases.** The Phase 1 dataset is the twelve cases ported from the mockup; the catalogue grows via manual editorial entry until Phase 2 ships the public submission workflow.
- **Read-only.** No write paths are exposed publicly; every Phase 1 endpoint is a public read.
- **Deterministic mugshots by default.** The default rogues' gallery rendering is a deterministic SVG generator keyed on `RogueProfile.variant`. Editor-uploaded photos (`Case.mugshotUrl`) are an opt-in override that ships only with the Phase 2 admin workflow; in Phase 1 the SVG is always shown.
- **News articles are seeded but not surfaced via a list page.** The `NewsArticle` and `Source` schemas exist in Phase 1 (and the case-detail page renders any articles already linked to a case), but the standalone `/hirek` page and the scrapers that populate it ship in Phase 3.
- **`KpiSnapshot` is manually maintained.** A single seed row is shipped; updates are made out-of-band by an editor until the Phase 3 worker takes over the recompute responsibility. The "frissítve X perccel ezelőtt" label honestly reflects this.
- **Mockup pinned to a git tag.** The implementation pins `01-tesla/index.html` at `mockup-port-base-v1` before porting; subsequent edits to the mockup do not retroactively change the port.
- **Deferred-content links share one stub.** Every footer link to a feature that has not shipped points to `/hamarosan`. There is no per-feature stub page in Phase 1.
- **Edge caching is the primary load defence.** The site assumes a cache layer in front of the application can absorb burst traffic on the cacheable read paths; the database is sized for the cache-miss long tail plus search and cursor traffic, not for raw burst RPS.

## Out of Scope

These items appear in the source plan but are **not** part of this specification. Each is expected to be its own future feature spec.

- **Phase 2** — public submission intake (`/bejelentes`), Cloudflare Turnstile gating, attachment uploads, virus scanning, GDPR retention sweep, editor authentication, editor admin UI, audit log, WebAuthn passkey step-up for the admin role, all Phase-2 trust-posture launch gates.
- **Phase 3** — outlet news scrapers, article-to-case aggregator with confidence thresholds, hourly KPI rollup worker with advisory locks, scraper observability dashboard, the `/hirek` standalone news page, per-queue dead-letter queues and alerts.
- **Phase 4** — durable client-side libsodium sealed-box submission encryption with per-editor unsealing.
- **Catalogue item 7** — footer/methodology static pages, public CSV/API export, donations, partners/team/sajtó pages. (The `/hamarosan` stub stands in for all of these in Phase 1 per FR-024 / FR-025.)
- **OAuth providers** for editor sign-in (GitHub, Google) — magic-link only when editor auth eventually ships.
- **Mobile-native app** — responsive web is the target; no separate mobile codebase.
- **Trend / historical KPI charts** — `KpiSnapshot` is single-row by design; introducing a `KpiHistory` append-only table is a separate decision.
- **Hungarian-language stemming via `hunspell_hu`** — accent-insensitive matching is acceptable for Phase 1 search quality.
