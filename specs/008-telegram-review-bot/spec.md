# Feature Specification: Telegram jóváhagyó bot a detekciós review-hoz

**Feature Branch**: `008-telegram-review-bot`
**Created**: 2026-07-12
**Status**: Draft
**Input**: User description: "A 006-detection-pipeline-reliability-ben elkészült notifyReviewNeeded() eddig csak log-only stub volt — most bekötöttük egy valódi Telegram bothoz (@kegyencjarat_bot). A user szeretné, hogy a Telegram-üzenetben tudjon a forráscikkre kattintani, majd egy 'Jóváhagyom'/'Elutasítom' gombbal ténylegesen végrehajtsa a döntést az adatbázisban — ne csak jelzés legyen. Jóváhagyáskor a rendszer nézze át, hogy a cikk a 4 detektor-kategória közül (lemondás, médium-megszűnés, bírósági ítélet, vagyonvisszaszerzés) érint-e MÁST is, mint amelyikben eredetileg landolt, és ha igen, automatikusan vegye is fel."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Szerkesztő a cikk elolvasása után dönt, telefonról (Priority: P1)

Amikor egy detektor bizonytalan találatot jelez (pending vagy near_miss), a
szerkesztő egy Telegram-üzenetet kap, amiben rákattinthat a forráscikkre,
elolvashatja, majd egy gombbal jóváhagyhatja vagy elutasíthatja — anélkül,
hogy be kellene lépnie az admin felületre.

**Why this priority**: Ez a funkció egyetlen célja — enélkül a Telegram-
üzenet csak egy értesítés, amit úgyis az admin felületen kellene intézni,
nem old meg semmit a jelenlegi állapothoz képest.

**Independent Test**: Egy mesterségesen 0.72 megbízhatóságú (pending) találat
Telegram-üzenetén a "Jóváhagyom" gombra kattintva a megfelelő adatbázis-sor
`reviewStatus` mezője `approved`-ra vált, és az érintett publikus oldal
(pl. `/lemondasok`) azonnal mutatja.

**Acceptance Scenarios**:

1. **Given** egy `pending` állapotú lemondás-találat, **When** a szerkesztő
   megnyomja a "Jóváhagyom" gombot, **Then** a `PoliticalResignation` sor
   `reviewStatus='approved'`-ra vált, a Telegram-üzenet gombjai eltűnnek, és
   a szöveg "✅ Jóváhagyva" jelzést kap.
2. **Given** egy `pending` állapotú találat, **When** a szerkesztő
   megnyomja az "Elutasítom" gombot, **Then** a sor `reviewStatus='rejected'`-
   re vált, és nem jelenik meg egyetlen publikus oldalon sem.
3. **Given** egy `near_miss` (soha be nem szúrt) találat, **When** a
   szerkesztő megnyomja a "Jóváhagyom" gombot, **Then** a rendszer újra
   lefuttatja a kinyerést, és — ha az adatok teljesek — beszúr egy új,
   `approved` állapotú sort a megfelelő táblába.
4. **Given** bármelyik gomb, **When** a szerkesztő rákattint a "📄 Cikk
   megnyitása" gombra, **Then** a forráscikk megnyílik a böngészőben, a
   döntés-gombok nem tűnnek el emiatt.

---

### User Story 2 - Jóváhagyáskor a rendszer felismeri, ha a cikk más kategóriát is érint (Priority: P2)

Egy cikk gyakran több témát is felvet egyszerre (pl. egy lemondás ÉS egy
vagyonvisszaszerzés ugyanabban a hírben). Amikor a szerkesztő jóváhagy egy
találatot, a rendszer megnézi, hogy a cikk a másik 3 kategória szerint is
releváns-e — és ha igen, automatikusan felveszi azt is, saját üzenettel
jelezve.

**Why this priority**: Enélkül a rendszer csak azt a kategóriát rögzíti,
amelyikben a cikk véletlenül elsőként landolt — egy valódi, több szálon is
korrupciógyanús eset egyik fele némán kimaradhat.

**Independent Test**: Egy olyan teszt-cikk jóváhagyása, aminek szövege
egyszerre utal lemondásra ÉS vagyonvisszaszerzésre, a lemondás jóváhagyása
után automatikusan létrehoz (vagy pending-be tesz) egy vagyonvisszaszerzés-
sort is, és erről külön Telegram-üzenet érkezik.

**Acceptance Scenarios**:

1. **Given** egy jóváhagyott lemondás-találat cikke, **When** a cikk
   tartalma a vagyonvisszaszerzés-detektor 0.77-es auto-publikálási
   küszöbét is átlépné, **Then** a rendszer automatikusan beszúr egy
   `AssetRecovery` sort, és egy ÚJ Telegram-üzenetben jelzi.
2. **Given** ugyanez, **When** a cikk a másik kategóriában csak 0.70–0.77
   közötti (pending) megbízhatóságot adna, **Then** a rendszer NEM szúr be
   automatikusan, hanem egy új, gombos Telegram-üzenetet küld — a
   kereszt-kategória automatizmus nem lépi túl a meglévő küszöb-logikát.
3. **Given** egy cikk, aminek a másik 3 kategóriájára MÁR van
   `DetectionCheck` sora (a rendes órás cron már megvizsgálta), **When** a
   szerkesztő jóváhagy egy találatot erről a cikkről, **Then** a rendszer
   NEM futtatja újra azt a már kiértékelt kategóriát.

---

### Edge Cases

- Ugyanarra a gombra kétszer/gyorsan egymás után kattintanak (dupla küldés,
  hálózati késés) → a beszúrás/UPDATE idempotens legyen (a meglévő
  duplikáció-szűrés és a `reviewStatus` UPDATE természetéből adódóan).
