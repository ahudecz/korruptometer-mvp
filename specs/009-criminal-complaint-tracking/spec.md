# Feature Specification: Feljelentés-nyomkövető blokk a "Börtönben van-e?" oldalon

**Feature Branch**: `009-criminal-complaint-tracking`
**Created**: 2026-07-16
**Status**: Draft
**Input**: User description: "A /birosagi-iteletek oldalon jelenleg csak onnantól követjük az ügyet, hogy már letartóztatás/vádemelés történt — de van egy megelőző lépés: a feljelentés, és mostanában záporoznak a feljelentések NER-hez, államigazgatáshoz, állami szereplőkhöz vagy NER-hez kapcsolódó gazdasági szereplőkhöz köthető ügyekben. A meglévő 2 blokk (Előzetesben / Kiengedve) mintájára kell egy 3. blokk, legfelül, a szűrők fölé, amely a feljelentés-stádiumú ügyeket listázza: Dátum, Státusz, Feljelentő (intézmény/személy), Ügy neve, Leírás, Forrás — a lemondások oldal mintájára. A feljelentő köre nem korlátozott (kormány/minisztérium csak példa volt, bármilyen hiteles feljelentő elfogadható — pl. Transparency International, ellenzéki politikus, magánszemély). A Státusz mezőnek követnie kell az ügy előrehaladását (csak feljelentés → nyomozás/eljárás → vádemelés/ítélet), színkódolva."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A feljelentés-stádiumú ügyek láthatóvá válnak (Priority: P1)

Amikor egy magyar cikk arról szól, hogy valaki (kormány, minisztérium, civil szervezet, ellenzéki politikus, magánszemély stb.) feljelentést tesz egy NER-hez, államigazgatáshoz, állami szereplőkhöz vagy NER-hez kapcsolódó gazdasági szereplőkhöz köthető ügyben, ez az esemény bekerül a rendszerbe, és megjelenik a `/birosagi-iteletek` oldal tetején, egy önálló blokkban — még mielőtt bármilyen tényleges rendőrségi vagy bírósági eljárás elindulna.

**Why this priority**: Jelenleg ez a stádium teljesen láthatatlan a rendszerben — az oldal csak onnantól követi az ügyet, hogy már letartóztatás/vádemelés történt. A feljelentések száma az utóbbi hetekben megugrott (2026-07-09/10-én egy kormányinfón egyszerre 5 külön ügyben jelentettek be feljelentést), ez a jelenség dokumentálatlan marad enélkül.

**Independent Test**: Egy kulcsszó-egyező cikk, amelyben egy hiteles feljelentő NER-közeli/állami/államigazgatási célpont ellen feljelentést tesz, a kulcsszó-előszűrésen átjutva az LLM-nél releváns találatnak minősül, és a meglévő megbízhatóság-küszöbök szerint approved/pending bejegyzésként megjelenik az új blokkban, a kért mezőkkel (Dátum, Státusz, Feljelentő, Ügy neve, Leírás, Forrás).

**Acceptance Scenarios**:

1. **Given** egy cikk NER-hez/államigazgatáshoz/állami szereplőhöz/NER-hez kapcsolódó gazdasági szereplőhöz köthető feljelentésről, **When** a cikk átmegy a kulcsszó-előszűrésen ("feljelent" és ragozásai) és az LLM-elemzésen, **Then** a rendszer "csak feljelentés történt" státusszal beírja az esetet, és az megjelenik az új blokk tetején Dátum/Státusz/Feljelentő/Ügy neve/Leírás/Forrás mezőkkel.
2. **Given** egy cikk, amely egyszerre TÖBB különálló feljelentést sorol fel (pl. egy kormányinfó-cikk 5 különböző üggyel), **When** feldolgozásra kerül, **Then** mindegyik önálló bejegyzésként jön létre — nem egyetlen összevont sorként.
3. **Given** egy feljelentés, amelynek tárgya NEM kapcsolódik NER-hez, államigazgatáshoz, állami szereplőhöz vagy NER-hez kapcsolódó gazdasági szereplőhöz (pl. tisztán magánjellegű rágalmazási ügy két politikus között), **When** az LLM elemzi, **Then** a rendszer nem hoz létre bejegyzést (`not_applicable`), függetlenül attól, hogy ki a feljelentő.
4. **Given** egy feljelentés, ahol a feljelentő NER-közeli/kormányzati szereplő és a célpont egy kormánykritikus hang (pl. ellenzéki politikus elleni feljelentés), **When** az LLM elemzi, **Then** a rendszer NEM hoz létre bejegyzést, mert a feljelentés TÁRGYA (a célpont) nem esik a hatókörbe — a feljelentő kiléte önmagában nem elég.

