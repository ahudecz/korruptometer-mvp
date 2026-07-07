# Feature Specification: Detekciós pipeline megbízhatóság és felügyelet

**Feature Branch**: `006-detection-pipeline-reliability`
**Created**: 2026-07-07
**Status**: Draft
**Input**: User description: "A 'Detect political resignations' (és testvér-detektorai: médiamegszűnés, bírósági ítélet/előzetes, vagyonvisszaszerzés) jelenleg egy görgő időablakban (utolsó 2 óra) vizsgálja a cikkeket, nem azt tartja nyilván, mit ellenőrzött már ténylegesen. Egy átmeneti hiba (LLM API-kiesés, rate limit, kredit kifogyás) a jelölt cikket némán és véglegesen elveszíti, amint kicsúszik az ablakból — nincs újrapróbálkozás, nincs nyom. Ez most éles környezetben megtörtént: két valódi kirúgás (Berta Adrienn/Eximbank, Szöllősi György/Nemzeti Sport) helyesen bekerült a kulcsszó-jelöltek közé, de az LLM-hívás elhasalt (előbb LangDock költségkeret, majd Anthropic kredithiány), és mindkettő nyomtalanul kiesett — a review.ts decideStatus() 'discard' ága és a null-eredmény ág is logolás nélkül lép tovább, utólag nem rekonstruálható, miért nem jelent meg egy ismerten helyes eset. Szükséges: (1) időablak helyett 'ellenőrizve' jelző, ami a testvér-detektorokra is vonatkozik, hogy egy átmeneti hiba után a következő futás automatikusan újrapróbálja, ne vesszen el semmi; (2) minden nem-beszúrt jelöltnél strukturált indoklás-log; (3) admin havi összefoglaló oldal (approved / pending / majdnem-bekerült eldobások); (4) egy jól elkülönített, ma még csatorna nélküli értesítési pont ('notifyReviewNeeded'), amit később (tervezett csatorna: Telegram bot + közös csoport) be lehet kötni a detektor-logika bolygatása nélkül. Ez a 003-detection-review-engine megbízhatósági/láthatósági rétege, a meglévő confidence-alapú útvonalazás (decideStatus, 0.90/0.70 küszöbök, kiemelt személyek, duplikáció-szűrés) változatlan marad."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Egy átmeneti hiba miatt elveszett jelölt magától helyreáll (Priority: P1)

Amikor egy detektor-futás egy jelölt cikken elindítja az LLM-hívást, de az hibával tér vissza (API-kiesés, rate limit, kredit/keret kifogyás), a cikk NEM számít "ellenőrzöttnek" — a következő órás futás automatikusan újra megpróbálja, amíg egy valódi (siker vagy egyértelmű negatív) eredmény nem születik. A cikk soha nem eshet ki némán csak azért, mert időközben kicsúszott egy rögzített időablakból.

**Why this priority**: Ez pontosan az a hiba, ami éles környezetben megtörtént (Berta Adrienn, Szöllősi György nyomtalanul eltűnt). Ez a bizalmi alap — egy megbízhatósági/felügyeleti réteg értéktelen, ha maga a mögöttes adat veszhet el észrevétlenül. Enélkül semmilyen "havonta egyszer nézem meg" munkarend nem biztonságos, mert épp a legfontosabb esetek tűnhetnek el csendben.

**Independent Test**: Egy kulcsszó-egyező jelölt cikken mesterségesen hibáztatott LLM-hívás után a cikk NEM kerül "ellenőrzött" állapotba; a következő futásnál (sikeres LLM-hívással) újra feldolgozásra kerül, és pontosan egyszer jelenik meg a megfelelő állapotban (nincs duplikátum).

**Acceptance Scenarios**:

1. **Given** egy kulcsszó-egyező jelölt cikk, **When** az LLM-hívás hibával tér vissza, **Then** a cikk "nem ellenőrzött" marad, és a rendszer nem hoz létre sem bejegyzést, sem végleges eldobást.
2. **Given** egy korábban hibázott, még nem ellenőrzött jelölt, **When** a következő detektor-futás lefut és az LLM-hívás most sikeres, **Then** a cikk a valós eredmény szerint kerül feldolgozásra (beszúrás vagy végleges eldobás), és "ellenőrzöttnek" jelölődik.
3. **Given** egy jelölt cikk, amely publikálási dátuma alapján már kívül esne a korábbi 2 órás ablakon, **When** még nincs "ellenőrizve" jelölve, **Then** a rendszer akkor is feldolgozza (a backlog-korláton belül — lásd Assumptions).

