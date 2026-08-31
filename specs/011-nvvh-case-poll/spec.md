# Feature Specification: NVVH-szavazás — Az első 5 ügy

**Feature Branch**: `011-nvvh-case-poll`
**Created**: 2026-08-31
**Status**: Draft
**Input**: User description: "Nemzeti Vagyonvisszaszerzési és Védelmi Hivatal (NVVH) első 5 ügye — közösségi szavazás: 1 kérdéses, multiple-choice (1–5 opció kiválasztható) szavazás a top 30 nagy értékű korrupciós ügyről (a kutatási alaplista már kész, forráslinkekkel). Önálló, megosztható aloldal (OG-image) + kiemelt kártya a főoldalon. Kártya-alapú opciók (rövid cím + leírás, lenyílóban részletek + forráscikk-link). Szavazás után eredmény-nézet kormany.hu-stílusú vízszintes csíkokkal (szavazatarány szerint). Anti-bot: Cloudflare Turnstile + Upstash IP-hash rate-limit (nagyvonalú küszöb, shared-NAT-barát, pl. 50-100/IP/nap) + hosszú lejáratú "már szavaztál" cookie mint elsődleges védelem + honeypot mező. Nyers IP nem tárolódik. Mobil-first (90% mobil forgalom)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Szavazat leadása (Priority: P1)

Egy látogató megnyitja a szavazóoldalt, elolvassa a kérdést ("Mi legyen a Nemzeti Vagyonvisszaszerzési és Védelmi Hivatal első 5 ügye?"), kiválaszt 1-5 ügyet a listából, és megerősítéssel elmenti a szavazatát.

**Why this priority**: Ez maga a termék — enélkül nincs szavazás. Minden más funkció (eredmények, megosztás, bot-védelem) erre az egy interakcióra épül.

**Independent Test**: Egy friss böngészőből (nincs "már szavaztál" cookie) megnyitva az oldalt, 1-5 opció kiválasztható és menthető; a mentés után a rendszer nyugtázza a szavazatot.

**Acceptance Scenarios**:

1. **Given** a szavazóoldal nyitva van, **When** a látogató 1 opciót választ ki és megerősíti, **Then** a szavazat rögzül, és a felület jelzi a sikeres leadást.
2. **Given** a látogató már kiválasztott 5 opciót, **When** megpróbál egy hatodikat is kiválasztani, **Then** a rendszer nem engedi a 6. kiválasztást, és jelzi, hogy legfeljebb 5 választható.
3. **Given** a látogató egy opciót sem választott ki, **When** megpróbálja megerősíteni a szavazatot, **Then** a megerősítés le van tiltva, és a felület jelzi, hogy legalább 1 opciót ki kell választani.
4. **Given** egy opciónál nincs konkrét, ellenőrzött forintösszeg, **When** a látogató megnézi a kártyát, **Then** az összeg helyén egyértelműen "Nincs konkrét összeg" jelenik meg — nem üres mező, nem "0 Ft".
5. **Given** egy opció leírása alatt van lenyíló ("Részletek"), **When** a látogató rákattint, **Then** megjelenik a hosszabb magyarázat és legalább 1 kattintható forráscikk-link.

---

### User Story 2 - Eredmények megtekintése (Priority: P2)

Egy látogató (akár szavazott már, akár nem) megnézheti, eddig hogyan szavaztak mások — egy vízszintes csíkos nézetben, ahol a csík hossza az adott ügyre leadott szavazatok arányát mutatja.

**Why this priority**: Ez adja a szavazás "élő" jellegét és a megosztási ösztönzést — enélkül a szavazás egy fekete doboz lenne. Épül az 1. user story-ra (kell hozzá leadott szavazat), de önmagában is tesztelhető és élesíthető.

**Independent Test**: Meglévő szavazatok mellett megnyitva az eredmény-nézetet, minden opció csíkja a saját szavazatarányával jelenik meg, csökkenő sorrendben; szavazat nélküli állapotban is értelmes, üres/nulla-állapotot mutat, nem hibát.

**Acceptance Scenarios**:

