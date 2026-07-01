# Feature Specification: Rich case detail pages (Adatbázis végoldalak)

**Feature Branch**: `004-case-detail-pages`
**Created**: 2026-06-29
**Status**: Draft
**Input**: User description: "Az ügyek nyilvántartása (Adatbázis) minden végoldala nézzen ki úgy, mint a /ugyek kiemelt ügyek — hivatkozásokkal, leírásokkal, YT-embeddel, keretes hírekkel, kereszthivatkozásokkal. Általánosan, az egész DB-re. A K-monitor adat + becsült kár logikáját is tisztázni kell."

## Context & Problem

Today the Adatbázis lists ~thousands of auto-generated cases from the K-monitor
pipeline (`ScandalCatalog` view, one row per `scandalKey`). The list looks good,
but every **detail page** (`/adatbazis/[id]`) is thin: title, person/institution,
three stat numbers, an offence-tag row, an optional member table, and a news grid
that is usually empty ("Még nincs hozzárendelt cikk").

By contrast the 7 hand-curated kiemelt ügyek (`/ugyek/[id]`, driven by
`app/apps/web/app/_home/ugyek-config.ts`) are rich: hero with photo, summary,
estimated-damage line, crime-type tags, a main video + extra videos, an
"Az ügy ismertetése" body built from typed content blocks (text, breaking-group,
article-card, quote, pdf-link, audio-link, image-pair), a procedural status
summary, a source list, related persons, and a related-news feed.

We want **every** Adatbázis case to reach that quality — auto-generated from the
data we already have, with an optional editorial override layer for the
top-priority people (Mészáros és a többi top10 kiemelt személy).

### The damage-figure problem (must be addressed)

The headline "Becsült kár" on a case is `MAX(DamageEstimate.totalHighHuf)` across
the scandal's member investigations. The bootstrap value of that estimate is the
**largest number a regex found in the source article** — frequently a project
cost, a budget line, the national debt, or a multi-year aggregate, **not** the
alleged corruption damage. Example: `meszaros-kormany-3750-mrd-pluszkoltseg`
shows "3750 Mrd Ft", which is a *budget-context number baked into the case name*,
not a damage figure. An LLM reprice pass (`catalog-reprice-damage.ts`) exists to
correct this, but it has not cleaned every case, and bad numbers persist in case
**names**. Presenting a budget figure as "kár" is misleading and must be fixed
both in display logic and via a one-off data-quality pass.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A reader opens any database case and gets a real, trustworthy page (Priority: P1)

A visitor clicks a case in the Adatbázis (e.g. the Mészáros budget case). Instead
of three numbers and an empty news box, they land on a full page: what the case
is about, an honest damage figure **with its basis**, where it stands in the
criminal-justice pipeline, the people and institutions involved, related cases,
and the relevant news — all generated from the data we hold, for *any* case, not
just the curated seven.

**Why this priority**: This is the core ask. Every one of the thousands of cases
must look credible; the long tail is where the current page is weakest.

**Independent Test**: Open 10 random `scandalKey` pages spanning the damage band
(80 Mrd → 3750 Mrd) and confirm each renders a populated hero, summary, damage
section with basis, procedural state, and at least the news/related sections
(empty states are explicit and non-embarrassing).

**Acceptance Scenarios**:

1. **Given** a case with only K-monitor data and no editorial override, **When**
   the reader opens its page, **Then** the hero, summary, damage-with-basis,
   procedural state, offence tags, related persons, related cases, and related
   news all render from the database, with honest empty states where data is
   missing.
2. **Given** a case whose damage figure is a low-confidence artifact (or whose
   number is baked into the name), **When** the page renders, **Then** the
   headline does **not** present that number as "kár" — it shows an explicit
   "becslés alatt / vitatott" treatment and the basis instead.
3. **Given** the same `scandalKey` exists in the editorial override config,
   **When** the page renders, **Then** the curated blocks (cleaned title/damage,
   hero photo, breaking groups, quotes, extra videos, source refs, related
   persons) are merged on top of the auto-generated base.

---

### User Story 2 — Editorial override for the top10 highlighted people (Priority: P2)

For the priority people (Mészáros Lőrinc and the other top10 kiemelt személyek),
an editor can hand-author the same rich content the `/ugyek` pages use — without
touching code per case — so those flagship database pages match the curated
quality of the kiemelt ügyek.

