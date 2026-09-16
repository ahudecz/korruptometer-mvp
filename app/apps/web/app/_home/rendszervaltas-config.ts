// ─────────────────────────────────────────────────────────────────────────────
// „Rendszerváltás barátai — Dicsőségfal" (/rendszervaltas)
//
// Miért létezik ez az oldal (2026-09-16, user kérés):
// a Galéria (/galeria) a NER tíz kegyencének arcképcsarnoka. Ez a lap annak a
// pontos TÜKÖRKÉPE: azok, akiknek részben a 2026. április 12-i fordulatot
// köszönhetjük — oknyomozó újságírók, adat-aktivisták, képviselők, civil
// műhelyek. Ugyanaz a vizuális nyelv, fordított előjellel.
//
// SEO-alap (Semrush, HU adatbázis, 2026-09):
//   rendszerváltás          3 600 / KD 17  ← EZ A HUB CÉLSZAVA
//   hadházy ákos           40 500 / KD 39
//   partizán               33 100 / KD 45  (+ „partizán youtube" 8 100)
//   puzsér róbert          18 100 / KD 49
//   márki zay péter         8 100 / KD 48
//   jámbor andrás           6 600 / KD 41
//   gulyás márton           6 600 / KD 24  ← a legjobb arány a személyek közt
//   carson coma             9 900 / KD 46  (zenei intent!)
//   átlátszó.hu             4 400 / KD 50  (navigációs — a saját márkájuk)
//   k-monitor / kmonitor    1 000 / KD 21
//   giorgio                   720 / KD 30  (= Fekete Giorgio, Carson Coma)
//
// AMIT A NYERS VOLUMEN FÉLREVEZETŐEN MUTAT — ne erre tervezzünk:
//  • „átlátszó" 14 800: ennek a java a MELLÉKNÉV (átlátszó ponyva 880,
//    fogszabályzó 880, melltartó, szemüveg). A márkára ténylegesen 4 400 megy,
//    navigációs szándékkal: az atlatszo.hu-t akarják elérni, nem minket.
//  • „juhász péter" 22 200: döntően NEM Juhi. „juhász péter pál" 9 900 a Szőlő
//    utcai javítóintézet igazgatója, + Méliusz Juhász Péter könyvtár 1 600, +
//    egy plasztikai sebész. (A Szőlő utca külön oldalt érdemel — de nem ezt.)
//  • „carson coma" 9 900: 100% zenei intent (koncert 1 900, tagjai 720,
//    dalszövegek). Szerkesztőileg idevaló, SEO-hozamot ne várjunk tőle.
//
// TARTALMI SZABÁLYOK (az NKA-aloldalak szabályaival egyezően):
//  1. Ez dicséret, nem vád — de ettől még MINDEN állítás ellenőrzött és
//     forrásolható. Élő emberekről írunk.
//  2. Semmilyen magánéleti adat (házastárs, gyerek, vagyon) nem kerül ide,
//     még akkor sem, ha épp arra keresnek sokan. A hosszú farok egy része
//     pletyka-intent — azt nem szolgáljuk ki.
//  3. NER-lapok sosem forrásként (l. isNerOutlet()).
//  4. A kártyák címe hyphens:auto + overflow-wrap:break-word (l. a
//     kártya-cím tördelési szabályt).
// ─────────────────────────────────────────────────────────────────────────────

export type FeltaroKind = 'person' | 'org';

/** A fal három blokkja (user kérés, 2026-09-16: a sorrend ne legyen random).
 *  A `kind` ettől független: az a schema.org típust dönti el (Person vs
 *  Organization), a `group` pedig azt, melyik rács alá kerül a kártya. */
export type FeltaroGroup = 'person' | 'media' | 'channel';

export const GROUP_META: Record<FeltaroGroup, { title: string; anchor: string; intro: string }> = {
  person: {
    title: 'Személyek',
    anchor: 'szemelyek',
    intro:
      'Képviselők, újságírók és szakértők, akik a saját nevükkel álltak ki egy-egy ügy mögé. Közös bennük, hogy nem egyszeri leleplezést csináltak, hanem évekig ugyanazt a témát követték — akkor is, amikor épp nem volt belőle hír.',
  },
  media: {
    title: 'Médiumok és műhelyek',
    anchor: 'mediumok',
    intro:
      'Szerkesztőségek, adatbázisok és civil szervezetek. Ezek adják a feltárás infrastruktúráját: itt van az a jogi, technikai és anyagi háttér, ami egy hónapokig tartó nyomozáshoz vagy egy évekig húzódó adatperhez kell.',
  },
  channel: {
    title: 'Facebook- és YouTube-csatornák',
    anchor: 'csatornak',
    intro:
      'A nagy elérésű közösségi oldalak és videós csatornák. Ritkán ők ássák ki az ügyet — a dolguk az, hogy a kiásott ügy eljusson százezrekhez, olyan emberekhez is, akik hírportált soha nem nyitnak meg.',
  },
};

/** Egy bekezdésben inline linkké alakítandó szövegrészlet. A `text`-nek SZÓ
 *  SZERINT elő kell fordulnia a bekezdésben, különben nem lesz link (a
 *  bekezdés attól még hibátlanul megjelenik). Ugyanaz a minta, mint az
 *  ügy-aloldalaknál. */
export type InlineLink = { text: string; href: string; external?: boolean };

export type Feltaro = {
  /** URL-szegmens a majdani profiloldalhoz: /rendszervaltas/<id> */
  id: string;
  name: string;
  kind: FeltaroKind;
  /** Melyik rács alá kerül. L. GROUP_META. */
  group: FeltaroGroup;
  /** Kártya-alcím: mi ő egy sorban (nem méltatás, tényleírás). */
  role: string;
  /** Kártya-badge — a Galéria „ELŐZETESBEN" bélyegének fordítottja. */
  badge: string;
  /** Egy mondat: konkrétan mit köszönhetünk neki. Ez a kártya hookja. */
  tagline: string;
  /** Fotó. A user tölti fel ide: /public/images/rendszervaltas/<id>.webp
   *  Amíg nincs, a kártya monogramos helyőrzőt mutat (ugyanaz a viselkedés,
   *  mint a /lemondasok watchlist-kártyáinál). */
  photo?: string;
  photoCredit?: string;
  /** A rács alatti cornerstone-szöveg saját H2-szakasza. A `video` a
   *  bekezdések UTÁN jelenik meg, beágyazott YouTube-lejátszóként. */
  section: {
    heading: string;
    paragraphs: string[];
    links?: InlineLink[];
    video?: { id: string; label?: string; title: string; summary?: string };
  };
  /** Mire célozzon majd a SAJÁT profiloldala (Semrush, HU, 2026-09). */
  targetKeyword?: { phrase: string; volume: number; kd: number };
  /** Belső linkek a meglévő tartalmainkhoz — hub & spoke. */
  related?: { label: string; href: string }[];
  /** Van-e már élő profil-aloldala. Amíg false, a kártya nem kattintható,
   *  és a sitemapbe sem kerül be. Így a rács már most kitehető élesre
   *  anélkül, hogy 15 db 404-et linkelnénk. */
  live?: boolean;
};

