# Tasks: NVVH-szavazás — Az első 5 ügy

**Input**: Design documents from `/specs/011-nvvh-case-poll/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/poll-api.md, quickstart.md

**Tests**: A projekt CI-kapuja (`pnpm test`, Playwright+axe) megköveteli a teszteket, ezért minden user story tartalmaz teszt-feladatokat.

**Organization**: A feladatok a spec.md 4 user story-ja szerint vannak csoportosítva (US1-US4, prioritási sorrendben).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: párhuzamosítható (különböző fájl, nincs függősége befejezetlen feladattól)
- **[Story]**: melyik user story-hoz tartozik (US1-US4)

## Path Conventions

Meglévő monorepo bővítése — a `plan.md` Project Structure szekciója szerint, `app/` gyökérrel.

---

## Phase 1: Setup

**Purpose**: A séma és az alapinfrastruktúra előkészítése, amire minden user story épül.

- [X] T001 [P] Drizzle tábladefiníciók hozzáadása: `pollQuestions`, `pollOptions`, `pollVotes`, `pollVoteSelections` (+ `pollQuestionStatusEnum`) `app/packages/db/src/schema.ts`-ben, a `data-model.md` szerint (oszlopok, FK-k, `check` constraint `minSelect <= maxSelect`-re)
- [X] T002 Migráció generálása és kézi finomítása additív SQL-ként: `app/supabase/migrations/0055_nvvh_case_poll.sql` (4 tábla + a `data-model.md`-ben felsorolt indexek + a `sourceUrl NOT NULL/nem üres` constraint)
- [X] T003 [P] `.env.example` bővítése: `POLL_VOTE_IP_DAILY_LIMIT=75` — nincs más új env var, a Turnstile/Upstash kulcsok már léteznek

**Checkpoint**: séma és migráció kész, `drizzle-kit check` és `supabase db diff` tiszta.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Minden user story ezekre épül — a séma most már létezik, de kell hozzá adatelérés, rate-limiter és a kezdeti tartalom.

**⚠️ CRITICAL**: Egyik user story sem indulhat, amíg ez a fázis nincs kész.

- [X] T004 **2026-08-31: lefuttatva ÉLESBEN** — Docker/lokál Supabase nem elérhető ebben a sandboxban, ezért a `0055_nvvh_case_poll.sql`-t a Supabase Dashboard SQL Editorján keresztül (böngésző-automatizálással, a user saját bejelentkezésével) futtattuk le közvetlenül a prod adatbázison. Mind a 4 tábla létrejött, ellenőrizve `information_schema.tables`-ből.
- [X] T005 [P] `pollVoteIpLimiter` hozzáadva `app/packages/shared/src/ratelimit.ts`-hez, a meglévő `getOrCreate` mintával, `POLL_VOTE_IP_DAILY_LIMIT` env-alapú küszöbbel (alapérték 75, 1 napos ablak)
- [X] T006 [P] `fmtFtOrUnknown()` segédfüggvény `app/packages/shared/src/format.ts`-ben — `amountLabel` elsőbbséggel, `amountHuf === null` esetén szó szerint "Nincs konkrét összeg"-et ad vissza, egyébként a meglévő `fmtFt`-t hívja (FR-003)
- [X] T007 Megosztott lekérdezés-segédfüggvények `app/apps/web/src/lib/poll-queries.ts`-ben (**útvonal-eltérés a plan.md-hez képest**: a `getDb()`-t használó lekérdezések a repóban máshol is a web app `src/lib/`-jében élnek, nem a `@korr/db` package-ben — a `featured-persons.ts` mintáját követi) — `getPollWithResults(db, slug)`, `getOwnSelections`, `insertVote`, `voteExists`
- [X] T008 Idempotens seed script `app/packages/db/src/seed-nvvh-poll.ts` — a végleges, 30 tételes kutatási lista betöltve `onConflictDoNothing` a `(pollQuestionId, title)` egyedi kulcson (ehhez új unique index is került a sémába/migrációba)

**Checkpoint**: az adatréteg és a rate-limiter kész, a 30 opció betölthető — a user story-k párhuzamosan indulhatnak.

---

## Phase 3: User Story 1 - Szavazat leadása (Priority: P1) 🎯 MVP

**Goal**: A látogató megnyitja a szavazóoldalt, kiválaszt 1-5 opciót, és megerősítéssel leadja a szavazatát.

**Independent Test**: Friss böngészőből (nincs "már szavaztál" cookie) megnyitva az oldalt, 1-5 opció kiválasztható és menthető, a mentés után sikeres visszajelzés érkezik.

### Tests for User Story 1

- [X] T009 [P] [US1] Unit teszt a szavazat-validációra (0 opció elutasítva, 6 opció elutasítva, ismeretlen opció-id elutasítva, kitöltött honeypot elutasítva, duplikátum elutasítva) `app/apps/web/tests/lib/poll-vote-validation.test.ts` — **9/9 zöld**
- [X] T010 [P] [US1] E2E happy-path teszt megírva `app/apps/web/tests/e2e/poll-vote-happy-path.spec.ts` — **nem futott le ebben a sandboxban** (Playwright éles böngészőt + `pnpm dev` szervert igényel, itt nincs egyik sem elérhető); a `submission-happy-path.spec.ts` türelmes skip-mintáját követi

### Implementation for User Story 1

- [X] T011 [US1] `POST /api/poll/vote` route handler `app/apps/web/app/api/poll/vote/route.ts` — a `contracts/poll-api.md`-ben rögzített validációs sorrend, a `submissions/route.ts` mintáját követve
- [X] T012 [P] [US1] `PollQuestion` komponens `app/apps/web/app/szavazas/_components/poll-question.tsx`
- [X] T013 [P] [US1] `OptionCard` komponens `app/apps/web/app/szavazas/_components/option-card.tsx`
- [X] T014 [US1] `VoteForm` kliens-komponens `app/apps/web/app/szavazas/_components/vote-form.tsx` — **plusz egy valódi, működő Cloudflare Turnstile widget** (lásd megjegyzés lent, a T031-nél)
- [X] T015 [US1] `GET /api/poll` route handler `app/apps/web/app/api/poll/route.ts`
- [X] T016 [US1] `app/apps/web/app/szavazas/page.tsx` + `_components/vote-form-client.tsx` (nézet-váltó váz — a T021 majd a placeholder "már szavaztál" szöveget cseréli valódi `ResultBars`-ra)
- [X] T017 [US1] Mobil-first reszponzív CSS `app/globals.css`-hez hozzáadva (a repó meglévő token-rendszerét használva, `@media (max-width: 640px)` a szűk kijelzőkhöz)

**Checkpoint**: az 1. user story önállóan működik és tesztelhető — ez a leszállítható MVP.

---

## Phase 4: User Story 2 - Eredmények megtekintése (Priority: P2)

**Goal**: Bárki (szavazott vagy sem) megnézheti a vízszintes csíkos eredmény-nézetet, ahol a csík hossza az arányt mutatja.

**Independent Test**: Meglévő szavazatok mellett az eredmény-nézet minden opció csíkját a saját arányával, csökkenő sorrendben mutatja; szavazat nélkül is hibamentes, értelmes üres állapotot ad.

### Tests for User Story 2

- [X] T018 [P] [US2] Unit teszt az arány-számításra `app/apps/web/tests/lib/poll-results.test.ts` — **5/5 zöld**
- [X] T019 [P] [US2] E2E teszt megírva `app/apps/web/tests/e2e/poll-results-view.spec.ts` (nem futott, ld. T010-nél írt sandbox-korlát)

### Implementation for User Story 2

- [X] T020 [P] [US2] `ResultBars` komponens `app/apps/web/app/szavazas/_components/result-bars.tsx` (üres állapot is benne — T023 ezzel egyszerre elkészült)
- [X] T021 [US2] Nézet-váltó logika `vote-form-client.tsx`-ben — tab ("Szavazás"/"Eredmények"), a placeholder helyett most valódi `ResultBars`
- [X] T022 [US2] Saját kiválasztás kiemelése — `poll-queries.getOwnSelections()` a `page.tsx`-ben olvassa ki a cookie-ból, `results-section.tsx` frissíti élőben `GET /api/poll`-ból
- [X] T023 [US2] Üres állapot — lásd T020

**Checkpoint**: US1 + US2 együtt is önállóan működik.

---

## Phase 5: User Story 3 - Felfedezés és megosztás (Priority: P3)

**Goal**: Főoldali kártya vezet a szavazóoldalra; a szavazóoldal saját, megosztható URL-lel és egyedi előnézeti képpel rendelkezik.

**Independent Test**: A főoldali kártyára kattintva a `/szavazas` oldalra jut a látogató; a `/szavazas` URL-t egy közösségimédia-előnézet-tesztelővel ellenőrizve egyedi cím és kép jelenik meg.

### Tests for User Story 3

- [X] T024 [P] [US3] E2E teszt megírva `app/apps/web/tests/e2e/poll-homepage-card.spec.ts` (nem futott, ld. sandbox-korlát)

### Implementation for User Story 3

- [X] T025 [P] [US3] Főoldali kiemelt kártya `app/apps/web/app/_home/poll-card.tsx` — **útvonal-döntés**: önálló async server component, szándékosan NEM a `page.tsx` nagy `Promise.all`-jába ágyazva (a kódban lévő megjegyzés szerint az már törékeny — nem kockáztattam)
- [X] T026 [US3] Beillesztve `app/apps/web/app/page.tsx`-be, a "Megszűnt-e" teaser elé — piros kártya, saját CSS
- [X] T027 [P] [US3] OG-kép `app/apps/web/app/szavazas/opengraph-image.tsx`, a meglévő `lemondasok/[id]/opengraph-image.tsx` mintáját követve
- [X] T028 [US3] `/szavazas` metaadatai — már a T016-ban elkészült

**Checkpoint**: US1-US3 együtt is önállóan működik.

---

## Phase 6: User Story 4 - Egy ember, egy szavazat, bot nélkül (Priority: P4)

**Goal**: Ismételt szavazás és tömeges automatizált beküldés kizárása, anélkül hogy megosztott hálózatról érkező valódi látogatókat blokkolna.

**Independent Test**: Ugyanabból a böngészőből másodszor megnyitva az oldalt, eredmény-nézet jön szavazóform helyett; egy szimulált 10 000 kérésnyi automatizált roham 0 rögzült szavazatot eredményez.

### Tests for User Story 4

- [X] T029 [P] [US4] `app/apps/web/tests/api/poll-vote-abuse-guard.test.ts` — a **valódi route-kódot** hívja meg mockolt cookie/rate-limit/Turnstile-rétegekkel (nem újraírt logika) — **5/5 zöld**: ismételt-cookie → 409, IP-küszöb → 429, Turnstile-hiba → 403, honeypot → 400 (DB-hívás nélkül), érvényes szavazat → 201
- [X] T030 [P] [US4] `k6` roham-szkript megírva `app/scripts/poll-vote-burst.js` — nem futott le (nincs `k6` binary ebben a sandboxban)

### Implementation for User Story 4

- [X] T031 [US4] A védelmi réteg sorrendje már a T011-ben a `contracts/poll-api.md` szerint készült el, most a T029 teszttel meg is erősítve
- [X] T032 [US4] `POLL_VOTE_IP_DAILY_LIMIT` dokumentálva a T003-ban (alapérték 75, env-ből felülírható)
- [~] T033 [US4] **BLOKKOLVA**: a T030 roham-szkript futtatásához `k6` és egy élő szerver kell, egyik sincs ebben a sandboxban. A T029 vitest-teszt már funkcionálisan bizonyítja, hogy a védelem helyesen dönt minden esetben — a k6-os terheléses teszt ehhez képest azt tenné hozzá, hogy nagy párhuzamos terhelés alatt sem szivárog át semmi. Ezt neked kell lefuttatnod (lokálban `pnpm dev` + `k6 run app/scripts/poll-vote-burst.js`).

**Checkpoint**: mind a 4 user story önállóan és együtt is működik.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T034 [P] `app/apps/web/tests/e2e/a11y-poll.spec.ts` — megírva (nem futott, sandbox-korlát)
- [X] T035 [P] Ellenőrizve: `next.config.js` `headers()` `/:path*`-ra fut, tehát automatikusan lefedi az összes új route-ot — **nem kellett módosítani**. A CSP-ben a Turnstile-hoz szükséges `challenges.cloudflare.com` már benne volt (a `/bejelentes` miatt) — a valódi widgetem ezt a meglévő engedélyt használja, nincs CSP-változtatás.
- [X] T036 **2026-08-31: elvégezve élesben** — helyi szerver a PROD adatbázisra kötve + böngésző-automatizálás. Végigmentünk: szavazat leadása (3 opció) → sikeres visszajelzés → "már szavaztál" állapot új betöltésnél → eredmény-nézet helyes csíkokkal és "a te választásod" kiemeléssel → főoldali kártya élő számlálóval → OG-kép renderelése. **Ez során derült ki és lett javítva egy valódi hiba (lásd Megjegyzések)**. Az egyetlen el nem végzett rész a k6-os terheléses roham (T033-nál blokkolva, k6 hiánya miatt).
- [X] T037 Constitution-check jegyzet — lásd a `plan.md` Constitution Check táblázatát, ami pontosan ezt tartalmazza (minden érintett elv + indoklás), ez másolható a PR leírásába

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: nincs függősége, azonnal indulhat
- **Foundational (Phase 2)**: a Setup-tól függ — BLOKKOLJA az összes user story-t
- **User Stories (Phase 3-6)**: mind a Foundational fázistól függenek, utána egymástól függetlenül, párhuzamosan haladhatnak
- **Polish (Phase 7)**: az összes leszállítani kívánt user story-tól függ

### User Story Dependencies

- **US1 (P1)**: a Foundational után indulhat, más story-tól nem függ
- **US2 (P2)**: a Foundational után indulhat; a `page.tsx` nézet-váltó logikája (T021) a T016-ra (US1) épül, de az eredmény-adat maga (a `GET /api/poll` szavazatszámai) már a T015-ből (US1) elérhető
- **US3 (P3)**: a Foundational után indulhat; a `/szavazas` oldal létezését (T016, US1) feltételezi, de a főoldali kártya (T025) önmagában is tesztelhető
- **US4 (P4)**: a Foundational után indulhat; a T011 (US1) végpontját keményíti tovább, nem attól függetlenül készül

### Within Each User Story

- Tesztek előbb, mint az implementáció, és bukjanak, mielőtt a implementáció elkészül
- Adatelérés/komponensek a form/nézet-összeállítás előtt
- A story akkor tekinthető késznek, ha az Independent Test teljesül

### Parallel Opportunities

- T001, T003 párhuzamosan (Setup)
- T005, T006 párhuzamosan (Foundational, T004 után)
- T009, T010 párhuzamosan (US1 tesztek)
- T012, T013 párhuzamosan (US1 komponensek)
- T018, T019 párhuzamosan (US2 tesztek)
- T024 önállóan futtatható, amint T016 (US1) kész
- T029, T030 párhuzamosan (US4 tesztek)
- T034, T035 párhuzamosan (Polish)

---

## Parallel Example: User Story 1

```bash
# Tesztek egyszerre:
Task: "Unit teszt a szavazat-validációra app/apps/web/tests/unit/poll-vote-validation.test.ts"
Task: "E2E happy-path teszt app/apps/web/tests/e2e/poll-vote-happy-path.spec.ts"

