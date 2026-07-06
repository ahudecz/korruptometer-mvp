# /adatbázis személy-profil audit és rollup rendszer (2026-07-05 → 07-06)

Ezt a Claude Code session írta (Maró kérésére), aki nem ismeri a repo többi
párhuzamos munkáját — ha a `ScandalCatalog`/`Investigation` adatokban azóta
más is változtatott, ezt a leírást a jelen kód (nem a jelen adat) alapján
olvasd. Cél: hogy Hudi (vagy a Hudi oldalán dolgozó Claude) gyorsan lássa,
**mi történt, miért, és mit KELL tudni, mielőtt a saját lokál DB-jével
összefésüli.**

## TL;DR

- **Nincs adatbázis-séma/migráció-változás.** Minden itt felsorolt fix
  **kód szinten** (`case-detail-config.ts` override-réteg) történt, ami a
  meglévő `scandalKey` string-eket célozza. Ez azt jelenti: bármelyik
  `ScandalCatalog`-példányra (a te lokál DB-dre is) rááll, amíg abban
  ugyanazok a `scandalKey`-ek léteznek (pl. `mnb-botrany`,
  `rezsibiznisz-energiaszolgaltatas` stb.) — nincs szükség adat-migrációra.
- **Volt egy DB-írási kísérlet is** (új `Investigation`/`DamageEstimate` sorok
  a `KmdbArticle` korpuszból, ld. lent) — ez **teljesen vissza lett vonva**,
  a lokál DB-m most pontosan ugyanaz a 937 `ScandalCatalog` sor, ami a munka
  elején is volt. Ha a te DB-d ettől független, nincs teendő; ha ugyanabból
  a snapshotból indultatok, biztonságosan összefésülhető.

## Mi indította el ezt a munkát

Maró észrevette, hogy a `/adatbazis/ner-milliardok` oldal (Mészáros Lőrinc
"összesített" ügye) valójában egy durva, átfedő sajtóbecslés volt, ami
dupláz​ta a más néven már külön szereplő, tételes ügyeket. Ebből nőtt ki egy
szélesebb audit: **10 kiemelt személy (galéria) + 27 további név**
`ScandalCatalog`-adatainak átvizsgálása duplikátum/téves-attribúció/durva-becslés
szempontból, majd egy új "X összes ügye" felület megépítése.

## 1. Új felület: person-rollup oldalak

- **`app/apps/web/app/_home/person-rollup-config.ts`** — konfiguráció
  személyenként: `slug`, `personName` (pontos `ScandalCatalog.person`
  string), `excludeIds` (l. lent), opcionális kézzel írt `writeups` (csak
  Mészárosnál, ld. `meszaros-osszes-ugye-content.ts`).
- **`app/apps/web/app/adatbazis/szemely/[slug]/page.tsx`** — generikus
  "X összes ügye" oldal: élőben lekérdezi a `ScandalCatalog`-ot
  `person = personName`-re, kizárja az `excludeIds`-t, top10 + "további N ügy"
  lista.
- **`app/apps/web/app/adatbazis/meszaros-lorinc-osszes-ugye/page.tsx`** —
  ugyanaz, de Mészárosnak megmaradt a saját, korábban linkelt URL-je (nem lett
  átköltöztetve `/adatbazis/szemely/meszaros-lorinc`-re); a `person-rollup-config`
  `excludeIds`-ét importálja, nincs duplikált lista.
- **`app/apps/web/app/adatbazis/page.tsx`**: "Kiemelt személyek" sáv (6 fő:
  Mészáros, Tiborcz, Matolcsy, Rogán, Orbán Viktor, Balásy — élő, korrigált
  összeggel, `excludeIds`-t figyelembe véve), + a fő táblázat most tiszteletben
  tartja a `hideAutoDamage` override-ot (korábban csak az egyedi oldalon
  működött — enélkül a "Kár szerint" rendezés a felszínre hozta volna az
  elrejtett/hibás számokat).
- **`app/apps/web/app/galeria/[id]/page.tsx`**: kereszt-link doboz a
  megfelelő person-rollup oldalra, ha van `PERSON_ROLLUPS`-bejegyzés az adott
  galéria-id-hez.