1. **Given** legalább 1 leadott szavazat létezik, **When** a látogató megnyitja az eredmény-nézetet, **Then** minden opció mellett látszik a rá szavazók aránya, vízszintes csíkkal vizualizálva, csökkenő sorrendben.
2. **Given** a látogató épp most adta le a szavazatát, **When** átvált eredmény-nézetbe, **Then** a saját választásai vizuálisan megkülönböztethetők a többitől.
3. **Given** még nem érkezett egyetlen szavazat sem, **When** valaki megnyitja az eredmény-nézetet, **Then** egy értelmes, hibamentes üres állapot jelenik meg (nem törik el a felület).

---

### User Story 3 - Felfedezés és megosztás (Priority: P3)

Egy látogató a főoldalon egy kiemelt kártyán keresztül talál rá a szavazásra, vagy egy közösségi médiában/messengerben megosztott linken keresztül nyit meg egy önálló, saját URL-lel rendelkező aloldalt, amelynek van előnézeti képe (cím + kép megjelenik megosztáskor).

**Why this priority**: Ez adja a virális terjedést, ami a feature explicit célja — de a szavazás alapfunkciója (1-2. user story) nélküle is működik és tesztelhető, ezért alacsonyabb prioritású, mint maga a szavazás.

**Independent Test**: A főoldali kártyára kattintva a felhasználó a szavazóaloldalra jut; az aloldal URL-jét egy közösségimédia-megosztási előnézet-tesztelővel ellenőrizve helyes cím és kép jelenik meg.

**Acceptance Scenarios**:

1. **Given** a főoldal betöltődött, **When** a látogató végignézi a felső harmadot, **Then** egy jól látható, önálló kártya hívja fel a figyelmet a szavazásra, élő részvételi számmal.
2. **Given** valaki megosztja a szavazóoldal linkjét egy közösségi platformon, **When** a link előnézete generálódik, **Then** egyedi cím és kép jelenik meg (nem a site generikus főoldali előnézete).
3. **Given** a szavazóoldal saját URL-lel rendelkezik, **When** valaki közvetlenül ezt a linket nyitja meg, **Then** ugyanazt a teljes szavazó-élményt kapja, mint a főoldalról navigálva.

---

### User Story 4 - Egy ember, egy szavazat, bot nélkül (Priority: P4)

A rendszer megakadályozza, hogy ugyanaz a látogató többször szavazzon, és ellenáll a szkriptelt, tömeges (pl. 10 000×) automatikus szavazat-leadásnak — anélkül, hogy egy megosztott hálózatról (pl. munkahelyi Wi-Fi, ahol a linket körbeküldték) érkező, egyébként valódi látogatókat kizárna.

**Why this priority**: Enélkül a szavazás eredménye hiteltelenné válik egyetlen manipulációs kísérlettel — de ez egy védelmi réteg az 1. user story fölött, nem önmagában működő funkció, ezért utolsó a négy közül.

**Independent Test**: Ugyanabból a böngészőből másodszor megnyitva a szavazóoldalt, a rendszer az eredmény-nézetet mutatja szavazás helyett (vagy egyértelműen jelzi, hogy már szavaztak); egy automatizált, gyors egymásutáni tömeges beküldési kísérlet a Turnstile-ellenőrzésen elakad, mielőtt bármelyik szavazat rögzülne.

**Acceptance Scenarios**:

1. **Given** egy böngésző korábban már leadott egy szavazatot, **When** ugyanabból a böngészőből újra megnyitja az oldalt, **Then** a rendszer nem engedi az ismételt szavazást, és az eredmény-nézetet mutatja.
2. **Given** egy megosztott hálózatról (azonos IP) sok különböző böngészőből érkeznek szavazatok, **When** a napi szavazatszám ezen az IP-n a nagyvonalú küszöb alatt marad, **Then** minden egyes, még nem szavazott böngészőnek engedélyezett a szavazás.
3. **Given** egy szkript emberi interakció nélkül próbál szavazatot beküldeni, **When** a beküldés nem megy át a láthatatlan bot-ellenőrzésen, **Then** a szavazat nem rögzül, és a hiba egyértelmű (nem "sikeres" visszajelzést kap a szkript).
4. **Given** egy rejtett csali-mező (amit csak bot tölt ki) ki van töltve a beküldésnél, **When** a szerver megkapja a kérést, **Then** a szavazat elutasításra kerül anélkül, hogy rögzülne.

---

### Edge Cases