---

### User Story 2 - Egy feljelentés előrehaladása frissíti a meglévő bejegyzést, nem duplikálja (Priority: P1)

Amikor egy már rögzített feljelentéshez képest újabb fejlemény történik — rendőrségi nyomozás indul, vádemelés történik, vagy ítélet születik —, a rendszer a MEGLÉVŐ bejegyzés Státuszát frissíti a magasabb fázisra, nem hoz létre új, duplikált sort.

**Why this priority**: Ez a funkció lényege, nem csak kiegészítése. E nélkül a blokk gyorsan megtelne ugyanazon ügyek duplikátumaival, és pont az, amiért a funkció készül — az ügyek valós előrehaladásának követése — nem valósulna meg. A projektben korábban ötször is előfordult, hogy egy INSERT-only detektor egy státuszváltozást új duplikátumként nyelt el ahelyett, hogy frissítette volna a meglévő sort — ezt itt tervezetten el kell kerülni.

**Independent Test**: Egy meglévő approved feljelentés-bejegyzéshez (adott feljelentő + ügy/célpont) tartozó, később megjelenő cikk (pl. "nyomozás indult ugyanebben az ügyben") esetén a meglévő sor Státusza frissül a magasabb fázisra, és NEM jön létre új sor.

**Acceptance Scenarios**:

1. **Given** egy meglévő approved feljelentés-bejegyzés, **When** egy új cikk ugyanarról az ügyről (azonos feljelentő + ügy/célpont) rendőrségi nyomozás indulását jelzi, **Then** a meglévő sor Státusza "Nyomozás/eljárás alatt"-ra frissül, a forrás-lista kiegészül az új cikkel, és nem jön létre új sor.
2. **Given** egy feljelentésből vádemelés vagy ítélet lesz, amit a meglévő `court-verdict-detect.ts` már külön CourtVerdict-sorként felvett, **When** a feljelentés-bejegyzés frissítése lefut, **Then** a feljelentés-blokk saját sora is a legfrissebb fázisra frissül a Státusz mezőben, és MINDKÉT blokkban (feljelentés-tracker és bírósági ítéletek) látható marad — a rendszer nem rejti el automatikusan egyiket sem.
3. **Given** egy új cikk, amelynél bizonytalan, hogy egy meglévő feljelentéshez tartozó fejleményről van-e szó, vagy egy teljesen új esetről, **When** az LLM konfidenciája emiatt alacsony, **Then** a meglévő 0.70–0.90 pending-sáv szerint kézi jóváhagyásra vár — a rendszer NEM frissít és NEM hoz létre automatikusan bizonytalan alapon.
4. **Given** egy feljelentést később elutasítanak vagy az eljárás megszűnik, **When** erről cikk jelenik meg, **Then** a meglévő sor Státusza "Elutasítva/megszűnt"-re frissül — a sor nem tűnik el a blokkból.

---

### User Story 3 - Bizonytalan találatok a meglévő Telegram-boton keresztül kerülnek jóváhagyásra (Priority: P1)

Amikor a rendszer nem eléggé biztos egy feljelentés-találatban (új eset felvétele VAGY egy meglévő sorhoz tartozó fejlemény-frissítés bizonytalan), a szerkesztő a meglévő Telegram jóváhagyó boton (`@kegyencjarat_bot`) keresztül kap értesítést — a forráscikkre mutató linkkel és "Jóváhagyom"/"Elutasítom" gombokkal —, ugyanazt a mintát követve, mint a másik négy detektor-kategória (lemondás, médium-megszűnés, bírósági ítélet, vagyonvisszaszerzés).

**Why this priority**: Enélkül a "pending" találatok csak az admin felületen lennének intézhetők, ami a projekt jelenlegi gyakorlatával (008-telegram-review-bot) ellentétes — a szerkesztő ma minden más detektor esetén telefonról, Telegramon dönt. Egy új kategória, ami kihagyja ezt a mintát, inkonzisztens felhasználói élményt és elmaradó jóváhagyásokat eredményezne.

**Independent Test**: Egy mesterségesen 0.72 megbízhatóságú (pending) feljelentés-találat Telegram-üzenetén a "Jóváhagyom" gombra kattintva a megfelelő sor `reviewStatus` mezője `approved`-ra vált, és megjelenik a `/birosagi-iteletek` új blokkjában.

