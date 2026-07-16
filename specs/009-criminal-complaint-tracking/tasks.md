# Tasks: Feljelentés-nyomkövető blokk a "Börtönben van-e?" oldalon

**Input**: Design documents from `/specs/009-criminal-complaint-tracking/`
**Prerequisites**: plan.md, spec.md

**Tests**: A `packages/db` meglévő vitest-keretével — `decideComplaintTransition()`
és `findExistingComplaint()` unit-tesztelhető a `review.ts` meglévő
tesztmintája szerint; a detektor end-to-end tesztje a `detect-verdicts`
teszt mintáját követi.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: párhuzamosítható (külön fájl, nincs függőség)
- **[Story]**: melyik user story-hoz tartozik (US1–US4, l. spec.md)

---

## Phase 1: Foundational (Blocking Prerequisites)

- [ ] T001 `app/supabase/migrations/0042_criminal_complaint.sql`: `complaint_status`
      enum (`feljelentés`/`nyomozás`/`vádemelés`/`ítélet`/`elutasítva`) + `CriminalComplaint`
      tábla (l. plan.md Phase 1 mezőtábla) + 4 index
- [ ] T002 `app/packages/db/src/schema.ts`: `criminalComplaints` Drizzle-tábla
      + `complaintStatusEnum` + `CriminalComplaint`/`NewCriminalComplaint` típusok
      (a `courtVerdicts` blokk mintája)
- [ ] T003 `app/packages/db/src/detection-check.ts`: `DetectorType` bővítése
      `'criminal_complaint'`-tal
- [ ] T004 [P] `app/packages/db/src/review.ts`: `findExistingComplaint(db, targetName,
      withinDays=180)` (a `findExistingVerdict()` mintája, normalizált `targetName`-en)
      + `decideComplaintTransition(current, next): 'update' | 'stale'` pure function
      (STATUS_ORDER-alapú monoton szabály, l. plan.md Phase 0)
- [ ] T005 [P] `app/packages/db/src/ai-criminal-complaints.ts` (új):
      `detectCriminalComplaintFromArticle(headline, excerpt, dateIso)` — Haiku-prompt,
      tömbös `complaints[]` extrakció (a `resignation-detect.ts` mintája), `status`
      mezővel (5 enum-érték, alapértelmezett `'feljelentés'`)
- [ ] T006 [P] `app/packages/db/src/review.test.ts` (bővítés): unit tesztek
      `decideComplaintTransition()`-re — minden állapotpár (10 kombináció) +
      `elutasítva` speciális eset mindkét irányban

**Checkpoint**: séma + pure logika készen áll, semmi nincs még bekötve.

---

## Phase 2: User Story 1 - Feljelentés-stádiumú ügyek láthatóvá válnak (Priority: P1) 🎯 MVP

- [ ] T007 [US1] `app/apps/web/src/inngest/functions/detect-criminal-complaints.ts`
      (új): `FELJELENTES_KEYWORDS = ['feljelent']` előszűrés → `loadUncheckedArticles`
      → batch(20) → LLM → per-complaint hurok → `decideStatus()` (watchlist-gate:
      `isWatchlistPerson(filerName) || isWatchlistPerson(targetName)`) → INSERT
      (update-ág még T010-ben) → `markChecked` → cron `'45 * * * *'`
- [ ] T008 [US1] `app/apps/web/src/inngest/index.ts`: `detectCriminalComplaints`
      import + felvétel a `functions` tömbbe
- [ ] T009 [P] [US1] `app/apps/web/app/birosagi-iteletek/ComplaintList.tsx` (új):
      olvasás-only lista-komponens, mezők: Dátum (`eventDate`), Státusz, Feljelentő,
      Ügy neve, Leírás, Forrás(ok) — a `VerdictList.tsx` kártya-mintája, egyelőre
      egyszínű badge (színkód: US4)
- [ ] T010 [US1] `app/apps/web/app/birosagi-iteletek/page.tsx`: `criminalComplaints`
      lekérdezés (`reviewStatus='approved'`, `orderBy(desc(eventDate))`) + a 3.
      blokk beillesztése a meglévő 2 blokk FÖLÉ, a szűrők fölé

