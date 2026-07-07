# Tasks: Detekciós pipeline megbízhatóság és felügyelet

**Input**: Design documents from `/specs/006-detection-pipeline-reliability/`
**Prerequisites**: plan.md, spec.md

**Tests**: Korlátozottan beépítve — a bizalmi-kritikus logikára (`markChecked` idempotencia, hiba-útvonal SOSEM jelöl "ellenőrizve"-t, duplikátum/near-miss besorolás), az alkotmány I. elve alá esik. Egyébként a meglévő vitest-konvenció.

**Organization**: A feladatok user story szerint csoportosítva, hogy minden story önállóan megvalósítható és tesztelhető legyen.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: párhuzamosítható (külön fájl, nincs függőség)
- **[Story]**: melyik user story-hoz tartozik (US1–US4)

## Path Conventions

Web-app monorepo: `app/packages/db/src/`, `app/apps/web/...`, `app/supabase/migrations/` (lásd plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Hozz létre üres migrációs fájlt `app/supabase/migrations/0032_detection_check_log.sql` (köv. szabad sorszám: 0032)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Egyetlen user story sem kezdhető el ezek nélkül.

- [x] T002 Add `detectionChecks` tábla a `app/packages/db/src/schema.ts`-ben: `id`, `articleId` (FK → `newsArticles.id`, cascade), `detectorType`, `outcome`, `reason` (nullable), `extractedName` (nullable), `confidence` (nullable, real), `checkedAt` (default now) + `UNIQUE(articleId, detectorType)` index (lásd plan.md Data Model)
- [x] T003 Írd meg a tisztán additív migrációt `app/supabase/migrations/0032_detection_check_log.sql`-ben: CREATE TABLE + FK + egyedi index (nincs meglévő oszlop-módosítás, a kétlépcsős szabály nem alkalmazandó)
- [x] T004 [P] Hozd létre `app/packages/db/src/detection-check.ts`-t: `DetectorType` union, `BACKLOG_DAYS = 7`, `markChecked(db, { articleId, detectorType, outcome, reason?, extractedName?, confidence? })` (`ON CONFLICT (articleId, detectorType) DO NOTHING`), `loadUncheckedArticles(db, detectorType, backlogDays = BACKLOG_DAYS)` (a régi `WHERE publishedAt >= since` cseréje `NOT EXISTS`-re, lásd plan.md)
- [x] T005 [P] Egységtesztek `app/packages/db/src/detection-check.test.ts`-ben: `markChecked` idempotens (kétszeri hívás nem hoz létre duplikátumot); `loadUncheckedArticles` nem adja vissza az egyszer már `markChecked`-elt cikket; a 7 napnál régebbi, sosem ellenőrzött cikk NEM jelölt (backlog-korlát)
- [x] T006 Futtasd a migrációt lokálisan (`pnpm --filter @korr/db db:migrate`) és igazold, hogy a meglévő táblák/sorok érintetlenek

---

## Phase 3: User Story 1 - Átmeneti hiba után magától helyreáll (Priority: P1) 🎯 MVP

**Goal**: Egy LLM-hiba miatt elakadt jelölt a következő futáson automatikusan újra feldolgozásra kerül; a rögzített 2 órás időablak megszűnik, backlog-alapú (7 nap) lekérdezés lép a helyébe; mind a 4 detektorban.

**Independent Test**: Mesterségesen hibáztatott LLM-hívás után a cikk nem kap `DetectionCheck` sort; a következő (sikeres) futáson helyesen feldolgozódik, pontosan egyszer.

- [x] T007 [US1] Írd át `app/apps/web/src/inngest/functions/detect-resignations.ts`-t: `loadUncheckedArticles(db, 'resignation')` a mai `db.select()...where(gte(publishedAt, since))` helyett; minden ág végén (siker/discard) `markChecked(...)`; a `try/catch`-ben az LLM-hiba ágán **NE** hívd meg a `markChecked`-et
- [x] T008 [P] [US1] Ugyanez `app/apps/web/src/inngest/functions/detect-media-closures.ts`-ben (`detectorType: 'media_closure'`)
- [x] T009 [P] [US1] Ugyanez `app/apps/web/src/inngest/functions/detect-verdicts.ts`-ben (`detectorType: 'court_verdict'`)
- [x] T010 [P] [US1] Ugyanez `app/apps/web/src/inngest/functions/detect-asset-recoveries.ts`-ben (`detectorType: 'asset_recovery'`)
- [x] T011 [US1] Integrációs/unit teszt (a detektor modulban vagy egy dedikált tesztfájlban): LLM-hívás hibát dob → nincs `DetectionCheck` sor → egy második lefuttatás (sikeres LLM-mel) helyesen beszúr, és NEM jön létre duplikátum

**Checkpoint**: US1 önállóan tesztelhető és deployolható — ez az MVP (a Berta Adrienn/Szöllősi-osztályú incidens ettől nem ismétlődhet meg).

---

## Phase 4: User Story 2 - Minden nem-beszúrt jelölt indoklása visszakereshető (Priority: P2)

**Goal**: Minden `discard`/negatív/duplikátum ágon konkrét `reason` kerül a `DetectionCheck` sorba; a szerkesztő fejlesztői szkript nélkül megérti, miért nem jelent meg egy eset.

**Independent Test**: Egy 0.55 megbízhatóságú találatnál a `DetectionCheck` sor `reason='low_confidence'`, a helyes névvel/megbízhatósággal.

- [x] T012 [US2] A T007–T010 négy detektorában finomítsd a `markChecked` hívásokat, hogy minden eldobási ág saját `reason`-t adjon át: `low_confidence` (decideStatus discard), `not_applicable` (isResignation/isClosure/stb. false), `missing_fields` (hiányzó name/institution), `duplicate` (isDuplicate igaz)
- [x] T013 [P] [US2] Egészítsd ki `app/packages/db/src/detection-check.test.ts`-t: minden `reason`-ágra egy-egy eset, amely igazolja a helyes kód + a `confidence`/`extractedName` mentését

**Checkpoint**: US2 az US1 hívási pontjaira épül, de önállóan igazolható (a `reason` mezők helyessége).

---

## Phase 5: User Story 3 - Havi összefoglaló egy admin-oldalon (Priority: P3)

**Goal**: Egy `/admin/detection-digest` oldal hónap szerint csoportosítva mutatja az auto-publikált, pending és "majdnem bekerült" (0.50–0.6999 megbízhatóságú, `low_confidence` eldobás) eseteket.

**Independent Test**: Egy adott hónapra a három szám és lista egyezik a mögöttes `DetectionCheck` + a 4 eredménytábla adataival.

- [x] T014 [US3] Írd meg a lekérdezés-helpert (pl. `app/apps/web/src/lib/detection-digest.ts`): egy adott hónapra `approved`/`pending` darabszám+lista a 4 eredménytáblából (`reviewStatus` alapján, 003), és "majdnem bekerült" darabszám+lista a `DetectionCheck`-ből (`outcome='discarded' AND reason='low_confidence' AND confidence BETWEEN 0.50 AND 0.6999`)
- [x] T015 [US3] Hozd létre `app/apps/web/app/admin/(authed)/detection-digest/page.tsx`-t: hónap-választó (alapérték: aktuális hónap) + 3 szekció, mindegyik elem linkelve a forráscikkhez
- [x] T016 [P] [US3] Vedd fel a "Havi összefoglaló" fület/linket az admin navigációba `app/apps/web/app/admin/(authed)/admin-tabs.tsx`

**Checkpoint**: US3 az US1/US2 adatára épül, de önállóan deployolható (csak olvasó admin nézet).

---

## Phase 6: User Story 4 - Csatorna-független értesítési pont (Priority: P4)

**Goal**: Egy `notifyReviewNeeded()` hívási pont létezik és be van kötve minden `pending`/"majdnem bekerült" esetnél; ma no-op/log-only; egy KÉSŐBBI Telegram-adapter bekötése nem igényel változtatást a 4 detektorban.

**Independent Test**: `notifyReviewNeeded()` egy teszt-adapterrel meghívva sikeresen "kézbesít"; adapter nélkül (mai állapot) nem dob hibát, a detektor-futás sikeresen befejeződik.

- [x] T017 [US4] Hozd létre `app/apps/web/src/lib/notify.ts`-t: `notifyReviewNeeded(event: { type: 'pending' | 'near_miss'; detectorType: DetectorType; name: string; confidence: number; articleUrl: string })` — ma `console.log` + no-op, dokumentált TODO a Telegram-adapterre
- [x] T018 [P] [US4] Kösd be a hívást mind a 4 detektorban: `reviewStatus==='pending'` beszúráskor, és `reason==='low_confidence' && confidence >= 0.50` eldobáskor
- [x] T019 [P] [US4] Egységteszt `app/apps/web/src/lib/notify.test.ts`-ben: adapter nélkül a hívás resolve-ol, nem dob; egy fake adapterrel a payload helyesen átadódik

**Checkpoint**: US4 a legalacsonyabb prioritás — ma megfigyelhető felhasználói érték nélkül, de a jövőbeli csatorna-bekötést kockázatmentessé teszi.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T020 [P] Dokumentáld kódkommentben a `BACKLOG_DAYS` (7) és a "majdnem bekerült" sáv (0.50–0.6999) konstansokat + hogyan hangolhatók módosítás nélkül újra-deploy nélkül (jelenleg: nem lehet, kód-konstans — jegyezd meg jövőbeli env-var lehetőségként)
- [ ] T021 Teljes lokális smoke-teszt: (1) egy jelölt cikken mesterséges LLM-hiba → nincs `DetectionCheck` sor → újrafuttatás sikerrel jár; (2) egy 0.55-ös eset megjelenik a havi digest "majdnem bekerült" listáján; (3) `notifyReviewNeeded` lefut hiba nélkül csatorna-adapter nélkül is
- [ ] T022 Migráció a production DB-n (`0032`), majd kód-deploy (Vercel) — mivel tisztán additív, a meglévő detektor-futások a deploy pillanatáig változatlanul mennek, utána azonnal az új logikát használják
- [ ] T023 Az első production futás után ellenőrizd, hogy a 7 napos backlog egyszeri "utolérése" nem futja túl az Inngest lépés/idő-korlátait (a meglévő `BATCH_SIZE=20` lépés-darabolás ezt már kezeli) — ha mégis, csökkentsd a `BACKLOG_DAYS`-t vagy növeld a `step.run` darabolást

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T006)**: minden story előfeltétele.
- **US1 (T007–T011)**: a foundational után; ez az MVP, önállóan szállítható.
- **US2 (T012–T013)**: az US1 hívási pontjaira épül (ugyanazokat a `markChecked` hívásokat finomítja).
- **US3 (T014–T016)**: az US1/US2 által termelt `DetectionCheck` adatra épül.
- **US4 (T017–T019)**: független modul, de a bekötése (T018) az US1/US2 beszúrási/eldobási ágaira épül.
- **Polish (T020–T023)**: az összes story után; T022 (prod migráció) mindig T023 (első-futás ellenőrzés) előtt.