**Why this priority**: The top10 are the most-visited and most-scrutinised; they
must be flawless. But they are a small set, so this layer is bounded.

**Independent Test**: Add an override entry for one `scandalKey`, reload the page,
and confirm the curated blocks appear and the auto base still fills the gaps.

**Acceptance Scenarios**:

1. **Given** an override entry keyed by `scandalKey`, **When** present, **Then**
   its fields take precedence over the auto-derived equivalents (title, damage
   label, hero photo, summary, videos, description blocks, source refs, related
   person ids).
2. **Given** no override entry, **When** the page renders, **Then** it falls back
   fully to the auto base with no errors and no empty curated sections shown.

---

### User Story 3 — The damage figure is honest and self-explaining everywhere (Priority: P2)

Wherever a "Becsült kár" appears (list and detail), the number is either a
credible damage estimate shown with its basis/confidence, or it is visibly marked
as not-yet-verified — never a raw budget/project number presented as damage.

**Why this priority**: Credibility of the whole site depends on not publishing
misleading numbers; this is also the user's explicit confusion to resolve.

**Independent Test**: Review the cases in the 80–3750 Mrd band; confirm each
headline number is either backed by a damage basis or down-ranked/relabelled.

**Acceptance Scenarios**:

1. **Given** a case with `DamageEstimate.confidence = low` and a
   budget/context-shaped basis, **When** displayed, **Then** the UI labels it
   "becslés alatt" and surfaces the basis rather than a hard "kár" number.
2. **Given** a case name containing a baked figure (e.g. "…3750 mrd…"), **When**
   the data-quality pass runs, **Then** the display name is cleaned and the
   damage is re-derived or cleared.

---

### Edge Cases

- Case with **0 damage** → hero shows "Becsült kár: —" / "nincs számszerűsítve",
  no fake number.
- Case with **a single member investigation** → no "Kapcsolódó ügyek" member
  table; still show cross-references derived from shared person/entity/offence.
- Case with **no matched articles** → news section shows an honest "a következő
  scrape során frissül" empty state (as `/ugyek` already does), not a dead box.
- **Person not in galeria/watchlist** → hero uses initials placeholder, no broken
  image, no related-person card fabricated.
- **Slug collisions / encoded characters** in `scandalKey` → page resolves by the
  exact stored key (URL-decoded), `notFound()` otherwise.
- **Override references a missing photo/video** → fall back to placeholder; never
  render a broken embed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render `/adatbazis/[id]` (keyed by `scandalKey`)
  using the existing `person-page` / `ugy-*` design system rather than the thin
  `case-detail` layout.
- **FR-002**: The detail page MUST auto-generate, for **every** case, from data
  already held: hero (status, name, person, institution), summary, estimated
  damage with basis, procedural state, offence-type tags, related persons,
  related cases (cross-references), and related news.
- **FR-003**: The system MUST support an **editorial override** layer keyed by
  `scandalKey` whose fields (title, damage label, hero photo, summary, videos,
  description blocks, source refs, related person ids, crime types) take
  precedence over the auto-derived base, merging — not replacing — the page.
- **FR-004**: The override block model MUST reuse the existing `DescriptionBlock`
  types (`text`, `video`, `article-card`, `breaking-box`, `breaking-group`,
  `quote`, `pdf-link`, `image-pair`, `audio-link`) so curated content authored
  for `/ugyek` can be shared with `/adatbazis`.
- **FR-005**: The estimated-damage display MUST show the figure **with its basis
  and confidence**; when confidence is low or the basis is a budget/context
  artifact, it MUST NOT present the number as "kár" and MUST show a
  "becslés alatt / vitatott" treatment instead.
- **FR-006**: The system MUST present the procedural stage as a readable timeline
  / stepper derived from `Investigation.proceduralStage`
  (`reported → investigating → suspect_charged → indicted → on_trial →
  verdict_first_instance → final_verdict` / `closed_no_charge` / `acquitted`),
  with the competent authority shown.
- **FR-007**: Related persons MUST be derived from (a) editorial `relatedPersonIds`
  and (b) auto co-mention data (`KMonitorPersonArticle`), and rendered as links to
  `/galeria/*` or `/lemondasok/*` when the person is a known highlighted person.