---

### User Story 2 - Szerkesztő utólag is megérti, miért nem jelent meg egy eset (Priority: P2)

Minden olyan jelölt cikknél, amely NEM lett publikus/pending bejegyzés (mert a modell szerint nem releváns, mert alacsony megbízhatóságú volt, mert duplikátum, vagy mert hiányzott egy kötelező mező), egy kereshető, strukturált nyom marad: melyik cikk, milyen kinyert adat, milyen megbízhatóság, és pontosan miért nem lett belőle bejegyzés.

**Why this priority**: Az 1. story megakadályozza a végleges, néma adatvesztést; ez a story teszi **magyarázhatóvá** azokat az eseteket, amelyek jogosan lettek eldobva (pl. valóban alacsony megbízhatóság). Enélkül minden "miért nincs ott X" kérdés kézi diagnosztikai szkript futtatását igényli.

**Independent Test**: Egy 0.55 megbízhatóságú jelöltnél a rendszer egy visszakereshető rekordot hoz létre a cikk azonosítójával, a kinyert névvel, a megbízhatósági értékkel és egy `low_confidence` indoklás-kóddal — mindezt fejlesztői beavatkozás/szkript nélkül meg lehet nézni.

**Acceptance Scenarios**:

1. **Given** egy 0.55 megbízhatóságú találat, **When** a decideStatus 'discard'-ot ad vissza, **Then** keletkezik egy rekord: cikk-azonosító, név, megbízhatóság, ok=`low_confidence`.
2. **Given** egy LLM-hiba miatt sikertelen hívás, **When** a hívás elhasal, **Then** keletkezik egy rekord ok=`llm_error` jelzéssel (és a cikk NEM lesz "ellenőrizve", lásd 1. story).
3. **Given** egy duplikátumként felismert találat, **When** az isDuplicate igazat ad vissza, **Then** keletkezik egy rekord ok=`duplicate` jelzéssel.

---

### User Story 3 - Szerkesztő havonta egyszer, egy oldalon átnézi a hónapot (Priority: P3)

Egy admin-only oldal havi bontásban összesíti: hány esemény lett automatikusan publikálva, hány vár jóváhagyásra, és hány "majdnem bekerült" (a jóváhagyási küszöb alatt, de nem elhanyagolhatóan alacsony megbízhatósággal eldobott) találat volt — mindegyik linkelve a részletekhez.

**Why this priority**: Ergonómiai/munkarendi javítás — az 1–2. story adja meg hozzá a megbízható, magyarázható adatot. Ez teszi lehetővé, hogy a szerkesztő ne folyamatos figyelést, hanem havi egyszeri átnézést végezzen.

**Independent Test**: Egy adott hónapra megnyitva az oldal helyesen csoportosítva mutatja az approved/pending/majdnem-eldobott számokat, és minden szám a mögöttes adatokkal egyezik.

**Acceptance Scenarios**:

1. **Given** egy hónap detektor-aktivitása, **When** a szerkesztő megnyitja a havi összefoglalót, **Then** látja az auto-publikált, a pending és a "majdnem bekerült" eldobások számát és listáját.
2. **Given** egy "majdnem bekerült" eldobás, **When** a szerkesztő rákattint, **Then** látja a forráscikket és a kinyert mezőket, és dönthet a kézi felvételről.

---

### User Story 4 - Az értesítési csatorna később, a detektor-logika bolygatása nélkül köthető be (Priority: P4)

Egy jól elkülönített függvényhívás (`notifyReviewNeeded`) jelzi, amikor egy új pending vagy "majdnem bekerült" elem keletkezik. Amíg nincs valódi csatorna bekötve (a tervezett csatorna: Telegram bot + közös csoport, még nem beállítva), ez dokumentáltan nem csinál semmit (no-op/log) — és emiatt egyetlen detektor-futás sem hibázhat el.

**Why this priority**: Ma nincs bekötött csatorna, tehát önmagában nem hoz megfigyelhető felhasználói értéket — de a kontraktus (a hívási pont léte és stabil interfésze) már most rögzíthető és tesztelhető, hogy a csatorna bekötése ne igényeljen újra hozzányúlást a detektorokhoz.