export const RENDSZERVALTAS_HUB = {
  /** <title> — a layout „— Kegyencjárat"-ot fűz utána. */
  seoTitle: 'Rendszerváltás 2026: akiknek köszönhetjük',
  seoDescription:
    'Kik tárták fel azokat az ügyeket, amelyek a 2026-os rendszerváltáshoz vezettek? Oknyomozó újságírók, adat-aktivisták és civil műhelyek egy oldalon, ügyekkel.',
  /** H1 — a user által kért vizuális cím. A fő kulcsszó benne van. */
  h1: 'Rendszerváltás barátai — Dicsőségfal',
  eyebrow: '08 / Dicsőségfal',
  publishedAt: '2026-09-16',
  updatedAt: '2026-09-16',
  lead:
    'A 2026. április 12-i rendszerváltás nem egyetlen nap alatt történt meg. Évekig tartó, aprómunkás feltáró munka előzte meg: közbeszerzési adatbázisok átfésülése, elutasított adatigénylések miatt indított perek, offshore cégláncok kibogozása, olyan riportok, amelyekért kirúgás, lehallgatás vagy feljelentés járt. Ezen az oldalon azok vannak összegyűjtve, akik ezt a munkát elvégezték — újságírók, adat-aktivisták, képviselők, zenészek és civil műhelyek. A Kegyencjárat adatbázisában szereplő ügyek túlnyomó többsége az ő munkájukból származik: mi rendszerezzük, ők tárták fel.',
  /** A rács fölötti bevezető. Külön mező, mert ez a lap legolvasottabb
   *  bekezdése: ez dönti el, hogy az olvasó legörget-e a hosszú szövegig. */
  gridIntro: [
    'Egy korrupciós ügy soha nem egyetlen ember érdeme. Mire egy név eljut odáig, hogy kimondják a híradóban, addigra valaki átrágta magát több ezer oldal közbeszerzési iraton, valaki más három évig pereskedett egy elutasított adatigénylésért, egy harmadik pedig érthető mondatokká fordította az egészet. Ez a fal nekik szól.',
    'A lenti névsor nem rangsor, és nem is teljes — folyamatosan bővül. Három blokkra bontottuk, mert háromféle munkáról van szó. A **személyek** a saját nevüket adták egy-egy ügyhöz, és évekig kitartottak mellette. A **médiumok és műhelyek** azt az infrastruktúrát tartják fenn — ügyvédeket, adatbázisokat, hónapokig fizetett újságírói munkaidőt —, ami nélkül egy mélyfúrás elindulni sem tudna. A **Facebook- és YouTube-csatornák** pedig azt csinálják, amit a legkönnyebb lebecsülni és a legnehezebb pótolni: elviszik a kész sztorit több százezer emberhez, olyanokhoz is, akik hírportált soha nem nyitnak meg.',
    'A Kegyencjárat adatbázisa ennek a munkának a másodlagos feldolgozása. Egyetlen ügyet sem mi tártunk fel: mi összegyűjtjük, rendszerezzük, összekötjük és követhetővé tesszük azt, amit ők kiástak. Ezért van ez az oldal — és ezért van a forrásmegjelölés minden egyes sor mellett.',
  ],
  /** A bevezető ZÁRÓ eleme, közvetlenül a névsor előtt (user kérés,
   *  2026-09-16). Nem illusztráció: ez az érzelmi felütés, amiről az
   *  egész fal szól — a rendszerváltás utáni első reggel. A szöveg
   *  szándékosan a listába vezet át. */
  heroVideo: {
    id: 'FjFtiTu9LOE',
    label: '2026. április 13. — az első reggel',
    title: 'Jóóóó reggelt MAGYARORSZÁÁÁÁG!',
    summary:
      'Ilyen volt kimenni az utcára azon a reggelen. Ez a videó nem oknyomozó riport és nem elemzés — ez a jutalomjáték. Csakhogy április 13-a nem magától virradt fel: hogy azon a reggelen ezt lehessen érezni, előtte évekig kellett valakinek közbeszerzési iratokat olvasnia hajnalig, pereket vinnie egy megtagadott adatért, kamerát tartania ott, ahol nem szívesen látták, és kimondania olyan mondatokat, amelyeknek akkor még ára volt. Ők jönnek most — név szerint.',
  },
} as const;