**Acceptance Scenarios**:

1. **Given** egy `pending` állapotú ÚJ feljelentés-találat (bizonytalan feljelentő/ügy-azonosítás), **When** a detektor lefut, **Then** a szerkesztő Telegram-üzenetet kap forráscikk-linkkel és Jóváhagyom/Elutasítom gombokkal, a meglévő 4 kategóriával azonos mintában.
2. **Given** egy `pending` állapotú FEJLEMÉNY-frissítés (bizonytalan, hogy egy meglévő sorhoz tartozik-e), **When** a szerkesztő megnyomja a "Jóváhagyom" gombot, **Then** a rendszer a meglévő sort frissíti a magasabb státuszra — nem hoz létre új sort.
3. **Given** egy `pending` találat, **When** a szerkesztő megnyomja az "Elutasítom" gombot, **Then** a találat nem kerül be (és fejlemény-frissítés esetén a meglévő sor változatlan marad), és nem jelenik meg egyetlen publikus oldalon sem.
4. **Given** egy cikk, ami egyszerre feljelentésről ÉS egy másik meglévő kategóriáról (pl. lemondásról) is szól, **When** a szerkesztő jóváhagyja az egyiket, **Then** a rendszer a 008-as spec kereszt-kategória-felismerési logikájának megfelelően jelzi/felveszi a másikat is — a feljelentés az 5. felismerhető kategóriaként bekerül ebbe a mechanizmusba.

---

### User Story 4 - Színkódolt státuszjelzés gyors áttekinthetőséghez (Priority: P2)

A blokkban minden bejegyzés Státusz mezője vizuálisan, színkódolva jelzi, hogy az ügy hol tart: csak feljelentés történt, nyomozás/eljárás van folyamatban, vádemelés történt, ítélet született, vagy elutasították.

**Why this priority**: Önmagában nem alapfunkció (az 1-2. story nélkül nincs mit színezni), de a felhasználói érték nagy része abból jön, hogy egy pillantással látszik, mely ügyek állnak még "csak" feljelentésnél, és melyek haladtak tovább.

**Independent Test**: A blokkban legalább kétféle státuszú bejegyzés esetén vizuálisan egyértelműen megkülönböztethető színt/jelzést kapnak, a meglévő `/birosagi-iteletek` oldal `StatusBadge` mintáját követve (pl. ELŐZETESBEN, VÁDEMELVE, KIENGEDVE már ma is más-más színűek).

**Acceptance Scenarios**:

1. **Given** egy "csak feljelentés történt" státuszú sor, **When** renderelődik, **Then** egy semleges/visszafogott színű jelzést kap, ami egyértelművé teszi, hogy még nem történt tényleges hatósági lépés.
2. **Given** egy "nyomozás/eljárás alatt", "vádemelés" vagy "ítélet" státuszú sor, **When** renderelődik, **Then** a fázisnak megfelelő, egyre "súlyosabb" színt kap, konzisztensen a meglévő `StatusBadge`-színpalettával.
3. **Given** egy "elutasítva/megszűnt" státuszú sor, **When** renderelődik, **Then** egyértelműen megkülönböztethető jelzést kap a still-aktív státuszoktól.

---

### Edge Cases