# Komponensek egyszerre:
Task: "PollQuestion komponens app/apps/web/app/szavazas/_components/poll-question.tsx"
Task: "OptionCard komponens app/apps/web/app/szavazas/_components/option-card.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup
2. Phase 2: Foundational (KRITIKUS — blokkol mindent)
3. Phase 3: User Story 1
4. **STOP és VALIDÁLJ**: US1 önálló tesztelése a quickstart.md 1-2. lépése szerint
5. Ekkor már bemutatható/élesíthető egy alap szavazás-élmény (eredmény és megosztás nélkül)

### Incremental Delivery

1. Setup + Foundational → alap kész
2. US1 hozzáadása → önálló teszt → **MVP demózható**
3. US2 hozzáadása → önálló teszt → eredmény-nézet is él
4. US3 hozzáadása → önálló teszt → megosztható, virálisan terjeszthető
5. US4 hozzáadása → önálló teszt (roham-szkript) → **csak ez után menjen élesbe ténylegesen nyilvánosan**, mivel enélkül a szavazás manipulálható

**Fontos**: bár a user story-k sorrendje P1→P4, a **P4 (bot-védelem) nélkül a szavazást nem szabad nyilvánosan meghirdetni** — a négy story együtt adja ki a spec.md-ben vállalt terméket.

