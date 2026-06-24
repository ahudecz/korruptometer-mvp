# Tasks: Make.com Facebook → SocialPost automatizáció

**Input**: Design documents from `/specs/002-make-facebook-social-feed/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Feladatok user story szerint csoportosítva — minden story önállóan tesztelhető és deployolható.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Párhuzamosan futtatható (különböző fájlok, nincs kölcsönös függőség)
- **[Story]**: Melyik user story-hoz tartozik (US1, US2, US3)

---

## Phase 1: Setup (Infrastruktúra előkészítése)

**Cél**: DB migráció + Drizzle séma frissítése — ezt kell először elvégezni, mert minden story erre épül.

- [ ] T001 Ellenőrizni, hogy a meglévő SocialPost sorok között van-e `postUrl` duplikátum (Supabase Studio → Table Editor → SocialPost → SQL: `SELECT "postUrl", COUNT(*) FROM "SocialPost" GROUP BY "postUrl" HAVING COUNT(*) > 1`)
- [ ] T002 Létrehozni `app/supabase/migrations/0016_social_post_hidden.sql` fájlt: `ADD COLUMN hidden boolean NOT NULL DEFAULT false` + `ADD CONSTRAINT SocialPost_postUrl_unique UNIQUE ("postUrl")`
- [ ] T003 [P] Frissíteni `app/packages/db/src/schema.ts` socialPosts táblát: `hidden: boolean('hidden').notNull().default(false)` + `imageUrl: text('imageUrl')` + `.unique()` a postUrl-re
- [ ] T004 Lefuttatni a migrációt a Supabase-en (Supabase Studio SQL Editor-ban, vagy `supabase db push`)

**Checkpoint**: A SocialPost tábla tartalmaz `hidden` oszlopot (DEFAULT false), `postUrl` UNIQUE constraintet, és a Drizzle séma naprakész.

---

## Phase 2: Foundational (Meglévő social feed szűrés)

**Cél**: A weboldal social feedje csak `hidden = false` posztokat mutasson — ez a talajon kell legyen mielőtt a Make.com posztokat küld.

**⚠️ KRITIKUS**: Ez kell az US1 és US3 előtt is.

- [ ] T005 Frissíteni `app/apps/web/app/_home/social-feed.tsx` szerveroldali lekérdezést: `.eq('hidden', false)` filter hozzáadása a `.from('SocialPost').select('*')` után
- [ ] T006 Frissíteni `app/apps/web/app/_home/social-feed-client.tsx` `loadMore` függvényét: `.eq('hidden', false)` filter hozzáadása a Supabase lekérdezésbe

**Checkpoint**: A weboldal social feed szekciójában csak a nem-rejtett posztok jelennek meg. Tesztelés: Supabase Studioba manuálisan beállítani egy poszt `hidden = true` → refresh → eltűnik az oldalról.

---

## Phase 3: User Story 1 — Facebook poszt automatikusan megjelenik (Priority: P1) 🎯 MVP

**Cél**: Egy figyelt FB oldal új posztja 15 percen belül megjelenik a weboldalon.

**Independent Test**: Közzétenni egy tesztposztot a figyelt FB oldalon → 15 percen belül megjelenik a Korruptométer social feed-ben, és a kártyára kattintva az eredeti FB posztra jut a felhasználó.

- [ ] T007 [US1] Make.com account-on új scenario létrehozása: trigger = `Facebook Pages → Watch Posts` (oldal ID beírása), action = `HTTP → Make a Request` a Supabase REST API-ra (lásd `contracts/make-to-supabase.md` és `quickstart.md` 2. lépés)
- [ ] T008 [US1] A Make.com HTTP modulban beállítani a request body-t: `authorName`, `platform: "facebook"`, `postUrl: {{1.permalink_url}}`, `content: {{ifempty(1.message; "[kép/link]")}}`, `imageUrl: {{1.full_picture}}`, `postedAt: {{1.created_time}}`
- [ ] T009 [US1] Make.com `Prefer` header beállítása: `resolution=ignore-duplicates,return=minimal` (duplikátum védelem)
- [ ] T010 [US1] Make.com scenario scheduling: **Every 15 minutes** → Save → Run once (tesztfutás — ellenőrizni, hogy bekerül-e egy poszt a SocialPost táblába)
- [ ] T011 [US1] Ellenőrizni a tesztfutás eredményét: Supabase Studio → SocialPost tábla → új sor megjelent-e helyes adatokkal

**Checkpoint**: Manuális Make.com futtatás után új SocialPost sor keletkezik a DB-ben. A weboldal social feed szekciójában megjelenik az új poszt.

---

## Phase 4: User Story 2 — Több Facebook oldal figyelése (Priority: P2)

**Cél**: Minden figyelt FB oldal posztja bekerül a rendszerbe az oldal nevével együtt.

**Independent Test**: Egy második FB oldalt hozzáadni a Make.com scenarióhoz → az annak posztjai is megjelennek a weboldalon a helyes `authorName`-mel.

- [ ] T012 [P] [US2] Make.com scenario-ban a `Watch Posts` trigger jobb klikk → **Clone route** → új route létrehozása a második FB oldalhoz (Page ID + `authorName` átírása)
- [ ] T013 [US2] Megismételni T012-t minden további figyelt FB oldalhoz (Vastagbőr, Juhász Péter, stb.)
- [ ] T014 [US2] Tesztfutás: ellenőrizni, hogy minden figyelt oldalhoz keletkeznek-e SocialPost sorok a helyes `authorName`-mel

**Checkpoint**: Több különböző `authorName` értékkel rendelkező SocialPost sor van a DB-ben. A weboldal social feed-ben az egyes kártyákon helyes az oldal neve.

---

## Phase 5: User Story 3 — Admin el tud rejteni posztokat (Priority: P3)

**Cél**: Az admin felületen egy-egy poszt elrejthető vagy visszaállítható.

**Independent Test**: `/admin/social-posts` oldalon egy poszt `Elrejtés` gombjára kattintani → weboldal frissítés → poszt eltűnik. Visszaállítás gombra kattintani → megjelenik.

- [ ] T015 [US3] Létrehozni `app/apps/web/app/api/admin/social-posts/[id]/hidden/route.ts` fájlt: `POST` handler — `requireAdmin()`, toggle `hidden` értékét, visszaadja `{ hidden: boolean }` (minta: `app/apps/web/app/api/admin/news/[id]/featured/route.ts`)
- [ ] T016 [US3] Létrehozni `app/apps/web/app/admin/(authed)/social-posts/hidden-toggle.tsx` kliens komponenst: `HiddenToggle` — `POST /api/admin/social-posts/${id}/hidden` → `router.refresh()` (minta: `app/apps/web/app/admin/(authed)/news/featured-toggle.tsx`)
- [ ] T017 [US3] Létrehozni `app/apps/web/app/admin/(authed)/social-posts/page.tsx` admin oldalt: lista legutóbbi 100 SocialPost-ból `createdAt DESC` sorrendben, minden sornál `HiddenToggle` komponens, rejtett sorok szürke háttérrel
- [ ] T018 [US3] Frissíteni `app/apps/web/app/admin/(authed)/admin-tabs.tsx` fájlt: `{ href: '/admin/social-posts', label: 'Social posztok' }` tab hozzáadása a TABS tömbhöz

**Checkpoint**: Az `/admin/social-posts` oldalon láthatók a posztok és működik a toggle. Elrejtett poszt nem jelenik meg a weboldalon.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T019 [P] Lefuttatni `quickstart.md` 4. lépés tesztelési checklist-jét végig (automatikus poszt, megjelenés, elrejtés, duplikátum teszt)
- [ ] T020 Ellenőrizni, hogy a `imageUrl` null esetén (szöveges poszt) nem törik-e el a social-post-card kártya megjelenítése
- [ ] T021 [P] Ellenőrizni TypeScript típusokat: `SocialPost` type a `schema.ts`-ből exportált — `hidden` és `imageUrl` mezők helyesen szerepelnek-e

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Nincs függőség — azonnal elkezdhető
- **Phase 2 (Foundational)**: Depends on Phase 1 (migráció kell a `hidden` szűréshez) — **BLOKKOL minden story-t**
- **Phase 3 (US1)**: Depends on Phase 1 + 2 — Make.com + weboldal szűrés kell
- **Phase 4 (US2)**: Depends on Phase 3 (US1 Make.com scenario kell, hogy klónozni lehessen)
- **Phase 5 (US3)**: Depends on Phase 1 + 2 — a DB `hidden` mezőre épül; US1-től független
- **Phase 6 (Polish)**: Depends on all stories complete

### User Story Dependencies

- **US1 (P1)**: Phase 1+2 után kezdhető — nincs más story-tól függősége
- **US2 (P2)**: US1 után — a Make.com scenarióból clone-ozza a route-ot
- **US3 (P3)**: Phase 1+2 után kezdhető — párhuzamosan futtatható US1-gyel

### Parallel Opportunities

- T003 (Drizzle séma) párhuzamosan futtatható T002-vel (SQL fájl létrehozása)
- T005 és T006 (social feed szűrések) párhuzamosan futtathatók
- T015, T016, T017, T018 (US3 admin komponensek) párhuzamosan írhatók egymással

---

## Parallel Example: US3 (Admin hidden toggle)

```
Párhuzamosan indítható:
  Task T015: API route létrehozása (route.ts)
  Task T016: HiddenToggle komponens (hidden-toggle.tsx)

Ezek után:
  Task T017: Admin oldal (page.tsx) — T016-ra vár
  Task T018: Admin tabs update (admin-tabs.tsx) — független
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1: DB migráció + Drizzle séma (T001–T004)
2. Phase 2: Social feed szűrés (T005–T006)
3. Phase 3: Make.com scenario beállítása (T007–T011)
4. **STOP és VALIDÁLÁS**: Tesztelni US1-et — megjelenik-e FB poszt a weboldalon?
5. Deploy ha kész

### Incremental Delivery

1. Setup + Foundational → DB készen, szűrés müxödik
2. US1 → Make.com scenario → FB posztok automatikusan jönnek (MVP!)
3. US2 → Több FB oldal → gazdagabb tartalom
4. US3 → Admin toggle → moderálás lehetséges

---

## Notes

- T007–T011 (Make.com setup) nem kódfejlesztés — Make.com webes felületén végzett konfiguráció
- A Make.com Service Role key-t sosem kell commitolni — csak Make.com-on tárolni
- US3 `requireAdmin()` middleware az existing auth pattern — nincs extra auth fejlesztés
- A `hidden-toggle.tsx` és `page.tsx` mintafájlok: `featured-toggle.tsx` és `admin/news/page.tsx`
