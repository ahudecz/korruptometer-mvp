# Feature Specification: Korruptométer — Public Site, Submissions, Editorial Pipeline, and Durable Encryption (Phases 1–4)

**Feature Branch**: `001-korruptometer-mvp`
**Created**: 2026-04-30
**Status**: Draft
**Input**: User description: "based on ~/.claude/plans/create-a-plan-for-zippy-reef.md"

> **Scope note.** The reference plan (`~/.claude/plans/create-a-plan-for-zippy-reef.md`) is structured as four phases, and this specification now covers **all four**: Phase 1 (the read-only public site that turns the static mockup at `01-tesla/index.html` into a real, dynamic Hungarian corruption-tracking site backed by a real database), Phase 2 (public submission intake + editor admin gated by the trust-posture launch prerequisites), Phase 3 (news scrapers + article-to-case aggregator + KPI rollup worker), and Phase 4 (durable client-side libsodium sealed-box submission encryption with per-editor unsealing). The first set of top-level sections below describes **Phase 1**. Subsequent top-level sections (`## Phase 2 …`, `## Phase 3 …`, `## Phase 4 …`) extend the specification with the user stories, requirements, key entities, success criteria, and assumptions specific to each later phase. Each phase is independently shippable in plan order; see **Out of Scope** at the bottom for what remains deferred across all phases.

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

## Phase 2 — Public Submissions and Editorial Admin

Phase 2 turns the read-only Phase 1 site into a place where the public can report corruption and where allowlisted editors triage those reports. It is gated by a set of trust-posture prerequisites — the form must not promise more than the system delivers, and the GDPR retention story must be credible end-to-end before launch.

### User Scenarios — Phase 2

#### User Story 2.1 — Anonymous citizen submits a corruption tip (Priority: P1)

A citizen who knows about a corruption case (or has documentary evidence of one) opens `/bejelentes`, fills in suspect details (name, position, region, period, suspected crimes, estimated amount), describes the case in free text, optionally attaches up to ten supporting files, decides whether to remain anonymous or to leave a contact, reads an honest description of what the platform does and does not do with their data, completes a Cloudflare Turnstile challenge, and submits. The system returns a stable reference number (`KM-NEW-XXXXXX`) so they can refer to the report later.

**Why this priority**: Public submission intake is the entire reason Phase 2 exists. Without it, the site is a static catalogue of editorially-known cases.

**Independent Test**: From a clean browser session, submit a test report with two attachments through the live form; confirm a reference number is returned, the report appears in the editor admin queue with attachments downloadable, the form copy on screen matches the trust-posture text exactly, no IP address has been written to the database, and the reporter PII columns are unreadable bytea.

**Acceptance Scenarios**:

1. **Given** the visitor is on `/bejelentes` and fills the required fields, **When** they pass the Turnstile challenge and submit, **Then** a `Submission` row is created and a `KM-NEW-XXXXXX` reference is shown.
2. **Given** the visitor uploads two attachments under the per-file size cap, **When** the submission is accepted, **Then** both files appear under the submission in `/admin` and an authenticated editor can download them via signed URLs once the virus scan reports them clean.
3. **Given** the visitor attempts to attach an eleventh file, **When** the JSON submission is sent, **Then** the request is rejected with HTTP 400 and any surplus storage objects already uploaded under presigned policies are reaped by the next retention sweep.
4. **Given** the visitor attempts to upload a file exceeding the per-file size cap, **When** the upload begins, **Then** the storage layer rejects at upload time because the presigned policy enforces a content-length-range.
5. **Given** the visitor uploads an EICAR test file, **When** the virus-scan completes, **Then** the submission is auto-rejected, the storage object is quarantined, and the editor channel receives an alert.
6. **Given** the visitor submits anonymously, **When** the row is written, **Then** the reporter PII columns are null and no contact identity has been retained anywhere outside short-lived platform access logs.
7. **Given** the visitor opts in to be contacted and provides email, **When** the row is written, **Then** the contact fields are stored encrypted at rest (non-readable bytea by direct database inspection without the key).
8. **Given** the visitor reads the form copy, **When** they look for promises about IP storage and retention, **Then** they see the trust-posture text exactly: *"A bejelentésedet titkosítva tároljuk és csak a szerkesztőség férhet hozzá. Az IP-címedet az adatbázisban nem tároljuk; CDN- és platformszintű hozzáférési naplók ideiglenesen rögzíthetik, ezeket legfeljebb 7 napig őrizzük. Súlyosan bizalmas anyagokhoz használj Tor-böngészőt."*
9. **Given** the visitor sends four submissions within a sixty-second window from the same source IP, **When** the fourth submission is sent, **Then** it is rejected with HTTP 429 and a clear rate-limit response.
10. **Given** the visitor sends 101 submissions within a 24-hour window from the same source IP, **When** the 101st is sent, **Then** it is rejected with HTTP 429 (a forgiving daily cap so shared NAT does not punish a whole organisation).

---

#### User Story 2.2 — Editor reviews and triages submissions (Priority: P1)

An allowlisted editor opens `/admin`, signs in with a magic link sent to their email, reviews the queue, opens a submission, sees the (decrypted) reporter contact details if present, downloads attachments via short-lived signed URLs once the virus scanner has cleared them, and chooses one of: approve (creating a new public Case), reject, or mark duplicate (linking to an existing Case). Every decryption of reporter PII produces an audit-log entry.

**Why this priority**: Without an editor workflow, public submissions pile up unreviewed and the public promise of editorial moderation collapses.

**Independent Test**: As the bootstrap admin, sign in with magic link, satisfy the WebAuthn passkey step-up, render the queue, open a submission, view its decrypted PII (which writes a `pii.read` audit-log row), approve it; confirm a new Case row appears on `/adatbazis` and the submission's `purgePiiAt` is set to today + 30 days.

**Acceptance Scenarios**:

1. **Given** an allowlisted editor's email matches an active Editor row, **When** they complete a magic-link sign-in, **Then** they reach `/admin` with a session.
2. **Given** a non-allowlisted email, **When** the magic-link callback runs, **Then** the session is rejected and the editor sees a clear "your email is not on the editor allowlist" message.
3. **Given** the editor renders the review queue, **When** any decrypted reporter PII field is shown on screen, **Then** an `AuditLog` row with `action = 'pii.read'`, `entityType = 'Submission'`, the submission id, and the editor's id is written.
4. **Given** the editor approves a submission, **When** the action commits, **Then** a Case row (and its RogueProfile) is created, `Submission.status` becomes `approved`, `purgePiiAt` is set to thirty days from now, an audit-log entry is written, and a KPI-rollup recompute is enqueued.
5. **Given** the editor rejects a submission, **When** the action commits, **Then** `Submission.status` becomes `rejected`, `purgePiiAt` is set to thirty days from now, and an audit-log entry is written.
6. **Given** the editor marks a submission a duplicate of an existing case, **When** the action commits, **Then** `Submission.status` becomes `duplicate`, `createdCaseId` is linked to the existing case, and the row is treated identically to a rejection for retention purposes.
7. **Given** a session belonging only to the `editor` role, **When** the editor attempts an admin-only action (manage editors, view audit log), **Then** the request is denied with HTTP 403.
8. **Given** an admin session without a fresh (≤ 30 minutes) WebAuthn passkey assertion, **When** the admin attempts an admin-gated action, **Then** the request is denied with HTTP 401, even though the session is otherwise valid.

---

#### User Story 2.3 — Bootstrap admin and editor onboarding (Priority: P2)

The bootstrap admin (whose email is configured at deploy time) is created idempotently by seed. After signing in for the first time, the admin registers a passkey on their device, then invites additional editors via `/admin/editors`. Each invitation creates a new Editor row and writes an audit-log entry; the invited editor signs in with magic link, receives the `editor` role, and is admitted to the queue.

**Why this priority**: Onboarding is small but it gates the multi-editor newsroom workflow and the WebAuthn admin step-up. P2 because the very first deploy is single-admin by definition.

**Independent Test**: Run seed against a clean database with `BOOTSTRAP_ADMIN_EMAIL` set; confirm exactly one Editor row exists with role `admin`. Re-run seed; confirm no second admin row was created. Add a second editor via `/admin/editors`; sign in as the new editor; confirm they reach the review queue but cannot reach editor-management routes.

**Acceptance Scenarios**:

1. **Given** seed runs against a clean database, **When** bootstrap completes, **Then** exactly one Editor row exists with role `admin` and the configured email.
2. **Given** seed re-runs, **When** the bootstrap idempotency is checked, **Then** no second admin row is created or modified.
3. **Given** the admin opens `/admin/editors` and adds a new editor email, **When** the action commits, **Then** an Editor row is created with role `editor` and `active = true`, and an audit-log entry records the addition.
4. **Given** the new editor signs in with magic link, **When** the email matches the new row, **Then** they reach `/admin` and can review submissions, but admin-only routes return HTTP 403.
5. **Given** the only admin loses their passkey-bearing device, **When** recovery is required, **Then** the documented admin-recovery runbook (a Phase 2 launch prerequisite) describes how to re-issue admin access via a fresh `BOOTSTRAP_ADMIN_EMAIL` deploy with out-of-band identity verification, and the bootstrap flow writes an audit-log entry on the resulting admin re-creation.

---

#### User Story 2.4 — Stale submissions surface to editors (Priority: P2)

A submission stuck in `received` for more than fourteen days, or in `in_review` for more than thirty days, raises a banner on `/admin` and is included in a daily Slack digest sent to the editor webhook so the alert lands even on days when no editor logs in.

**Why this priority**: GDPR retention requires editorial movement to enter a purge path; whistleblower signal must not be auto-discarded just because a queue went quiet. The double alert (in-app banner plus daily digest) makes silence impossible.

**Independent Test**: Backdate a `received` submission to fifteen days old and an `in_review` submission to thirty-one days old; render `/admin` (banner appears) and run the daily retention sweep manually (a single Slack digest message is posted listing both buckets).

**Acceptance Scenarios**:

1. **Given** a `received` submission older than fourteen days exists, **When** an editor renders `/admin`, **Then** a banner identifies it as stale.
2. **Given** at least one stale submission exists in any bucket, **When** the daily retention sweep runs, **Then** a single Slack digest message is posted to the editor webhook listing the per-bucket counts.
3. **Given** every submission is within its stale threshold, **When** the daily retention sweep runs, **Then** no Slack digest is posted (silence on quiet days, alerting on noisy ones).

---

#### User Story 2.5 — GDPR retention sweep purges PII on schedule (Priority: P1)

A daily worker runs the retention sweep that, in order: (1) purges PII columns and attachments for approved, rejected, and duplicate submissions past their thirty-day retention; (2) hard-deletes orphan storage objects older than seven days that have no submission row; (3) emits the stale-state Slack digest from User Story 2.4; (4) drops or detaches audit-log partitions older than twenty-four months. PII-read audit rows are retained for the full twenty-four-month window even after the underlying submission is purged.

**Why this priority**: Legal compliance and the credibility of the trust-posture promise depend on this job running. Without it, the form copy is a lie.

**Independent Test**: Seed an approved submission, a rejected submission, and a duplicate submission, all with `purgePiiAt` thirty-one days in the past. Run the retention sweep manually. Confirm: PII columns are nulled in all three rows, every `SubmissionAttachment` row is gone, all underlying storage objects are gone, audit-log rows for those submissions remain only where `action = 'pii.read'`, and an orphan storage object older than seven days (with no DB row) is hard-deleted in the same run.

**Acceptance Scenarios**:

1. **Given** an approved submission with `purgePiiAt` in the past, **When** the sweep runs, **Then** `reporterEmailEnc` and `reporterNameEnc` are nulled, every `SubmissionAttachment` row is deleted, and every storage object under that submission is removed.
2. **Given** a rejected submission past retention, **When** the sweep runs, **Then** PII columns are nulled and attachments are removed; the row remains for forensic continuity with no PII.
3. **Given** a duplicate submission past retention, **When** the sweep runs, **Then** it is treated identically to a rejection.
4. **Given** an orphan storage object older than seven days with no `SubmissionAttachment` row, **When** the sweep runs, **Then** the orphan is hard-deleted in the same run.
5. **Given** a `received` submission with a real `SubmissionAttachment` row whose object is older than seven days, **When** the sweep runs, **Then** the object is **not** touched (the no-auto-purge rule for `received` and `in_review` is preserved).
6. **Given** audit-log rows older than twenty-four months, **When** the sweep runs, **Then** partitions older than the cutoff are dropped or detached; rows tagged `action = 'pii.read'` are retained for the full window.

---

### Edge Cases — Phase 2