**Independent Test**: A `notifyReviewNeeded` egy teszt-adapterrel meghívva helyesen továbbítja az üzenetet; csatorna-adapter nélkül (mai állapot) a hívás nem dob hibát és nem állítja meg a detektor-futást.

**Acceptance Scenarios**:

1. **Given** egy új pending elem, **When** a detektor-futás létrehozza, **Then** meghívódik a `notifyReviewNeeded` egyetlen, jól definiált hívási ponton.
2. **Given** nincs bekötött csatorna-adapter, **When** a `notifyReviewNeeded` meghívódik, **Then** a detektor-futás sikeresen befejeződik, hiba nélkül.

---

### Edge Cases

- Ugyanazt a cikket két detektor-futás egyszerre próbálja ellenőrizni (átfedő ütemezés) → az "ellenőrizve" jelölés írása legyen sorbiztos/idempotens, hogy ne keletkezzen duplikátum.
- Egy cikk, amit a modell egyértelműen "nem releváns"-nak ítél (isResignation=false) → ez valódi negatív eredmény, "ellenőrizve" jelölendő, NEM próbálandó újra minden órában a végtelenségig.
- A funkció élesítésekor már létező, sosem ellenőrzött cikkek tömege → csak egy korlátozott backlog-ablakon belüliek kerülnek egyszeri utólagos feldolgozásra (lásd Assumptions), nem a teljes történeti archívum.
- Egy "majdnem bekerült" eldobás után egy KÉSŐBBI, erősebb cikk ugyanarról az eseményről → a meglévő (003-as) duplikáció-szűrés érvényben marad, nem jön létre két bejegyzés.
- A négy testvér-detektor (lemondás, médiamegszűnés, bírósági ítélet/előzetes, vagyonvisszaszerzés) különböző tábla/mező-neveket használ → az "ellenőrizve" nyomkövetés mintája azonos, de a konkrét megvalósítás detektoronként a saját tábláját érinti.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Minden kulcsszó-egyező jelölt cikknek pontosan egy végállapotba KELL jutnia — beszúrva (approved/pending) vagy véglegesen eldobva —, és ezt az állapotot cikkenként nyilván KELL tartani, hogy ne dolgozódjon fel kétszer.
- **FR-002**: Egy átmeneti hiba (LLM API-hiba, rate limit, kredit/keret kifogyás) a jelölten NEM eredményezhet "ellenőrizve" jelölést — a cikknek a következő futáson újra elérhetőnek KELL maradnia.
- **FR-003**: A jelölt-keresés NEM alapulhat kizárólag rögzített görgő időablakon; minden még nem ellenőrzött, kulcsszó-egyező cikket fel KELL dolgoznia, publikálási kortól függetlenül, az Assumptions-ben rögzített backlog-koron belül.
- **FR-004**: Az "ellenőrizve" nyomkövetést egységesen KELL alkalmazni mind a négy testvér-detektorra: lemondás/kirúgás/felmentés, médiamegszűnés, bírósági ítélet/előzetes letartóztatás, vagyonvisszaszerzés.
- **FR-005**: Minden nem-beszúrt jelöltről (eldobás, negatív eredmény, vagy hiba) strukturált, lekérdezhető rekordot KELL létrehozni: cikk-azonosító, kinyert név (ha van), megbízhatóság (ha van), és egy konkrét ok-kód.
- **FR-006**: Egy admin-only havi összefoglaló nézetnek naptári hónaponként össze KELL foglalnia: auto-publikált darabszám, pending darabszám, "majdnem bekerült" eldobás darabszám — mindegyik linkelve a mögöttes elemekhez.
- **FR-007**: A "majdnem bekerült" sávnak konfigurálhatónak KELL lennie (javasolt alapérték: 0.50–0.6999), a review.ts meglévő 0.70-es kemény eldobási küszöbének (decideStatus) módosítása NÉLKÜL.
- **FR-008**: Egy egyetlen, jól nevesített értesítési hívási pontnak (`notifyReviewNeeded`) KELL léteznie, hogy egy valódi csatorna (tervezett: Telegram bot + csoport) bekötése ne igényeljen változtatást a detektor-logikában; amíg nincs csatorna bekötve, a hívásnak dokumentáltan no-op/log-only KELL lennie, és NEM hibáztathatja el a futást.
- **FR-009**: A jelen funkció SEMMILYEN meglévő megbízhatóság→állapot döntést nem változtathat meg — a decideStatus, az AUTO_PUBLISH_THRESHOLD (0.90), a REVIEW_FLOOR (0.70), a kiemelt személyek listája és a 003-as duplikáció-szűrés változatlan marad; ez a funkció kizárólag azt változtatja, MIT vizsgál, MIT tart nyilván, és MI látható belőle.
- **FR-010**: A meglévő NewsArticle-sorok "ellenőrizve" állapotának utólagos feltöltése NEM eredményezheti a teljes történeti cikk-archívum újrafeldolgozását — élesítéskor csak a backlog-ablakon (Assumptions) belüli cikkek válnak jelöltté.

