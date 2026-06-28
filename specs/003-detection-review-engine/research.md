# Phase 0 Research: Detection Review Engine

A spec részletes volt → nincs nyitott `[NEEDS CLARIFICATION]`. Az alábbi döntések a megvalósítás technikai választásait rögzítik.

## D1. Státusz tárolása

- **Decision**: Minden detektor-táblához (`PoliticalResignation`, `MediaClosure`, `CourtVerdict`) egy `reviewStatus` Postgres enum oszlop (`'approved' | 'pending' | 'rejected'`), index a gyors `pending`-szűréshez.
- **Rationale**: Egyszerű, lekérdezésbarát, illeszkedik a meglévő enum-mintához (`resignation_type`, `media_closure_type`). A publikus szűrés egy `WHERE reviewStatus='approved'`.
- **Alternatives**: Külön `DetectionQueue` tábla — elvetve, mert megduplázná a sémát és a publikus lekérdezéseknek join-olnia kellene; a státusz természetesen az elemhez tartozik.

## D2. Nem-destruktív, két lépcsős migráció (alkotmány VII.)

- **Decision**: `0030_detection_review_status.sql`:
  1. `CREATE TYPE review_status AS ENUM ('approved','pending','rejected');`
  2. `ALTER TABLE ... ADD COLUMN "reviewStatus" review_status;` (nullable)
  3. `UPDATE ... SET "reviewStatus" = 'approved' WHERE "reviewStatus" IS NULL;` (meglévő élő adat → approved)
  4. `ALTER TABLE ... ALTER COLUMN "reviewStatus" SET DEFAULT 'approved', SET NOT NULL;`
- **Rationale**: A nullable→backfill→not-null sorrend biztosítja, hogy a régi sorok (FR-010, SC-005) ne tűnjenek el, és a deploy alatti rövid átfedésben se legyen NOT NULL-ütközés.
- **Alternatives**: Egy lépéses `ADD COLUMN ... NOT NULL DEFAULT 'pending'` — elvetve, mert a meglévő publikus adatot `pending`-be tenné (eltüntetné az oldalról), ami megsérti FR-010-et.

## D3. Hol dől el a státusz

- **Decision**: A küszöb→státusz döntés egy közös tiszta függvény a `@korr/db`-ben (`review.ts`): `decideStatus(confidence, isWatchlist) → 'approved' | 'pending' | 'discard'`. A 3 Inngest detektor-függvény (`detect-*.ts`) ezt hívja a beszúrás előtt, és a `reviewStatus`-t a beszúrásba teszi (vagy eldobja `discard` esetén).
- **Rationale**: Egyetlen forrás a küszöb-logikának; unit-tesztelhető a hálózat/DB nélkül. A detektor-függvények már most is ezen a ponton döntenek (jelenleg `confidence < 0.7` skip).
- **Küszöbök**: `confidence >= 0.90 && !isWatchlist → approved`; `confidence >= 0.70 → pending`; egyébként `discard`. Watchlist → soha nem approved.

## D4. Egyesített watchlist (8 + 10)

- **Decision**: Új `@korr/db/src/watchlist.ts` modul egyetlen forrásként: a 8 „lemondásra felszólított" (jelenleg `detect-resignations.ts` `WATCHLIST_NAMES`) + a 10 galéria-személy (jelenleg `GALERIA` config / `relevance.ts` `BREAKING_MONITORED`). Export: `WATCHLIST_PERSONS: string[]` és `isWatchlistPerson(name): boolean` normalizált (kisbetű, ékezet- és szóköz-toleráns, rész-token) illesztéssel.
- **Rationale**: Jelenleg a lista 2-3 helyen duplikálódik. Egy forrás → konzisztens döntés és breaking is innen olvashat.
- **Alternatives**: A meglévő szétszórt listák megtartása — elvetve a duplikáció és elcsúszás kockázata miatt.

## D5. Duplikáció-szűrés

- **Decision**: Normalizált név (`lower`, ékezet- és írásjel-toleráns, trim) alapú egyezés egy **30 napos** ablakban, **az összes státusz ellen** (`approved` + `pending` + `rejected`). Ha van illeszkedő sor az ablakban → nem hozunk létre újat. Az intézménynevet a dedup **nem** veszi figyelembe (ez okozta a „Kovács Zoltán" duplát).
- **Rationale**: FR-009 + FR-011: a `rejected` is blokkolja az újra-létrehozást, így a szerkesztő által eldobott elem nem tér vissza. A névalapú illesztés kiküszöböli az eltérő intézménynév-stringeket.
- **Alternatives**: Forrás-URL alapú dedup — elvetve, mert ugyanaz az esemény több cikkből/URL-ből jön; a személy a stabil kulcs.

## D6. Publikus olvasás szűrése

- **Decision**: Mind az 5 publikus lekérdezési pont (`lemondasok`, `megszunt`, `birosagi-iteletek`, `page.tsx` nyitó számlálók+listák, `api/resignations`) kap egy `reviewStatus = 'approved'` szűrőt. A meglévő `revalidate` változatlan; az admin elfogad/eldob után `revalidateTag`/`revalidatePath` frissít.
- **Rationale**: FR-002. A nyitóoldali számlálók (`resignationCount`, `pretrialCountDb`, `closureCount`) is csak az `approved` sorokat számolják, hogy a szám és a lista egyezzen.

## D7. Admin review-felület

- **Decision**: Új `/admin/(authed)/review` oldal a meglévő admin-mintába (mint a `resignations`, `media-closures`). A `pending` elemeket a 3 táblából összegyűjti, mutatja a kiolvasott mezőket + forrás-hivatkozást, és „Elfogad" / „Eldob" gombokat ad. A művelet egy szerver-action, ami a `reviewStatus`-t `approved`/`rejected`-re állítja, majd revalidál.
- **Rationale**: VI. elv — a meglévő `(authed)` admin-szerep és Supabase-auth védi. Nincs új auth-felület.

## Megőrzött invariánsok (alkotmány VII.)

- A detektor-újrafuttatás **sosem** írja felül egy meglévő sor `reviewStatus`-át. Új sor csak akkor jön létre, ha a dedup nem talál egyezést — és a dedup a `rejected`-et is nézi.
- A migráció megőrzi a meglévő (élő) sorokat `approved`-ként.
