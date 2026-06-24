# Feature Specification: Make.com Facebook → SocialPost automatizáció

**Feature Branch**: `002-make-facebook-social-feed`  
**Created**: 2026-06-24  
**Status**: Clarified  

## Clarifications

### Session 2026-06-24

- Q: Van-e már `visible`/`hidden` mező a SocialPost táblában? → A: Nincs — új `hidden` boolean mezőt kell hozzáadni (default: false = látható)
- Q: Polling vagy webhook? → A: Polling, 15 percenként
- Q: Kulcsszavas szűrés vagy admin moderáció? → A: Nincs szűrés — minden poszt automatikusan megjelenik, admin el tudja rejteni az egyes posztokat
- Q: Videó támogatás? → A: Ha a poszt videót tartalmaz, a videó nézőképe (thumbnail) kerüljön be; maga a videó lejátszása opcionális
- Q: Melyik FB oldalakat figyelje? → A: Egy külön táblában/listában konfigurálható, nem hardcode-olva

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Facebook poszt automatikusan megjelenik a weboldalon (Priority: P1)

Egy figyelt Facebook oldal (pl. Vastagbőr) új posztot tesz közzé. A poszt 15 percen belül, emberi beavatkozás nélkül megjelenik a Kegyencjárat weboldal social feed szekciójában. A poszt egy kattintható kártya, amely az eredeti Facebook posztra visz.

**Why this priority**: Ez az egész feature alapértéke.

**Independent Test**: Közzéteszünk egy teszposztot a figyelt oldalon, 15 percen belül megjelenik a weboldalon, és a kártya kattintva az FB posztra mutat.

**Acceptance Scenarios**:

1. **Given** egy figyelt FB oldalon új poszt jelenik meg, **When** a Make.com polling lefut, **Then** a poszt megjelenik a weboldalon (szöveg, szerző, dátum, kép/thumbnail, link)
2. **Given** a poszt videót tartalmaz (kép nélkül), **When** bekerül a DB-be, **Then** a videó nézőképe jelenik meg borítóképként
3. **Given** az automatizáció lefutott és beírta a posztot, **When** a felhasználó a weboldalon a kártyára kattint, **Then** az eredeti Facebook posztra jut

---

### User Story 2 — Több Facebook oldal figyelése konfigurálható listából (Priority: P2)

A rendszergazda egy táblában/listában megadja, melyik Facebook oldalakat kell figyelni. A Make.com ez alapján figyeli az összes megadott oldalt.

**Why this priority**: A site értéke a forrásszámmal nő; rugalmasan bővíthető legyen.

**Independent Test**: Egy második FB oldalt hozzáadunk a figyelt listához, és annak posztjai is megjelennek a weboldalon.

**Acceptance Scenarios**:

1. **Given** több oldal szerepel a figyelési listában, **When** bármelyiken új poszt jelenik meg, **Then** az adott oldal nevével együtt kerül be a DB-be és jelenik meg a weboldalon
2. **Given** ugyanaz a poszt már egyszer feldolgozva, **When** az automatizáció újra fut, **Then** duplikátum nem keletkezik

---

### User Story 3 — Admin el tud rejteni posztokat (Priority: P3)

A szerkesztő az admin felületen egy posztot elrejthet, ha az nem kívánt. A többi poszt változatlanul megjelenik.

**Why this priority**: Biztonsági háló — ha valami nem megfelelő tartalom kerül be, gyorsan kezelhető.

**Independent Test**: Egy beérkezett posztot az adminból elrejtünk; a weboldal frissítése után eltűnik, a többi megmarad.

**Acceptance Scenarios**:

1. **Given** egy automatikusan bekerült poszt nem kívánatos, **When** admin beállítja `hidden = true`, **Then** a poszt nem jelenik meg a weboldalon
2. **Given** egy poszt rejtett, **When** admin visszaállítja `hidden = false`-ra, **Then** ismét megjelenik

---

### Edge Cases

- Mi történik, ha a poszt sem képet, sem videót nem tartalmaz (csak szöveg)?
- Mi történik, ha a Make.com polling leáll — az azalatt megjelent posztok elvesznek?
- Kezel-e duplikációt az automatizáció, ha ugyanaz a poszt szerkesztve lesz Facebookon?
- Mi van, ha egy figyelt FB oldal megszűnik vagy privát lesz?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A Make.com KELL, hogy 15 percenként polling-gal ellenőrizze az összes figyelt Facebook oldalt
- **FR-002**: Minden új Facebook posztot automatikusan fel KELL venni a SocialPost táblába: szerző neve, poszt dátuma, tartalom szövege, poszt URL, kép URL (vagy videó thumbnail URL)
- **FR-003**: Ha a poszt videót tartalmaz, a videó nézőképét (thumbnail) KELL kép URL-ként tárolni
- **FR-004**: A SocialPost táblába kerülő posztok alapértelmezés szerint láthatók (hidden = false)
- **FR-005**: A SocialPost táblának KELL tartalmaznia egy `hidden` boolean mezőt (új mező, DB migráció szükséges)
- **FR-006**: Az admin felületen KELL lehetőség legyen egy poszt `hidden` értékét átállítani — a weboldal ebből szűr
- **FR-007**: A figyelt Facebook oldalak listáját KELL egy konfigurálható helyen (pl. Make.com scenario, vagy Supabase tábla) tárolni — ne legyen hardcode-olva
- **FR-008**: A rendszer NEM KELL duplikátumokat létrehozzon — ugyanaz a Facebook poszt csak egyszer kerülhet be
- **FR-009**: Minden poszt kártya a weboldalon kattintható CTA KELL legyen, amely az eredeti Facebook posztra mutat

### Key Entities

- **SocialPost**: Egy Facebook posztot reprezentál. Mezők: szerző, tartalom, poszt URL, kép/thumbnail URL, forrás oldal neve, megjelenési dátum, `hidden` boolean
- **Figyelt Facebook oldal**: A Make.com-ban konfigurált forrás (oldal neve + azonosítója)
- **Make.com scenario**: Az automatizáció, amely 15 percenként fut és a Facebook → Supabase adatfolyamot vezérli

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Egy új Facebook poszt 15 percen belül megjelenik a weboldalon emberi beavatkozás nélkül
- **SC-002**: Duplikátumok száma: 0
- **SC-003**: Admin 1 kattintással el tud rejteni vagy visszaállítani egy posztot
- **SC-004**: Új FB oldal hozzáadása a figyelési listához legfeljebb 5 perc (nem igényel fejlesztőt)
- **SC-005**: A Make.com beállítása legfeljebb 60 perc alatt elvégezhető nem-fejlesztő számára is
- **SC-006**: Az automatizáció havi futási költsége a Make.com ingyenes keretén belül marad

## Assumptions

- A Make.com Facebook modulja hozzáfér a figyelt oldalak nyilvános posztjaihoz
- A SocialPost tábla már létezik a Supabase-ben a jelenlegi mezőkkel (szerző, dátum, tartalom, URL, kép URL)
- A weboldal social feed szekciója már működik és a SocialPost tábla alapján jeleníti meg a tartalmakat
- A Facebook oldalak nyilvánosak — nem szükséges oldal-adminisztrátori hozzáférés
- A Make.com ingyenes csomagja elegendő (~5-20 poszt/nap × figyelt oldalak száma)
- Kommentek, reakciók szinkronizálása nem szükséges — csak a fő posztok kellenek
- A videó natív lejátszása (beágyazott player) nem cél, csak a thumbnail + link az FB-ra
