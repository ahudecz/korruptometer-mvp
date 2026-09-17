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
// 2026-09-16: Magyarósi Csaba lekerült a névsorról (user döntés). A próba,
// amin elbukott: mit tett április 12. ELŐTT, ami hozzájárult a fordulathoz?
// Az ő anyaga (a hero-videó) április 13-i — reakció az eredményre, nem
// hozzájárulás hozzá. A videó marad a bevezető záró elemeként, névvel.
//
// 2026-09-16: a Válasz Online és a Szabad Európa is lekerült (user döntés).
// Mindkettő főállású, intézményi/előfizetői bevételből működő szerkesztőség
// — ugyanaz a kategória, mint a 444 vagy a Telex —, ezért az elismerő
// bekezdésbe kerültek át, linkkel. A falon maradó médiumok (Átlátszó,
// Direkt36, K-Monitor, Partizán, Mérce, Kontroll) közadakozásból,
// nonprofitként vagy civil szervezetként működnek. A Kontroll a user
// döntése alapján marad.
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

/** Egy beágyazott YouTube-felvétel. A `list` egy teljes lejátszási listát tesz
 *  a lejátszóba (user kérés, 2026-09-17: a NER100 65 részes sorozat, egyben
 *  kell beágyazni) — a borítókép ilyenkor is az `id` videóé, és a néző a
 *  kereten belül lépked a részek között, nem megy át a YouTube-ra. */
export type FeltaroVideoRef = {
  id: string;
  label?: string;
  title: string;
  summary?: string;
  list?: string;
};

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
    video?: FeltaroVideoRef;
  };
  /** Mire célozzon majd a SAJÁT profiloldala (Semrush, HU, 2026-09). */
  targetKeyword?: { phrase: string; volume: number; kd: number };
  /** Belső linkek a meglévő tartalmainkhoz — hub & spoke. */
  related?: { label: string; href: string }[];
  /** Van-e már élő profil-aloldala (/rendszervaltas/<id>). Ha false, a
   *  kártya nem kattintható és a sitemapbe sem kerül be. */
  live?: boolean;
  /** A végoldal (/rendszervaltas/<id>) tartalma. A `section` bekezdései
   *  mindenképp megjelennek rajta; ez a mező az, ami fölé épül. Ha
   *  hiányzik, a végoldal akkor is működik — csak rövidebb. */
  detail?: FeltaroDetail;
};

/** Egy konkrét, megnevezett ügy vagy tett a végoldalon. A `source` mindig
 *  külső hivatkozás — sose írjunk ide állítást forrás nélkül. */
/** Egy hivatkozott cikk. A megjelenés a site két bevált formája (user,
 *  2026-09-16): alapból „Kapcsolódó hírek"-sor (FORRÁS · DÁTUM · CÍM), és
 *  ahol a cikk önmagában is megáll, keretes article-card leaddel.
 *  A `source` a Source tábla szerinti HIVATALOS név (hang.hu → Magyar Hang),
 *  nem a domain. */
export type FeltaroLink = {
  source: string;
  /** Emberi formátum: „2026. jún. 26." — a sorban jobbra igazítva. */
  date?: string;
  headline: string;
  url: string;
  /** Ha van, a hivatkozás KERETES article-cardként jelenik meg. */
  lead?: string;
};

export type FeltaroCase = {
  title: string;
  /** Mikor történt, emberi formában („2025. augusztus 19."). Elhagyható. */
  when?: string;
  body: string;
  /** További bekezdések a `body` után — ha egy ügynek több szakasza van. */
  more?: string[];
  /** Belső/külső linkek a `body` és a `more` szövegében (szó szerinti egyezés). */
  links?: InlineLink[];
  /** Az ügy ALSZAKASZAI. Számozatlan H3-ak: egy ügy több fejleménye nem
   *  külön ügy (user, 2026-09-16 — a zebra-gate öt fejleménye nem öt ügy).
   *  A sorszám csak az ügyeket illeti meg, az alszakaszokat nem. */
  sections?: {
    heading: string;
    paragraphs: string[];
    links?: InlineLink[];
    sources?: FeltaroLink[];
    videos?: FeltaroVideoRef[];
  }[];
  sources?: FeltaroLink[];
  /** Az ÜGYHÖZ tartozó felvételek — a szöveg végén, még a kiemelés előtt.
   *  Ott a helyük, ahol az ügyről szó van, nem a lap alján (user, 2026-09-16). */
  videos?: FeltaroVideoRef[];
  /** Keretes kiemelés AZ ÜGYÖN BELÜL: az az egy mozzanat, ami önmagában is
   *  megállítja az olvasót (pl. amikor nekimentek a kocsijának). */
  highlight?: {
    heading: string;
    body: string;
    sources?: FeltaroLink[];
    /** A kiemelésben szereplő esemény felvétele — ott jelenik meg, ahol az
     *  eset le van írva, nem a lap alján (user, 2026-09-16). */
    video?: FeltaroVideoRef;
  };
  /** Keretes ajánló a saját kiemelt ügyoldalunkra. Kötelező minden olyan
   *  ügynél, amelyhez van /ugyek/<id> oldalunk — user szabály, 2026-09-16:
   *  ha egy feltáró egy KIEMELT ügyhöz kapcsolható, arra át kell hivatkozni. */
  promo?: { href: string; eyebrow: string; title: string; lead: string; cta: string };
};

