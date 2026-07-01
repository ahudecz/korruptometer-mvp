# Tasks: Detection Review Engine

**Input**: Design documents from `/specs/003-detection-review-engine/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/admin-review.md

**Tests**: Korlátozottan beépítve — kizárólag a bizalmi-kritikus, tiszta döntési logikára (`decideStatus`, watchlist-illesztés, dedup), mert ez az alkotmány I. (NEM-MEGSZEGHETŐ) elve alá esik. Egyébként a meglévő vitest-konvenciót követjük.

**Organization**: A feladatok user story szerint csoportosítva, hogy minden story önállóan megvalósítható és tesztelhető legyen.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: párhuzamosítható (külön fájl, nincs függőség)
- **[Story]**: melyik user story-hoz tartozik (US1, US2, US3)

## Path Conventions

Web-app monorepo: `app/packages/db/src/`, `app/apps/web/...`, `app/supabase/migrations/` (lásd plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Hozz létre üres migrációs fájlt `app/supabase/migrations/0030_detection_review_status.sql` (a következő szabad sorszám: 0030)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Egyetlen user story sem kezdhető el ezek nélkül.

- [x] T002 Add `review_status` pgEnum (`'approved'|'pending'|'rejected'`) és `reviewStatus` oszlop (NOT NULL DEFAULT `'approved'`) a `politicalResignations`, `mediaClosures`, `courtVerdicts` táblákhoz + `reviewStatus` indexek a `app/packages/db/src/schema.ts`-ben
- [x] T003 Írd meg a két lépcsős, nem-destruktív migrációt a `app/supabase/migrations/0030_detection_review_status.sql`-ben: (1) CREATE TYPE, (2) ADD COLUMN nullable, (3) UPDATE … SET 'approved' WHERE NULL, (4) SET DEFAULT 'approved' + SET NOT NULL, (5) indexek (alkotmány VII.)
- [x] T004 [P] Hozd létre az egyesített watchlist modult `app/packages/db/src/watchlist.ts`: `WATCHLIST_PERSONS` (a 8 „lemondásra felszólított" + 10 galéria-személy egy listában) és `isWatchlistPerson(name)` normalizált illesztéssel; a forrásértékeket a meglévő `detect-resignations.ts` `WATCHLIST_NAMES` + `relevance.ts`/galéria listából told be
- [x] T005 [P] Hozd létre a döntési modult `app/packages/db/src/review.ts`: `decideStatus(confidence, isWatchlist)`, `normalizeName(name)`, `isDuplicate(db, table, name, withinDays=30)` (a contracts/admin-review.md szerint)
- [x] T006 [P] Egységtesztek a bizalmi-kritikus logikára `app/packages/db/src/review.test.ts`: `decideStatus` minden ága (≥0.90/0.70–0.90/<0.70, watchlist mindig pending), `isWatchlistPerson`, `normalizeName` (vitest)
- [x] T007 Futtasd a migrációt lokálisan (`pnpm --filter @korr/db db:migrate`) és igazold, hogy a meglévő sorok `approved`-ok maradtak (FR-010 / SC-005)

---

## Phase 3: User Story 1 - Editor reviews uncertain detections (Priority: P1) 🎯 MVP

**Goal**: A bizonytalan/kiemelt találatok nem mennek ki automatikusan; a `pending` sorok az admin review-soron várnak; a szerkesztő elfogad/eldob; a publikus oldal csak `approved`-ot mutat.

**Independent Test**: Egy 0.82-es vagy watchlist-személyes találat `pending`, nem látszik publikusan; „Elfogad" → megjelenik; „Eldob" → nem jelenik meg és újrafuttatáskor sem tér vissza.

### Detektor-bekötés (státusz a beszúráskor)

- [x] T008 [US1] Kösd be a `decideStatus` + `isWatchlistPerson` döntést a `app/apps/web/src/inngest/functions/detect-resignations.ts`-be: `discard` → nincs insert; egyébként `reviewStatus = status` a beszúrásban (a jelenlegi `confidence < 0.7` skip lecserélve)
- [x] T009 [P] [US1] Ugyanez a `app/apps/web/src/inngest/functions/detect-media-closures.ts`-ben
- [x] T010 [P] [US1] Ugyanez a `app/apps/web/src/inngest/functions/detect-verdicts.ts`-ben

### Publikus olvasás szűrése (csak approved)

- [x] T011 [US1] `reviewStatus='approved'` szűrő a `app/apps/web/app/lemondasok/page.tsx` lekérdezésekbe (lista + összegző számok) és a `app/apps/web/app/api/resignations/route.ts`-be
- [x] T012 [P] [US1] `reviewStatus='approved'` szűrő a `app/apps/web/app/megszunt/page.tsx`-be
- [x] T013 [P] [US1] `reviewStatus='approved'` szűrő a `app/apps/web/app/birosagi-iteletek/page.tsx`-be
- [x] T014 [US1] `reviewStatus='approved'` szűrő a `app/apps/web/app/page.tsx` nyitóoldali számlálókba és listákba (`resignationCount`, `pretrialCountDb`, `eliteltCountDb`, `closureCount`, `topResignations`, `latestResignations5`)

### Admin review-felület

- [x] T015 [US1] Hozd létre a review-oldalt `app/apps/web/app/admin/(authed)/review/page.tsx`: a 3 táblából a `pending` sorok típus szerint, kiolvasott mezők + forráscikk-hivatkozás
- [x] T016 [US1] Hozd létre az elfogad/eldob szerver-action-öket `app/apps/web/app/admin/(authed)/review/review-actions.ts`: `approveDetection`/`rejectDetection` (státusz beállítás + `revalidatePath`/`revalidateTag`), csak admin-szerep
- [x] T017 [US1] Vedd fel a „Review" fület/linket az admin navigációba `app/apps/web/app/admin/(authed)/admin-tabs.tsx`

**Checkpoint**: US1 önállóan tesztelhető és deployolható — ez az MVP (a bizalmi kapu).

---

## Phase 4: User Story 2 - Confident, non-sensitive detections auto-publish (Priority: P2)

**Goal**: ≥0.90 megbízhatóságú, nem-kiemelt találat szerkesztő nélkül `approved` és publikus; minden watchlist-személyes találat (akár 0.95) `pending` marad.

**Independent Test**: 0.93 nem-watchlist → azonnal publikus; 0.95 watchlist → pending.

- [x] T018 [US2] Igazold és fedd le teszttel az auto-publikálás + watchlist-kizárás ágat a `app/packages/db/src/review.test.ts`-ben (0.93 non-watchlist → approved; 0.95 watchlist → pending), és ellenőrizd, hogy a T008–T010 detektor-bekötés az `approved` ágat is helyesen alkalmazza
- [ ] T019 [US2] Manuális acceptance: egy egyértelmű, nem-kiemelt hír auto-megjelenik a publikus oldalon; egy watchlist-személyes a review-soron marad (quickstart.md 1–2. pont)

**Checkpoint**: US2 az US1-re épül (a `decideStatus` `approved` ága), de a tesztje/igazolása önálló.

---

## Phase 5: User Story 3 - No duplicate of the same person from one news wave (Priority: P3)

**Goal**: Ugyanaz a személy nem kerül be kétszer eltérő intézménynévvel; az eldobott (`rejected`) sem tér vissza.

**Independent Test**: Két cikk „Kovács Zoltán"-ról 30 napon belül → egy bejegyzés.

- [x] T020 [US3] Kösd be az `isDuplicate(...)` őrt a beszúrás elé mindhárom detektorban (T008–T010 helyén), minden státusz ellen, 30 napos ablakban (FR-009, FR-011)
- [x] T021 [P] [US3] Egységteszt a dedupra `app/packages/db/src/review.test.ts`-ben: azonos normalizált név eltérő intézménynévvel → duplikátum; `rejected` sor blokkolja az újra-létrehozást

**Checkpoint**: US3 finomítás — az US1/US2 nélküle is működik, de tisztább a lista.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T022 [P] Dokumentáld a `LLM_PROVIDER` / `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` változókat a `app/.env.example`-ben
- [ ] T023 Teljes lokális smoke-teszt a `quickstart.md` szerint (pending→elfogad→publikus; watchlist→pending; eldob→nem tér vissza)
- [ ] T024 Migráció a production DB-n (`0030`), majd kód-deploy (Vercel)
- [ ] T025 **Csak a migráció + deploy után**: `LLM_API_KEY` + `LLM_MODEL=gpt-5-chat-latest` beállítása a Vercel production env-ben → a cron-detektorok elkezdik termelni a `pending`/`approved` sorokat

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T007)**: minden story előfeltétele.
- **US1 (T008–T017)**: a foundational után; ez az MVP, önállóan szállítható.
- **US2 (T018–T019)**: a foundational `decideStatus` + az US1 detektor-bekötésre épül.
- **US3 (T020–T021)**: a foundational `isDuplicate` + a detektor-bekötésre épül.
- **Polish (T022–T025)**: az összes story után; T024 (prod migráció) **mindig** T025 (kulcs kitétele) előtt.

## Parallel Opportunities

- Foundational: **T004, T005, T006** párhuzam (külön új fájlok), miután T002/T003 megvan.
- US1 detektorok: **T009, T010** párhuzam (T008 mintája után).
- US1 publikus szűrők: **T012, T013** párhuzam (T011 után/mellett).

## Implementation Strategy

- **MVP = US1** (a bizalmi kapu). Ezzel már biztonságosan bekapcsolható a detektálás: minden jóváhagyatlan adat a review-soron marad, a publikus oldal tiszta.
- Utána **US2** (auto-publikálás a tiszta esetekre, kevesebb kézi munka), majd **US3** (duplikáció-szűrés).
- A kulcs a Vercelre **csak a T024 után** (FR-010 / SC-005 védelme).

## Summary

- **Összes feladat**: 25 (T001–T025)
- **Story szerint**: Setup 1 · Foundational 6 · US1 10 · US2 2 · US3 2 · Polish 4
- **Párhuzam-lehetőség**: T004/T005/T006; T009/T010; T012/T013
- **MVP scope**: US1 (T001–T017) — a bizalmi kapu, önállóan szállítható