## Parallel Opportunities

- Foundational: **T004, T005** párhuzam, miután T002/T003 megvan.
- US1 detektorok: **T008, T009, T010** párhuzam (T007 mintája után).
- US3: **T016** párhuzam T014/T015 mellett.
- US4: **T018, T019** párhuzam T017 után.

## Implementation Strategy

- **MVP = US1** (a backlog-alapú önjavítás). Ez önmagában megszünteti a néma adatvesztés kockázatát — a Berta Adrienn/Szöllősi-osztályú incidens ettől nem ismétlődhet meg.
- Utána **US2** (indoklás-log — magyarázhatóság), majd **US3** (havi digest — kevesebb kézi ellenőrzés), végül **US4** (értesítési interfész — ma no-op, később Telegram).
- A production migráció (T022) additív, biztonságosan deployolható a kódváltással egy releaseben (nincs kétlépcsős kényszer, mert nincs destruktív elem).

## Summary

- **Összes feladat**: 23 (T001–T023)
- **Story szerint**: Setup 1 · Foundational 5 · US1 5 · US2 2 · US3 3 · US4 3 · Polish 4
- **Párhuzam-lehetőség**: T004/T005; T008/T009/T010; T018/T019
- **MVP scope**: US1 (T001–T011) — a néma adatvesztés megszüntetése, önállóan szállítható