export const FELTAROK: Feltaro[] = [
  {
    id: 'hadhazy-akos',
    name: 'Hadházy Ákos',
    kind: 'person',
    group: 'person',
    role: 'független országgyűlési képviselő',
    badge: 'KÖZBESZERZÉS-VADÁSZ',
    tagline:
      'Évekig egyesével fésülte át a közbeszerzési kiírásokat, és több száz feljelentést tett — a nyilvánosságra hozott iratok nélkül a NER-ügyek fele ma sem lenne dokumentálva.',
    targetKeyword: { phrase: 'hadházy ákos', volume: 40500, kd: 39 },
    section: {
      heading: 'Hadházy Ákos — aki egyesével olvasta végig a közbeszerzéseket',
      paragraphs: [
        'Hadházy Ákos állatorvosként és helyi politikusként kezdte: Szekszárdon a Fidesz színeiben volt megyei közgyűlési tag, majd amikor a saját pártján belüli közpénzügyekről kezdett beszélni, kilépett. 2016-tól az LMP társelnöke, 2018 óta pedig független országgyűlési képviselő.',
        'A munkamódszere nem a leleplező bejelentőkre épült, hanem a nyilvános adatokra: közbeszerzési értesítők, cégbírósági iratok, támogatási listák, EU-s pályázati adatbázisok. Ezekből állította össze azoknak az ügyeknek a sorozatát, amelyek később a Kegyencjárat adatbázisának is a gerincét adják — a felcsúti kisvasúttól a látványberuházásokon át a miniszteri keretekből kiosztott pénzekig. Több száz feljelentést tett; ezek jelentős része akkor elakadt, a nyomozati iratok viszont megmaradtak.',
        'Emellett éveken át rendszeres utcai demonstrációkat szervezett, és az általa nyilvánosságra hozott dokumentumokat teljes terjedelmükben tette közzé, nem csak idézte őket. Ez a gyakorlat tette lehetővé, hogy az ügyek később függetlenül is ellenőrizhetők legyenek.',
      ],
    },
    related: [
      { label: 'Feljelentések nyilvántartása', href: '/adatbazis' },
      { label: 'Kiemelt ügyek', href: '/ugyek' },
    ],
  },
  {
    id: 'gulyas-marton',
    name: 'Gulyás Márton',
    kind: 'person',
    group: 'person',
    role: 'a Partizán alapítója, műsorvezető',
    badge: 'NYILVÁNOS VITA',
    tagline:
      'Kikényszerítette, hogy a hatalom képviselői élő adásban, vágatlanul válaszoljanak — és közösségi finanszírozásból épített rá egy egész csatornát.',
    targetKeyword: { phrase: 'gulyás márton', volume: 6600, kd: 24 },
    section: {
      heading: 'Gulyás Márton — aki visszahozta a vágatlan interjút',
      paragraphs: [
        'Gulyás Márton a Krétakör színházi műhelyéből indult, majd a Közös Ország Mozgalom egyik arca lett. A legnagyobb hatású munkája viszont a Partizán: egy közösségi finanszírozásból fenntartott videós műhely, amely hosszú, vágatlan, élőben közvetített beszélgetésekre épül.',
        'A formátum önmagában is politikai tett volt egy olyan médiakörnyezetben, ahol a közszereplők többsége már csak előre egyeztetett kérdésekre válaszolt. A Partizán adásaiban a kérdezett nem tudta lekapcsoltatni a mikrofont, és a néző maga döntötte el, mit lát: a teljes beszélgetés elérhető maradt.',
        'A csatorna emellett rendszeresen közölt saját oknyomozó anyagokat és élőben közvetített tüntetéseket, parlamenti eseményeket, választási éjszakákat — gyakran akkor, amikor más szerkesztőség nem volt jelen.',
      ],
    },
    related: [{ label: 'Videóriportok és podcastok', href: '/podcastok' }],
  },
  {
    id: 'partizan',
    name: 'Partizán',
    kind: 'org',
    group: 'media',
    role: 'közösségi finanszírozású videós műhely',
    badge: 'FÜGGETLEN CSATORNA',
    tagline:
      'Nézői támogatásból épült fel akkorára, hogy egy választási éjszakán nagyobb közönséget ért el, mint több országos televízió.',
    targetKeyword: { phrase: 'partizán', volume: 33100, kd: 45 },
    section: {
      heading: 'Partizán — a nézőkből felépített szerkesztőség',
      paragraphs: [
        'A Partizán azt bizonyította be, hogy hirdetői és állami pénz nélkül, kizárólag a nézők havi támogatásából is fenn lehet tartani egy teljes szerkesztőséget. Ez a finanszírozási forma nem mellékes részlet: pontosan azt a nyomásgyakorlási felületet szüntette meg, amellyel a hirdetéspiacon keresztül a legtöbb más médiumot kezelni lehetett.',
        'A csatorna műsorai között politikai interjúk, közéleti vitaműsorok, tényfeltáró riportok és élő közvetítések egyaránt szerepelnek. A YouTube-alapú terjesztés miatt egy-egy adás elérése független volt attól, hogy a nagy hírportálok átvették-e.',
        'A Kegyencjárat podcast- és videórovata rendszeresen hivatkozik partizános anyagokra: számos olyan ügy van az adatbázisunkban, amelynek az első részletes, kontextusba helyezett feldolgozása itt jelent meg.',
        'A műhely súlyát egyetlen adás mutatta meg a legélesebben. 2024 februárjában egy addig ismeretlen interjúalany ült be a Partizán stúdiójába: Varga Judit volt igazságügyi miniszter exférje. Az adás alatt hetvenezren nézték élőben, néhány óra alatt félmillióan, azóta pedig milliós nagyságrendben — és a benne elhangzottakból indult el az a politikai folyamat, amely végül a 2026-os fordulathoz vezetett. Az interjúalanyt Magyar Péternek hívják.',
      ],
      video: {
        id: '8cJulnczg2E',
        label: 'Partizán · 2024. február 11.',
        title: 'EXKLUZÍV: Varga Judit exférje a pedofilbotrányról, Rogán Antalról és a fideszes törésvonalakról',
        summary:
          'A teljes, vágatlan interjú — az a beszélgetés, amely után a magyar közélet nem volt ugyanaz. Pontosan ezért működik a formátum: itt nem egy percnyi vágott idézet ment ki, hanem több óra, amelyet mindenki maga ellenőrizhetett.',
      },
    },
    related: [{ label: 'Videóriportok és podcastok', href: '/podcastok' }],
  },
  {
    id: 'atlatszo',
    name: 'Átlátszó',
    kind: 'org',
    group: 'media',
    role: 'oknyomozó portál és adatigénylő műhely',
    badge: 'OKNYOMOZÓ',
    tagline:
      'Közérdekű adatigénylések százait nyújtotta be, és ha elutasították, bíróságra vitte — több ügyben ez volt az egyetlen út, ahogy az iratok kikerültek.',
    targetKeyword: { phrase: 'átlátszó.hu', volume: 4400, kd: 50 },
    section: {
      heading: 'Átlátszó — aki perre vitte az elhallgatott iratokat',
      paragraphs: [
        'Az Átlátszó 2011-ben indult oknyomozó portálként, és azóta is közadakozásból és pályázatokból működik. A legfontosabb eszköze nem a bennfentes forrás, hanem a közérdekűadat-igénylés: ha egy intézmény megtagadta az adatot, az Átlátszó pert indított, és a bírósági úton kikényszerített iratokat közzétette.',
        'Ez a módszer lassú, drága és sok éven át tartó pereskedést jelent — cserébe viszont az így megszerzett dokumentum megtámadhatatlan. Számos, ma már közismert ügy első hiteles forrása egy ilyen perben kiadott irat volt.',
        'Emellett az Átlátszó építette ki a magyar oknyomozás egyik legfontosabb technikai infrastruktúráját: drónfelvételeket, adatvizualizációkat és nyilvános adatbázisokat, amelyek más szerkesztőségek számára is használhatók maradtak.',
      ],
    },
  },
  {
    id: 'k-monitor',
    name: 'K-Monitor',
    kind: 'org',
    group: 'media',
    role: 'antikorrupciós civil szervezet, közpénz-adatbázis',
    badge: 'ADATBÁZIS',
    tagline:
      'Egyetlen kereshető adatbázisba gyűjtötte a magyar sajtóban valaha megjelent korrupciós cikkeket — ez ma a terület legfontosabb kutatási alapja.',
    targetKeyword: { phrase: 'k-monitor', volume: 1000, kd: 21 },
    section: {
      heading: 'K-Monitor — a korrupciós ügyek közös emlékezete',
      paragraphs: [
        'A K-Monitor nem egyedi botrányokat robbant ki, hanem valami sokkal ritkábbat csinál: rendszerezve megőrzi őket. A szervezet évek óta gyűjti és címkézi a magyar sajtóban megjelent, közpénzzel kapcsolatos cikkeket, és egy nyilvános, kereshető adatbázisban teszi elérhetővé őket, szereplők és intézmények szerint.',
        'Ennek a munkának a jelentősége akkor látszik meg, amikor egy ügy évekkel később újra előkerül: e nélkül minden egyes alkalommal elölről kellene kezdeni a kutatást. A K-Monitor emellett az uniós forrásokkal kapcsolatos átláthatósági vitákban is folyamatosan jelen volt szakértői anyagokkal.',
        'A Kegyencjárat adatbázisa több ponton is a K-Monitor nyílt adataira támaszkodik — az ügy-ontológia és a forráshivatkozások jelentős része innen származik, a szervezet nyílt licence alatt.',
      ],
      links: [{ text: 'a Kegyencjárat adatbázisa', href: '/adatbazis' }],
    },
    related: [{ label: 'Forráshivatkozások', href: '/forrashivatkozasok' }],
  },
  {
    id: 'direkt36',
    name: 'Direkt36',
    kind: 'org',
    group: 'media',
    role: 'oknyomozó újságíró központ',
    badge: 'OKNYOMOZÓ',
    tagline:
      'Hónapokig, néha évekig dolgozott egyetlen sztorin — és nemzetközi partnerekkel olyan ügyeket hozott ki, amelyekhez egyedül egyetlen magyar szerkesztőség sem fért volna hozzá.',
    section: {
      heading: 'Direkt36 — a hosszú lélegzetű nyomozás',
      paragraphs: [
        'A Direkt36 néhány újságíróból álló, nonprofit oknyomozó műhely, amely tudatosan a lassú munkát választotta: nem napi híreket gyárt, hanem hónapokon át épít fel egy-egy ügyet dokumentumokból, háttérbeszélgetésekből és külföldi nyilvántartásokból.',
        'A műhely rendszeresen dolgozott együtt nemzetközi oknyomozó hálózatokkal. Ez több ügyben döntő volt: olyan adatokhoz és technikai szakértelemhez adott hozzáférést — például telefonos megfigyelési vizsgálatokhoz vagy külföldi cégnyilvántartásokhoz —, amelyeket egy magyar szerkesztőség önmagában nem tudott volna előállítani.',
        'A riportjaik jellemzően teljes forrásjegyzékkel, a megszólalók szerepének pontos megjelölésével jelentek meg, ami később a jogi támadásokkal szemben is védhetővé tette őket.',
      ],
    },
  },
  {
    id: 'valasz-online',
    name: 'Válasz Online',
    kind: 'org',
    group: 'media',
    role: 'előfizetői finanszírozású közéleti portál',
    badge: 'OKNYOMOZÓ',
    tagline:
      'Konzervatív alapállásból tárt fel kormányközeli ügyeket — és ezzel azt a védőfalat bontotta le, hogy a leleplezés „csak ellenzéki támadás".',
    section: {
      heading: 'Válasz Online — leleplezés a jobboldalon belülről',
      paragraphs: [
        'A Válasz Online olvasói előfizetésekből tartja fenn magát, és határozottan konzervatív szerkesztői alapállást vállal. Épp ezért volt kivételes hatása annak, amikor a saját politikai holdudvarán belüli visszaéléseket kezdte dokumentálni.',
        'Ezeket az anyagokat sokkal nehezebb volt pártpolitikai támadásként elintézni, mint egy baloldali lap cikkeit — a szerkesztőség pontosan azoknak az olvasóknak írt, akik addig minden ilyen hírt eleve gyanakvással fogadtak.',
        'A lap tényfeltáró riportjai közül több is olyan intézményi visszaélésekről szólt, amelyek a gyermekvédelem és a szociális ellátás területén évek óta ismertek voltak szakmai körökben, de a nyilvánosságban addig nem jelentek meg.',
      ],
    },
  },
  {
    id: 'szabad-europa',
    name: 'Szabad Európa',
    kind: 'org',
    group: 'media',
    role: 'nemzetközi hátterű magyar szerkesztőség',
    badge: 'FÜGGETLEN SZERKESZTŐSÉG',
    tagline:
      'Olyan tulajdonosi háttérrel dolgozott, amelyet a hazai hirdetéspiacon keresztül nem lehetett elérni — ezért olyan ügyekhez is hozzányúlt, amelyekhez mások nem mertek.',
    section: {
      heading: 'Szabad Európa — a megfoghatatlan tulajdonos',
      paragraphs: [
        'A magyar médiapiac átalakításának legfontosabb eszköze nem a cenzúra volt, hanem a tulajdonlás és a hirdetési pénz: egy szerkesztőséget elég volt megvásárolni vagy kiéheztetni. A Szabad Európa magyar szolgálata ebből a szempontból kivételes helyzetben volt, mert a fenntartója nem a magyar hirdetéspiacon mozgott.',
        'Ez a függetlenség konkrét szerkesztőségi szabadságot jelentett: olyan hosszú, költséges vidéki riportokra és intézményi vizsgálatokra is volt kapacitás, amelyek egy hirdetésből élő lapnál elsőként estek volna ki a költségvetésből.',
        'A szerkesztőség rendszeresen foglalkozott önkormányzati és regionális közpénzügyekkel is — azzal a réteggel, amely a budapesti központú médiafigyelemből a leggyakrabban kimarad.',
      ],
    },
  },
  {
    id: 'jambor-andras',
    name: 'Jámbor András',
    kind: 'person',
    group: 'person',
    role: 'országgyűlési képviselő, a Mérce alapító-szerkesztője',
    badge: 'ÚJSÁGÍRÓ-KÉPVISELŐ',
    tagline:
      'Újságíróból lett képviselő úgy, hogy közben nem hagyta abba a terepmunkát — a szociális ügyeket ő emelte vissza a közbeszédbe.',
    targetKeyword: { phrase: 'jámbor andrás', volume: 6600, kd: 41 },
    section: {
      heading: 'Jámbor András — a lakhatás és a szegénység napirenden tartása',
      paragraphs: [
        'Jámbor András a Mérce alapító-szerkesztőjeként kezdte, majd 2022-ben egyéni választókerületben szerzett parlamenti mandátumot. Az útja azért érdekes, mert nem szakított a korábbi munkájával: képviselőként is ugyanazokkal a témákkal foglalkozott, amelyekről addig írt.',
        'A közpénzügyekhez egy sajátos irányból közelít: nem a nagy beruházások összegeit nézi, hanem azt, hogy közben mi maradt ki a költségvetésből — lakhatás, szociális ellátás, rezsi, munkaügyi jogok. Ez tette láthatóvá azt az összefüggést, ami a puszta botránylistákból nem derül ki: a kiosztott közpénznek mindig van másik oldala.',
        'A Szikra Mozgalom vezetőjeként emellett kampányokat szervezett konkrét, helyi ügyekben, a lakhatási válságtól az önkormányzati döntésekig.',
      ],
    },
  },
  {
    id: 'merce',
    name: 'Mérce',
    kind: 'org',
    group: 'media',
    role: 'közösségi finanszírozású közéleti portál',
    badge: 'FÜGGETLEN SZERKESZTŐSÉG',
    tagline:
      'Azokról a következményekről írt, amelyek a botrányok után jönnek — lakhatásról, munkáról, szegénységről, helyszíni riportokban.',
    section: {
      heading: 'Mérce — a botrány utáni élet',
      paragraphs: [
        'A Mérce olvasói támogatásból fenntartott portál, amely tudatosan a társadalmi következményekre koncentrál. Amíg a legtöbb szerkesztőség a leleplezés pillanatáig követi az ügyeket, a Mérce jellemzően ott kezdi: mi történt azokkal, akiket érint.',
        'A lap rendszeresen közölt helyszíni riportokat sztrájkokról, kilakoltatásokról, egészségügyi és oktatási intézményekről. Ezek az anyagok ritkán lettek országos főcímek, de együtt olyan folyamatos dokumentációt adnak, amely nélkül a 2026-ig vezető évek társadalmi képe hiányos lenne.',
        'A szerkesztőség a Kegyencjárat számára elsősorban kontextusforrás: az ügyek mögötti intézményi működés leírásában támaszkodunk rá.',
      ],
    },
  },
  {
    id: 'szikra-mozgalom',
    name: 'Szikra Mozgalom',
    kind: 'org',
    group: 'media',
    role: 'baloldali közösségszervező mozgalom',
    badge: 'KÖZÖSSÉGSZERVEZÉS',
    tagline:
      'Nem cikkeket írt, hanem embereket szervezett — utcáról utcára, konkrét helyi ügyekben, választásokon kívül is.',
    section: {
      heading: 'Szikra Mozgalom — a közösségszervezés visszahozása',
      paragraphs: [
        'A Szikra a hagyományos pártpolitikától eltérő logikával dolgozik: nem országos üzenetekre épít, hanem helyi, konkrét ügyekre, amelyek köré aláírásgyűjtést, lakossági fórumot, tiltakozást szervez.',
        'Ez a fajta közösségszervezés a magyar közéletből évtizedekre kiveszett, pedig pontosan ez az a réteg, amely két választás között is fenntartja a nyomást. A Szikra kampányai lakhatási, munkajogi és önkormányzati témákban voltak a leghatásosabbak.',
        'A mozgalom szorosan összefonódik Jámbor András képviselői munkájával, de attól függetlenül, önálló szervezetként is működik.',
      ],
    },
  },
  {
    id: 'juhasz-peter',
    name: 'Juhász Péter',
    kind: 'person',
    group: 'person',
    role: 'aktivista, videós műsorkészítő',
    badge: 'NER100',
    tagline:
      'Nézhető, epizódokra bontott formába öntötte azt, amit addig csak száraz közbeszerzési iratokból lehetett kibogozni — a NER100 sorozatban.',
    targetKeyword: { phrase: 'juhász péter', volume: 22200, kd: 42 },
    section: {
      heading: 'Juhász Péter — a NER100 sorozat',
      paragraphs: [
        'Juhász Péter a 2010-es évek eleji tiltakozó mozgalmak egyik szervezőjeként lett ismert, később pártpolitikusként is dolgozott, ma pedig saját videós csatornát visz. A legnagyobb hatású munkája a NER100 sorozat: a rendszer száz leggazdagabb nyertesének egyenkénti, epizódonkénti végigvétele.',
        'A sorozat értéke a formátumban van. A közbeszerzési adatok, cégkivonatok és támogatási listák önmagukban olvashatatlanok a legtöbb ember számára; a NER100 ezekből épített fel egy követhető elbeszélést, névről névre, összegekkel.',
        'Ez az a réteg, ahol a feltáró munka és a nyilvánosság találkozik: a dokumentum megvolt korábban is, de a széles közönséghez csak akkor jutott el, amikor valaki elvégezte a lefordítás munkáját.',
      ],
    },
    related: [{ label: 'Videóriportok és podcastok', href: '/podcastok' }],
  },
  {
    id: 'marki-zay-peter',
    name: 'Márki-Zay Péter',
    kind: 'person',
    group: 'person',
    role: 'Hódmezővásárhely polgármestere',
    badge: 'VIDÉKI ÁTTÖRÉS',
    tagline:
      'Egy biztosnak hitt vidéki városban nyert, és ezzel ő bizonyította be elsőként, hogy a rendszer helyben legyőzhető.',
    targetKeyword: { phrase: 'márki zay péter', volume: 8100, kd: 48 },
    section: {
      heading: 'Márki-Zay Péter — a hódmezővásárhelyi precedens',
      paragraphs: [
        'A 2018-as hódmezővásárhelyi időközi polgármester-választás azért lett országos ügy, mert egy olyan városban dőlt el, amelyet minden elemzés bevehetetlennek tartott. A győzelem önmagában egy város vezetéséről szólt, a jelentősége viszont sokkal nagyobb volt: megmutatta, hogy a helyi hatalomgyakorlás nem megdönthetetlen.',
        'Márki-Zay Péter polgármesterként a városi közbeszerzések és önkormányzati szerződések átvilágításával kezdte — ez a fajta helyi szintű feltárás ritkán kerül országos hírbe, pedig a közpénz nagy része pontosan ezen a szinten mozog.',
        '2021-ben az ellenzéki előválasztás győzteseként miniszterelnök-jelölt lett. A kampány végkimenetelétől függetlenül az akkor nyilvánosságra hozott anyagok és viták jelentős része később is hivatkozási pont maradt.',
      ],
    },
  },
  {
    id: 'puzser-robert',
    name: 'Puzsér Róbert',
    kind: 'person',
    group: 'person',
    role: 'kritikus, publicista',
    badge: 'KÖZBESZÉD',
    tagline:
      'Egyik oldalnak sem volt hajlandó megfelelni — és ezzel olyan hallgatóságot ért el, amelyet a klasszikus ellenzéki média sosem.',
    targetKeyword: { phrase: 'puzsér róbert', volume: 18100, kd: 49 },
    section: {
      heading: 'Puzsér Róbert — a besorolhatatlan hang',
      paragraphs: [
        'Puzsér Róbert kritikusként és publicistaként vált ismertté, majd a saját műsoraiban lett a közélet egyik legvitatottabb szereplője. A szerepe nem a tényfeltárás volt, hanem valami más: annak a következetes kimondása, hogy mindkét politikai oldal saját hatalmi logikája szerint működik.',
        'Ez az alapállás rengeteg konfliktussal járt, cserébe viszont olyan emberekhez is eljutott, akik semmilyen pártpolitikai csatornán nem voltak elérhetők. 2019-ben főpolgármester-jelöltként indult Budapesten.',
        'A közbeszédre gyakorolt hatása elsősorban abban mérhető, hogy a hatalomkritika nem maradt egyetlen politikai tábor tulajdona.',
      ],
    },
  },
  {
    id: 'carson-coma',
    name: 'Carson Coma',
    kind: 'org',
    group: 'person',
    role: 'zenekar — Fekete Giorgio, Héra Barnabás',
    badge: 'SZÍNPADRÓL',
    tagline:
      'Teltházas koncerteken mondták ki azt, amit a rádiós játszási listákért cserébe hallgatni illett volna — és vállalták a következményeit.',
    targetKeyword: { phrase: 'carson coma', volume: 9900, kd: 46 },
    section: {
      heading: 'Carson Coma — amikor a színpadról is kimondták',
      paragraphs: [
        'A magyar zenei életben évekig működött egy íratlan szabály: aki a nagy fesztiválokon és a közszolgálati rádióban is szeretne szerepelni, az a színpadról nem politizál. A Carson Coma ezt a szabályt szegte meg — a zenekar tagjai, köztük Fekete Giorgio, a koncertjeiken és a nyilvános szerepléseiken is beszéltek a sajtószabadság korlátozásáról.',
        'A kiállásnak ára volt: játszási listák, fellépési lehetőségek és nyilvános támadások formájában. A zenekar 2026 tavaszán a Rendszerbontó Nagykoncerten is fellépett, majd bejelentették, hogy egy időre szünetet tartanak a politizálásban.',
        'Ez a tétel szerkesztői döntés alapján került a falra: SEO-szempontból a „Carson Coma" keresések gyakorlatilag teljes egészében zenei szándékúak (koncert, dalszövegek, tagok). Azért van itt, mert a közéleti kiállás egy olyan közönséghez jutott el, amelyet semmilyen oknyomozó cikk nem ért volna el.',
      ],
    },
  },
  // ── SZEMÉLYEK (folyt.) ──────────────────────────────────────────────────
  {
    id: 'szel-bernadett',
    name: 'Szél Bernadett',
    kind: 'person',
    group: 'person',
    role: 'független országgyűlési képviselő',
    badge: 'ADATIGÉNYLŐ',
    tagline:
      'Írásbeli kérdések és közérdekűadat-igénylések százaival kényszerítette válaszadásra a minisztériumokat — és a megtagadott válaszokat is nyilvánosságra hozta.',
    section: {
      heading: 'Szél Bernadett — aki a hivatali hallgatást is dokumentálta',
      paragraphs: [
        'Szél Bernadett a parlamenti ellenőrzés legkevésbé látványos, mégis leghatékonyabb eszközével dolgozott: írásbeli kérdésekkel és közérdekűadat-igénylésekkel. Ezek nem adnak főcímet, viszont hivatalos, iktatott nyomot hagynak — egy minisztérium vagy válaszol, vagy dokumentáltan megtagadja a választ.',
        'Éppen ezért lett a módszerének a második fele legalább olyan fontos, mint az első: a kitérő és elutasító válaszokat is rendszeresen nyilvánosságra hozta. Így állt össze az a kép, hogy egyes területeken az adat nem azért hiányzott, mert nem létezett, hanem mert nem akarták kiadni.',
        'A megfigyelési botrány magyar szálának egyik legkövetkezetesebb parlamenti számonkérője volt — akkor is napirenden tartotta az ügyet, amikor az már rég lekerült a címlapokról.',
      ],
    },
    related: [{ label: 'Adatbázis', href: '/adatbazis' }],
  },
  {
    id: 'szabo-timea',
    name: 'Szabó Tímea',
    kind: 'person',
    group: 'person',
    role: 'országgyűlési képviselő, a Párbeszéd társelnöke',
    badge: 'HELYSZÍNI ELLENŐRZÉS',
    tagline:
      'Nem érte be a hivatalos tájékoztatással: bement az intézményekbe, és azt dokumentálta, amit ott talált.',
    section: {
      heading: 'Szabó Tímea — a helyszíni ellenőrzés mint politikai eszköz',
      paragraphs: [
        'Szabó Tímea képviselőként következetesen élt azzal a jogosítvánnyal, amelyet a legtöbben nem használnak ki: bejelentés nélkül lehet ellenőrizni közintézményeket. Gyermekvédelmi intézményekben, kórházakban és szociális otthonokban végzett ellenőrzésekről rendszeresen tett közzé beszámolókat.',
        'Ez másfajta feltárás, mint az iratokból dolgozó. Nem pénzmozgásokat követ, hanem azt, hogy a kiutalt közpénz mögött van-e valóság: van-e ellátás, van-e személyzet, milyen állapotban van az épület. A kettő együtt adja ki a teljes képet — a szerződés összege és az, ami belőle a helyszínen látszik.',
        'A gyermekvédelmi rendszer állapotával kapcsolatos ügyeknek éveken át az egyik legkitartóbb parlamenti napirenden tartója volt.',
      ],
    },
  },
  {
    id: 'panyi-szabolcs',
    name: 'Panyi Szabolcs',
    kind: 'person',
    group: 'person',
    role: 'oknyomozó újságíró',
    badge: 'MEGFIGYELÉSI ÜGY',
    tagline:
      'Feltárta a magyar megfigyelési botrányt — és közben kiderült, hogy a saját telefonja is a célpontok között volt.',
    section: {
      heading: 'Panyi Szabolcs — az újságíró, akit magát is megfigyeltek',
      paragraphs: [
        'Panyi Szabolcs nemzetbiztonsági, külpolitikai és fegyverkereskedelmi ügyekre szakosodott oknyomozó újságíró, aki nemzetközi újságírói hálózatokkal együttműködve dolgozott. A magyar sajtótörténet egyik legszemélyesebb tétű sztorija fűződik a nevéhez: a katonai szintű kémszoftverrel végzett megfigyelések magyarországi ügyében az egyik dokumentált célpont ő maga volt.',
        'Ez a tény a szokásosnál élesebben világította meg, mi forog kockán egy ilyen feltárásnál. Nem elvont sajtószabadsági kérdésről volt szó, hanem arról, hogy egy újságíró telefonján keresztül a forrásai is azonosíthatóvá váltak.',
        'A külpolitikai szálon a magyar diplomácia és Moszkva kapcsolatáról közölt anyagait a Kegyencjárat adatbázisa is forrásként használja — például a Szijjártó Péterhez köthető ügyek dokumentálásánál.',
      ],
    },
    related: [{ label: 'Kapcsolódó ügyek az adatbázisban', href: '/adatbazis' }],
  },
  {
    id: 'kunetz-zsombor',
    name: 'Kunetz Zsombor',
    kind: 'person',
    group: 'person',
    role: 'orvos, egészségügyi szakértő',
    badge: 'EGÉSZSÉGÜGYI ADAT',
    tagline:
      'Éveken át olvasta ki a hivatalos egészségügyi statisztikákból azt, amit a hivatalos kommunikáció nem mondott ki.',
    section: {
      heading: 'Kunetz Zsombor — amit az egészségügyi számok elárulnak',
      paragraphs: [
        'Kunetz Zsombor orvosként és egészségügyi menedzsment-szakértőként a nyilvános, de gyakorlatilag olvashatatlan egészségügyi adatokkal foglalkozik: várólistákkal, ellátási és finanszírozási adatokkal, kórházi adósságállománnyal, halálozási statisztikákkal.',
        'A módszer ugyanaz, mint a közbeszerzés-elemzőké, csak más területen: az adat évek óta nyilvános, a kérdés az, hogy valaki veszi-e a fáradságot, hogy értelmezze és összehasonlítsa. A hivatalos kommunikáció és a hivatalos adatsorok között feszülő különbséget rendszeresen dokumentálta.',
        'Az egészségügy azért tartozik ide, mert a közpénznek mindig két oldala van: az egyik, hogy hová ment, a másik, hogy hová nem jutott el.',
      ],
    },
  },
  {
    id: 'racz-andras',
    name: 'Rácz András',
    kind: 'person',
    group: 'person',
    role: 'biztonságpolitikai szakértő',
    badge: 'KÜLPOLITIKAI KONTEXTUS',
    tagline:
      'Elmagyarázta, mi a különbség a diplomáciai gesztus és a befolyásszerzés között — és hogy mikor melyikről volt szó.',
    section: {
      heading: 'Rácz András — a külpolitikai szál értelmezése',
      paragraphs: [
        'Rácz András biztonságpolitikai kutatóként az orosz külpolitikával, a hibrid befolyásszerzés eszközeivel és a közép-európai biztonsági környezettel foglalkozik. A szerepe ezen a falon nem a dokumentumok kiásása, hanem az értelmezés — ami egy ilyen ügyben nem másodlagos munka.',
        'Egy szerződés, egy hitel vagy egy diplomáciai látogatás önmagában sosem botrány. Csak akkor válik azzá, ha valaki elhelyezi abban a szélesebb mintázatban, amelybe illeszkedik. A szakértői elemzés különbsége pontosan itt van: megmondja, hogy amit látunk, az szokványos állami működés vagy sem.',
        'Az energetikai és külpolitikai hátterű ügyek megértéséhez ez a réteg nélkülözhetetlen — ezek azok a sztorik, amelyeket a legkönnyebb technikai részletként elintézni.',
      ],
    },
  },

  // ── MÉDIUMOK ÉS MŰHELYEK (folyt.) ───────────────────────────────────────
  {
    id: 'kontroll',
    name: 'Kontroll',
    kind: 'org',
    group: 'media',
    role: 'oknyomozó portál (kontroll.hu)',
    badge: 'OKNYOMOZÓ',
    tagline:
      'Közpénz-kifizetéseket és állami szerződéseket tárt fel adatelemzéssel — és amikor tévedett, maga közölte a helyreigazítást.',
    section: {
      heading: 'Kontroll — kifizetések, szerződések, adatelemzés',
      paragraphs: [
        'A Kontroll az állami szerződések és kifizetések adatvezérelt feldolgozására épülő oknyomozó műhely. Nem egyedi bejelentésekből dolgozik, hanem abból, amit a nyilvános nyilvántartásokból ki lehet nyerni: kinek, mennyit, milyen jogcímen utaltak ki.',
        'Több olyan ügy első nyilvánosságra hozója volt, amely a Kegyencjárat adatbázisában is szerepel — kormányzati kommunikációs kifizetésektől állami médiaszerződésekig.',
        'Egy dolgot érdemes külön kiemelni, mert ez a szakmai színvonal mércéje: egy nagy visszhangot kapott szerződéses ügyben tévesen szerepelt egy összeg a cikkükben, és ezt a lap maga korrigálta, nyilvánosan. Az adatbázisunk ma a helyesbített, jóval alacsonyabb összeggel tartja nyilván az ügyet. Egy szerkesztőség nem attól hiteles, hogy sosem téved, hanem attól, hogy mit csinál, amikor kiderül.',
      ],
    },
    related: [{ label: 'Adatbázis', href: '/adatbazis' }],
  },
  {
    id: 'gulyasagyu-media',
    name: 'Gulyáságyú Média',
    kind: 'org',
    group: 'media',
    role: 'utcai és helyszíni videós műhely',
    badge: 'HELYSZÍNI RIPORT',
    tagline:
      'Ott volt kamerával, ahol a politika ténylegesen találkozik az emberekkel — kampánygyűléseken, utcán, vidéken.',
    section: {
      heading: 'Gulyáságyú Média — a kamera, ami nem a stúdióban van',
      paragraphs: [
        'A Gulyáságyú Média műfaja a helyszíni, utcai riport: kampánygyűlések, lakossági fórumok, tiltakozások, vidéki helyszínek. Az anyagaik ritkán tartalmaznak pénzügyi kimutatást — viszont rögzítik azt, ami a hivatalos beszámolókból mindig kimarad.',
        'Ez a fajta munka azért értékes, mert dokumentum értékű felvételt hoz létre olyan eseményekről, amelyekről egyébként csak a szervezők saját, vágott közvetítése maradna fenn.',
        'A csatorna a Kegyencjárat videórovatában is folyamatosan jelen van.',
      ],
    },
    related: [{ label: 'Videóriportok és podcastok', href: '/podcastok' }],
  },
  {
    id: 'ahang',
    name: 'aHang',
    kind: 'org',
    group: 'media',
    role: 'közösségi kampányplatform',
    badge: 'KAMPÁNYPLATFORM',
    tagline:
      'Infrastruktúrát adott ahhoz, hogy egy felháborodásból mérhető, több tízezer aláírásos nyomásgyakorlás legyen.',
    section: {
      heading: 'aHang — amikor a felháborodásból kampány lesz',
      paragraphs: [
        'Az aHang nem szerkesztőség: kampányplatform. Azt a lépést szolgálja ki, amely a legtöbb ügynél hiányzik — hogy a leleplezés után legyen hová csatornázni azt, amit az emberek éreznek. Petíciókat, aláírásgyűjtéseket és online kampányokat futtat, technikai és szervezési háttérrel.',
        'Ennek a szerepnek a jelentősége az ügyek élettartamában mérhető. Egy sztori a megjelenése után néhány nappal kifullad; egy több tízezer aláírásos kampány viszont hetekig-hónapokig napirenden tartja, és mérhető számot ad ahhoz, amit addig csak közhangulatnak hívtak.',
        'Az aHang nyílt fotóarchívumát a Kegyencjárat is használja — több közszereplő képe onnan származik, feltüntetett forrással.',
      ],
    },
  },

  // ── FACEBOOK- ÉS YOUTUBE-CSATORNÁK ──────────────────────────────────────
  {
    id: 'pottyondy-edina',
    name: 'Pottyondy Edina',
    kind: 'person',
    group: 'channel',
    role: 'videós műsorkészítő',
    badge: 'HETI ÖSSZEFOGLALÓ',
    tagline:
      'Heti rendszerességgel foglalta össze, mi történt — olyan formában, amit végignézés után tényleg meg lehetett jegyezni.',
    section: {
      heading: 'Pottyondy Edina — a heti adag, amit végig lehet nézni',
      paragraphs: [
        'Pottyondy Edina saját videós csatornáján dolgozza fel a hét közéleti eseményeit, éles, szatirikus hangvételben. A műfaj lebecsülése tipikus hiba: a rendszeresség és a nézhetőség önmagában is funkció.',
        'A feltáró újságírás legnagyobb gyengesége, hogy a legalaposabb anyagot is kevesen olvassák végig. Egy heti, követhető formátum ezt oldja meg — nem helyettesíti a mélyfúrást, hanem eljuttatja azokhoz, akik különben sosem találkoznának vele.',
      ],
    },
    related: [{ label: 'Videóriportok és podcastok', href: '/podcastok' }],
  },
  {
    id: 'osvath-zsolt',
    name: 'Osváth Zsolt',
    kind: 'person',
    group: 'channel',
    role: 'vállalkozó, a ZSHOWtime házigazdája',
    badge: 'INTERJÚK',
    tagline:
      'Nem politikai újságíróként ült le a politikusokkal — és pont ezért jutott el olyan nézőkhöz, akiket a közéleti média sosem ért el.',
    section: {
      heading: 'Osváth Zsolt — közélet nem közéleti csatornán',
      paragraphs: [
        'Osváth Zsolt vállalkozóként és vendéglátósként lett ismert, a több százezres nézettségű saját videós csatornáján viszont rendszeresen ül le politikusokkal hosszú beszélgetésekre — több miniszterelnök-jelölttel és főpolgármesterrel is készített interjút.',
        'A jelentősége a közönségben van. Egy közéleti csatorna nézője eleve érdeklődő; egy vegyes profilú, nagy elérésű csatornáé viszont nem feltétlenül. Ezeken a felületeken jutott el a téma azokhoz, akik politikai tartalmat tudatosan nem keresnek.',
      ],
    },
  },
  {
    id: 'fokuszcsoport',
    name: 'Fókuszcsoport',
    kind: 'org',
    group: 'channel',
    role: 'közéleti szatíra- és elemzőcsatorna',
    badge: 'SZATÍRA',
    tagline:
      'A humort használta arra, amire a tényszerű beszámoló sokszor képtelen: hogy megmaradjon az emberek fejében.',
    section: {
      heading: 'Fókuszcsoport — a szatíra mint terjesztési forma',
      paragraphs: [
        'A Fókuszcsoport közéleti szatíra- és elemzőtartalmat készít, nagy közösségi médiás eléréssel. A szatíra ezen a falon nem díszítés: az egyik legmegbízhatóbb módja annak, hogy egy bonyolult ügy egyáltalán eljusson valakihez, aki nem olvas hírportált.',
        'A csatorna a Kegyencjárat videórovatában is szerepel.',
      ],
    },
    related: [{ label: 'Videóriportok és podcastok', href: '/podcastok' }],
  },
  {
    id: 'vastagbor',
    name: 'Vastagbőr',
    kind: 'org',
    group: 'channel',
    role: 'közéleti blog',
    badge: 'BLOG',
    tagline:
      'Éveken át, blogformátumban tartotta napirenden azt, amit a nagy lapok néhány nap után elengedtek.',
    targetKeyword: { phrase: 'vastagbőr', volume: 590, kd: 19 },
    section: {
      heading: 'Vastagbőr — a hosszú memóriájú blog',
      paragraphs: [
        'A Vastagbőr közéleti blogként működik: rendszeres, kritikus hangvételű bejegyzésekkel követi a hatalomgyakorlás mindennapjait. A blogformátum előnye a hírportállal szemben az, hogy nincs napi kényszere — ugyanahhoz az ügyhöz hetekkel később is vissza tud térni.',
        'Ez adja a jelentőségét: a botrányok többsége nem cáfolat miatt tűnik el, hanem egyszerűen azért, mert jön a következő. Aki visszatér a régiekre, az tartja életben őket.',
      ],
    },
  },
  {
    id: 'kardblog',
    name: 'KARD blog',
    kind: 'org',
    group: 'channel',
    role: 'közéleti blog és podcast',
    badge: 'BLOG + PODCAST',
    tagline:
      'Heti rendszerességgel rakta össze és magyarázta el, mi történt — blogban és podcastben egyszerre.',
    section: {
      heading: 'KARD blog — heti összerakás, két formátumban',
      paragraphs: [
        'A KARD blog szerkesztői, Timár Gábor és Hetei Péter a hét közéleti eseményeit dolgozzák fel írásban és podcast formájában is. A kettős formátum nem véletlen: más olvas és más hallgat, és egy ügy akkor terjed, ha mindkét csatornán jelen van.',
        'A műhely a Kontroll-lal együttműködésben is készít műsort, ami jól mutatja a rendszer működését: a blog nem a szerkesztőségek konkurenciája, hanem a folytatása.',
      ],
    },
  },
  {
    id: 'dietas-magyar-muzsa',
    name: 'Diétás Magyar Múzsa',
    kind: 'org',
    group: 'channel',
    role: 'nagy elérésű közösségi oldal',
    badge: 'NAGY ELÉRÉS',
    tagline:
      'Százezres eléréssel vitte tovább a kész sztorikat — a közösségi média azon rétegében, ahová a szerkesztőségek nem jutnak el.',
    section: {
      heading: 'Diétás Magyar Múzsa — a terjesztés rétege',
      paragraphs: [
        'A Diétás Magyar Múzsa a nagy elérésű közéleti közösségi oldalak közé tartozik: nem elsődleges forrás, hanem az a réteg, amely eldönti, hogy egy megjelent anyagot tízezren vagy százezren látnak-e.',
        'Ez a szerep a magyar médiapiac szerkezete miatt vált kulcsfontosságúvá. Amikor a nagy elérésű hagyományos csatornák sorra kerültek egy tulajdonosi körbe, a közösségi oldalak maradtak az egyetlen tömeges terjesztési útvonal.',
      ],
    },
  },
  {
    id: 'maydayhungary',
    name: 'MayDayHungary',
    kind: 'org',
    group: 'channel',
    role: 'nagy elérésű közösségi oldal',
    badge: 'NAGY ELÉRÉS',
    tagline:
      'Folyamatosan gyűjtötte és tette egy helyre azt, ami máskülönben tucatnyi forrásban szóródott volna szét.',
    section: {
      heading: 'MayDayHungary — a folyamatos gyűjtés',
      paragraphs: [
        'A MayDayHungary közéleti tartalmakat gyűjtő és továbbító, nagy elérésű oldal. A funkciója az aggregálás: egy helyen, folyamatosan követhetővé tenni azt, ami egyébként tucatnyi szerkesztőség, blog és csatorna között oszlana meg.',
        'Ez lényegében ugyanaz a munka, amit a Kegyencjárat adatbázisa csinál — csak a közösségi média tempójában és felületén.',
      ],
    },
  },
  {
    id: 'jolvanezigy',
    name: 'Jólvanezígy',
    kind: 'org',
    group: 'channel',
    role: 'nagy elérésű közösségi oldal',
    badge: 'NAGY ELÉRÉS',
    tagline:
      'A közéleti abszurdumokat tette pár másodperc alatt érthetővé — ott, ahol az emberek amúgy is görgetnek.',
    section: {
      heading: 'Jólvanezígy — érthetővé tenni pár másodperc alatt',
      paragraphs: [
        'A Jólvanezígy nagy elérésű közéleti oldalként dolgozza fel a közélet visszásságait, tömör, könnyen továbbosztható formában.',
        'A rövid formátum korlátai nyilvánvalók — de a feladat itt nem a teljesség, hanem az, hogy valaki egyáltalán megálljon egy ügynél. Az onnan tovább vezető út a szerkesztőségeké és az adatbázisoké.',
      ],
    },
  },
  {
    id: 'radics-peti',
    name: 'Radics Peti',
    kind: 'person',
    group: 'channel',
    role: 'videós tartalomgyártó, humorista',
    badge: 'SZATÍRA',
    tagline:
      'Szatíracsatornát vitt, nem politikait — aztán egy ponton kiállt a Kossuth térre, és a nézői vele mentek.',
    section: {
      heading: 'Radics Peti — a szatíracsatorna, ami közéleti lett',
      paragraphs: [
        'Radics Peti 2008 óta készít videókat, több százezres követőtáborral. A profilja eredetileg nem közélet volt: szinkronparódiák és az emberi ostobaságot körbejáró sorozatok tették ismertté. A közéleti témák fokozatosan kerültek be, és a hangvétel végig ugyanaz maradt — ironikus, és pártállástól függetlenül bárkire rászáll.',
        'Éppen ettől lett súlya, amikor kilépett a képernyő mögül: 2025-ben a Kossuth téren személyesen is felszólalt, és a nézőit nyíltan tüntetésen való részvételre biztatta. Egy szatirikus csatornától ez nem kötelező lépés — sokkal kényelmesebb végig a poén biztonságos oldalán maradni.',
        'A megfigyelési botrány nyilvánosságra kerülése után saját elmondása szerint ő is azok közé tartozott, akiket megfigyeltek. Ha ez így van, az sokat elárul arról, hogy a hatalom maga mennyire nem tartotta ártalmatlan szórakoztatásnak ezt a műfajt.',
      ],
    },
    related: [{ label: 'Videóriportok és podcastok', href: '/podcastok' }],
  },
  {
    id: 'magyarosi-csaba',
    name: 'Magyarósi Csaba',
    kind: 'person',
    group: 'channel',
    role: 'videós tartalomgyártó, vlogger',
    badge: 'NAGY ELÉRÉS',
    tagline:
      'Nem közéleti csatornát épített — és pont ezért ért el olyan nézőket, akikhez politikai tartalom soha nem jut el.',
    section: {
      heading: 'Magyarósi Csaba — közönség, amit nem a politika hozott össze',
      paragraphs: [
        'Magyarósi Csaba a magyar YouTube egyik régi, nagy elérésű alkotója: napi vlogokkal, utazós, kütyüs és gasztrotartalommal épített fel egy több százezres közönséget. A profilja alapján nem tartozna erre a falra — épp ez a lényeg.',
        'Egy közéleti csatorna nézője eleve érdeklődő: őt nem kell meggyőzni arról, hogy oda kell figyelni. A nagy elérésű, nem politikai csatornák közönsége viszont pontosan az a réteg, amelyet a hagyományos és az ellenzéki média egyaránt elveszített. Amikor egy ilyen csatorna gazdája közéleti kérdésben megszólal, az olyan emberekhez jut el, akikhez semmilyen hírportál nem.',
        'Ennek az ára is megvan: egy nem politikai profilú alkotónál minden állásfoglalás közönséget kockáztat. Aki mégis megteszi, az tudatosan vállal veszteséget. Magyarósi Csaba megtette — az ő videója fogadja a látogatót ennek az oldalnak a tetején.',
      ],
    },
  },
];