- **Virus-scan provider outage.** When the scanning service is unreachable for an extended window, jobs retry with backoff up to five attempts; on exhaustion, the attachment stays in a "pending scan" state and the editor admin shows a banner that scanning is currently unavailable. Editors must not download attachments until the scan resolves; the submission is **not** auto-rejected.
- **Forged content-length range.** A client tries to upload a file larger than the policy by tampering with the policy form fields; the storage layer rejects at upload because the policy is signed. As defense in depth, the intake worker re-reads the object's `Content-Length` and deletes oversized objects before queuing them for scanning.
- **Attachment-cap bypass attempt.** A client uploads eleven objects out-of-band before sending a JSON `POST /api/submissions` carrying all eleven; the submission is rejected with HTTP 400 and the eleven orphans are reaped on the next retention-sweep run.
- **"Verified human" cookie sharing.** A single Turnstile pass cannot unlock unlimited submissions; the cookie doubles the per-minute and per-day limits, never removes them.
- **Sentry default capture surfaces PII.** A forced error from `/bejelentes` must produce a Sentry event with no request body, no IP, and no cookies — verified at every deploy; otherwise the trust-posture promise leaks PII through the error reporter.
- **Single-admin passkey loss.** When the only admin loses their passkey device, recovery follows a documented runbook (out-of-band identity verification, fresh `BOOTSTRAP_ADMIN_EMAIL` redeploy, audit-log entry, post-recovery requirement to add a second admin's passkey within twenty-four hours) — not an emergency.
- **Subject-access request before queue UI exists.** GDPR's thirty-day clock starts at receipt at `dpo@korruptometer.hu`, not at the Phase 3 queue UI launch; Phase 2 ships with a written DSR runbook covering intake, identity verification, and fulfillment templates.
- **Editor reads a `pii.read`-purged submission.** When a sweep has nulled PII on a row whose `pii.read` audit entries are retained, the queue must render an explicit "PII has been purged per retention policy" state rather than a blank or error.

### Functional Requirements — Phase 2

#### Public submission intake

- **FR-027**: Public submission form at `/bejelentes` MUST accept structured fields (suspect name, optional position, optional region, optional period, crimes list, optional estimated amount), a free-text summary, optional source URLs, an anonymity flag, an allow-contact flag, and zero to ten attachments.
- **FR-028**: Every submission request MUST be gated by a server-verified Cloudflare Turnstile token; missing or failed tokens MUST result in rejection.
- **FR-029**: Attachment uploads MUST use server-issued presigned upload policies that enforce a per-file size cap (25 MB) and a content-type allowlist at the storage layer before the file is persisted.
- **FR-030**: Per-submission attachment count MUST be enforced server-side at submission time (≤ 10 files); requests exceeding the cap MUST be rejected with HTTP 400.
- **FR-031**: Submission rate limits per source IP MUST be enforced: an environment-tunable per-minute cap (default 3) AND an environment-tunable per-day cap (default 100). A "verified human" cookie issued after a successful Turnstile pass within the last twenty-four hours MUST double both caps for the cookied browser.
- **FR-032**: The presigned upload-URL endpoint MUST be rate-limited per source IP (default 30 requests / hour) independently of the submission rate limit.
- **FR-033**: Reporter contact PII (email and display name) MUST be stored encrypted at rest using a server-held symmetric key; direct database inspection without the key MUST NOT recover plaintext.
- **FR-034**: All attachments MUST be virus-scanned by a managed scanning service before any editor is allowed to download them; infected files MUST cause the submission to be auto-rejected and the storage object to be quarantined.
- **FR-035**: When the scanning service is unreachable beyond the configured retry budget, attachments MUST remain in a pending-scan state, the admin queue MUST display a clear banner that scanning is unavailable, and the submission MUST NOT be auto-rejected.
- **FR-036**: Form copy at `/bejelentes` MUST match the trust-posture text exactly (full Hungarian text quoted in User Story 2.1 acceptance scenario 8); a snapshot test MUST fail the build on any drift.
- **FR-037**: Every public-platform access log holding submission-page traffic (web host logs, CDN logs, log drain) MUST be configured with retention ≤ 7 days; the configuration MUST be tracked in repository documentation and audited at every deploy.
- **FR-038**: Error-reporter event capture from public and admin routes MUST scrub request body, query string, cookies, and any header whose name matches the regex `/email|name|reporter|ip|x-forwarded/i`; the SDK MUST be configured with `sendDefaultPii: false` plus `beforeSend` and `beforeSendTransaction` hooks that drop these fields. A forced-error verification (executed at every deploy) MUST confirm the produced event contains none of these.
- **FR-039**: Every accepted submission MUST receive a stable, visible reference identifier (e.g., `KM-NEW-XXXXXX`) and that reference MUST be displayed to the reporter on success.

#### Editor authentication and admin gating

- **FR-040**: Editor sign-in MUST be magic-link only; sign-in MUST be rejected if the email is not present in the Editor allowlist with `active = true`.
- **FR-041**: Admin-gated routes (manage editors, manage cases, manage news, view audit log, view DSR queue) MUST require BOTH a valid editor session AND a fresh (≤ 30 minutes) WebAuthn passkey assertion stored in a separate signed cookie. Without the fresh assertion, admin routes MUST return HTTP 401.
- **FR-042**: Admin-only actions MUST be denied to sessions holding only the `editor` role and MUST return HTTP 403.
- **FR-043**: A bootstrap admin MUST be created idempotently from `BOOTSTRAP_ADMIN_EMAIL` at seed time; re-running seed MUST NOT create a duplicate row.
- **FR-044**: A documented admin-recovery runbook MUST exist before Phase 2 launch describing the single-admin passkey-loss recovery path (out-of-band identity verification, fresh `BOOTSTRAP_ADMIN_EMAIL` redeploy, exact deploy command, the audit-log entry the bootstrap flow writes, and the requirement to add a second admin's passkey within twenty-four hours).

#### Editor admin workflow

- **FR-045**: Editor admin MUST expose a review queue page that lists submissions with filters and pagination.
- **FR-046**: Approving a submission MUST: create a corresponding `Case` (and `RogueProfile`), set `Submission.status = 'approved'`, set `purgePiiAt` to thirty days from now, write an audit-log entry, and enqueue an asynchronous KPI-rollup recompute.
- **FR-047**: Rejecting a submission MUST set `status = 'rejected'`, set `purgePiiAt` to thirty days from now, and write an audit-log entry.
- **FR-048**: Marking a submission a duplicate MUST set `status = 'duplicate'`, link `createdCaseId` to the matched case, and treat retention identically to a rejection.
- **FR-049**: Every editor render of decrypted reporter PII MUST write an audit-log entry with `action = 'pii.read'`, `entityType = 'Submission'`, the submission id, and the editor id.
- **FR-050**: Every admin mutation that affects KPI totals MUST enqueue an asynchronous KPI rollup; the request path MUST NOT recompute the snapshot synchronously.
- **FR-051**: Every admin write that changes or clears `NewsArticle.relatedCaseId` MUST set `linkOverridden = true` in the same transaction so subsequent automated re-linking does not stomp the editor's decision (this requirement also applies to Phase 3 once the aggregator ships).

#### Retention, audit, and data subject rights

- **FR-052**: A daily retention sweep MUST run four passes in order: (1) purge PII columns and attachments for approved, rejected, and duplicate submissions past their thirty-day retention; (2) hard-delete orphan storage objects older than seven days that have no `SubmissionAttachment` row; (3) emit a stale-state Slack digest covering submissions stuck in `received` for more than fourteen days or `in_review` for more than thirty days; (4) drop or detach audit-log partitions older than twenty-four months.
- **FR-053**: Submissions in `received` or `in_review` status MUST NOT have their PII or attachments auto-purged on any time floor; PII removal MUST require explicit editor progression to `approved`, `rejected`, or `duplicate`.
- **FR-054**: Audit-log rows tagged `action = 'pii.read'` MUST be retained for the full twenty-four-month window even after the underlying submission row is purged.
- **FR-055**: A subject-access / deletion-request runbook MUST exist before Phase 2 launch (intake at the published DPO mailbox, identity verification, fulfillment templates, audit log entries, thirty-day SLA).
- **FR-056**: At least one Postgres backup-and-restore drill MUST be completed and documented before Phase 2 launch (target RPO ≤ 5 min, RTO ≤ 1 h).
- **FR-057**: At least one submission-storage backup-and-restore drill MUST be completed before Phase 2 launch.
- **FR-058**: A documented PII threat-model MUST exist before Phase 2 launch stating plainly that the symmetric-key control defends against offline backup leaks where the key is held separately, NOT against an attacker with application-server access; the durable Phase 4 control is the actual mitigation against backend compromise.
- **FR-059**: All public submission and admin pages MUST ship with the strict Content-Security-Policy and the complementary security headers defined for Phase 2 onward (transport-security, referrer policy, permissions policy, content-type-sniff protection, frame-ancestors none, form-action self, base-uri self); a snapshot test MUST run against the preview deploy and fail the build on drift.

### Key Entities — Phase 2

- **Submission** — An incoming public report. Carries a stable reference (`KM-NEW-XXXXXX`), suspect details (name, optional position, optional region, optional period, crimes list, optional estimated amount), free-text summary, optional source URLs (text array), anonymity flag, allow-contact flag, encrypted reporter email and name (bytea, server-held symmetric key), status (received / in_review / approved / rejected / duplicate), reviewer link, review timestamp, editor notes, optional link to the created case (when approved), creation timestamp, and `purgePiiAt` retention deadline set on approve / reject / duplicate.
- **SubmissionAttachment** — A file attached to a submission. Carries the storage object key, the original filename, the MIME type, the byte size, the virus-scan status (pending / clean / infected / error), and any scanner result string.
- **Editor** — An allowlisted person with admin access. Carries email, display name, role (`editor` / `admin`), active flag, creation timestamp. Magic-link only at Phase 2; OAuth providers deferred. The bootstrap admin row is created idempotently from `BOOTSTRAP_ADMIN_EMAIL` at seed time.
- **AuditLog** — Append-only record of editorial actions and every PII read. Carries the actor editor id (nullable for anonymized rows), an action verb, an entity-type / entity-id pair, a JSON diff of the change, the timestamp, and an optional hashed actor IP. The table is range-partitioned by month so the twenty-four-month retention sweep drops or detaches old partitions instead of scanning a single huge table; rows tagged `action = 'pii.read'` are retained for the full window even after the underlying submission row is purged.

### Success Criteria — Phase 2

- **SC-010**: A public submission with two attachments completes end-to-end (Turnstile pass → upload → JSON POST → reference shown) in **under 60 seconds** on a normal connection.
- **SC-011**: 100% of accepted submissions appear in the editor admin queue within **30 seconds** of acceptance under normal load.
- **SC-012**: The 4th submission within a 60-second window from a single source IP is rejected with HTTP 429; the 101st submission within a 24-hour window is also rejected with HTTP 429; non-submission traffic from the same IP is unaffected.
- **SC-013**: An EICAR-flagged test attachment causes the submission to be auto-rejected and its storage object quarantined **within 2 minutes** of upload completion.
- **SC-014**: A forced error from `/bejelentes` produces an error-reporter event containing **zero** of: request body, query string, cookies, or any header matching the configured PII pattern.
- **SC-015**: Every editor render of decrypted reporter PII produces an `AuditLog` row with `action = 'pii.read'` — verified at **100% coverage** by integration test.
- **SC-016**: When the retention sweep runs against a seeded set of approved, rejected, and duplicate submissions whose `purgePiiAt` has passed, **all** PII columns are nulled and **all** attachments are removed in a single run with **0 omissions**.
- **SC-017**: An orphan storage object older than seven days with no DB row is deleted by the next retention sweep; a `received` submission with a real DB row whose object is older than seven days is **not** touched.
- **SC-018**: An admin route accessed without a fresh (≤ 30 minutes) WebAuthn passkey assertion returns **HTTP 401** in 100% of attempts; access with a valid assertion succeeds.
- **SC-019**: Platform access-log retention for every system handling submission-page traffic is verified ≤ **7 days** at every deploy; CI fails on drift.
- **SC-020**: At least **one** Postgres restore drill and **one** submission-storage restore drill have been completed and documented before Phase 2 ships.
- **SC-021**: A daily Slack digest is delivered to the editor webhook on every day when at least one submission is stale (`received` > 14 days or `in_review` > 30 days) and is **suppressed** on every day when none is stale.

### Assumptions — Phase 2

- **Magic-link only.** Editor sign-in is magic-link; OAuth providers (GitHub, Google) are deferred until an editor specifically asks for them.
- **Passkeys for `admin`, not `editor`.** WebAuthn passkey step-up gates the `admin` role only; non-admin editors continue to use magic-link alone — the threat model accepts this for non-admin scope.
- **Server-side symmetric encryption is interim.** `PII_ENC_KEY` is the Phase 2 control against offline backup leaks where the key is separable. The threat model documents that Phase 4 is the durable answer to backend compromise; the rewritten form copy reflects this honestly.
- **Cloud-managed virus scanning.** No self-hosted scanner daemon ships in Phase 2; a documented vendor-replace path exists.
- **Storage lifecycle rules are explicitly NOT configured** on the submissions bucket; the DB-aware retention sweep is the sole authority for happy-path deletion (a blunt time-floor would conflict with the no-auto-purge rule for `received` and `in_review`).
- **Trust-posture launch gates are mandatory.** All of: rewritten form copy, ≤7-day platform log retention, `PII_ENC_KEY` access lockdown and rotation runbook, error-reporter PII scrubbing, Postgres restore drill, storage restore drill, DSR runbook, admin-recovery runbook, security-headers snapshot test — MUST be green before Phase 2 ships.

---

## Phase 3 — News Scrapers, Aggregator, and KPI Rollup

Phase 3 turns Phase 2's editorially-curated catalogue into a live, continually-updated picture of what the Hungarian press is reporting about corruption, and replaces Phase 1's manually-maintained `KpiSnapshot` with an automatic rollup worker. It also formalises Phase 2's manual DSR mailbox into an audit-tracked queue.

### User Scenarios — Phase 3

#### User Story 3.1 — Continually-updated news feed of articles from major HU outlets (Priority: P1)

A visitor opens `/hirek` to see recent articles about Hungarian corruption from the seeded outlets (Telex, 444, HVG, Magyar Hang, Átlátszó). Each card shows the headline, a short excerpt (capped to 280 characters), the source slug, the publication time, an optional thematic tag, and a link to the original article. The full article body is never shown — clicking the link opens the source.

**Why this priority**: News surfacing is the core Phase 3 deliverable that turns the database from static-feeling to alive.

**Independent Test**: Trigger a manual scrape against each enabled outlet; confirm `NewsArticle` rows appear, no body text has been stored, the cards on `/hirek` link out to the original articles, and filters by outlet and tag narrow the list correctly.

**Acceptance Scenarios**:

1. **Given** at least one scheduled scrape has run successfully against each enabled outlet, **When** `/hirek` loads, **Then** articles from each enabled outlet appear sorted by publication time descending, with paged navigation.
2. **Given** any persisted article, **When** the page renders, **Then** only headline, ≤ 280-character excerpt, source slug, publication time, optional tag, and outbound link are shown — never a full body.
3. **Given** the visitor filters by outlet and tag, **When** the filter is applied, **Then** the result list narrows accordingly and the URL encodes the filter so it is shareable.

---

#### User Story 3.2 — Linked articles surface on the relevant case (Priority: P2)

A visitor on a case-detail page sees a list of news articles the aggregator has linked to that case (with confidence above the auto-link threshold), plus any articles an editor has manually linked or relinked. Editor decisions survive subsequent aggregator runs.

**Why this priority**: The aggregator is what turns disconnected articles into a story attached to a case. Editor-protected linking is the contract that makes the automated pipeline trustworthy.

**Independent Test**: Run the aggregator after a scrape and confirm articles whose match score exceeds the auto-link threshold get `relatedCaseId` set automatically; manually relink one article via the admin endpoint and confirm the next aggregator run preserves the editor's decision.

**Acceptance Scenarios**:

1. **Given** the aggregator runs after a scrape, **When** an article matches a case at or above the auto-link threshold, **Then** `relatedCaseId` is set and `linkConfidence` is recorded on the row.
2. **Given** the aggregator runs and an article matches between the review threshold and the auto-link threshold, **When** the run completes, **Then** `linkConfidence` is recorded but `relatedCaseId` is NOT auto-set; the article surfaces for editor review.
3. **Given** an editor manually re-links or clears `relatedCaseId` via the admin API, **When** the next aggregator run executes, **Then** the editor's value is preserved (the article is skipped because `linkOverridden = true`).

---

#### User Story 3.3 — Hourly KPI rollup keeps the homepage automatically fresh (Priority: P1)

The single-row `KpiSnapshot` is recomputed by an hourly worker job, and additionally by every admin mutation that affects the totals (debounced and serialized via a Postgres advisory lock). After every successful rollup, the cached `/api/stats` payload is invalidated so the homepage picks up the new totals within the documented public-cache window. The freshness label on the homepage continues to honestly reflect the lag.

**Why this priority**: Phase 1's snapshot is manually maintained and goes stale every time an editor approves a case. Automating the rollup is what makes the homepage trustworthy after Phase 2 ships submission-driven mutations.

**Independent Test**: Approve a submission as an editor; observe the rollup job get enqueued, observe `KpiSnapshot.computedAt` advance within ten seconds (debounced), observe the cached `/api/stats` payload be invalidated, and confirm the homepage label correctly reports the new lag without ever overstating freshness.

**Acceptance Scenarios**:

1. **Given** the rollup is scheduled hourly, **When** the cron fires, **Then** `KpiSnapshot.computedAt` advances and the totals reflect current database state.
2. **Given** an admin mutation that affects totals (approve, edit, delete), **When** the rollup-enqueue runs, **Then** the snapshot updates within approximately ten seconds (debounced job-id collapsing) and the cached `/api/stats` payload is invalidated.
3. **Given** multiple rollup jobs run concurrently, **When** they overlap, **Then** a Postgres advisory lock keyed by a single named constant ensures the rollups serialize and no inconsistent snapshot is written.
4. **Given** the public `/api/stats` cache TTL, **When** a rollup completes, **Then** the homepage's "frissítve X perccel ezelőtt" label may show up to one cache TTL more stale than reality, but **never overstates** how recently the data was computed.

---

#### User Story 3.4 — Scrapers run reliably with editor-visible observability (Priority: P2)

An editor opens `/admin/scraper-runs` to see, per source, when it was last scraped, when it last succeeded, how many articles were found and how many were new on the most recent run, the consecutive-failure counter, and any error payload. Outlets that fail five times in a row auto-disable and post an alert to the editor channel.

**Why this priority**: Without observability, silent rot in a scraper (a parser-stops-finding-articles regression after an outlet redesign) is invisible until the editor notices the news feed has gone quiet.

**Acceptance Scenarios**:

1. **Given** the dashboard, **When** an editor renders it, **Then** every enabled source shows last-scraped time, last-success time, consecutive-failures count, articles-found / articles-new for the most recent run, and any error payload from that run.
2. **Given** an outlet is forced to fail five consecutive runs, **When** the fifth failure commits, **Then** the source is auto-disabled (no further scrape jobs enqueued) and an alert is posted to the editor channel.
3. **Given** any background job exhausts its retry budget, **When** the final attempt fails, **Then** the run lands in the failed-runs / dead-letter view, the exception is captured in the error reporter, and an alert fires on dead-letter / failed-runs depth > 0.

---

#### User Story 3.5 — DSR queue formalises the Phase 2 mailbox (Priority: P3)

The Phase 2 manual DSR runbook is upgraded to a queue at `/admin/dsr` so subject-access and deletion requests can be triaged with the same audit-log discipline as submissions, with SLA visibility and templated fulfillment.

**Acceptance Scenarios**:

1. **Given** a DSR is opened in the queue, **When** an editor processes it through intake, identity verification, fulfillment, and closure, **Then** each lifecycle transition writes an audit-log entry and the thirty-day SLA is visible in the queue.

---

### Edge Cases — Phase 3

- **`robots.txt` blocks a target URL.** The scraper respects the directive and skips the URL silently — no scrape error is recorded for a directive-respect skip.
- **Outlet HTML structure changes and parsing yields zero articles.** The page returns 200 so it is not an error; the consecutive-failure counter does not tick. A separate "no articles parsed in N runs" alert flags silent rot before editors notice the feed has gone quiet.
- **Two scraper runs of the same outlet overlap.** The second run sees no new URLs after dedup by canonical-URL hash and exits cleanly.
- **Duplicate URL with different tracking parameters.** The per-outlet allowlist of meaningful query parameters canonicalises the URL identically; dedup by canonical-URL hash collapses both observations.
- **Bulk-approve burst.** Ten admin approvals within seconds: job-id collapsing debounces to at most one rollup per ten seconds; the advisory lock serializes any rollups that do overlap.
- **Aggregator faces a thousand new articles in one batch.** Concurrency caps prevent starving other queues; the aggregator processes the batch without exhausting database connections.
- **Heartbeat-job-only liveness flap.** When real queues sit idle for hours (between hourly rollups), liveness must remain green — the heartbeat queue's last-success timestamp is the sole liveness criterion. A silently-failing real queue (e.g., submission intake) is detected via the dead-letter / failed-runs alert, not by health probes.

### Functional Requirements — Phase 3

#### News scraping

- **FR-060**: A scheduled scraper MUST run for every enabled news source at a documented cadence (default: every 30 minutes per source).
- **FR-061**: Each scraper MUST respect the target outlet's `robots.txt`, send an identifying User-Agent, and rate-limit outbound requests to ≤ 1 request per 2 seconds per outlet.
- **FR-062**: Scrapers MUST persist only headline, ≤ 280-character excerpt, raw source URL, canonicalised source URL, publication time, and optional thematic tag — full article body MUST NEVER be stored.
- **FR-063**: The system MUST canonicalise scraped URLs (https scheme, lowercased host, fragment stripped, trailing slash removed, tracking-param allowlist applied per outlet) and MUST deduplicate by SHA-256 of the canonical URL (unique constraint).
- **FR-064**: Consecutive scrape failures per source MUST be tracked; after five in a row, the source MUST auto-disable (no further scrape jobs enqueued) and an alert MUST be posted to the editor channel.

#### Aggregation

- **FR-065**: The aggregator MUST run after each scrape batch and link new articles to existing cases by an accent-insensitive trigram-similarity match against case `name + position`; the auto-link threshold and the review threshold MUST be environment-tunable (defaults: auto 0.55, review 0.40).
- **FR-066**: The aggregator MUST skip articles where `linkOverridden = true`, preserving editor decisions across runs.

#### KPI rollup

- **FR-067**: The KPI rollup MUST recompute the single-row `KpiSnapshot` hourly via a scheduled function AND on demand via an asynchronous job triggered by admin Case or Submission mutations; on-demand jobs MUST be debounced to at most one execution per ten seconds via job-id collapsing.
- **FR-068**: Concurrent KPI rollups MUST serialize via a Postgres advisory lock keyed by a single named constant defined in one place.
- **FR-069**: After every successful KPI rollup, the system MUST invalidate the cached `/api/stats` payload via a signed internal revalidation call so the homepage picks up the fresh snapshot within the public cache TTL.
- **FR-070**: The web request path MUST NOT trigger a synchronous KPI recompute under any circumstance; rollups are exclusively the worker's responsibility.

#### Public news surface

- **FR-071**: A standalone news page at `/hirek` MUST render scraped articles paginated and filterable by outlet, tag, and case, sorted by publication time descending; filter state MUST be encoded in the URL.

#### Worker observability and resilience

- **FR-072**: A scraper observability dashboard at `/admin/scraper-runs` MUST display, per source, last-scraped time, last-success time, consecutive-failure count, articles-found and articles-new for the most recent run, and any error payload from that run. The system MUST also fire a "no articles parsed" silent-rot alert to the editor channel within 15 minutes of the fifth consecutive run that returned HTTP 200 but parsed zero articles (covered by SC-022); this alert is independent of the consecutive-failure auto-disable in FR-064 because a 200-with-zero-articles response is not classified as a scrape failure.
- **FR-073**: Background-job retry policy MUST be exponential backoff up to five attempts; on final failure the run MUST be visible in a failed-runs / dead-letter view, the exception MUST be captured in the error reporter, and an alert MUST fire on failed-runs / dead-letter depth > 0.
- **FR-074**: A liveness heartbeat job MUST run every five minutes and execute a trivial database health check; the public health endpoint MUST report 200 only when the most recent heartbeat completed within the last ten minutes (with a startup grace window). Liveness MUST NOT depend on the cadence of real business queues.
- **FR-075**: A DSR queue UI at `/admin/dsr` MUST formalise the Phase 2 mailbox runbook (intake, identity verification, fulfillment, closure) with audit-log entries for each lifecycle transition and visible SLA tracking.

### Key Entities — Phase 3

- **ScraperRun** — A single execution of a scraper for a source. Carries the source link, the start time, the finish time, the articles-found count, the articles-new count, and any error payload. Drives the observability dashboard.
- **NewsArticle (Phase 3 extensions to the Phase 1 schema)** — Phase 1 ships the schema and lets the case-detail page render any rows already linked to a case. Phase 3's scrapers populate rows with `headline`, `excerpt` (≤ 280 characters), raw `sourceUrl`, `sourceUrlCanonical`, `sourceUrlHash` (unique dedup key), `publishedAt`, `tag`, `featured`, `relatedCaseId` (set by the aggregator above the auto-threshold OR by an editor), `linkOverridden` (true when an editor wrote `relatedCaseId`), `linkConfidence` (the aggregator score), `scrapedAt`, `editorReviewedAt`. The article body is intentionally never stored.
- **Source (Phase 3 extensions)** — Phase 1 seeds the row with metadata (slug, display name, homepage URL). Phase 3's scrapers update `lastScrapedAt`, `lastSuccessAt`, and `consecutiveFailures`; the per-outlet kill-switch (`enabled`) flips false automatically after five consecutive failures.

### Success Criteria — Phase 3

- **SC-022**: After Phase 3 launch, `/hirek` displays articles from every enabled outlet within **24 hours** of the first scrape run; an outlet that returns 200 with zero parsed articles for five consecutive runs surfaces a "no articles parsed" alert within **15 minutes** of the fifth such run (silent-rot detection).
- **SC-023**: 95% of scrape-then-aggregate cycles complete within **5 minutes** of scrape start under normal load.
- **SC-024**: Articles are deduplicated by canonical-URL hash with **0 duplicates** introduced across re-runs (verified by uniqueness constraint).
- **SC-025**: After five consecutive scrape failures of a source, the source is automatically disabled and an editor alert is delivered within **15 minutes** of the fifth failure.
- **SC-026**: An editor's manual re-link or clear of `relatedCaseId` survives every subsequent aggregator run for the lifetime of the article — **0 stomps observed** in integration tests.
- **SC-027**: After an admin mutation that affects KPI totals, the homepage's reported totals reflect the change within **2 minutes** (one public-cache TTL window) of the mutation; the freshness label honestly reflects the lag and never overstates it.
- **SC-028**: 10 concurrent admin approvals trigger at most **2 actual KPI rollup executions** (debounced) and produce a final snapshot whose totals match a verifying SQL aggregate exactly.
- **SC-029**: Stopping the heartbeat queue flips the public health endpoint to **HTTP 503 within 10 minutes**; a silently-failing real queue (e.g., submission intake) does **NOT** flip the health endpoint — its failure is detected via the failed-runs / dead-letter alert path instead.
- **SC-030**: 100% of background-job final failures appear in the failed-runs / dead-letter view AND in the error reporter AND trigger an external alert.

### Assumptions — Phase 3

- **Five seed outlets.** Telex, 444, HVG, Magyar Hang, and Átlátszó are the initial scraper coverage. Adding a new outlet is an editorial decision that requires writing a per-outlet adapter.
- **Excerpt-only news storage.** Article bodies are never stored — copyright, scraping ethics, and storage cost all favour excerpt-only persistence.
- **Default thresholds tuned before launch.** Auto-link 0.55 and review 0.40 are starting points; values are environment-tunable per environment and tuned against the seeded data set before launch.
- **Single-row KpiSnapshot.** Phase 3 keeps the snapshot single-row by design; trend / sparkline charts are explicitly out of scope (would require a separate append-only history table — a deliberate later decision, not a Phase 3 commitment).
- **No Hungarian stemming.** `unaccent + pg_trgm` is the search-quality contract; `hunspell_hu` is out of scope.

---

## Phase 4 — Durable Client-Side Submission Encryption

Phase 4 closes the gap between what `/bejelentes` promises whistleblowers and what the platform actually delivers. After Phase 4 ships, an attacker with full application-server access can no longer recover submission contents: bodies and reporter PII are encrypted in the browser to a per-recipient envelope, and the application server never holds any editor private key.

### User Scenarios — Phase 4

#### User Story 4.1 — Whistleblower submissions are unreadable on the server (Priority: P1)

A reporter submits a tip; the submission's free-text body and any reporter-contact PII are encrypted client-side in the browser using a per-recipient sealed-box envelope addressed to the current set of editor public keys. The application server never receives plaintext, never holds private keys, and a backend compromise cannot recover submission contents.

**Why this priority**: This is the entire point of Phase 4 — the durable answer to the trust-posture gap that Phase 2 mitigates only with operational controls.

**Independent Test**: Submit a `/bejelentes` report after Phase 4 ships; from a Postgres client (no editor private key in scope), confirm `summary`, `reporterEmailEnc`, and `reporterNameEnc` are sealed-box ciphertexts and recover zero plaintext bytes from any of them.

**Acceptance Scenarios**:

1. **Given** a reporter submits, **When** the row lands in the database, **Then** the body and PII fields are sealed-box ciphertexts addressed to the current editor recipient list and direct DB inspection without an editor private key recovers no plaintext.
2. **Given** the Phase 2 server-side symmetric encryption columns exist, **When** Phase 4 ships, **Then** a migration backfills the existing data (re-sealed by editors) and removes the Phase 2 sym-enc columns in a follow-up migration; no row MUST be left in an ambiguous half-encrypted state.
3. **Given** an editor opens the review queue, **When** their browser unlocks their private key (held client-side, encrypted at rest by a passkey-derived secret), **Then** the queue renders plaintext locally; the server still serves only ciphertext.
4. **Given** the queue renders plaintext, **When** an editor reads decrypted PII, **Then** a signed call from the client triggers an `AuditLog` row with `action = 'pii.read'` so the Phase 2 forensic trail is preserved.

---

#### User Story 4.2 — Lost-key recovery is graceful, not silent failure (Priority: P2)

A submission whose recipient list points only to an editor whose device has been lost cannot be unsealed by any current editor. The admin queue must show a clear "sealed to a key no current editor holds" state rather than a 500 error or a silently-blank cell.

**Acceptance Scenarios**:

1. **Given** a submission whose ciphertext is addressed only to a now-unavailable editor's key, **When** the queue renders, **Then** the submission cell shows an explicit "sealed to a key no current editor holds" state.
2. **Given** that state, **When** an admin reads the operational doc, **Then** the documented recovery procedure (multi-recipient envelope; quorum unsealing; rotate to new editor key set) is present and has been exercised on staging.

---

#### User Story 4.3 — Key rotation re-seals in-flight submissions (Priority: P2)

When an editor is added or removed, an idempotent rotation job re-seals every in-flight submission ciphertext to the new recipient list. An editor revoked mid-rotation cannot decrypt rows whose re-sealing has completed; an editor added during rotation can decrypt every completed row.

**Acceptance Scenarios**:

1. **Given** the editor recipient list changes, **When** the rotation job runs, **Then** every in-flight submission row's ciphertext is re-sealed to the new list within one job run.
2. **Given** the rotation job is interrupted and re-run, **When** it completes, **Then** no ciphertext is corrupted, no submission is left half-rotated, and the second invocation idempotently finishes the work.

---

#### User Story 4.4 — Form copy upgrade ships in lockstep with the schema migration (Priority: P3)

The Phase 2 truthful-but-modest copy is upgraded to the strong promise *"Beérkezésed végpont-titkosítva tároljuk"* in the **same** release as the Phase 4 schema migration — never before, never after. Editorial signs off on the change in writing.

**Acceptance Scenarios**:

1. **Given** the Phase 4 release, **When** it ships, **Then** the form copy is updated to the strong promise in the same deploy as the schema migration; the editorial sign-off is recorded.

---

#### User Story 4.5 — Backout flag for safe rollout (Priority: P2)

Phase 4 ships behind a per-environment feature flag whose backout path is the Phase 2 server-side symmetric path. The flag is exercised in staging before production; flipping it off in production reverts new submissions to the Phase 2 path until any issue is resolved.

**Acceptance Scenarios**:

1. **Given** the flag is off in an environment, **When** a reporter submits, **Then** the request follows the Phase 2 sym-enc path and the form copy reverts to the Phase 2 truthful text.
2. **Given** the flag has been exercised in staging, **When** the same flag is flipped on in production, **Then** the rollout proceeds in the same release window with documented evidence of the staging exercise.

---

### Edge Cases — Phase 4

- **Browser cannot perform required cryptography.** When the browser does not support libsodium or the WebCrypto primitives Phase 4 depends on, the form blocks submission with an honest error message; a plaintext-fallback path MUST NOT be silently used.
- **Reporter submits while flag flips.** A reporter who started with the flag on and finishes after the flag flipped off must either complete via the original path or fail visibly — never write a row whose ciphertext format is half one path and half the other.
- **Editor revoked mid-rotation.** A revoked editor who tries to decrypt a row whose re-sealing has already completed must see a clear "you no longer hold a recipient key" message, not a crash.
- **Envelope-size growth.** The multi-recipient envelope grows with editor count; envelope size MUST be monitored and an alert MUST fire if it approaches the configured row-size limit.

### Functional Requirements — Phase 4

- **FR-076**: Submission free-text body and reporter PII (email, display name) MUST be encrypted in the browser before any HTTP request leaves the user agent; the application server MUST NEVER receive plaintext.
- **FR-077**: Submission encryption MUST use a per-recipient envelope (libsodium sealed-box or equivalent) addressed to the current list of editor public keys, so any current editor can unseal but a single departed editor cannot block decryption.
- **FR-078**: Editor private keys MUST be held client-side, encrypted at rest by a passkey-derived secret; the server MUST NEVER receive any editor private key.
- **FR-079**: Every editor render of decrypted PII MUST still produce an `AuditLog` row with `action = 'pii.read'`, written via a signed client-driven call so the Phase 2 forensic trail is preserved exactly.
- **FR-080**: A submission whose recipient list points only to keys no current editor holds MUST render in the admin queue as an explicit "sealed to a key no current editor holds" state, not as a 500 error or a blank cell.
- **FR-081**: A rotation worker job MUST re-seal every in-flight submission ciphertext to a new recipient list when the editor list changes; the job MUST be idempotent and resumable.
- **FR-082**: A documented multi-recipient / quorum-unseal recovery procedure MUST exist before Phase 4 launch, including the path for a single-admin device-loss scenario.
- **FR-083**: The Phase 4 release MUST upgrade the `/bejelentes` form copy to the strong promise *"Beérkezésed végpont-titkosítva tároljuk"* in the **same** deploy as the schema migration that enables sealed-box storage; editorial sign-off MUST be recorded for the copy change.
- **FR-084**: The public PII threat-model document MUST be updated in the Phase 4 release to reflect the new control (backend compromise no longer equals submission-content exposure) and to state plainly the residual risks (compromise of an editor device unlocked at the time, compromise of the team password manager / shared editor key store).
- **FR-085**: Phase 4 MUST ship behind a per-environment feature flag with a documented backout path that falls back to the Phase 2 sym-enc storage and reverts the form copy; the backout MUST be exercised in staging before production rollout.
- **FR-086**: A migration MUST backfill existing Phase 2 rows so that the Phase 2 sym-enc columns can be dropped in a follow-up migration; no row MUST be left in an ambiguous half-encrypted state.

### Success Criteria — Phase 4

- **SC-031**: After Phase 4 launch, direct database inspection of any new `Submission` row by a party not holding an editor private key recovers **zero plaintext bytes** from the body or PII fields.
- **SC-032**: The application server logs and the application server memory contain **zero plaintext submission bodies and zero editor private keys**, verified by code review and a runtime memory-snapshot smoke test on staging.
- **SC-033**: A submission sealed exclusively to a now-unavailable editor renders the explicit "no current editor holds the key" state in **100% of admin queue views** rather than a 500 or a blank cell.
- **SC-034**: A rotation run after an editor-list change re-seals **100% of in-flight submission ciphertexts** to the new recipient list; an interrupted run resumed by a second invocation completes with **0 corrupted** rows.
- **SC-035**: The form-copy upgrade and the schema migration ship in the **same** production deploy; deploy log evidence MUST be preserved.
- **SC-036**: The backout flag has been exercised at least once on staging before production rollout, with documented evidence that flag-off restores the Phase 2 path cleanly.

### Assumptions — Phase 4

- **libsodium sealed-box, multi-recipient envelope.** This is the chosen primitive; quorum-unseal is the chosen recovery model.
- **Editor private keys live client-side.** The server is not a key-escrow; private keys are encrypted at rest by a passkey-derived secret on the editor's device.
- **Phase 4 is not indefinitely deferred.** It ships in the release **immediately after Phase 2 stabilises**.
- **Form-copy upgrade is editorially gated and ships in the same release** as the schema migration — never before, never after.
- **Backout via feature flag.** The Phase 2 server-side symmetric path remains available behind the flag and is exercised in staging before production rollout.

---

## Out of Scope

These items appear in the source plan but remain **not** part of this specification across all four phases. Each is a deliberate deferral that can be revisited once the four phases have shipped.

- **Catalogue item 7** — footer/methodology static pages, public CSV/API export, donations, partners/team/sajtó pages. (The `/hamarosan` stub stands in for all of these per FR-024 / FR-025.)
- **SecureDrop integration** — Phase 4 sealed-box submission encryption covers the primary whistleblower threat model for now.
- **IP-stripping reverse proxy** — instead, Phase 2 mandates ≤ 7-day platform access-log retention (FR-037) so the form copy is truthful without a custom ingress proxy.
- **OAuth providers (GitHub, Google) for editor sign-in** — magic-link only across all phases; reintroduce when an editor specifically asks for them.
- **WebAuthn passkeys for the `editor` role** — Phase 2 requires passkeys for the `admin` role only (FR-041); non-admin editors continue to use magic-link alone. Revisit if the threat model changes.
- **Self-service DSR portal** — Phase 2 ships a manual `dpo@…` mailbox runbook; Phase 3 ships the `/admin/dsr` editor queue UI (FR-075). A reporter-facing self-service portal is not in scope for any of the four phases.
- **Mobile-native app** — responsive web is the target across all phases; no separate mobile codebase.
- **Trend / historical KPI charts** — `KpiSnapshot` is single-row by design across all phases; introducing a `KpiHistory` append-only table is a deliberate later decision, not part of the four-phase scope.
- **Hungarian-language stemming via `hunspell_hu`** — accent-insensitive matching via `unaccent + pg_trgm` is the search-quality contract for all four phases.
