# Implementation Plan: Feljelentés-nyomkövető blokk a "Börtönben van-e?" oldalon

**Branch**: `009-criminal-complaint-tracking` (megvalósítás közvetlenül `main`-en, a repo tényleges gyakorlata szerint — l. Assumptions) | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-criminal-complaint-tracking/spec.md`

## Summary

Új `CriminalComplaint` tábla + detektor-pár (Inngest cron + Telegram-reprocess), amely szinte 1:1 a meglévő `CourtVerdict`/`court-verdict-detect.ts` mintát követi: kulcsszó-előszűrés ("feljelent" tő), Haiku-LLM tömbös extrakció (a `resignation-detect.ts` többszemélyes mintáját követve — egy cikkből több feljelentés is kinyerhető), `decideStatus()` alapú review-routing, és egy ÚJ `findExistingComplaint()` egyezés-kereső, ami a `findExistingVerdict()`-hez hasonlóan normalizált célpont-név (`targetName`) alapján talál meglévő sort — de a `CourtVerdict` egyszerű "azonos verdictType = duplikátum" szabálya helyett egy 5-fokozatú, MONOTON állapotgép-szabályt alkalmaz (feljelentés → nyomozás → vádemelés → ítélet, plusz a bármikor elérhető "elutasítva" terminál-állapot), hogy egy korábbi cikk újrafeldolgozása véletlenül se írja vissza a státuszt egy korábbi fázisra.

A `/birosagi-iteletek` oldal egy harmadik, önálló blokkot kap a meglévő 2 fölött, saját színkódolt `StatusBadge`-mintával. A bizonytalan találatok a MEGLÉVŐ Telegram-boton (`@kegyencjarat_bot`) keresztül futnak, 5. detektor-kategóriaként bekötve a 008-as spec `crossCheckOtherCategories()` gépezetébe.

Nincs cross-table szinkron a `CourtVerdict`-tel (a felhasználó explicit döntése alapján, l. spec FR-010): a két detektor egymástól függetlenül fut ugyanazon cikkeken, mindkettő a saját `DetectionCheck` sorát írja (`detectorType='criminal_complaint'` vs. `'court_verdict'`), és mindkét blokk a saját táblájából olvas — ha egy ügy mindkét kritériumot teljesíti, mindkét helyen megjelenik, szándékosan.

## Technical Context

**Language/Version**: TypeScript 5.6 / Node 20 (repo pin)
**Primary Dependencies**: Next.js 15 (App Router), Drizzle ORM 0.36, Inngest 3.x (új cron function, a meglévő 4 detektor-függvény mintáját követve), `@anthropic-ai/sdk` (Haiku 4.5, a meglévő `ai-verdicts.ts`/`ai.ts` prompt-mintát követve), meglévő Telegram Bot API integráció (natív `fetch`, nincs új SDK)
**Storage**: Supabase Postgres — 1 új migráció (`0042_criminal_complaint.sql`): 1 új tábla (`CriminalComplaint`) + 1 új enum (`complaint_status`); a meglévő `reviewStatusEnum`-ot újrahasználja, nincs változás meglévő táblán
**Testing**: vitest (meglévő keret) — a státuszgép-logika (`decideComplaintUpdate()` v. hasonló pure function) unit-tesztelhető a `review.ts` mintájára; a detektor end-to-end tesztje a meglévő `detect-verdicts`/`detect-resignations` tesztek mintáját követi
**Target Platform**: Vercel + Inngest Cloud (a meglévő 4 detektor-cronnal azonos deploy-cél, nincs új szolgáltatás)
**Project Type**: Web application — egyetlen Next.js app monorepóban (Constitution III)
**Performance Goals**: nincs új teljesítmény-cél; a cron óránként fut (a meglévő 4 detektorral azonos ütemben, más perc-offszettel az ütközés elkerülésére), a batch-méret a meglévő 20-as mintát követi
**Constraints**: nincs új szolgáltatás (Constitution III); a max 6 szavas leírás-CHECK-constraint NEM vonatkozik erre a táblára (spec Assumptions); a státuszfrissítés monoton KELL legyen (spec FR-006/edge case: régebbi cikk újrafeldolgozása nem írhat vissza egy korábbi fázisra)
**Scale/Scope**: 1 új tábla + enum, 1 új migráció, 1 új LLM-prompt modul (`ai-criminal-complaints.ts`), 1 új Inngest function, 1 új `review.ts`-helper (`findExistingComplaint` + állapotgép-döntés), 4 érintett Telegram-integrációs fájl (`notify.ts`, `telegram-review-actions.ts`, `telegram/webhook/route.ts`, `inngest/index.ts`), 1 új UI-lista-komponens + a `/birosagi-iteletek/page.tsx` bővítése

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Trust Posture Above Convenience** — N/A közvetlenül (nincs whistleblower-facing szöveg ebben a körben); a publikus oldalon a feljelentés-bejegyzések ugyanabban a "Sajtójelentések alapján... ártatlanság vélelme" jellegű keretben jelennek meg, mint a `CourtVerdict`-blokk — ezt a tervet nem érinti, a meglévő oldal-szintű disclaimer öröklődik.
- **II. Phased Shippability** — ✅ Önálló, a Phase 3 (scraper/detektor) rétegre épülő szelet; a UI-blokk és a detektor egymástól függetlenül is demózható (a UI üres-állapottal is működik, mielőtt az első sor beérkezik).
- **III. Single Next.js App on the Inbox-to-Action Stack** — ✅ Új Inngest function a MEGLÉVŐ `apps/web/src/inngest/functions/` alatt, a meglévő szerválási úton (`app/api/inngest/route.ts`); nincs új szolgáltatás, nincs új SDK-függőség (a Telegram-hívások a meglévő `lib/telegram.ts`-t használják újra).
- **IV. Data Minimization & GDPR** — ✅ Nincs új PII-tárolás; a `targetName`/`filerName` mezők közéleti szereplők/intézmények nevei (nem magánszemély-PII), pontosan úgy, ahogy a `CourtVerdict.personName` vagy a `PoliticalResignation.name` is ma. A `NewsArticle.body`-tilalom (Principle IV) érintetlen — a detektor csak `headline`+`excerpt`-et olvas.
- **V. Eventual-Consistency on KPIs** — N/A, ez a funkció nem érinti a `KpiSnapshot`-ot vagy az `aggregate.kpi-rollup` függvényt.
- **VI. Edge-First Reads, Rate-Limited Writes, Verified-Human Path** — ✅ A `/birosagi-iteletek` oldal a meglévő `revalidate = 120` ISR-ablakot örökli (nincs új publikus write-végpont); az egyetlen új írás-útvonal a MEGLÉVŐ, `secret_token`-védett Telegram webhookon keresztül fut, amit a 008-as spec már a "verified-human path" elveként dokumentált — nincs új rate-limit-felület.
- **VII. Two-Step Destructive Migrations & Editor-Decision Preservation** — ✅ A `0042_criminal_complaint.sql` tisztán additív (új tábla + új enum), nem érint meglévő oszlopot — nem kell két lépéses migráció. Az "Editor-decision preservation" elve itt is érvényesül: egy Telegram "Elutasítom" a meglévő `setPendingStatus()`-mintát követve TÖRLI a sort (nem `reviewStatus='rejected'`), hogy egy valódi jövőbeli fejlemény ne ütközzön 180 napig egy elutasított duplikátum-őrbe (l. Phase 0 döntések).

**Eredmény: minden kapu PASS, indoklandó sértés nincs → Complexity Tracking üres.**

## Phase 0 — Research (döntések)

- **Matching kulcs: `targetName` (ügy/célpont), NEM `filerName`.** A `CourtVerdict` a `personName`-t (a vádlottat) használja kulcsként, függetlenül attól, ki indította az eljárást — ugyanez a logika itt: egy feljelentés KÖVETKEZŐ fejleményéről szóló cikk gyakran már nem nevezi meg újra az eredeti feljelentőt (pl. "a rendőrség nyomozást indított" cikk nem feltétlenül írja ki újra a Miniszterelnökséget), de a célpont/ügy neve stabil marad. A `filerName` csak megjelenítési mező, nem matching-kulcs.
- **180 napos dedup-ablak, nem a szokásos 30.** A `DEDUP_WINDOW_DAYS=30` a lemondás/ítélet-mintára lett hangolva (gyors lefolyású események); egy feljelentésből hónapok múlva lesz csak vádemelés/ítélet (l. spec Assumptions) — `findExistingComplaint(db, targetName, withinDays=180)` saját paraméterrel.
- **5-fokú monoton állapotgép, nem egyszerű "azonos típus = duplikátum" (mint `CourtVerdict.verdictType`).** `STATUS_ORDER = { feljelentés: 0, nyomozás: 1, vádemelés: 2, ítélet: 3 }`, `elutasítva` speciális terminál (bármelyik állapotból elérhető, és bármelyik állapotba visszaléphet, ha egy ügyet újranyitnak — ritka, de valós eset). Frissítési szabály: `newOrdinal > currentOrdinal` VAGY `newStatus === 'elutasítva'` VAGY `currentStatus === 'elutasítva' && newStatus !== 'elutasítva'` → UPDATE; egyébként (egyenlő vagy alacsonyabb fokozat) → `discarded`, `reason: 'stale_status'` (a meglévő `duplicate` októl megkülönböztetve, hogy a `DetectionCheck` audit-trail elárulja, miért nem történt semmi).
- **Nincs cross-table FK/szinkron a `CourtVerdict`-tel.** A felhasználó explicit döntése (l. spec FR-010): mindkét blokk mindig látható, státuszfrissítés mindkettőben külön történik. Ez KEVESEBB kockázatot jelent, mint egy törékeny cross-table összekötés — a két detektor egymástól függetlenül fut, saját `DetectionCheck.detectorType` alatt (`'criminal_complaint'` vs. `'court_verdict'`), így egy hibás match az egyikben nem tudja eltörni a másikat.
- **Watchlist-gate: `isWatchlistPerson(filerName) || isWatchlistPerson(targetName)`.** A meglévő `isWatchlistPerson()` substring-token-matchelést végez, tehát intézménynevekre (pl. "Miniszterelnökség") általában `false`-t ad — ez helyes, mert az intézményi feljelentések önmagukban nem indokolnak kötelező review-t; DE ha egy konkrét watchlist-személy neve szerepel akár feljelentőként, akár célpontként (pl. "Rogán Antal ellen tett feljelentést..."), a meglévő 003-as szabály szerint kötelező pending, függetlenül a konfidenciától.
- **Rejection = törlés, nem `reviewStatus='rejected'`.** A `telegram-review-actions.ts`/`setPendingStatus()` meglévő indoklása (2026-07-14, l. `webhook/route.ts` komment) itt is érvényes: egy elutasított sor nem maradhat 180 napig "duplikátum-csapdaként" egy valódi jövőbeli fejlemény útjában.
- **Nincs `personGaleriaId`/`personUgyId`-szerű kereszthivatkozás v1-ben.** A spec Key Entities szakasza nem kéri, és a `targetName` gyakran egy intézmény/ügy-csoport (pl. "7 civil szervezet összefonódása"), nem egy Galéria/Ügyek-configban azonosítható egyén — a manuális összekapcsolás egy jövőbeli, külön scope-olt feature marad.
- **Inngest-kvóta megjegyzés (operatív, nem tervezési döntés):** a projekt jelenleg időszakosan Inngest-kvóta-kiesésekkel küzd (l. memória: FB-sync, YouTube-sync bypass-scriptek). Az új `detect-criminal-complaints` cronhoz is készül egy `detect-criminal-complaints-now.ts` egyszeri bypass-script a `detect-now.ts` mintájára, hogy kvóta-kiesés esetén kézzel is futtatható legyen — ezt a Phase 1 tartalmazza.

## Phase 1 — Adatmodell és interfész-változások

### Új tábla: `CriminalComplaint` (`0042_criminal_complaint.sql`)

| Mező | Típus | Megjegyzés |
|---|---|---|
| `id` | `uuid` PK | |
| `targetName` | `text NOT NULL` | Ügy/célpont neve — a "Ügy neve" mező a UI-n, ÉS a matching-kulcs |
| `filerName` | `text NOT NULL` | Feljelentő (intézmény/személy) — csak megjelenítés |
| `description` | `text` | |
| `status` | `complaint_status` enum `NOT NULL DEFAULT 'feljelentés'` | `'feljelentés' \| 'nyomozás' \| 'vádemelés' \| 'ítélet' \| 'elutasítva'` |
| `eventDate` | `timestamptz NOT NULL` | A legutóbbi státuszváltás dátuma (a `CourtVerdict.verdictDate` mintájára) — ez a "Dátum" oszlop |
| `filedAt` | `timestamptz` | Az eredeti feljelentés dátuma, ha ismert (nullable — néha csak egy fejlemény-cikk kerül elő elsőként) |
| `sourceUrls` / `sourceNames` / `sourceHeadlines` / `sourceDates` | `text[] NOT NULL DEFAULT '{}'` | A `CourtVerdict` mintája — minden fejlemény hozzáfűz egy elemet |
| `reviewStatus` | `review_status` (meglévő enum) `NOT NULL DEFAULT 'approved'` | |
| `createdAt` / `updatedAt` | `timestamptz NOT NULL DEFAULT now()` | |

Indexek: `eventDate`, `targetName`, `reviewStatus`, `status`.

### `DetectorType` bővítés (`packages/db/src/detection-check.ts`)

`'resignation' | 'media_closure' | 'court_verdict' | 'asset_recovery'` → + `'criminal_complaint'`.

### Új LLM-modul: `packages/db/src/ai-criminal-complaints.ts`

`detectCriminalComplaintFromArticle(headline, excerpt, dateIso)` → `{ complaints: Array<{ targetName, filerName, description, status, confidence }> }` — tömbös extrakció (a `resignation-detect.ts` `resignations[]` mintája), a `status` mezőt maga az LLM állapítja meg a cikk szövegéből (kezdő feljelentés vs. már ismert fejlemény), az 5 enum-értékre korlátozva, bizonytalan esetben `'feljelentés'` az alapértelmezés.

### Új `review.ts`-helper: `findExistingComplaint()` + `decideComplaintTransition()`

```ts
findExistingComplaint(db, targetName, withinDays = 180): Promise<{ id: string; status: ComplaintStatus } | null>
decideComplaintTransition(current: ComplaintStatus, next: ComplaintStatus): 'update' | 'stale'
```

Pure function, unit-tesztelhető a `review.ts` meglévő tesztmintája szerint (l. Phase 0 állapotgép-szabály).

### Új Inngest function: `detect-criminal-complaints.ts` (+ regisztráció `inngest/index.ts`-ben)

A `detect-verdicts.ts` váza: `FELJELENTES_KEYWORDS = ['feljelent']` előszűrés → batch (20) → LLM → per-complaint hurok (a `processResignation` tömbös mintája) → `findExistingComplaint` → insert vagy monoton update → `markChecked` → `notifyReviewNeeded` pending esetén. Cron offset: `'45 * * * *'` (a meglévő 4 detektor `:00/:15/:30` óránkénti futásaitól elkülönítve).

Egyszeri bypass-script: `packages/db/src/detect-criminal-complaints-now.ts` (a `detect-now.ts` mintája), kvóta-kiesés esetére.

### Telegram-integráció bővítése (5. kategória, kód: `f`)

| Fájl | Változás |
|---|---|
| `lib/notify.ts` | `ReviewNeededEvent['detectorType']` + `'criminal_complaint'`; `DETECTOR_LABELS_HU.criminal_complaint = 'Feljelentés'`; `DETECTOR_CODES.criminal_complaint = 'f'` |
| `lib/telegram-review-actions.ts` | Új `processCriminalComplaint()` (a `processCourtVerdict()` + `processResignation()` tömbös hurkának keveréke — l. Phase 0 állapotgép); felvéve a `DETECTOR_PROCESSORS`-ba |
| `api/telegram/webhook/route.ts` | `DETECTOR_BY_CODE.f`, `DELETE_CODE_TABLE.f`, `DETECTOR_LABELS_HU.f`, `NEWS_ONLY_TAG.f`; `searchCriminalComplaints()` a revoke-kereséshez; `CATEGORY_HINTS` bővítése (`['feljelent']` → `'f'`); `TIP_CATEGORY_BUTTONS` 6. gomb ("📝 Feljelentés"); `findPendingRecord`/`setPendingStatus`/`deleteByCode` új ágak |

### UI: `/birosagi-iteletek/page.tsx` + új `ComplaintList.tsx`

Harmadik blokk a szűrők FÖLÖTT, a meglévő `VerdictList` fölött; saját `StatusBadge`-szerű színkód: `feljelentés`=szürke, `nyomozás`=kék, `vádemelés`=narancs, `ítélet`=piros, `elutasítva`=áthúzott/tompított szürke — az oldal meglévő `verdictTypeColor()` palettájával konzisztensen, de önálló komponensként (nincs ok a `VerdictList`-et generikussá tenni két különböző adatmodellhez).

## Verifikáció

1. `npx tsc --noEmit` és `npx drizzle-kit check` tisztán fusson le a migráció után.
2. Egy mesterséges kormányinfó-jellegű cikk (5 különálló ügy) a `detectCriminalComplaintFromArticle` hívásán 5 elemű tömböt ad vissza, és mind az 5 önálló sorként kerül be (SC-001).
3. Ugyanahhoz a `targetName`-hez tartozó, magasabb `status`-t jelző második cikk a MEGLÉVŐ sort frissíti (nem hoz létre újat) — 10 kézzel írt teszteset a `decideComplaintTransition()`-ön (SC-002).
4. Egy alacsonyabb/egyenlő `status`-t jelző, régebbi cikk újrafeldolgozása `'stale_status'` okkal `discarded`, nem írja vissza a sort.
5. Telegram: egy mesterséges 0.72 konfidenciájú találat gombnyomása ténylegesen módosítja az adatbázist, és a `crossCheckOtherCategories()` a `criminal_complaint`-et is figyelembe veszi ötödik kategóriaként (SC-005).
6. `/birosagi-iteletek` a meglévő 2 blokk fölött mutatja az új blokkot, szín szerint megkülönböztethető állapotokkal (SC-003 vizuális ellenőrzése + Playwright/axe a meglévő accessibility-suite mintájára).
7. Manuális teszt éles adaton: a korábban azonosított 6 valódi eset (Miniszterelnökség/kormány/TI feljelentései, l. spec Input) helyesen bekerül, a Semjén "Zsolti bácsi" és Havasi–Magyar Péter esetek NEM kerülnek be (edge case regresszió).
