# Feature Specification: Politikai indíttatású büntetőeljárások detektálása + breaking-lista élő összekötése

**Feature Branch**: `007-political-prosecution-detection`
**Created**: 2026-07-08
**Status**: Draft
**Input**: User description: "Szakács István (Megafon influenszer) letartóztatása terrorcselekmény előkészítésének gyanújával nem került be a /birosagi-iteletek oldalra, mert a detect-verdicts.ts LLM-promptja kizárólag korrupciós ügyekre van hangolva — egy politikai indíttatású, szólásszabadság-jellegű eljárás nem illeszkedik rá. A cikkben minden szükséges adat megvan (név, pozíció, ügy, státusz, forrás), a relevancia-szűrésnek először ki kell zárnia a nem-magyar/nem-releváns eseteket, utána viszont fel kell dolgoznia az ilyen eseteket is. Emellett a homepage-en és a /birosagi-iteletek oldalon lévő összesítő blokkoknak a legfrissebb ilyen esetet is fel kell venniük, max 6 szavas leírással. Külön probléma: a breaking piros csík egy kézzel karbantartott, a galéria/watchlist/ugyek configoktól elszakadt névlistán (BREAKING_MONITORED) múlik, ami rendszeresen hamis negatívot okoz — ezt élőben kell összekötni a valós configokkal."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Politikai indíttatású eljárás is bekerül a bírósági ítéletek közé (Priority: P1)

