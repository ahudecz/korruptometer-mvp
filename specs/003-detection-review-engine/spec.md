# Feature Specification: Detection Review Engine

**Feature Branch**: `003-detection-review-engine`
**Created**: 2026-06-28
**Status**: Draft
**Input**: User description: "Az LLM-detektorok (lemondás, kirúgás/felmentés, megszűnés/leépítés, bírósági ítélet/előzetes) ne publikáljanak automatikusan a nyilvános oldalra, hanem megbízhatóság szerint: ≥0.90 és nem kiemelt személy → auto-publikálás; 0.70–0.8999 → jóváhagyásra vár; <0.70 → eldobás. A 8 lemondásra felszólított + 10 kiemelt galéria-személy MINDIG jóváhagyásra vár. Duplikáció-szűrés normalizált név alapján egy időablakon belül. A 3 táblához státusz mező (approved/pending/rejected), a publikus oldalak csak az approved sorokat mutatják. Admin review-oldal: pending soroknál Elfogad/Eldob gomb."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editor reviews uncertain detections before they go public (Priority: P1)

A háttérben futó detektorok hírekből kiolvasott eseményeket (lemondás, kirúgás, felmentés, médiamegszűnés/leépítés, bírósági ítélet, előzetes letartóztatás) ajánlanak fel. A nem teljesen biztos vagy érzékeny (kiemelt személyt érintő) találatok nem jelennek meg azonnal a nyilvános oldalon, hanem egy „jóváhagyásra vár" sorba kerülnek. A szerkesztő egy admin felületen átnézi őket — látja a kiolvasott mezőket és a forráscikket —, majd egy kattintással **elfogadja** (megjelenik a nyilvános oldalon) vagy **eldobja** (nem jelenik meg, és többé nem bukkan fel újra).