## 2. `case-detail-config.ts` — talált és javított hibák

Az override-réteg (`CaseDetailOverride`, `scandalKey`-vel kulcsolva) már
létezett, csak kibővítettem. Új mezők: `hideVideo` (a személyenkénti
YouTube-videó — `case-video-registry.ts` — néha másik ügyről szól, mint az
adott oldal). Konkrét, forrásból ellenőrzött hibák (ld. a fájlban a
"2026-07-05" dátumozású kommenteket):

| scandalKey | Hiba típusa | Mit jelent |
|---|---|---|
| `mnb-botrany` | **Rossz személy** | A cikk (Telex, ellenőrizve) Matolcsy Györgyről/Ádámról szól, NEM Mészárosról — a `ScandalCatalog.person` mégis Mészárost mutatta (article-count-alapú tie-break hiba). Kizárva Mészáros összegéből. |
| `matolcsy-global-trade-centre-mnb-vagyonkezeles`, `matolcsy-mnb-gtc-ingatlan-adossag`, `matolcsy-dla-piper-127mrd` | **Duplikátum/felfújt szám** | Mindhárom ugyanazt a Pallas Athéné/PADME ~270 Mrd Ft-os veszteséget (vagy a Kecskemét/Optima 127,5 Mrd-os kötvényügyletet) mondja el más szögből, más (nagyobb) számmal. Kizárva Matolcsy összegéből. |
| `rezsibiznisz-energiaszolgaltatas` | **Téves cím** | Egy korábbi override tévesen "Elios Zrt."-nek nevezte át — valójában ALTEO energiacégről szól, semmi köze az Eliós közvilágítási botrányhoz (`tiborcz-elios-innovativ`, külön, valódi ügy). |
| `leisztinger-honved`, `bosnyak-teri-beruhazas`, `mcc-mol-osztalek`, `dolomit-meszaros`, `balasy-gyula-ugy`, `familiabar-rogan-balasy-propagandapenz`, `balasy-gyula-lounge-communications`, `fidesz-kampanyarc-tamogatas` | **Rossz személy** | Mindegyiknél a klaszter legnagyobb (fejléc-) tétele valójában más emberhez tartozik, mint akinek a neve alatt fut az oldal. |
| `habony-eszak-macedonia-eximbank`, `orban-eszak-macedonia-500meuro` | **Hitel ≠ kár** | Állami hitel névértéke (Észak-Macedónia), nem korrupciós kár. |
| `kosa-lajos-ugy` | **Rossz személy (forrás szerint)** | A kárbecslés saját jegyzete szerint Kósa Lajos tanúként sem szerepel abban az ügyben, amiből a szám származik. |
| `bayer-elohely-irokakadempia` | **Rossz személy + torz cím** | Bayer Zsoltról szól, nem Semjén Zsoltról; "Zsolték" → "Zsolták" auto-tisztítási hiba. |
| `bethlen-alap-kasszaturites`, `ner-alapitvanyi-vagyon` | **Intézményi összeg ≠ kár** | Teljes, sok éves/sok kedvezményezettes alapítványi kiosztás, nem egyetlen ügyhöz köthető szám. |
| 3 db `gattyan-gyorgy-adougy`, `hanko-balazs-nka-tamogatas`, `barta-eke-nagyper-miniszterium` | **Szó szerinti duplikátum** | Ugyanaz az ügy két `scandalKey` alatt — redirect + kizárás. |

Mindegyiknél `hideAutoDamage: true` + `damageText` (őszinte magyarázat) —
**a nyers `damage_huf` a DB-ben változatlan marad**, csak a megjelenítés
(és a person-rollup összegzés `excludeIds`-en keresztül) korrigálja.
`RETIRED_REDIRECTS` az `[id]/page.tsx`-ben: a duplikátumok URL-je most a
megmaradó oldalra irányít (307).

## 3. A KmdbArticle-kísérlet — EZ VISSZA LETT VONVA, ne építs rá

