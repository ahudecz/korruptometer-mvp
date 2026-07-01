# Implementation Plan: Detection Review Engine

**Branch**: `003-detection-review-engine` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-detection-review-engine/spec.md`

## Summary

A háromfajta LLM-detektor (személyi változás, médiaesemény, bírósági esemény) kimenetét egy **jóváhagyási kapun** vezetjük át, mielőtt a nyilvános oldalra kerülne. Minden detektált sor kap egy `reviewStatus` mezőt (`approved` / `pending` / `rejected`). A küszöbök: ≥0.90 + nem-kiemelt → `approved`; 0.70–0.8999 → `pending`; <0.70 → eldobás. Kiemelt figyelt személy (8+10) mindig `pending`. A publikus oldalak csak `approved` sorokat mutatnak; egy admin review-oldalon a szerkesztő elfogad/eldob. Duplikáció-szűrés normalizált név alapján 30 napos ablakban, az összes státusz ellen (a `rejected` ne térjen vissza).

Technikai megközelítés: két lépcsős, nem-destruktív Drizzle/SQL migráció (alkotmány VII.) ami felveszi a státusz mezőt és a meglévő sorokat `approved`-ra állítja; a döntési logika a meglévő Inngest detektor-függvényekbe kerül; egy közös watchlist-modul egyesíti a 8+10 személyt; a publikus lekérdezések `reviewStatus='approved'` szűrőt kapnak; egy új `/admin/review` oldal + szerver-action végzi az elfogad/eldob műveletet.

## Technical Context

**Language/Version**: TypeScript 5.6 / Node 20 (repo pin)
**Primary Dependencies**: Next.js 15 (App Router), Drizzle ORM 0.36, Inngest 3.x, a meglévő kapcsolható LLM-réteg (`@korr/db/llm` → LangDock `gpt-5-chat-latest`), `@supabase/supabase-js`
**Storage**: Supabase Postgres — meglévő táblák: `PoliticalResignation`, `MediaClosure`, `CourtVerdict`. Migrációk: raw-SQL az `app/supabase/migrations/` alatt (köv. szám: `0030`)
**Testing**: vitest (meglévő `@korr/db` és web tesztkeret)
**Target Platform**: Vercel (web + Inngest endpoint), Inngest Cloud cron
**Project Type**: Web application — egyetlen Next.js app monorepóban (`app/apps/web` + `app/packages/*`)
**Performance Goals**: a detektálás aszinkron (Inngest cron, óránként); a review-admin alacsony forgalmú, néhány elem/nap, 2 szerkesztő. Nincs szigorú latencia-cél.
**Constraints**: a publikus olvasási út `reviewStatus='approved'`-ra szűr; a státusz migráció két lépcsős és nem-destruktív; szerkesztői döntés megőrzése detektor-újrafuttatáskor (alkotmány VII.); a meglévő élő adat nem boríthat (FR-010 / SC-005)
**Scale/Scope**: 3 tábla, ~5 publikus lekérdezési pont, 1 új admin-oldal, 4 detektor-függvény érintve; napi néhány detektálás

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Trust Posture Above Convenience (NON-NEGOTIABLE)** — ✅ **Ez a funkció maga az elv megvalósítása.** Megakadályozza, hogy a rendszer valótlant állítson (pl. hamis „X lemondott") szerkesztői jóváhagyás nélkül. A kiemelt személyekre vonatkozó kötelező review (FR-006) közvetlenül a legkockázatosabb hamis állítást zárja ki.
- **II. Phased Shippability** — ✅ A Phase 3 (scraper/detektor) szelet bővítése, önállóan deployolható: státusz mező + szűrt publikus olvasás + review-admin. Nem keveredik más fázissal.
- **III. Single Next.js App on the Inbox-to-Action Stack** — ✅ Drizzle séma + raw-SQL migráció, Inngest függvények a meglévő helyen, Supabase Postgres. Nincs új szolgáltatás, nincs stack-csere. (A LangDock az LLM-kimenethez tartozik, már bevezetve; ez a terv nem nyúl a stack alap-szolgáltatásaihoz.)
- **IV. Data Minimization & GDPR** — ✅ Nincs új PII; közszereplők neve már most is tárolt. Nincs `NewsArticle.body`. A `reviewStatus` nem személyes adat.
- **V. Eventual-Consistency on KPIs** — ✅ A publikus oldalak közvetlenül a táblákból olvasnak `revalidate`-tel; jóváhagyáskor `revalidateTag`-et hívunk. A web request path nem indít szinkron újraszámolást. A nyitóoldali számlálók is `reviewStatus='approved'`-ra szűrnek.
- **VI. Edge-First Reads, Rate-Limited Writes, Verified-Human Path** — ✅ A review-admin a meglévő `(authed)` admin alatt él (Supabase auth + admin-szerep); az elfogad/eldob írás a már védett admin-úton megy.
- **VII. Two-Step Destructive Migrations & Editor-Decision Preservation** — ✅ A státusz-oszlop nem-destruktív, két lépcsős migrációval kerül be (nullable → backfill `approved` → not-null default). A szerkesztői döntés (`approved`/`rejected`) sosem íródik felül detektor-újrafuttatáskor; a dedup a `rejected` sorokat is figyeli, így eldobott elem nem tér vissza.

**Eredmény: minden kapu PASS, indoklandó sértés nincs → Complexity Tracking üres.**

## Project Structure

### Documentation (this feature)

```text
specs/003-detection-review-engine/
├── plan.md              # Ez a fájl
├── research.md          # Phase 0 — döntések
├── data-model.md        # Phase 1 — séma-változások
├── quickstart.md        # Phase 1 — hogyan próbáld ki
├── contracts/
│   └── admin-review.md  # Phase 1 — admin review interfész + detektor-státusz szerződés
└── tasks.md             # Phase 2 — /speckit.tasks hozza létre (NEM ez a parancs)
```

### Source Code (repository root)

```text
app/
├── packages/
│   └── db/
│       └── src/
│           ├── schema.ts                 # + reviewStatus enum/oszlop a 3 táblán
│           ├── watchlist.ts              # ÚJ: egyesített 8+10 kiemelt személy + normalizált illesztő
│           ├── review.ts                 # ÚJ: küszöb→státusz döntés + név-normalizálás + dedup-kulcs
│           ├── resignation-detect.ts     # (változatlan — már a közös LLM-réteget hívja)
│           ├── media-closure-detect.ts
│           └── court-verdict-detect.ts
├── supabase/
│   └── migrations/
│       └── 0030_detection_review_status.sql   # ÚJ: két lépcsős, nem-destruktív migráció
└── apps/web/
    ├── src/inngest/functions/
    │   ├── detect-resignations.ts        # küszöb/watchlist/dedup → reviewStatus a beszúrásnál
    │   ├── detect-media-closures.ts
    │   └── detect-verdicts.ts
    └── app/
        ├── lemondasok/page.tsx           # + WHERE reviewStatus='approved'
        ├── megszunt/page.tsx             # + szűrő
        ├── birosagi-iteletek/page.tsx    # + szűrő
        ├── page.tsx                      # nyitóoldali számlálók + listák szűrése
        ├── api/resignations/route.ts     # + szűrő
        └── admin/(authed)/review/        # ÚJ: review-sor oldal + elfogad/eldob server action
            ├── page.tsx
            └── review-actions.ts
```

**Structure Decision**: Web application (meglévő monorepo). A döntési logika a `@korr/db` csomagba kerül (újrahasználható a detektorok és egy esetleges backfill-script között), a migráció a meglévő raw-SQL mintába, a review-felület a meglévő `admin/(authed)` mintába (mint a `resignations`, `media-closures` aloldalak).

## Complexity Tracking

> Nincs alkotmánysértés — a táblázat üres.