- Egy cikk, amiben a feljelentés tárgya vagy a feljelentő kiléte nem derül ki egyértelműen → a meglévő confidence-alapú pending-útvonal kezeli, nem publikálunk automatikusan bizonytalan adatot.
- Két különböző forrás ugyanarról a feljelentésről eltérő részletekkel (pl. más kártétel-összeg) → dedup: az első approved sor frissül a legfrissebb/legpontosabb adatokkal, nem jön létre második sor.
- Egy feljelentés, amit később visszavonnak vagy elutasítanak → ezt is a Státusz mezőben kell jelezni, a sor nem tűnik el.
- Tisztán magánjellegű, korrupciós/állami kontextus nélküli feljelentés (pl. rágalmazási ügy politikusok között) → `not_applicable`, még akkor is, ha a felek közéleti szereplők.
- Egy NER-közeli/kormányzati szereplő feljelentése egy kormánykritikus hang ellen → `not_applicable`, mert a feljelentés TÁRGYA dönt, nem a feljelentő kiléte.
- Egy feljelentés-hullám, ahol egyetlen sajtóesemény (pl. kormányinfó) sok különálló ügyet sorol fel egyszerre → mindegyiket önálló bejegyzésként kell kezelni, tömbös LLM-extrakcióval.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A rendszernek fel KELL ismernie a magyar cikkekben a "feljelentés" szótő és ragozásainak ("feljelentette", "feljelent", "feljelenti", "feljelentést tett" stb.) előfordulását kulcsszó-előszűrésként, a meglévő `resignation-detect.ts` / `court-verdict-detect.ts` mintát követve.
- **FR-002**: A kulcsszó-egyező cikkeknél az LLM-nek meg KELL állapítania, hogy a feljelentés TÁRGYA (kire/mire vonatkozik) kapcsolódik-e NER-hez, államigazgatáshoz, állami szereplőkhöz, vagy NER-hez kapcsolódó gazdasági szereplőkhöz — a feljelentő kiléte (kormány, minisztérium, ellenzék, civil szervezet, magánszemély, sajtó) NEM lehet korlátozó feltétel.
- **FR-003**: A rendszernek egy cikkből TÖBB önálló feljelentést KELL tudnia kinyerni, ha a cikk több különálló ügyet sorol fel egyszerre (tömbös LLM-extrakció, a `resignation-detect.ts` többszemélyes mintáját követve).
- **FR-004**: Minden feljelentés-bejegyzésnek legalább az alábbi mezőket KELL tartalmaznia: Dátum, Státusz, Feljelentő (intézmény/személy neve), Ügy neve, Leírás, Forrás(ok).
- **FR-005**: A rendszernek meg KELL különböztetnie legalább az alábbi státuszokat: "Feljelentés megtörtént" (nincs további fejlemény), "Nyomozás/eljárás alatt", "Vádemelés", "Ítélet" (első fokú/jogerős), valamint "Elutasítva/megszűnt".
- **FR-006**: Ha egy új cikk egy MÁR LÉTEZŐ feljelentés-bejegyzéshez tartozó fejleményről szól (azonos feljelentő + ügy/célpont), a rendszernek a MEGLÉVŐ sort KELL frissítenie magasabb státuszra — TILOS új, duplikált sort létrehoznia.
- **FR-007**: Ha a feljelentő+ügy egyezés bizonytalan (több lehetséges meglévő sorral is összetéveszthető, vagy nem egyértelmű, hogy új esetről van-e szó), a rendszernek a meglévő megbízhatóság-alapú review-útvonalra (0.90/0.70 küszöbök) KELL terelnie a döntést — automatikus, bizonytalan alapú publikálás/frissítés TILOS.
- **FR-008**: A `/birosagi-iteletek` oldalnak egy harmadik, önálló blokkot KELL kapnia, a jelenlegi "Előzetesben/eljárás alatt" és "Kiengedve/megszűnt" blokkok FÖLÉ helyezve, a szűrők fölé, amely az approved feljelentés-bejegyzéseket listázza.
- **FR-009**: A blokknak a Státusz mezőt vizuálisan színkódolnia KELL, a meglévő `StatusBadge` mintát követve — legalább az FR-005-ben felsorolt fázisonként megkülönböztethető színnel.
- **FR-010**: Ha egy feljelentésből ténylegesen CourtVerdict-szintű esemény lesz (amit a `court-verdict-detect.ts` már külön felvesz), a feljelentés-blokk saját sora VÁLTOZATLANUL látható marad, a Státusz mezőben követve a legfrissebb fázist — a rendszer NEM tünteti el/rejti el automatikusan a sort egyik blokkból sem.
- **FR-011**: Egy nem-releváns tárgyú feljelentés (magánjellegű, NER/államigazgatás/állami-szereplő kontextus nélküli ügy) NEM kerülhet be — a relevancia-szűrésnek ezt ki KELL zárnia, függetlenül a feljelentő kilététől.
- **FR-012**: Minden `pending` döntésű találatról (új feljelentés VAGY meglévő sorhoz tartozó bizonytalan fejlemény-frissítés) a rendszernek a meglévő Telegram jóváhagyó boton (`@kegyencjarat_bot`, `notifyReviewNeeded()`) keresztül KELL értesítenie a szerkesztőt, a másik 4 detektor-kategóriával (lemondás, médium-megszűnés, bírósági ítélet, vagyonvisszaszerzés) azonos mintában: forráscikk-link + "Jóváhagyom"/"Elutasítom" gombok.
- **FR-013**: A Telegram-jóváhagyás végrehajtásának (approve/reject) ugyanúgy ténylegesen módosítania KELL az adatbázis-sort — új eset létrehozása vagy meglévő sor frissítése (FR-006 szerint) —, nem csak egy értesítés-jelzés.
- **FR-014**: A 008-telegram-review-bot spec kereszt-kategória-felismerési mechanizmusa (egy cikk jóváhagyásakor ellenőrizni, hogy más kategóriát is érint-e) bővül az új "feljelentés" kategóriával, mint 5. felismerhető típus.