**`app/packages/db/src/catalog-kmdb-person-extract.ts`** — új script, ami a
`KmdbArticle` táblából (a 64k-soros, teljes K-Monitor HuggingFace-korpusz,
amit **semelyik meglévő `catalog-*.ts` script nem dolgoz fel** — azok mind a
most már ÜRES `KMonitorArticle` táblát olvassák) egy Haiku-hívással
klaszterez + kárt becsül egy adott személyre. `--batch <usd_cap>` módban
végigmegy egy 27 fős listán (Hamar Endre kivételével), költség-limitig.

**Teszt Semjén Zsolttal (132 cikk, $0.05)**: 18 ügyből 16 jó volt, 2 (nagy,
intézményi összegű) hibás — ezeket kézzel javítottam (ld. fenti táblázat).

**Utána lefuttattam `--batch 10`-zel mind a 27 emberre.** Ez **rossz ötlet
volt méretben**: a nagyobb, összetettebb embereknél (Orbán, Rogán, Balásy,
Tiborcz) a modell sokkal gyakrabban adott vissza intézményi/teljes-korszakos
összegeket konkrét kár helyett, **és egy nyilvánvaló hallucinációt (15
billió Ft egy autópálya-koncesszióra)**. A script közben összeomlott (egy
hibás JSON-válasz miatt) Orbán Viktornál, $3.40-nél; Mészáros el sem
kezdődött. **A teljes batch-eredményt (453 Investigation + 223
DamageEstimate sor) töröltem** — a lokál DB most pontosan olyan, mint a
munka kezdetén (937 `ScandalCatalog` sor).

**Ha ezt folytatni akarjátok**, a script újrafelhasználható, de a promptot
erősíteni kell, mielőtt nagyobb embereken/nagyobb $-keretben újra fut:
- Explicit tiltás (jelenleg is benne van, de nem elég erős): "SOHA ne egy
  intézmény/alap teljes, sok éves összköltését/vagyonát add meg kárként."
- Utólagos automata sanity-check: minden ≥50 Mrd Ft-os új tétel kerüljön
  külön review-ra, mielőtt élesbe kerül (pl. egy külön "pending" flag,
  amit valaki jóváhagy).
- Fontolja meg kisebb kötegméretet (jelenleg 300 cikk/hívás) a nagy
  embereknél, hátha a rövidebb kontextus jobb ítéletet ad.

## 4. Mellékesen javítva

- **`app/apps/web/src/lib/db.ts`**: a `getDb()` cache `globalThis`-re került
  (HMR-biztos) — dev módban minden fájlmentés új 10-kapcsolatos poolt
  szivárgott, ami többször betöltötte a Postgres 100-as limitjét
  ("too many clients already"). Ez a session alatt ismétlődően lebénította
  a lokál szervert.
- **`app/packages/shared/src/format.ts`**: hiányzó `fmtFtParts` export
  pótolva (a `FtValue` komponens ezt hívta, de sosem létezett — típushiba
  volt, nem futásidejű, de blokkolta a típusellenőrzést).

## Amit MÉG NEM csináltunk meg

- A teljes MNB/Pallas Athéné hálózatot **nem** bogoztuk szét
  tényellenőrzött, végleges formában — csak a legnyilvánvalóbb
  átfedéseket zártuk ki. Van még benne kockázat (pl. `matolcsy-neumann-egyetem`
  egyik al-nyomozása valószínűleg részhalmaza a `leszak-neumann-egyetem`
  127,5 Mrd-jának, de ezt nem zártuk ki, mert az összeg kicsi/bizonytalan).
- A 27 emberből csak Semjénre futott le ténylegesen a KmdbArticle-kinyerés
  (aztán az is vissza lett vonva) — a többi 26 valós lefedettsége a
  `KmdbArticle`-korpuszból **még mindig hiányos** (a régi, kisebb
  `KMonitorArticle`-alapú pipeline eredménye van csak bent).
- Nincs "person" mező felülírási lehetőség a `CaseDetailOverride`-ban — ahol
  a hibás attribúció az EGYED oldal hőscímkéjét/fotóját is érinti (pl.
  `garancsi-kazino` Rogán neve alatt fut), ott csak a rollup-összegből van
  kizárva, az egyedi oldal person-mezője még mindig a rossz nevet mutatja.