---

## Notes

- [P] feladat = különböző fájl, nincs függősége
- Minden feladat egy konkrét fájlútvonalat érint
- A tesztek a megfelelő implementáció előtt készülnek, és el kell bukniuk implementáció nélkül
- Commit minden feladat vagy logikai csoport után
- A 17 tételes repricing-kör (korábban megbeszélt, külön engedélyt igénylő API-hívásos feladat) **nem tartozik ide** — az a T008 seed-scriptet megelőző, tartalom-előkészítési lépés, a jelen tasks.md a kódra fókuszál
- **2026-08-31 élő teszt közben talált és javított hiba**: a `GET /api/poll` 500-as hibát dobott minden hívásnál, mert a natív `JSON.stringify` nem tud `bigint`-et szerializálni (`amountHuf` mező). Ez azt jelentette volna, hogy az eredmény-nézet SOHA nem működött volna élesben — csak azért derült ki, mert ténylegesen leadtunk egy próbaszavazatot a PROD adatbázison, helyi szerverrel és böngésző-automatizálással. Javítva (`route.ts`-ben stringgé alakítás JSON-válasz előtt) + regressziós teszt hozzáadva (`poll-results-serialization.test.ts`). Ez önmagában indokolja, hogy a "csak típusellenőrzés + unit teszt zöld" sosem helyettesíti a tényleges kipróbálást.