**Checkpoint**: egy kulcsszó-egyező, releváns cikk önállóan bekerül és megjelenik
az oldal tetején — a state-machine/update-ág még nem aktív (minden találat INSERT).

---

## Phase 3: User Story 2 - Fejlemény frissíti a meglévő sort, nem duplikál (Priority: P1)

- [ ] T011 [US2] `detect-criminal-complaints.ts` bővítése: `findExistingComplaint()`
      hívás minden extrahált complaint-re → `decideComplaintTransition()` →
      `'update'`: UPDATE (`status`, `eventDate`, `sourceUrls`/`sourceNames`/
      `sourceHeadlines`/`sourceDates` `array_append`) a `processCourtVerdict()`
      update-ágának mintájára; `'stale'`: `markChecked(..., reason: 'stale_status')`
- [ ] T012 [US2] Ugyanez a matching+state-machine logika kiemelve egy megosztott
      helperbe (`packages/db/src/criminal-complaint-shared.ts` vagy a `review.ts`-en
      belül), hogy a T007 cron ÉS a Phase 4 Telegram-reprocess ugyanazt hívja —
      nem két külön implementáció
- [ ] T013 [P] [US2] Integrációs teszt: azonos `targetName` két cikkel (alacsonyabb
      majd magasabb `status`) → 1 sor, frissített `status`+`sourceUrls.length===2`;
      fordított sorrendben (magasabb, majd alacsonyabb `status`) → a sor
      VÁLTOZATLAN marad, `DetectionCheck.reason==='stale_status'`

**Checkpoint**: egy 2 cikkes szekvencia (feljelentés → nyomozás indult) 1 sort
eredményez, helyes záró státusszal; a fordított sorrend nem ront vissza.

---

## Phase 4: User Story 3 - Bizonytalan találatok Telegram-jóváhagyása (Priority: P1)

- [ ] T014 [US3] `app/apps/web/src/lib/notify.ts`: `ReviewNeededEvent['detectorType']`
      + `'criminal_complaint'`; `DETECTOR_LABELS_HU.criminal_complaint = 'Feljelentés'`;
      `DETECTOR_CODES.criminal_complaint = 'f'`
- [ ] T015 [US3] `detect-criminal-complaints.ts`: `pending` ágon `notifyReviewNeeded()`
      hívás (`type:'pending'`, `recordId`) — insert ÉS update ágon egyaránt, a
      `processCourtVerdict()` mintája szerint
- [ ] T016 [US3] `app/apps/web/src/lib/telegram-review-actions.ts`: új
      `processCriminalComplaint(article, todayIso, bypassConfidenceGate)` —
      `processCourtVerdict()` váza + `processResignation()` tömbös hurka (T012
      megosztott helperét hívja) — felvéve a `DETECTOR_PROCESSORS`-ba
- [ ] T017 [US3] `app/apps/web/app/api/telegram/webhook/route.ts`:
      `DETECTOR_BY_CODE.f`, `DELETE_CODE_TABLE.f`, `DETECTOR_LABELS_HU.f`,
      `NEWS_ONLY_TAG.f = 'Feljelentés'` (`NewsArticle.tag` új értékként)
- [ ] T018 [P] [US3] `webhook/route.ts`: `searchCriminalComplaints(q)` (a
      `searchCourtVerdicts()` mintája, `targetName` ILIKE) + felvéve
      `searchRevokeCandidates()` `searchers` map-jébe; `CATEGORY_HINTS` bővítése
      (`keywords: ['feljelent'], code: 'f'`)
- [ ] T019 [P] [US3] `webhook/route.ts`: `TIP_CATEGORY_BUTTONS` 6. eleme
      (`📝 Feljelentés`, `a:f:{id}`) — kézi Telegram-bejelentés is választhatja
      ezt a kategóriát