- A webhook-hívás nem valódi Telegram-szervertől érkezik (pl. valaki
  megtalálja az URL-t) → titkosított header-ellenőrzés nélkül a kérés
  elutasítandó, adatbázis-hatás nélkül.
- Egy `near_miss` jóváhagyásakor a cikkből időközben hiányoznak a kötelező
  mezők (pl. nincs `sourceUrl`) → a beszúrás elmarad, a szerkesztő hibaüzenetet
  kap Telegramon, nem keletkezik hibás/csonka sor.
- A kereszt-kategória újra-kinyerés maga is talál egy `near_miss`-t a másik
  kategóriában → ez egy új, normál gombos Telegram-üzenetként megy ki, nem
  automatikus beszúrás (csak a `>=0.77` esetek mennek automatikusan, US2
  AS2 szerint).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Minden `notifyReviewNeeded` Telegram-üzenetnek tartalmaznia
  KELL egy, a forráscikkre mutató, közvetlenül megnyitható gombot.
- **FR-002**: Minden `pending` vagy `near_miss` Telegram-üzenetnek
  tartalmaznia KELL egy "Jóváhagyom" és egy "Elutasítom" gombot.
- **FR-003**: A "Jóváhagyom" gomb `pending` találatnál a már beszúrt sor
  `reviewStatus` mezőjét `approved`-ra KELL állítsa, ugyanazzal a logikával,
  mint a meglévő admin jóváhagyó felület.
- **FR-004**: A "Jóváhagyom" gomb `near_miss` találatnál újra KELL futtassa
  az adott detektor kinyerő-logikáját a tárolt cikkadaton, és — ha az adatok
  teljesek és nem duplikátum — be KELL szúrjon egy `approved` állapotú
  (vagy `reviewStatus` nélküli, ha a detektor típusa nem ismeri ezt a
  mezőt) sort.
- **FR-005**: A "Jóváhagyom" gomb sikeres feldolgozása UTÁN a rendszernek
  meg KELL vizsgálnia a másik 3 detektor-kategóriát ugyanazon a cikken,
  DE csak azokat, amelyeknek MÉG NINCS `DetectionCheck` sora erre a cikkre.
- **FR-006**: A kereszt-kategória vizsgálatnak a meglévő, adott detektorra
  érvényes megbízhatósági küszöböket KELL alkalmaznia (nincs külön,
  enyhébb vagy szigorúbb szabály az automatikus úthoz).
- **FR-007**: Minden kereszt-kategória találatot (auto-beszúrt vagy
  pending/near_miss) a normál `notifyReviewNeeded` csatornán KELL jelezni,
  külön Telegram-üzenetben.
- **FR-008**: Az "Elutasítom" gomb `pending` találatnál a sort
  `reviewStatus='rejected'`-re KELL állítsa; `near_miss` esetén nem
  igényel adatbázis-írást (semmi nem lett beszúrva).
- **FR-009**: A webhook-végpontnak el KELL utasítania minden kérést, amely
  nem hordozza a Telegram által visszaküldött, előre beállított titkos
  fejlécet — adatbázis-hatás nélkül.
- **FR-010**: Egy gomb feldolgozása UTÁN a Telegram-üzenetnek vissza KELL
  jeleznie a felhasználónak a végeredményt (toast + a gombok eltávolítása/
  a szöveg frissítése), hogy elkerülje az ismételt kattintást.
- **FR-011**: A funkció NEM módosíthatja a meglévő 003/006-os
  megbízhatósági küszöb-logikát (`decideStatus`, `AUTO_PUBLISH_THRESHOLD`,
  `REVIEW_FLOOR`, `NEAR_MISS_MIN`) — kizárólag azt vezényli, MIKOR és MIT
  hív meg belőle, emberi jóváhagyás triggerére.

### Key Entities

- **Telegram callback-akció**: egy gombnyomás kódolt eseménye
  (`action`, `detectorType`, `id` — `recordId` vagy `articleId`), amit a
  webhook dekódol és végrehajt.
- **Kereszt-kategória vizsgálat**: jóváhagyás utáni, a másik 3 detektor
  saját kinyerő-logikáját újrafelhasználó ellenőrzés, ami a meglévő
  küszöbök szerint dönt (auto-beszúrás / pending-értesítés / eldobás).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A szerkesztő egyetlen Telegram-üzenetből (cikk elolvasása +
  gombnyomás) el tudja dönteni és véglegesíteni egy találat sorsát, admin
  felület megnyitása nélkül.
- **SC-002**: Egy két kategóriát is érintő cikk mindkét releváns
  kategóriában megjelenik az adatbázisban, kézi utómunka nélkül.
- **SC-003**: Egyetlen webhook-hívás sem hajt végre adatbázis-írást érvényes
  Telegram-titkosítási fejléc nélkül.
- **SC-004**: A meglévő 003/006-os küszöb-alapú útvonalazás minden
  kombinációnál (auto-publikál / pending / eldob) bit-for-bit változatlan
  marad — ezt a kereszt-kategória vizsgálat is ugyanazokkal a küszöbökkel
  hívja meg.

## Assumptions

- A csatorna egyelőre egyetlen privát Telegram chat (`TELEGRAM_CHAT_ID`) —
  csoport/több címzett későbbi, külön kör (elhalasztva a user kérésére).
- A webhook a meglévő Next.js app egy új API route-ja, nem külön szolgáltatás
  (Constitution III).
- Nincs új adatbázis-tábla/migráció — a meglévő `DetectionCheck` és a 3
  `reviewStatus`-os tábla + `NewsArticle` elegendő minden szükséges adathoz.