- Mi történik, ha valaki JavaScript nélkül vagy nagyon régi böngészőből nyitja meg az oldalt? — A szavazás alapfunkciója (kiválasztás + beküldés) egy sima form-beküldéssel is működnie kell, a fejlettebb vizualizáció (élő csíkok) nélkül is használható maradjon.
- Mi történik, ha egy opció leírásában szereplő forráslink időközben elérhetetlenné válik (linkrothadás)? — A szavazás funkciója nem függhet a külső link elérhetőségétől; a link törött állapota nem akadályozhatja a szavazást.
- Mi történik, ha valaki törli a "már szavaztál" cookie-t, és megpróbál újra szavazni? — A cookie-alapú védelem ezt nem tudja megakadályozni (ismert korlát); az IP-alapú napi küszöb ezt a fajta ismételt próbálkozást csak nagy tömegben (robotszerű mintázatban) szűri ki, egyedi ismétlést nem.
- Mi történik verseny (race condition) esetén, ha két szavazat gyakorlatilag egyszerre érkezik ugyanarra az opcióra? — Az eredmény-számláló pontossága nem szenvedhet csorbát; apró, pár másodperces késés az eredmény-nézet frissülésében elfogadható (a site meglévő, óránkénti/eseményvezérelt statisztika-frissítési mintájához hasonlóan).
- Mi történik, ha a szavazás lezárul (pl. az NVVH ténylegesen megalakul és eldönti az első 5 ügyet)? — Az oldalnak ekkor is elérhetőnek és értelmesnek kell maradnia: az eredmény-nézet mutatja a végső állást, az új szavazatok leadása pedig le van tiltva, ezt a felület egyértelműen jelzi.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A rendszer egyetlen kérdést jelenít meg: "Mi legyen a Nemzeti Vagyonvisszaszerzési és Védelmi Hivatal első 5 ügye?", a kérdés alatt egyértelműen kiírva, hogy 1 és 5 közötti számú opció választható.
- **FR-002**: A rendszer legalább 30, előre kurátorolt ügyet kínál fel opcióként, mindegyiknél rövid cím és rövid leírás jelenik meg alapból.
- **FR-003**: Minden opciónál — ahol van rá ellenőrzött adat — megjelenik egy becsült forintösszeg; ahol nincs, ott egységesen "Nincs konkrét összeg" felirat jelenik meg, soha nem üres mező vagy "0 Ft".
- **FR-004**: Minden opció rendelkezik egy lenyitható "Részletek" nézettel, amely hosszabb magyarázatot és legalább 1 kattintható, külső forráscikk-linket tartalmaz.
- **FR-005**: A felhasználó 1 és 5 közötti számú opciót választhat ki; a rendszer megakadályozza 0 opció beküldését és az 5-nél több opció kiválasztását.
- **FR-006**: A kiválasztás egy explicit megerősítő lépéssel ("okézás") menthető el — a kiválasztás önmagában, megerősítés nélkül nem számít leadott szavazatnak.
- **FR-007**: A rendszer minden opcióhoz nyilvántartja az összes leadott szavazatot, és ebből egy, mindenki számára elérhető eredmény-nézetet állít elő.
- **FR-008**: Az eredmény-nézet vízszintes csíkokkal jeleníti meg az opciókat, a csík hossza az adott opcióra szavazók arányát fejezi ki, csökkenő sorrendben.
- **FR-009**: A szavazás saját, önálló, megosztható URL-en érhető el, egyedi közösségimédia-előnézeti címmel és képpel.
- **FR-010**: A főoldalon egy önálló, jól látható kártya vezet a szavazóoldalra.
- **FR-011**: A rendszer egy hosszú lejáratú, böngészőhöz kötött jelzőt ("már szavaztál") állít be sikeres szavazat után, és ez alapján ismételt szavazás esetén az eredmény-nézetet mutatja a szavazóform helyett.
- **FR-012**: A rendszer IP-cím alapján is korlátozza a naponta beküldhető szavazatok számát, de a küszöböt szándékosan nagyvonalúra állítja (alapértelmezés: 50-100 szavazat/IP/nap), hogy megosztott hálózatról (munkahely, egyetem, közös Wi-Fi) érkező, egyébként valódi látogatók ne ütközzenek bele.
- **FR-013**: A rendszer láthatatlan emberi-ellenőrzést (bot-detekciót) végez minden szavazat-beküldésnél, és az ezen fennakadó beküldéseket elutasítja, mielőtt azok rögzülnének.
- **FR-014**: A rendszer egy rejtett csali-mezőt (honeypot) tartalmaz a szavazóformban; a kitöltött csali-mezővel érkező beküldést a rendszer elutasítja.
- **FR-015**: A rendszer nem tárol nyers IP-címet tartósan az adatbázisban — az abúzus-védelemhez csak visszafejthetetlenül átalakított (hash-elt) formában használja, korlátozott ideig.
- **FR-016**: A szavazóoldal és a beküldés folyamata mobil kijelzőn (kis szélesség, érintéses vezérlés) teljes egészében használható, görgetés vagy vízszintes csúsztatás nélkül olvasható.
- **FR-017**: A rendszer megkülönbözteti azokat az opciókat, amelyeknél már folyik hivatalos eljárás vagy történt korábbi feljelentés — ez a jelölés tájékoztató jellegű, és nem zárja ki az adott opciót a szavazásból.
- **FR-018**: A rendszer megjelöli azokat az opciókat, amelyekben uniós forrás vagy uniós szabálytalansági eljárás is érintett, tájékoztató jelleggel.