- **FR-008**: Related cases (kereszthivatkozások) MUST be derived from other
  `scandalKey`s sharing the same primary person, entity, or offence type, and
  linked to their `/adatbazis/[id]` pages.
- **FR-009**: Related news MUST combine linked articles
  (`InvestigationArticleLink → NewsArticle`) with keyword/tag matches from the
  daily feed, deduplicated, newest first, with explicit empty state.
- **FR-010**: Related videos MUST render as YouTube embeds sourced from editorial
  override and/or a video registry matched by person/keyword (e.g. the NER100 and
  Orbánék channels), with a placeholder when none exist.
- **FR-011**: Every detail page MUST carry the legal disclaimer (press-report
  based; absent a final verdict the named persons are presumed innocent).
- **FR-012**: A one-off data-quality pass MUST (a) re-derive or clear damage on
  cases whose figure is a budget/context artifact in the 80–3750 Mrd band, and
  (b) strip baked numbers from `scandalName`/display name. *(LLM-assisted; runs
  with explicit approval — see Assumptions.)*
- **FR-013**: The local development database MUST be populated with real case data
  via a prod data dump so the pages can be designed and reviewed against real
  content (`Investigation`, `DamageEstimate`, links, K-monitor person tables,
  `OffenceTypeRef`, `Source`; `ScandalCatalog` is a view and rebuilds itself).
- **FR-014**: The page MUST remain a server component reading via `getDb()`; no
  new client-side data fetching is introduced for the base render.

### Key Entities *(include if feature involves data)*

- **ScandalCatalog (view)**: one public case per `scandalKey`; headline fields
  (name, person, institution, summary, counts, `damage_huf`, `is_open`,
  `offence_codes`). Read model the page header uses.
- **Investigation**: matter-level fragments grouped by `scandalKey`; carries
  `summary`, `primaryPersonName`, `primaryEntityName`, `proceduralStage`,
  `competentAuthority`, `offenceTypes`, `articleCount`.
- **DamageEstimate**: `totalLowHuf`/`totalHighHuf`, `confidence`, `components`
  (jsonb), basis — the source of the honest damage display.
- **InvestigationArticleLink → NewsArticle → Source**: the linked-news feed.
- **KMonitorPersonCandidate / KMonitorPersonArticle**: co-mention graph used to
  auto-derive related persons.
- **OffenceTypeRef**: code → Hungarian label for offence tags.
- **CaseDetailOverride (new, config-as-code)**: editorial layer keyed by
  `scandalKey`, mirroring `UgyekConfig` block types; read-only, never written by
  the pipeline.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of `scandalKey` detail pages render a populated hero, summary,
  damage-with-basis, procedural state, and offence tags — zero pages showing only
  three numbers + an empty news box.
- **SC-002**: No detail page displays a budget/project/debt figure labelled as
  "kár"; every headline damage number is backed by a basis or marked
  "becslés alatt".
- **SC-003**: The top10 highlighted people's database pages reach visual parity
  with the `/ugyek` curated pages (hero photo, videos, curated blocks, sources).
- **SC-004**: Every page has at least one populated "related" section (persons,
  cases, or news) or an explicit, non-embarrassing empty state — no dead boxes.
- **SC-005**: The local DB holds the full prod case set so any case can be opened
  and reviewed locally.

## Assumptions

- The prod Supabase project holds the populated case data; the local
  `DATABASE_URL` points at a separate, currently-empty project (verified:
  0 Investigations / 0 DamageEstimate / 0 ScandalCatalog, 415 NewsArticle). A
  prod connection string or dump must be provided to populate local (FR-013).
- The editorial override is **config-as-code** (a TypeScript module like
  `ugyek-config.ts`), not a CMS — consistent with the current project and the
  2-person non-developer team.
- The damage-quality LLM pass (`catalog-reprice-damage.ts` / `catalog-fix-names.ts`)
  costs Anthropic API credits and is therefore run **only with explicit approval**,
  per the project's API-cost rule.
- The existing rich CSS (`person-*`, `ugy-*`) is reused; minimal new styling is
  expected (timeline/stepper + damage-basis block are the likely additions).
- Mobile layout reuses the already-responsive `/ugyek` styles.