export type FeltaroDetail = {
  /** <title>; ha hiányzik, a névből képződik. */
  seoTitle?: string;
  seoDescription?: string;
  /** H1 alatti, önmagában is válaszoló bevezető (featured snippet cél). */
  lead?: string;
  /** „Mit tárt fel?" — a lap gerince. */
  cases?: { heading: string; intro?: string; items: FeltaroCase[] };
  /** További, szabad szöveges szakaszok a konkrét ügyek UTÁN. */
  extra?: { heading: string; paragraphs: string[]; links?: InlineLink[] }[];
  video?: FeltaroVideoRef;
  /** Több beágyazott videó egy blokkban, saját felvezetővel. Akkor kell,
   *  amikor nem egy adás a bizonyíték, hanem az, hogy több szerkesztőség
   *  egymástól függetlenül ugyanazt játszotta le. */
  videoBlock?: {
    heading: string;
    intro?: string;
    items: FeltaroVideoRef[];
  };
  /** Videórács (3x3). Szándékosan NEM iframe-enként töltjük be: kilenc
   *  beágyazott lejátszó megölné az oldal betöltési idejét, ezért itt csak
   *  a YouTube-borítókép van, és a kártya kifelé linkel. */
  videoGrid?: {
    heading: string;
    intro?: string;
    items: { id: string; title: string; note?: string }[];
    channelUrl?: string;
    channelLabel?: string;
  };
  /** Friss közösségi-média feed: az oldal legutóbbi nyilvános posztjai,
   *  a saját kártyáinkkal renderelve. A tartalom a Facebook hivatalos
   *  og:-adataiból származik, a képek le vannak töltve a /public alá (az
   *  fbcdn-linkek alá vannak írva és lejárnak). A weboldal futásidőben
   *  SOHA nem hívja a Facebookot — a feedet egy külön script frissíti. */
  socialFeed?: {
    heading: string;
    intro?: string;
    platformLabel: string;
    pageName: string;
    profileUrl?: string;
    /** Mikor frissítettük utoljára — a feed nem élő, ezt ki kell írni. */
    updatedAt: string;
    items: { text: string; image?: string; url: string }[];
  };
  /** Kézi kiemelés: PONTOSAN 3 nevezetes közösségi-média poszt (user döntés,
   *  2026-09-16 — a Meta hivatalos beágyazója helyett, ami nyomkövetést
   *  töltene be minden látogatónak, és App ID nélkül bármikor elszállhat).
   *  Minden tétel forrásolt: vagy maga a poszt, vagy az azt feldolgozó cikk.
   *  A `quote` SZÓ SZERINTI idézet lehet csak — parafrázis a `body`-ba megy. */
  socialHighlights?: {
    heading: string;
    intro?: string;
    platformLabel: string;
    /** Az oldal neve, ahogy a kártya fejlécében megjelenik. */
    pageName: string;
    profileUrl?: string;
    profileLabel?: string;
    items: {
      /** A poszt dátuma, ahogy a kártya fejlécében megjelenik. */
      when: string;
      /** A mi szerkesztői címünk — NEM a poszt szövege. */
      title: string;
      /** A mi kommentárunk: miért fontos ez a poszt. */
      body: string;
      /** A poszt SZÓ SZERINTI nyitánya. Sose írjuk át, sose egészítjük ki. */
      quote?: string;
      /** A poszt képe, LETÖLTVE a /public alá — a fbcdn-linkek alá vannak
       *  írva és lejárnak, ezért sose hotlinkelünk rájuk. */
      image?: string;
      imageAlt?: string;
      /** A poszt permalinkje. */
      href?: string;
      sources?: FeltaroLink[];
      promo?: { href: string; eyebrow: string; title: string; lead: string; cta: string };
    }[];
  };
  /** Összehasonlító táblázat. A forrás-oszlop mintáját követi: a cellák
   *  sima szövegek, a tábla mobilon vízszintesen görgethető. */
  table?: {
    heading: string;
    intro?: string;
    columns: string[];
    rows: string[][];
    note?: string;
  };
  faq?: { q: string; a: string }[];
  sources?: FeltaroLink[];
  /** Semrush-célszó a végoldalhoz, ha más, mint a kártyán lévő. */
  targetNote?: string;
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
    'A 2026. április 12-i rendszerváltás nem egyetlen nap alatt történt meg. Évekig tartó, aprólékos feltáró munka előzte meg: közbeszerzési adatbázisok átfésülése, elutasított adatigénylések miatt indított perek, offshore cégláncok kibogozása, olyan riportok, amelyekért kirúgás, lehallgatás vagy feljelentés járt. Ezen az oldalon azok vannak összegyűjtve, akik ezt a munkát elvégezték — újságírók, adat-aktivisták, képviselők, zenészek és civil műhelyek. A Kegyencjárat adatbázisában szereplő ügyek túlnyomó többsége az ő munkájukból származik: ők feltárták, mi rendszerezzük.',
  /** A rács fölötti bevezető. Külön mező, mert ez a lap legolvasottabb
   *  bekezdése: ez dönti el, hogy az olvasó legörget-e a hosszú szövegig. */
  gridIntro: [
    'Egy korrupciós ügy feltárása soha nem egyetlen ember érdeme. Mire egy név eljut odáig, hogy kimondják a híradóban, addigra valaki átrágta magát több ezer oldalnyi közbeszerzési iraton, valaki más három évig pereskedett egy elutasított adatigénylésért, egy harmadik pedig érthető mondatokká fordította az egészet. Ez a fal nekik szól.',
    'A lenti névsor nem rangsor, és nem is teljes — folyamatosan bővül. Három blokkra bontottuk, mert háromféle munkáról van szó. A **személyek** a saját nevüket adták egy-egy ügyhöz, és évekig kitartottak mellette. A **médiumok és műhelyek** azt az infrastruktúrát tartják fenn — ügyvédeket, adatbázisokat, hónapokig fizetett újságírói munkaidőt —, ami nélkül egy mélyfúrás elindulni sem tudna. A **Facebook- és YouTube-csatornák** pedig azt csinálják, amit a legkönnyebb lebecsülni és a legnehezebb pótolni: elviszik a kész sztorit több százezer emberhez, olyanokhoz is, akik hírportált soha nem nyitnak meg.',
    'A Kegyencjárat adatbázisa ennek a munkának a másodlagos feldolgozása. Egyetlen ügyet sem mi tártunk fel: mi összegyűjtjük, rendszerezzük, összekötjük és követhetővé tesszük azt, amit ők kiástak. Ezért van ez az oldal — és ezért van forrásmegjelölés minden egyes sor mellett.',
  ],
  /** A nagy független szerkesztőségek elismerése. Külön mező, mert a
   *  szerkesztőségneveknek kattintható külső linknek kell lenniük, a
   *  gridIntro pedig sima szöveg. Fontos, hogy a szöveg kimondja, MIÉRT
   *  nincsenek a falon — különben úgy néz ki, mintha lefelejtettük volna
   *  őket, miközben az adatbázisunk forráshivatkozásai tele vannak velük.
   *  A „nekik ez a dolguk is" megkülönböztetés a főállású, üzleti alapon
   *  működő szerkesztőségre vonatkozik — a falon szereplő médiumok
   *  (Átlátszó, Direkt36, Partizán, Mérce) olvasói támogatásból vagy
   *  nonprofitként működnek, ezt a szöveg külön ki is mondja, hogy ne
   *  legyen ellentmondás. */
  mainstreamNote: {
    before:
      'Feltűnhet, hogy hiányoznak innen a nagy független szerkesztőségek: a ',
    outlets: [
      { name: '444', url: 'https://444.hu' },
      { name: 'Telex', url: 'https://telex.hu' },
      { name: '24.hu', url: 'https://24.hu' },
      { name: 'HVG', url: 'https://hvg.hu' },
      { name: 'Népszava', url: 'https://nepszava.hu' },
      { name: 'Magyar Hang', url: 'https://hang.hu' },
      { name: 'Válasz Online', url: 'https://www.valaszonline.hu' },
      { name: 'Szabad Európa', url: 'https://www.szabadeuropa.hu' },
    ],
    after:
      '. Pedig az ezen az oldalon szereplő ügyek jelentős része az ő oknyomozásaikból és interjúikból származik, és a forráshivatkozásaink tele vannak a nevükkel — nélkülük ez az adatbázis a töredéke lenne annak, ami. A kihagyás tehát nem értékítélet, hanem szűkítés: ez a fal tudatosan azokra koncentrál, akik elhivatottságból csinálták. A saját pénzükből, a szabadidejükben, munka mellett, vagy olvasói támogatásból fenntartott nonprofit műhelyekben.',
    /** Külön bekezdés — a szerkesztőség-felsorolással együtt egy tömbben
     *  száz szó fölé menne, és pont ez a mondat a note lényege. */
    tail:
      'Egy főállású, üzleti alapon működő szerkesztőségnél az oknyomozás — minden tiszteletünk mellett — valamennyire a munkaköri leírás része is. Itt azoké a hely, akiknek senki nem írta elő.',
  },
  /** A bevezető ZÁRÓ eleme, közvetlenül a névsor előtt (user kérés,
   *  2026-09-16). Nem illusztráció: ez az érzelmi felütés, amiről az
   *  egész fal szól — a rendszerváltás utáni első reggel. A szöveg
   *  szándékosan a listába vezet át. */
  heroVideo: {
    id: 'FjFtiTu9LOE',
    label: '2026. április 13. — az első reggel',
    title: 'Jóóóó reggelt MAGYARORSZÁÁÁÁG!',
    summary:
      'Ilyen volt kimenni az utcára azon a reggelen — Magyarósi Csaba felvétele. Ez a videó nem oknyomozó riport és nem elemzés: ez a jutalomjáték. Csakhogy április 13-a nem magától virradt fel. Hogy azon a reggelen ezt lehessen érezni, előtte évekig kellett valakinek közbeszerzési iratokat olvasnia hajnalig, pereket vinnie egy megtagadott adatért, kamerát tartania ott, ahol nem szívesen látták, és kimondania olyan mondatokat, amelyeknek akkor még ára volt. Ők jönnek most — név szerint.',
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
        'Hadházy Ákos az egyetemi tanulmányai után állatorvosként dolgozott, a közéletbe pedig helyi szinten, Szekszárdon kapcsolódott be — eredetileg a Fidesz színeiben, megyei közgyűlési tagként és önkormányzati képviselőként. A párttal akkor szakított véglegesen, amikor a saját politikai közösségén belüli súlyos visszaéléseket, különösen a helyi trafikmutyik rendszerét kezdte szóvá tenni: előbb belső körökben, majd a nyilvánosság előtt is.',
        'A szakítás után az országos politikában az elszámoltatás lett a fő profilja. 2016-tól az LMP társelnökeként dolgozott, a 2018-as választás után viszont úgy döntött, elhagyja a pártpolitikai struktúrákat, és független országgyűlési képviselőként folytatja. Ez a független státusz adta meg azt a mozgásteret, amely az elkövetkező évek kimerítő oknyomozó munkájához kellett.',
        'A módszere alapjaiban formálta át a magyar tényfeltáró politizálást. Nem szónoklatokra és nem is kiszivárogtatásokra épített, hanem arra, ami amúgy is nyilvános — csak senki nem olvasta végig.',
      ],
    },
    related: [
      { label: 'Feljelentések nyilvántartása', href: '/adatbazis' },
      { label: 'Kiemelt ügyek', href: '/ugyek' },
    ],
    live: true,
    detail: {
      seoTitle: 'Hadházy Ákos: Hatvanpuszta, Volvo-gate és a feljelentései',
      seoDescription:
        'Mit tárt fel Hadházy Ákos? A hatvanpusztai luxusbirtok, a besétálás, a szafari túrák, a Volvo-gate újranyitása és a lélegeztetőgépek — konkrét ügyek, forrásokkal.',
      lead:
        'Hadházy Ákos független országgyűlési képviselő a 2026. április 12-i rendszerváltást előkészítő antikorrupciós küzdelem legmeghatározóbb, intézményesült bástyája. Az ő szisztematikus, évekig tartó adatbányászata és terepmunkája adja a Kegyencjárat adatbázisának gazdasági gerincét.',
      cases: {
        heading: 'A legfontosabb ügyei',
        intro:
          'A lista nem teljes — évekig tartó, folyamatos munkáról van szó. Ezek azok, amelyeknél a feltárás vagy az eljárás elindítása egyértelműen hozzá köthető, és amelyekhez saját ügyoldalunk is tartozik.',
        items: [
          {
            title: 'Hatvanpuszta — a „mezőgazdasági létesítmény", amiből luxusrezidencia lett',
            when: '2021-től folyamatosan',
            body:
              'A miniszterelnök édesapjához köthető alcsúti hatvanpusztai birtokról a kormányzati kommunikáció és a hivatalos papírok éveken át azt sulykolták, hogy a területen mindössze egy befejezetlen, funkcionális célokat szolgáló gazdasági majorság épül. Hadházy Ákos 2021-től indított el egy szisztematikus, éveken át tartó helyszíni megfigyelést: rendszeresen látogatta a helyszínt, légi felvételeket készített, és követte a területre belépő luxusjárműveket és építőipari gépeket.',
            more: [
              'Az általa nyilvánosságra hozott dokumentáció feltárta a valóságot: a területen egy mintegy hatezer négyzetméternyi nettó alapterületű épületegyüttes emelkedett ki a földből, a létező legdrágább építőanyagok és belsőépítészeti megoldások használatával.',
              'Az oknyomozó hagyományt folytatta ezzel — közvetlenül építve a 2015-ben elhunyt Ferenczi Krisztina úttörő munkájára, aki elsőként kezdte módszeresen dokumentálni az Orbán és Mészáros családok dél-fejér megyei vagyonosodását. Hadházy tette viszont végleg közismertté a birtok valódi arcát: ő vezette be a közbeszédbe a „Luxuspuszta" kifejezést, amely azóta elválaszthatatlanul rajta ragadt az uradalmon.',
              'A drónfelvételek és a távoli fotók egy idő után elveszítik az újdonság erejét — ezt felismerve két radikálisabb, a fizikai jelenlétre épülő eszközhöz nyúlt. 2025 augusztusában kihasználta, hogy az építkezés során a birtok egyik hátsó kapuját nyitva hagyták, és engedély nélkül besétált a szigorúan őrzött területre. Mobiltelefonnal, folyamatos felvételt készítve járta be a belső udvarokat, rögzítve a mélygarázsokat és a luxus szintű belső burkolatokat, mielőtt a kertész és a biztonsági személyzet távozásra szólította fel. Az érvelése frappáns volt: magánlaksértésről vagy birtokháborításról elvileg nem lehet szó egy olyan ingatlannál, amelyet a kormányzati kommunikáció befejezetlen mezőgazdasági üzemként definiál.',
              'A másik eszköze az volt, hogy a nyilvánosságot vitte oda: rendszeres buszos túrákat szervezett a birtokhoz, zuglói indulással, alkalmanként több busznyi érdeklődővel. A lényeg az volt, hogy a választópolgárok ne a képernyőn keresztül, hanem a saját szemükkel döntsék el, gazdasági épületet vagy luxuskastélyt látnak-e. A meghívókban tüntetéssel egybekötött „szafari túrának" hívták; az utolsó nagy körutat 2026 márciusában, közvetlenül a választás előtt tartotta.',
            ],
            highlight: {
              heading: 'Amikor felborult a biztonsági őr autója — 2025. augusztus 19.',
              body:
                'Hadházy éppen a birtok környéki nyilvános utakon autózott, amikor a hatvanpusztai birtok védelmét ellátó biztonsági szolgálat egyik terepjárós őre agresszívan üldözőbe vette a kocsiját, majd az üldözés során oldalról nekiütközött. Az ütközés erejétől a vagyonőr saját járműve elvesztette a stabilitását és felborult. Az esetet az anyósülésen utazó Gulyás Balázs, a Gulyáságyú Média újságírója az első másodperctől videóra vette — enélkül az ügy megmaradt volna a klasszikus „állítás állítással szemben" szintjén. A Bicskei Rendőrkapitányság közúti veszélyeztetés bűntettének alapos gyanúja miatt indított eljárást a sofőr ellen, akiről kiderült, hogy Mészáros Lőrinc biztonságtechnikai cégének alkalmazásában állt. A nyomozást 2025 novemberében megszüntették, arra hivatkozva, hogy az őr nem veszélyeztette a képviselő testi épségét; az ügyet átminősítették, és az őr végül szabálysértési eljárásban 80 ezer forint pénzbírságot és három hónap járművezetéstől eltiltást kapott.',
              video: {
                id: 'ahlzM1ub9IA',
                label: 'Gulyáságyú Média',
                title: 'Így ÜLDÖZTÉK HADHÁZY autóját Hatvanpusztán',
                summary: 'A teljes felvétel az anyósülésről — az üldözéstől az ütközésen át a borulásig.',
              },
              sources: [
                { source: '444', date: '2025. aug. 25.', headline: 'Videón, ahogy a hatvanpusztai biztonsági őr nekimegy Hadházy Ákos autójának', url: 'https://444.hu/2025/08/25/videon-ahogy-a-hatvanpusztai-biztonsagi-or-nekimegy-hadhazy-akos-autojanak' },
                { source: 'Telex', date: '2025. nov. 12.', headline: 'A rendőrség szerint a hatvanpusztai birtok őre nem veszélyeztette Hadházy Ákos testi épségét, amikor nekiment a kocsijának', url: 'https://telex.hu/belfold/2025/11/12/hadhazy-akos-hatvanpuszta-utkozes-baleset-borulas-biztonsagi-or-rendorseg-nyomozas-lezaras' },
                { source: 'Népszava', headline: 'Pénzbírságot kapott a hatvanpusztai vagyonőr, aki nekiment Hadházy Ákos autójának', url: 'https://nepszava.hu/3307453_hatvanpuszta-hadhazy-rendorseg-szabalysertesi-birsag' },
              ],
            },
            sources: [
              { source: 'Szabad Európa', headline: 'Hadházy Ákos Hatvanpusztáról: „Itt 6000 négyzetmétert építettek fel a legdrágább anyagokból"', url: 'https://www.szabadeuropa.hu/a/hatvanpuszta-orban-meszaros-gazdasag-vagyonosodas/33540911.html', lead: 'Elsőként a 2015-ben elhunyt Ferenczi Krisztina dokumentálta az Orbán- és a Mészáros-család dél-fejér megyei vagyonosodását.' },
              { source: '444', date: '2025. aug. 27.', headline: 'Hadházy Ákos múlt héten bement Hatvanpusztára, most kitette az ott készült videót', url: 'https://444.hu/2025/08/27/hadhazy-akos-mult-heten-bement-hatvanpusztara-most-kitette-az-ott-keszult-videot' },
              { source: 'Index', headline: 'Luxuspusztának nevezte Hadházy Ákos az Orbán család birtokát', url: 'https://index.hu/belfold/2025/09/05/hadhazy-akos-hatvanpuszta-luxuspuszta-garancsi-istvan-tiborcz-istvan-orban-viktor-miniszterelnok-golfklub/' },
              { source: 'Telex', date: '2026. márc. 17.', headline: 'Hadházy Ákos még szervez egy túrát Hatvanpusztára a választások előtt', url: 'https://telex.hu/belfold/2026/03/17/hadhazy-akos-hatvanpuszta-kirandulas' },
            ],
            promo: {
              href: '/ugyek/hatvanpuszta',
              eyebrow: 'Kiemelt ügy · Hatvanpuszta',
              title: 'Mennyit ér valójában a hatvanpusztai birtok?',
              lead:
                'Becsült ingatlanérték, ismeretlen vagyonforrás, vagyonnyilatkozat — az ügy teljes feldolgozása a saját oldalán: ki a felelős, mi a gyanú, és hol tart most.',
              cta: 'Az ügy megnyitása',
            },
          },
          {
            title: 'Pécsi Volvo-gate — az újranyitott nyomozás',
            when: '2026',
            body:
              'Pécs városa használt Volvo autóbuszokat vásárolt a tömegközlekedési flotta megújítására, ám a beszerzést egy bonyolult közvetítői hálózaton keresztül, mesterségesen feltornászott felárral bonyolították le — a várost és a költségvetést 700 millió forintnyi bizonyított közkár érte. A nyomozás adatai szerint az elcsalt pénzek jelentős része offshore csatornákon keresztül Thaiföldre vándorolt.',
            more: [
              'Bár a bírósági eljárásban születtek részleges ítéletek és felmentések, a politikai szempontból igazán fontos háttérszereplőket a korábbi hatóságok érintetlenül hagyták. Hadházy 2026-ban benyújtott, új bizonyítékokkal alátámasztott feljelentése nyomán a Fejér Megyei Rendőr-főkapitányság hivatalosan elrendelte a nyomozás újbóli megnyitását — immár kifejezetten azokra a szereplőkre fókuszálva, akiket a vádemelés korábban nem érintett.',
              'Az ügy mellékszálaként 2024-ben nagy vihart kavart fotót készített a Parlament mélygarázsában: dokumentálta, hogy Bánki Erik fideszes képviselő egy olyan luxus sport BMW-vel érkezett a törvényhozáshoz, amely egy közétkeztetési tendereken rendkívül sikeres cégcsoport tulajdonában állt. A szimbolikus pikantériát a rendszám adta: a betűkombináció a pécsi Volvo-gate harmadrendű vádlottjának nevére utalt.',
            ],
            sources: [
              { source: 'RTL', date: '2024. júl. 9.', headline: 'A fideszes Bánki Erik egy közétkeztetési tendereken sikeres csoporthoz köthető cégtől bérel sportautót', url: 'https://rtl.hu/belfold/2024/07/09/banki-erik-hungast-csoport-sportauto-bmw-hadhazy-akos' },
            ],
            promo: {
              href: '/ugyek/pecsi-volvo-gate',
              eyebrow: 'Kiemelt ügy · Pécsi Volvo-gate',
              title: 'Hogyan lett 700 millió forint közkár egy buszbeszerzésből?',
              lead:
                'Felárral vett használt buszok, Thaiföldre vándorolt pénz, felmentés, majd az ítélet megsemmisítése és újratárgyalás. A teljes ügy időrendben, szereplőkkel.',
              cta: 'Az ügy megnyitása',
            },
          },
          {
            title: 'Lélegeztetőgépek — a járvány árnyékában',
            body:
              'A rendkívüli jogrend időszaka biztosította a legátláthatatlanabb terepet a hirtelen állami beszerzéseknek. Hadházy a teljes lezárások és a titkosítások idején is módszeresen nekilátott a lélegeztetőgép-beszerzés átvilágításának. Az általa feltárt adatsorok három rendszerszintű problémát hoztak felszínre: a gépeket a világpiaci árhoz képest sokszoros felárral vásárolta meg az állam; gyanús hátterű, sokszor frissen alapított cégek iktatódtak be a láncolatba; a beszerzett sok ezer berendezés jelentős része pedig raktárakban ragadt, mert technikailag alkalmatlan volt a magyar egészségügyi hálózatban való üzemeltetésre.',
            more: [
              'Nem elégedett meg a parlamenti írásbeli kérdésekkel: a megszerzett számlákból és vámáru-nyilatkozatokból számokkal alátámasztott pénzügyi modellt és videós összefoglalót készített, amely azóta is a Kegyencjárat ügyoldalának szakmai és vizuális alapját képezi.',
            ],
            promo: {
              href: '/ugyek/lelegeztetogep',
              eyebrow: 'Kiemelt ügy · Lélegeztetőgépek',
              title: 'Mennyibe kerültek valójában a lélegeztetőgépek?',
              lead:
                'A járvány legnagyobb beszerzési ügye: árak, közvetítők, és hogy mi lett a sok ezer géppel. Az ügy teljes feldolgozása a saját oldalán.',
              cta: 'Az ügy megnyitása',
            },
          },
        ],
      },
      table: {
        heading: 'Hogyan aránylanak egymáshoz a legfontosabb ügyei?',
        intro:
          'Röviden összefoglalva a hozzá köthető legfontosabb tényfeltáró projektek jellemzőit — a közkár nagyságrendjét és azt, milyen módszerrel jutott el hozzájuk.',
        columns: ['Ügy', 'Érintett terület és főszereplők', 'Feltárt közkár / jellemző', 'Munkamódszer'],
        rows: [
          ['Hatvanpuszta', 'Orbán- és Mészáros-család uradalma', '6000 m²-es luxusrezidencia', 'Helyszíni szafarik, besétálás, légi felvételek'],
          ['Pécsi Volvo-gate', 'Buszbeszerzés, Bánki Erik szála', '700 millió forint bizonyított kár', 'Cégiratok, 2026-os új feljelentés'],
          ['Lélegeztetőgépek', 'Járványügyi veszélyhelyzeti beszerzések', 'Sok ezer raktárban ragadt gép', 'Vámadatok és számlák végigvezetése'],
        ],
      },
      videoBlock: {
        heading: 'Hatvanpuszta, ahogy ő mutatta meg',
        items: [
          {
            id: 'AnJ-SfY8tjA',
            label: 'ATV',
            title: 'Hadházy Ákos gond nélkül besétált a hatvanpusztai birtokra, amit tudott, levideózott',
            summary:
              'A nyitva hagyott hátsó kapu, néhány perc a birtokon, majd a kertész. A felvétel maga a válasz arra a kérdésre, hogy befejezetlen gazdasági épületről van-e szó.',
          },
        ],
      },
      extra: [
        {
          heading: 'A módszer: nyilvános adatból épített ügyek',
          paragraphs: [
            'A módszertana öt pilléren nyugszik: a közbeszerzési értesítők szisztematikus átfésülésén, a cégbírósági iratokból kibogozott offshore cégláncokon és tulajdonosi összefonódásokon, a miniszteri keretekből kiosztott egyedi támogatások nyomon követésén, az uniós pályázati portálok tételes ellenőrzésén — és ötödikként azon, hogy a dokumentumokat csonkítatlanul, teljes terjedelemben közzétette.',
            'Ez a megközelítés lassú és monoton munkát igényel, cserébe viszont az így nyert bizonyítékok jogilag és politikailag is megtámadhatatlanok. A teljes közzététellel pedig elérte, hogy az állításait független újságírók, sőt szkeptikus állampolgárok is lépésről lépésre ellenőrizhessék. A parlamenti munkája mellett rendszeres utcai demonstrációkat és blokádokat is szervezett, hogy közvetlen nyomást gyakoroljon a hatóságokra.',
          ],
        },
        {
          heading: 'A bedarált feljelentésekből lett a 2026 utáni elszámoltatás gerince',
          paragraphs: [
            'Politikai pályája során több száz hivatalos feljelentést tett a nyomozó hatóságoknál és az ügyészségen. Az esetek túlnyomó többségében az ügyészségi szervezet és a rendőrség még a nyomozati szakban elutasította a beadványokat, vagy bűncselekmény hiányában megszüntette az eljárásokat.',
            'Ez a látszólagos kudarcsorozat a 2026. április 12-i fordulat után teljesen új értelmet nyert. Az a gyakorlata, hogy a feljelentések mellé a teljes, rendszerezett bizonyítéki dokumentációt is csatolta és megőrizte, megmentette ezeket az ügyeket az elenyészéstől. Az újonnan felállított független antikorrupciós szervek így nem a nulláról kezdik a munkát, hanem a kész aktákat veszik elő.',
            'A pécsi buszbeszerzés 2026-os sikeres újraindítása a precedens: bizonyítja, hogy az évekig elfektetett ügyekben is el lehet érni valós felelősségre vonást, ha megváltozik a nyomozóhatósági akarat.',
          ],
        },
        {
          heading: 'Milyen kritikák érték a munkáját?',
          paragraphs: [
            'Hadházy megítélése sosem volt egységes, még a kormánykritikus oldalon sem. A leggyakoribb kritika a „magányos harcos" attitűd volt: sokan felrótták neki, hogy a szisztematikus adatgyűjtés közben hajlamos volt elszigetelődni az országos szövetségépítéstől, és a szélesebb pártstruktúrák kialakítása helyett egyéni akciókra koncentrált.',
            'A 2024-es és 2025-ös politikai földrengés idején többször hangoztatta, hogy a személyi cserék önmagukban nem elegendőek: szigorú strukturális és jogi garanciákra van szükség ahhoz, hogy a korrupció rendszerszinten se térhessen vissza. Ez a kompromisszumot nem ismerő hozzáállás alkalmanként súlyos vitákhoz vezetett a gyors politikai győzelemre törekvő új formációkkal. Az idő azonban őt igazolta: a kormányváltás után az új adminisztráció is kénytelen elismerni, hogy az általa felhalmozott tudásbázis és adatváz nélkül az elszámoltatási ígéretek üres jelszavak maradtak volna.',
          ],
        },
      ],
      faq: [
        {
          q: 'Ki Hadházy Ákos?',
          a: 'Állatorvos, korábban a Fidesz helyi politikusa Szekszárdon, aki a helyi trafikmutyik rendszerét kezdte szóvá tenni, majd kilépett. 2016-tól az LMP társelnöke, 2018 óta független országgyűlési képviselő.',
        },
        {
          q: 'Mit tárt fel Hadházy Ákos Hatvanpusztán?',
          a: 'Azt, hogy a hivatalosan befejezetlen mezőgazdasági létesítménynek nevezett birtokon mintegy hatezer négyzetméternyi épületegyüttes áll a legdrágább anyagokból. Ő vezette be a „Luxuspuszta" kifejezést, buszos túrákat szervezett oda, 2025 augusztusában pedig be is sétált és levideózta, amit látott.',
        },
        {
          q: 'Mi történt 2025. augusztus 19-én Hatvanpusztán?',
          a: 'A birtok egy terepjárós biztonsági őre üldözőbe vette Hadházy autóját, majd oldalról nekiütközött; az őr saját járműve felborult. Az esetet a kocsiban ülő Gulyás Balázs videóra vette. A nyomozást megszüntették, az őr végül szabálysértésért 80 ezer forint bírságot és három hónap eltiltást kapott.',
        },
        {
          q: 'Mi köze Hadházy Ákosnak a Volvo-gate-hez?',
          a: 'A 2026-os feljelentése nyomán rendelte el a Fejér Megyei Rendőr-főkapitányság a pécsi buszbeszerzési ügy nyomozásának újranyitását, azokra a szereplőkre fókuszálva, akiket a korábbi vádemelés nem érintett.',
        },
        {
          q: 'Hány feljelentést tett?',
          a: 'Több százat. A többségüket még a nyomozati szakban elutasították, de mivel a teljes bizonyítéki dokumentációt is csatolta és megőrizte, ezek az akták a 2026 utáni elszámoltatás kiindulópontjai lettek.',
        },
      ],
    },
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
      links: [{ text: 'a Partizán', href: '/rendszervaltas/partizan' }],
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
    live: true,
    detail: {
      seoTitle: 'Partizán: a csatorna, ami médiatörténelmet írt',
      seoDescription:
        'A Partizán közösségi finanszírozású videós műhely. Az első Magyar Péter-interjú, a Szabó Bence-ügy, a 4iG-bizniszek — és a legfrissebb adások egy helyen.',
      lead:
        'A Partizán nézői támogatásból fenntartott videós műhely, amely hosszú, vágatlan, élőben közvetített beszélgetésekre épül. 2024 februárjában itt adott először interjút az a Magyar Péter, akinek a fellépéséből a 2026-hoz vezető politikai folyamat elindult — de a műhely azóta sem állt le: a legfrissebb oknyomozó adásaik továbbra is milliós nagyságrendű közönséget érnek el.',
      cases: {
        heading: 'Amit a Partizán megváltoztatott',
        intro:
          'Egy YouTube-csatornáról nehéz elhinni, hogy politikatörténeti tényező. Ez a négy eset megmutatja, pontosan hogyan lett azzá — és hogy nem egyetlen szerencsés adásról van szó.',
        items: [
          {
            title: 'Az első Magyar Péter-interjú',
            when: '2024. február 11.',
            body:
              'Varga Judit volt igazságügyi miniszter exférje a Partizán stúdiójában szólalt meg először nyilvánosan, néhány nappal a kegyelmi botrány kirobbanása után. Az adást hetvenezren nézték élőben, néhány óra alatt félmillióan, azóta pedig milliós nagyságrendben.',
            more: [
              'Ami ezt médiatörténeti pillanattá tette, nem a nézettség volt, hanem a formátum. Egy órákig tartó, vágatlan beszélgetésből nem lehet kiemelni egyetlen mondatot és arra építeni a cáfolatot: a néző maga hallotta az egészet, a kontextussal együtt. Innentől számítható az a politikai folyamat, amely 2026. április 12-ig vezetett.',
              'Az interjú kirobbanó hatásához az is hozzátartozik, hogy máshol nem készülhetett volna el. Egy hirdetésből élő kereskedelmi csatornán egy ilyen beszélgetés tulajdonosi, hirdetői és jogi egyeztetések sorozatán ment volna keresztül — ha egyáltalán eljut az adásig.',
            ],
            sources: [
              { source: 'Mérce', date: '2024. febr. 12.', headline: 'Öt pontban Magyar Péter Partizán-interjújáról', url: 'https://merce.hu/2024/02/12/magyar-peter-partizan-interju-rogan-antal-elemzes/' },
            ],
          },
          {
            title: 'A Szabó Bence-interjú — amikor a titkosszolgálat került a képbe',
            when: '2026. március',
            body:
              'Néhány héttel a választás előtt egy volt őrnagy, Szabó Bence adott csaknem másfél órás interjút a Partizánnak arról, hogyan gyakorolt rá nyomást az Alkotmányvédelmi Hivatal, hogy ellenzéki párthoz köthető informatikusokat vizsgáljanak. Az élő adást kilencvenezren nézték egyszerre, a folytatás pedig másfél nap alatt egymilliós megtekintésnél járt.',
            more: [
              'Ez az az eset, ahol a csatorna szerepe már nem a nyilvánosság megteremtése volt, hanem a védelemé: egy bejelentő számára az jelentette a biztonságot, hogy amit elmond, azt egyszerre több százezren hallják, és nem lehet utólag „félreértésnek" minősíteni.',
              'A sztori nem itt kezdődött: Szabó Bence az első interjúját a Direkt36-nak adta, néhány nappal korábban. A Partizán szerepe az volt, hogy ezt a történetet élő adásban, nagy tömeg előtt is elmondhatóvá tette. Két különböző műhely, két különböző funkció — a Direkt36 profilja is megtalálható ezen a falon.',
            ],
            videos: [
              {
                id: 'roI9C9zraLE',
                label: 'Partizán · 2026',
                title: 'A Tisza elleni titkosszolgálati akcióról kérdezzük Szabó Bence volt nyomozót',
                summary: 'A teljes, vágatlan beszélgetés — ez az az adás, amelyet másfél nap alatt egymillióan néztek meg.',
              },
            ],
            promo: {
              href: '/rendszervaltas/direkt36',
              eyebrow: 'A falon · Direkt36',
              title: 'Itt adta az első interjúját Szabó Bence',
              lead:
                'A Partizán-adás előtt néhány nappal a Direkt36-nak szólalt meg először a nyomozó. Az az interjú — és ami utána történt vele — a Direkt36 oldalán nézhető meg.',
              cta: 'Tovább a Direkt36-hoz',
            },
            sources: [
              { source: '444', date: '2026. márc. 27.', headline: 'Szabó Bence: Üdvözlöm Gulyás Gergely nyilatkozatát, hiszen beigazolta, hogy titkosszolgálatok álltak az egész művelet mögött', url: 'https://444.hu/2026/03/27/szabo-bence-letaglozo-volt-visszanezni-a-reakciokat', lead: 'A Partizánnak nyilatkozott a volt rendőrszázados, akit sokan hősnek tartanak, miután részletesen beszélt arról, milyen titkosszolgálati akció folyhatott a Tisza ellen.' },
              { source: 'Magyar Hang', date: '2026. márc. 27.', headline: 'Szabó Bence: Elég megterhelő volt az elmúlt két nap', url: 'https://hang.hu/belfold/szabo-bence-partizan-186936' },
            ],
          },
          {
            title: 'A nézőkből felépített szerkesztőség',
            body:
              'A műhely hirdetői és állami pénz nélkül, a nézők havi támogatásából működik. Ez nem pénzügyi részlet, hanem a lényeg: pontosan azt a nyomásgyakorlási felületet szüntette meg, amellyel a magyar médiapiac nagy részét kezelni lehetett.',
            more: [
              'A 2010-es évek magyar médiaátalakításának a legfontosabb eszköze nem a cenzúra volt, hanem a tulajdonlás és a hirdetési pénz. Egy szerkesztőséget elég volt megvásárolni, vagy kiéheztetni azzal, hogy az állami és az állami közelben lévő vállalatok hirdetései elkerülik. Ez a fogás olyan lapoknál is működött, ahol egyetlen újságírót sem kellett elbocsátani — elég volt a tulajdonos.',
              'Egy több tízezer apró támogatóból élő szerkesztőségnél viszont nincs az az egy telefon, amivel el lehet intézni a dolgot. Ezért volt a finanszírozási forma önmagában is politikai állítás.',
            ],
          },
          {
            title: 'Élő közvetítés ott, ahol más nem volt jelen',
            body:
              'Tüntetések, parlamenti események, választási éjszakák: a Partizán rendszeresen közvetített élőben olyan helyszínekről, ahonnan más szerkesztőségnek nem volt kapacitása vagy szándéka. A YouTube-alapú terjesztés miatt egy-egy adás elérése független volt attól, hogy a nagy hírportálok átvették-e — nem kellett hozzá se kábelcsomag, se címlap.',
          },
        ],
      },
      videoBlock: {
        heading: 'És azóta is folytatják a tényfeltárást',
        intro:
          'A fordulat után sok minden abbamaradt a magyar közéletben — ez nem. Az alábbi két adás néhány napja jelent meg, és nagyjából egymilliós nagyságrendű nézettségnél jár. Ez a válasz arra a kérdésre, hogy a Partizán csak a rendszerváltás előtti időszak jelensége volt-e.',
        items: [
          {
            id: 'FnJbu5IpTPc',
            label: 'Partizán · oknyomozás',
            title: 'Mészáros vadászházától a csillagos égig: Orbán és a 4iG bizniszei',
            summary:
              'A vadászháztól az űriparig: hogyan épült fel egy cégbirodalom állami megrendelésekből. Néhány nap alatt közel egymillió megtekintés.',
          },
          {
            id: 'ge5S3g4XWXY',
            label: 'Partizán · oknyomozás',
            title: 'Családi ebéden döntött Orbán a kirúgásáról | Színre lép a titkos informátor',
            summary:
              'Egy informátor, aki a kormányzat belsejéből beszél arról, hogyan születtek a személyi döntések.',
          },
        ],
      },
      videoGrid: {
        heading: 'A csatorna legnézettebb adásai',
        intro:
          'A Partizán teljes feltöltési listájából (több mint négyezer videó) a mindenkori legnézettebbek.',
        channelUrl: 'https://www.youtube.com/@Partizánmédia/videos',
        channelLabel: 'A csatorna összes videója',
        items: [
          { id: 'bQvLR768Ueo', title: 'VÁLASZTÁS 2026 | Véget ért Orbán Viktor 16 éves kormányzása, kétharmadot szereztek Magyar Péterék', note: '2,9 M megtekintés' },
          { id: 'X8I4RSSTv9U', title: 'Puzsér Róbert vs. Gulyás Márton | A felkérdezés napja', note: '2,7 M megtekintés' },
          { id: 'epfgWkEcvj0', title: '"A Balázsék olyan, mint egy epershake: megiszod, kidobod, öt perc múlva el is felejted"', note: '1,7 M megtekintés' },
          { id: 'kJk8IpRi4L4', title: 'Heti Hetes | először és utoljára együtt 2020-ban!', note: '1,7 M megtekintés' },
          { id: 'aCtyZ8xw8To', title: 'Bödőcs: Orbán Viktornak köszönhetem a művészi szabadságom | Interjú hazánk első számú humoristájával', note: '1,6 M megtekintés' },
          { id: 'd2tUmYaeLMg', title: 'A Tisza kiütötte az ellenzéket, a Fidesz meggyengült, fej-fej mellett Karácsony és Vitézy', note: '1,6 M megtekintés' },
          { id: '_3m4wtII9ew', title: 'VÁLASZTÁS 2026 | Nappali élő közvetítés', note: '1,5 M megtekintés' },
          { id: 'eU2eWHna26I', title: 'Így úszhatta meg Gattyán György: a húszmilliárdos adócsalás, amit eltussoltattak a NAV-val', note: '1,3 M megtekintés' },
          { id: 'Z1tZ0fq2WtM', title: 'Ricsinek évekig volt viszonya a középiskolai tanárával, de ezt senki se irigyelje', note: '1,3 M megtekintés' },
          { id: '0u7-QHvmkPs', title: '🏳️‍🌈 Hiába Orbánék tiltása, soha nem látott tömeg a Budapest Pride-on | Élő közvetítés', note: '1,2 M megtekintés' },
          { id: '5j9ELNPHSpY', title: 'Magyar Péter: Miniszterelnöki ambícióim nincsenek, de hogyha ez a felkérés, készen állok rá', note: '1,2 M megtekintés' },
          { id: '9ktCKkFKFgE', title: 'Bige: Orbán már döntött az ügyemről | Interjú a háziőrizetben lévő milliárdossal', note: '1,1 M megtekintés' },
        ],
      },
      extra: [
        {
          heading: 'Mit jelent a közösségi finanszírozás a gyakorlatban?',
          paragraphs: [
            'A „nézői támogatásból működik" mondat könnyen hangzik üres marketingnek, pedig nagyon konkrét működési következményei vannak. Egy hirdetésből élő szerkesztőségnél minden téma mögött ott van a kérdés, hogy melyik hirdető melyik cikktől lesz ideges. Egy előfizetői modellnél ez enyhül, de nem tűnik el: az előfizetőt is el lehet veszíteni. Egy több tízezer apró támogatóra épülő modellnél viszont egyetlen szereplő kiesése sem jelent egzisztenciális fenyegetést.',
            'A másik oldala, hogy ez a modell folyamatos, látható teljesítménykényszert jelent. Aki havonta fizet, az bármikor le tudja mondani — nem egy évre elkötelezett hirdetési szerződésről van szó. Ez a szerkesztőségeket arra kényszeríti, hogy folyamatosan bizonyítsanak a nézőik felé, nem pedig egy tulajdonos felé.',
            'Magyarországon ez a forma azért vált kritikus fontosságúvá, mert a hagyományos utak sorra zárultak be. Nem elvi döntés volt tehát a közösségi finanszírozás, hanem a maradék járható út — amiről utólag kiderült, hogy egyben a legvédhetőbb is.',
          ],
        },
        {
          heading: 'Vezetőváltás a fordulat után',
          paragraphs: [
            'A Partizánt Gulyás Márton alapította, és éveken át ő volt a műhely arca és főszerkesztője. 2026 augusztusában bejelentette, hogy lemond a főszerkesztői pozíciójáról — a csatorna viszont működik tovább, és a friss adások nézettsége azt mutatja, hogy a közönség nem egyetlen személyhez kötődött.',
            'Ez önmagában is fontos állítás egy ilyen műhelyről. Sok közösségi finanszírozású projekt lényegében egy ember köré épül, és vele együtt ér véget. Az intézményesülés próbája pontosan az, hogy az alapító távozása után is megy-e tovább a munka.',
          ],
        },
        {
          heading: 'A Partizán és a Kegyencjárat',
          paragraphs: [
            'A Kegyencjárat podcast- és videórovata rendszeresen hivatkozik partizános anyagokra: számos olyan ügy van az adatbázisunkban, amelynek az első részletes, kontextusba helyezett feldolgozása itt jelent meg. A mi munkánk ebből a szempontból másodlagos — mi rendszerezzük és összekötjük azt, amit ők és a többi műhely kiásott.',
            'Ez a fal azért létezik, hogy ez a viszony látható legyen. Egy adatbázis könnyen kelti azt a látszatot, mintha az adatok maguktól állnának össze. Nem így van: minden sor mögött ott van valaki, aki elment a helyszínre, leült egy kamera elé, vagy végigolvasott több ezer oldalt.',
          ],
        },
      ],
      faq: [
        {
          q: 'Ki alapította a Partizánt?',
          a: 'Gulyás Márton, aki korábban a Krétakör színházi műhelyéből és a Közös Ország Mozgalomból volt ismert. 2026 augusztusában bejelentette, hogy lemond a főszerkesztői pozíciójáról; a csatorna azóta is működik. A saját profilja is megtalálható ezen az oldalon.',
        },
        {
          q: 'Miből él a Partizán?',
          a: 'Közösségi finanszírozásból: a nézők havi támogatásából. Nem hirdetői és nem állami bevételből — pont ez adja a függetlenségét.',
        },
        {
          q: 'Mikor volt az első Magyar Péter-interjú a Partizánon?',
          a: '2024. február 11-én. Az adást hetvenezren nézték élőben, néhány óra alatt félmillióan, azóta pedig milliós nagyságrendben.',
        },
        {
          q: 'Aktív még a Partizán a 2026-os fordulat után?',
          a: 'Igen. A legfrissebb oknyomozó adásaik — például a 4iG-bizniszekről szóló riport — néhány nap alatt közel egymilliós nézettséget érnek el.',
        },
      ],
    },
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
    detail: {
      seoTitle: 'Átlátszó: pert nyert adatok, drónfelvételek, oknyomozás',
      seoDescription:
        'Az Átlátszó közérdekű adatigénylésekkel és perekkel kényszerítette ki a nyilvánosságot. Samsung-bírságok, Szuverenitásvédelmi Hivatal, Hatvanpuszta — konkrét ügyek.',
      lead:
        'Az Átlátszó 2011 óta működő, közadakozásból és pályázatokból fenntartott oknyomozó portál. A legfontosabb eszköze nem a bennfentes forrás, hanem a közérdekűadat-igénylés — és ha megtagadják, a per.',
      cases: {
        heading: 'Perek, amiket megnyertek — és amiket nem elég megnyerni',
        intro:
          'Egy adatper évekig tart és pénzbe kerül. Cserébe viszont a végén kiadott dokumentum megtámadhatatlan: nem „állítás szemben állítással", hanem irat.',
        items: [
          {
            title: 'A gödi Samsung-gyár bírságai',
            when: '2026. május',
            body:
              'Jogerősen megnyerték a pert a gödi akkumulátorgyárra kiszabott hatósági bírságok adatainak kiadásáért. Egy ilyen ügyben az összeg és a jogcím önmagában is válasz arra a kérdésre, amit a hivatalos kommunikáció évekig kerülgetett.',
            sources: [
              { source: 'Hírextra', date: '2026. máj. 27.', headline: 'Jogerősen pert nyert az Átlátszó a gödi Samsung-gyár bírságai ügyében - Hírextra', url: 'https://www.hirextra.hu/2026/05/27/jogerosen-pert-nyert-az-atlatszo-a-godi-samsung-gyar-birsagai-ugyeben/', lead: 'Másodfokon is az Átlátszónak adott igazat a bíróság a Pest Vármegyei Kormányhivatallal szemben indított perben. A döntés értelmében a hivatalnak ki kell adnia a gödi Samsung-gyárra kiszabott munkavédelmi, tűzvédelmi és egyéb bírságokról szóló határozatokat.' },
            ],
          },
          {
            title: 'Szuverenitásvédelmi Hivatal — az a per, amit a hivatal nem fogadott el',
            when: '2026',
            body:
              'Az Átlátszó pert nyert a Szuverenitásvédelmi Hivatallal szemben, mire a hivatal fellebbezett — az érvelésük szerint a bíróságnak nincs hatásköre felettük. Másodfokon végül az eljárás megismétlését rendelték el. Ez a fajta elhúzódás önmagában is része a módszertannak: sokszor nem a per elvesztése a cél, hanem az idő.',
            sources: [
              { source: 'Átlátszó', date: '2026. márc. 19.', headline: 'Láncziék fellebbeztek az elmarasztaló ítélet ellen, szerintük a bíróságnak nincs hatalma felettük', url: 'https://atlatszo.hu/kozugy/2026/03/19/lancziek-fellebbeztek-az-elmarasztalo-itelet-ellen-szerintuk-a-birosagnak-nincs-hatalma-felettuk/' },
              { source: 'HVG', date: '2026. máj. 28.', headline: 'Csatát nyert a Szuverenitásvédelmi Hivatal, meg kell ismételni az eljárást az Átlátszó-perben', url: 'https://hvg.hu/itthon/20260528_szuverenitasvedelmi-hivatal-atlatszo-birosag-masodfoku-dontes-b' },
            ],
          },
          {
            title: 'Amikor a jogerős ítélet sem elég',
            when: '2026. január',
            body:
              'Egy honvédelmi tárcához köthető cég jogerős bírósági ítélet ellenére sem adta ki, ki engedélyezte egy szolgálati villa felújítását. Ez a másik oldal, amiről ritkán esik szó: az adatper megnyerése nem azonos az adat megszerzésével.',
            sources: [
              { source: 'Átlátszó', date: '2026. jan. 8.', headline: 'Jogerős ítélet ellenére sem adja ki a HM cége, ki adott engedélyt a Ruszin-Szendi Romulusz által használt villa felújítására', url: 'https://atlatszo.hu/kozadat/2026/01/08/jogeros-itelet-ellenere-sem-adja-ki-a-hm-cege-ki-adott-engedelyt-a-ruszin-szendi-romulusz-altal-hasznalt-villa-felujitasara/' },
            ],
          },
          {
            title: 'Hatvanpuszta a levegőből és az időben',
            body:
              'A portál drónfelvételekkel és archív műholdképekkel dokumentálta, hogyan alakult át a hatvanpusztai birtok az évek során, és megírta azt is, hogy a majorság generálkivitelezője Mészárosék családi cége volt. A módszer itt az összehasonlítás: nem egyetlen kép, hanem ugyanaz a helyszín öt és tíz évvel korábban.',
            sources: [
              { source: 'Átlátszó', date: '2025. szept. 12.', headline: 'Mészárosék közpénzbajnok családi cége a hatvanpusztai majorság generálkivitelezője', url: 'https://atlatszo.hu/kozpenz/2025/09/12/meszarosek-kozpenzbajnok-csaladi-cege-a-hatvanpusztai-majorsag-generalkivitelezoje/' },
              { source: 'Átlátszó', date: '2025. aug. 12.', headline: 'Miből lesz a cserebogár? Így festett a hatvanpusztai birtok öt és tíz évvel ezelőtt', url: 'https://atlatszo.hu/impakt/2025/08/12/mibol-lesz-a-cserebogar-igy-festett-a-hatvanpusztai-birtok-ot-es-tiz-evvel-ezelott/' },
            ],
          },
        ],
      },
      extra: [
        {
          heading: 'Az infrastruktúra, amit másoknak is építettek',
          paragraphs: [
            'Az Átlátszó nemcsak cikkeket írt, hanem eszközöket is létrehozott: drónos felvételi kapacitást, adatvizualizációkat, és nyilvános adatbázisokat, amelyeket más szerkesztőségek is használhattak. Üzemeltetik azt a felületet is, amelyen keresztül bárki benyújthat és nyomon követhet közérdekűadat-igénylést.',
            'Ez a fal legfontosabb tanulsága kicsiben: a feltárás nem sztorikból áll, hanem képességekből. Aki egy képességet felépít, az nemcsak a saját cikkeit teszi lehetővé, hanem mindenki másét is.',
          ],
        },
      ],
      faq: [
        {
          q: 'Mivel foglalkozik az Átlátszó?',
          a: 'Oknyomozó újságírással, adatújságírással és közérdekűadat-igénylésekkel. 2011 óta működik, közadakozásból és pályázatokból, nonprofit formában.',
        },
        {
          q: 'Mi az a közérdekűadat-igénylés?',
          a: 'Olyan kérelem, amellyel bárki kikérheti egy állami vagy önkormányzati szerv kezelésében lévő, közérdekű adatot. Ha a szerv megtagadja, az igénylő bírósághoz fordulhat — az Átlátszó módszertanának ez a második fele.',
        },
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
    detail: {
      seoTitle: 'K-Monitor: a korrupciós ügyek kereshető adatbázisa',
      seoDescription:
        'A K-Monitor antikorrupciós civil szervezet, amely a magyar sajtóban megjelent közpénzes cikkeket gyűjti kereshető adatbázisba. Mire jó ez, és hogyan használjuk mi is?',
      lead:
        'A K-Monitor antikorrupciós civil szervezet. Nem egyedi botrányokat robbant ki, hanem valami sokkal ritkábbat csinál: rendszerezve megőrzi őket. A magyar sajtóban megjelent, közpénzzel kapcsolatos cikkeket gyűjti és címkézi egy nyilvános, kereshető adatbázisban.',
      cases: {
        heading: 'Mit csinál pontosan a K-Monitor',
        items: [
          {
            title: 'A korrupciós cikkek közös archívuma',
            body:
              'Évek óta folyamatosan gyűjtik és címkézik a közpénzzel kapcsolatos sajtóanyagokat, szereplők és intézmények szerint rendszerezve. A jelentősége akkor mutatkozik meg, amikor egy ügy évekkel később újra előkerül: e nélkül minden egyes alkalommal elölről kellene kezdeni a kutatást, és minden újságírónak külön.',
          },
          {
            title: 'Nyílt adat — ezért van itt a Kegyencjárat is',
            body:
              'Az adatbázisuk nyílt licenc alatt érhető el, és a Kegyencjárat több ponton is erre támaszkodik: az ügy-ontológia és a forráshivatkozások jelentős része innen származik. Ez az oldal szó szerint nem létezne abban a formában, ahogy most van, ha a K-Monitor nem végezte volna el a rendszerezés munkáját.',
          },
          {
            title: 'Szakértői jelenlét az uniós forrásvitákban',
            body:
              'A gyűjtés mellett folyamatosan jelen voltak szakértői anyagokkal az uniós források átláthatóságáról szóló vitákban — abban a technikai, jogi rétegben, ahol egy-egy feltételrendszer megfogalmazása dönt arról, mennyi közpénz hová folyhat.',
          },
          {
            title: 'A pontosság mint alapkövetelmény',
            body:
              'Egy archívumnál a hiba nem egy cikkben marad benne, hanem beépül mindenki más munkájába, aki onnan dolgozik. A K-Monitor jelzéseire a Kegyencjárat is javított már hibás forrásattribúciókat a saját adatbázisában — ez a fajta visszacsatolás a szakmai minimum, és nem magától értetődő.',
          },
        ],
      },
      faq: [
        {
          q: 'Mi az a K-Monitor?',
          a: 'Antikorrupciós civil szervezet, amely a magyar sajtóban megjelent, közpénzzel kapcsolatos cikkeket gyűjti és címkézi egy nyilvános, kereshető adatbázisban, szereplők és intézmények szerint.',
        },
        {
          q: 'Használja a Kegyencjárat a K-Monitor adatait?',
          a: 'Igen. Az ügy-ontológia és a forráshivatkozások jelentős része a K-Monitor nyílt licencű adatbázisából származik; a forrásmegjelölés minden érintett ügynél szerepel.',
        },
      ],
      sources: [
        { source: 'Kegyencjárat', headline: 'Forráshivatkozások', url: 'https://www.kegyencjarat.hu/forrashivatkozasok' },
      ],
    },
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
        'A Direkt36 független, nonprofit oknyomozó újságírói műhely, amely nem a napi politikai adok-kapok közvetítéséből, nem hirdetésekből és nem kattintásszám-alapú bevételekből tartja fenn magát: a működésük alapját az olvasói támogatások és a szakmai alapítványi pályázatok adják.',
        'A piac döntő többségével szemben tudatosan elengedték a napi hírversenyt. Egy-egy tényfeltáró anyaguk hónapokig, esetenként több mint egy évig készül. A módszertanuk alapja az aprólékos háttérmunka: eldugott állami és külföldi cégnyilvántartások elemzése, sokszorosan ellenőrzött háttérbeszélgetések az államapparátus belső embereivel, és kiszivárgott adatsorok, szerződések strukturált feldolgozása.',
        'Ez a lassúság nem hátrány, hanem a legnagyobb fegyverük: az így megszülető cikkek olyan bizonyítékrendszerre épülnek, amelyet sajtóperekkel vagy politikai tagadással sem lehet megtámadni. Egy olyan környezetben, ahol a tényekre az első válasz szisztematikusan a hitelesség megkérdőjelezése volt, a patikamérlegen kimért forrásolás vált a védekezés eszközévé.',
      ],
    },
    live: true,
    detail: {
      seoTitle: 'Direkt36: az öt ügy, amivel a lassú oknyomozás bizonyított',
      seoDescription:
        'Elios, magánrepülők, Pegasus, orosz hackerek a Külügyminisztériumban, Szabó Bence vallomása. Mi az a Direkt36, és hogyan dolgoznak? Ügyek, forrásokkal.',
      lead:
        'Egy olyan korszakban, amikor a hírverseny a másodpercekről és a kattintásvadász címekről szólt, a Direkt36 tudatosan a lassú, hónapokig tartó feltáró munkát választotta. De hogyan tud egy alig néhány újságíróból álló csapat állami szintű titkosszolgálati műveleteket leleplezni?',
      cases: {
        heading: 'Az öt legfontosabb ügyük',
        intro:
          'A műhely története során beigazolódott, hogy a szívós adatbányászat és a belső források megszólaltatása közvetlenül hozzájárult a rendszer működésének leleplezéséhez — és a Kegyencjárat adatbázisának megalapozásához.',
        items: [
          {
            title: 'Az Elios-ügy — a miniszterelnöki vej felemelkedése',
            when: '2015-től folyamatosan',
            body:
              'A műhely egyik legkorábbi, iskolateremtő sorozata a Tiborcz Istvánhoz köthető Elios Innovatív Zrt. uniós közvilágítási tendereinek teljes körű bemutatása volt. Az újságírók megszerezték és tételesen összehasonlították az önkormányzatok által kiírt pályázatok feltételeit.',
            more: [
              'Hónapok munkájával bizonyították be, hogy a tendereket szisztematikusan, szinte pontról pontra úgy szabták rá az Eliosra, hogy a konkurenciát kizárják: olyan specifikus technikai és referencia-követelményeket határoztak meg, amelyeket kizárólag az akkori érdekeltség tudott teljesíteni. A közpénzek elfolyása tehát nem véletlenszerű volt, hanem rendszerszintű, közvetlenül a legfelsőbb politikai családi körökhöz csatornázva az uniós forrásokat.',
              'A sorozat több szálon futott. Kiderült, hogy a Miniszterelnökség hogyan segítette a pályázati sikereket; hangfelvétel bizonyította, hogy a Tiborcz-cég már azelőtt tárgyalt egy projektről, hogy a pályázatot egyáltalán kiírták volna; és a cikkek azt is dokumentálták, hogy a pályázatokba mélyebben belenyúltak, mint ahogy addig látszott.',
              'A cikkek és a nyilvánosságra hozott dokumentumok szolgáltak alapul az Európai Csalás Elleni Hivatal, az OLAF vizsgálatához, amely megállapította a rendszerszintű csalás tényét, és javasolta a támogatási összeg megvonását. Ez lett a hazai oligarchikus gazdagodás első teljesen dokumentált és nemzetközileg is elismert mintapéldája.',
            ],
            sources: [
              { source: 'Direkt36', date: '2016. máj. 25.', headline: 'Így segítette a Miniszterelnökség Orbán vejének közbeszerzési sikereit', url: 'https://www.direkt36.hu/igy-segitette-a-miniszterelnokseg-orban-vejenek-kozbeszerzesi-sikereit/' },
              { source: 'Direkt36', date: '2017. jan. 31.', headline: 'Hangfelvétel bizonyítja, hogy a Tiborcz-cég már akkor tárgyalt egy projektről, amikor még ki sem írták rá a pályázatot', url: 'https://www.direkt36.hu/hangfelvetel-bizonyitja-hogy-a-tiborcz-ceg-mar-akkor-targyalt-egy-projektrol-amikor-meg-ki-sem-irtak-ra-a-palyazatot/' },
              { source: 'Direkt36', date: '2018. jan. 18.', headline: 'Összevissza beszél Lázár János Tiborczék gyanússá vált közbeszerzéseiről', url: 'https://www.direkt36.hu/osszevissza-beszel-lazar-janos-tiborczek-gyanussa-valt-kozbeszerzeseirol/' },
              { source: 'Direkt36', date: '2018. febr. 20.', headline: 'Mélyebben belenyúltak az Elios pályázataiba, mint ahogy eddig látszott', url: 'https://www.direkt36.hu/melyebben-belenyultak-az-elios-palyazataiba-mint-ahogy-eddig-latszott/' },
            ],
            videos: [
              {
                id: 'DIZq687qGgg',
                label: 'Juhász Péter | Juhi · NER100 #5',
                title: 'Az Elios-ügy: A 13 milliárdos kár',
                summary:
                  'Az ügy videós feldolgozása a NER100 sorozatban — jó példa arra, hogyan lesz egy hónapokig épített oknyomozó anyagból követhető, nézhető történet.',
              },
            ],
          },
          {
            title: 'A lélegeztetőgép-biznisz anatómiája — 300 milliárd forint',
            when: '2020-tól folyamatosan',
            body:
              'A koronavírus-járvány kitörésekor a kormány ellenőrzés nélkül, pánikszerűen vásárolt be egészségügyi felszereléseket — ebből lett a rendszer egyik legnagyobb beszerzési visszaélése. A Direkt36 kórházi források, lélegeztetőgépekkel foglalkozó szakemberek, vámdokumentumok, nemzetközi kereskedelmi adatsorok és belső szerződések megszerzésével indított vizsgálatot.',
            more: [
              'Az újságírók hónapokig elemezték a beáramló árukat és a beiktatott, sokszor frissen alapított, gyanús hátterű közvetítő cégek kifizetéseit. Ez az a fajta munka, amelyben nincs egyetlen leleplező pillanat: számlák, vámáru-nyilatkozatok és cégadatok összevetéséből áll össze a kép.',
            ],
            sections: [
              {
                heading: 'Amit a számok mutattak',
                paragraphs: [
                  'A feltárás szerint a kormány összesen durván tizenhatezer kínai lélegeztetőgépet vásárolt megközelítőleg 300 milliárd forintért. Az adatok azt is leleplezték, hogy Magyarország kötötte a legrosszabb üzletet az egész Európai Unióban: Németországhoz és Olaszországhoz képest többszörös, esetenként tízszeres egységárat fizettünk ugyanazokért a gépekért.',
                  'A beszerzett gépek nagy része ráadásul raktárakban ragadt vagy hibásnak bizonyult. Több intézményben a Kínából érkezett berendezések egyszerűen füstölni kezdtek, alkatrészhiányosak voltak, az eladó pedig semmilyen garanciát vagy karbantartást nem vállalt rájuk.',
                  'A tárolásuk önmagában is pénzbe került: az Átlátszó adatigénylése szerint a 300 milliárdért beszerzett gépek parkoltatása 2022 végéig 390 millió forintot emésztett fel.',
                ],
                sources: [
                  { source: 'Direkt36', date: '2020. aug. 27.', headline: 'A kormány dicsekedett a lélegeztetőgépek vásárlásával, mégis ők kötötték a legrosszabb üzletet Kínával az egész EU-ból', url: 'https://www.direkt36.hu/a-kormany-dicsekedett-a-lelegeztetogepek-vasarlasaval-megis-ok-kotottek-a-legrosszabb-uzletet-kinaval-az-egesz-eu-bol/' },
                  { source: 'Direkt36', date: '2021. dec. 21.', headline: '„Eladó nem vállalja a karbantartást" – küszködtek a kórházak a füstölő, alkatrészhiányos kínai lélegeztetőgépekkel', url: 'https://www.direkt36.hu/elado-nem-vallalja-a-karbantartast-kuszkodtek-a-korhazak-a-fustolo-alkatreszhianyos-kinai-lelegeztetogepekkel/' },
                  { source: 'Forbes', date: '2021. dec. 21.', headline: 'Mikor bedugták, füstölni kezdett – így küszködtek a magyar kórházak a kínai lélegeztetőgépekkel', url: 'https://www.forbes.hu/uzlet/kina-lelegezetogep-direkt36/' },
                  { source: 'Átlátszó', date: '2022. nov. 28.', headline: 'Eddig 390 millió forintot emésztett fel a 300 milliárdért beszerzett lélegeztetőgépek parkoltatása', url: 'https://atlatszo.hu/kozadat/2022/11/28/eddig-390-millio-forintot-emesztett-fel-a-300-milliardert-beszerzett-lelegeztetogepek-parkoltatasa/' },
                ],
              },
              {
                heading: 'A hatás: feljelentés hat évvel később',
                paragraphs: [
                  'A cikkek kézzelfoghatóvá tették az egészségügyi válsághelyzetre épített nyerészkedést. Az összegyűjtött bizonyítékok és a hiányos dokumentációk képezték annak a külügyminisztériumi átvilágításnak a közvetlen alapját, amely 2026 augusztusában hivatalos büntetőfeljelentéshez vezetett a korábbi beszerzések miatt — a tárca akkori közlése szerint százmilliárdos nagyságrendű károkozást vélelmezve.',
                  'Ez a legjobb érv a lassú módszer mellett: az anyag 2020-ban készült, a jogi következménye 2026-ban jött. Egy napi hírciklusra dolgozó szerkesztőségnél addigra nem maradt volna meg a dokumentáció.',
                ],
                sources: [
                  { source: 'HVG', date: '2026. aug. 26.', headline: 'A külügy százmilliárdos nagyságrendűre taksálja a Szijjártó-féle lélegeztetőgép-biznisz kárát', url: 'https://hvg.hu/gazdasag/20260826_lelegeztetogep-biznisz-feljelentes-szijjarto-szazmilliardos-kar' },
                  { source: 'Az én pénzem', headline: 'A lélegeztetőgépek miatt is megszületett végre a feljelentés', url: 'https://www.azenpenzem.hu/cikkek/a-lelegeztetogepek-miatt-is-megszuletett-vegre-a-feljelentes/11855/' },
                ],
              },
            ],
            promo: {
              href: '/ugyek/lelegeztetogep',
              eyebrow: 'Kiemelt ügy · Lélegeztetőgépek',
              title: 'Mennyibe kerültek valójában a lélegeztetőgépek?',
              lead:
                'A járvány legnagyobb beszerzési ügye a saját oldalán: árak, közvetítők, és hogy mi lett a sok ezer géppel. Szereplőkkel, összegekkel, időrendben.',
              cta: 'Az ügy megnyitása',
            },
          },
          {
            title: 'A Pegasus-botrány — a megfigyelési ügy magyar szála',
            when: '2021',
            body:
              'A műhely nemzetközi szinten is az újságírói jogokért folyó küzdelem élvonalába került, amikor globális partnerségben feltárta a katonai kémszoftverek hazai visszaéléseit. A Forbidden Stories nevű nemzetközi hálózattal és az Amnesty International Secure Lab kiberszakértőivel dolgoztak együtt.',
            more: [
              'A szakértők laboratóriumi körülmények között vizsgálták át a célpontok telefonjait. Az ujjlenyomatok és naplófájlok elemzése során derült ki, hogy a kormány az izraeli NSO Group katonai szintű Pegasus kémszoftverét vetette be civilek ellen.',
              'A történet legsúlyosabb része, hogy a műhely vezető külpolitikai újságírója, Panyi Szabolcs az öt dokumentáltan megfigyelt magyar újságíró egyike volt. A szívós, nemzetközi visszhangot kiváltó cikksorozat kényszerítette ki, hogy öt hónap tagadás után a parlamenti szakbizottságban hivatalosan is elismerjék: a magyar állam megvásárolta és alkalmazta a szoftvert.',
            ],
            links: [{ text: 'Panyi Szabolcs', href: '/rendszervaltas/panyi-szabolcs' }],
            sources: [
              { source: 'Committee to Protect Journalists', headline: 'Hungary\u2019s Szabolcs Panyi on how Pegasus surveillance has hindered his reporting', url: 'https://cpj.org/2021/12/hungarys-szabolcs-panyi-on-how-pegasus-surveillance-has-hindered-his-reporting/' },
            ],
          },
          {
            title: 'Orosz hackerek a Külügyminisztériumban',
            when: '2022',
            body:
              'Ez a munka a magyar külügyi adminisztráció legsúlyosabb nemzetbiztonsági csődjére világított rá. Az újságírók diplomáciai forrásokkal, titkosszolgálati tisztek belső vallomásaival és megszerzett minisztériumi jelentésekkel dolgoztak, lépésről lépésre modellezve az orosz titkosszolgálatok által elkövetett kibertámadásokat.',
            more: [
              'A cikkek bizonyították be, hogy orosz hackerek éveken keresztül hozzáféréssel rendelkeztek a Külügyminisztérium belső informatikai hálózatához. A külügyi vezetés tudott arról, hogy az oroszok élőben látják a titkosított uniós és NATO-dokumentumokat — a kormány mégis elhallgatta a botrányt a nyilvánosság elől.',
              'Ez az ügy alapjaiban rengette meg a magyar diplomácia szövetségesi bizalmát, és közvetlen előzménye lett a 2026 tavaszán kirobbant Szijjártó–Lavrov-hangfelvételeknek: ez az oknyomozás bizonyította be először hitelesen a külügy oroszok felé való kitettségét.',
            ],
            sources: [
              { source: 'Direkt36', date: '2022. márc. 29.', headline: 'Putyin hekkerei is látják a magyar külügy titkait, az Orbán-kormány évek óta nem bírja elhárítani őket', url: 'https://www.direkt36.hu/putyin-hekkerei-is-latjak-a-magyar-kulugy-titkait-az-orban-kormany-evek-ota-nem-birja-elharitani-oket/' },
            ],
            videos: [
              {
                id: '6QmrRO2b4q4',
                label: '444',
                title: 'Szembesítettük Szijjártót: tudnia kellett az orosz hekkertámadásokról',
                summary:
                  'A legendás jelenet: a külügyminiszter szembesítése a kérdéssel — és a riporternek címzett reakció. Az oknyomozó anyag és a válasz közötti különbség önmagában is dokumentum.',
              },
            ],
          },
          {
            title: 'Szabó Bence vallomása a Tisza-műveletről',
            when: '2026. március 25.',
            body:
              'A műhely történetének és a 2026-os kampánynak a legrobbanásveszélyesebb feltárása egy aktív állami tisztviselő megszólaltatása volt. Szabó Bence nem leszerelt ex-alkalmazott volt, hanem a Nemzeti Nyomozó Iroda kiberbűnözés elleni főosztályának aktív állományú vezető nyomozója. Az újságírók hosszú heteken át egyeztettek vele, ellenőrizve a szavait és a birtokában lévő dokumentumokat.',
            more: [
              'Elmondta, hogyan zajlott az ellenzéki párt informatikusai elleni eljárás, és hogyan próbált abba az Alkotmányvédelmi Hivatal ismételten és törvénytelenül beavatkozni: a hivatal megfelelő dokumentáció, engedélyek és jegyzőkönyvek nélkül vitt el fizikai adathordozókat és bizalmas adatokat a rendőrségtől. A következtetése az volt, hogy közvetlen, kézi irányítás alatt álló, speciális titkosszolgálati egység dolgozott a politikai ellenfél szisztematikus bedöntésén.',
              'Az interjú ára azonnal megmutatkozott: a cikk megjelenése után házkutatást tartottak a munkahelyén a Nemzeti Nyomozó Irodában, majd az otthonában is, ahol az adathordozóit lefoglalták. A belügyminiszter magyarázkodásra kényszerült.',
              'Ez az anyag volt a lavina elindítója: a dokumentált cikk után a nyomozó beült a Partizán élő adásába, amely másfél nap alatt elérte az egymilliós megtekintést, visszafordíthatatlanul megváltoztatva a kampány menetét.',
            ],
            videos: [
              {
                id: 'IXmuE2TX9yE',
                label: 'Direkt36 · 2026. március 25.',
                title: '„Egy ideális rendszerben nem kellene itt ülnöm" — megszólal a nyomozó a Tisza-műveletről',
                summary:
                  'Az első interjú. Innen indult minden, ami utána következett — a miniszteri reakciótól a házkutatásokig.',
              },
            ],
            sources: [
              { source: 'Telex', date: '2026. márc. 25.', headline: 'Megszólal a nyomozó, aki belülről ismeri a Tisza elleni művelet ügyét', url: 'https://telex.hu/direkt36/2026/03/25/megszolal-a-nyomozo-aki-belulrol-ismeri-a-tisza-elleni-muvelet-ugyet' },
              { source: 'Telex', date: '2026. márc. 25.', headline: 'Egy kézi irányítás alatt álló, speciális titkosszolgálati egység dolgozhatott a Tisza Párt bedöntésén, mondta a Direkt36-nak megszólaló nyomozó', url: 'https://telex.hu/belfold/2026/03/25/tisza-part-titkosszolgalat-hazkutatas-informatikusok' },
              { source: 'Népszava', date: '2026. márc. 25.', headline: 'Nyilvánosság elé állt a Tisza Párt bedöntésére irányuló titkos műveletet ismerő nyomozó', url: 'https://nepszava.hu/3316627_tisza-part-bedontese-titkosszolgalati-muvelet-nyomozo-interju-direkt36' },
            ],
            promo: {
              href: '/rendszervaltas/partizan',
              eyebrow: 'A falon · Partizán',
              title: 'A folytatás: a vágatlan, élő interjú',
              lead:
                'Néhány nappal a Direkt36-anyag után Szabó Bence a Partizánnak is megszólalt, élő adásban. Az az adás másfél nap alatt egymilliós megtekintésnél járt.',
              cta: 'Tovább a Partizánhoz',
            },
          },
        ],
      },
      table: {
        heading: 'Hol helyezkedik el a láncolatban?',
        intro:
          'A Kegyencjárat láncmunka-elmélete szerint az igazság kiderítése és a politikai változás elérése a különböző funkciót betöltő műhelyek egymásra épüléséből fakad. A Szabó Bence-ügy végigvezetve:',
        columns: ['A láncolat fázisa', 'Szereplő', 'Konkrét funkció'],
        rows: [
          ['1. Adatbányászat és szivárogtatás', 'Direkt36', 'Hetekig egyeztet a forrással, ellenőrzi a dokumentumokat, és elkészíti a megdönthetetlen, forrásolt alapanyagot.'],
          ['2. Tömeges terjesztés', 'Partizán', 'Átveszi az anyagot, stúdióba hívja a szereplőt, és érthető, százezrek által megosztott videós formátumba önti.'],
          ['3. Digitális emlékezet', 'Kegyencjárat', 'Rendszerezi az ügyet, összeköti a felelősök adatlapjával, és nyomon követi a jogi következményeket.'],
        ],
      },
      extra: [
        {
          heading: 'Miért működik a lassú módszer?',
          paragraphs: [
            'A műhely tudatosan nem vesz részt a napi politikai viták gyors feldolgozásában. Egy-egy anyaguk hónapokig készül, amiért cserébe olyan bizonyítékrendszert kapnak az olvasók, amelyet jogilag sem lehet megdönteni.',
            'Rendszeresen dolgoznak együtt nemzetközi oknyomozó hálózatokkal, ami olyan technikai szakértelemhez és külföldi nyilvántartásokhoz biztosít hozzáférést, amelyet egy magyar szerkesztőség egyedül nem tudna előállítani.',
            'A harmadik jellemzőjük a forma: a riportjaik teljes forrásjegyzékkel, a szereplők pontos jogi és intézményi felelősségének megjelölésével jelennek meg. Ez nem stílus kérdése, hanem védekezés.',
          ],
        },
        {
          heading: 'Mit mondanak róluk a kritikusok és a támogatók?',
          paragraphs: [
            'A támogatóik szerint a legmagasabb szakmai színvonalat képviselő független műhely, amely nélkül a rendszer legmélyebb titkosszolgálati és nemzetbiztonsági visszaélései rejtve maradtak volna. Szabó Bence és Panyi Szabolcs története a módszertanuk hatékonyságának bizonyítéka.',
            'A kritikusaik — a korábbi rendszer politikusai és propagandistái — rendszeresen vádolták őket azzal, hogy külföldi alapítványok által finanszírozott ügynökségként nemzetközi érdekeket szolgálnak, és a kényes állami adatok kiszivárogtatásával veszélyeztetik Magyarország szuverenitását.',
          ],
        },
      ],
      faq: [
        {
          q: 'Mi az a Direkt36?',
          a: 'Független, nonprofit oknyomozó újságírói műhely, amely olvasói támogatásokból és alapítványi pályázatokból működik. Egy-egy anyaguk hónapokig, esetenként több mint egy évig készül.',
        },
        {
          q: 'Kinek adta az első interjúját Szabó Bence?',
          a: 'A Direkt36-nak, 2026. március 25-én. Néhány nappal később a Partizánnak is megszólalt egy csaknem másfél órás élő adásban.',
        },
        {
          q: 'Mi történt Szabó Bencével az interjú után?',
          a: 'A cikk megjelenése után házkutatást tartottak a munkahelyén a Nemzeti Nyomozó Irodában, majd az otthonában is, ahol az adathordozóit lefoglalták.',
        },
        {
          q: 'Mi volt az Elios-ügy?',
          a: 'A Tiborcz Istvánhoz köthető Elios uniós közvilágítási tendereinek feltárása. A műhely bizonyította be, hogy a pályázatokat a konkurencia kizárására szabták; a cikkek alapján az OLAF rendszerszintű csalást állapított meg.',
        },
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
      links: [
        {
          text: 'saját videós csatornát',
          href: 'https://www.youtube.com/@juhaszpetervideo',
          external: true,
        },
      ],
    },
    related: [
      { label: 'Videóriportok és podcastok', href: '/podcastok' },
      { label: 'Ki az a Zsolti bácsi?', href: '/ugyek/ki-az-a-zsolt-bacsi' },
    ],
    live: true,
    detail: {
      seoTitle: 'Juhász Péter (Juhi): NER100, belvárosi ingatlanok, Zsolti bácsi',
      seoDescription:
        'A jogvédőtől a 302 ezer feliratkozós YouTube-csatornáig. Mit tárt fel az V. kerületben, mi a NER100, és miért tartottak nála házkutatást 2025 októberében?',
      lead:
        'Juhász Péter (a csatornáján Juhi) a Dicsőségfal egyik legösszetettebb szereplője: egy személyben helyi antikorrupciós harcos, aki önkormányzati iratokból épített feljelentéseket, és videós műsorkészítő, aki a kész ügyeket lefordítja arra a nyelvre, amelyen a nagyközönség is érti őket. A kettő nem ugyanaz a munka — és a Kegyencjárat szempontjából mindkettőre szükség van.',
      cases: {
        heading: 'Amit feltárt — és amit lefordított',
        intro:
          'Az alábbi három ügy három különböző szerepet mutat. Az elsőben ő az eredeti feltáró: a dokumentumokhoz képviselőként fért hozzá, és ő tette a feljelentéseket. A másodikban feldolgozó: mások kiásott adataiból csinált nézhető sorozatot. A harmadikban forrásvédő: olyan vádat hozott nyilvánosságra, amelyet bizonyítani nem tudott, a forrását viszont a házkutatás után sem adta ki.',
        items: [
          {
            title: 'Az V. kerületi ingatlanértékesítések — amikor a képviselői iratbetekintés lett a szerszám',
            when: '2014–2018',
            body:
              'Juhász Péter 2014-ben lett belvárosi önkormányzati képviselő, és ezzel olyasmihez jutott hozzá, amihez kívülről nem lehet: a kerületi ingatlangazdálkodás belső irataihoz. Az ebből épített ügy a pályafutásának az a része, ahol nem közvetítő, hanem elsődleges feltáró.',
            more: [
              'A kifogásolt konstrukció lényege egy törvényes kedvezmény kihasználása volt. Az önkormányzati helyiséget a bérlője kedvezményesen vásárolhatta meg — így ha egy cég röviddel az értékesítés előtt lett bérlő, a kedvezmény már neki járt. A sajtófeldolgozások szerint 2008 és 2013 között összesen 155 ingatlan kelt el jelentős engedménnyel, nagyjából négymilliárd forinttal a becsült érték alatt.',
              'A legtöbbet emlegetett tétel a Szerb utcai műemléki lakás ügye volt, amelyet közpénzből újítottak fel, majd kedvezményes áron, hosszú részletfizetéssel adtak el az akkori alpolgármesternek, a későbbi polgármesternek. A politikai botrány akkora lett, hogy az érintett végül bejelentette: visszaadja a lakást az önkormányzatnak. Juhász ezzel párhuzamosan a kerület akkori polgármesterének a lakásvásárlásait és vagyonnyilatkozatait is folyamatosan támadta.',
              'A hatósági végkifejlet viszont nem az lett, amit a beadványok mennyisége sugallt volna. A feljelentések nyomán indult vizsgálatokat a nyomozó hatóság 2016-ban bűncselekmény hiányában lezárta. Az ügy tehát jogi értelemben nem ért célba — a dokumentáció viszont megmaradt, és Juhász a tízéves elévülési határidő közeledtével, 2024-ben nyilvánosan adta át a teljes anyagot, hogy valaki más vigye tovább. Ez a Dicsőségfal egyik visszatérő mintája: a feltárás és az elszámoltatás két külön folyamat, és a második évekkel később indul el.',
            ],
            links: [
              { text: 'a kerület akkori polgármesterének', href: '/adatbazis/rogan-v-kerulet-cegvasarlas' },
            ],
            sources: [
              {
                source: 'Magyar Narancs',
                date: '2015. jan. 22.',
                headline: 'Mielőtt végleg elfogy — Juhász Péter az V. kerület ingatlangazdálkodásáról',
                url: 'https://magyarnarancs.hu/belpol/mielott-vegleg-elfogy-93334',
                lead:
                  'A leghosszabb korabeli interjú arról, hogyan jutott hozzá az iratokhoz, mit talált bennük, és miért gondolta, hogy a kedvezményes értékesítés rendszerszintű. Ez a szöveg a saját olvasatát adja — a hatósági végkifejletet l. a bekezdés végén.',
              },
              {
                source: '444',
                date: '2019. febr. 28.',
                headline:
                  'A Belvárosban megtalálták a módját, hogy ne csak a bérlők vihessék áron alul a kerület ingatlanjait',
                url: 'https://444.hu/2019/02/28/a-belvarosban-megtalaltak-a-modjat-hogy-ne-csak-a-berlok-vihessek-aron-alul-a-kerulet-ingatlanjait-hanem-gyakorlatilag-barki',
              },
              {
                source: 'K-Monitor',
                headline: 'V. kerületi ingatlanügyek — cikkgyűjtemény',
                url: 'https://adatbazis.k-monitor.hu/adatbazis/cimkek/v-keruleti-ingatlanugyek',
              },
            ],
          },
          {
            title: 'A NER100 — hatvanöt rész arról, hogyan működik a rendszer',
            when: '2021. szeptember – 2022. március',
            body:
              'A NER100 nem oknyomozás, hanem fordítás. Juhász Péter olyan ügyeket vett sorra, amelyeket előtte már mások — az Átlátszó, a Direkt36, a K-Monitor, a nagy szerkesztőségek — feltártak, és mindegyikből csinált egy rövid, nézhető epizódot. A sorozat 2021. szeptember 27-én indult a Budapest–Belgrád vasútvonalról szóló résszel, és 2022 márciusában, a hatvanötödik epizóddal ért véget.',
            more: [
              'Az értéke abban van, ami nélkül egy feltárás elveszik: az egyben tartásban. Egy közbeszerzési botrány két napig hír, aztán lekerül a címlapról, és fél év múlva már senki nem tudja felidézni, mi is volt pontosan. A NER100 ebből katalógust csinált — a Budapest–Belgrád vasúttól a Puskás Arénán és a lélegeztetőgép-beszerzéseken át Hatvanpusztáig —, amelyben minden tétel a helyén marad, és bármikor újranézhető. A 2026 utáni elszámoltatás szempontjából ez a fajta rendezett archívum legalább annyit ér, mint egy friss leleplezés.',
              'Fontos viszont a méretarányt is kimondani, mert enélkül félrevezető a kép. A NER100 nem tömegsiker volt: a hatvanöt epizód együtt nagyjából 550 ezer megtekintésnél tart, a legnézettebb rész is huszonhétezer körül. A csatorna nagy számai — 302 ezer feliratkozó, 133 millió megtekintés — nem ebből a sorozatból jönnek, hanem a napi videókból. A NER100 nem az elérése miatt fontos, hanem azért, mert ilyen tematikus, végigvitt katalógust rajta kívül senki nem készített.',
            ],
            links: [
              { text: 'lélegeztetőgép-beszerzéseken', href: '/ugyek/lelegeztetogep' },
              { text: 'Hatvanpusztáig', href: '/ugyek/hatvanpuszta' },
              { text: 'a Direkt36', href: '/rendszervaltas/direkt36' },
            ],
            videos: [
              {
                id: 'syOv3qrI0TY',
                list: 'PLypfb10EcIXQP9R9ThTggu69ufvFQNFMz',
                label: 'Juhász Péter | Juhi · NER100',
                title: 'NER 100 — a teljes sorozat',
                summary:
                  'A teljes, hatvanöt részes lejátszási lista, az első epizóddal indítva. A lejátszón belül lehet lépkedni a részek között — nem kell átmenni a YouTube-ra.',
              },
            ],
            sections: [
              {
                heading: 'Az Elios-epizód: mi történik, ha valaki lefordítja az uniós vizsgálati jelentést',
                paragraphs: [
                  'A sorozat ötödik része a Tiborcz Istvánhoz köthető Elios-ügyet dolgozta fel. Az alapanyag egy uniós csalás elleni vizsgálat jelentése volt: olyan műfaj, amelyet sokan idéznek, de kevesen olvasnak végig. Az epizód ebből építette fel lépésről lépésre, hogy miként nyert sorozatban közvilágítási pályázatokat egy cég, és hol keletkezett a kár.',
                  'Ez a Juhász-módszer tiszta esete: az adat megvolt korábban is, a különbség az, hogy tíz perc alatt, képekkel és összegekkel végig lehetett követni. Az ügy önálló feldolgozása a Kegyencjárat adatbázisában is megvan.',
                ],
                links: [{ text: 'a Kegyencjárat adatbázisában', href: '/adatbazis/tiborcz-elios-zrt' }],
              },
            ],
            promo: {
              href: '/ugyek/lelegeztetogep',
              eyebrow: 'Kiemelt ügy · Lélegeztetőgépek',
              title: 'Az EU legdrágább lélegeztetőgépei — a NER100 egyik epizódjának témája',
              lead:
                'A sorozat huszonkettedik része ezt az ügyet dolgozta fel. A teljes feldolgozás — beszerzési árak, közvetítők, felelősök és az eljárások állása — a saját oldalán.',
              cta: 'Az ügy megnyitása',
            },
          },
          {
            title: 'A Zsolti bácsi-videó és a 2025-ös házkutatás',
            when: '2025. október 2.',
            body:
              '2025 őszén Juhász Péter olyan felvételt tett közzé a csatornáján, amely a munkájának legsúlyosabb és egyben legvitatottabb darabja. Egy név nélkül megszólaló lelkész arról beszélt, hogy évekkel korábban két fiú fordult hozzá segítségért egy ózdi térségbeli gyermekotthonból, és egy magas rangú politikus rendszeres látogatásairól, valamint bántalmazásról számoltak be. A gyerekek a politikust egymás között Zsolti bácsiként emlegették.',
            sections: [
              {
                heading: 'A hatósági reakció',
                paragraphs: [
                  'A hatósági reakció három napon belül megérkezett. 2025. október 2-án reggel a Központi Nyomozó Főügyészség nyomozói házkutatást tartottak Juhász Péter otthonában, és lefoglalták az adathordozóit — köztük azt a telefont is, amelyen éppen élőben nyilatkozott a sajtónak a házkutatás közben. Másnap tanúként hallgatták ki, több mint négy órán át.',
                ],
                sources: [
                  {
                    source: 'HVG',
                    date: '2025. okt. 2.',
                    headline:
                      'Juhász Péter: Itt vannak az ügyészségtől, házkutatást tartanak, mindent lefoglalnak, mindjárt elveszik a telefonomat is',
                    url: 'https://hvg.hu/itthon/20251002_Juhasz-Peter-ugyeszseg-hazkutatas-razzia-ebx',
                    lead:
                      'A házkutatás közben, élőben rögzített beszámoló. Ez a cikk az elsődleges forrása annak, hogy mi történt az otthonában október 2-án reggel.',
                  },
                ],
              },
              {
                heading: 'Amit vállalt, és amit nem',
                paragraphs: [
                  'Juhász a videóban maga mondta ki a korlátot: bizonyíték hiányában nem hozza nyilvánosságra a nevet, a forrását viszont megvédi. Ez a kettősség az, amiért az ügy a mai napig vitatott.',
                  'Az ügyészség hivatalos indoklása szerint az eljárás a Szőlő utcai javítóintézet ügyében indult nyomozás keretében zajlott — miközben a közzétett felvétel nem arról az intézményről, hanem az ózdi térségről szólt.',
                  'Juhász a kihallgatás után azt mondta, hogy rágalmazás szóba sem került, az ügyészséget az érdekelte, milyen gyerekbántalmazásos bejelentések futottak be a korábbi felhívására. Ő maga megfélemlítésnek nevezte az akciót; a hatóság tanúkénti eljárásként írta le.',
                ],
                sources: [
                  {
                    source: '444',
                    date: '2025. okt. 3.',
                    headline: 'Juhász Péter: Semmiféle rágalmazás szóba sem került',
                    url: 'https://444.hu/2025/10/03/juhasz-peter-semmifele-ragalmazas-szoba-sem-kerult',
                    lead:
                      'A több mint négy órás, tanúkénti kihallgatás utáni beszámoló — és az a részlet, hogy az ügyészséget a felhívására befutott gyerekbántalmazásos bejelentések érdekelték.',
                  },
                ],
              },
            ],
            videos: [
              {
                id: 'QXW84vh1hV8',
                label: 'Juhász Péter | Juhi',
                title: 'A Szőlő utcai ügy',
                summary:
                  'Ugyanez a felvétel az ügy saját oldalán is szerepel, a többi szerkesztőség feldolgozása mellett.',
              },
            ],
            sources: [
              {
                source: '444',
                date: '2025. okt. 2.',
                headline:
                  'A Zsolt bácsis videó miatt hallgatják ki Juhász Pétert, aki rákérdezett az ügyészeknél, hogy mégis mi köze ennek a Szőlő utca ügyében folyó nyomozáshoz',
                url: 'https://444.hu/2025/10/02/a-zsolt-bacsis-video-miatt-hallgatjak-ki-juhasz-petert-aki-rakerdezett-az-ugyeszeknel-hogy-megis-mi-koze-ennek-a-szolo-utca-ugyeben-folyo-nyomozashoz',
              },
              {
                source: 'ATV',
                date: '2025. okt. 5.',
                headline: 'Újabb tartalomgyártót érint rendőrségi eljárás Juhász Péter ügye nyomán',
                url: 'https://www.atv.hu/belfold/20251005/juhasz-peter-rendorseg-hazkutatas/',
              },
              {
                source: 'Népszava',
                headline: 'Elkezdődött a fideszes megtorlás, Juhász Péter üzent Kocsis Máténak',
                url: 'https://nepszava.hu/3296661_juhasz-peter-megtorlas-fidesz-budapesti-javitointezet-pedofilvad-kocsis-mate',
              },
            ],
            promo: {
              href: '/ugyek/ki-az-a-zsolt-bacsi',
              eyebrow: 'Kiemelt ügy · Ki az a Zsolti bácsi?',
              title: 'Az ügy teljes feldolgozása, az összes eddigi fejleménnyel',
              lead:
                'Mi hangzott el a felvételen, ki a koronatanú, mit állít és mit cáfol, és hol tart az eljárás. Az ügy saját oldala, a fejleményekkel.',
              cta: 'Az ügy megnyitása',
            },
          },
        ],
      },
      extra: [
        {
          heading: 'A csatorna számokban — és mit jelentenek ezek a számok',
          paragraphs: [
            'A csatornát 2020 decemberében hozta létre, és azóta több mint 1600 videót tett közzé. Az összesített elérése 302 ezer feliratkozó és több mint 133 millió megtekintés — ezzel a magyar politikai-aktivista csatornák szűk élmezőnyében van.',
            'Ez a szám nem ugyanaz, mint a feltáró teljesítmény, és nem is helyettesíti azt. Egy oknyomozó műhely három hónap munkájából csinál egy sztorit; egy napi videós csatorna három hónap alatt kilencven videót tesz közzé, amelyek túlnyomó többsége kommentár, nem feltárás. A Dicsőségfalon Juhász Péter helye pontosan ezen a metszésponton van: az V. kerületi iratoknál eredeti feltáró, a NER100-nál és a napi videóknál pedig az a szereplő, aki eljuttatja mások munkáját azokhoz, akik hírportált soha nem nyitnak meg.',
          ],
        },
        {
          heading: 'Mit mondanak róla a támogatói és a kritikusai?',
          paragraphs: [
            'A támogatói szerint olyan civil harcos, akit tíz év alatt sem tudtak megtörni sajtóperekkel, lejárató kampányokkal vagy házkutatással, és akinek a csatornája nélkül a társadalom jelentős része egyáltalán nem értené a bonyolult gazdasági ügyeket. Az állami nyomás alatti forrásvédelmét külön is példaértékűnek tartják.',
            'A kritikusai két irányból érkeznek. A korábbi kormányoldal évekig a magánéletére hivatkozva próbálta hitelteleníteni a szakmai állításait. Az ellenzéki térfélen viszont az a kifogás fogalmazódott meg, hogy a bizonyíték nélküli, névtelen forrásra épülő anyagok — mint a Zsolti bácsi-videó — bulvárosak, és épp a legsúlyosabb ügyeket teszik átpolitizálhatóvá.',
          ],
        },
      ],
      table: {
        heading: 'Hol a helye a rendszerváltó ökoszisztémában?',
        intro:
          'A Dicsőségfal három típusú munkát gyűjt egybe. Az alábbi összevetés azt mutatja meg, miben más Juhász Péter szerepe, mint a két legismertebb, tisztán feltáró szereplőé.',
        columns: ['Szereplő', 'Elsődleges funkció', 'Módszertan', 'Eredeti feltárás vagy feldolgozás'],
        rows: [
          [
            'Juhász Péter',
            'Digitális emlékezet és helyi leleplezés',
            'Képviselői iratbetekintés, feljelentések, videós feldolgozás (NER100)',
            'Vegyes: az V. kerületi ingatlanügyekben eredeti feltáró, a NER100-ban mások adatait dolgozza fel',
          ],
          [
            'Hadházy Ákos',
            'Országos közbeszerzés-vadászat',
            'Adattárak napi átfésülése, helyszínelés, teljes dokumentumok közzététele',
            'Tisztán eredeti feltáró',
          ],
          [
            'Direkt36',
            'Mély, nemzetközi háttér-oknyomozás',
            'Hónapokig tartó forrásépítés, nemzetközi együttműködés, technikai vizsgálatok',
            'Tisztán eredeti feltáró',
          ],
        ],
        note: 'A három szerep nem rangsor: a feltárás és a terjesztés egymás nélkül egyaránt hatástalan.',
      },
      faq: [
        {
          q: 'Ki az a Juhász Péter?',
          a: 'Aktivista és videós műsorkészítő, a csatornáján Juhi néven. A kétezres években civil jogvédőként, 2011 után a Milla-tüntetések szervezőjeként, majd az Együtt politikusaként és V. kerületi önkormányzati képviselőként volt ismert. 2020 decembere óta saját YouTube-csatornát visz, amelynek ma 302 ezer feliratkozója van.',
        },
        {
          q: 'Ő ugyanaz a Juhász Péter, aki a Szőlő utcai javítóintézet ügyében érintett?',
          a: 'Nem. A javítóintézet volt vezetője Juhász Péter Pál, egy másik személy. Juhász Péter (Juhi) ebben az ügyben nem gyanúsított: 2025 októberében tanúként hallgatták ki, miután házkutatást tartottak nála egy általa közzétett videó kapcsán.',
        },
        {
          q: 'Mi az a NER100?',
          a: 'Hatvanöt részes videósorozat, amely 2021 szeptembere és 2022 márciusa között jelent meg. Minden epizód egy-egy, korábban már feltárt ügyet vesz végig rövid, közérthető formában — a Budapest–Belgrád vasúttól az Elios-ügyön és a lélegeztetőgép-beszerzéseken át Hatvanpusztáig. A teljes lejátszási lista ezen az oldalon beágyazva is megnézhető.',
        },
        {
          q: 'Miért tartottak nála házkutatást 2025 októberében?',
          a: 'A Központi Nyomozó Főügyészség közlése szerint a Szőlő utcai javítóintézet ügyében indult nyomozás keretében jártak el, és ezzel összefüggésben foglalták le az adathordozóit. Juhász szerint a felvétel, ami miatt az eljárás indult, nem erről az intézményről szólt, és az akciót megfélemlítésnek nevezte. Másnap tanúként hallgatták ki.',
        },
        {
          q: 'Kiderült, ki az a Zsolti bácsi?',
          a: 'Nem. Juhász Péter a videóban maga mondta ki, hogy bizonyíték hiányában nem hozza nyilvánosságra a nevet. Az ügy állása és a további fejlemények a saját ügyoldalán követhetők.',
        },
        {
          q: 'Ő tárta fel az Elios-ügyet?',
          a: 'Nem. Az Elios-ügy uniós vizsgálatból és újságírói oknyomozásból ismert; a NER100 ötödik epizódja ezt dolgozta fel közérthető formában. Juhász Péter saját, eredeti feltárása az V. kerületi ingatlanértékesítések ügye.',
        },
      ],
      sources: [
        {
          source: 'Magyar Narancs',
          date: '2015. jan. 22.',
          headline: 'Mielőtt végleg elfogy — Juhász Péter az V. kerület ingatlangazdálkodásáról',
          url: 'https://magyarnarancs.hu/belpol/mielott-vegleg-elfogy-93334',
        },
        {
          source: 'HVG',
          date: '2025. okt. 2.',
          headline: 'Juhász Péter: Itt vannak az ügyészségtől, házkutatást tartanak, mindent lefoglalnak',
          url: 'https://hvg.hu/itthon/20251002_Juhasz-Peter-ugyeszseg-hazkutatas-razzia-ebx',
        },
        {
          source: '444',
          date: '2025. okt. 3.',
          headline: 'Juhász Péter: Semmiféle rágalmazás szóba sem került',
          url: 'https://444.hu/2025/10/03/juhasz-peter-semmifele-ragalmazas-szoba-sem-kerult',
        },
        {
          source: 'ATV',
          date: '2025. okt. 5.',
          headline: 'Újabb tartalomgyártót érint rendőrségi eljárás Juhász Péter ügye nyomán',
          url: 'https://www.atv.hu/belfold/20251005/juhasz-peter-rendorseg-hazkutatas/',
        },
        {
          source: 'K-Monitor',
          headline: 'V. kerületi ingatlanügyek — cikkgyűjtemény',
          url: 'https://adatbazis.k-monitor.hu/adatbazis/cimkek/v-keruleti-ingatlanugyek',
        },
      ],
    },
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
        'Panyi Szabolcs nemzetbiztonsági, külpolitikai és fegyverkereskedelmi ügyekre szakosodott oknyomozó újságíró, a Direkt36 és a VSquare munkatársa, aki rendszeresen működik együtt nagy nemzetközi újságírói hálózatokkal.',
        'Olyan témákhoz nyúlt, amelyek a hatalom legféltettebb belső köreit és nemzetközi háttéralkuit érintették: az orosz befolyásszerzést, a keleti diplomáciai játszmákat és a titkos fegyverüzleteket. Ezek nem olyan ügyek, amelyekre az állam sajtóközleménnyel válaszol.',
        'A magyar sajtótörténet egyik legszemélyesebb tétű ügye fűződik a nevéhez: a katonai szintű kémszoftverrel végzett megfigyelések botrányában az egyik dokumentált célpont ő maga volt. Ez azonnal kirántotta az ügyet az elvont sajtószabadsági kérdések világából — a telefonján keresztül az állam nemcsak az ő magánéletéhez fért hozzá, hanem a magas pozícióban ülő informátorait is közvetlen veszélynek tette ki.',
      ],
      links: [{ text: 'a Direkt36', href: '/rendszervaltas/direkt36' }],
    },
    related: [{ label: 'Kapcsolódó ügyek az adatbázisban', href: '/adatbazis' }],
    live: true,
    detail: {
      seoTitle: 'Panyi Szabolcs: a Pegasustól a Szijjártó–Lavrov-felvételekig',
      seoDescription:
        'Az oknyomozó, akit az állam saját kémszoftverével figyelt meg, majd kémkedéssel vádolt. Mi az a Pegasus, mi volt a felvételeken, és mi lett a következménye?',
      lead:
        'A Kegyencjárat Dicsőségfalának egyik legfontosabb külpolitikai és nemzetbiztonsági bástyája Panyi Szabolcs, a Direkt36 és a VSquare oknyomozó újságírója. Az ő története mutatja meg a legélesebben, mit jelent a legmagasabb szintű kockázatvállalás a magyar sajtóban: nemcsak feltárta a titkosszolgálati módszereket, hanem ő maga is az állami megfigyelés célpontjává vált.',
      cases: {
        heading: 'A két korszakos ügye',
        intro:
          'Öt év telt el a két sztori között, és a különbség mindent elmond arról, mi változott. 2021-ben az állam titokban figyelte meg. 2026-ban már nyíltan, büntetőeljárással válaszolt.',
        items: [
          {
            title: 'A Pegasus-akció anatómiája — hogyan vadászták le a telefonját',
            when: '2021',
            body:
              'Nemzetközi újságíró-csapatok és az Amnesty International Secure Lab igazságügyi kiberszakértői vetették mélyreható vizsgálat alá a telefonját. Az eszköz digitális ujjlenyomataiból és naplófájljaiból tűpontosan sikerült rekonstruálni a támadás indítékát és menetrendjét.',
            more: [
              'Panyi akkor egy rendkívül kényes, nemzetközi pénzintézettel kapcsolatos cikken dolgozott: a budapesti központú, orosz hátterű Nemzetközi Beruházási Bankról, amelyet a sajtó csak „kémbankként" emlegetett. A bevett szakmai szabályok szerint hivatalos kérdésekkel fordult az érintett minisztériumokhoz.',
              'A technikai elemzés ezután bizonyította be a lényeget: a telefonja elleni Pegasus-támadás pontosan egy nappal azután indult el, hogy elküldte ezeket a megkereséseket. A hatalom nem válaszolni akart, hanem azonnal látni akarta, kik a forrásai az államapparátuson belül.',
              'Amikor a Direkt36 és a nemzetközi sajtó kirobbantotta a botrányt, a kormányzati kommunikáció hetekig terelt és álhírnek nevezte a megfigyeléseket. Öt hónapig tartó küzdelembe telt, mire a parlament honvédelmi és rendészeti bizottságának ülésén kormánypárti politikusok kénytelenek voltak hivatalosan is elismerni: a magyar állam megvásárolta és használta az izraeli kémszoftvert.',
            ],
            sources: [
              { source: 'Committee to Protect Journalists', headline: 'Hungary\u2019s Szabolcs Panyi on how Pegasus surveillance has hindered his reporting', url: 'https://cpj.org/2021/12/hungarys-szabolcs-panyi-on-how-pegasus-surveillance-has-hindered-his-reporting/' },
              { source: 'VSquare', headline: 'Szabolcs Panyi: I was hacked with Pegasus software', url: 'https://vsquare.org/szabolcs-panyi-i-was-hacked-with-pegasus-software/' },
            ],
          },
          {
            title: 'A Szijjártó–Lavrov-felvételek — és a kémkedési vád',
            when: '2026. március',
            body:
              'Az európai diplomáciai körökben régóta keringett a nyílt titok, hogy a magyar külügyminiszter az uniós, zárt ajtók mögötti tárgyalások szüneteiben rendszeresen elhagyja a termet, hogy telefonon tájékoztassa orosz kollégáját a bent elhangzottakról. Panyi erről korábban is írt — 2026 márciusára viszont megszerezte a legkeményebb bizonyítékot: magukat a nyers hangfelvételeket.',
            sections: [
              {
                heading: 'A kormányzati „elővágás" kísérlete',
                paragraphs: [
                  'Amikor kormányzati körök fülest kaptak arról, hogy a cikk utolsó simításai zajlanak, ellenakcióba kezdtek. Egy kormányközeli oldalon 2026. március 23-án megjelent egy titokban rögzített hangfelvétel, amelyen maga az újságíró szerepelt.',
                  'Panyi azonnal reagált: közölte, hogy ez klasszikus lejárató célú elővágás, amivel a közeledő Lavrov-sztorit akarják eljelentékteleníteni. Leszögezte, hogy a külügyminiszter lehallgatásához neki az égvilágon semmi köze nem volt — ő újságíróként a forrásaitól kapott anyagot dolgozta fel. Még ugyanezen a napon közzétette az első teljes Szijjártó–Lavrov-hanganyagot.',
                ],
                sources: [
                  { source: 'Telex', date: '2026. márc. 23.', headline: 'Panyi Szabolcs: Szijjártó lehallgatásához nekem az égvilágon semmi közöm nem volt', url: 'https://telex.hu/belfold/2026/03/23/panyi-szabolcs-szergej-lavrov-szijjarto-peter-mandiner-hangfelvetel-titkosszolgalat-lehallgatas' },
                  { source: 'HVG', date: '2026. márc. 23.', headline: 'Panyi Szabolcs szerint a róla kitett hangfelvétel egy elővágás, amiért a Lavrovnak szivárogtató Szijjártóról ír cikket', url: 'https://hvg.hu/itthon/20260323_panyi-szabolcs-szijjarto-peter-szergej-lavrov-lehallgatas-mandiner-hangfelvetel-titkosszolgalat' },
                ],
              },
              {
                heading: 'Kémkedésért jelentették fel az újságírót',
                paragraphs: [
                  'Három nappal a felvételek megjelenése után, 2026. március 26-án az államigazgatás ellentámadásba lendült: „külföldi országgal összehangolt" kémkedés gyanújával büntetőeljárást kezdeményeztek ellene. Nem a nemzetbiztonsági szivárgást és nem a külügyminiszter egyeztetéseit vizsgálták, hanem azt, aki a felvételeket közzétette.',
                  'A lépés nemzetközi felháborodást váltott ki. A Human Rights Watch és a Committee to Protect Journalists éles hangú nyilatkozatban követelte az eljárás leállítását, hangsúlyozva, hogy a nemzetbiztonsági ügyek bemutatása alapvető újságírói feladat.',
                ],
                sources: [
                  { source: 'Committee to Protect Journalists', headline: 'Hungary files espionage charges against investigative journalist Szabolcs Panyi', url: 'https://cpj.org/2026/04/hungary-files-espionage-charges-against-investigative-journalist-szabolcs-panyi/' },
                  { source: 'Human Rights Watch', headline: 'Hungary Orders Investigation of Journalist on Espionage Accusation', url: 'https://www.hrw.org/news/2026/03/27/hungary-orders-investigation-of-journalist-on-espionage-accusation' },
                ],
              },
              {
                heading: 'Mit tartalmaztak a felvételek?',
                paragraphs: [
                  'A feljelentés nem fojtotta el a botrányt: 2026. március 31. és április 8. között újabb hanganyagok kerültek nyilvánosságra. Az egyik márciusi felvételen hallható, amint a magyar külügyminiszter készségesen megígéri Lavrovnak, hogy teljesíti az orosz fél kéréseit a készülő uniós szankciós csomagok módosításával kapcsolatban.',
                  'Az április 8-án kikerült felvételek szerint a magyar külügyi vezetés bizalmas, belső uniós dokumentumokat és munkaanyagokat is továbbított az orosz külügyminiszternek. A beszélgetésekben egyeztettek Ukrajna uniós csatlakozási tárgyalásairól és a tervezett magyar vétók időzítéséről, valamint arról, mikor fogadja Putyin a magyar miniszterelnököt a következő NATO-csúcs előtt.',
                  'Szijjártó Péter a nyilvánosság előtt nem cáfolta a felvételek valódiságát. A Telex kamerái előtt gúnyosan mindössze annyit kérdezett: „Ebben nem tudom, mi annyira különleges" — megpróbálva mindennapi diplomáciai működésként beállítani a háborús agresszor féllel való folyamatos egyeztetést.',
                ],
                sources: [
                  { source: 'HVG', date: '2026. márc. 31.', headline: 'Szijjártó készségesen megígéri, hogy teljesíti Lavrov kérését egy most kikerült hangfelvételen', url: 'https://hvg.hu/itthon/20260331_szijjarto-lavrov-telefonbeszelgetes-felvetele-panyi-szabolcs-eu-szankciok' },
                  { source: 'Index', date: '2026. ápr. 8.', headline: 'Újabb hangfelvételek kerültek elő Szijjártó Péter telefonbeszélgetéseiről', url: 'https://index.hu/kulfold/2026/04/08/szijjarto-peter-szergej-lavrov-hangfelvetel-europai-unio-dokumentum/' },
                  { source: 'Forbes', headline: 'Újabb hangfelvételek kerültek ki Lavrov és Szijjártó beszélgetéseiről: európai uniós dokumentumokat is kapott az orosz külügyminiszter', url: 'https://www.forbes.hu/tarsadalom/hangfelvetel-lavrov-szijjarto-unios-dokumentum-oroszorszag-usa-fidesz/' },
                ],
              },
            ],
          },
        ],
      },
      videoBlock: {
        heading: 'A felvételek — ahogy több szerkesztőség lejátszotta',
        intro:
          'Egy leírt idézetet könnyű letagadni. Egy hangfelvételt, amit egymástól függetlenül több szerkesztőség is lejátszik a nézőinek, sokkal nehezebb.',
        items: [
          { id: '91VhoqZjU9M', label: 'ATV', title: 'Újabb titkos Szijjártó–Lavrov hangfelvételek szivárogtak ki', summary: 'A kikerült beszélgetések és a tartalmuk végigvéve.' },
          { id: 'zQjM7PSFfws', label: 'ATV', title: 'Kiszivárgott Szijjártó és Lavrov újabb telefonbeszélgetése, gúnyosan reagált a külügyminiszter', summary: 'A felvétel, és ami legalább annyira sokatmondó: a miniszter reakciója rá.' },
          { id: 'DIXUEhHogkw', label: 'Telex', title: 'Szijjártó a Lavrovval egyeztetésről: Ebben nem tudom, mi annyira különleges', summary: 'A külügyminiszter saját szavai. Nem cáfolat — magyarázat arra, hogy szerinte ez normális működés.' },
          { id: '7W9tZ8jCeXI', label: 'KecsUP Hírek', title: 'Panyi Szabolcs Kecskeméten: Csak az nem hallgatta le Szijjártót, aki nem akarta', summary: 'Maga az újságíró beszél arról, mi történt és miért.' },
        ],
      },
      table: {
        heading: 'A két ügy összevetése',
        intro:
          'Panyi Szabolcs két korszakos ügye jól mutatja be az államapparátus és a független oknyomozás közötti aszimmetrikus háborút — és azt, hogyan változott a hatalom válasza öt év alatt.',
        columns: ['Szempont', 'Pegasus-botrány (2021)', 'Szijjártó–Lavrov-ügy (2026)'],
        rows: [
          ['Az újságíró szerepe', 'Célpont: az állam a telefonját figyelte meg a forrásai azonosítására.', 'Feltáró: a hozzá eljuttatott felvételeket hozta nyilvánosságra.'],
          ['Alkalmazott technológia', 'Katonai szintű izraeli zéró-klikk kémszoftver.', 'Telefonvonalak lehallgatása, illetve belső szivárogtatás.'],
          ['A hatalom reakciója', 'Hónapokig tartó tagadás, majd a vásárlás elismerése a szakbizottságban.', 'Azonnali büntetőjogi válasz: feljelentés kémkedés gyanújával, a választás előtt.'],
          ['A sztori tétje', 'Az újságírók és állampolgárok elleni megfigyelési hálózat leleplezése.', 'A külpolitikai orientáció és az oroszoknak való szivárogtatás dokumentálása.'],
        ],
      },
      extra: [
        {
          heading: 'Mi az a Pegasus, és miért nem átlagos lehallgatás?',
          paragraphs: [
            'Sokan a mai napig egy kalap alá veszik a Pegasust a hagyományos telefonlehallgatással vagy a híváslisták lekérésével. A valóságban ez egy katonai szintű, kiberfegyvernek minősülő kémszoftver, amelyet az izraeli NSO Group fejlesztett ki, és amelyet a cég kizárólag szuverén államok kormányainak és titkosszolgálatainak értékesíthet — hivatalosan terrorizmus és súlyos bűncselekmények felszámolására.',
            'A legfélelmetesebb tulajdonsága a zéró-klikk technológia. A hagyományos vírusokkal ellentétben a telepítéséhez a célszemélynek nem kell rákattintania semmilyen gyanús linkre, nem kell megnyitnia fertőzött csatolmányt: a szoftver láthatatlanul, például egy hívás vagy egy üzenet háttérfolyamatán keresztül, az operációs rendszer biztonsági réseit kihasználva települ.',
            'Amint bejut, az eszköz gyakorlatilag megszűnik a tulajdonosáé lenni. Hozzáfér a végpontig titkosított alkalmazásokhoz is, mert a leírt üzenetekhez még az elküldésük és titkosításuk előtt hozzájut. Emellett távolról, láthatatlanul bekapcsolhatja a mikrofont és a kamerát, rögzítheti a környezeti hangokat, és folyamatosan küldi a szerverekre a GPS-helyadatokat és a teljes galériát.',
            'Egy újságírónál ez nem magánéleti kérdés. A telefon a forrásrendszer: a névjegyzék, az üzenetváltások és a mozgás együtt gyakorlatilag megmutatja, ki beszélt az újságíróval az államapparátuson belül.',
          ],
        },
        {
          heading: 'Mit mondanak róla a kritikusok és a támogatók?',
          paragraphs: [
            'A támogatói szerint a modern magyar újságírás bátor szimbóluma, aki nem hátrált meg akkor sem, amikor kiderült, hogy a zsebében lévő telefonnal maguk a titkosszolgálatok figyelik minden lépését. A munkássága nélkül a Kegyencjárat nemzetbiztonsági anyaga vak lenne, a választások előtti külügyi botrány pedig azt bizonyította, hogy az oknyomozás képes alapjaiban megrengetni a propagandára épített falakat.',
            'A kritikusai — a régi rendszer maradványai és radikális nemzeti körök — a mai napig azzal vádolják, hogy nemzetközi hálózatok tagjaként idegen érdekeket szolgál, és a titkos hangfelvételek közzétételével veszélyeztette Magyarország diplomáciai mozgásterét.',
          ],
        },
      ],
      faq: [
        {
          q: 'Ki Panyi Szabolcs?',
          a: 'Nemzetbiztonsági, külpolitikai és fegyverkereskedelmi ügyekre szakosodott oknyomozó újságíró, a Direkt36 és a VSquare munkatársa.',
        },
        {
          q: 'Mi az a Pegasus?',
          a: 'Katonai szintű, kiberfegyvernek minősülő izraeli kémszoftver, amelyet kizárólag államok vásárolhatnak meg. Zéró-klikk módszerrel, a felhasználó bármilyen közreműködése nélkül települ, és teljes hozzáférést ad a telefonhoz — a titkosított üzenetekhez, a mikrofonhoz és a kamerához is.',
        },
        {
          q: 'Miért figyelték meg Panyi Szabolcsot?',
          a: 'A technikai vizsgálat szerint a telefonja elleni támadás egy nappal azután indult, hogy hivatalos megkeresésekkel fordult minisztériumokhoz egy orosz hátterű nemzetközi pénzintézettel kapcsolatos cikk ügyében.',
        },
        {
          q: 'Miért jelentették fel kémkedésért?',
          a: 'A feljelentés három nappal azután érkezett, hogy közzétett egy teljes Szijjártó–Lavrov-telefonbeszélgetést, és néhány héttel a 2026-os választás előtt. Nemzetközi újságíró- és emberi jogi szervezetek élesen bírálták.',
        },
        {
          q: 'Panyi Szabolcs hallgatta le Szijjártót?',
          a: 'Nem, és ezt ő maga is határozottan cáfolta: állítása szerint a lehallgatáshoz semmi köze nem volt. Újságíróként a hozzá eljutott felvételeket hozta nyilvánosságra.',
        },
      ],
    },
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
    live: true,
    detail: {
      seoTitle: 'Gulyáságyú Média: a hatvanpusztai zebrák és ami utána jött',
      seoDescription:
        'A Gulyáságyú Média találta meg a zebrákat Mészáros Lőrinc telephelyén. Mi lett az ügyből? Tagadás, hatósági adatok, elpusztult állatok — a teljes történet.',
      lead:
        'A Gulyáságyú Média helyszíni, utcai videós műhely: kampánygyűlésekre, birtokhatárokra és vidéki helyszínekre jár ki kamerával. A legismertebb munkájuk a „zebra-gate" — az az eset, ahol egy néhány perces felvételből kétéves hatósági ügy lett.',
      cases: {
        heading: 'A zebra-gate és a többi ügyük',
        intro:
          'Ez a fal legjobb példája arra, mire jó a puszta jelenlét egy helyszínen. Nem adatbázist fésültek át, nem pereskedtek: kimentek, és felvették, ami ott van. A következmények viszont évekig gyűrűztek.',
        items: [
          {
            title: 'Zebra-gate — megtalálták a zebrákat',
            when: '2024. november 12.',
            body:
              'Olvasói tippre mentek ki Mészáros Lőrinc egyik cégének, a Talentis Group Zrt.-nek a Hatvanpuszta és Bicske közötti, alcsútdobozi külterületi telephelyére. Az eldugott, kerítéssel és mesterséges dombbal takart területen afrikai zebrákat, egzotikus ankole-watusi szarvú marhagulyát — és egy szamarat — videóztak.',
            more: [
              'A felvétel azért lett országos ügy, mert nem kellett hozzá magyarázat. Egy közpénzből felépült cégbirodalom mezőgazdasági telephelyén legelésző zebracsorda önmagában elmond mindent arról, mire megy el a pénz. Néhány napon belül már a parlamentben is kérdésként hangzott el az ügy.',
            ],
            sources: [
              { source: 'Gulyáságyú Média', date: '2024. nov. 12.', headline: 'Zebrák Mészáros Lőrinc cégének telephelyén Hatvanpuszta és Bicske között (videó)', url: 'https://gulyasagyu.media/2024/11/12/meszaros-lorinc-zebrak-hatvanpuszta-bicske-alcsut/' },
              { source: 'Telex', date: '2024. nov. 12.', headline: 'Zebracsorda és különleges gulya legelészik Mészáros Lőrinc cégtelephelyén', url: 'https://telex.hu/belfold/2024/11/12/zebra-ankole-watusi-marha-hatvanpuszta-talentis-meszaros-lorinc', lead: 'A Gulyáságyú Média vette észre a Fejér vármegyei szafarit.' },
            ],
            videos: [
              {
                id: 'JHsdnuogC7o',
                label: 'Gulyáságyú Média · 2024',
                title: 'Zebrák Mészáros Lőrincéknél Hatvanpuszta és Bicske között',
                summary:
                  'Ez az a felvétel, aminek a létezését később tagadni próbálták. Kerítés, mesterséges domb, mögötte zebracsorda.',
              },
            ],
            sections: [
              {
                heading: 'A tagadás — a felvétel ellenére',
                paragraphs: [
                  'A történet érdekesebb része az, ami utána jött. A kampány idején kormánypárti oldalról teljes erővel próbálták tagadni, hogy egyáltalán lennének ott zebrák — miközben a felvétel nyilvánosan elérhető volt, és mint később kiderült, a Mészároshoz köthető vadásztársaság akkor már kilenc éve tartott zebrákat a területen.',
                  'A területhez köthető vadásztársaság közben más magyarázattal állt elő: szerintük „mentett állatokról" van szó, amelyeket rossz körülmények közül hoztak el. Ez a két érvelés — hogy nincsenek is zebrák, illetve hogy vannak, de állatvédelmi okból — egyszerre nem lehet igaz. Épp ez a felvétel értéke: nem vélemények ütköztek, hanem egy videó és egy állítás.',
                ],
              },
              {
                heading: 'Hadházy kiderítette, hány zebra van',
                paragraphs: [
                  'Miután feltűnt, hogy az állatok egy részét szűkebb karámba zárták, Hadházy Ákos hatósági úton kérdezett rá a számokra. A Nébih válasza szerint a Mészáros Lőrinchez köthető Vál-völgye Vadásztársaság tulajdonában és tartásában tíz zebra volt. Itt kapcsolódik össze a két munkamódszer: a helyszíni felvétel megmutatta, hogy vannak; az adatigénylés megmondta, hogy hányan.',
                ],
                links: [{ text: 'Hadházy Ákos', href: '/rendszervaltas/hadhazy-akos' }],
                sources: [
                  { source: 'Index', date: '2026. ápr. 18.', headline: 'Kiderült, pontosan hány zebra található Hatvanpusztán', url: 'https://index.hu/belfold/2026/04/18/hadhazy-akos-nebih-zebra-vadasztarsasag-hatvanpuszta/' },
                ],
              },
              {
                heading: 'Három zebra elpusztult',
                paragraphs: [
                  'Néhány héttel később, 2026. május 4-én három zebra elpusztult a Hatvanpuszta melletti területen, a Vál-völgye Vadásztársaság állományából. A kormányhivatal júniusban eljárást indított az ügyben. Egy sztori, amely másfél évvel korábban kuriózumként indult, ezen a ponton már állatvédelmi hatósági ügy volt.',
                ],
                sources: [
                  { source: '444', date: '2026. máj. 29.', headline: 'Három zebra elpusztult a Hatvanpuszta melletti területen', url: 'https://444.hu/2026/05/29/harom-zebra-elpusztult-a-hatvanpuszta-melletti-teruleten' },
                  { source: '444', date: '2026. jún. 2.', headline: 'A kormányhivatal eljárást indított a Hatvanpuszta mellett elpusztult zebrák ügyében', url: 'https://444.hu/2026/06/02/a-kormanyhivatal-eljarast-inditott-a-hatvanpuszta-mellett-elpusztult-zebrak-ugyeben' },
                ],
              },
              {
                heading: 'Papírok nélküli állatok, és öt eltűnt zebra',
                paragraphs: [
                  'A hatósági vizsgálat szerint 2024 és 2026 között összesen tizenhét zebra fordult meg a területen, ötükről viszont semmilyen információ nincs. Az állatok nagy részének nem volt származási igazolása, a papírok jelentős részét pedig utólag készítették el.',
                  'Idáig jutott tehát az ügy attól, hogy néhány ember kiment egy dűlőútra kamerával. Ez a válasz arra a kérdésre, hogy mire jó a helyszíni videózás egy olyan médiában, ahol mindenki adatbázisokról beszél.',
                ],
                sources: [
                  { source: 'Telex', date: '2026. júl. 24.', headline: 'Gajdos László a hatvanpusztai zebrákról: Nagy részüknek semmi származási igazolása nincsen, a papírok nagy részét utólag készítették el', url: 'https://telex.hu/belfold/2026/07/24/gajdos-laszlo-zebrak-hatvanpuszta' },
                  { source: 'Telex', date: '2026. júl. 22.', headline: 'Gajdos Lászlóék nyomoznak a hatvanpusztai zebrák ügyében', url: 'https://telex.hu/belfold/2026/07/22/gajdos-laszloek-nyomoznak-a-hatvanpusztai-zebrak-ugyeben' },
                ],
              },
              {
                heading: 'Antilopok és magasles ugyanott',
                paragraphs: [
                  'A zebrák után visszatértek: 2025. július 31-én antilopokat és egy magaslest videóztak ugyanazon a Hatvanpuszta melletti, Mészáros-érdekeltségű területen. Az egyszeri felvétel még lehet véletlen — a sorozat viszont azt mutatta meg, hogy egy folyamatosan bővülő állatállományról van szó.',
                ],
                sources: [
                  { source: '444', date: '2025. júl. 31.', headline: 'Antilopokat videóztak Mészáros Lőrinc alcsútdobozi földjein', url: 'https://444.hu/2025/07/31/antilopokat-videoztak-meszaros-lorinc-alcsutdobozi-majorsaganal' },
                  { source: 'Telex', date: '2025. júl. 31.', headline: 'Most antilopokat és vadlest videóztak Hatvanpuszta mellett', url: 'https://telex.hu/belfold/2025/07/31/hatvanpuszta-gulyasagyu-antilop-zebra-vadles' },
                ],
                videos: [
                  {
                    id: '6VDrlZ11Gis',
                    label: 'Gulyáságyú Média · 2025',
                    title: 'Újabb egzotikus állatokat és MAGASLEST videóztunk Hatvanpuszta és Bicske között',
                    summary: 'A folytatás ugyanazon a területen, nyolc hónappal a zebrák után.',
                  },
                ],
              },
            ],
            promo: {
              href: '/ugyek/hatvanpuszta',
              eyebrow: 'Kiemelt ügy · Hatvanpuszta',
              title: 'Mi épült valójában Hatvanpusztán?',
              lead:
                'A birtok teljes feldolgozása a saját oldalán: becsült ingatlanérték, ismeretlen vagyonforrás, és hogy hol tart most az ügy.',
              cta: 'Az ügy megnyitása',
            },
          },
          {
            title: 'A hatvanpusztai autós támadás felvétele',
            when: '2025. augusztus 19.',
            body:
              'A műhely újságírója, Gulyás Balázs Hadházy Ákos autójában ült, amikor a hatvanpusztai birtok biztonsági őre nekiment a kocsinak. A felvétel nélkül az eset állítás szemben állítással lett volna; így viszont az egész ország látta, mi történt.',
            links: [{ text: 'Hadházy Ákos', href: '/rendszervaltas/hadhazy-akos' }],
            sources: [
              { source: 'HVG', date: '2025. aug. 25.', headline: 'Videón, ahogy nekimennek Hadházy Ákos autójának Hatvanpusztánál', url: 'https://hvg.hu/itthon/20250825_Videon-ahogy-megprobaljak-felboritani-Hadhazy-Akos-autojat-Hatvanpusztanal' },
            ],
            videos: [
              {
                id: 'ahlzM1ub9IA',
                label: 'Gulyáságyú Média',
                title: 'Így ÜLDÖZTÉK HADHÁZY autóját Hatvanpusztán',
                summary: 'A teljes felvétel az anyósülésről — az üldözéstől az ütközésen át a borulásig.',
              },
            ],
          },
          {
            title: 'Az opatijai villa — ahol a miniszterelnök nyaralt',
            when: '2023. augusztus 11.',
            body:
              'Egy hozzájuk eljutott videóval indult: a felvételen a miniszterelnök egy lépcsőn kimászik az Adriai-tengerből, majd törölközőbe csavarva bemegy egy tengerparti villába. A helyszínt és az időpontot külön ellenőrizték — a horvátországi Abbáziában készült, 2023. augusztus 11-én dél körül. Ezután ingatlan-nyilvántartási és egyéb adatokból derítették ki, kié az épület.',
            more: [
              'A közel 350 négyzetméteres villa tulajdonosa az ellenzéki LMP társelnökének, Ungár Péternek a nővére, Ungár Anna. A sztori épp ettől lett kényelmetlen mindenkinek: nem egy kormánypárti oligarcha nyaralójáról volt szó. Ungár Péter a megkeresésre azt válaszolta, hogy a nővére valóban tulajdonos, de abba nincs beleszólása, kit lát ott vendégül.',
              'Ez az eset mutatja meg a legjobban, mit tud egy ilyen műhely: a videó önmagában semmit nem bizonyított volna, ha nem hitelesítik a helyszínt, a dátumot és a tulajdonost. Az anyagot ezután az összes nagy szerkesztőség átvette.',
            ],
            videos: [
              {
                id: 'w8ncDqBxGmA',
                label: 'Gulyáságyú Média · 2023',
                title: 'Orbán Viktor az egyik ellenzéki pártelnök testvérének villájában nyaralt',
                summary: 'A felvétel, amelyből a sztori indult — és amelynek a helyszínét és dátumát külön ellenőrizték.',
              },
            ],
            sources: [
              { source: 'Gulyáságyú Média', date: '2023. szept. 8.', headline: 'Orbán Viktor az egyik ellenzéki pártelnök testvérének villájában nyaralt (videó)', url: 'https://gulyasagyu.media/2023/09/08/orban-viktor-nyaralas-ungar-peter-lmp-ellenzek-video/' },
              { source: 'Telex', date: '2023. szept. 8.', headline: 'Az LMP-társelnök Ungár Péter testvérének horvátországi villájában nyaralt Orbán', url: 'https://telex.hu/belfold/2023/09/08/orban-viktor-nyaralas-horvarorszag-adria-ungar-peter-testvere-nyaralo' },
              { source: 'HVG', date: '2023. szept. 9.', headline: 'Megtudtunk mindent az Ungár-villáról, amelynek tövében Orbán a tengerben csobbant', url: 'https://hvg.hu/itthon/20230909_Ungar_villa_Orban_nyaralas_Horvatorszag_Opatija_Abbazia' },
            ],
          },
          {
            title: 'K. Endre — hol dolgozott a kegyelmi ügy szereplője',
            when: '2024. február 12.',
            body:
              'A kegyelmi botrány kellős közepén hozták nyilvánosságra, hogy K. Endre — a bicskei gyermekotthon volt igazgatóhelyettese, akit kényszerítés miatt ítéltek el, majd elnöki kegyelmet kapott — 2016 és 2018 között a bicskei Csokonai Vitéz Mihály Általános Iskolában dolgozott. Az iskola igazgatója Bárányos József fideszes önkormányzati képviselő volt. A lap megszerzett egy rendőrségi dokumentumot is egy feljelentésről, amelyet az alkalmazás miatt tettek.',
            more: [
              'Fontos pontosítás, és a Kegyencjárat nem is állít mást: magát a kegyelmi botrányt nem a Gulyáságyú robbantotta ki — azt a Vidéki Prókátor, akinek szintén van profilja ezen a falon. Ez viszont már valódi, saját információval kiegészített feltárás volt, amely a történet egy addig ismeretlen szálát nyitotta meg.',
              'Az ügynek következménye is lett: az igazgató pályázatát 2024 nyarán szakmai és etikai kifogásokra hivatkozva nem támogatták, így 27 év után távoznia kellett a posztjáról. A tankerület már 2018-ban kifogásolta, hogy K. Endrét — aki akkor büntetőeljárás alatt állt — testnevelő tanárként foglalkoztatták.',
            ],
            links: [{ text: 'a Vidéki Prókátor', href: '/rendszervaltas/videki-prokator' }],
            sources: [
              { source: 'Gulyáságyú Média', date: '2024. febr. 12.', headline: 'Fideszes képviselő által vezetett iskolában dolgozott a pedofilügyben kegyelemben részesített K. Endre', url: 'https://gulyasagyu.media/2024/02/12/fideszes-kepviselo-altal-vezetett-iskolaban-dolgozott-a-pedofilugyben-kegyelemben-reszesitett-k-endre/' },
              { source: '444', date: '2024. júl. 9.', headline: 'Leváltják a bicskei iskolaigazgatót, aki testnevelő tanárként alkalmazta K. Endrét', url: 'https://444.hu/2024/07/09/levaltjak-a-bicskei-iskolaigazgatot-aki-testnevelo-tanarkent-alkalmazta-k-endret' },
              { source: 'Telex', date: '2024. júl. 9.', headline: '27 év után leváltják a bicskei iskolaigazgatót, aki még 2018-ban foglalkoztatta K. Endrét', url: 'https://telex.hu/belfold/2024/07/09/baranyos-jozsef-iskolaigazgato-bicske-k-endre-levaltas' },
            ],
          },
          {
            title: 'Buszoztatás a kormánypárti rendezvényekre',
            when: '2023. október 23.',
            body:
              'Több alkalommal foglalkoztak azzal, hogy kormánypárti rendezvényekre települési buszokkal szerveztek résztvevőket. A veszprémi október 23-i beszédnél „több tucat" buszról írtak, amelyek többek között Nagykanizsáról és Bicskéről érkeztek.',
            more: [
              'A módszer itt is a puszta jelenlét volt: a beszéd után néhány száz méterrel a helyszíntől videóra vették, ahogy több százan szállnak fel a hazafelé induló buszokra — a járműveket sorszámmal látták el, hogy az utasok megtalálják a sajátjukat. Ugyanezeket a sorszámozott buszokat később a 8-as főúton is viszontlátták.',
              'Néhány nappal később becslést is közöltek a rendezvény tényleges létszámáról. Ez az a fajta anyag, amely egyetlen iratot sem tartalmaz, mégis pontosan megmutatja, hogyan áll össze egy tömeg a képernyőn.',
            ],
            videos: [
              {
                id: 'I1lJ8X6BNKI',
                label: 'Gulyáságyú Média · 2023',
                title: 'Buszoztatták a résztvevőket Orbán október 23-i beszédére',
                summary: 'A sorszámozott buszok, ahogy a beszéd után felszállnak rájuk a résztvevők.',
              },
            ],
            sources: [
              { source: 'Gulyáságyú Média', date: '2023. okt. 23.', headline: 'Buszoztatták a résztvevőket Orbán október 23-i beszédére (videó)', url: 'https://gulyasagyu.media/2023/10/23/buszoztatas-orban-oktober-23-veszprem/' },
              { source: 'HVG', date: '2023. okt. 23.', headline: 'Videó: Százakat buszoztattak Orbán Viktor veszprémi beszédére', url: 'https://hvg.hu/itthon/20231023_Video_Orban_Viktor_Veszprem_beszed_buszoztatas' },
              { source: 'Gulyáságyú Média', date: '2023. okt. 26.', headline: 'Nagyjából ezren lehettek Orbán Viktor október 23-i veszprémi beszédén', url: 'https://gulyasagyu.media/2023/10/26/ezer_resztvevo-orban-viktor-oktober-23-veszprem-beszed/' },
            ],
          },
          {
            title: 'A százmilliós páncélozott BMW Párizsban',
            when: '2025. március 6.',
            body:
              'Azonosították, hogy a miniszterelnök egy magyar rendszámú, mintegy százmillió forint értékű páncélozott BMW 760i xDrive Protection limuzinnal érkezett az Élysée-palotába Emmanuel Macronhoz. Az autó biztonsági felszereltségét és értékét külön is megvizsgálták.',
            more: [
              'A történet pikantériája a forrás volt: a miniszterelnök saját közösségi oldalának szerkesztői ügyeltek rá, hogy a jármű ne látsszon a felvételeken — a vele utazó kormánypárti influenszer által közzétett videón viszont jól kivehető volt. A beszerzésnek a közbeszerzési nyilvántartásokban nem volt nyoma.',
              'Ez nem politikai kommentár volt, hanem egy konkrét, nehezen hozzáférhető tárgyi információból felépített sztori — és jól mutatja a műhely másik erősségét: észreveszik azt, amit mindenki lát, de senki nem néz meg alaposan.',
            ],
            sources: [
              { source: 'Népszava', date: '2025. márc. 6.', headline: 'Orbán Viktor százmillió forintos páncélozott BMW-vel ment tárgyalni Emmanuel Macronhoz', url: 'https://nepszava.hu/3271312_orban-viktor-parizs-emmanuel-macron-bmw-szazmillios-pancelozott' },
              { source: 'HVG', date: '2025. márc. 6.', headline: 'Orbán Viktor százmilliós páncélozott BMW-t villantott', url: 'https://hvg.hu/itthon/20250306_orban-viktor-bmw-franciaorszag' },
              { source: 'Telex', date: '2025. márc. 11.', headline: 'Védelem golyózápor és robbantás ellen, bő 250 millió forintért: ilyen BMW-vel jár Orbán Viktor', url: 'https://telex.hu/belfold/2025/03/11/bmw-760li-protection-pancelozott-auto-orban-viktor' },
            ],
          },
        ],
      },
      videoGrid: {
        heading: 'A csatorna legnézettebb videói',
        intro:
          'A Gulyáságyú teljes feltöltési listájából a mindenkori legnézettebb adások. Jól látszik rajtuk a műhely profilja: birtokhatár, börtönkapu, parlamenti folyosó — ott vannak, ahol történik valami.',
        channelUrl: 'https://www.youtube.com/@gulyasagyumedia/videos',
        channelLabel: 'A csatorna összes videója',
        items: [
          { id: 'QzreNZpVByI', title: 'Magyar felirattal: Deutsch Tamás és az angol nyelv egy strapás napja az Európai Parlamentben', note: '338 E megtekintés' },
          { id: '0DikkoiYX08', title: 'A hatvanpusztai Orbán-birtok madártávlatból', note: '295 E megtekintés' },
          { id: 'VLEP11Yzix0', title: 'MNB-ügy: 90 milliárd Ft LEFOGLALÁS – A rendőrség és az ügyészség teljes sajtótájékoztatója', note: '228 E megtekintés' },
          { id: 'kAAJd3aMnYg', title: 'A GYÁSZMUNKÁRÓL kérdeztünk fideszes hírességeket – Nagy Feró, Deák Dániel, Gajdics Ottó és mások', note: '220 E megtekintés' },
          { id: '2FK7voy8f_A', title: 'Megszólal Bese Gergő atya családja: Lelki beszélgetésre hívták, melegorgia lett a vége', note: '211 E megtekintés' },
          { id: 'BB2LbhgDZbM', title: 'Kiszabadult a bicskei pedofil igazgató – Ott voltunk a börtönajtóban', note: '198 E megtekintés' },
          { id: '55-8B0Djuc0', title: 'Orbán VOLT SAJTÓFŐNÖKE a teraszon cigizett, miközben MAGYAR PÉTER bejárást tartott a minisztériumban', note: '196 E megtekintés' },
          { id: 'UZxwM8iZJTk', title: 'Újabb személyekkel fog bővülni az USA szankciós listája! – Radványi Miklós a Gulyáságyú podcastban', note: '169 E megtekintés' },
          { id: 'SuZzEP9e6KE', title: 'Elkezdődött a HATVANPUSZTAI biztonsági őr büntetőügye, aki nekihajtott HADHÁZYNAK és munkatársunknak', note: '150 E megtekintés' },
          { id: 's8KgAi4yIRE', title: 'Stábunkra támadt K. Endre „családi barátja” Bicskén', note: '140 E megtekintés' },
          { id: 'rH4uheuPD7U', title: 'A sükösdi Sugo Tamburazenekar előadása az Országgyűlés alakuló ülésén – 2026. május 9.', note: '140 E megtekintés' },
          { id: '1y7ejPJIORg', title: 'Kérdésekkel PROVOKÁLTUK az ÚJ KÉPVISELŐKET az Országgyűlésben – Nehéz lesz a RENDSZERVÁLTÁS?', note: '139 E megtekintés' },
        ],
      },
      extra: [
        {
          heading: 'Miért számít a helyszíni videózás?',
          paragraphs: [
            'A magyar közéleti nyilvánosságban az elmúlt években a feltárás jellemzően adatokból történt: közbeszerzési értesítőkből, cégiratokból, kiszivárgott dokumentumokból. Ez fontos munka, de van egy gyengesége — a számokat könnyű vitatni, átkeretezni vagy egyszerűen unalmassá tenni.',
            'Egy felvétel mást csinál. Nem érvel, hanem mutat. A zebra-gate pontosan azért lett akkora ügy, amekkora, mert nem kellett hozzá szakértő, aki elmagyarázza: mindenki azonnal értette, mit lát. És amikor a tagadás megindult, a videó ott volt továbbra is, változatlanul.',
            'A másik érték az időbeliség. A Gulyáságyú többször visszatért ugyanarra a helyszínre, és ebből lett a sorozat: nem egy kép, hanem egy folyamat dokumentációja. Ez az, amit egyetlen adatigénylés sem tud pótolni.',
          ],
        },
        {
          heading: 'A műhely többi munkája',
          paragraphs: [
            'A zebrákon túl a Gulyáságyú műfaja a helyszíni, utcai riport: kampánygyűlések, lakossági fórumok, tiltakozások, vidéki helyszínek. Az anyagaik ritkán tartalmaznak pénzügyi kimutatást — viszont rögzítik azt, ami a hivatalos beszámolókból mindig kimarad.',
            'Ez a fajta munka azért értékes, mert dokumentum értékű felvételt hoz létre olyan eseményekről, amelyekről egyébként csak a szervezők saját, vágott közvetítése maradna fenn. A csatorna a Kegyencjárat videórovatában is folyamatosan jelen van.',
          ],
          links: [{ text: 'a Kegyencjárat videórovatában', href: '/podcastok' }],
        },
      ],
      faq: [
        {
          q: 'Mi az a zebra-gate?',
          a: 'A Gulyáságyú Média 2024 novemberében afrikai zebrákat és egzotikus marhákat videózott Mészáros Lőrinc egyik cégének Hatvanpuszta és Bicske közötti telephelyén. Az ügy azóta hatósági vizsgálatig jutott.',
        },
        {
          q: 'Hány zebra van Hatvanpusztán?',
          a: 'Hadházy Ákos adatigénylésére a Nébih 2026 áprilisában tíz zebrát jelölt meg a Vál-völgye Vadásztársaság tulajdonában. A későbbi vizsgálat szerint 2024 és 2026 között összesen tizenhét zebra fordult meg a területen, ötükről nincs információ.',
        },
        {
          q: 'Igaz, hogy elpusztultak a hatvanpusztai zebrák?',
          a: 'Három zebra 2026. május 4-én elpusztult a Hatvanpuszta melletti területen. A kormányhivatal júniusban eljárást indított az ügyben.',
        },
        {
          q: 'Mivel foglalkozik a Gulyáságyú Média?',
          a: 'Helyszíni, utcai videós riportokkal: kampánygyűlésekkel, lakossági fórumokkal, tiltakozásokkal és vidéki helyszínekkel — azt rögzítik, ami a hivatalos beszámolókból kimarad.',
        },
      ],
    },
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
  {
    id: 'de-akciokozosseg',
    name: 'DE! Akcióközösség',
    kind: 'org',
    group: 'media',
    role: 'civil akcióközösség, választási megfigyelés',
    badge: 'VÁLASZTÁSI ŐRSZEMEK',
    tagline:
      'Nem cikket írt a szavazatvásárlásról, hanem kétezer önkéntest állított a szavazókörök elé azon a napon, amikor ez számított.',
    // A márkanév a biztos cél (egyértelmű keresési szándék). A nagyobb falat
    // a filmé: „a szavazat ára" 3600/hó, „szavazat ára film" 1900/hó (HU,
    // 2026-09) — ez a saját profiloldal fő kulcsszava, ha megépül.
    targetKeyword: { phrase: 'de akcióközösség', volume: 320, kd: 27 },
    section: {
      heading: 'DE! Akcióközösség — akik a szavazatvásárlást a helyszínen állították meg',
      paragraphs: [
        'A DE! Akcióközösség 2025-ben alakult, és nem szerkesztőség, nem is párt: önkéntesekből álló civil egyesület, amely a magyar választások legrégebbi és legnehezebben bizonyítható visszaélésével foglalkozik — a legszegényebb települések lakóinak kiszolgáltatottságával.',
        'Az első nagy munkájuk egy dokumentumfilm volt. „A szavazat ára" 2026. március 26-án jelent meg, és több mint hatvan interjúra épül: korábbi szavazatgyűjtőkkel, szegregátumokban élő választókkal, polgármesterekkel és rendőrökkel. A film nem a pénzről szól, hanem a függésről — arról, hogy a legtöbb helyen a fenyegetés, a munka és a segély elvesztésének kilátása működik, nem a borítékban átadott összeg.',
        'A második lépés az volt, ami a magyar civil szférában addig nem sikerült: a feltárt módszereket a helyszínen próbálták megakadályozni. 2026. április 12-én több mint 2100 önkéntes őrszemet, mintegy 200 motorost és nagyjából 500 helyi segítőt mozgattak meg, elsősorban keleti és északkeleti kistelepüléseken. A napot 255 visszaélésgyanús esettel, 192 dokumentált szavazatszállítással és közel 30, önkéntesek ellen elkövetett támadással zárták.',
        'Az egyesület saját összesítése szerint egyes szavazókörökben harminc százalékkal kevesebb szavazatot sikerült megvásárolni, mint az előző választáson. Ez a szám vitatható és nehezen ellenőrizhető — a jelenlét visszatartó ereje viszont pontosan az a hatás, amit egy utólag megírt cikk sosem tud elérni. A választás után a közösség nem oszlott fel: 2026 szeptemberében megrendezték a DE!HOGYNEM! nevű közéleti fesztivált Balatonalmádiban.',
      ],
      video: {
        id: 'ZCwQR5HRWR8',
        label: 'DE! Akcióközösség · 2026. március 26.',
        title: 'A szavazat ára',
        summary:
          'A teljes dokumentumfilm. Több mint hatvan interjú arról, hogyan lesz a kiszolgáltatottságból szavazat — korábbi szavazatgyűjtők, szegregátumokban élők, polgármesterek és rendőrök megszólalásával.',
      },
    },
    related: [{ label: 'Kapcsolódó ügyek az adatbázisban', href: '/adatbazis' }],
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
    id: 'molnar-aron',
    name: 'Molnár Áron',
    kind: 'person',
    group: 'person',
    role: 'színész, aktivista (noÁr)',
    badge: 'NKA-BOTRÁNY',
    tagline:
      'Ő robbantotta ki az NKA-botrányt — a rendszerváltás UTÁN, amikor már senki nem várta, hogy jöjjön még egy ekkora ügy.',
    section: {
      heading: 'Molnár Áron — a botrány, ami a fordulat után jött',
      paragraphs: [
        'Molnár Áron színészként és aktivistaként évek óta jelen van a közéletben, de a legnagyobb hatású munkája időben kilóg mindenki máséból ezen a falon: ő az NKA-botrányt nem április 12. előtt robbantotta ki, hanem utána.',
        'Elsőként ő beszélt arról a rejtett, nagyságrendileg 17 milliárdos keretről, amelyből a Nemzeti Kulturális Alap a kormányzati holdudvar gazdasági, közéleti és művészeti szereplőit támogatta — köztük egy addig ismeretlen, „Kiemelt Kulturális Programok Ideiglenes Kollégiuma" nevű testület döntései alapján. Az ügy azóta is gyűrűzik: 2026 nyarán újabb szervezeteket nevezett meg, ősszel pedig mentelmi jogok felfüggesztését követelte.',
        'Ez a fal arról szól, kinek köszönhetjük a fordulatot — Molnár Áron viszont arra a kérdésre a válasz, hogy mi történik utána. Egy rendszerváltás nem ér véget azzal, hogy leváltanak egy kormányt: az elszámoltatás akkor kezdődik. Az is a képhez tartozik, hogy a feltárást követően őt magát is megvádolták NKA-pénzek elfogadásával, amit ő visszautasított.',
      ],
    },
    related: [
      { label: 'NKA-botrány', href: '/ugyek/nka-botrany' },
      { label: 'Videóriportok és podcastok', href: '/podcastok' },
    ],
    detail: {
      seoTitle: 'Molnár Áron és az NKA-botrány: mit tárt fel?',
      seoDescription:
        'Molnár Áron (noÁr) robbantotta ki az NKA-botrányt: elsőként beszélt a rejtett, 17 milliárdos keretről és az ismeretlen kollégiumról. Mi történt pontosan?',
      lead:
        'Molnár Áron színész és aktivista, az NKA-botrány kirobbantója. Az ügy időben kilóg a többi feltárásból: nem a 2026. április 12-i fordulat előtt robbant, hanem utána — és épp ezért mutat rá arra, hogy egy kormányváltás nem zárja le az elszámoltatást, hanem elkezdi.',
      cases: {
        heading: 'Az NKA-botrány — mit tárt fel',
        items: [
          {
            title: 'A rejtett, 17 milliárdos keret',
            body:
              'Elsőként ő beszélt arról, hogy a Nemzeti Kulturális Alapnál létezett egy nagyságrendileg 17 milliárd forintos keret, amelyből a kormányzati holdudvar gazdasági, közéleti és művészeti szereplői részesültek. A pénz egy részéről egy addig gyakorlatilag ismeretlen testület, a „Kiemelt Kulturális Programok Ideiglenes Kollégiuma" döntött — vagyis a szakmai kollégiumi rendszert meg lehetett kerülni.',
            sources: [
              { source: 'Index', date: '2026. ápr. 28.', headline: 'Nem csitul a botrány a Fidesz-holdudvarnak kifizetett milliárdok körül', url: 'https://index.hu/kultur/2026/04/28/nemzeti-kulturalis-alap-fidesz-holdudvar-milliardok-hanko-balazs-molnar-aron/' },
            ],
          },
          {
            title: 'Az ügy nem állt meg egy bejelentésnél',
            when: '2026 nyara és ősze',
            body:
              'A feltárás nem egyszeri poszt volt: augusztusban újabb szervezeteket nevezett meg a kedvezményezettek közül, szeptemberben pedig mentelmi jogok felfüggesztését követelte az érintett politikusoknál. Ez a kitartás a különbség a botrány és az ügy között.',
          },
          {
            title: 'A visszatámadás',
            body:
              'A feltárás után őt magát is megvádolták azzal, hogy NKA-pénzeket fogadott el — amit visszautasított. Ez a mintázat ismerős: a feltáró hitelességének megkérdőjelezése rendszerint gyorsabban érkezik, mint az érdemi válasz a feltárt tényekre.',
            sources: [
              { source: '444', date: '2026. júl. 2.', headline: 'Az NKA-pénzek elfogadásával vádolt Molnár Áron szerint nem fogadott el NKA-pénzeket', url: 'https://444.hu/2026/07/02/az-nka-penzek-elfogadasaval-vadolt-molnar-aron-szerint-nem-fogadott-el-nka-penzeket' },
            ],
          },
        ],
      },
      faq: [
        {
          q: 'Ki robbantotta ki az NKA-botrányt?',
          a: 'Molnár Áron színész-aktivista. Elsőként ő beszélt a Nemzeti Kulturális Alap rejtett, nagyságrendileg 17 milliárdos kereteiről és az azokról döntő, addig ismeretlen ideiglenes kollégiumról.',
        },
        {
          q: 'Mikor robbant ki az NKA-botrány?',
          a: '2026 tavaszán, vagyis a április 12-i rendszerváltás UTÁN. Ezért is különleges eset: azt mutatja, hogy a feltárás nem ér véget egy kormányváltással.',
        },
      ],
      sources: [
        { source: 'Kegyencjárat', headline: 'NKA-botrány', url: 'https://www.kegyencjarat.hu/ugyek/nka-botrany' },
      ],
    },
  },
  {
    id: 'videki-prokator',
    name: 'Vidéki Prókátor',
    kind: 'person',
    group: 'channel',
    role: 'Fülöp Botond ügyvéd Facebook-oldala',
    badge: 'KEGYELMI ÜGY',
    tagline:
      'Egy vidéki ügyvéd, aki reggelente átolvasta a bírósági határozatokat — és az egyikből kiesett a kegyelmi botrány.',
    section: {
      heading: 'Vidéki Prókátor — az egy ember, akivel az egész elindult',
      paragraphs: [
        'A Vidéki Prókátor éveken keresztül egy anonim, kizárólag a Facebookon publikáló közéleti és jogi elemző oldal volt. A profil mögött álló szerző stílusát a kezdetektől fogva a rendkívül precíz jogi érvelés, a klasszikus polgári, konzervatív értékrend és a regnáló hatalom működésének tűpontos, száraz, mégis szarkasztikus kritikája jellemezte.',
        'Sokáig csak annyit lehetett tudni róla, amit a neve is sugallt: egy vidéki Magyarországon alkotó, a mindennapi praxisában aktív jogász, aki nem a fővárosi politikai buborékból szemléli az eseményeket. Írásai azért lettek népszerűek, mert nem a megszokott pártpolitikai paneleket ismételgette, hanem törvényszövegek, bírósági ítéletek és hivatalos határozatok alapján mutatta be a jogállam szisztematikus leépítését.',
        'A profil politikai gyökerei mélyre nyúlnak. Mint az később, a névtelenség feladása után kiderült, a szerző a rendszerváltás hajnalán először a Magyar Demokrata Fórum tagjaként politizált, majd a korai, még polgári korszakát élő Fideszhez csatlakozott. Innen nézve vált a rendszer egyik legveszélyesebb külső kritikusává: pontosan ismerte azt az értékrendet, amelyet a kormánypártok hivatalosan hirdettek, és azt a valóságot is, amelyet a jogi csűrcsavarásokkal eltakarni igyekeztek.',
      ],
    },
    live: true,
    detail: {
      seoTitle: 'Vidéki Prókátor (dr. Fülöp Botond) — ki ő, és mit robbantott ki?',
      seoDescription:
        'A komlói ügyvéd, aki egyetlen kúriai határozatból kirobbantotta a kegyelmi botrányt. Ki a Vidéki Prókátor, mik a legfontosabb posztjai, és miért fedte fel magát?',
      lead:
        'A Kegyencjárat Dicsőségfalának egyik legrejtélyesebb, majd később leglátványosabban előlépő alakja a Vidéki Prókátor álnéven elhíresült jogász. Nélküle — a jogi adatbázisok makacs böngészése nélkül — valószínűleg nem indult volna el az a lavina, amely a 2026. április 12-i fordulathoz vezetett. Hogyan talált rá egy eldugott kúriai határozatra, milyen posztokkal mozgósította a nyilvánosságot, és ki rejtőzik a profil mögött?',
      cases: {
        heading: 'A három bejegyzés, ami a legtöbbet számított',
        intro:
          'A Vidéki Prókátor legmeghatározóbb tevékenységei nemcsak elméleti jogi elemzések voltak, hanem a társadalmi elégedetlenség fókuszpontjai is — mindhárom komoly sajtóvisszhangot kapott.',
        items: [
          {
            title: 'A kegyelmi ügy: a kúriai határozat, amit rajta kívül senki nem vett észre',
            when: '2024. február',
            body:
              'Rutinmunka és egy sajátos reggeli szokás részeként a Kúria hivatalos határozatait böngészte a bírósági döntések adatbázisában, amikor rábukkant egy dokumentumra. A határozat szövege tartalmazta, hogy a köztársasági elnök elnöki kegyelemben részesítette a bicskei gyermekotthon korábbi igazgatóhelyettesét, akit a bíróság kényszerítés miatt ítélt el jogerősen — azért, mert megpróbálta rávenni a pedofil igazgató áldozatait a vallomásuk visszavonására.',
            more: [
              'Azonnal felismerte a határozat morális és politikai súlyát. Ahelyett viszont, hogy maga próbálta volna a nyilvánosság elé tárni, a dokumentumot és a jogi kontextust elküldte a független sajtónak, köztük a 444 szerkesztőségének. Ezzel párhuzamosan a saját oldalán is közzétette a jogi háttérelemzést, amely feketén-fehéren bizonyította: a kegyelem ténye jogilag és dokumentáltan megtörtént, a hatalom nem tudja letagadni.',
              'A poszt lényege egyetlen mondatban: a jog nem ismer politikai opportunizmust. Ha a határozat kint van a bírósági tárban, akkor az tény — az elnöki kegyelem nem titkolható el a társadalom elől. A botrány hatására a köztársasági elnök és a volt igazságügyi miniszter is lemondani kényszerült, ami közvetlenül megágyazott Magyar Péter színre lépésének.',
            ],
          },
          {
            title: 'A rokkantnyugdíjasok kisemmizése — amire a legbüszkébb',
            body:
              'Bár a közvélemény a kegyelmi botrány miatt ismerte meg a nevét, ő maga nyilvánosan kifejtette, hogy szakmailag és emberileg erre a jogi harcára a legbüszkébb. Konkrét eseteken és ügyvédi tapasztalatain keresztül bizonyította be, hogyan vágta meg az állam jogellenesen — megalázó orvosi felülvizsgálatokra hivatkozva — a megváltozott munkaképességű emberek juttatásait.',
            more: [
              'Ez nem posztolásban merült ki: az általa benyújtott alkotmányjogi panasz indított el azt a folyamatot, amelynek végén az Alkotmánybíróság hibát állapított meg a joggyakorlatban. Vagyis itt nem egy botrány kirobbantásáról van szó, hanem arról a lassú, láthatatlan munkáról, amiből ritkán lesz címlap.',
            ],
            sources: [
              { source: 'Szeretlek Magyarország', headline: 'A Vidéki prókátor egy dologra még a kegyelmi ügynél is büszkébb', url: 'https://www.szeretlekmagyarorszag.hu/' },
            ],
          },
          {
            title: '„A maffiafőnök be van tojva" — reakció az elszámoltatásra',
            when: '2026. szeptember 15.',
            body:
              'A rendszerváltást követő elszámoltatási hullám során kemény hangvételben reagált a volt miniszterelnök azon interjújára, amelyben az új Nemzeti Vagyonvisszaszerzési és Vagyonvédelmi Hivatalt támadta és ÁVH-t emlegetett. Szerinte a bukott rendszer politikusainak fenyegetőzése valójában a totális pánik jele, a jogállami elszámoltatást pedig már nem lehet megállítani.',
            sources: [
              { source: 'ATV', date: '2026. szept. 15.', headline: '„A maffiafőnök be van tojva” – Elszabadultak az indulatok az NVVH miatt', url: 'https://www.atv.hu/belfold/20260915/videki-prokator-fulop-botond-nvvh/' },
              { source: 'Szeretlek Magyarország', headline: 'Vidéki Prókátor: A bukott maffiafőnök be van tojva, ez jó jel', url: 'https://www.szeretlekmagyarorszag.hu/szempont/videki-prokator-a-bukott-maffiafonok-be-van-tojva/' },
              { source: 'Contextus', headline: 'Orbán Viktor ÁVH-t emleget, a Vidéki Prókátor szerint viszont félelem látszik az elszámoltatás elindulásakor', url: 'https://contextus.hu/videki-prokator-elszamoltatas-nvvh-orban-viktor/' },
            ],
          },
        ],
      },
      socialFeed: {
        heading: 'Mit ír most a Vidéki prókátor?',
        intro:
          'A legutóbbi nyilvános bejegyzései a Facebook-oldaláról. Nem a Meta beágyazójával jelenítjük meg — az minden látogatónknak nyomkövetést töltene be —, hanem saját kártyákon, a posztok saját képével. A szöveg a bejegyzés eleje, a teljes poszt a linken olvasható.',
        platformLabel: 'Facebook',
        pageName: 'Vidéki prókátor',
        profileUrl: 'https://www.facebook.com/profile.php?id=61556624432810',
        updatedAt: '2026-09-16',
        items: [
        { text: 'Úgy tűnik, hogy az elvileg független ügyészség számára a valódi függetlenség követelményének érvényesítése feszültséget okoz, mert egyesek olyannyira hozzászoktak a pórázhoz, hogy nem nagyon tudnak...',
        image: '/images/rendszervaltas/posts/vp-1.jpg',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid0cdDfQUxG8sjeu7z9fjbMxgbP1gk7a2CfN2Sd3PfByr1c6vpQtXkyaGoga9KDQcgql&id=61556624432810' },
        { text: 'Úgy tűnik, hogy a bukott maffiafőnök be van tojva. Ez jó jel. Remélem, meg is van rá minden oka. Hajrá NVVH! KATTANJON!',
        image: '/images/rendszervaltas/posts/vp-2.jpg',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid0erdhTsxJ6V2SvV6tH45rtzp2p8XLwqpyCeJugRyZawzmuhAioRGfq1gpoVUSa6Y3l&id=61556624432810' },
        { text: 'Orbán Viktor az ombudsmani jelentés ismeretében kitüntetésre javasolta a korábban már büntetőeljárás alá vont bicskei rémet, Novák Katalin pedig Balog Zoltán közbenjárására megkegyelmezett a...',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid0gUfS4NnFRMyS99HpGRuJSdTdvvkbcuo1J2cao7XeswwmBqWTLdXSJs1VisiREPpql&id=61556624432810' },
        { text: 'BALLA-LAJKA, AVAGY VIDÁM HÉTVÉGÉT! (Bevallom, én a rendszerváltásnak köszönhetően tudtam meg, hogy mi a neve ennek a már fene tudja mióta a Parlamentben üldögélő mameluknak, akit mindig ott lehetett...',
        image: '/images/rendszervaltas/posts/vp-4.jpg',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid0LBVDNarSgiwvz5xWdsK5PLASJ7duhJJSjfHKj9aKfXgsEQd9Rby1nfJ9fSuSCoE5l&id=61556624432810' },
        { text: '"Az igazán félelmetes ebben a történetben az, hogy az erőszakszervezetek politikai célú felhasználása olyan súlyos határvonal-átlépést jelent, mely joggal alakíthatja ki a szemlélőben azt a rémképet,...',
        image: '/images/rendszervaltas/posts/vp-5.jpg',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid0v3juw19zBQfeNtwC68EXxb2HvehcX3qrEtxEDcLYn7Qd4wwL6XaCsWgfmdwBBTGol&id=61556624432810' },
        { text: 'Jelzem az aranykonvoj-ügyön dolgozó ügyészeknek, hogy O. Viktor Mihály korábbi miniszterelnököt holnap Kötcsén megtalálhatják...',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid04nauZa96LW9skiEaE5h2y8RvXf34ADzEKLLAkAMAHshX2ARqKAkeLZ8B9fGng7eBl&id=61556624432810' },
        { text: 'Mindenkinek ajánlom megnézni és elolvasni. Orbán nem egy politikus volt, hanem egy maffiafőnök, a kormánya pedig egy bűnszervezet. Számunkra pedig mindebből egy tanulság és egy feladat adódik,...',
        image: '/images/rendszervaltas/posts/vp-7.jpg',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid0tEnm4Era21J11XfmZKbJDAXZ3Ho674r3Sp65WCsinJGVh6HFCdebt1hxfHLvYLkwl&id=61556624432810' },
        { text: 'Egy kis szórakoztató olvasmány így estére: Schmidt Mária Leslie Mándokinak köszönhetően megvilágosul, rájön arra, hogy az elvtelen s..ggnyalókat csak a pénz érdekli és leírja nekünk, hogy milyen...',
        image: '/images/rendszervaltas/posts/vp-8.jpg',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid02GgTvhqYMFcrYhdt4TMVwd7V3dZCbKLBrbih6c1d5YbYSeZxFWeFahxAYCqY71W67l&id=61556624432810' },
        { text: 'Arra gondoltam, hogy ha én lennék most a köztársasági elnök, akkor azzal az ügyésszel biztosan leülnék beszélgetni, aki annak idején Vásárhelyi Jánost Bicskén „elkapta”, mert akárki is az illető,...',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid028bWvwai6qUH4NE9dB83LRbKGTuL2na2E1bcQUNNMmRJ8he9B26GXUGfyYGQHHhg9l&id=61556624432810' },
        { text: 'Hogy is mondta a minap a bukott maffiafőnök, Vlagyimir Putyin és Alice Weidel alázatos szolgája? Ja, igen, megvan: "Kapaszkodjatok meg! Ez még csak a kezdet!" Úgy legyen! KATTANJON!',
        image: '/images/rendszervaltas/posts/vp-10.jpg',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid02Ew1U5ZPioJoJj4PG71MY9W5wDLH2LTDBRrMf8CcmfqrwCG9wcAHaGdYngW5noRctl&id=61556624432810' },
        { text: 'Na, Lánczi bohóc, eljött az elszámolás és a felelősségvállalás ideje. Jó nagy marha voltál, hogy a maffia érdekében hagytad magad rávenni erre a piszkos munkára! KATTANJON!',
        image: '/images/rendszervaltas/posts/vp-11.jpg',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid0iQpcmHFh1t9bmVrD7jDkGeDhJkojNoaVWC1gfzyU2UJxs3hmqsXXGpubm35Z8cGul&id=61556624432810' },
        { text: 'Eötvös Károly nyaralója Balatonszemesen, illetve, legalábbis az e telken álló ház volt a nyaralója 1908 és 1912 között. "A Balaton ábránd és költészet, történelem és hagyomány, édes-bús mesék...',
        image: '/images/rendszervaltas/posts/vp-12.jpg',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid02Z7S34KMkD1znW2EG67dh9M4xZDRdbPrWcxv7XUExXaLJqVj9bAg5SVhgoM4qznQFl&id=61556624432810' },
        { text: 'Szóval megérte... Csak azt nem értem, hogy miért a szakadék felé rohanó EU általuk nem kért valutájában és miért nem jó magyar forintban, vagy rubelben tartja a megtakarítását...Az az igazság,...',
        image: '/images/rendszervaltas/posts/vp-13.jpg',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid08VcwjrrS8ngSRnpQ3WqjTJorULBoaxZE2jtFuBUAVkq2iHr9QtadNA1ypNXhdBVul&id=61556624432810' },
        { text: 'A tegnapi német tartományi választás apropóján az alábbiakban újra közzéteszem két 2025 februári bejegyzésemet, mert úgy tűnik, hogy az azóta eltelt idő sajnos igazolta az azokban megfogalmazott...',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid02JAdaJWPRu3mcPaBzkRQssvKL3zrARyrPQCYBDNcmEdF87ZV1W4D7p33Kv9nLEZqRl&id=61556624432810' },
        { text: 'Azért, amit Pokol Béla ebben a bejegyzésében összehordott, bukás járna a jogi egyetemen. Az általa említett jogelvek - a nullum crimen sine lege és a nulla poena sine lege - ugyanis nem a büntető...',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid037JNvfgutr2CddCoGC9MBKXkrVFa62RCV5au4Kr4gfwnD4DroDYLbeXeRUEsgaoCMl&id=61556624432810' },
        { text: 'Ne féljetek! 2.0 A közpénzen túl is van élet!',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid02jzLdX8TmQ4wYbPQaCzPXKGwnsqjm1xLTrBDBLBckbV3HLyaXAvgzNQDzZ9tKqmx2l&id=61556624432810' },
        { text: 'Bizony. Ha komolyan fel kívánjuk tárni a korrupciós ügyekben folyó büntetőeljárások elhúzódásának okait, akkor szerencsénk van, mert ehhez most van két nagyon jól használható „vizsgálati tárgyunk”:...',
        image: '/images/rendszervaltas/posts/vp-17.jpg',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid0FLGi5x3syHMGUd31nR2Woq2tPqCqf3XJ1AHM3ZuEexbwqMXD7dccN8myFSvjZuMwl&id=61556624432810' },
        { text: 'Az évnek ebben a szakában a leghangulatosabb talán vidéki prókátornak lenni. Ülök az íróasztalomnál és a nyitott ablakon keresztül hallom, ahogy "zeng az erdő", bőgnek a szarvasok.',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid02Mo5aQHQEhuQfgdeSFZnztuLs3MTLn5nc9qpKs88uvRATHUEBWF3VKTjR8YrH6Weal&id=61556624432810' },
        { text: 'HOPPÁL PÉTER MEGINT ELSZABADULT Hoppál Péter, az Orbán-kormány egykori kulturális államtitkára és Komló korábbi országgyűlési képviselője ekként találta illendőnek köszönteni a 75 éves Komlót a...',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid02GfovQd1hgcw58RcDZWSk8vM4GkEgSq9sNroQuvCJo8ETYrcQcBfCRkfvwDxu38xrl&id=61556624432810' },
        { text: 'Az orbánista propagandisták mindig tiltakoztak, amikor azt mondták róluk, hogy közpénzből tartják el őket, meg a munkahelyeiket. Most bebizonyosodott az, amiben sokan eddig is biztosak voltunk, hogy...',
        image: '/images/rendszervaltas/posts/vp-20.jpg',
        url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid0n42xYUYvKZwWwzvFAZLRDS5JzSuAitaqfu3f84Pnr9QCRrtQ4aPpM2jAfVZScABNl&id=61556624432810' },
        ],
      },
      socialHighlights: {
        heading: 'Az a poszt, amivel az egész elkezdődött',
        intro:
          'Itt írja le a saját szavaival, hogyan és miért robbantotta ki a kegyelmi botrányt. A posztot szándékosan nem a Meta beágyazójával jelenítjük meg — az minden látogatónknak nyomkövetést töltene be —, hanem saját kártyán, a bejegyzés saját képével. A kép maga az a kúriai határozat, amelyből az egész kiindult.',
        platformLabel: 'Facebook',
        pageName: 'Vidéki prókátor',
        items: [
          {
            when: '2024',
            title: 'Hogyan és miért robbantotta ki a kegyelmi botrányt',
            quote:
              'Hogyan és miért robbantottam ki a kegyelmi botrányt? A közvéleményt és a politikai életet felforgató, a köztársasági elnök, a kormánypárt EP-listavezetőjének és a református egyház első emberének…',
            image: '/images/rendszervaltas/posts/videki-prokator-kegyelmi.jpg',
            imageAlt: 'A Vidéki prókátor Facebook-posztja a BH 2024.1.3. kúriai határozat képernyőképével',
            href: 'https://www.facebook.com/permalink.php?story_fbid=pfbid0256SLYmsRquJvYFSUUABysuzMwTCCbA9p8P7tB59SpAAxjgBsiYttJWYCqHyEg3yzl&id=61556624432810',
            body:
              'A poszt megjelenésekor még senki nem tudta, ki áll az oldal mögött. A képen az a bírósági határozat látszik, amelyet reggeli rutinból nyitott meg — és amelynél megállt.',
          },
        ],
      },
      table: {
        heading: 'Hol helyezkedik el a Dicsőségfalon?',
        intro:
          'A Kegyencjárat láncmunka-elmélete alapján a Vidéki Prókátor a tökéletes kapocs a feltáró és a terjesztő szerepkörök között. Érdemes összevetni a fal más szereplőivel, hogy látsszon, ki mit tett hozzá.',
        columns: ['Szereplő', 'Elsődleges funkció', 'Módszertan', 'Miért volt pótolhatatlan?'],
        rows: [
          [
            'Vidéki Prókátor',
            'Jogi adathalászat és politikai gyújtópont',
            'Hivatalos bírósági és kúriai határozattárak napi szintű, manuális átfésülése',
            'Ő találta meg a rendszer morális Achilles-sarkát, a kegyelmi döntést.',
          ],
          [
            'Hadházy Ákos',
            'Közbeszerzés-vadászat és terepbejárás',
            'Uniós pályázati adatbázisok és cégiratok tételes elemzése, helyszíni fotózás',
            'Éveken át dokumentálta a gazdasági háttérügyeket, fenntartva a korrupciós nyomást.',
          ],
          [
            'Vastagbőr',
            'Közéleti blogolás, napirenden tartás',
            'A sajtóban megjelent ügyek szatirikus, könnyen fogyasztható reciklálása',
            'Nem hagyta elfelejteni a botrányokat azután sem, hogy a hírciklus továbblépett.',
          ],
          [
            'Jólvanezígy',
            'Tömeges, vizuális magyarázat',
            'A közéleti abszurdumok pár másodperces, görgetés közben fogyasztható fordítása',
            'Elvitte az információt a hírportálokat egyáltalán nem olvasó generációkhoz.',
          ],
        ],
      },
      extra: [
        {
          heading: 'Ki rejtőzik a név mögött, és miért fedte fel magát?',
          paragraphs: [
            'A 2026. április 12-i rendszerváltás után az inkognitó fenntartása funkciótlanná vált. 2026. május 11-én a Vidéki Prókátor hivatalosan is felfedte kilétét: a profil mögött dr. Fülöp Botond komlói ügyvéd áll.',
            'Elmondta, hogy nagyon szerette az addigi nyugodt, vidéki ügyvédi életét, de a kezdetektől az volt a célja, hogy amint a politikai viszonyok normalizálódnak, a saját nevével vállalja a gondolatait. A bemutatkozás után személyesen találkozott Magyar Péter miniszterelnökkel is, aki úgy hivatkozott rá, mint az emberre, „aki nélkül valószínűleg nincs rendszerváltás". 2026. augusztus 20-án állami kitüntetést kapott a rendszerváltás elősegítéséért.',
          ],
        },
        {
          heading: 'Milyen vitái voltak a rendszerváltó erőkkel?',
          paragraphs: [
            'Fülöp Botond polgári autonómiáját jól mutatja, hogy az inkognitó eldobása után sem vált az új hatalom feltétlen kiszolgálójává. Amikor felmerült a teljes kegyelmi akta nyilvánosságra hozatala, szakmai alapon intett óvatosságra, figyelmeztetve a személyes adatok és a jogi eljárásrendek szigorú betartására.',
            'Nyíltan bírálta a kormányfő egyes külpolitikai és diplomáciai megnyilvánulásait is, kijelentve, hogy azok túlmutatnak a választóktól kapott közvetlen felhatalmazáson. Ugyanakkor a korábbi kormánypártoknak is keményen üzent: felszólította őket, hogy kérjenek bocsánatot az országtól a jogállam szétveréséért, megjegyezve, hogy „rá sem ismerni" a hirtelen a kulturált párbeszéd mellett érvelő ellenzéki Fideszre.',
          ],
        },
        {
          heading: 'Mit mondanak róla a kritikusok és a támogatók?',
          paragraphs: [
            'A támogatói szerint valódi civil hős, aki nem a saját politikai karrierjét építette, hanem állampolgári kötelességből, makacs és precíz szakmai munkával robbantotta fel a rendszert. Elvhűségét épp az bizonyítja, hogy az új kormánnyal is kész vitába szállni, ha a jogállami elveket veszélyben látja.',
            'A kritikusai szerint bizonyos kérdésekben túlságosan merev, elméleti jogászi szemléletet képvisel, amely nehezen veszi figyelembe a gyakorlati politikai realitásokat. Korábbi konzervatív múltja miatt a radikálisabb baloldali körök gyanakvással kezelik, míg a régi rendszer maradványai a mai napig támadják.',
            'Az írásaiból a Magyar Hang gondozásában könyv is megjelent „Én, a Vidéki prókátor — Gondolatok a polgári Magyarországért" címmel, amely rendszerváltástól rendszerváltásig mutatja be a szerző szellemi ívét.',
          ],
        },
      ],
      faq: [
        {
          q: 'Ki a Vidéki Prókátor?',
          a: 'dr. Fülöp Botond komlói ügyvéd. Éveken át anonim, kizárólag Facebookon publikáló közéleti és jogi elemzőként írt; a kilétét 2026. május 11-én fedte fel.',
        },
        {
          q: 'Hogyan robbantotta ki a kegyelmi botrányt?',
          a: '2024 februárjában a Kúria határozatait böngészve rábukkant arra a dokumentumra, amely szerint a köztársasági elnök kegyelmet adott a bicskei gyermekotthon volt igazgatóhelyettesének, akit kényszerítés miatt ítéltek el jogerősen. A dokumentumot és a jogi kontextust elküldte a független sajtónak, és a saját oldalán is közzétette az elemzést.',
        },
        {
          q: 'Mire a legbüszkébb?',
          a: 'Saját elmondása szerint nem a kegyelmi ügyre, hanem a megváltozott munkaképességű emberek juttatásaiért folytatott jogi harcára: az általa benyújtott alkotmányjogi panasz nyomán az Alkotmánybíróság hibát állapított meg a joggyakorlatban.',
        },
        {
          q: 'Miért fedte fel magát 2026 májusában?',
          a: 'A rendszerváltás után az inkognitó fenntartása funkciótlanná vált. A kezdetektől az volt a célja, hogy amint a politikai viszonyok normalizálódnak, a saját nevével vállalja a gondolatait.',
        },
        {
          q: 'Kritizálja az új kormányt is?',
          a: 'Igen. Óvatosságra intett a teljes kegyelmi akta nyilvánosságra hozatalánál, és bírálta a kormányfő egyes külpolitikai megnyilvánulásait is — miközben a korábbi kormánypártoktól bocsánatkérést követelt a jogállam szétveréséért.',
        },
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