### Key Entities *(include if feature involves data)*

- **Feljelentés-bejegyzés (új entitás)**: dátum, feljelentő (intézmény/személy neve), ügy/célpont neve, leírás, forrás URL-ek/nevek/dátumok, aktuális státusz (feljelentés / nyomozás / vádemelés / ítélet / elutasítva), review-státusz (approved/pending/rejected, a meglévő review-mintát követve), és egy belső feljelentő+ügy azonosító pár a jövőbeli fejlemény-frissítések matcheléséhez.
- **`/birosagi-iteletek` oldal harmadik blokkja**: olvasás-only megjelenítés, az approved feljelentés-bejegyzéseket dátum szerint rendezve listázza, a meglévő 2 blokk fölött, a szűrők fölött.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Egy kormányinfó-jellegű cikk, amely 5 különálló feljelentést sorol fel egyszerre, mind az 5 esetet önálló bejegyzésként hozza létre — nem 1 összevont sort.
- **SC-002**: Egy már approved feljelentés-bejegyzéshez tartozó, később megjelenő fejlemény-cikk (pl. "nyomozás indult") legalább 10 kézzel ellenőrzött teszteseten 100%-ban a meglévő sort frissíti — nem hoz létre duplikátumot.
- **SC-003**: Egy tisztán magánjellegű, NER/államigazgatás-független feljelentésről szóló cikk nem kerül be a blokkba — a hamis pozitív arány nem rosszabb, mint a meglévő korrupciós detektorok (003/006-os specek) mért pontossága.
- **SC-004**: Egy új approved feljelentés-bejegyzés a meglévő ISR revalidate-ablakon (2 percen) belül megjelenik a `/birosagi-iteletek` harmadik blokkjában.
- **SC-005**: Minden `pending` döntésű találat (új eset vagy fejlemény-frissítés) Telegram-értesítést generál, és a szerkesztő "Jóváhagyom" gombnyomása 100%-ban ténylegesen módosítja az adatbázist (nem csak jelzésként fut le) — legalább 5 kézzel ellenőrzött teszteseten.

## Assumptions

- A feljelentő köre nem korlátozott (kormány, minisztérium, ellenzéki politikus, civil szervezet — pl. Transparency International —, újságíró, magánszemély egyaránt elfogadható) — kizárólag a feljelentés TÁRGYÁNAK relevanciája számít a bekerüléshez.
- Az eszkalációnál (feljelentés → CourtVerdict-szintű esemény) a két blokk egymástól függetlenül, párhuzamosan látható marad ugyanarról az ügyről — nincs automatikus elrejtés/összevonás a v1-ben; ez tudatos felhasználói döntés, nem technikai korlát.
- A feljelentő+ügy matchelés pontos technikai megvalósítása (normalizált névegyezés, időablak a dedup-hoz stb.) a `plan.md` fázisban dől el — valószínűleg a `resignation-detect.ts` 30 napos név+intézmény alapú dedup-mintájából indul ki, de annál nyitottabb időablakra lehet szükség, mivel egy feljelentésből hónapok múlva is lehet vádemelés.
- A detektálás a meglévő egyszeri (`detect-now.ts`-szerű) és/vagy élő Inngest-alapú pipeline-ba illeszkedik — a pontos beillesztési pont a `plan.md` fázisban dől el.
- A `pending` küszöb (0.70–0.90) és a Telegram-jóváhagyás mechanikája a meglévő `decideStatus()` / `notifyReviewNeeded()` infrastruktúrát használja újra (`review.ts`, 003/008-as specek) — nem új jóváhagyó csatorna épül, csak egy 5. kategóriaként bekötve.
- A meglévő max 6 szavas leírás-CHECK-constraint szabály (`0034_description_word_limit.sql` mintája) NEM vonatkozik alapértelmezésben erre az új entitásra, mivel elsősorban nem egy nyitóoldali "Legfrissebb"-összesítőhöz készül, hanem egy önálló listázott blokkhoz; ha egy ilyen összesítő is készül hozzá, azt külön kell szabályozni.