- [ ] T020 [US3] `findPendingRecord()` + `setPendingStatus()` + `deleteByCode()`
      bővítése `'criminal_complaint'`/`'f'` ággal (`setPendingStatus` reject-nél
      TÖRLI a sort, nem `reviewStatus='rejected'` — l. plan.md Phase 0 indoklás)
- [ ] T021 [US3] `crossCheckOtherCategories()` — nincs kódváltoztatás szükséges
      (a `DETECTOR_PROCESSORS` kulcsain iterál), csak ellenőrzés: az 5. kategória
      automatikusan bekerül a hurokba T016 után
- [ ] T022 [P] [US3] Integrációs teszt: mesterséges 0.72 konfidenciájú találat →
      Telegram-üzenet → "Jóváhagyom" → DB-módosítás; ugyanez fejlemény-frissítésre
      (US2+US3 metszet, spec US3 2. acceptance scenario)

**Checkpoint**: egy pending feljelentés-találat a meglévő Telegram-boton
keresztül, a másik 4 kategóriával azonos módon jóváhagyható/elutasítható.

---

## Phase 5: User Story 4 - Színkódolt státuszjelzés (Priority: P2)

- [ ] T023 [P] [US4] `ComplaintList.tsx`: `complaintStatusColor()` +
      `complaintStatusLabel()` (szürke=feljelentés, kék=nyomozás, narancs=vádemelés,
      piros=ítélet, tompított/áthúzott szürke=elutasítva) — a `VerdictList.tsx`
      `verdictTypeColor()`/`StatusBadge` mintája, önálló implementációként
- [ ] T024 [P] [US4] Playwright/axe: `/birosagi-iteletek` accessibility-smoke a
      meglévő suite-hoz igazítva (kontraszt a szürke/kék/narancs/piros badge-eken)

**Checkpoint**: minden státusz vizuálisan megkülönböztethető, WCAG-AA kontraszttal.

---

## Phase 6: Regisztráció és élesítés

- [ ] T025 `app/packages/db/src/detect-criminal-complaints-now.ts` (új): egyszeri
      bypass-script a `detect-now.ts` mintájára, kvóta-kiesés esetére; `package.json`
      script: `"detect-criminal-complaints-now": "tsx src/detect-criminal-complaints-now.ts"`
- [ ] T026 `npx drizzle-kit check` + `supabase db diff` staging ellen — 0042
      migráció drift-mentes
- [ ] T027 Manuális teszt éles adaton: a spec Input szakaszában azonosított 6 valódi
      eset (Miniszterelnökség/kormány/TI feljelentései, 2026-07-09…16) helyesen
      bekerül; a Semjén "Zsolti bácsi" és Havasi–Magyar Péter esetek NEM kerülnek be
- [ ] T028 `npx tsc --noEmit` + `pnpm lint` + `pnpm test` tisztán fusson a teljes
      monorepóban

---

## Dependencies & Execution Order

- **Phase 1 (Foundational)** blokkolja az összes user story-t — séma, típusok,
  pure logika nélkül semmi nem indulhat.
- **US1 (Phase 2)** az MVP — önmagában demózható (insert-only, update-ág nélkül
  is látszik az új blokk).
- **US2 (Phase 3)** US1-re épül (ugyanaz a detektor-fájl bővül) — nem
  párhuzamosítható vele, de attól függetlenül tesztelhető (T013).
- **US3 (Phase 4)** US1+US2 lezárt állapotára épül (T012 megosztott helperét
  hívja) — enélkül a Telegram-reprocess és a cron két külön logikát futtatna.
- **US4 (Phase 5)** bármikor párhuzamosítható US2/US3-mal — csak UI, nincs
  backend-függősége T009-en túl.
- **Phase 6** az összes user story lezárása után.

## Implementation Strategy

MVP-first: Phase 1 → Phase 2 (US1) → **STOP, validálj**: egy teszt-cikk
tényleg megjelenik-e az oldalon → Phase 3 (US2, a funkció lényegi része) →
**STOP, validálj**: a duplikáció tényleg nem történik meg → Phase 4 (US3,
Telegram) → Phase 5 (US4, polish) → Phase 6 (élesítés).
