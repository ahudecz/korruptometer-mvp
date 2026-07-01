# Implementation Plan: Rich case detail pages (Adatbázis végoldalak)

**Branch**: `004-case-detail-pages` | **Date**: 2026-06-29 | **Spec**: ./spec.md
**Input**: Feature specification from `specs/004-case-detail-pages/spec.md`

## Summary

Replace the thin `/adatbazis/[id]` page with a rich, server-rendered case page
that reuses the `/ugyek` design system. The page has two layers:

1. **Auto base** — generated for *every* `scandalKey` from data we already hold
   (ScandalCatalog + Investigation + DamageEstimate + links + K-monitor person
   graph + offence labels).
2. **Editorial override** — an optional `case-detail-config.ts` keyed by
   `scandalKey`, reusing the `DescriptionBlock` model, that merges curated content
   on top for the top10 highlighted people.

Plus a damage-honesty fix (display + one-off data pass) and a prod→local data
dump so we can build and review against real cases.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node 20
**Primary Dependencies**: Next.js 15 (App Router, RSC), Drizzle ORM 0.36,
`postgres` (postgres-js), existing `@korr/shared/format`, `@korr/db/schema`
**Storage**: Postgres (Supabase). `ScandalCatalog` is a VIEW over `Investigation`
+ `DamageEstimate`; no new tables required for the base render.
**Testing**: existing `npm test && npm run lint`; add a render smoke over a
sample of `scandalKey`s.
**Target Platform**: Vercel (Next.js RSC), localhost dev.
**Project Type**: Web application (existing `app/apps/web`).
**Performance Goals**: server-render within the existing case-page budget; one
DB round of queries per page (no N+1 across sections).
**Constraints**: server component only (no new client fetching for base render);
additive/read-only to the pipeline (Principle VII — the override config is never
written by jobs).
**Scale/Scope**: one rewritten route + one new config module + one new damage
display component + a data-quality script reuse; thousands of cases served.

## Constitution Check

- **Additive / read-only (Principle VII)**: PASS — the page only reads; the
  override is config-as-code; the `ScandalCatalog` view is unchanged.
- **API-cost rule**: the damage-quality LLM pass is gated behind explicit
  approval; nothing in the render path calls an LLM.
- **No unapproved public content**: override content is editor-authored; auto
  content derives only from already-approved K-monitor/news data.

## Design proposal (content + layout)

Reuse `person-page` / `ugy-*` classes. Sections, top → bottom:

1. **Hero** (`person-hero`)
   - Eyebrow: `Folyamatban` / `Lezárt` + offence summary (or "besorolatlan").
   - Title: cleaned scandal name (override `title` wins; otherwise
     name with baked numbers stripped).
   - Sub: `person · institution`.
   - Photo: galeria/watchlist photo if the primary person is a known highlighted
     person (or override `photo`); else initials placeholder.
   - **Damage line**: honest. `<DamageFigure>` component — see below.
   - Crime-type tags from `OffenceTypeRef` labels (or override `crimeTypes`).

2. **Az ügy ismertetése** (`ugy-description`)
   - Override `descriptionBlocks` when present (full block system), else the
     `Investigation.summary` as paragraphs.
   - Legal disclaimer note (existing copy).

3. **Becsült kár — mire épül** (new `case-damage` block)
   - The figure, its `confidence`, and a plain-language basis from
     `DamageEstimate.components`. Low-confidence / artifact → "becslés alatt,
     a sajtóban szereplő számok ellenőrzés alatt" instead of a hard number.
   - Directly answers "honnan jön ez az összeg".

4. **Eljárási állapot** (new `case-timeline` stepper)
   - Horizontal stepper over the `procedural_stage` ladder, current stage
     highlighted; `competentAuthority` badge; "Folyamatban/Lezárt" derived from
     terminal stages.

5. **Kapcsolódó videók** (`ugy-extra-videos` / `person-video-section`)
   - Override videos first; else registry matches by person/keyword. Placeholder
     if none.

6. **Kapcsolódó személyek** (`ugy-related-persons`)
   - Override `relatedPersonIds` ∪ top co-mentioned persons
     (`KMonitorPersonArticle`) resolved against galeria/watchlist.