/** Csak azok a profilok, amelyeknek már van élő aloldaluk — ez megy a
 *  sitemapbe és ezek lesznek kattinthatók. Amíg üres, a rács kattinthatatlan
 *  kártyákat mutat, de az oldal SEO-értéke (cornerstone-szöveg, GYIK,
 *  strukturált adat) már így is megvan. */
export function liveFeltarok(): Feltaro[] {
  return FELTAROK.filter((f) => f.live);
}

export function getFeltaro(id: string): Feltaro | undefined {
  return FELTAROK.find((f) => f.id === id);
}

export const RENDSZERVALTAS_FAQ: { q: string; a: string }[] = [
  {
    q: 'Mikor volt a 2026-os rendszerváltás?',
    a: '2026. április 12-én. A Kegyencjárat ettől a naptól számítja a lemondásokat, a kirúgásokat és a megszűnt médiumokat is — a nyitóoldali számlálók mind ehhez a dátumhoz viszonyítanak.',
  },
  {
    q: 'Kik tárták fel a NER korrupciós ügyeit?',
    a: 'Nem egyetlen szereplő, hanem egy egész ökoszisztéma: oknyomozó szerkesztőségek (Átlátszó, Direkt36, Válasz Online, Szabad Európa), adat-alapú civil műhelyek (K-Monitor), közbeszerzési adatokból dolgozó képviselők (Hadházy Ákos), videós műhelyek (Partizán, NER100) és közösségszervező mozgalmak. A legtöbb nagy ügynél több forrás munkája épült egymásra.',
  },
  {
    q: 'Miért „Dicsőségfal" a neve?',
    a: 'Mert a Kegyencjárat Galéria rovata a NER tíz kiemelt kegyencének arcképcsarnoka. Ez az oldal annak a tükörképe: ugyanaz a forma, fordított előjellel.',
  },
  {
    q: 'Honnan származnak a Kegyencjárat adatai?',
    a: 'Nyilvános forrásokból: sajtócikkekből, közbeszerzési és cégadatokból, bírósági és hatósági közlésekből, valamint a K-Monitor nyílt licencű korrupciós adatbázisából. Minden ügy mellett fel van tüntetve, honnan származik.',
  },
  {
    q: 'Bekerülhet valaki más is erre a listára?',
    a: 'Igen. A lista nyitott, és bővül. Ha szerinted valaki hiányzik róla, a bejelentő űrlapon keresztül lehet javaslatot küldeni.',
  },
];