Amikor egy magyar cikk arról szól, hogy egy NER-közeli vagy a kormánnyal szemben kritikus közéleti szereplőt (nem feltétlenül politikust) letartóztatnak, előzetesbe helyeznek, vád alá vonnak vagy elítélnek — akkor is, ha az ügy nem klasszikus korrupció (hűtlen kezelés, vesztegetés), hanem politikai indíttatású eljárás (pl. szólásszabadság-korlátozás, „terrorcselekmény előkészítése" egy kritikus közösségimédia-posztért) —, a detektornak fel kell ismernie és a `/birosagi-iteletek` oldalra kell juttatnia, a meglévő megbízhatóság-alapú review-folyamaton (0.90/0.70 küszöbök) keresztül.

**Why this priority**: Ez a jelenség pontosan az az eset, ami miatt Szakács István letartóztatása kimaradt, miközben a cikkben minden szükséges adat megvolt. A detektor szűk hatóköre azt jelenti, hogy a rendszer szisztematikusan vak a NER-kritikusok elleni jogi fellépésekre — ez épp azzal ellentétes, amit az oldal (NER összeomlás / elszámoltatás tracker) dokumentálni akar.

**Independent Test**: Egy kulcsszó-egyező cikk, amelyben egy közéleti szereplőt (nem feltétlenül politikust) politikai indíttatású váddal (pl. közösségimédia-tartalom miatt) tartóztatnak le, a jelenlegi kulcsszó-előszűrésen átjutva az LLM-nél `isVerdict=true`-t kap, és a meglévő confidence-küszöbök szerint approved/pending állapotba kerül — nem dobódik el `not_applicable` okkal pusztán azért, mert nem korrupciós jellegű.

**Acceptance Scenarios**:

1. **Given** egy magyar cikk, amelyben egy NER-közeli vagy kormánykritikus közéleti szereplőt letartóztatnak/vád alá helyeznek/elítélnek politikai indíttatású (nem korrupciós) ügyben, **When** a cikk átmegy a relevancia-előszűrésen, **Then** az LLM `isVerdict=true`-t ad vissza, és a kinyert adatok (név, pozíció, ügy típusa, státusz, összegzés) helyesen töltődnek.
2. **Given** ugyanez a cikk, **When** a névhez tartozó cikkben a pozíció és az ügy egyértelműen szerepel (pl. „Megafon influenszere", „terrorcselekmény előkészítésének gyanúja"), **Then** a rendszer NEM kér további emberi beavatkozást a pozíció/ügy tisztázásához — a meglévő szöveg elég.
3. **Given** egy külföldi (nem magyar) politikai indíttatású eljárásról szóló cikk, **When** a relevancia-előszűrés lefut, **Then** a cikk nem jut el az LLM-verdict-extrakcióig (a meglévő „biztos kuka" URL/kulcsszó-szűrés érvényben marad).
4. **Given** egy cikk, amelyben a pozíció, az ügy vagy a személy kiléte KÉTSÉGES vagy több névvel is összetéveszthető, **When** az LLM konfidenciája emiatt alacsony, **Then** a meglévő 0.70–0.90 pending-sáv szerint kézi jóváhagyásra vár — a rendszer NEM publikál bizonytalan adatot automatikusan.

---

### User Story 2 - A legfrissebb bírósági/eljárási esemény megjelenik a nyitóoldali és a /birosagi-iteletek összesítőben (Priority: P2)

Egy újonnan jóváhagyott `CourtVerdict` bejegyzés a nyitóoldal grafikon melletti összefoglaló blokkjában és a `/birosagi-iteletek` oldal saját összesítőjében is megjelenik legfrissebbként, egy максимум 6 szavas leírással (pl. „Szakács István: letartóztatás, terrorcselekmény előkészítése").

**Why this priority**: Az 1. story önmagában csak azt garantálja, hogy az adat BEKERÜL a táblába — enélkül a story-nál láthatatlan marad a nyitóoldalon, ahol a legtöbb látogató először találkozik az oldal tartalmával.

**Independent Test**: Egy frissen approved CourtVerdict sor létrehozása után a nyitóoldal összefoglaló blokkja és a `/birosagi-iteletek` oldal saját összesítője is felveszi legfrissebbként, a leírás pedig legfeljebb 6 szóból áll.

**Acceptance Scenarios**:

1. **Given** egy újonnan approved CourtVerdict sor, **When** a nyitóoldal renderelődik, **Then** a grafikon melletti összefoglaló blokk legfrissebbként mutatja, max 6 szavas leírással.
2. **Given** ugyanez a sor, **When** a `/birosagi-iteletek` oldal renderelődik, **Then** az oldal saját összesítője (jelenleg nincs ilyen — lásd Assumptions) is felveszi.
3. **Given** egy 6 szónál hosszabb automatikusan generált leírás, **When** a rendszer megpróbálja elmenteni, **Then** DB-szintű CHECK constraint-tel (a meglévő `PoliticalResignation`/`MediaClosure` mintát követve, lásd `0034_description_word_limit.sql`) elutasítja — nem csak alkalmazásszinten validálunk.

---

### User Story 3 - A breaking piros csík élőben követi a valódi kiemelt személyeket/ügyeket (Priority: P3)

A `relevance.ts`-ben lévő `BREAKING_MONITORED` kézi névlista helyett a breaking-detekció közvetlenül a `GALERIA`, `WATCH_LIST` és `UGYEK` configokból származó nevekből/kulcsszavakból dolgozik, úgy hogy egy config-bővítés (új galéria-személy, új kiemelt ügy) automatikusan bekerül a breaking-figyelésbe is, kézi szinkronizálás nélkül.

**Why this priority**: Ez önmagában nem új felhasználói funkció, hanem egy meglévő, dokumentáltan hibára hajlamos mechanizmus (lásd `relevance.ts` kommentje: „ez a lista korábban elszakadt a valós GALERIA/WATCH_LIST/UGYEK tartalmától") javítása. Alacsonyabb prioritású, mert a jelenlegi állapot nem tör el semmit — csak hamis negatívokat okoz (egy valóban fontos esemény nem lesz breaking).

**Why not P1**: A `packages/scrapers` csomag jelenleg nem importálhatja közvetlenül az `apps/web/app/_home/*.ts` configokat (más build-egység) — ez megoldható build-time kódgenerálással vagy a listák JSON-ként való duplikálásával egy megosztott helyre, de ez egy külön, kockázatosabb refaktor, amit érdemes elkülönítve tesztelni.

**Independent Test**: A `GALERIA` confighoz egy új személyt adva (kódszinten), majd egy vele kapcsolatos, a `BREAKING_TRIGGERS`-nek megfelelő cikk beérkezésekor a cikk `isBreaking()` szerint helyesen breaking-nek minősül — anélkül, hogy a `relevance.ts` fájlt manuálisan is módosítani kellene.

**Acceptance Scenarios**:

1. **Given** egy új személy felvétele a `GALERIA` configba, **When** egy vele kapcsolatos, BREAKING_TRIGGERS-nek megfelelő cikk (pl. letartóztatás) érkezik, **Then** `isBreaking()` igazat ad vissza, kézi `relevance.ts`-szerkesztés nélkül.
2. **Given** a jelenlegi `BREAKING_MONITORED` lista tartalma, **When** az élő összekötés megtörténik, **Then** a lista legalább ugyanazokat a neveket/kulcsszavakat tartalmazza, mint korábban (nincs regresszió).

---

### Edge Cases

- Egy cikk, ahol a letartóztatott/vádolt személy pozíciója vagy az ügy jellege NEM derül ki egyértelműen a cikkből → a meglévő confidence-alapú pending-útvonal kezeli (nem publikálunk automatikusan bizonytalan adatot); a Kulcsentitások szakasz rögzíti, hogy ilyenkor a szerkesztőnek további forrásokat kell keresnie a kézi jóváhagyás előtt, de ez NEM a detektor automatikus feladata.
- Egy politikailag motivált eljárás, ahol az érintett személy sem NER-közeli, sem kormánykritikus közéleti szereplő (pl. egy teljesen hétköznapi, közéletben ismeretlen magánember pere) → NEM esik az 1. story hatókörébe, továbbra is `not_applicable`-ként dobódik el.
- Egy már meglévő `CourtVerdict` sor frissítése (pl. előzetesből jogerős ítéletté válik ugyanaz az ügy) → a meglévő (003-as) duplikáció-szűrés érvényben marad, nem jön létre két bejegyzés ugyanarra a személyre 30 napon belül.
- A breaking élő összekötés build-time vagy runtime hibája (pl. a config-import nem érhető el a scrapers csomagból) → a rendszernek biztonságosan a korábbi, statikus lista viselkedésére kell visszaesnie, nem hibázhatja el a teljes detektor-futást.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A `detect-verdicts.ts` LLM-promptjának (`court-verdict-detect.ts`) fel KELL ismernie a politikai indíttatású büntetőeljárásokat (letartóztatás, előzetes letartóztatás, vádemelés, ítélet) is, nem csak a klasszikus korrupciós ügyeket (hűtlen kezelés, vesztegetés, sikkasztás stb.), feltéve hogy az érintett NER-közeli vagy a kormánnyal szemben nyilvánosan kritikus közéleti szereplő.
- **FR-002**: A relevancia-előszűrésnek (meglévő „biztos kuka" URL/kulcsszó-szűrés) továbbra is ki KELL zárnia a nem-magyar és nyilvánvalóan nem-releváns eseteket, mielőtt a cikk elérné az LLM-verdict-extrakciót — a scope-bővítés NEM lazíthatja a nyelvi/országos relevancia-szűrést.
- **FR-003**: A meglévő megbízhatóság-alapú útvonalazás (`decideStatus`, `AUTO_PUBLISH_THRESHOLD=0.90`, `REVIEW_FLOOR=0.70`) VÁLTOZATLAN marad — a scope-bővítés kizárólag azt bővíti, MIT ismer fel a detektor, nem azt, hogyan dönt a megbízhatóságról.
- **FR-004**: Ha a kinyert adatok bármelyike (pozíció, ügy jellege, a személy kiléte) kétséges vagy több névvel összetéveszthető, a rendszernek a meglévő pending-útvonalra KELL terelnie az esetet — nem hozhat létre automatikus, kellő forrás nélküli publikálást.
- **FR-005**: A nyitóoldal grafikon melletti összefoglaló blokkjának a legfrissebb approved `CourtVerdict` bejegyzést fel KELL vennie, legfeljebb 6 szavas leírással.
- **FR-006**: A `/birosagi-iteletek` oldalnak saját (jelenleg nem létező) összesítő blokkot KELL kapnia, amely a legfrissebb bejegyzést ugyanazzal a max 6 szavas leírási szabállyal mutatja.
- **FR-007**: A max 6 szavas leírásra DB-szintű CHECK constraint-et KELL bevezetni (a `0034_description_word_limit.sql` PoliticalResignation/MediaClosure mintáját követve), hogy a szabály ne csak alkalmazásszinten, hanem kézi/admin SQL-beszúrásnál is érvényesüljön.
- **FR-008**: A `relevance.ts` `BREAKING_MONITORED` statikus névlistáját élőben KELL összekötni a `GALERIA`, `WATCH_LIST` és `UGYEK` configokkal, úgy hogy egy config-bővítés ne igényeljen kézi szinkronizálást a `packages/scrapers` csomagban.
- **FR-009**: Ha az élő összekötés (FR-008) technikai okból (build-time/runtime hiba) nem érhető el, a rendszernek a korábbi, statikus lista viselkedésére KELL biztonságosan visszaesnie, a detektor-futás hibázása nélkül.

### Key Entities *(include if feature involves data)*

- **CourtVerdict bejegyzés (bővített hatókör)**: a meglévő tábla és mezők változatlanok; csak az LLM felismerési hatóköre bővül a politikai indíttatású eljárásokra.
- **Nyitóoldali/bírósági-ítéletek összesítő blokk**: olvasás-only, a legfrissebb approved CourtVerdict sor max 6 szavas megjelenítése.
- **Breaking-figyelt entitáslista**: jelenleg statikus, duplikált lista; a cél állapotban a GALERIA/WATCH_LIST/UGYEK configokból származtatott, élő lista.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Egy Szakács István-eset jellegű cikk (politikai indíttatású letartóztatás, minden szükséges adattal a cikkben) a meglévő confidence-küszöbök szerint helyesen approved vagy pending állapotba kerül, nem dobódik el `not_applicable` okkal pusztán a korrupciós-jelleg hiánya miatt.
- **SC-002**: Egy újonnan approved CourtVerdict sor 2 percen belül (a meglévő ISR revalidate-ablakon belül) megjelenik mind a nyitóoldali, mind a `/birosagi-iteletek` összesítőben, max 6 szavas leírással.
- **SC-003**: Egy config-bővítés (új GALERIA/WATCH_LIST/UGYEK elem) után egy vele kapcsolatos breaking-jellegű cikk kézi `relevance.ts`-szerkesztés nélkül helyesen breaking-nek minősül.
- **SC-004**: A meglévő korrupciós ügyek detektálási pontossága (003/006 SC-jei) nem romlik — a scope-bővítés nem eredményez több hamis pozitívot a klasszikus korrupciós esetekben.

## Assumptions

- A „NER-közeli vagy a kormánnyal szemben nyilvánosan kritikus közéleti szereplő" kritérium szükségszerűen szubjektívebb, mint a jelenlegi „politikailag kötött személy" lista — az LLM-promptnak explicit példákkal (pl. állami propagandaszervezet munkatársa, akit kritikus megnyilvánulásért vonnak felelősségre) kell körülhatárolnia, ne fogadjon el bármilyen büntetőeljárást pusztán azért, mert egy közéleti szereplőt érint.
- A `/birosagi-iteletek` oldal jelenlegi „Kiszabott börtönévek" címe és leírása (kizárólag jogerős/elsőfokú ítéletekre utal) frissítésre szorul, hogy tükrözze a bővített hatókört (előzetes, vádemelés, politikai eljárások is) — ez szövegszintű, nem architekturális változás.
- A breaking-lista élő összekötésének pontos technikai megoldása (build-time kódgenerálás vs. megosztott JSON vs. más mechanizmus) a `plan.md` fázisban dől el, jelen dokumentum csak a kívánt viselkedést (FR-008/FR-009) rögzíti.
- A max 6 szavas leírási szabály a `CourtVerdict`-specifikus összesítő mezőre vonatkozik, nem a tábla `summary` mezőjére (ami továbbra is 1-2 mondatos maradhat) — ez egy ÚJ, rövid mező vagy származtatott érték, amit az összesítő blokkok használnak.