### Key Entities *(include if feature involves data)*

- **Ellenőrzöttség-jelző**: cikkenkénti, detektor-típusonkénti jelzés arról, hogy történt-e már valódi (nem átmeneti) döntés, és mikor.
- **Eldobás/negatív-eredmény rekord**: auditnyom minden olyan jelöltről, amely nem lett publikált/pending bejegyzés — ok-kóddal és a kinyert adatokkal.
- **Havi összefoglaló**: olvasás-only, hónap szerint csoportosított nézet a PoliticalResignation / MediaClosure / CourtVerdict / vagyonvisszaszerzés táblák és az új eldobás-rekordok felett.
- **Értesítési hívási pont**: a tényleges küldési csatortól független függvény-kontraktus, amit egy új pending/"majdnem bekerült" elem keletkezésekor hívunk meg.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Egy kizárólag átmeneti LLM-hiba miatt elakadt jelölt egy KÉSŐBBI futáson, kézi beavatkozás nélkül, helyesen feldolgozódik (0 végleges néma adatvesztés átmeneti hiba miatt, mostantól mérve).
- **SC-002**: Az utolsó 30 nap bármely eldobott/nem-beszúrt jelöltjénél a szerkesztő 1 percen belül megtalálja a konkrét okot az admin felületen/logban, fejlesztői diagnosztikai szkript nélkül.
- **SC-003**: A szerkesztő egyetlen admin-oldal megnyitásával át tudja tekinteni egy teljes hónap detektor-aktivitását (auto-publikált + pending + majdnem bekerült).
- **SC-004**: Egy valódi értesítési csatorna későbbi bekötése kizárólag az értesítési adaptert érinti, a négy detektor-függvény egyikét sem kell módosítani hozzá.
- **SC-005**: A meglévő megbízhatóság-alapú útvonalazás (003 SC-001–SC-005) 100%-ban változatlan marad — egyetlen megbízhatóság/kiemelt-személy kombinációnál sem változik, hogy auto-publikál, pending-be kerül, vagy eldobódik.

## Assumptions

- Az élesítéskor újonnan jelöltté váló, korábban sosem ellenőrzött cikkek backlog-korlátja 7 nap (elég hosszú, hogy egy a Berta Adrienn/Szöllősi-esethez hasonló incidenst elkapjon, elég rövid, hogy ne dolgozza fel a teljes archívumot) — konfigurálható.
- A havi összefoglaló "majdnem bekerült" sávja 0.50–0.6999 megbízhatóság, a review.ts kemény 0.70-es eldobási küszöbének (003) módosítása nélkül hangolható.
- Az értesítési csatorna a jelen funkció megvalósításakor szándékosan eldöntetlen (tervezett: Telegram bot + közös csoport, még nem beállítva); a hívási pontnak emiatt NEM szabad blokkolnia a funkció többi részének élesítését.
- Az LLM-szolgáltató/kredit-egészség (LangDock vs. Anthropic, keret/kredit-egyenleg) üzemeltetési kérdés, e funkció hatókörén kívül — e funkció csak azt biztosítja, hogy egy ilyen jellegű hiba után legyen újrapróbálkozás és láthatóság, nem azt, hogy ilyen hiba ne történhessen.
- A funkció közvetlenül a 003-detection-review-engine adatmodelljére (PoliticalResignation, MediaClosure, CourtVerdict) és review.ts logikájára épül; ezek meglévő oszlopain nem történik törő változtatás.