### Key Entities

- **Szavazás (Poll)**: az egy darab, jelenleg futó kérdés; állapota (nyitott/lezárt), a hozzá tartozó opciók listája.
- **Opció (ügy)**: egy kiválasztható ügy — cím, rövid leírás, opcionális becsült összeg, hosszabb magyarázat, legalább 1 forráslink, tájékoztató jelölések (pl. "már van eljárás", "uniós forrás is érintett").
- **Szavazat**: egy beküldés — 1-5 kiválasztott opció, időbélyeg, az abúzus-védelemhez szükséges anonim azonosítók (böngésző-jelző, hash-elt IP) — semmilyen személyes adatot nem tartalmaz.
- **Eredmény-összesítés**: opciónkénti szavazatszám és -arány, amiből az eredmény-nézet épül.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Egy első látogatásra érkező, mobilt használó felhasználó 30 másodpercen belül le tudja adni a szavazatát a kérdés elolvasásától a megerősítésig.
- **SC-002**: Az eredmény-nézet mind a 30 opciót olvashatóan megjeleníti egy standard mobil kijelzőszélességen, vízszintes görgetés nélkül.
- **SC-003**: Egyetlen böngésző/eszköz sem tud egynél több szavazatot rögzíttetni normál használat mellett.
- **SC-004**: Egy szimulált, tömeges (10 000 kérésnyi) automatizált beküldési kísérlet szavazatainak 0%-a kerül be az eredménybe.
- **SC-005**: A szavazóoldal linkje közösségi médiában megosztva egyedi, a szavazásra jellemző címmel és képpel jelenik meg, nem a site generikus főoldali előnézetével.
- **SC-006**: Egy megosztott irodai/egyetemi hálózatról egy nap alatt érkező, egymástól különböző böngészőkből induló szavazatok legalább 95%-a sikeresen rögzül, amíg az adott IP nem lépi túl a nagyvonalú napi küszöböt.

## Assumptions

- A kezdeti 30 opció a már elkészült, forráslinkekkel ellátott kutatási lista (lásd a feature előkészítő anyagát) — a végleges szöveg és linkek a tervezési fázisban kerülnek át a rendszerbe.
- A már folyamatban lévő feljelentés/eljárás egy ügynél **nem** kizáró ok a szavazási listáról, mivel az NVVH törvényi jogköre alapján saját hatáskörébe vonhat már bejelentett ügyeket is.
- Az uniós forrást is érintő ügyek a listán maradnak, tájékoztató jelöléssel — a végső hatásköri döntés (hazai vs. Európai Ügyészség) nem ennek a szavazásnak a tárgya.
- A szavazás anonim: nincs bejelentkezés, nincs személyes adat gyűjtése; az egy-emberre-egy-szavazat védelem böngésző-jelzőn és hash-elt IP-n alapul, nem valós azonosításon.
- Egyszerre egy aktív szavazás fut (ez az első) — több párhuzamos vagy archivált korábbi szavazás kezelése jelen verzióban nincs tervben.
- Az eredmény-nézet mindenki számára látható, szavazástól függetlenül — nincs "csak szavazóknak" korlátozás.
- A leadott szavazat utólag nem módosítható vagy vonható vissza a jelen verzióban.
- A szavazási eredmény friss, de nem feltétlenül másodpercre pontos — rövid, néhány perces késés a megjelenítésben elfogadható, összhangban a site meglévő statisztika-frissítési gyakorlatával.