7. **Kapcsolódó ügyek / kereszthivatkozások** (`ugyek-more-grid` style)
   - Other `scandalKey`s sharing primary person / entity / offence; for top10
     people this naturally links their many matters together.

8. **Kapcsolódó hírek** (`person-news`)
   - `InvestigationArticleLink → NewsArticle` ∪ keyword/tag matches; deduped,
     newest first; framed breaking cards where flagged; honest empty state.

9. **Források** (`ugy-sources`)
   - Override `sourceRefs` ∪ distinct article sources.

10. **Footer nav** — back to Adatbázis + a few related cases.

### `<DamageFigure>` rule (FR-005)

```
if damage == 0                         → "Becsült kár: — (nincs számszerűsítve)"
else if confidence == 'low'            → "Becslés alatt" + basis, number de-emphasised
   or name/basis looks like budget/debt
else                                   → FtValue + "Becsült kár" + basis tooltip/line
```

## Data sources per section (no new tables for base)

| Section | Source |
|---|---|
| Hero header | `ScandalCatalog` row by `id=scandalKey` |
| Damage + basis | `DamageEstimate` of the member with `MAX(totalHighHuf)` |
| Procedural state | `Investigation.proceduralStage` / `competentAuthority` (member with most articles) |
| Offence tags | `OffenceTypeRef` join on `offence_codes` (already in page) |
| Members | `Investigation WHERE scandalKey = id` |
| Related persons | `KMonitorPersonArticle` co-mention + galeria/watchlist configs |
| Cross-refs | `Investigation` other `scandalKey` sharing person/entity/offence |
| News | `InvestigationArticleLink → NewsArticle → Source` ∪ keyword match |
| Override | new `case-detail-config.ts` (config-as-code) |

## Project Structure

### Documentation (this feature)

```text
specs/004-case-detail-pages/
├── spec.md         # done
├── plan.md         # this file
├── quickstart.md   # prod→local data dump runbook + dev steps
├── data-model.md   # (optional next) section→query mapping detail
└── tasks.md        # (/speckit.tasks output — not created here)
```

### Source Code (repository root)

```text
app/apps/web/app/adatbazis/[id]/
└── page.tsx                      # REWRITE: thin → rich, two-layer render

app/apps/web/app/_home/
├── ugyek-config.ts               # existing block model — reused, unchanged
└── case-detail-config.ts         # NEW: editorial override keyed by scandalKey

app/apps/web/app/adatbazis/_components/
├── damage-figure.tsx             # NEW: honest damage display (FR-005)
└── case-timeline.tsx             # NEW: procedural-stage stepper (FR-006)

app/apps/web/app/globals.css (or module)
└── .case-damage / .case-timeline # NEW minimal styles; rest reuse person-/ugy-*

app/packages/db/src/
├── catalog-reprice-damage.ts     # existing — re-run on 80–3750 band (approval)
└── catalog-fix-names.ts          # existing — strip baked numbers (approval)
```

**Structure Decision**: Single web app (`app/apps/web`); one route rewrite plus a
config module and two small presentational components. No schema migration is
required for the base render. The damage-quality cleanup reuses existing
`@korr/db` scripts.

## Phasing (independently shippable)

- **Phase 0 — Data**: prod dump → local (quickstart.md). Unblocks everything.
- **Phase 1 — Auto base (US1)**: rewrite `page.tsx` to the rich layout from DB;
  add `<DamageFigure>` + `<CaseTimeline>`; honest empty states. Ship.
- **Phase 2 — Damage honesty (US3)**: display rule live; then (with approval) the
  one-off reprice + name-fix pass over the 80–3750 Mrd band.
- **Phase 3 — Editorial override (US2)**: add `case-detail-config.ts`, author the
  top10 (start with Mészáros), merge over base.

## Open questions / decisions resolved

- Data population: **prod dump** (decided).
- Richness model: **hybrid auto + editorial override** (decided).
- Remaining input needed: the **prod connection string / dump** (see quickstart;
  cannot be accessed from here).

## Complexity Tracking

No constitution violations. The override config mirrors an existing pattern
(`ugyek-config.ts`); no new persistence or services are introduced.