**Why this priority**: Ez a bizalmi kapu. Egy nyilvános korrupció-figyelő oldalon egy hamis állítás (pl. „Polt Péter lemondott", amikor nem) jóvátehetetlen hitelességi kár. Az alkotmány I. (NEM-MEGSZEGHETŐ) elve kötelezővé teszi, hogy a rendszer ne állítson valótlant. E nélkül a kapu nélkül semmilyen automatizmus nem kapcsolható be biztonságosan — ez az MVP.

**Independent Test**: Önállóan tesztelhető: egy ismert bizonytalan/kiemelt-személyes találat a pending sorba kerül, NEM látszik a nyilvános oldalon; a szerkesztő elfogadja → megjelenik; egy másikat eldob → nem jelenik meg és újrafuttatáskor sem tér vissza.

**Acceptance Scenarios**:

1. **Given** egy detektált esemény 0.82 megbízhatósággal, **When** a detektor lefut, **Then** az esemény „pending" állapotba kerül és nem jelenik meg a nyilvános oldalon.
2. **Given** egy „pending" esemény, **When** a szerkesztő az adminban az „Elfogad" gombra kattint, **Then** az esemény „approved" lesz és megjelenik a megfelelő nyilvános oldalon.
3. **Given** egy „pending" esemény, **When** a szerkesztő az „Eldob" gombra kattint, **Then** az esemény „rejected" lesz, nem jelenik meg, és a detektor újrafuttatása sem hozza vissza.

---

### User Story 2 - Confident, non-sensitive detections publish automatically (Priority: P2)

Ha egy találat egyértelmű (magas megbízhatóság) ÉS nem érint kiemelt figyelt személyt, akkor szerkesztői beavatkozás nélkül, automatikusan megjelenik a nyilvános oldalon — így a tiszta esetek nem terhelik feleslegesen a szerkesztőt.

**Why this priority**: A szerkesztők ketten vannak; a cél, hogy csak a tényleg kétséges esetekkel kelljen foglalkozniuk. Az egyértelmű, kockázatmentes esetek automatizálása adja a tényleges munkamegtakarítást — de csak az 1. story (a kapu) megléte után biztonságos.

**Independent Test**: Egy 0.93 megbízhatóságú, nem-kiemelt személyt érintő találat a detektor lefutása után azonnal megjelenik a nyilvános oldalon, szerkesztői lépés nélkül.

**Acceptance Scenarios**:

1. **Given** egy detektált esemény 0.93 megbízhatósággal, nem-kiemelt személyről, **When** a detektor lefut, **Then** az esemény „approved" lesz és megjelenik a nyilvános oldalon.
2. **Given** egy detektált esemény 0.95 megbízhatósággal, de **kiemelt** személyről, **When** a detektor lefut, **Then** az esemény „pending" lesz (NEM auto-publikál), mert kiemelt személy.
3. **Given** egy detektált esemény 0.64 megbízhatósággal, **When** a detektor lefut, **Then** az esemény eldobódik (nem tárolódik).

---

### User Story 3 - The same person is never listed twice from one news wave (Priority: P3)

Ha ugyanarról a személyről több hír is megjelenik egy hírhullámban (pl. „Kovács Zoltán" a Nimród magazintól és a Nimród Vadászújságtól), a rendszer felismeri, hogy ugyanarról az emberről van szó, és nem hoz létre kétszer bejegyzést — még akkor sem, ha az intézménynév kicsit eltér.

**Why this priority**: Minőségi finomítás. Duplikátumok nélkül is használható a rendszer (a szerkesztő eldobhatja a duplát), de a duplikáció-szűrés tisztábban tartja a listát és a review-sort.

**Independent Test**: Két különböző cikk ugyanarról a személyről ugyanabban az időablakban → csak egy bejegyzés keletkezik (vagy kerül a review-sorba).

**Acceptance Scenarios**:

1. **Given** egy már rögzített bejegyzés „Kovács Zoltán"-ról, **When** egy újabb cikkből ugyanő detektálódik az időablakon belül eltérő intézménynévvel, **Then** nem jön létre második bejegyzés.

---

### Edge Cases

- **Több személyt érintő esemény** (pl. „37 misszióvezetőt hív vissza a Külügyminisztérium"): egyetlen, csoportos bejegyzésként kerül a review-sorba, a szerkesztő dönt róla. (Lásd Assumptions.)
- **Pending elem újra-detektálódik magasabb megbízhatósággal**: nem lép automatikusan „approved"-ra — pending marad, amíg a szerkesztő nem dönt.
- **Kiemelt személy ténylegesen lemond**: akkor is a review-soron megy keresztül (ez a szándék), a szerkesztő hagyja jóvá.
- **Határértékek**: pontosan 0.90 → auto (a küszöb ≥0.90); pontosan 0.70 → pending (a küszöb ≥0.70).
- **Korábbi, már élő adat**: változatlanul látszik (mind „approved"-nak számít) — a funkció bevezetése nem boríthatja a jelenlegi nyilvános adatot.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Minden detektált elemnek (személyi változás: lemondás/kirúgás/felmentés; médiamegszűnés/leépítés; bírósági ítélet/előzetes) rendelkeznie KELL egy jóváhagyási állapottal: `approved`, `pending` vagy `rejected`.
- **FR-002**: A nyilvános oldalak KIZÁRÓLAG az `approved` állapotú elemeket jeleníthetik meg.
- **FR-003**: Egy 0.90 vagy magasabb megbízhatóságú találat, amely NEM érint kiemelt figyelt személyt, automatikusan `approved` állapotba KELL kerüljön.
- **FR-004**: Egy 0.70 és 0.8999 közötti megbízhatóságú találat `pending` állapotba KELL kerüljön (review-sor).
- **FR-005**: Egy 0.70 alatti megbízhatóságú találatot el KELL dobni (nem tárolódik).
- **FR-006**: Bármely találat, amely kiemelt figyelt személyt érint (a 8 „lemondásra felszólított" + a 10 kiemelt galéria-személy), a megbízhatóságtól FÜGGETLENÜL `pending` állapotba KELL kerüljön.
- **FR-007**: A szerkesztőknek képesnek KELL lenniük az összes `pending` elem megtekintésére egy admin felületen, a kiolvasott mezőkkel és a forráscikk hivatkozásával együtt.
- **FR-008**: A szerkesztőknek képesnek KELL lenniük egy `pending` elemet **elfogadni** (→ `approved`, megjelenik) vagy **eldobni** (→ `rejected`, nem jelenik meg).
- **FR-009**: A rendszernek el KELL nyomnia a duplikátumokat: egy már rögzített személyhez (normalizált név alapján) egy meghatározott időablakon belül illeszkedő találat NEM hozhat létre második bejegyzést, akkor sem, ha az intézménynév eltér.
- **FR-010**: A funkció bevezetésekor a már meglévő, élő bejegyzéseket `approved`-ként KELL kezelni (a jelenlegi nyilvános adat nem tűnhet el és nem állhat vissza).
- **FR-011**: Az `rejected` elemeket a detektor újrafuttatása NEM hozhatja létre újra ugyanabból a forrásból/személyből.
- **FR-012**: A jóváhagyási állapotot és a szerkesztői döntést meg KELL őrizni a detektorok újrafuttatásai és az adatbázis-migrációk során (alkotmány VII. — szerkesztői döntés megőrzése).

### Key Entities *(include if feature involves data)*

- **Detektált személyi változás**: egy hírből kiolvasott lemondás/kirúgás/felmentés (név, pozíció, intézmény, típus, dátum, megbízhatóság) — jóváhagyási állapottal.
- **Detektált médiaesemény**: médiamegszűnés vagy tömeges leépítés — jóváhagyási állapottal.
- **Detektált bírósági esemény**: ítélet vagy előzetes letartóztatás — jóváhagyási állapottal.
- **Kiemelt figyelt személy**: a monitorozott személyek halmaza (8 lemondásra felszólított + 10 galéria-személy), amely kötelező review-t vált ki.
- **Szerkesztői döntés**: az elfogad/eldob művelet, amely az állapotot `approved`/`rejected`-re állítja.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A nyilvános oldalon NEM jelenik meg egyetlen kiemelt személyt érintő állítás sem szerkesztői jóváhagyás nélkül (0 ilyen eset).
- **SC-002**: A nyilvánosan látható elemek 100%-a vagy automatikusan jóváhagyott (≥0.90, nem-kiemelt), vagy szerkesztő által kifejezetten jóváhagyott.
- **SC-003**: A szerkesztő egy `pending` elemről elemenként néhány kattintással tud dönteni (megtekintés + elfogad/eldob).
- **SC-004**: Ugyanaz a személy nem jelenik meg kétszer ugyanabból a hírhullámból (a duplikáció-arány ~0 az időablakon belül azonos személyre).
- **SC-005**: A funkció élesítésekor a jelenlegi nyilvános adat nem vész el és nem áll vissza (a meglévő 20 lemondás / 18 médiabejegyzés / 12 bírósági bejegyzés továbbra is látszik).

## Assumptions

- A megbízhatósági pontszám (0–1) a már meglévő LLM-detektoroktól érkezik, amelyek minden találatnál visszaadnak egy `confidence` értéket.
- A kiemelt figyelt személyek halmaza = a már alkalmazásban definiált 8 „lemondásra felszólított" + 10 galéria-személy; a névillesztés ezekhez normalizált (kis-/nagybetű, szóközök) név-token alapon történik.
- Az admin hitelesítés már létezik (a jelenlegi admin felület), ide épül a review-oldal.
- A duplikáció-szűrés időablaka alapból 30 nap, hacsak másképp nem rendelkezünk.
- A több személyt érintő tömeges esemény egyetlen, csoportos bejegyzésként kerül a review-sorba (a szerkesztő bonthatja/dönthet).
- Az LLM-szolgáltató már kapcsolható (LangDock + `gpt-5-chat-latest`); ez a funkció a meglévő detektor-kimenetre épül, nem változtatja meg magát a modellhívást.
