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
// bekezdésbe kerültek át, linkkel. A Dicsőségfalon maradó médiumok (Átlátszó,
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

/** A Dicsőségfal három blokkja (user kérés, 2026-09-16: a sorrend ne legyen random).
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
  /** Nézettség, saját kiemelt sorban a leírás alatt (pl. „1,1 millió
   *  megtekintés"). User kérés, 2026-09-24: ne a leírás végén, mondatba
   *  ágyazva — ez a videó legbeszédesebb adata. */
  views?: string;
  list?: string;
  /**
   * Apró lábjegyzet a videó alá, benne EGY külső hivatkozással.
   *
   * Azért van rá szükség, mert nem minden esetben a saját műhely felvétele a
   * beágyazható: ha az eredeti anyag olyan platformon van, amit az oldal
   * tartalombiztonsági szabálya (CSP, l. next.config.js frame-src) nem
   * engedélyez, akkor egy másik csatorna felvétele kerül be — és ilyenkor ki
   * kell írni, kié a felvétel, és el kell vezetni az eredetihez.
   */
  note?: { text: string; linkText: string; href: string };
  /**
   * Vimeo-videó a YouTube helyett. Az `id` ilyenkor is kötelező (a React-kulcs
   * miatt), de a lejátszó a `vimeoId`-t használja, a borítókép pedig a
   * `poster` — egy letöltött, saját kiszolgálású kép. L. a
   * PodcastVideoBoxControlled megjegyzését arról, miért nem lehet a Vimeo
   * borítóképét URL-ből kiszámolni.
   */
  vimeoId?: string;
  poster?: string;
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
  /**
   * Hogyan illeszkedjen a kép a négyzetes helyre.
   *
   * Alapból `cover`: a profilképek és portrék négyzetesek, azokat kitölti.
   * A LOGÓK viszont fekvők (az Átlátszóé 2.17-es arányú) vagy átlátszó
   * hátterűek — azokat `cover` levágná, átlátszóként pedig a kártya sötét
   * hátterén a fekete rajzolatú logók (Partizán, Szikra) eltűnnének. Ezeknél
   * `contain` + fehér alap: a logó egészben látszik.
   */
  photoFit?: 'contain';
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
  /**
   * Mikor változott utoljára ENNEK a profilnak a TARTALMA (ISO dátum).
   *
   * 2026-09-24, user: a lapokon hónapokig a hub egyetlen, kézzel írt dátuma
   * állt, miközben a tartalom közben változott. Innentől minden profil a
   * sajátját mutatja, a hub pedig a legfrissebbet az összes közül (l.
   * contentUpdatedAt()). Ha hiányzik, a hub dátumára esik vissza.
   *
   * SZABÁLY: ha egy profil szövegén, videóin vagy forrásain változtatsz,
   * ezt a mezőt is állítsd át ugyanabban a commitban.
   */
  updatedAt?: string;
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

/**
 * Egy fotó az ügy szövegében. A `src` MINDIG helyi (/images/... a public
 * alól): a forrásoldalak képeire sosem hotlinkelünk — átszerveznek, letiltják
 * a hotlinket, vagy egyszerűen eltűnik a fájl, és akkor a mi oldalunkon
 * marad a törött kép. A `credit` kötelező: idegen fotó forrásmegjelölés
 * nélkül nem jelenhet meg.
 */
export type FeltaroImage = {
  src: string;
  alt: string;
  credit: string;
  caption?: string;
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
    /** Fotó a szakasz szövege UTÁN, a források előtt. */
    image?: FeltaroImage;
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
  /** Hol jelenjen meg a `promo` doboz. Alapból az ügy VÉGÉN, a források után.
   *  `'top'` esetén rögtön az ELSŐ bekezdés után — user kérés, 2026-09-24:
   *  a hosszú NKA-szakasz aljára tett ajánlót az olvasók nagy része sosem
   *  éri el, pedig ott a teljes ügy adatlapja. */
  promoPlacement?: 'top';
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
  extra?: {
    heading: string;
    paragraphs: string[];
    links?: InlineLink[];
    /** Beágyazott videók a szakasz bekezdései után (pl. Momentum/NOlimpia).
     *  Akkor kell, amikor a videó egy adott szakaszhoz tartozik, és a lap
     *  alján lévő `videoBlock` kiszakítaná a helyéről. */
    videos?: FeltaroVideoRef[];
    sources?: FeltaroLink[];
  }[];
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
      /** A kártya CTA-ja. Alapból „Elolvasom a posztot" — videónál ez félrevezető
       *  (user, 2026-09-24), ezért felülírható: „Megnézem a videót". */
      ctaLabel?: string;
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
    'Egy korrupciós ügy feltárása soha nem egyetlen ember érdeme. Mire egy név eljut odáig, hogy kimondják a híradóban, addigra valaki átrágta magát több ezer oldalnyi közbeszerzési iraton, valaki más három évig pereskedett egy elutasított adatigénylésért, egy harmadik pedig érthető mondatokká fordította az egészet. Ez a Dicsőségfal nekik szól.',
    'A lenti névsor nem rangsor, és nem is teljes — folyamatosan bővül. Három blokkra bontottuk, mert háromféle munkáról van szó. A **személyek** a saját nevüket adták egy-egy ügyhöz, és évekig kitartottak mellette. A **médiumok és műhelyek** azt az infrastruktúrát tartják fenn — ügyvédeket, adatbázisokat, hónapokig fizetett újságírói munkaidőt —, ami nélkül egy mélyfúrás elindulni sem tudna. A **Facebook- és YouTube-csatornák** pedig azt csinálják, amit a legkönnyebb lebecsülni és a legnehezebb pótolni: elviszik a kész sztorit több százezer emberhez, olyanokhoz is, akik hírportált soha nem nyitnak meg.',
    'A Kegyencjárat adatbázisa ennek a munkának a másodlagos feldolgozása. Egyetlen ügyet sem mi tártunk fel: mi összegyűjtjük, rendszerezzük, összekötjük és követhetővé tesszük azt, amit ők kiástak. Ezért van ez az oldal — és ezért van forrásmegjelölés minden egyes sor mellett.',
  ],
  /** A nagy független szerkesztőségek elismerése. Külön mező, mert a
   *  szerkesztőségneveknek kattintható külső linknek kell lenniük, a
   *  gridIntro pedig sima szöveg. Fontos, hogy a szöveg kimondja, MIÉRT
   *  nincsenek a Dicsőségfalon — különben úgy néz ki, mintha lefelejtettük volna
   *  őket, miközben az adatbázisunk forráshivatkozásai tele vannak velük.
   *  A „nekik ez a dolguk is" megkülönböztetés a főállású, üzleti alapon
   *  működő szerkesztőségre vonatkozik — a Dicsőségfalon szereplő médiumok
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
      '. Pedig az ezen az oldalon szereplő ügyek jelentős része az ő oknyomozásaikból és interjúikból származik, és a forráshivatkozásaink tele vannak a nevükkel — nélkülük ez az adatbázis a töredéke lenne annak, ami. A kihagyás tehát nem értékítélet, hanem szűkítés: ez a Dicsőségfal tudatosan azokra koncentrál, akik elhivatottságból csinálták. A saját pénzükből, a szabadidejükben, munka mellett, vagy olvasói támogatásból fenntartott nonprofit műhelyekben.',
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
    photo: '/images/rendszervaltas/hadhazy-akos.webp',
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
            videos: [
              {
                id: 'AnJ-SfY8tjA',
                label: 'ATV Magyarország · 2025. augusztus 27.',
                title: 'Hatvanpuszta, ahogy ő mutatta meg',
                summary:
                  'A nyitva hagyott hátsó kapu, néhány perc a birtokon, majd a kertész. A felvétel maga a válasz arra a kérdésre, hogy befejezetlen gazdasági épületről van-e szó.',
              },
            ],
            highlight: {
              heading: 'Amikor felborult a biztonsági őr autója — 2025. augusztus 19.',
              body:
                'Úgy kezdődött, hogy Hadházy feltartóztatás nélkül besétált a hatvanpusztai birtokra — meg akart győződni róla, valóban műemlék áll-e ott —, de hamar kizavarták. Ezután vették üldözőbe. Éppen a birtok környéki nyilvános utakon autózott, amikor a birtok védelmét ellátó biztonsági szolgálat egyik terepjárós őre agresszívan üldözőbe vette a kocsiját, majd az üldözés során oldalról nekiütközött. Az ütközés erejétől a vagyonőr saját járműve elvesztette a stabilitását és felborult. Az esetet az anyósülésen utazó Gulyás Balázs, a Gulyáságyú Média újságírója az első másodperctől videóra vette — enélkül az ügy megmaradt volna a klasszikus „állítás állítással szemben" szintjén. A Bicskei Rendőrkapitányság közúti veszélyeztetés bűntettének alapos gyanúja miatt indított eljárást a sofőr ellen, akiről kiderült, hogy Mészáros Lőrinc biztonságtechnikai cégének alkalmazásában állt. A nyomozást 2025 novemberében megszüntették, arra hivatkozva, hogy az őr nem veszélyeztette a képviselő testi épségét; az ügyet átminősítették, és az őr végül szabálysértési eljárásban 80 ezer forint pénzbírságot és három hónap járművezetéstől eltiltást kapott.',
              video: {
                id: 'ahlzM1ub9IA',
                label: 'Kontroll • Gulyáságyú · 2025. augusztus 25.',
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
    id: 'partizan',
    name: 'Partizán',
    kind: 'org',
    group: 'media',
    // 2026-09-21, user kérés: Gulyás Márton önálló profilja lekerült a
    // Dicsőségfalról, a neve viszont itt, az alapított csatorna mellett
    // maradjon látható.
    role: 'közösségi finanszírozású videós műhely (Gulyás Márton)',
    badge: 'FÜGGETLEN CSATORNA',
    photo: '/images/rendszervaltas/partizan.webp',
    photoFit: 'contain',
    tagline:
      'Nézői támogatásból épült fel akkorára, hogy egy választási éjszakán nagyobb közönséget ért el, mint több országos televízió.',
    targetKeyword: { phrase: 'partizán', volume: 33100, kd: 45 },
    section: {
      heading: 'Partizán (Gulyás Márton) — a nézőkből felépített szerkesztőség',
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
              'A sztori nem itt kezdődött: Szabó Bence az első interjúját a Direkt36-nak adta, néhány nappal korábban. A Partizán szerepe az volt, hogy ezt a történetet élő adásban, nagy tömeg előtt is elmondhatóvá tette. Két különböző műhely, két különböző funkció — a Direkt36 profilja is megtalálható ezen a Dicsőségfalon.',
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
              eyebrow: 'A Dicsőségfalon · Direkt36',
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
            'Ez a Dicsőségfal azért létezik, hogy ez a viszony látható legyen. Egy adatbázis könnyen kelti azt a látszatot, mintha az adatok maguktól állnának össze. Nem így van: minden sor mögött ott van valaki, aki elment a helyszínre, leült egy kamera elé, vagy végigolvasott több ezer oldalt.',
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
    photo: '/images/rendszervaltas/atlatszo.webp',
    photoFit: 'contain',
    tagline:
      'Közérdekű adatigénylések százait nyújtotta be, és ha elutasították, bíróságra vitte — több ügyben ez volt az egyetlen út, ahogy az iratok kikerültek.',
    targetKeyword: { phrase: 'átlátszó.hu', volume: 4400, kd: 50 },
    live: true,
    related: [
      { label: 'Hatvanpuszta — a kiemelt ügy', href: '/ugyek/hatvanpuszta' },
      { label: 'Szijjártó adriai jachtozása', href: '/adatbazis/szijjarto-adriai-jacht' },
    ],
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
        heading: 'Amit kipereltek — és amit lefotóztak',
        intro:
          'Egy adatper évekig tart és pénzbe kerül. Cserébe viszont a végén kiadott dokumentum megtámadhatatlan: nem „állítás szemben állítással", hanem irat. Van azonban olyan összefüggés, amiről egyáltalán nem keletkezik irat — ott a kamera veszi át a bizonyítás munkáját. Az alábbi ügyek mindkét módszerre példák, időrendben, a 2018-as jachtos anyagtól a legfrissebbekig.',
        items: [
          {
            title: 'Felcsút Travel Club — a magánrepülő és a luxusjachtok',
            when: '2018. szeptember 24.',
            body:
              'Az Átlátszó legnagyobb visszhangot kiváltó munkája nem adatperből, hanem egy módszerváltásból született: ahelyett, hogy iratot kértek volna, követni kezdték a járműveket. Repülési transzponder- és tengeri AIS-adatbázisokból dolgoztak, a helyszínen pedig fotós és drón rögzítette, ki száll le a gépről és ki tartózkodik a fedélzeten.',
            more: [
              'A repülési és hajózási nyilvántartások összevetése, valamint a rijekai, spliti és malagai helyszíni fotózás adta a bizonyítékot. A szöveget Erdélyi Katalin írta, a fotókat és a videót Németh Dániel készítette, az adatvizualizációt Bátorfy Attila.',
            ],
            sections: [
              {
                heading: 'A bulgáriai focimeccs',
                paragraphs: [
                  'Az első eszköz egy repülőgép volt: az OE-LEM lajstromjelű, osztrák bejegyzésű Bombardier Global 6000, amelynek értékét az Átlátszó nagyjából 17 milliárd forintra tette. 2018. július 25-én a Videoton bulgáriai Bajnokok Ligája-selejtezőjére, a Ludogorec elleni meccsre vitte Orbán Viktort — a legközelebbi repülőtérre, Várnába —, és a 0:0-ra végződött találkozó után nem sokkal éjfél előtt tért vissza Ferihegyre a miniszterelnökkel a fedélzetén. Az Átlátszó a leszállásnál fotózta le, ahogy kiszáll a gépből.',
                  'A kormányzati kommunikáció ezután hetekig egymásnak ellentmondó magyarázatokat adott arra, hogyan utazhatott a miniszterelnök egy ilyen gépen, a sajtóiroda pedig a kérdésekre nem válaszolt. Ugyanezt a gépet később Mészáros Beatrix és Végh Gábor, a ZTE tulajdonosa is használta. Az Átlátszó a következő években is követte a gép mozgását — a 2019-es montenegrói meccsre és a 2022-es párizsi BL-döntő napjára is.',
                ],
                sources: [
                  {
                    source: 'Átlátszó',
                    date: '2019. szept. 6.',
                    headline: 'Orbán Viktor a montenegrói meccsre is az osztrák magánrepülővel mehetett',
                    url: 'https://atlatszo.hu/kozugy/2019/09/06/orban-viktor-a-montenegroi-meccsre-is-az-osztrak-maganrepulovel-mehetett/',
                  },
                  {
                    source: 'Átlátszó',
                    date: '2022. máj. 31.',
                    headline: 'Orbán Viktor miniszterelnök és a NER luxusrepülője is Párizsban járt a BL-döntő napján',
                    url: 'https://atlatszo.hu/kozugy/2022/05/31/orban-viktor-miniszterelnok-es-a-ner-luxusrepuloje-is-parizsban-jart-a-bl-donto-napjan/',
                  },
                ],
              },
              {
                heading: 'A Lady Mrd és a MÁV-vezérigazgató',
                paragraphs: [
                  'A másik eszköz egy hajó: a Lady Mrd, 42 méteres, máltai lajstromú Benetti, hozzávetőleg 7 milliárd forint értékben. 2018 augusztusában Homolya Róbert, Szíjj László és Kovács Ernő kormánybiztos volt a fedélzetén — a felvételeket drónnal és a partról készítették.',
                  'Az időzítés az, ami ezt a fotót többé teszi egy nyaralási képnél: Homolya Róbert 2017-ben lett közlekedéspolitikáért felelős államtitkár, és néhány nappal az adriai jachtozás után, 2018 augusztusának elején nevezték ki a MÁV vezérigazgatójává. Az összeférhetetlenség kérdésével évekkel később a svájci sajtó is foglalkozott, a Stadler magyarországi vonatbeszerzései kapcsán.',
                  'Az, hogy kié valójában a hajó, csak két évvel később derült ki: 2020 júliusában, egy uniós szabályváltozás nyomán vált nyilvánossá, hogy a Lady MRD-t és az Artemyt birtokló máltai offshore cég tényleges tulajdonosa Szíjj László — az a vállalkozó, aki a magyar útépítési közbeszerzések legnagyobb nyertese.',
                ],
                image: {
                  src: '/images/rendszervaltas/szijj-lady-mrd.webp',
                  alt: 'A Lady MRD luxusjacht az Adrián',
                  credit: 'Németh Dániel / Átlátszó',
                  caption: 'A Lady MRD — a hajó, amelynek tényleges tulajdonosáról csak 2020-ban derült ki, hogy Szíjj László.',
                },
                sources: [
                  {
                    source: 'Átlátszó',
                    date: '2020. júl. 10.',
                    headline:
                      'Szíjj László a Lady MRD és az Artemy jachtokat birtokló máltai offshore cég valódi tulajdonosa',
                    url: 'https://atlatszo.hu/kozpenz/2020/07/10/szijj-laszlo-a-lady-mrd-es-az-artemy-jachtokat-birtoklo-maltai-offshore-ceg-valodi-tulajdonosa/',
                    lead:
                      'Két évvel a fotók után jött meg a tulajdonosi lánc vége: egy uniós szabályváltozás miatt kellett nyilvánosságra hozni, ki a cég tényleges haszonhúzója.',
                  },
                  {
                    source: 'HVG',
                    date: '2023. ápr. 3.',
                    headline:
                      'Homolya Róbert útja Szíjj jachtjától a MÁV-on át a Stadlerig — egy svájci lap összeférhetetlenségről ír',
                    url: 'https://hvg.hu/360/20230403_lapszemle_Tages_Anzeiger_osszeferhetetlenseg_Homolya_Robert_Szijj_Laszlo_Lady_MRD_Stadler_Trains_Magyarorszag',
                  },
                ],
              },
              {
                heading: 'Szijjártó lebukása a Lady MRD-n',
                paragraphs: [
                  '2020. augusztus 16-án, miközben Szijjártó Péter külügyminiszter a fehéroroszországi válságról szóló diplomáciai munkájáról posztolt, az Átlátszó fotósa a horvátországi Biograd na Moru közelében, a Kornati-szigetek térségében fotózta le a családjával együtt a Lady MRD fedélzetén. A hajót ekkor már bizonyítottan Szíjj László máltai cége, az L&L Charter Ltd. üzemeltette.',
                  'Amikor a fotós közeledni kezdett, a jacht AIS-helyzetjelzője kikapcsolt. Pontosan ez a mozzanat mutatja meg, miért kellett egyáltalán a helyszíni fotózás: a nyilvános adatbázis kikapcsolható, a fénykép nem.',
                ],
                image: {
                  src: '/images/rendszervaltas/szijjarto-lady-mrd.webp',
                  alt: 'Szijjártó Péter külügyminiszter a Lady MRD luxusjacht fedélzetén, 2020. augusztus 16-án',
                  credit: 'Németh Dániel / Átlátszó',
                  caption: 'Szijjártó Péter a Lady MRD fedélzetén, miközben a közösségi oldalán a fehérorosz válságról szóló diplomáciai munkáról posztolt.',
                },
                sources: [
                {
                  source: 'Átlátszó',
                  date: '2020. aug. 18.',
                  headline:
                    'Szijjártó Péter külügyminiszter Szíjj László adriai luxusjachtján bekkeli ki a fehérorosz válságot',
                  url: 'https://atlatszo.hu/kozpenz/2020/08/18/szijjarto-peter-kulugyminiszter-szijj-laszlo-adriai-luxusjachtjan-bekkeli-ki-a-feherorosz-valsagot',
                  lead:
                    'Az eredeti feltárás Németh Dániel fotóival: hol, mikor, melyik hajón, és mit posztolt közben a miniszter.',
                },
                {
                  source: '444',
                  date: '2020. aug. 18.',
                  headline:
                    'Szijjártó lebukott: a Lady Mrd nevű NER-es luxusjachton nyaralt a családjával, közben olyan fotókat posztolt, mintha az irodájában dolgozna',
                  url: 'https://444.hu/2020/08/18/szijjarto-lebukott-a-lady-mrd-nevu-ner-es-luxusjachton-nyaralt-a-csaladjaval-kozben-olyan-fotokat-posztolt-mintha-az-irodajaban-dolgozna',
                  lead:
                    'Ahogy az ügy továbbfutott a napi sajtóban — ez a lépés az, amitől egy oknyomozásból országos téma lesz.',
                },
                ],
              },
              {
                heading: 'Miért több ez nyaralási pletykánál?',
                paragraphs: [
                  'A jelentősége nem a nyaralás. Az, hogy a közbeszerzési statisztika és a magánvagyon között addig csak feltételezett kapcsolat egyetlen fényképen láthatóvá vált: állami megbízásokból gazdagodó vállalkozók luxuseszközein utazik a döntéshozó, aki azokat a megbízásokat kiosztja.',
                  'Erről a kapcsolatról nem keletkezik irat. Nincs az a közérdekűadat-igénylés, amivel ki lehetne kérni, ki kivel nyaral — ezért kellett hozzá transzponder, hajókövetés, drón és egy fotós a parton.',
                ],
                image: {
                  src: '/images/rendszervaltas/felcsut-travel-club.webp',
                  alt: 'Az Átlátszó 2018-as összeállításának címlapképe a magánrepülőről és a luxusjachtról',
                  credit: 'Átlátszó',
                  caption: 'Az Átlátszó 2018-as összeállítása: repülő, jacht, nevek és dátumok egyetlen anyagban.',
                },
              },
            ],
            sources: [
              {
                source: 'Átlátszó',
                date: '2018. szept. 24.',
                headline:
                  'Orbán Viktor, a magánrepülőgép, a luxusjacht és a Mészáros-klán: tudjuk, hol nyaraltak idén nyáron',
                url: 'https://atlatszo.hu/kozpenz/2018/09/24/orban-viktor-a-maganrepulogep-a-luxusjacht-es-a-meszaros-klan-tudjuk-hol-nyaraltak-iden-nyaron/',
                lead:
                  'Az alapvetés: lajstromszámok, hajónevek, dátumok és fotók egyetlen anyagban. Innentől nem állítás volt, hanem dokumentáció.',
              },
            ],
            promo: {
              href: '/adatbazis/szijjarto-adriai-jacht',
              eyebrow: 'Az adatbázisban',
              title: 'Szijjártó adriai jachtozása',
              lead:
                'Az ügy strukturált adatlapja: szereplők, intézmények, kapcsolódó cikkek és az eljárás állása.',
              cta: 'Az adatlap megnyitása',
            },
          },
          {
            title: 'Hatvanpuszta a levegőből és az időben',
            when: '2025. augusztus – szeptember',
            body:
              'A portál drónfelvételekkel és archív műholdképekkel dokumentálta, hogyan alakult át a hatvanpusztai birtok az évek során, és megírta azt is, hogy a majorság generálkivitelezője Mészárosék családi cége volt. A módszer itt az összehasonlítás: nem egyetlen kép, hanem ugyanaz a helyszín öt és tíz évvel korábban.',
            sources: [
              { source: 'Átlátszó', date: '2025. szept. 12.', headline: 'Mészárosék közpénzbajnok családi cége a hatvanpusztai majorság generálkivitelezője', url: 'https://atlatszo.hu/kozpenz/2025/09/12/meszarosek-kozpenzbajnok-csaladi-cege-a-hatvanpusztai-majorsag-generalkivitelezoje/' },
              { source: 'Átlátszó', date: '2025. aug. 12.', headline: 'Miből lesz a cserebogár? Így festett a hatvanpusztai birtok öt és tíz évvel ezelőtt', url: 'https://atlatszo.hu/impakt/2025/08/12/mibol-lesz-a-cserebogar-igy-festett-a-hatvanpusztai-birtok-ot-es-tiz-evvel-ezelott/' },
            ],
            videos: [
              {
                id: 'vimeo-159180000',
                vimeoId: '159180000',
                poster: '/images/rendszervaltas/vimeo-159180000.webp',
                label: 'Átlátszó · 2016. március 16.',
                title: 'Mészárosék terjeszkednek a hatvanpusztai birtok körül',
                summary:
                  'Az Átlátszó saját drónfelvétele: plusz félezer hektár a birtok körül. Ugyanaz a módszer, amiről a bekezdés szól — nem egyetlen kép, hanem a helyszín összehasonlítása.',
              },
            ],
            promo: {
              href: '/ugyek/hatvanpuszta',
              eyebrow: 'Kiemelt ügy · Hatvanpuszta',
              title: 'Mennyit ér valójában a hatvanpusztai birtok?',
              lead:
                'Becsült ingatlanérték, ismeretlen vagyonforrás, vagyonnyilatkozat — az ügy teljes feldolgozása a saját oldalán.',
              cta: 'Az ügy megnyitása',
            },
          },
          {
            title: 'Átlátszó Országszerte — az 500 milliós körforgalom a mező közepén',
            when: '2025. október 18.',
            body:
              'A műhely vidéki hálózata azt csinálja, amit országos szerkesztőség ritkán tud: helyben megy utána egy-egy beruházásnak. A zalaegerszegi példa ennek a legkönnyebben érthető darabja — egy körforgalom a mező közepén, amely nem köt össze semmit semmivel, mellette a projekttáblával, hogy bő 500 millió forint uniós támogatásból épült.',
            more: [
              'Az ilyen ügyek azért fontosak, mert nem kell hozzájuk offshore cégláncot kibogozni. Egy hatperces videó és egy projekttábla elvégzi a munkát — és pontosan ez az a réteg, ahol a közpénzről szóló beszéd kilép a szakértői körből.',
            ],
            videos: [
              {
                id: 'hSB3hp51rDw',
                label: 'Átlátszó · 2025. október 18.',
                title: 'Sehonnan sehová vezető körforgalom a mezőn 500 millió forintnyi EU-s pénzből',
                summary:
                  'A Zalaegerszeg és Zalaszentiván közötti beruházás története, négy évre visszamenőleg.',
              },
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
            title: 'Tizenöt év Mészáros Lőrincről — a drónfelvételektől a Strómanig',
            when: '2026. március (a dokumentálás 2012 óta)',
            body:
              'Az Átlátszó archívumában 2012 és 2026 között 455 olyan cikk van, amelynek a CÍMÉBEN szerepel Mészáros Lőrinc neve. Ez a szám önmagában elmond valamit a műhely működéséről: nem egyetlen leleplezés, hanem tizennégy éven át tartó, folyamatos dokumentálás.',
            more: [
              'A sorozat leglátványosabb darabja a 2018-as drónriport volt, amelyben körbejárták az országot, és sorra vették a felcsúti vállalkozó portfólióját — szállodákat, földeket, ipari ingatlanokat. A videó azért működött, mert nem számokat mutatott, hanem méretet: egy hektárokban mérhető birtokot nem lehet „félreértett közbeszerzési eljárásnak" nevezni.',
              'Ugyanennek a tizennégy évnyi anyagnak az összefoglalása lett a Stróman – A hatalom álarca című, egyórás film 2026 márciusában. Ez ma a csatornájuk legnézettebb anyaga, több mint 840 ezer megtekintéssel — az Átlátszó volt és jelenlegi újságírói, szakértők, valamint archív felvételeken maga Mészáros Lőrinc szólal meg benne.',
            ],
            videos: [
              {
                id: 'OYihmhNDjOA',
                label: 'Átlátszó · 2026. március 13.',
                title: 'Stróman – A hatalom álarca',
                summary:
                  'Egyórás film Mészáros Lőrinc 2012 óta tartó felemelkedéséről, az Átlátszó tizennégy évnyi saját anyagából összerakva. A csatornájuk legnézettebb videója.',
              },
              {
                id: '8vvuI7GgxxY',
                label: 'Átlátszó · 2018. július 23.',
                title: 'Lenyűgöző drónfelvételek a Mészáros-birodalom legértékesebb szerzeményeiről',
                summary:
                  'A drónos módszer mintadarabja: körbejárták az országot, hogy a közpénzmilliárdokból összeszedett portfólió mérete ne adat legyen, hanem látvány.',
              },
            ],
          },
          {
            title: 'Szuverenitásvédelmi Hivatal — az a per, amit a hivatal nem fogadott el',
            when: '2026. március – május',
            body:
              'Az Átlátszó pert nyert a Szuverenitásvédelmi Hivatallal szemben, mire a hivatal fellebbezett — az érvelésük szerint a bíróságnak nincs hatásköre felettük. Másodfokon végül az eljárás megismétlését rendelték el. Ez a fajta elhúzódás önmagában is része a módszertannak: sokszor nem a per elvesztése a cél, hanem az idő.',
            sources: [
              { source: 'Átlátszó', date: '2026. márc. 19.', headline: 'Láncziék fellebbeztek az elmarasztaló ítélet ellen, szerintük a bíróságnak nincs hatalma felettük', url: 'https://atlatszo.hu/kozugy/2026/03/19/lancziek-fellebbeztek-az-elmarasztalo-itelet-ellen-szerintuk-a-birosagnak-nincs-hatalma-felettuk/' },
              { source: 'HVG', date: '2026. máj. 28.', headline: 'Csatát nyert a Szuverenitásvédelmi Hivatal, meg kell ismételni az eljárást az Átlátszó-perben', url: 'https://hvg.hu/itthon/20260528_szuverenitasvedelmi-hivatal-atlatszo-birosag-masodfoku-dontes-b' },
            ],
          },
          {
            title: 'A gödi Samsung-gyár bírságai',
            when: '2026. május',
            body:
              'Jogerősen megnyerték a pert a gödi akkumulátorgyárra kiszabott hatósági bírságok adatainak kiadásáért. Egy ilyen ügyben az összeg és a jogcím önmagában is válasz arra a kérdésre, amit a hivatalos kommunikáció évekig kerülgetett.',
            sources: [
              { source: 'Hírextra', date: '2026. máj. 27.', headline: 'Jogerősen pert nyert az Átlátszó a gödi Samsung-gyár bírságai ügyében - Hírextra', url: 'https://www.hirextra.hu/2026/05/27/jogerosen-pert-nyert-az-atlatszo-a-godi-samsung-gyar-birsagai-ugyeben/', lead: 'Másodfokon is az Átlátszónak adott igazat a bíróság a Pest Vármegyei Kormányhivatallal szemben indított perben. A döntés értelmében a hivatalnak ki kell adnia a gödi Samsung-gyárra kiszabott munkavédelmi, tűzvédelmi és egyéb bírságokról szóló határozatokat.' },
            ],
          },
        ],
      },
      extra: [
        {
          heading: 'Kettős szerep: adatper és kamera',
          paragraphs: [
            'Az Átlátszó két, egymástól nagyon különböző képességet tart fenn egyszerre. Az egyik jogi: adatigénylés, elutasítás, per, évekig tartó eljárás, a végén egy dokumentum, amit nem lehet letagadni. A másik vizuális: drón, helyszíni fotózás, repülési és hajózási nyilvántartások figyelése — olyan bizonyíték, amihez nem kell bírósági ítéletet megvárni.',
            'A kettő ugyanazt a hiányt tölti be, csak más oldalról. Az adatper akkor működik, ha van irat, amit el lehet zárni. A kamera akkor, amikor irat nincs is — egy nyaralásról nem készül közbeszerzési dokumentáció. A magyar oknyomozásban rajtuk kívül kevesen tartják fenn mindkettőt.',
          ],
        },
        {
          heading: 'Mit mondanak róluk a támogatóik és a kritikusaik?',
          paragraphs: [
            'A támogatóik szerint az Átlátszó nélkül a NER gazdasági hátországának jelentős része üzleti titok mögött maradt volna: a megnyert adatperek olyan szerződéseket hoztak nyilvánosságra, amelyekre más szerkesztőségnek nem volt jogi kapacitása, a drón- és hajókövetéses anyagok pedig olyan összefüggéseket tettek láthatóvá, amelyeket dokumentumból nem lehetett volna kimutatni.',
            'A kritikusaik — elsősorban a korábbi kormányoldal médiuma és a Szuverenitásvédelmi Hivatal — külföldről finanszírozott szervezetként írták le őket, és azt állították, hogy az adatigénylések és a megfigyelések valójában gazdasági beruházások ellehetetlenítését szolgálják. Az Átlátszó a finanszírozását nyilvánosan közli, és a hivatallal szemben bíróságon is nyert — igaz, az ítéletet a hivatal megtámadta, és az eljárást meg kellett ismételni.',
            'Maga a hivatal azóta nincs. Az Országgyűlés 2026. június 30-án, a Tisza Párt képviselőjének javaslatára 135 igen, 44 nem és 6 tartózkodás mellett megszavazta a Szuverenitásvédelmi Hivatal megszüntetését; az indoklás szerint a hivatal nem látott el tényleges közfeladatot. A megszűnését a megszűnt-e már oldalunkon is követjük.',
          ],
          links: [{ text: 'a megszűnt-e már oldalunkon', href: '/megszunt' }],
          sources: [
            {
              source: 'Telex',
              date: '2026. jún. 30.',
              headline: 'Megszavazták a Szuverenitásvédelmi Hivatal megszüntetését',
              url: 'https://telex.hu/belfold/2026/06/30/parlament-szavazas-szuverenitasvedelmi-hivatal-megszuntetes',
              lead:
                'A hivatal, amely az Átlátszót külföldről finanszírozott szervezetként írta le, 2026. június 30-án megszűnt. A szavazás eredménye és az indoklás.',
            },
            {
              source: '444',
              date: '2026. jún. 30.',
              headline: 'Az Országgyűlés megszavazta a Szuverenitásvédelmi Hivatal megszüntetését',
              url: 'https://444.hu/2026/06/30/az-orszaggyules-megszavazta-a-szuverenitasvedelmi-hivatal-megszunteteset',
            },
          ],
        },
        {
          heading: 'Az infrastruktúra, amit másoknak is építettek',
          paragraphs: [
            'Az Átlátszó nemcsak cikkeket írt, hanem eszközöket is létrehozott: drónos felvételi kapacitást, adatvizualizációkat, és nyilvános adatbázisokat, amelyeket más szerkesztőségek is használhattak. Üzemeltetik azt a felületet is, amelyen keresztül bárki benyújthat és nyomon követhet közérdekűadat-igénylést.',
            'Ez a Dicsőségfal legfontosabb tanulsága kicsiben: a feltárás nem sztorikból áll, hanem képességekből. Aki egy képességet felépít, az nemcsak a saját cikkeit teszi lehetővé, hanem mindenki másét is.',
          ],
        },
      ],
      table: {
        heading: 'Hol a helye a rendszerváltó ökoszisztémában?',
        intro:
          'A Dicsőségfalon három, egymást nem helyettesítő munkatípus szerepel. Az alábbi összevetés azt mutatja, mivel foglalkozik az Átlátszó, és mivel nem.',
        columns: ['Szereplő', 'Elsődleges terep', 'Módszertan', 'Mit ad a láncnak'],
        rows: [
          [
            'Átlátszó',
            'Hazai közpénz, önkormányzati szerződések, környezetvédelem',
            'Közérdekűadat-igénylés és per, drón, repülési és hajózási nyilvántartások',
            'Az alapdokumentumot és a vizuális bizonyítékot',
          ],
          [
            'Direkt36',
            'Nemzetbiztonság, külpolitika, titkosszolgálatok',
            'Hónapokig tartó forrásépítés, nemzetközi együttműködés',
            'Azt, amiről nem keletkezik kikérhető irat',
          ],
          [
            'Juhász Péter, Partizán',
            'Nagy elérésű nyilvánosság',
            'Videós feldolgozás, hosszú interjú',
            'Azt, hogy a kiásott ügy eljusson százezrekhez',
          ],
        ],
        note: 'A sorrend nem rangsor: feltárás és terjesztés egymás nélkül egyaránt hatástalan.',
      },
      faq: [
        {
          q: 'Mivel foglalkozik az Átlátszó?',
          a: 'Oknyomozó újságírással, adatújságírással és közérdekűadat-igénylésekkel. 2011 óta működik, közadakozásból és pályázatokból, nonprofit formában.',
        },
        {
          q: 'Mi az a Stróman, és miért az a legnézettebb videójuk?',
          a: 'Egy egyórás film 2026 márciusából, amely Mészáros Lőrinc 2012 óta tartó felemelkedését foglalja össze az Átlátszó tizennégy évnyi saját anyagából. Több mint 840 ezer megtekintésnél tart. Az archívumukban 2012 és 2026 között 455 olyan cikk van, amelynek a címében szerepel Mészáros Lőrinc neve — a film ezt sűríti egy órába.',
        },
        {
          q: 'Ki fotózta le Szijjártó Pétert a luxusjachton?',
          a: 'Németh Dániel, az Átlátszó fotósa, 2020. augusztus 16-án, a horvátországi Biograd na Moru közelében. A hajó a Lady MRD volt, amelyet Szíjj László máltai offshore cége üzemeltet. A jacht AIS-helyzetjelzője kikapcsolt, amikor a fotós közeledni kezdett.',
        },
        {
          q: 'Mi az az OE-LEM?',
          a: 'Egy osztrák lajstromjelű Bombardier Global 6000 magánrepülőgép lajstromszáma, amelynek mozgását az Átlátszó éveken át követte nyilvános repülési adatbázisokból. A 2018-as anyaguk szerint ezzel a géppel érkezett haza Orbán Viktor 2018. július 25-én egy bulgáriai focimeccsről.',
        },
        {
          q: 'Mi az a közérdekűadat-igénylés?',
          a: 'Olyan kérelem, amellyel bárki kikérheti egy állami vagy önkormányzati szerv kezelésében lévő, közérdekű adatot. Ha a szerv megtagadja, az igénylő bírósághoz fordulhat — az Átlátszó módszertanának ez a második fele.',
        },
      ],
      sources: [
        {
          source: 'Átlátszó',
          date: '2018. szept. 24.',
          headline:
            'Orbán Viktor, a magánrepülőgép, a luxusjacht és a Mészáros-klán: tudjuk, hol nyaraltak idén nyáron',
          url: 'https://atlatszo.hu/kozpenz/2018/09/24/orban-viktor-a-maganrepulogep-a-luxusjacht-es-a-meszaros-klan-tudjuk-hol-nyaraltak-iden-nyaron/',
        },
        {
          source: 'Átlátszó',
          date: '2020. aug. 18.',
          headline:
            'Szijjártó Péter külügyminiszter Szíjj László adriai luxusjachtján bekkeli ki a fehérorosz válságot',
          url: 'https://atlatszo.hu/kozpenz/2020/08/18/szijjarto-peter-kulugyminiszter-szijj-laszlo-adriai-luxusjachtjan-bekkeli-ki-a-feherorosz-valsagot',
        },
        {
          source: '444',
          date: '2020. aug. 18.',
          headline:
            'Szijjártó lebukott: a Lady Mrd nevű NER-es luxusjachton nyaralt a családjával',
          url: 'https://444.hu/2020/08/18/szijjarto-lebukott-a-lady-mrd-nevu-ner-es-luxusjachton-nyaralt-a-csaladjaval-kozben-olyan-fotokat-posztolt-mintha-az-irodajaban-dolgozna',
        },
        {
          source: 'Átlátszó',
          date: '2025. okt. 18.',
          headline: 'Sehonnan sehová vezető körforgalom a mezőn 500 millió forintnyi EU-s pénzből',
          url: 'https://atlatszo.hu/orszagszerte/2025/10/18/sehonnan-sehova-vezeto-korforgalom-a-mezon-500-millio-forintnyi-eu-s-penzbol',
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
    photo: '/images/rendszervaltas/k-monitor.webp',
    photoFit: 'contain',
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
    photo: '/images/rendszervaltas/direkt36.webp',
    photoFit: 'contain',
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
              eyebrow: 'A Dicsőségfalon · Partizán',
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
    role: 'országgyűlési képviselő, a Mérce alapító-főszerkesztője',
    badge: 'LAKHATÁSI ÉS SZOCIÁLIS JOGVÉDŐ',
    photo: '/images/rendszervaltas/jambor-andras.webp',
    tagline:
      'Újságíróból lett képviselő úgy, hogy közben nem hagyta abba a terepmunkát — a lakhatást és a végrehajtásokat ő emelte vissza a közbeszédbe.',
    targetKeyword: { phrase: 'jámbor andrás', volume: 6600, kd: 41 },
    section: {
      heading: 'Jámbor András — a lakhatás és a szegénység napirenden tartása',
      paragraphs: [
        'Jámbor András a Mérce alapítójaként és 2019-ig főszerkesztőjeként kezdte, majd 2021-ben megnyerte az ellenzéki előválasztást Budapest 6. számú választókerületében, és 2022-ben független képviselőként bejutott az Országgyűlésbe. Az útja azért érdekes, mert nem szakított a korábbi munkájával: képviselőként is ugyanazokkal a témákkal foglalkozott, amelyekről addig írt.',
        'A közpénzügyekhez egy sajátos irányból közelít: nem a nagy beruházások összegeit nézi, hanem azt, hogy közben mi maradt ki a költségvetésből — lakhatás, szociális ellátás, rezsi, munkaügyi jogok. Ez tette láthatóvá azt az összefüggést, ami a puszta botránylistákból nem derül ki: a kiosztott közpénznek mindig van másik oldala.',
        'A Szikra Mozgalom egyik meghatározó arcaként emellett kampányokat szervezett konkrét, helyi ügyekben, a Fudan-beruházás elleni tömegtüntetéstől a józsefvárosi kilakoltatások megakadályozásáig.',
      ],
    },
    related: [
      { label: 'Kiemelt ügyek', href: '/ugyek' },
      { label: 'Kapcsolódó ügyek az adatbázisban', href: '/adatbazis' },
    ],
    live: true,
    detail: {
      seoTitle: 'Jámbor András: a Mércétől a végrehajtási törvényig',
      seoDescription:
        'Mit csinált Jámbor András? A Mérce megalapítása, a Fudan elleni tüntetés, a végrehajtások és kilakoltatások elleni fellépés, a Diószegi utcai lakók ügye — forrásokkal.',
      lead:
        'Jámbor András helye a Dicsőségfalon nem azért védhető, mert kormánykritikus politikus, és nem is azért, mert minden állításával vagy szervezeti döntésével egyet kellene érteni. A helye azért indokolható, mert több mint másfél évtizeden át ugyanazon a három területen dolgozott következetesen: a független nyilvánosság építésén, a lakhatási és szociális jogvédelem megszervezésén, és azon, hogy ezek az ügyek az utcáról bekerüljenek az intézményes politikába.',
      cases: {
        heading: 'A legfontosabb állomások és ügyek',
        intro:
          'Ez más típusú teljesítmény, mint Panyi Szabolcs oknyomozó újságírása vagy Hadházy Ákos közpénzellenőrző munkája. Jámbor fő fegyvere nem a dokumentumokból kibontott korrupciós hálózat, hanem a közösségszervezés: embereket kapcsolt össze, ügyeket tett láthatóvá, és a politikai képviseletet megpróbálta visszakötni azokhoz, akikről a hatalom rendszeresen beszél, de akiket ritkán kérdez meg.',
        items: [
          {
            title: 'A Mérce — független nyilvánosság a pártokon kívül',
            when: '2008–2019',
            body:
              'Jámbor első maradandó közéleti teljesítménye nem egy parlamenti felszólalás, hanem egy intézmény létrehozása. A 2008-ban indult Kettős Mérce blogból nőtt ki a Mérce, amely 2017. október 22-én indult el önálló hírportálként, több mint háromezer ember közösségi finanszírozásából. Jámbor volt a fő kezdeményezője, és 2019-ig a főszerkesztője.',
            more: [
              'A lap nem a politikai elit napi konfliktusait tekintette a közélet egyetlen tárgyának, hanem azt mutatta meg, hogyan hatnak a döntések a bérből élőkre, a bérlőkre, a végrehajtás alatt álló családokra, a hajléktalan emberekre és a közszolgáltatások dolgozóira. Olyan témákat emelt be az országos vitába, amelyek korábban civil csoportok, helyi aktivisták vagy szűk szakmai közösségek ügyei voltak.',
              'Ez a Dicsőségfal szempontjából azért fontos, mert a NER nem kizárólag a korrupciós ügyek eltitkolásával működik. A rendszer része az is, hogy milyen témák jutnak el a nyilvánosságba, milyen nyelven beszélünk a szegénységről, és kiket tekintünk egyáltalán politikai szereplőnek. A Mércével Jámbor ahhoz járult hozzá, hogy a lakhatási válság, a kilakoltatás vagy a munkajog ne csak civil ügyként, hanem hatalmi kérdésként jelenjen meg.',
            ],
            sources: [
              {
                source: 'Mérce',
                date: '2021. márc. 13.',
                headline: 'Jámbor András, a Mérce alapítója is elindul az előválasztáson',
                url: 'https://merce.hu/2021/03/13/jambor-andras-a-merce-alapitoja-is-elindul-az-elovalasztason/',
                lead:
                  'A szerkesztőség saját közleménye arról, hogy az alapítójuk politikai pályára lép — és arról, mióta nem vesz részt a lap munkájában.',
              },
              {
                source: '444',
                date: '2021. márc. 13.',
                headline: 'Jámbor András, a Mérce volt főszerkesztője is elindul az előválasztáson',
                url: 'https://444.hu/2021/03/13/jambor-andras-a-merce-volt-foszerkesztoje-is-elindul-az-elovalasztason',
                lead:
                  'A pályaváltás külső összefoglalója: mit csinált addig, és milyen témákkal indul neki az előválasztásnak.',
              },
            ],
          },
          {
            title: 'Fudan és Diákváros — amikor egy beruházás politikai szimbólummá válik',
            when: '2021–2024',
            body:
              'A Szikra Mozgalommal közösen szervezett tüntetéssorozat a kínai Fudan Egyetem budapesti campusának terve ellen irányult. A 2021. június 5-i demonstráció a járványszabályok miatt formálisan tizenhat külön bejelentett tüntetésre bontva zajlott — így kerülte meg a szervező csapat az ötszáz fős létszámkorlátot —, és a Kossuth teret megtöltő tömeget vonzott.',
            more: [
              'A tüntetés nem egyszerűen egy kínai egyetemről szólt. A szervezők a beruházást az állami eladósodás, a közpénzfelhasználás és a budapesti fiatalok lakhatási lehetőségeinek kérdésével kötötték össze: ugyanazon a ferencvárosi területen, ahol a kormány korábban kollégiumi férőhelyeket ígért, egy drága, részben hitelből finanszírozott külföldi egyetemi beruházás kapott volna elsőbbséget. Az állítás ezért nem puszta tiltakozás volt, hanem alternatíva: Fudan helyett Diákváros, presztízsberuházás helyett megfizethető lakhatás.',
              '2024 novemberében a kormány a Kormányinfón jelentette be, hogy a Fudan-campus helyett mégis a Diákváros épülhet meg, decemberben pedig ezt írásban is rögzítette. Nem lenne korrekt azt állítani, hogy ezt egyetlen politikus vagy egyetlen tüntetés kényszerítette ki: szerepe volt a fővárosi és a kerületi önkormányzat kiállásának, a politikai környezetnek és a lakhatási válság súlyosbodásának is. Jámbor szerepe azonban dokumentálható — a témát évekig napirenden tartotta, tömegtüntetést szervezett, és a beruházásról szóló vitát összekötötte a lakhatás mindennapi kérdésével.',
              'A Dicsőségfalon ez nem egy projekt megnyeréseként jelenik meg, hanem példaként arra, hogyan lehet egy kormányzati beruházást társadalmi üggyé alakítani. A politikai nyomásgyakorlásnak ugyanis gyakran nem az azonnali győzelem a mércéje, hanem az, hogy a hatalom kénytelen legyen megváltoztatni a saját eredeti nyelvét és célját.',
            ],
            sources: [
              {
                source: 'Telex',
                date: '2021. máj. 23.',
                headline: 'A Fudan Egyetem ellen tüntetnek június 5-én a Hősök terén',
                url: 'https://telex.hu/belfold/2021/05/23/junius-5-tuntetes-hosok-tere-jambor-andras-fudan-egyetem',
                lead:
                  'A tüntetés meghirdetése: ki szervezi, mi a követelés, és miért a Diákváros a tét a szervezők szerint.',
              },
              {
                source: 'Átlátszó',
                date: '2021. jún. 5.',
                headline: 'Trükkös tüntetés a Diákvárosért és a Fudan Egyetem ellen',
                url: 'https://atlatszo.hu/oktatas/2021/06/05/trukkos-tuntetes-a-diakvarosert-es-a-fudan-egyetem-ellen/',
                lead:
                  'Helyszíni beszámoló arról, hogyan bontották tizenhat külön bejelentett tüntetésre a demonstrációt, hogy a járványkorlátozás ne lehetetlenítse el.',
              },
              {
                source: 'Eduline',
                date: '2024. nov. 14.',
                headline: 'Kormányinfó: a Fudan Egyetem helyén tervezik felépíteni a budapesti diákvárost',
                url: 'https://eduline.hu/felsooktatas/20241114_diakvaros-Fudan-Egyetem-kormanyinfo-felsooktatas-kollegium',
                lead:
                  'A kormányzati irányváltás bejelentése: a Fudan-projekt évek óta áll, a területen kollégiumi és bérlakás-fejlesztés jöhet helyette.',
              },
              {
                source: 'HVG',
                date: '2024. dec. 11.',
                headline: 'Most írásba adta a kormány, hogy nem lesz Fudan-campus, de megépül a korábban elkaszált Diákváros',
                url: 'https://hvg.hu/itthon/20241211_Fudan-campus-beszamolo-visszater-a-maga-altal-erobol-elkaszalt-eredeti-tervhez-a-Diakvaroshoz-ebx',
                lead:
                  'A szóbeli bejelentés után a dokumentum is megszületett — a kormány visszatért ahhoz a tervhez, amelyet korábban maga söpört le.',
              },
            ],
          },
          {
            title: 'Végrehajtások és kilakoltatások — a lakhatási jogvédelem',
            when: '2018–2025',
            body:
              'Jámbor egyik legfontosabb megkülönböztető jegye, hogy a lakhatási ügyeket nem kizárólag parlamenti felszólalásokban kezelte. Civil szervezetekkel és a Szikra aktivistáival éveken át részt vett kilakoltatások megakadályozásában és lakhatási válsággal küzdő háztartások támogatásában. Ez a munka ritkán látványos: egy végrehajtási ügyben nem egyetlen nagy politikai döntés a tét, hanem az, hogy egy család elveszíti-e az otthonát, és marad-e pénze élelmiszerre.',
            sections: [
              {
                heading: '670 ezer végrehajtás — egy adatigénylésből',
                paragraphs: [
                  'A végrehajtási rendszer működése több százezer embert érint, miközben a közbeszédben az érintettek jellemzően adósként, mulasztóként vagy problémás családként jelennek meg. Jámbor ezt a keretet fordította meg: olyan állami rendszerként beszélt a végrehajtásról, amelyben az adósság rendezése mellett a megélhetés védelmét is biztosítani kell.',
                  'A számokat nem becslésből vette. Közérdekű adatigényléssel kérte ki a folyamatban lévő eljárások számát, és 2024 októberében ebből derült ki, hogy egy év alatt 490 ezerről 670 ezerre — több mint a harmadával — nőtt a végrehajtás alatt álló emberek száma.',
                ],
                sources: [
                  {
                    source: 'Telex',
                    date: '2024. okt. 6.',
                    headline: 'Egy év alatt több mint a harmadával nőtt a végrehajtások száma',
                    url: 'https://telex.hu/belfold/2024/10/06/vegrehajtasok-novekedes-adatigenyles-jambor-andras',
                    lead:
                      'Az adatigénylés eredménye és a mögötte lévő módszer: honnan származik a 670 ezres szám, és mihez képest ugrott meg.',
                  },
                  {
                    source: '444',
                    date: '2024. okt. 6.',
                    headline: 'Már 670 ezer végrehajtás folyik az országban, egy év alatt harmadával nőtt a számuk',
                    url: 'https://444.hu/2024/10/06/mar-670-ezer-vegrehajtas-folyik-az-orszagban-egy-ev-alatt-harmadaval-nott-a-szamuk',
                    lead:
                      'Ugyanaz az adatsor, kontextussal: mekkora az érintett kör, és mit jelent ez egy háztartás mindennapjaiban.',
                  },
                  {
                    source: 'Magyar Hang',
                    headline: 'Jámbor András: Összesen 670 ezer ember ellen folyik ma végrehajtás Magyarországon',
                    url: 'https://hang.hu/belfold/jambor-andras-osszesen-670-ezer-ember-ellen-folyik-ma-vegrehajtas-magyarorszagon-168266',
                    lead:
                      'A képviselő saját értelmezése a számokról — és arról, hogy szerinte kinek az érdeke a mai végrehajtási rendszer.',
                  },
                ],
              },
              {
                heading: 'A védett jövedelem — tizenháromszor benyújtva',
                paragraphs: [
                  'A konkrét jogalkotási követelése az volt, hogy emeljék meg a végrehajtás alól mentes jövedelem összegét, és azt a háztartásban élők számához igazítsák. A saját beszámolója szerint a javaslatot tizenháromszor nyújtotta be, és a kormánypárti többség sok alkalommal már azt sem támogatta, hogy a módosítás a teljes Országgyűlés elé kerüljön.',
                  'A szabályozás végül változott, de nem az ő javaslata szerint: 2025. július 1-jétől a végrehajtás alól mentes összeg a minimálbér 60 százaléka, azaz nagyjából 106 ezer forint. Ez az alacsony jövedelmű adósoknak valódi könnyebbség, ugyanakkor a jogsegélyt nyújtó szervezetek szerint önmagában kevés a legszegényebbek helyzetének rendezéséhez. A történet így egyszerre mutatja a parlamenti ellenzék korlátait és azt, hogyan lehet a parlamenti eszközöket civil nyomással összekapcsolni.',
                ],
                sources: [
                  {
                    source: 'Mérce',
                    date: '2024. dec. 6.',
                    headline: 'Mi változik a végrehajtások terén: most akkor igazságos lesz a rendszer?',
                    url: 'https://merce.hu/2024/12/06/mi-valtozik-a-vegrehajtasok-teren-most-akkor-igazsagos-lesz-a-rendszer/',
                    lead:
                      'Tételes végigvezetés arról, mi változik a védett jövedelem szabályaiban, és mi az, ami változatlan marad.',
                  },
                  {
                    source: 'HVG',
                    date: '2024. dec. 2.',
                    headline: 'Utcajogász: Nem elég a legszegényebbek megsegítésére a végrehajtási szabályok módosítása',
                    url: 'https://hvg.hu/itthon/20241202_Utcajogasz-vegrehajtasi-szabalyok-javaslatok',
                    lead:
                      'A jogsegélyszolgálat kritikája: miért nem old meg mindent a mentes összeg emelése, és mit kellene mellé tenni.',
                  },
                ],
              },
              {
                heading: 'Devizahitelesek — közös javaslat Hadházy Ákossal',
                paragraphs: [
                  'Az Európai Unió Bíróságának 2025 tavaszi döntése után, amely tisztességtelennek mondta ki a teljes árfolyamkockázatot a fogyasztóra hárító szerződéses kikötést, Jámbor András és Hadházy Ákos közös törvényjavaslatot nyújtott be. Két lépést kértek: függesszék fel az összes folyamatban lévő devizahiteles eljárást a jogértelmezés tisztázásáig, és szülessen olyan törvény, amely az uniós döntést átülteti a magyar jogba.',
                  'Ez nem lezárt elszámoltatási ügy, és nem jelenti automatikusan minden adós problémájának megoldását. A jelentősége abban áll, hogy egy uniós bírósági döntésből következő jogi helyzetet a két képviselő azonnal parlamenti napirenddé próbált tenni ahelyett, hogy megvárta volna a kormány lépését.',
                ],
                links: [{ text: 'Hadházy Ákos', href: '/rendszervaltas/hadhazy-akos' }],
                sources: [
                  {
                    source: 'Index',
                    date: '2025. máj. 6.',
                    headline: 'Jámbor András és Hadházy Ákos közös törvényjavaslatot nyújtott be a devizahitelesekért',
                    url: 'https://index.hu/belfold/2025/05/06/jambor-andras-jozsefvaros-devizahitelesek/',
                    lead:
                      'A javaslat tartalma pontokba szedve: mit kérnek a folyamatban lévő eljárásoktól, és mit a jogalkotótól.',
                  },
                  {
                    source: '444',
                    date: '2025. máj. 6.',
                    headline: 'Az összes devizahiteles eljárás felfüggesztését kezdeményezi Jámbor András és Hadházy Ákos',
                    url: 'https://444.hu/2025/05/06/az-osszes-devizahiteles-eljaras-felfuggeszteset-kezdemenyezi-jambor-andras-es-hadhazy-akos',
                    lead:
                      'Az uniós ítélet és a magyar következménye: miért lehetne érintett több tízezer, még futó végrehajtási ügy.',
                  },
                ],
              },
            ],
          },
          {
            title: 'Diószegi utca — állami beruházás, kisajátítás, lakók',
            when: '2024–2025',
            body:
              'A Diószegi Sámuel utcai családok ügye mutatja meg leginkább, mit jelent Jámbor számára a helyi képviselet. A Nemzeti Közszolgálati Egyetem bővítéséhez kapcsolódó állami kisajátítások miatt több száz józsefvárosi család került bizonytalan helyzetbe. A leromlott állapotú épületek bontása és a lakók elhelyezése nem pusztán városfejlesztési kérdés: arról szól, milyen feltételekkel mozdít ki az állam embereket az otthonukból egy beruházás érdekében.',
            more: [
              'Jámbor 2024 áprilisától a lakók demonstrációin is megjelent, 2025 júniusában pedig a Miénk az utca címmel meghirdetett tüntetésen azt követelte, hogy az érintettek ne politikai alkuk és egymásra mutogatás közben maradjanak ellátatlanul. Az álláspontja szerint a családoknak élhető, összkomfortos cserelakás vagy olyan kártalanítás jár, amelyből ténylegesen új otthont tudnak teremteni — konkrét határidővel, nem ígérettel.',
              'Ebben az ügyben különösen fontos, hogy nem általános kormánykritikus jelszóról volt szó. A kérdés végig konkrét maradt: ki biztosítja a lakásokat, mikorra történik meg az elhelyezés, mennyi pénz áll rendelkezésre, és ki vállalja a felelősséget, ha a határidők újra kitolódnak.',
              'A Dicsőségfalon ez azért érdemel külön pontot, mert a NER működésének egyik tipikus mintáját teszi láthatóvá: egy állami presztízsberuházásnál a döntéshozók könnyen számként vagy akadályként kezelik az érintett embereket. A képviselet akkor válik valódivá, amikor valaki nem engedi, hogy a lakók eltűnjenek a beruházási tervek és a salátatörvények mögött.',
            ],
            sources: [
              {
                source: 'Telex',
                date: '2024. ápr. 18.',
                headline: 'Gyerekkorom óta itt élek, erre tájsebnek nevezik az otthonom, hát kösz! — józsefvárosi lakások állami kisajátítása ellen tüntettek',
                url: 'https://telex.hu/gazdasag/2024/04/18/nke-onkormanyzat-jozsefvaros-piko-andras-jambor-andras',
                lead:
                  'Az első nagy tiltakozás az egyetem előtt: mit mondanak az érintett lakók, és mire hivatkozik az állam a kisajátításnál.',
              },
              {
                source: 'Mérce',
                date: '2024. ápr. 17.',
                headline: 'Nekem semmilyen más lehetőségem nincs a lakhatásra, mint ez a bérlemény — a józsefvárosi lakáskisajátítások ellen tüntettek',
                url: 'https://merce.hu/2024/04/17/nekem-semmilyen-mas-lehetosegem-nincs-a-lakhatasra-mint-ez-a-berlemeny-a-jozsefvarosi-lakaskisajatitasok-ellen-tuntettek-az-nke-elott/',
                lead:
                  'Helyszíni riport a bérlők oldaláról: kinek hova kellene mennie, és miért nincs hova.',
              },
              {
                source: 'Népszava',
                date: '2025. jún. 15.',
                headline: 'Családjuk lakhatásáért, egy fokkal jobb életért tüntettek Józsefvárosban a Diószegi utcai lakók',
                url: 'https://nepszava.hu/3283663_nemzeti-kozszolgalati-egyetem-jozsefvaros-bovites-hazbontas-kisajatitas-allam-onkormanyzat-lakok-jambor-andras-piko-andras-ferencz-orsolya',
                lead:
                  'A tüntetés, amelyen Jámbor azt követelte, hogy minden lakó kapjon cserelakást az államtól — és amelyen egyetlen döntéshozó sem jelent meg.',
              },
            ],
          },
          {
            title: 'Parlamentből indított helyi nyomásgyakorlás',
            when: '2022–2026',
            body:
              'Jámbor parlamenti munkájának egyik erőssége, hogy nem kizárólag országos témákban szólalt fel. Írásbeli kérdésekkel, bizottsági munkával és nyilvános nyomásgyakorlással helyi ügyeket is megpróbált előrevinni — abból a megfontolásból, hogy a mandátum csak egy eszköz a sok közül, és az utcai jelenlét, a jogsegély meg a helyi szervezés nélkül egy ellenzéki képviselő könnyen ugyanabba a zárt politikai világba kerül, amelytől eredetileg változást remélt.',
            more: [
              'Két példát maga említett. A rezsicsökkentés átalakításakor a feltöltőkártyás áramfogyasztók szabályozása elromlott; írásbeli kérdések sorozatával mintegy húszezer ember helyzetét próbálta rendezni. Egy másik ügyben a ferencvárosi tanuszodák elmaradt felújítása miatt kérdezte a kormányt és a tankerületet, a nyomásgyakorlás után pedig egyeztetés indult az érintett szereplőkkel.',
              'Ezek nem klasszikus korrupciós leleplezések, és önmagukban nem bizonyítanak rendszerszintű elszámoltatást. Azt sem lehet állítani, hogy minden esetben kizárólag a képviselő fellépése hozta meg a változást. Mégis fontosak, mert a parlamenti képviselet egy másik funkcióját mutatják meg: a helyi problémák országos nyilvánosságba emelését és a döntéshozók válaszadásra kényszerítését.',
            ],
            sources: [
              {
                source: 'Telex',
                date: '2024. nov. 22.',
                headline: 'Ha Magyar Péter mindenkit kizár, nem lesz elegendő szavazata a rendszerváltáshoz',
                url: 'https://telex.hu/belfold/2024/11/22/jambor-andras-szikra-mozgalom-jozsefvaros-ferencvaros-orszaggyulesi-kepviselo-interju',
                lead:
                  'Hosszú interjú a képviselői munka eszközeiről: mire jó a parlament kétharmados többség mellett, és mit lehet elérni írásbeli kérdésekkel.',
              },
            ],
          },
          {
            title: 'A lejáratókampány — és a sajtóper, amit megnyert',
            when: '2023–2024',
            body:
              'A Szikra Mozgalmat és Jámbor Andrást 2023-ban súlyos kormányzati és kormányközeli médiatámadások érték. A kampány egy antifasiszta esemény körüli büntetőeljárás, illetve egy a mozgalomhoz kötöttként bemutatott aktivista köré épült, majd oda jutott, hogy a képviselőt személyesen hozták összefüggésbe pedofil bűncselekményekkel.',
            more: [
              'Az ügyben külön kell választani a tényeket és a politikai minősítéseket. Nem lehet azt állítani, hogy a mozgalommal kapcsolatban felmerült minden vita puszta kitaláció volt, és azt sem, hogy egy politikai közösség minden tagjának minden tettéért a képviselő felel. A nyilvánosságban megjelent legsúlyosabb összekapcsolásokat azonban sem a hatósági közlések, sem a bírósági fejlemények nem támasztották alá úgy, ahogyan azt a kormányközeli sajtó sugallta.',
              'Jámbor nem hátrált ki a nyilvánosságból: a parlamentbe vitte be azt az aktivistát, akit a sajtóban előzetesen megbélyegeztek, és bocsánatkérést követelt a kormánypárti képviselőktől. 2024 októberében a Fővárosi Ítélőtábla jogerősen helyt adott a sajtó-helyreigazítási keresetének azzal a kormányközeli lappal szemben, amely valótlanul állította róla, hogy bűnrészes pedofil bűncselekményekben.',
              'A Dicsőségfal szempontjából ez nem azért jelentős, mert Jámbornak minden politikai vitában igaza lenne. Hanem azért, mert a NER egyik alapvető működési módja a politikai ellenfelek büntetőjogi és erkölcsi megbélyegzése. Aki egy ilyen kampánnyal szemben jogi, parlamenti és nyilvánosságbeli eszközökkel védi a saját közösségét, az a demokratikus politikai tér védelmében is dolgozik.',
            ],
            highlight: {
              heading: 'A jogerős ítélet önmagában nem volt elég',
              body:
                'A per megnyerése után a lap nem tette közzé a helyreigazítást. Jámbornak végrehajtást kellett kezdeményeznie a saját ítélete érvényesítéséhez — és a szöveg csak ezután, 2024 novemberében jelent meg. Az a képviselő kényszerült végrehajtásra, aki a parlamentben éppen a végrehajtási rendszer igazságtalanságairól nyújtott be újra és újra javaslatot.',
              sources: [
                {
                  source: 'Telex',
                  date: '2024. nov. 10.',
                  headline: 'Végrehajtást kezdeményezett Jámbor András a helyreigazítás kikényszerítéséért',
                  url: 'https://telex.hu/belfold/2024/11/10/jambor-andras-szikra-mozgalom-sajtoper-origo-vegrehajtas',
                },
                {
                  source: '444',
                  date: '2024. nov. 11.',
                  headline: 'Végül megjelent a helyreigazítás a cikkről, amiben minden alap nélkül azt állították, hogy Jámbor András bűnrészes pedofil bűncselekményben',
                  url: 'https://444.hu/2024/11/11/az-origo-vegul-helyreigazitotta-a-cikket-amiben-minden-alap-nelkul-azt-allitottak-hogy-jambor-andras-bunreszes-pedofil-buncselekmenyben',
                },
              ],
            },
            sources: [
              {
                source: 'Telex',
                date: '2024. okt. 13.',
                headline: 'Jámbor András pert nyert az őt pedofilozó kormányközeli lappal szemben',
                url: 'https://telex.hu/belfold/2024/10/13/jambor-andras-sajtohelyreigazitas-per-origo',
                lead:
                  'Az elsőfokú elutasítás után fél évvel az ítélőtábla jogerősen helyt adott a keresetnek — mit kellett a lapnak helyreigazítania.',
              },
              {
                source: 'Media1',
                date: '2024. okt. 13.',
                headline: 'Jogerősen pert nyert Jámbor András',
                url: 'https://media1.hu/2024/10/13/origo-jambor-andras-fovarosi-itelotabla-birosag-pedofilia-helyreigazitas/',
                lead:
                  'A sajtójogi összefoglaló: mi volt a kereset tárgya, mit mondott ki a bíróság, és mibe került a lapnak.',
              },
            ],
          },
          {
            title: 'A visszalépés — amikor a mandátum kevesebbet ért, mint a cél',
            when: '2025. június',
            body:
              '2025. június 19-én Jámbor bejelentette, hogy nem indul a 2026-os választáson abban a két kerületben, ahol 2022-ben megválasztották. Az indoklása szerint ha elindul, nagyobb eséllyel szerez egy mandátumot a Fidesznek, mint amekkora az esélye annak, hogy ő szerezzen egyet a kormányváltásért.',
            more: [
              'Ez a Dicsőségfalon azért kap külön pontot, mert a NER egyik legmegbízhatóbb szövetségese éppen az ellenzéki oldal széttagoltsága volt. Egy egyéni képviselői mandátum a magyar politikában nem apróság: státusz, nyilvánosság, apparátus és megélhetés. Aki ezt a saját számítása szerint a kormányváltás esélyéért adja fel, az pontosan azt teszi, amit a rendszer a legkevésbé tud kezelni.',
              'Nem ő volt az első visszalépő: Hajnal Miklós 2025 márciusában adta át a hegyvidéki körzetet Magyar Péternek, májusban Tóth Endre jelentette be, hogy nem indul újra, a Momentum küldöttgyűlése pedig június 7-én döntött úgy, hogy a párt egyáltalán nem indul. Az ő lépése abban különbözik ezektől, hogy nem pártdöntés hajtotta végre rajta: függetlenként, saját magának kellett kimondania, hogy a körzet, amelyet 2022-ben a Fidesztől vett el, nélküle ad jobb esélyt a kormányváltásra. A saját beszámolója szerint a rendszerváltás érdekében lépett vissza a Tisza javára.',
              'A döntés nem tette utólag helyessé az összes korábbi politikai állítását, és nem zárta le a vitákat a mozgalom szervezeti működéséről sem. De egy olyan évben, amikor sok szereplő a saját pozíciója megtartásával volt elfoglalva, ez a lépés mérhető és visszakereshető — nem szándéknyilatkozat, hanem visszalépés.',
            ],
            sources: [
              {
                source: 'Népszava',
                date: '2025. jún. 19.',
                headline: 'Jámbor András bejelentette, hogy nem indul a 2026-os választáson',
                url: 'https://nepszava.hu/3284158_jambor-andras-valasztas-2026-nem-indul',
                lead:
                  'A bejelentés és a hozzá tartozó számítás: miért gondolta úgy, hogy az indulása a Fidesznek kedvezne Józsefvárosban és Ferencvárosban.',
              },
              {
                source: '444',
                date: '2025. márc. 26.',
                headline: 'Hajnal Miklós visszalép Magyar Péter javára a hegyvidéki választókörzetben',
                url: 'https://444.hu/2025/03/26/hajnal-miklos-visszalep-magyar-peter-javara-a-hegyvideki-valasztokorzetben',
                lead:
                  'Az első ilyen lépés 2025-ben, három hónappal Jámboré előtt: egy 2022-ben egyéni mandátumot szerzett képviselő adja át a körzetét.',
              },
              {
                source: 'Telex',
                date: '2025. jún. 7.',
                headline: 'Nem indul a Momentum a 2026-os országgyűlési választáson',
                url: 'https://telex.hu/belfold/2025/06/07/momentum-kuldottgyules-valasztas-2026',
                lead:
                  'A pártszintű döntés, amely megelőzte Jámbor bejelentését — a visszalépések 2025-ben végigfutó sorozata.',
              },
            ],
          },
        ],
      },
      extra: [
        {
          heading: 'A módszer: szervezés, nyilvánosság, jogsegély, képviselet',
          paragraphs: [
            'A munkáját négy, egymásra épülő elem jellemzi. Nyilvánosság: a Mérce révén szociális és lakhatási ügyekből politikai témát csinált. Közösségszervezés: civil csoportokkal, aktivistákkal és helyi közösségekkel mozgósított. Jogvédelem: kilakoltatások, végrehajtások és kiszolgáltatott családok ügyében gyakorlati segítséget keresett. Intézményi képviselet: képviselőként parlamenti kérdésekkel, törvényjavaslatokkal és bizottsági munkával próbált nyomást gyakorolni.',
            'Ez a módszer nem látványos minden nap. Nincs mindig egyetlen dokumentum, egyetlen feljelentés vagy egyetlen nagy leleplezés, amelyhez az egész teljesítményt hozzá lehetne kötni. A hatása inkább abban mérhető, hogy egy ügyből lesz-e nyilvános vita, a lakók kapnak-e politikai képviseletet, és egy civil követelés eljut-e a jogszabályokig.',
          ],
        },
        {
          heading: 'Milyen kritikák érték a munkáját?',
          paragraphs: [
            'Jámbor megítélése a kormánykritikus oldalon sem egységes. Kritikusai szerint a Szikra Mozgalom politikai és szervezeti működése nem mindig volt átlátható, a mozgalom belső konfliktusai pedig időnként a nyilvánosság előtt is megjelentek. Mások azt róják fel, hogy a radikális baloldali nyelv és az antifasiszta közeghez való kapcsolódás szűkíti a megszólítható választók körét.',
            'Jámbor politikai szereplő, nem pártatlan bíró: az állításai ugyanúgy forráshoz kötöttek, mint bárki másé, és nem lesznek igazzá attól, hogy ő mondta őket. A Dicsőségfal dokumentált közéleti teljesítményeket gyűjt, nem életműveket minősít.',
            'A kérdés ezért nem az, hogy minden döntése helyes volt-e. A kérdés az, hogy létrehozott-e olyan nyilvánosságot, közösséget és politikai képviseletet, amely a NER-rel szemben több esélyt adott a kiszolgáltatott embereknek.',
          ],
        },
        {
          heading: 'Miért van helye a Dicsőségfalon?',
          paragraphs: [
            'A helye nem egyetlen nagy leleplezésen múlik. Az eddigi munkája több, egymást erősítő darabból áll: egy független szerkesztőség felépítéséből, lakhatási és végrehajtási ügyek felkarolásából, tömeges tiltakozások megszervezéséből, helyi lakók parlamenti képviseletéből, a politikai lejáratókampányokkal szembeni jogi fellépésből, és végül egy mandátum feladásából.',
            'A NER elleni küzdelemben nemcsak az számít, ki találja meg a közpénz útját vagy ki dokumentálja egy hatalmi hálózat működését. Az is számít, ki hozza létre azt a nyilvánosságot és közösséget, amelyben az érintettek megszólalhatnak, megszerveződhetnek és követeléseket fogalmazhatnak meg.',
          ],
        },
      ],
      faq: [
        {
          q: 'Jámbor András korrupciós ügyeket tárt fel?',
          a: 'Nem ez a fő profilja. A Dicsőségfalon nem korrupciófeltáróként, hanem független nyilvánosságépítőként, lakhatási jogvédőként és közösségszervezőként szerepel.',
        },
        {
          q: 'Mi volt a szerepe a Fudan–Diákváros ügyben?',
          a: '2021-ben a Szikra Mozgalommal tömegtüntetést szervezett a Fudan Egyetem budapesti campusának terve ellen, és a Diákváros ügyét a lakhatási válsággal kötötte össze. Nem állítható, hogy egyedül ő érte el a 2024 novemberében bejelentett kormányzati irányváltást, de a téma napirenden tartásában fontos szerepe volt.',
        },
        {
          q: 'Mit tett a végrehajtási rendszer megváltoztatásáért?',
          a: 'Közérdekű adatigényléssel tette nyilvánossá, hogy 670 ezer ember ellen folyik végrehajtás, és a saját beszámolója szerint tizenháromszor nyújtott be javaslatot a végrehajtás alól mentes jövedelem emelésére. A szabály végül 2025. július 1-jétől változott: a mentes összeg a minimálbér 60 százaléka lett.',
        },
        {
          q: 'Miért fontos a Diószegi utcai ügy?',
          a: 'Mert megmutatja, hogyan kerülhetnek családok bizonytalan helyzetbe egy állami beruházás miatt. A Nemzeti Közszolgálati Egyetem bővítése miatti kisajátítások több száz józsefvárosi háztartást érintettek; Jámbor határidőhöz kötött elhelyezést és megfelelő kártalanítást követelt.',
        },
        {
          q: 'Jámbor András újságíró vagy politikus?',
          a: 'Mindkettő volt, de a szerepek időben elkülönülnek. A Mérce alapítója és 2019-ig főszerkesztője volt, 2022 és 2026 között pedig Józsefváros és Ferencváros független országgyűlési képviselőjeként dolgozott.',
        },
        {
          q: 'Miért nem indult a 2026-os választáson?',
          a: '2025 júniusában jelentette be a visszalépését: a számítása szerint az indulása nagyobb eséllyel juttatott volna mandátumot a Fidesznek, mint saját magának, ezért a kormányváltás érdekében nem indult a két kerületében.',
        },
      ],
      sources: [
        { source: 'jamborandras.hu', headline: 'Ki vagyok én?', url: 'https://www.jamborandras.hu/rolam' },
        { source: 'jamborandras.hu', headline: 'A munkámról', url: 'https://www.jamborandras.hu/a-munkamrol/' },
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
    photo: '/images/rendszervaltas/merce.webp',
    photoFit: 'contain',
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
    photo: '/images/rendszervaltas/szikra-mozgalom.webp',
    photoFit: 'contain',
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
    photo: '/images/rendszervaltas/juhasz-peter.webp',
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
    photo: '/images/rendszervaltas/marki-zay-peter.webp',
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
    photo: '/images/rendszervaltas/puzser-robert.webp',
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
    related: [
      { label: 'Dicsőségfal', href: '/rendszervaltas' },
      { label: 'Kiemelt ügyek', href: '/ugyek' },
    ],
    updatedAt: '2026-09-23',
    live: true,
    detail: {
      seoTitle: 'Puzsér Róbert: civil kontroll, Sétáló Budapest, Polgári Ellenállás',
      seoDescription:
        'Miért van Puzsér Róbert a Dicsőségfalon? A Sétáló Budapest átláthatósági vállalásai, a kormányváltás–rendszerváltás megkülönböztetése, a Polgári Ellenállás és a Rendszerbontó Nagykoncert — forrásokkal.',
      lead:
        'Puzsér Róbert nem oknyomozó újságíró, nem korrupciós ügyek dokumentátora, és nem olyan politikus, aki egyetlen intézmény ellen vitt volna éveken át tartó kampányt. A Dicsőségfalon másért van: évek óta következetesen azt a kérdést állítja a középpontba, hogy egy kormányváltás önmagában rendszerváltás-e, és mi történik akkor, ha a politikai hatalom ellenőrzésének intézményi és társadalmi garanciái nem változnak meg.',
      cases: {
        heading: 'A legfontosabb állomások',
        intro:
          'Ez más típusú teljesítmény, mint Panyi Szabolcs oknyomozó újságírása vagy Hadházy Ákos közpénzellenőrző munkája. Puzsér Róbert esetében nem egyetlen feltárt ügyet kell keresni: a hozzájárulása az, hogy a politikai hatalommal szembeni társadalmi kontroll szükségességét önálló témává tette — és ehhez konkrét civil-politikai kezdeményezéseket is épített.',
        items: [
          {
            title: 'Sétáló Budapest — civil politika és átláthatóság',
            when: '2018–2019',
            body:
              'Puzsér Róbert 2018-ban dolgozta ki a Sétáló Budapest koncepcióját a 2019-es önkormányzati választásra, amelyen főpolgármester-jelöltként indult. A kezdeményezés nem pusztán városfejlesztési programként jelent meg: saját meghatározása szerint kísérlet volt arra, hogy pártpolitikától független, civil alapokra helyezett politikai és kulturális precedenst teremtsen.',
            more: [
              'A mintegy 150 oldalas, tizenegy fejezetből álló programot több tucat szakember — építészek, urbanisták, tájépítészek, szociálpolitikai és közlekedési szakértők — közreműködésével állították össze. A területek között szerepelt a várostervezés, a közlekedés, a szociálpolitika, az oktatás, a hulladékgazdálkodás és a turizmus is.',
              'A Dicsőségfal szempontjából a szervezeti fejezet a lényeg: a program a teljes transzparenciát, a közbeszerzések alapelveinek tisztázását és a döntés-előkészítés nyitottá tételét — kifejezetten a civil szervezetek felé — fogalmazta meg az önkormányzati működés elveként. Itt tehát már nem egy publicista politikai kommentárjáról volt szó, hanem egy kezdeményezésről, amelynek deklarált alapelve az átláthatóság és a számonkérhetőség volt.',
              'A kampányhoz az Állampolgárok a centrumban Egyesület is kapcsolódott, közösségi finanszírozással és civil aktivisták részvételével.',
            ],
            sources: [
              {
                source: 'Sétáló Budapest',
                headline: 'Sétáló Budapest — a 2019-es program teljes szövege',
                url: 'https://github.com/setalo-budapest/program',
                lead:
                  'A program tizenegy fejezete nyilvánosan elérhető. A szervezeti fejezet mondja ki a teljes transzparenciát, a közbeszerzések alapelveinek tisztázását és a döntés-előkészítés nyitottá tételét.',
              },
              {
                source: 'Index',
                date: '2019. jún. 13.',
                headline: 'Visszaállítaná Budapest történelmi zászlaját Puzsér Róbert',
                url: 'https://index.hu/belfold/2019/06/13/puzser_setalo_budapest_program/',
                lead:
                  'Korabeli beszámoló a program bemutatásáról: mit tartalmazott, és milyen szakmai háttérrel készült.',
              },
            ],
          },
          {
            title: 'Kormányváltás vagy rendszerváltás?',
            when: '2020-tól',
            body:
              'Puzsér Róbert közéleti gondolkodásának visszatérő témája a kormányváltás és a rendszerváltás megkülönböztetése. A Magyar Hangban 2020-ban megjelent publicisztikájában azt fejtette ki, hogy a politikai vezetés lecserélése önmagában nem feltétlenül alakítja át azokat az intézményi és társadalmi viszonyokat, amelyek a hatalom működését meghatározzák.',
            more: [
              'Az érvelésben megjelent az arányosabb választási rendszer, az erősebb civil szervezetek, a független és minőségi média, valamint az igazságszolgáltatás és az ügyészség függetlenségének kérdése is.',
              'Ez lett a rendszerkritikájának központi gondolata: nem elég azt megkérdezni, hogy ki kormányoz — azt is meg kell kérdezni, milyen intézmények és társadalmi erők képesek ellenőrizni a kormányzati hatalmat. A gondolat a későbbi megszólalásaiban is visszatért; a 2026-os választás előtt például úgy fogalmazott, hogy a kormányváltásra sokkal nagyobb esélyt lát, mint a tényleges rendszerváltásra.',
            ],
            sources: [
              {
                source: 'Magyar Hang',
                date: '2020. febr. 21.',
                headline: 'Kormányváltás vagy rendszerváltás?',
                url: 'https://hang.hu/publicisztika/kormanyvaltas-vagy-rendszervaltas-113446',
                lead:
                  'A publicisztika, amelyben a különbségtételt kifejti: arányos választási rendszer, erős civil szervezetek, független média és független igazságszolgáltatás.',
              },
              {
                source: 'Népszava',
                headline:
                  'Puzsér Róbert: Jelenleg 60 százalékot tennék rá, hogy kormányváltás lesz, a rendszerváltásra 40 százalékot',
                url: 'https://nepszava.hu/3298072_puzser-robert-valasztas-2026-politika-magyarorszag-tisza-part-fidesz-ellenzek-kormanyvaltas-rendszervaltas-interju',
                lead:
                  'Ugyanaz a gondolat a választás előtt, számokra lefordítva — a kormányváltás és a rendszerváltás nála nem ugyanannak a folyamatnak a két neve.',
              },
            ],
          },
          {
            title: 'A 2024-es kegyelmi ügy — a hatalom ellenőrzésének kérdése',
            when: '2024',
            body:
              'A kegyelmi döntés nyilvánosságra kerülése után Puzsér Róbert a Spirit FM műsorában arról beszélt, hogy az ügy szerinte súlyos válságot jelentett a fennálló politikai rendszer számára. Nem ő tárta fel a kegyelmi döntést, és nem is ő volt az oknyomozó feltárás szereplője.',
            more: [
              'A jelentősége másban állt: a nyilvánosságban a konkrét ügyet a hatalom működésének és társadalmi ellenőrzésének nagyobb kérdésével kapcsolta össze. Az értelmezésében az ügy azt is felvetette, milyen garanciák akadályozzák meg, hogy a politikai hatalom belső döntési mechanizmusai ellenőrizetlenül működjenek.',
              'Fontos elkülöníteni a szerepeket: ez Puzsér Róbert értelmezése az ügyről, nem ténymegállapítás a kegyelmi döntés körülményeiről.',
            ],
            sources: [
              {
                source: 'Spirit FM',
                headline: 'Puzsér a kegyelmi ügyről: Hogy kell ezt megmagyarázni?',
                url: 'https://spiritfm.hu/cikk/puzser-a-kegyelmi-ugyrol-hogy-kell-ezt-megmagyarazni',
                lead:
                  'A rádióműsor összefoglalója, amelyben a kegyelmi ügyet a rendszer működésének válságaként értelmezi.',
              },
              {
                source: 'Magyar Hang',
                headline: 'Puzsér Róbert: Nem elég Novákék távozása',
                url: 'https://hang.hu/magyar-hang-plusz/nem-eleg-novakek-tavozasa-162077',
                lead:
                  'Ugyanaz az alapállás írásban: a személyi következmények önmagukban nem érintik a döntési mechanizmusokat.',
              },
            ],
          },
          {
            title: 'Polgári Ellenállás — civil mozgalom a hatalom ellenőrzésére',
            when: '2025',
            body:
              'Puzsér Róbert 2025-ben indította el a Polgári Ellenállást. A kezdeményezés nem pártként jött létre, hanem civil társadalmi mozgalomként: a célja saját megfogalmazása szerint az volt, hogy a társadalom ne csak választóként jelenjen meg a politikában, hanem a hatalom gyakorlását folyamatosan ellenőrző és számon kérő közösségként is.',
            more: [
              'A mozgalom első nagy demonstrációját 2025. június 10-én tartották a Kossuth téren, részben az akkori nyilvánosságkorlátozó törvényjavaslat ellen. A Telexnek adott hosszú interjújában Puzsér Róbert úgy írta le a Polgári Ellenállást, mint amely nem alternatívája a Tisza Pártnak, hanem az a feltételrendszer, amely az új hatalmat kontrollálhatja.',
              'A 2025-ös nyilatkozataiban egyértelműen megkülönböztette a kormányváltást és a rendszerváltást: a Tisza Párt szerepét elsősorban az Orbán-rendszer leváltásának eszközeként értelmezte, miközben a civil mozgalom feladatának a politikai és társadalmi kontroll fenntartását tartotta.',
              'A modell lényege tehát nem az, hogy a civil társadalom kormányozzon egy új kormány helyett. Éppen ellenkezőleg: az a dolga, hogy a mindenkori kormányt ellenőrizze.',
            ],
            sources: [
              {
                source: 'Telex',
                date: '2025. jún. 20.',
                headline:
                  'Puzsér Róbert: Az utolsó töltényig támogatni fogjuk a Tisza Pártot, hogy váltsa le az Orbán-rendszert',
                url: 'https://telex.hu/video/2025/06/20/puzser-robert-polgari-ellenallas-video-interju',
                lead:
                  'Vágatlan, órás interjú a mozgalom céljairól: miért nem párt, mi a viszonya a Tisza Párthoz, és mit jelent nála a civil kontroll.',
              },
              {
                source: 'Telex',
                date: '2025. jún. 10.',
                headline: 'Puzsér: Már csak egyetlen értelmes követelés van, takarodjanak!',
                url: 'https://telex.hu/belfold/2025/06/10/polgari-ellenallas-tuntetes-fuggetlen-nyilvanossag-ellehetetlenitesi-torveny',
                lead: 'Helyszíni beszámoló a mozgalom első nagy demonstrációjáról a Kossuth téren.',
              },
              {
                source: 'Kontroll',
                date: '2025. jún. 9.',
                headline: 'Indul a polgári ellenállás — élő adás Puzsér Róberttel',
                url: 'https://kontroll.hu/cikk/belfold/2025/06/09/indul-a-polgari-ellenallas-elo-adas-puzser-roberttel-1',
                lead: 'A mozgalom indulása a saját szavaival, a tüntetés előtti napon.',
              },
            ],
            videos: [
              {
                id: 'qPrRFqWDqz4',
                label: 'Kontroll · 2025. jún. 10.',
                title: 'Indul a Polgári Ellenállás — tüntetés a Kossuth téren',
                summary:
                  'A Kontroll élő közvetítése a mozgalom első nagy demonstrációjáról a Kossuth térről. 193 ezer megtekintés.',
              },
            ],
          },
          {
            title: 'Rendszerbontó Nagykoncert — a Hősök terén',
            when: '2026. április 10.',
            body:
              'A Polgári Ellenállás 2026-ban a Rendszerbontó Nagykoncert megszervezésével hozott létre jelentős nyilvános eseményt. A Hősök terére szervezett, ingyenes rendezvényt a parlamenti választás előtt két nappal tartották, és Puzsér Róbert a szervezésben és a fellépők megkeresésében is részt vett.',
            more: [
              'Több mint negyven előadó lépett fel — a szervezők ötven fellépőnél húzták meg a határt —, és minden fellépő egyetlen, rendszerkritikus dalt adott elő. A jelentősége nem egy konkrét korrupciós ügy feltárásában keresendő: a cél a rendszerkritikus társadalmi aktivitás összekapcsolása volt egy szélesebb kulturális közeggel.',
              'Ez mutatja meg a legpontosabban Puzsér Róbert szerepét a Dicsőségfalon: nem egyetlen intézményben végzett feltáró munkával, hanem nyilvánosságépítéssel, közösségszervezéssel és civil politikai aktivitással járult hozzá a rendszerkritikus közeghez.',
            ],
            sources: [
              {
                source: '444',
                date: '2026. ápr. 10.',
                headline: 'Fiatalok tízezrei gyűltek össze a rendszerbontó nagykoncerten a Hősök terén',
                url: 'https://444.hu/2026/04/10/nagy-tomeg-elott-kezdodott-a-rendszerbonto-nagykoncert-mar-az-elso-fellepo-utan-megindult-a-mocskosfideszezes',
                lead: 'Helyszíni tudósítás a koncertről, amelyet a választás előtt két nappal tartottak.',
              },
              {
                source: 'Népszava',
                date: '2026. ápr. 10.',
                headline: 'Rendszerbontó Nagykoncert: a hatalom fárasztóbb hét óra zenénél',
                url: 'https://nepszava.hu/3318312_rendszerbonto-nagykoncert-hosok-tere-polgari-ellenallas-puzser-robert',
                lead:
                  'Hét óra zene, ingyenes belépés, fellépőnként egyetlen rendszerkritikus dal — beszámoló az estéről.',
              },
              {
                source: 'Index',
                date: '2026. márc. 20.',
                headline: 'Újabb 12 előadó csatlakozott Puzsér Róbert rendszerbontó nagykoncertjéhez',
                url: 'https://index.hu/belfold/2026/03/20/puzser-robert-rendszerbonto-nagykoncert-hosook-tere-ujabb-fellepok-bejelentes-polgari-ellenallas/',
                lead: 'A szervezés menete: hogyan állt össze a fellépői névsor a választás előtti hetekben.',
              },
            ],
            videos: [
              {
                id: 't6BEQJTqnXY',
                label: 'Szélsőközép · 2026. ápr. 10.',
                title: 'Rendszerbontó Nagykoncert — a teljes közvetítés',
                summary:
                  'A Hősök terére szervezett estét több mint kétmillióan látták a YouTube-on. A hétórás közvetítés egyben a nap dokumentuma is: fellépőnként egy rendszerkritikus dal.',
              },
            ],
          },
        ],
      },
      videoBlock: {
        heading: 'Videók Puzsér Róberttől',
        intro:
          'Nem általános interjúkat gyűjtöttünk ide, hanem azt az ívet, amiért ezen a lapon szerepel: a kormányváltás és a rendszerváltás megkülönböztetésétől a civil kontroll megszervezéséig.',
        items: [
          {
            id: '2xNWw53cNRI',
            label: 'Puzsér Róbert · 2024. márc. 15.',
            title: 'Puzsér Róbert a kormányváltásról és a kegyelmi ügyről',
            summary:
              'A kegyelmi ügy mint a hatalom működésének tünete, és a kérdés, hogy egy kormányváltás mennyiben változtat a rendszer működésén.',
          },
          {
            id: 'kHXfgjm0j4E',
            label: 'Puzsér Róbert · 2025. jún. 24.',
            title: 'Puzsér Róbert a Polgári Ellenállásról és a civil kontrollról',
            summary:
              'Miért nem pártként jött létre a mozgalom, és mit jelent nála a mindenkori hatalom ellenőrzése — a rendszerváltás a választás napján nem ér véget.',
          },
        ],
      },
      extra: [
        {
          heading: 'Nem egyetlen politikai oldal szócsöve',
          paragraphs: [
            'A Dicsőségfal szempontjából fontos, hogy Puzsér Róbert nem kizárólag a kormányoldallal szemben fogalmazott meg kritikát. A Tisza Párt és Magyar Péter kapcsán is rendszeresen bírált, miközben 2025-ben arról beszélt, hogy a Tisza szerepét az Orbán-rendszer leváltásában támogatja.',
            'Ez nála nem ellentmondás: a saját értelmezése szerint egy politikai erő támogatása egy adott történelmi cél elérésében nem jelenti azt, hogy a civil társadalomnak fel kellene adnia ugyanannak az erőnek az ellenőrzését. A hatalom leváltása és a hatalom ellenőrzése két külön feladat.',
            'Az elszámoltatásról és a vagyonvisszaszerzésről is ebben a keretben beszél: azt kifogásolja, ha a korábbi kormányzati időszakhoz kapcsolódó ügyekben a jogerős döntésekre hosszú éveket kell várni. A szerepe itt sem a nyomozóhatóságé — azt kérdezi, létrejönnek-e azok az intézményi feltételek, amelyek valóban képesek számon kérni a korábbi hatalom működését.',
          ],
          sources: [
            {
              source: 'Szeretlek Magyarország',
              headline: 'Puzsér Róbert nemcsak Orbán Viktort, Gyurcsány Ferencet is bíróság elé állítaná',
              url: 'https://www.szeretlekmagyarorszag.hu/szempont/puzser-robert-elszamoltatas-orban-gyurcsany-birosag/',
              lead: 'Az elszámoltatásról szóló álláspontja, amely nem áll meg az egyik politikai oldal határánál.',
            },
          ],
        },
        {
          heading: 'Miért van Puzsér Róbert a Dicsőségfalon?',
          paragraphs: [
            'Nem egyetlen feltárt korrupciós ügy miatt. Nem a klasszikus oknyomozó újságírói modell képviselője, és nem is politikus a hagyományos értelemben.',
            'A hozzájárulása más természetű: éveken keresztül következetesen azt a kérdést tette fel, mi történik az országgal akkor, ha a politikai hatalom leváltása nem jár együtt a hatalom működésének megváltoztatásával. A Sétáló Budapest konkrét civil-politikai kísérlet volt az átláthatóság és a számonkérhetőség hangsúlyozására, a Polgári Ellenállás a társadalmi részvételt és a politikai kontrollt helyezte középpontba, a Rendszerbontó Nagykoncert pedig ennek kulturális és közösségi mozgósítási oldalát erősítette.',
            'A helye tehát a civil kontroll, a rendszerkritikus nyilvánosság és a politikai kultúra kategóriájában értelmezhető. A története nem egyetlen ügy története, hanem annak a gondolatnak a története, hogy egy demokráciában nemcsak azt kell figyelni, ki kerül hatalomra, hanem azt is, hogy a társadalom milyen eszközökkel képes számon kérni azt, aki hatalomra került.',
          ],
        },
      ],
      faq: [
        {
          q: 'Miért van Puzsér Róbert a Dicsőségfalon?',
          a: 'Mert hosszú éveken keresztül foglalkozott a politikai hatalom társadalmi ellenőrzésének, az átláthatóságnak, a civil részvételnek és a kormányváltás–rendszerváltás különbségének kérdésével. A szerepe nem klasszikus oknyomozóként, hanem rendszerkritikus publicistaként és civil szervezőként értelmezhető.',
        },
        {
          q: 'Puzsér Róbert oknyomozó újságíró?',
          a: 'A klasszikus értelemben nem. Elsősorban publicista, kritikus és közéleti szereplő; nem konkrét korrupciós ügyek feltárására épülő újságírói életmű miatt szerepel a Dicsőségfalon.',
        },
        {
          q: 'Mi volt a Sétáló Budapest program?',
          a: 'Puzsér Róbert 2018-ban kidolgozott politikai-civil kezdeményezése a 2019-es budapesti főpolgármester-választásra. A program az átláthatóságot, a számonkérhetőséget és a pártpolitikától független civil részvételt is hangsúlyozta: a szervezeti fejezete teljes transzparenciát, a közbeszerzések alapelveinek tisztázását és nyitott döntés-előkészítést fogalmazott meg.',
        },
        {
          q: 'Mi a Polgári Ellenállás?',
          a: 'Puzsér Róbert által 2025-ben elindított civil mozgalom. A feladatát a társadalmi részvétel és a politikai hatalommal szembeni civil kontroll erősítésében határozta meg; nem pártként jött létre.',
        },
        {
          q: 'Puzsér Róbert politikus?',
          a: '2019-ben elindult Budapest főpolgármesteri posztjáért a Sétáló Budapest programmal és az Állampolgárok a centrumban Egyesület támogatásával, de a közéleti szerepe elsősorban publicistaként és civil-politikai szereplőként ismert. A Sétáló Budapest a saját programja szerint kifejezetten pártpolitikától független, civil alapokra épülő kísérletként határozta meg magát.',
        },
        {
          q: 'Mit mondott a kormányváltás és a rendszerváltás különbségéről?',
          a: 'Rendszeresen amellett érvelt, hogy egy kormány lecserélése önmagában nem feltétlenül jelenti az intézményi és politikai rendszer átalakítását. Szerinte a politikai hatalom ellenőrzéséhez a választásokon túl erős civil társadalomra, független intézményekre és társadalmi részvételre is szükség van.',
        },
        {
          q: 'Mi volt a szerepe a 2024-es kegyelmi ügyben?',
          a: 'Nem az ügy feltárója volt, hanem publicistaként kommentálta. A Spirit FM műsorában a kegyelmi ügyet a fennálló politikai rendszer szempontjából súlyos válságként értelmezte.',
        },
        {
          q: 'Mi volt a Rendszerbontó Nagykoncert?',
          a: 'A Polgári Ellenállás által 2026. április 10-én, a budapesti Hősök terén szervezett ingyenes rendezvény, a parlamenti választás előtt két nappal. Több mint negyven előadó lépett fel, egyenként egy rendszerkritikus dallal; Puzsér Róbert a szervezésben és a fellépők megkeresésében is szerepet vállalt.',
        },
        {
          q: 'Puzsér Róbert csak az Orbán-kormányt kritizálja?',
          a: 'Nem. Más ellenzéki politikai szereplőkkel és a Tisza Párttal kapcsolatban is fogalmazott meg kritikát. A saját érvelése szerint a kormányváltás támogatása nem jelenti azt, hogy a mindenkori új hatalom civil ellenőrzését fel kellene adni.',
        },
        {
          q: 'Mi a legfontosabb témája a rendszerváltással kapcsolatban?',
          a: 'Visszatérő témája, hogy a politikai hatalom leváltása mellett a hatalom ellenőrzésének intézményi és társadalmi feltételeit is meg kell teremteni. Ennek részeként rendszeresen beszél átláthatóságról, elszámoltathatóságról, civil társadalomról és a választásokon túli politikai részvételről.',
        },
      ],
      sources: [
        {
          source: 'Sétáló Budapest',
          headline: 'Sétáló Budapest — a 2019-es program teljes szövege',
          url: 'https://github.com/setalo-budapest/program',
        },
        {
          source: 'Magyar Hang',
          date: '2020. febr. 21.',
          headline: 'Kormányváltás vagy rendszerváltás?',
          url: 'https://hang.hu/publicisztika/kormanyvaltas-vagy-rendszervaltas-113446',
        },
        {
          source: 'Spirit FM',
          headline: 'Puzsér a kegyelmi ügyről: Hogy kell ezt megmagyarázni?',
          url: 'https://spiritfm.hu/cikk/puzser-a-kegyelmi-ugyrol-hogy-kell-ezt-megmagyarazni',
        },
        {
          source: 'Telex',
          date: '2025. jún. 20.',
          headline:
            'Puzsér Róbert: Az utolsó töltényig támogatni fogjuk a Tisza Pártot, hogy váltsa le az Orbán-rendszert',
          url: 'https://telex.hu/video/2025/06/20/puzser-robert-polgari-ellenallas-video-interju',
        },
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
    photo: '/images/rendszervaltas/carson-coma.webp',
    tagline:
      'Teltházas koncerteken mondták ki azt, amit a rádiós játszási listákért cserébe hallgatni illett volna — és vállalták a következményeit.',
    targetKeyword: { phrase: 'carson coma', volume: 9900, kd: 46 },
    section: {
      heading: 'Carson Coma — amikor a színpadról is kimondták',
      paragraphs: [
        'A magyar zenei életben évekig működött egy íratlan szabály: aki a nagy fesztiválokon és a közszolgálati rádióban is szeretne szerepelni, az a színpadról nem politizál. A Carson Coma ezt a szabályt szegte meg — a zenekar tagjai, köztük Fekete Giorgio, a koncertjeiken és a nyilvános szerepléseiken is beszéltek a sajtószabadság korlátozásáról.',
        'A kiállásnak ára volt: játszási listák, fellépési lehetőségek és nyilvános támadások formájában. A zenekar 2026 tavaszán a Rendszerbontó Nagykoncerten is fellépett, majd bejelentették, hogy egy időre szünetet tartanak a politizálásban.',
        'Ez a tétel szerkesztői döntés alapján került a Dicsőségfalra: SEO-szempontból a „Carson Coma" keresések gyakorlatilag teljes egészében zenei szándékúak (koncert, dalszövegek, tagok). Azért van itt, mert a közéleti kiállás egy olyan közönséghez jutott el, amelyet semmilyen oknyomozó cikk nem ért volna el.',
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
    photo: '/images/rendszervaltas/szel-bernadett.webp',
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
    photo: '/images/rendszervaltas/szabo-timea.webp',
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
    id: 'fekete-gyor-andras',
    name: 'Fekete-Győr András',
    kind: 'person',
    group: 'person',
    role: 'a Momentum alapítója, a NOlimpia arca',
    badge: 'NOLIMPIA',
    tagline:
      'Egy aláírásgyűjtéssel leállíttatta a budapesti olimpiai pályázatot, 2025-ben pedig ő javasolta elsőként, hogy a saját pártja ne induljon.',
    section: {
      heading: 'Fekete-Győr András — a NOlimpiától a visszalépés javaslatáig',
      paragraphs: [
        '2017 januárjában indította el a NOlimpia-aláírásgyűjtést a budapesti olimpiai pályázatról szóló népszavazásért. Egy hónap alatt 266 151 aláírás gyűlt össze, a népszavazáshoz szükséges 138 ezer közel kétszerese, és a kormány 2017. február 22-én visszavonta a pályázatot.',
        'A kampányból nőtt ki a Momentum Mozgalom, amelynek 2021 októberéig elnöke volt, 2022 és 2024 között pedig országgyűlési képviselője.',
        '2025 májusában, a párt elnökségi ülése előtt nyilvánosan javasolta, hogy a Momentum ne induljon a 2026-os választáson, mert a 2–4 százalékos támogatottsága éppen elég ahhoz, hogy szétforgácsolja a kormányváltó szavazatokat. „Szeretnék a tükörbe nézni ’26 után is” — mondta az ATV-nek. Egy hónappal később a párt küldöttgyűlése így döntött.',
      ],
      links: [
        {
          text: '„Szeretnék a tükörbe nézni ’26 után is”',
          href: 'https://www.atv.hu/belfold/20250508/fekete-gyor-andras-momentum-2026/',
          external: true,
        },
      ],
    },
    updatedAt: '2026-09-25',
  },
  {
    id: 'tompos-marton',
    name: 'Tompos Márton',
    kind: 'person',
    group: 'person',
    role: 'volt képviselő, a Momentum volt elnöke',
    badge: 'ORBÁNÉK',
    tagline:
      'Tízrészes videósorozatban rakta össze, hogyan épült fel az Orbán-család cégbirodalma — a választás előtti évben, közérthetően.',
    section: {
      heading: 'Tompos Márton — az Orbánék-sorozat',
      paragraphs: [
        'Tompos Márton 2022 és 2026 között országgyűlési képviselő volt, 2020 októberétől a Momentum KorrupcióVadász munkacsoportját vezette, 2024 júliusától 2025 augusztusáig pedig a párt elnöke volt.',
        'A legtöbbet hivatkozott munkája az Orbánék című YouTube-sorozat: 2025 januárja és májusa között tíz epizódban vette végig a miniszterelnök közvetlen családjának vagyonosodását — Tiborcz István első milliárdjaitól és a BDPST Group terjeszkedésétől az Orbán Ráhel-féle turisztikai üzleten át az apa bányacégeiig és a testvérek vállalkozásaiig. Az epizódok egyenként 20–58 ezer megtekintést értek el.',
        'Az általa elnökként vezetett párt 2025 júniusában döntött úgy, hogy nem indul a 2026-os választáson.',
      ],
      links: [
        {
          text: 'Orbánék',
          href: 'https://www.youtube.com/playlist?list=PLo6_mFiNzuy_lFgRtMJ_uoh9-_uFLSYNg',
          external: true,
        },
      ],
      video: {
        id: 'U8n0L5e2iMk',
        label: 'Tompos Márton · 2025. január 21.',
        title: 'Az Orbán-család szabadrablása: A BDPST Group története — Orbánék #2',
        summary:
          'A sorozat második része Tiborcz István BDPST Groupjának felépülését követi végig, a szállodáktól az ingatlanfejlesztésekig.',
      },
    },
    related: [{ label: 'Podcastok és videók', href: '/podcastok' }],
    updatedAt: '2026-09-25',
  },
  {
    id: 'momentum',
    name: 'Momentum',
    kind: 'org',
    group: 'media',
    role: 'párt, a NOlimpia-kampányból alakult',
    badge: 'VISSZALÉPETT',
    tagline:
      'Parlamenti pártként mondott le arról, hogy induljon a 2026-os választáson, hogy ne forgácsolja szét a kormányváltó szavazatokat.',
    // A szöveg a user kánonja (2026-09-25) — tartalmilag ne írd át. Egyetlen
    // eltérés: a DK/MKKP listás eredménye a VÉGLEGES számokra javítva (1,10 /
    // 0,82 %; Telex 2026-04-18 + NVI-szavazatszámok), a beküldött 1,14 / 0,81
    // előzetes adat volt. A „**" kiemelések nem renderelhetők, kimaradtak.
    section: {
      heading: 'Momentum — amikor egy párt a saját indulásáról is lemondott a kormányváltásért',
      paragraphs: [
        'A Momentum története különleges helyet foglal el a rendszerváltás utáni magyar politika történetében. Egy olyan politikai mozgalomról van szó, amely a NOlimpia kampánnyal robbant be a közéletbe, néhány év alatt parlamenti párttá vált, majd 2025-ben egy olyan döntést hozott, amelyre kevés példa akad a magyar pártpolitikában: lemondott a 2026-os országgyűlési választáson való indulásról.',
        'A döntés mögött nem az állt, hogy a Momentum ne rendelkezett volna parlamenti tapasztalattal vagy politikai infrastruktúrával. Éppen ellenkezőleg. A Momentum 2022-ben tíz képviselővel jutott be az Országgyűlésbe, és ezzel önálló parlamenti frakciót alakíthatott.',
        '2025-ben mégis azt választotta, hogy nem indít saját országos listát és egyéni jelölteket a 2026-os választáson.',
        'A párt indoklása szerint azért, mert az önálló indulás a NER választási rendszerében megosztaná az ellenzéki szavazatokat, és ezzel nehezítené a kormányváltást. A Momentum Küldöttgyűlése 2025. június 7-én döntött a távolmaradásról.',
        'A Dicsőségfal szempontjából éppen ez teszi érdekessé a Momentum történetét: egy párt, amelynek volt parlamenti jelenléte, saját politikai érdekeit és a következő választáson megszerezhető mandátumokat is háttérbe szorította egy általa fontosabbnak tartott politikai cél érdekében.',
      ],
      links: [
        {
          text: 'A Momentum Küldöttgyűlése 2025. június 7-én döntött a távolmaradásról',
          href: 'https://telex.hu/belfold/2025/06/07/momentum-kuldottgyules-valasztas-2026',
          external: true,
        },
      ],
    },
    related: [
      { label: 'Dicsőségfal', href: '/rendszervaltas' },
      { label: 'Kiemelt ügyek', href: '/ugyek' },
    ],
    updatedAt: '2026-09-25',
    live: true,
    detail: {
      seoTitle: 'Momentum: a NOlimpia és a 2026-os visszalépés — Dicsőségfal',
      seoDescription:
        'Miért van a Momentum a Dicsőségfalon? A 266 151 aláírásos NOlimpia-kampány, és a döntés, hogy parlamenti pártként nem indult a 2026-os választáson a kormányváltásért — forrásokkal.',
      extra: [
        {
          heading: 'A Momentum nem egyszerűen nem indult – volt miről lemondania',
          paragraphs: [
            'Fontos különbséget tenni aközött, hogy egy párt nem képes bejutni a parlamentbe, és aközött, hogy egy parlamenti párt tudatosan lemond az indulásról.',
            'A Momentum 2022-ben tíz képviselővel jutott be az Országgyűlésbe. Ez azt jelentette, hogy a pártnak valódi parlamenti frakciója, képviselői, állami támogatása és országos politikai infrastruktúrája volt.',
            'A tízfős frakció nagysága önmagában is jól mutatja, hogy a Momentum nem egy jelentéktelen parlamenti szereplő volt: a 2022-es Momentum-frakció nagyobb volt, mint a Mi Hazánk 2026-ban megszerzett hatmandátumos parlamenti képviselete.',
            'Vagyis amikor a Momentum 2025-ben úgy döntött, hogy nem indul a következő országgyűlési választáson, nem egy olyan párt hozott áldozatot, amelynek egyébként sem lett volna reális parlamenti jelenléte.',
            'Egy korábban tízfős frakcióval rendelkező párt mondott le arról a lehetőségről, hogy megpróbálja megőrizni parlamenti képviseletét.',
            'A Momentum saját bemutatkozása szerint a párt azért nem indult 2026-ban, hogy „ne osszuk meg az ellenzéki szavazatokat”, és ezzel segítsék a kormányváltást.',
            'Ez a döntés politikai szempontból természetesen vitatható. Lehet érvelni mellette és ellene is.',
            'A Dicsőségfal szempontjából azonban éppen a döntés ténye az érdekes: a Momentum a saját parlamenti jelenlétének megőrzését nem tekintette minden más szempontnál fontosabbnak.',
          ],
          links: [
            { text: 'saját bemutatkozása', href: 'https://momentum.hu/a-momentumrol/', external: true },
          ],
        },
        {
          heading: 'A Momentum volt az első parlamenti párt, amely hátralépett',
          paragraphs: [
            'A történeti pontosság kedvéért érdemes hozzátenni, hogy a Momentum nem az első magyar politikai szervezet volt, amely a 2026-os választástól való távolmaradás mellett döntött.',
            'A Momentum jelentősége abban áll, hogy elsőként a parlamenti pártok közül választotta ezt az utat.',
            'A döntés 2025. június 7-én született meg, amikor a Momentum Küldöttgyűlése kimondta, hogy a párt nem indul a 2026-os országgyűlési választáson. A Momentum hivatalos indoklása szerint ezzel a kormányváltás elősegítéséhez kívánt hozzájárulni.',
            'Ez azért volt különösen jelentős, mert a párt számára az önálló indulás egyáltalán nem lett volna szokatlan vagy lehetetlen.',
            'A Momentum 2022-ben már bizonyította, hogy képes parlamenti pártként működni.',
            '2025-ben azonban a párt vezetése arra jutott, hogy a saját jelöltek indítása többet árthat a kormányváltás esélyének, mint amennyit a Momentum önálló parlamenti jelenléte jelentene.',
            'Ezt követően a Momentum nem saját választási kampányt épített fel, hanem a kormányváltás támogatását helyezte előtérbe.',
          ],
          sources: [
            { source: 'Telex', date: '2025. jún. 7.', headline: 'Nem indul a Momentum a 2026-os országgyűlési választáson', url: 'https://telex.hu/belfold/2025/06/07/momentum-kuldottgyules-valasztas-2026' },
            { source: 'Népszava', headline: 'Nem indul a 2026-os parlamenti választáson a Momentum Mozgalom', url: 'https://nepszava.hu/3282808_momentum-mozgalom-2026-parlamenti-valasztas-nem-indul' },
          ],
        },
        {
          heading: 'Fekete-Győr András: a saját indulásról is lemondott',
          paragraphs: [
            'A döntés egyik legfontosabb előzménye Fekete-Győr András kezdeményezése volt.',
            'A Momentum alapítója és korábbi elnöke már 2025 tavaszán amellett érvelt, hogy a pártnak nem kellene elindulnia a 2026-os országgyűlési választáson.',
            'Ez azért is fontos, mert Fekete-Győr nem egy kívülállóként tett javaslatot.',
            'Ő volt a Momentum egyik alapítója, a párt első elnöke, a NOlimpia kampányának egyik legismertebb arca, később pedig országgyűlési képviselő.',
            'A Momentum döntése ezért számára személyesen is azt jelentette, hogy saját politikai karrierjének következő parlamenti állomásáról mond le.',
            'Nem arról volt szó, hogy egy politikus elveszített egy választást.',
            'Hanem arról, hogy a saját pártja által választott stratégia miatt eleve nem indult el azon.',
            'Fekete-Győr esetében ez különösen szimbolikus, hiszen a Momentum történetének két meghatározó pontján is jelen volt: a párt politikai megszületését jelentő NOlimpia-kampánynál, majd a párt 2026-os választási visszalépésének folyamatánál.',
          ],
          sources: [
            { source: 'ATV', date: '2025. máj. 8.', headline: 'Fekete-Győr András: Szeretnék a tükörbe nézni 2026 után is', url: 'https://www.atv.hu/belfold/20250508/fekete-gyor-andras-momentum-2026/' },
          ],
        },
        {
          heading: 'Tompos Márton: a Momentum elnökeként vitte végig a döntést',
          paragraphs: [
            'A másik meghatározó név Tompos Márton.',
            'Tompos Márton a Momentum elnökeként vett részt abban a folyamatban, amelynek végén a párt lemondott az önálló választási indulásról.',
            'Ez azért lényeges, mert a Momentumon belül korábban komoly vita volt arról, hogy a párt induljon-e saját jelöltekkel.',
            'A döntés tehát nem egy automatikus, konfliktusmentes folyamat eredménye volt.',
            'A Momentum végül meghozta a döntést, és Tompos Márton elnökként képviselte azt.',
            'A későbbi elnöki lemondása után sem úgy beszélt a történtekről, mintha a választási indulás elmaradása önmagában politikai kudarc lenne. A Momentum történetében ezzel egy olyan időszak zárult le, amelyben a párt saját parlamenti jelenlétének fenntartása helyett egy szélesebb kormányváltási cél mögé állt.',
            'Fekete-Győr és Tompos története ezért különösen fontos a Momentum Dicsőségfal-oldalán: mindketten a Momentum vezető politikusaként vállalták azt a politikai stratégiát, amelynek következménye az lett, hogy a párt és saját maguk sem indultak el a 2026-os országgyűlési választáson.',
          ],
          sources: [
            { source: 'Telex', date: '2025. máj. 7.', headline: 'A Momentum elnöke szerint Fekete-Győr lájkokra vált egy belső dilemmát', url: 'https://telex.hu/belfold/2025/05/07/tompos-marton-fekete-gyor-andras-momentum-valasztas' },
          ],
        },
        {
          heading: 'A Momentum és a Tisza Párt',
          paragraphs: [
            'A Momentum 2026-os döntésének értelmezéséhez megkerülhetetlen a Tisza Párt megjelenése.',
            'A Momentum nem azért mondott le az indulásról, mert minden politikai kérdésben azonos álláspontra került volna a Tiszával.',
            'A párt saját politikai identitását továbbra is fenntartotta.',
            'A döntés lényege az volt, hogy a kormányváltást fontosabb stratégiai célnak tekintette, mint a saját parlamenti jelenlétének megőrzését.',
            'Ez egy fontos különbség.',
            'A Momentum nem azt állította, hogy a Tisza minden kérdésben ugyanazt képviseli, mint ő.',
            'Azt állította, hogy a 2026-os választás legfontosabb politikai kérdésében – a kormányváltásban – nem akarja saját jelöltekkel megosztani azokat a választókat, akik változást szeretnének.',
            'A párt hivatalos álláspontja szerint a 2026-os választáson ezért nem indult, hanem a kormányváltás elősegítésére koncentrált.',
          ],
        },
        {
          heading: 'A Momentum és a többi ellenzéki párt közötti különbség',
          paragraphs: [
            'A 2026-os választás után különösen látványossá vált a Momentum döntésének sajátossága.',
            'A Demokratikus Koalíció és a Magyar Kétfarkú Kutya Párt is elindult a választáson.',
            'A Momentum nem.',
            'A végeredmény alapján a három párt közül a Momentum nem kapott listás szavazatot, hiszen nem indult, a DK 1,10 százalékot, az MKKP pedig 0,82 százalékot szerzett.',
            'Vagyis azt sem lenne pontos állítani, hogy „mindhárman 1 százalék alatt maradtak”.',
            'A DK valamivel átlépte az 1 százalékot.',
            'Az MKKP viszont nem érte el.',
            'És ennek az MKKP számára nagyon konkrét pénzügyi következménye lett.',
          ],
          sources: [
            { source: 'Telex', date: '2026. ápr. 18.', headline: 'Itt a választás eredménye: a Tisza még több mandátumot szerzett, a Fidesz veresége még nagyobb', url: 'https://telex.hu/belfold/2026/04/18/valasztas-vegeredmeny-mandatumok-tisza-fidesz-mi-hazank' },
          ],
        },
        {
          heading: 'Az MKKP 686 milliós tartozása',
          paragraphs: [
            'A választási kampányok állami finanszírozásának szabályai miatt az MKKP-nak vissza kell fizetnie a kampányra kapott állami támogatást, miután országos listája nem érte el az 1 százalékot.',
            'A visszafizetendő összeg 686 millió forint.',
            'A párt ezért a választás után adománygyűjtést indított, hogy előteremtse az összeget.',
            'A gyűjtés azonban a nyár folyamán gyakorlatilag lelassult.',
            'A 2026. szeptember 22-én megjelent 24.hu-beszámoló szerint az MKKP addig mindössze 155,6 millió forintot tudott összegyűjteni a 686 millióból. Ez azt jelenti, hogy még körülbelül 530 millió forint hiányzott. A lap szerint május végén már 150 millió forintnál jártak, vagyis csak 5,6 millió forinttal sikerült növelniük az összeget a következő csaknem négy hónapban.',
            'Más friss beszámolók szintén arról számoltak be, hogy az adománygyűjtés a nyár folyamán megtorpant, miközben a pártnak továbbra is jelentős visszafizetési kötelezettsége maradt.',
            'Ez egy nagyon érdekes kontraszt a Momentum 2026-os döntésével.',
            'Az MKKP elindult.',
            'A Momentum nem indult.',
            'Az MKKP kampányolt és felvette a kampánytámogatást, majd az 1 százalékos küszöb el nem érése miatt jelentős összeget kell visszafizetnie.',
            'A Momentum ezzel szemben nem állított országos listát és nem indított saját parlamenti választási kampányt.',
            'Ez természetesen nem jelenti azt, hogy az MKKP döntése önmagában helytelen lett volna. A pártok saját politikai stratégiájuk alapján döntenek arról, hogy indulnak-e.',
            'A különbség azonban jól látható:',
            'a Momentum a saját parlamenti jelenlétének lehetőségét is feladta, miközben az MKKP a saját indulását választotta.',
          ],
          links: [
            { text: '24.hu-beszámoló', href: 'https://24.hu/belfold/2026/09/22/ketfarku-kutyapart-tartozas-mak-nav-valasztas-kampany-mkkp/', external: true },
          ],
          sources: [
            { source: '24.hu', date: '2026. szept. 22.', headline: 'Bajban a Kutya Párt: befulladt a gyűjtés, óriási a tartozás', url: 'https://24.hu/belfold/2026/09/22/ketfarku-kutyapart-tartozas-mak-nav-valasztas-kampany-mkkp/' },
            { source: 'ATV', date: '2026. szept. 22.', headline: 'Kutyaszorítóban a Kutya Párt: befuccsolt a gyűjtés, rászabadulhat a NAV a jelöltek magánvagyonára is', url: 'https://www.atv.hu/belfold/20260922/kutya-part-gyujtes-tartozas' },
            { source: 'Economx', date: '2026. szept. 22.', headline: 'Nagy bajban a Kutyapárt: 686 millióval tartoznak az államnak, ennek töredékét tudták csak összekaparni', url: 'https://www.economx.hu/belfold/2026/09/22/kutyapart-adossag-tamogatasok/' },
          ],
        },
        {
          heading: 'A NOlimpia – ahol a Momentum története igazán elkezdődött',
          paragraphs: [
            'Ha a Momentum történetének egyetlen olyan eseményét kellene megnevezni, amely nélkül a párt mai politikai identitása aligha érthető meg, az a NOlimpia.',
            '2017-ben a még fiatal Momentum Mozgalom népszavazási kezdeményezést indított Budapest 2024-es olimpiai pályázatáról.',
            'A cél az volt, hogy a budapestiek dönthessenek arról, szeretnék-e, hogy a főváros rendezze meg az olimpiai játékokat.',
            'A kezdeményezéshez szükséges aláírások összegyűjtése óriási szervezési feladat volt.',
            'A Momentum végül 266 151 aláírást adott le.',
            'A népszavazás kiírásához 138 ezer érvényes aláírásra lett volna szükség. Az RTL korabeli beszámolója szerint a Momentum tehát jelentősen túlteljesítette a szükséges mennyiséget.',
            'Ez volt az a pillanat, amikor a Momentum országosan is megkerülhetetlen politikai szereplővé vált.',
            'A NOlimpia nélkül a Momentum valószínűleg teljesen más politikai pályán indult volna el.',
          ],
          links: [
            { text: 'Az RTL korabeli beszámolója', href: 'https://rtl.hu/hirado/2017/02/17/266-151-alairas-gyult-ossze', external: true },
          ],
        },
        {
          heading: '266 151 aláírás',
          paragraphs: [
            'A szám önmagában is fontos.',
            '266 151.',
            'Ennyi aláírást gyűjtött össze a Momentum az olimpiai népszavazás kezdeményezéséhez.',
            'A párt akkor még nem rendelkezett a későbbi parlamenti infrastruktúrával, nem volt ismert, régi politikai szereplő, és nem volt mögötte évtizedes pártszervezet.',
            'A NOlimpia kampány viszont megmutatta, hogy egy új politikai közösség képes lehet rövid idő alatt jelentős társadalmi mobilizációra.',
            'Az RTL akkori beszámolója szerint a Momentum 266 ezer aláírást gyűjtött, miközben a népszavazáshoz 138 ezer érvényes aláírásra lett volna szükség.',
          ],
          sources: [
            { source: 'RTL', date: '2017. febr. 17.', headline: '266.151 aláírás gyűlt össze', url: 'https://rtl.hu/hirado/2017/02/17/266-151-alairas-gyult-ossze' },
          ],
        },
        {
          heading: 'Miért volt fontos a NOlimpia gazdasági szempontból?',
          paragraphs: [
            'A NOlimpia nem pusztán arról szólt, hogy valaki szereti-e az olimpiai játékokat.',
            'A vita egyik központi kérdése az volt, hogy mennyibe kerülne Budapestnek és Magyarországnak az olimpia megrendezése.',
            'A hivatalos Budapest 2024 megvalósíthatósági tanulmány jelentős, több százmilliárdos nettó költséggel számolt, a teljes bruttó költség pedig meghaladta az ezer milliárd forintot.',
            'A Momentum ennél magasabb tényleges költséggel számolt, és arra hívta fel a figyelmet, hogy az olimpiai beruházásoknál komoly kockázatot jelenthetnek a költségtúllépések.',
            'A későbbi történelmi értékelésben azonban érdemes elkerülni azt az állítást, hogy a Momentum „megakadályozta az államcsődöt”.',
            'Ezt ugyanis nem lehet bizonyítani.',
            'Budapest nem rendezett olimpiát, ezért nem létezik olyan tényleges költségvetési adat, amelyből megállapíthatnánk, mi történt volna az olimpia megrendezése esetén.',
            'Ami viszont bizonyítható, az az, hogy a Momentum a NOlimpia kampánnyal kikényszerítette az olimpiai pályázat társadalmi és pénzügyi kockázatainak széles körű politikai vitáját, majd 266 151 aláírást gyűjtött össze.',
            'Ez már önmagában is jelentős politikai teljesítmény volt.',
          ],
          sources: [
            { source: '444', date: '2015. jún. 23.', headline: '12 egészen meglepő állítás a budapesti olimpiát megalapozó tanulmányból', url: 'https://444.hu/2015/06/23/10-meglepo-allitas-a-budapesti-olimpiat-megalapozo-tanulmanybol' },
          ],
        },
        {
          heading: 'Videó: a NOlimpia története',
          paragraphs: [
            'Az RTL Híradó korabeli anyaga közvetlenül a 266 151 aláírásról szól. Nem utólagos politikai összefoglalóról van szó: közvetlenül akkor készült, amikor a Momentum leadta a több mint 266 ezer aláírást.',
            'Van egy másik, szintén RTL-es anyag, amely a NOlimpia történetét később, 2022-ben foglalta össze.',
            'Az RTL-anyagok az RTL oldalán nézhetők meg. Alább a leadás napjának euronews-felvétele és a Momentum saját kampányvideója látható.',
          ],
          links: [
            { text: 'Az RTL Híradó korabeli anyaga', href: 'https://rtl.hu/hirado/2017/02/17/266-151-alairas-gyult-ossze', external: true },
            { text: 'szintén RTL-es anyag', href: 'https://rtl.hu/valasztas-2022/2022/03/23/fidesz-2017-olimpia-nepszavazas-ceu-civil-szervezetek', external: true },
          ],
          videos: [
            {
              id: 'Tir1iXstaBk',
              label: 'euronews (magyarul) · 2017. február 17.',
              title: 'Aláírásgyűjtés az olimpiáról: „nem szabad félni!”',
              summary: 'A leadás napja: bejelentik, hogy több mint 266 ezer aláírás gyűlt össze az olimpiai népszavazás kiírásáért.',
            },
            {
              id: 'cKbxOsVwh3c',
              label: 'Momentum Mozgalom · 2017. január 19.',
              title: 'A NOlimpia-kampány',
              summary: 'A Momentum saját kampányvideója az aláírásgyűjtés indulásának napjáról: miért ne legyen olimpia Budapesten.',
            },
          ],
          sources: [
            { source: 'RTL', date: '2017. febr. 17.', headline: '266.151 aláírás gyűlt össze', url: 'https://rtl.hu/hirado/2017/02/17/266-151-alairas-gyult-ossze' },
            { source: 'RTL', date: '2022. márc. 23.', headline: '12 év Fidesz, 8. rész: Nemzeti konzultáció a „sátáni” Soros-tervről, a CEU kiszorítása és Nolimpia Budapesten', url: 'https://rtl.hu/valasztas-2022/2022/03/23/fidesz-2017-olimpia-nepszavazas-ceu-civil-szervezetek' },
          ],
        },
        {
          heading: 'A Momentum történetének két fontos döntése',
          paragraphs: [
            'A Momentum történetében két esemény különösen jól megmutatja a párt politikai karakterét.',
            'Az első a NOlimpia.',
            '2017-ben egy akkor még új politikai mozgalom nem elégedett meg azzal, hogy kommentálja a kormány olimpiai terveit. Aláírásokat kezdett gyűjteni, és több mint 266 ezer aláírást adott le.',
            'A második a 2026-os választás.',
            '2025-ben a Momentum nem egyszerűen megpróbált bejutni a parlamentbe, majd elvesztette a választást.',
            'A Momentum úgy döntött, hogy nem indul.',
            'Egy tízfős korábbi parlamenti frakcióval rendelkező párt mondott le arról, hogy megpróbálja megőrizni parlamenti jelenlétét.',
            'A párt hivatalos álláspontja szerint azért, hogy ne ossza meg az ellenzéki szavazatokat, és ezzel hozzájáruljon a kormányváltáshoz.',
            'Ez a két esemény időben kilenc évre van egymástól.',
            'Mégis van közöttük egy közös elem.',
            'Mindkettőben az történt, hogy a Momentum egy politikai cél érdekében vállalt jelentős kockázatot.',
            '2017-ben egy új mozgalom kockára tette politikai jövőjét egy olyan kampánnyal, amely az olimpiai pályázat visszavonását célozta.',
            '2025-ben pedig egy már parlamenti párt vállalta annak kockázatát, hogy saját maga nem lesz jelen a következő Országgyűlésben.',
          ],
        },
        {
          heading: 'Miért kerül a Momentum a Dicsőségfalra?',
          paragraphs: [
            'A Dicsőségfalra kerülés nem azt jelenti, hogy egy politikai párt minden döntése helyes volt, minden politikusa hibátlan volt, vagy hogy minden politikai álláspontjával egyet kell érteni.',
            'A Momentum esetében a Dicsőségfal szempontjából két konkrét döntés emelkedik ki.',
            'Az egyik a NOlimpia.',
            'Egy új politikai közösség több mint 266 ezer aláírást gyűjtött össze azért, hogy népszavazás dönthessen Budapest olimpiai pályázatáról.',
            'A másik a 2026-os választási visszalépés.',
            'Egy korábban tízfős parlamenti frakcióval rendelkező párt úgy döntött, hogy nem indul el a következő országgyűlési választáson, mert saját értékelése szerint ezzel segítheti a kormányváltást.',
            'Fekete-Győr András a párt egyik meghatározó alapítójaként és korábbi vezetőjeként a visszalépés gondolatának egyik kezdeményezője volt.',
            'Tompos Márton a Momentum elnökeként képviselte és vitte tovább a párt döntését.',
            'A Momentum pedig ezt követően nem egyszerűen eltűnt a választási térképről: a párt saját beszámolója szerint a rendelkezésére álló időszakban a kormányváltás elősegítésére koncentrált.',
            'Lehet vitatkozni arról, hogy ez volt-e a megfelelő stratégia.',
            'A Dicsőségfal szempontjából azonban a Momentum történetének ez a része azért érdekes, mert egy politikai párt nem mindenáron a saját mandátumát választotta.',
            'És ez ritka dolog a politikában.',
            'A Momentum történetének egyik legfontosabb üzenete ezért nem az, hogy mindig neki kell nyernie.',
            'Hanem az, hogy egy politikai közösségnek néha azt is tudnia kell mondani:',
            '„Most nem mi indulunk.”',
            'És ha ezt kimondja, akkor a saját politikai érdeke ellenére is végig kell vinnie a döntést.',
            'A NOlimpia és a 2026-os választási visszalépés között kilenc év telt el.',
            'Az egyik egy új párt megszületésének története.',
            'A másik egy parlamenti párt önkéntes hátralépésének története.',
            'Ezért van helye a Momentumnak a Dicsőségfalon.',
          ],
          links: [
            { text: 'a párt saját beszámolója szerint', href: 'https://momentum.hu/a-momentumrol/', external: true },
          ],
        },
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
    photo: '/images/rendszervaltas/panyi-szabolcs.webp',
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
    photo: '/images/rendszervaltas/kunetz-zsombor.webp',
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
    photo: '/images/rendszervaltas/racz-andras.webp',
    tagline:
      'Elmagyarázta, mi a különbség a diplomáciai gesztus és a befolyásszerzés között — és hogy mikor melyikről volt szó.',
    section: {
      heading: 'Rácz András — a külpolitikai szál értelmezése',
      paragraphs: [
        'Rácz András biztonságpolitikai kutatóként az orosz külpolitikával, a hibrid befolyásszerzés eszközeivel és a közép-európai biztonsági környezettel foglalkozik. A szerepe ezen a Dicsőségfalon nem a dokumentumok kiásása, hanem az értelmezés — ami egy ilyen ügyben nem másodlagos munka.',
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
    photo: '/images/rendszervaltas/kontroll.webp',
    photoFit: 'contain',
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
    photo: '/images/rendszervaltas/gulyasagyu-media.webp',
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
          'Ez a Dicsőségfal legjobb példája arra, mire jó a puszta jelenlét egy helyszínen. Nem adatbázist fésültek át, nem pereskedtek: kimentek, és felvették, ami ott van. A következmények viszont évekig gyűrűztek.',
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
                label: 'Kontroll • Gulyáságyú · 2025. augusztus 25.',
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
              'Fontos pontosítás, és a Kegyencjárat nem is állít mást: magát a kegyelmi botrányt nem a Gulyáságyú robbantotta ki — azt a Vidéki Prókátor, akinek szintén van profilja ezen a Dicsőségfalon. Ez viszont már valódi, saját információval kiegészített feltárás volt, amely a történet egy addig ismeretlen szálát nyitotta meg.',
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
    photo: '/images/rendszervaltas/ahang.webp',
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
    photo: '/images/rendszervaltas/de-akciokozosseg.webp',
    photoFit: 'contain',
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
    photo: '/images/rendszervaltas/pottyondy-edina.webp',
    tagline:
      'Heti rendszerességgel foglalta össze, mi történt — olyan formában, amit végignézés után tényleg meg lehetett jegyezni.',
    section: {
      heading: 'Pottyondy Edina — a heti adag, amit végig lehet nézni',
      paragraphs: [
        'Pottyondy Edina saját videós csatornáján dolgozza fel a hét közéleti eseményeit, éles, szatirikus hangvételben. A műfaj lebecsülése tipikus hiba: a rendszeresség és a nézhetőség önmagában is funkció.',
        'A feltáró újságírás legnagyobb gyengesége, hogy a legalaposabb anyagot is kevesen olvassák végig. Egy heti, követhető formátum ezt oldja meg — nem helyettesíti a mélyfúrást, hanem eljuttatja azokhoz, akik különben sosem találkoznának vele.',
      ],
    },
    related: [
      { label: 'Videóriportok és podcastok', href: '/podcastok' },
      { label: 'Dicsőségfal', href: '/rendszervaltas' },
    ],
    updatedAt: '2026-09-24',
    live: true,
    detail: {
      seoTitle: 'Pottyondy Edina: videók, influenszertüntetés, könyv',
      seoDescription:
        'Ki Pottyondy Edina? A YouTube-csatorna, a legnézettebb közéleti videói, a 2024-es Hősök téri influenszertüntetés, a Démonok és hormonok és a Közösségi irányelvek megsértése — forrásokkal.',
      lead:
        'Pottyondy Edina a magyar közélet egyik legismertebb online véleményformálója: YouTuber, stand-up előadó és szerző. A Dicsőségfalon nem a követőszáma miatt van, hanem azért, mert a közéleti témákat olyan közönséghez is eljuttatja, amely nem a hagyományos híroldalakon keresztül követi a politikát — 2024-ben pedig ő volt az egyik szervezője annak a Hősök téri influenszertüntetésnek, amely több tízezer embert mozgatott meg.',
      cases: {
        heading: 'A legfontosabb állomások',
        intro:
          'A tevékenysége négy területre bontható: közéleti videók, élő előadások, könyv, valamint közösségszervezés és közvetlen közéleti szerepvállalás. A közös pont, hogy ugyanaz a téma több formában is eljut ugyanahhoz a közönséghez — videóban, közösségi médiában, színpadon és könyvben is.',
        items: [
          {
            title: 'A YouTube-csatorna — közélet, politika és szatíra',
            when: '2013-tól',
            links: [{ text: 'YouTube-csatornája', href: 'https://www.youtube.com/@pottyondyedina', external: true }],
            body:
              'A YouTube-csatornája 2013-ban indult, és ma nagyjából 377 ezer feliratkozónál tart. A videók témája széles, de a közös pont a magyar közélet: politikusok, kormányzati kommunikáció, propaganda, közéleti botrányok és ismert közszereplők. A formátum nem klasszikus politikai elemzés — a humor, a szatíra, az irónia és a személyes vélemény ugyanolyan fontos benne, mint a tárgyalt ügy.',
            more: [
              'A feltáró újságírás legnagyobb gyengesége, hogy a legalaposabb anyagot is kevesen olvassák végig. Egy követhető, nézhető formátum ezt oldja meg: nem helyettesíti a mélyfúrást, hanem eljuttatja azokhoz, akik különben sosem találkoznának vele. Ennek a mércéje a nézettség — a legnagyobbat futott videói egyenként közel egymillió megtekintésnél járnak.',
              'A forma működésének két összetevője van. Az egyik a rendszeresség: a néző tudja, hogy lesz következő adás, és nem egyetlen botrány idejére kapcsolódik be. A másik a nézőpont — a videók nem a politikai szereplők belső logikáját magyarázzák, hanem azt kérdezik, hogy ez az egész kívülről nézve mennyire abszurd. Ez a nézőpont a szatíra alapja, és egyben az oka annak, hogy olyanokhoz is eljut, akik politikai elemzést soha nem néznének meg.',
              'A műfaj lebecsülése tipikus hiba. Egy csatornát, amelynek a legnézettebb darabjai egyenként annyi embert érnek el, mint egy országos napilap havi olvasótábora, nem a formátuma alapján érdemes megítélni, hanem aszerint, hogy mit tesz azzal az elérésssel.',
            ],
          },
          {
            title: 'A Magyar Péter-jelenség feldolgozása',
            when: '2024. március',
            body:
              'A csatorna legnézettebb anyagai közül kettő is ahhoz az időszakhoz kötődik, amikor Magyar Péter politikai szereplőként néhány hét alatt a közélet központi témája lett. Előbb a jelenség értelmezése érkezett, néhány nappal később pedig a következő fejlemények feldolgozása — jól látszik rajtuk, hogyan reagál egy ilyen csatorna egy gyorsan változó politikai helyzetre.',
            more: [
              'A két videó között egyetlen hét telt el, a nézettségük mégis háromszoros különbséget mutat. Ez önmagában is adat arról, milyen tempóban gyorsult fel akkoriban a közéleti érdeklődés: ugyanaz a csatorna, ugyanaz a téma, egy héttel később négyszázezerrel több néző.',
              'A Dicsőségfal szempontjából nem az a lényeg, hogy egyetért-e valaki a videók értékelésével. Az a lényeg, hogy egy politikai fordulat első heteiben több százezer ember ezeken a csatornákon keresztül tájékozódott — nem a pártok kommunikációjából és nem is a közmédiából.',
            ],
            videos: [
              {
                id: '5iQGujvf0ug',
                label: 'Pottyondy Edina · 2024. márc. 19.',
                title: 'A Magyar Péter jelenség',
                summary: 'Az első feldolgozás a politikai színrelépésről.',
                views: '678 ezer megtekintés',
              },
              {
                id: '12JY1P1PUHA',
                label: 'Pottyondy Edina · 2024. márc. 26.',
                title: 'Magyar Péter ledobta 💣🖤',
                summary: 'A csatorna legnézettebb videója, egy héttel az előző után.',
                views: '1,1 millió megtekintés',
              },
            ],
          },
          {
            title: 'Bulvár és NER — a visszatérő módszer',
            when: '2023–2024',
            body:
              'A csatorna egyik állandó fogása, hogy ismert celeb- és bulvárszereplők történeteit kapcsolja össze a politikai és gazdasági elit világával, majd szatirikus keretben dolgozza fel. Két ilyen videó is a legnézettebbek között van — mindkettő 950 ezer fölött.',
            videos: [
              {
                id: 'S0am-J4kagU',
                label: 'Pottyondy Edina · 2023. aug. 13.',
                title: 'Tóth Gabi válik, Lölőné kávézik. Asszonysorsok a NER-ben.',
                summary: 'A bulvár és a hatalmi elit világának összekapcsolása.',
                views: '983 ezer megtekintés',
              },
              {
                id: 'e7lGjqcuGzA',
                label: 'Pottyondy Edina · 2024. szept. 8.',
                title: 'A sztárpap kettős élete: Bese atya tündöklése és bukása',
                summary:
                  'Egy konkrét közéleti botrány feldolgozása, a vallás, a politika és a nyilvánosság kapcsolatáról.',
                views: '969 ezer megtekintés',
              },
            ],
          },
          {
            title: 'Az influenszertüntetés — Odakint most szörnyek járnak',
            when: '2024. február 16.',
            body:
              'Pottyondy Edina közéleti szerepvállalásának legfontosabb eseménye a Hősök téri influenszertüntetés volt, amelynek egyik szervezője volt. A demonstrációt a bicskei gyermekotthon ügye és a kegyelmi botrány után hat nappal tartották, és több ismert online tartalomkészítő állt mögötte. A résztvevőkkel a Hősök tere mellett az Andrássy út, a Felvonulási tér és a Városliget egy része is megtelt.',
            links: [
              {
                text: 'Qubit',
                href: 'https://qubit.hu/2024/02/17/az-egesz-vilagon-egyedulallo-tuntetest-tartottak-pentek-este-a-hosok-teren',
                external: true,
              },
            ],
            promoPlacement: 'top',
            promo: {
              href: '/ugyek/ki-az-a-zsolt-bacsi',
              eyebrow: 'Kiemelt ügy · Ki az a Zsolti bácsi?',
              title: 'A gyermekvédelmi botrány, ami idáig vezetett',
              lead:
                'A kegyelmi ügy után a gyermekvédelmi intézményrendszer működése került a nyilvánosság elé. Mi hangzott el a felvételen, ki a koronatanú, mit állít és mit cáfol, és hol tart most az eljárás?',
              cta: 'Az ügy megnyitása',
            },
            more: [
              'Ez más szerep volt, mint egy videó elkészítése: itt nem egy véleményt kellett megfogalmazni, hanem egy több tízezres nyilvános eseményt megszervezni. A tüntetés végén adománygyűjtés indult egy korábban bántalmazott, hajléktalanná vált fiatal megsegítésére; a szombat reggelig összegyűlt összeg már megközelítette a 60 millió forintot.',
              'A gyűjtés ennél jóval tovább jutott: 2024 májusában a Telex arról számolt be, hogy a tüntetésen indított kampányban összegyűlt 219 millió forintból tizenegy fiatalt támogatnak. Egy online közösségből tehát nemcsak fizikai tömeg lett, hanem konkrét, számon kérhető eredmény is.',
              'A Qubit elemzése szerint a demonstráció formája nemzetközi összevetésben is szokatlan volt: nem párt, nem szakszervezet és nem klasszikus civil szervezet hívta össze, hanem online tartalomkészítők, akiknek addig semmilyen politikai szervezeti hátterük nem volt. A tüntetés így egyszerre volt tiltakozás és annak bizonyítéka, hogy egy online közönség képes egyetlen ügy köré szervezetten felsorakozni.',
              'Az esemény később a saját munkásságának is része lett: a 2025-ben megjelent könyvében külön ír a tüntetés kulisszáiról és a szervezés tapasztalatairól.',
            ],
            sources: [
              {
                source: 'Mérce',
                date: '2024. febr. 16.',
                headline: 'Több tízezren tüntettek a Hősök terén a kegyelmi ügy miatt',
                url: 'https://merce.hu/2024/02/16/mar-kezdes-elott-tizezre-tomeg-gyult-ossze-az-influenszerek-a-kegyelmi-ugy-miatti-tuntetesere-a-hosok-teren/',
                lead: 'Helyszíni beszámoló: mekkora tömeg gyűlt össze, és kik beszéltek a színpadon.',
              },
              {
                source: '444',
                date: '2024. febr. 16.',
                headline: 'Az áldozatokért és a gyerekekért tüntetnek a Hősök terén',
                url: 'https://444.hu/2024/02/16/az-aldozatokert-es-a-gyerekekert-tuntetnek-a-hosok-teren',
                lead: 'Mi volt a demonstráció tétje, és mi hangzott el a színpadról.',
              },
              {
                source: 'Qubit',
                date: '2024. febr. 17.',
                headline: 'Az egész világon egyedülálló tüntetést tartottak péntek este a Hősök terén',
                url: 'https://qubit.hu/2024/02/17/az-egesz-vilagon-egyedulallo-tuntetest-tartottak-pentek-este-a-hosok-teren',
                lead: 'Elemzés arról, miért szokatlan, hogy egy tüntetést online tartalomkészítők szerveznek.',
              },
              {
                source: 'Telex',
                date: '2024. máj. 3.',
                headline: 'Tizenegy fiatalt támogatnak az influenszertüntetésen gyűjtött 219 millió forintból',
                url: 'https://telex.hu/belfold/2024/05/03/influenszer-utcarol-lakasba-gyujtes-adakozas',
                lead: 'A gyűjtés végelszámolása: mennyi jött össze, és kikre költik.',
              },
            ],
            videos: [
              {
                id: '2eDR4tYMb4c',
                label: 'Pottyondy Edina · 2024. febr. 17.',
                title: '„Odakint most szörnyek járnak" — a beszéd a Hősök terén',
                summary: 'A saját felvétele a színpadon elmondott beszédéről, amely a tüntetés nevét is adta.',
                views: '171 ezer megtekintés',
              },
            ],
          },
          {
            title: 'Démonok és hormonok — élő előadás',
            when: '2025-től',
            body:
              'A tevékenysége nem korlátozódik az internetre: stand-up előadóként önálló esteket is tart. A Démonok és hormonok nem a videók színpadi változata — személyes történetekből, az anyasággal és hétköznapi élethelyzetekkel kapcsolatos témákból építkezik.',
            more: [
              'A forma azért érdekes, mert ugyanazt a közvetlen, személyes megszólalásmódot viszi át egy teljesen más közegbe: a YouTube-on egy kamera előtt, az élő előadáson pedig közvetlenül a közönség előtt működik.',
            ],
            sources: [
              {
                source: 'pottyondyedina.hu',
                headline: 'Démonok és hormonok — aktuális időpontok',
                url: 'https://www.pottyondyedina.hu/',
                lead: 'A hivatalos oldal, ahol az előadás időpontjai és a jegyek elérhetők.',
              },
            ],
          },
          {
            title: 'Közösségi irányelvek megsértése — könyv',
            when: '2025',
            body:
              '2025-ben megjelent az első könyve, a Közösségi irányelvek megsértése, a PETAverzum Kiadó gondozásában, 196 oldalon. Nem hagyományos politikai elemzőkönyv: rövidprózai, szatirikus és személyes szövegekből áll, ugyanarról a világról, amelyről a videói is szólnak — csak írott formában.',
            more: [
              'A kötet témái között szerepel, hogyan változtatja meg a mesterséges intelligencia a szexualitást, létezik-e ideális párkapcsolat, hogyan működik a közéleti előítélet, és mi történt az influenszertüntetés kulisszái mögött. Ez utóbbi a könyv legérdekesebb része a Dicsőségfal szempontjából: olyan eseményről ír, amelyben nem külső kommentátorként, hanem szervezőként vett részt.',
              'A könyv címe egyben a műfaj önreflexiója is. A közösségi irányelvek megsértése az a kifejezés, amellyel a platformok a korlátozásaikat indokolják — egy olyan szerzőnél, akinek a munkája ezeken a platformokon él, ez nem ártatlan szójáték. A tartalomkészítő nyilvánossága ugyanis nem a sajátja: bármikor szűkíthető olyan döntésekkel, amelyekre nincs ráhatása, és amelyeket nem kell megindokolni neki.',
            ],
            sources: [
              {
                source: 'pottyondyedina.hu',
                headline: 'Közösségi irányelvek megsértése',
                url: 'https://www.pottyondyedina.hu/merch/pottyondy-edina-kozossegi-iranyelvek-megsertese/',
                lead: 'A könyv hivatalos adatlapja: kiadó, terjedelem, tartalom.',
              },
            ],
          },
          {
            title: 'A csatorna azóta is fut',
            when: '2026',
            body:
              'A 2026-os választási időszak anyagai is a legnézettebbek közé kerültek: a választás utáni feldolgozás néhány hónap alatt közel egymillió megtekintésig jutott. A csatorna tehát nem egyetlen politikai pillanathoz kötődik.',
            videos: [
              {
                id: 'fjDDmi4Sbts',
                label: 'Pottyondy Edina · 2026. ápr. 20.',
                title: 'A rossz vesztesek: Kövér, Rákay, Orbán és a propagandisták',
                summary: 'A választás utáni hetek feldolgozása.',
                views: '997 ezer megtekintés',
              },
            ],
          },
        ],
      },
      extra: [
        {
          heading: 'Mit tud ez a forma, és mit nem?',
          paragraphs: [
            'Érdemes pontosan elkülöníteni a szerepeket. Pottyondy Edina nem oknyomozó újságíró: nem dokumentumokat szerez meg, nem adatigényléseket futtat, és nem ő tárja fel az ügyeket, amelyekről beszél. A videói jellemzően már nyilvánosságra került történetekre reagálnak — a hozzáadott érték a terjesztés, az értelmezés és az, hogy a téma egyáltalán eljut valakihez.',
            'A nézettség sem azonos a hatással. Egy egymilliós megtekintés nem jelenti azt, hogy egymillió ember politikai álláspontja megváltozott; azt viszont igen, hogy a téma kilépett abból a néhány tízezres buborékból, amelyben a közéleti sajtó jellemzően mozog. A Dicsőségfalon ezért nem az szerepel, hogy „meggyőzött", hanem az, hogy elért.',
            'A szatíra műfaja ráadásul saját korlátokat is hoz. Az irónia élesen fogalmaz, de nehezen árnyal, és a humor néha épp azt a részletet vágja le egy ügyből, amelyik a legfontosabb lenne. Ez nem kifogás a forma ellen — csak annak az oka, hogy egy ilyen csatorna kiegészíti a feltáró újságírást, nem pedig helyettesíti.',
          ],
        },
        {
          heading: 'Miért van Pottyondy Edina a Dicsőségfalon?',
          paragraphs: [
            'Nem a követőszáma miatt. Azért, mert a tevékenysége több különböző nyilvánossági formát kapcsol össze: az online videót, a közösségi médiát, az élő színpadi jelenlétet, az írást és a közösségszervezést. Ugyanaz a téma így nemcsak egyszer ér el egy embert.',
            'A 2024-es influenszertüntetés azt is megmutatta, hogy egy online közönség bizonyos esetekben fizikai közösséggé alakítható — és hogy ennek mérhető eredménye is lehet: a tüntetésen indított gyűjtésből tizenegy fiatal támogatása lett.',
            'A pályája egyben arra is példa, hogyan változott meg a közéleti nyilvánosság a videóplatformok térnyerésével. Egy csatorna ma már nem feltétlenül szórakoztató felület: rendszeres tartalom és közönség mellett önálló közéleti platformmá válhat, amely egy-egy témát több százezer emberhez juttat el.',
          ],
        },
      ],
      faq: [
        {
          q: 'Ki Pottyondy Edina?',
          a: 'Magyar YouTuber, közéleti tartalomkészítő, stand-up előadó és szerző. Elsősorban politikai és társadalmi témájú, humorral és szatírával készített videóiról ismert.',
        },
        {
          q: 'Hányan követik Pottyondy Edinát?',
          a: 'A YouTube-csatornájának nagyjából 377 ezer feliratkozója van, a legnézettebb videói pedig egyenként közel egymillió, illetve annál több megtekintésnél járnak. Facebookon és Instagramon is aktív.',
        },
        {
          q: 'Mi Pottyondy Edina legnézettebb videója?',
          a: 'A „Magyar Péter ledobta 💣🖤" című, 2024. március 26-i videó, amely több mint 1,09 millió megtekintésnél jár.',
        },
        {
          q: 'Miről szólnak Pottyondy Edina videói?',
          a: 'Magyar politikai és társadalmi témákról, politikusokról, közéleti botrányokról, propagandáról és ismert közszereplőkről — jellemzően szatirikus, humoros formában.',
        },
        {
          q: 'Pottyondy Edina szervezte a Hősök téri influenszertüntetést?',
          a: 'Egyik szervezője volt a 2024. február 16-i demonstrációnak, amelyet több ismert online tartalomkészítő közösen szervezett. A tüntetés a bicskei gyermekotthon ügyét és a gyermekvédelem rendszerszintű problémáit állította a középpontba.',
        },
        {
          q: 'Mi lett a tüntetésen indított gyűjtésből?',
          a: 'A kampányban 219 millió forint gyűlt össze, amelyből a Telex 2024. májusi beszámolója szerint tizenegy fiatalt támogatnak.',
        },
        {
          q: 'Mi az a Démonok és hormonok?',
          a: 'Pottyondy Edina önálló stand-up előadása. Az online közéleti tartalmaknál személyesebb témákat is feldolgoz — az anyaságot, a magánéletet és saját élethelyzeteit.',
        },
        {
          q: 'Van könyve Pottyondy Edinának?',
          a: 'Igen: 2025-ben jelent meg a Közösségi irányelvek megsértése című, 196 oldalas kötete a PETAverzum Kiadónál. Rövidprózai, szatirikus szövegek, köztük az influenszertüntetés kulisszáiról szóló rész.',
        },
      ],
      sources: [
        {
          source: 'YouTube',
          headline: 'Pottyondy Edina csatornája',
          url: 'https://www.youtube.com/@pottyondyedina',
        },
        {
          source: 'pottyondyedina.hu',
          headline: 'Hivatalos oldal — előadások és könyv',
          url: 'https://www.pottyondyedina.hu/',
        },
        {
          source: 'Instagram',
          headline: 'Pottyondy Edina Instagram-oldala',
          url: 'https://www.instagram.com/nematellerede/',
        },
        {
          source: 'Facebook',
          headline: 'Pottyondy Edina Facebook-oldala',
          url: 'https://www.facebook.com/PottyondyEdina/',
        },
      ],
    },
  },
  {
    id: 'osvath-zsolt',
    name: 'Osváth Zsolt',
    kind: 'person',
    group: 'channel',
    role: 'vállalkozó, a ZSHOWtime házigazdája',
    badge: 'INTERJÚK',
    photo: '/images/rendszervaltas/osvath-zsolt.webp',
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
    photo: '/images/rendszervaltas/fokuszcsoport.webp',
    tagline:
      'A humort használta arra, amire a tényszerű beszámoló sokszor képtelen: hogy megmaradjon az emberek fejében.',
    section: {
      heading: 'Fókuszcsoport — a szatíra mint terjesztési forma',
      paragraphs: [
        'A Fókuszcsoport közéleti szatíra- és elemzőtartalmat készít, nagy közösségi médiás eléréssel. A szatíra ezen a Dicsőségfalon nem díszítés: az egyik legmegbízhatóbb módja annak, hogy egy bonyolult ügy egyáltalán eljusson valakihez, aki nem olvas hírportált.',
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
    photo: '/images/rendszervaltas/vastagbor.webp',
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
    photo: '/images/rendszervaltas/kardblog.webp',
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
    photo: '/images/rendszervaltas/dietas-magyar-muzsa.webp',
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
    photo: '/images/rendszervaltas/maydayhungary.webp',
    photoFit: 'contain',
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
    photo: '/images/rendszervaltas/jolvanezigy.webp',
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
    photo: '/images/rendszervaltas/radics-peti.webp',
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
    photo: '/images/rendszervaltas/molnar-aron.webp',
    tagline:
      'Ő robbantotta ki az NKA-botrányt — a rendszerváltás UTÁN, amikor már senki nem várta, hogy jöjjön még egy ekkora ügy.',
    section: {
      heading: 'Molnár Áron — a botrány, ami a fordulat után jött',
      paragraphs: [
        'Molnár Áron színészként és aktivistaként évek óta jelen van a közéletben, de a legnagyobb hatású munkája időben kilóg mindenki máséból ezen a Dicsőségfalon: ő az NKA-botrányt nem április 12. előtt robbantotta ki, hanem utána.',
        'Elsőként ő beszélt arról a rejtett, nagyságrendileg 17 milliárdos keretről, amelyből a Nemzeti Kulturális Alap a kormányzati holdudvar gazdasági, közéleti és művészeti szereplőit támogatta — köztük egy addig ismeretlen, „Kiemelt Kulturális Programok Ideiglenes Kollégiuma" nevű testület döntései alapján. Az ügy azóta is gyűrűzik: 2026 nyarán újabb szervezeteket nevezett meg, ősszel pedig mentelmi jogok felfüggesztését követelte.',
        'Ez a Dicsőségfal arról szól, kinek köszönhetjük a fordulatot — Molnár Áron viszont arra a kérdésre a válasz, hogy mi történik utána. Egy rendszerváltás nem ér véget azzal, hogy leváltanak egy kormányt: az elszámoltatás akkor kezdődik. Az is a képhez tartozik, hogy a feltárást követően őt magát is megvádolták NKA-pénzek elfogadásával, amit ő visszautasított.',
      ],
    },
    related: [
      { label: 'NKA-botrány', href: '/ugyek/nka-botrany' },
      { label: 'Videóriportok és podcastok', href: '/podcastok' },
    ],
    updatedAt: '2026-09-24',
    live: true,
    detail: {
      seoTitle: 'Molnár Áron (noÁr): a Tanulni akaruntól az NKA-botrányig',
      seoDescription:
        'Ki Molnár Áron? A noÁr Mozgalom, a tanártüntetések, az SZFE, a Loupe Színházi Társulás, a Magyarország Kedvenc Reggeli Műsora és az NKA-botrány kirobbantása — forrásokkal.',
      lead:
        'Molnár Áron helye a Dicsőségfalon nem azért indokolható, mert színészként ismert, és nem is azért, mert minden közéleti megszólalásában igaza lenne. A szerepe más: 2018 óta a saját művészi ismertségét, a közösségi médiát, a zenét, a színházat és 2026-tól a politikai tartalomgyártást is társadalmi ügyek szolgálatába állította — az NKA-botrányban pedig egy belső forrástól kapott dokumentumokat hozott nyilvánosságra.',
      cases: {
        heading: 'A legfontosabb állomások és ügyek',
        intro:
          'Ez más típusú teljesítmény, mint Panyi Szabolcs oknyomozó újságírása, Hadházy Ákos közpénzellenőrző munkája vagy Jámbor András lakhatási és parlamenti jogvédelme. Molnár Áron fő eszköze a kulturális mozgósítás és a nyilvánosság: 2018 után a noÁr Mozgalom, később a Loupe Színházi Társulás, 2026-ban pedig a napi politikai tartalomgyártás és az NKA-ügy dokumentumainak nyilvánosságra hozatala.',
        items: [
          {
            title: 'A noÁr Mozgalom létrehozása',
            when: '2018-tól',
            body:
              'Molnár Áron 2018-ban indította el a noÁr Mozgalmat. A név a saját nevének anagrammája, de rövid idő alatt önálló kulturális és aktivista márkává vált. Az alapötlet az volt, hogy a közéleti részvételt nem kell kizárólag pártokhoz vagy parlamenti politikusokhoz kötni: egy művész, egy zenész, egy diák, egy tanár vagy egy civil közösség is képes ügyeket láthatóvá tenni és embereket mozgósítani.',
            more: [
              'A noÁr ehhez a hagyományos politikai kommunikációtól eltérő eszközöket használt: dalokat, klipeket, koncerteket, közösségi médiát, tüntetéseket és adománygyűjtéseket. A modell új közönséget kapcsolt be a közéleti vitákba — olyan embereket is, akikhez a klasszikus ellenzéki pártpolitika vagy a civil szervezetek szokásos kommunikációja kevésbé ért el.',
              'Molnár Áron később maga is beszélt arról, hogy a mozgalom személycentrikussága jogos kritika volt: a noÁr ismertsége nagyrészt az ő személyéhez kötődött, ami egyszerre jelentett nagy elérést és szervezeti kockázatot.',
            ],
          },
          {
            title: 'Oktatás — Tanulni akarunk! és Tanítani akarunk!',
            when: '2018–2023',
            body:
              'A noÁr első nagy ügye az oktatás volt. A Tanulni akarunk! 2018-ban jelent meg, és az oktatási rendszer problémáit a diákok perspektívájából dolgozta fel; a videó a saját YouTube-csatornáján ma több mint 1,9 millió megtekintésnél jár. 2022-ben érkezett a Tanítani akarunk!, amely ugyanezt a pedagógusok oldaláról fogalmazta meg, több mint 860 ezer megtekintéssel.',
            more: [
              'A két projekt jelentősége nem az, hogy Molnár Áron találta volna fel az oktatási tiltakozást. A Tanítanék Mozgalom, a pedagógus-szakszervezetek, diákcsoportok és más civil szervezetek évek óta dolgoztak az ügyön. A noÁr hozzájárulása az volt, hogy az oktatás kérdését kulturális nyelven is kommunikálta, és olyan közönséget vont be, amely az oktatáspolitikai vitákban kevésbé volt aktív.',
              'A 2022-es oktatási tiltakozásokban a noÁr már nemcsak tartalomkészítőként, hanem szervezőként és színpadi szereplőként is jelen volt: a 2022. október 5-i országos tanártüntetésen és koncerten a pedagógusok mellett álltak ki.',
            ],
            sources: [
              {
                source: 'Telex',
                date: '2022. okt. 5.',
                headline: 'Sztrájk, polgári engedetlenség, élőlánc, hídfoglalás, tüntetés és koncert — így telt az országos tanártüntetés napja',
                url: 'https://telex.hu/belfold/2022/10/05/sztrajk-polgari-engedetlenseg-elolanc-budapest-videk-hidfoglalas-tuntetes-koncert-tanarok',
                lead:
                  'Helyszíni összefoglaló a nap eseményeiről, benne az esti koncerttel, ahol a noÁr is fellépett.',
              },
            ],
            videos: [
              {
                id: 'yfR4dzjGKJs',
                label: 'Molnár Áron · 2018. ápr. 4.',
                title: 'noÁr — TANULNI AKARUNK!',
                summary:
                  'A noÁr legnagyobb elérésű közéleti videója: az oktatási rendszer kritikája a diákok szemszögéből. Több mint 1,9 millió megtekintés.',
              },
              {
                id: 'Vd6jmqzyu0I',
                label: 'Molnár Áron · 2022. márc. 14.',
                title: 'noÁr — TANÍTANI AKARUNK!',
                summary:
                  'A 2018-as kampány folytatása, már a pedagógusok oldaláról. Több mint 860 ezer megtekintés.',
              },
            ],
          },
          {
            title: 'A pedagógusok melletti szolidaritás és adománygyűjtés',
            when: '2022–2023',
            body:
              'Az oktatási tiltakozások legsúlyosabb szakasza az volt, amikor a polgári engedetlenségben részt vevő pedagógusokat elbocsátották. A noÁr és a Tanítanék ekkor nemcsak demonstrációkon vett részt, hanem adománygyűjtésekkel is próbált gyakorlati segítséget nyújtani az érintetteknek.',
            more: [
              'A Tanítanék tevékenységi naplója dokumentálja az együttműködéseket és az adományok felhasználását: a támogatásokból többek között a kirúgott pedagógusokat, valamint más civil és szociális kezdeményezéseket segítettek.',
              'Ezt nem Molnár Áron egyéni eredményeként kell feltüntetni: a tanárokért zajló mozgalom mögött több szervezet és több ezer résztvevő állt. Az ő hozzájárulása elsősorban a kulturális nyilvánosság, a mozgósítás és a közösségi támogatás megszervezése volt.',
            ],
            sources: [
              {
                source: 'Tanítanék',
                headline: 'Tevékenységi napló, 2023',
                url: 'https://www.tanitanek.info/tevekenysegi-naplo-2022/tevekenysegi-naplo-2023/',
                lead:
                  'A mozgalom saját, tételes naplója az együttműködésekről és arról, mire fordították az összegyűlt adományokat.',
              },
            ],
          },
          {
            title: 'Az SZFE és a kulturális autonómia ügye',
            when: '2020-tól',
            body:
              'A Színház- és Filmművészeti Egyetem modellváltása után Molnár Áron is azok közé a művészek közé tartozott, akik nyilvánosan támogatták az egyetem autonómiájáért tiltakozó hallgatókat. A noÁr korábbi munkájában is központi kérdés volt a kultúra függetlensége, ezért az SZFE ügye szervesen kapcsolódott a szerepéhez.',
            more: [
              'A kulturális intézmények függetlenségét a későbbi megszólalásaiban is rendszeresen összekapcsolta a demokratikus intézményrendszer működésével — a kérdés tehát nála nem egyetlen egyetemi konfliktus volt.',
            ],
            videos: [
              {
                id: 'Co2FWVsu7ck',
                label: 'Molnár Áron · 2022. jan. 19.',
                title: 'noÁr — Milyen áron?',
                summary:
                  'Az egyik legdirektebb politikai noÁr-dal: a kulturális politika, az SZFE, a szegénység és a politikai részvétel kérdéseit kapcsolja össze. Több mint 82 ezer megtekintés.',
              },
            ],
          },
          {
            title: 'Nemzetközi elismerés — Premio Tenco',
            when: '2021',
            body:
              '2021-ben Molnár Áron és a noÁr kapta a Premio Tenco Grup Yorum-díját. Az elismerést olyan művészeknek és formációknak ítélik oda, amelyek társadalmi és emberi jogi kérdésekben is aktívak.',
            more: [
              'A díj önmagában nem bizonyítja egyetlen politikai állítás helyességét sem. Azt viszont dokumentálja, hogy a művészetet és a társadalmi aktivizmust összekapcsoló modell nemzetközi kulturális közegben is értelmezhető és elismert teljesítmény volt.',
            ],
            sources: [
              {
                source: '24.hu',
                date: '2021. okt. 8.',
                headline: 'Rangos olasz elismerést kapott a noÁr',
                url: 'https://24.hu/kultura/2021/10/08/noar-molnar-aron-premium-tenco-grup-yorum-dij-dalszerzo-elismeres/',
                lead: 'Mi a Premio Tenco Grup Yorum-díj, és kik kapták korábban.',
              },
            ],
          },
          {
            title: 'A Loupe Színházi Társulás — közélet a színpadon',
            when: '2021-től',
            body:
              'A noÁr mellett a színház lett Molnár Áron közéleti munkájának másik fontos terepe. A Loupe Színházi Társulás alapító tagjaként és művészeti tanácsának tagjaként olyan független formáció létrehozásában vett részt, amelynek repertoárjában rendszeresen jelennek meg társadalmi és közéleti kérdések.',
            more: [
              'A Loupe nem egyszerűen politikai színházként működik: az előadások családi kapcsolatokat, felelősséget, manipulációt, kommunikációt, társadalmi konfliktusokat és hatalmi viszonyokat is vizsgálnak. Egyik fontos közéleti akciójuk a Levegőt! demonstráció volt, amely a gyűlöletkampányok és a közbeszéd romlása ellen szerveződött.',
              'A repertoár egyik 2026-os darabja, A kezdet/vége Molnár Áron, Földes Eszter és Mohai Tamás főszereplésével készült, és a felelősségvállalás, a felnőtté válás és a párkapcsolati döntések kérdéseit dolgozza fel.',
            ],
            sources: [
              {
                source: 'Loupe Színházi Társulás',
                headline: 'Molnár Áron — alkotói bemutatkozó',
                url: 'https://loupe.hu/alkotok/molnar-aron',
                lead: 'A társulat saját oldala: milyen szerepben vesz részt a Loupe munkájában.',
              },
              {
                source: 'Loupe Színházi Társulás',
                headline: 'A kezdet/vége',
                url: 'https://loupe.hu/repertoar/a-kezdet-vege',
                lead: 'A 2026-os előadás adatlapja a társulat repertoárjában.',
              },
            ],
          },
          {
            title: 'Itt érzem magam otthon — rendszerkritika a mozivásznon',
            when: '2026. február',
            body:
              '2026 februárjában került a magyar mozikba Holtai Gábor Itt érzem magam otthon című nagyjátékfilmje. Molnár Áron nemcsak szereplője volt, hanem executive producerként is részt vett a létrehozásában; a főszerepeket Lovas Rozi és Molnár Áron játsszák. A film 2026. február 19-én került a mozikba.',
            more: [
              'A történetben egy nőt elrabolnak, majd egy családba kényszerítik, ahol azt állítják róla, hogy valójában a család eltűnt tagja. Az alaphelyzet thrillerként is működik, de több kritika politikai allegóriaként, illetve társadalomkritikus történetként értelmezte.',
              'A Telex szerint a forgatókönyv öt évvel korábban készült, és eredetileg nem kifejezetten a regnáló hatalommal akart párhuzamot vonni — a bemutató idejére viszont rendszerkritikus alkotásként került a közbeszédbe. A Revizor kritikája ennél konkrétabban politikai allegóriaként értelmezi, és a NER működésével állítja párhuzamba; ez azonban kritikusi olvasat, nem a film hivatalos műfaji meghatározása.',
            ],
            sources: [
              {
                source: 'Telex',
                date: '2026. ápr. 9.',
                headline: 'Miért ne nézhetné meg egy fideszes a filmünket?',
                url: 'https://telex.hu/after/2026/04/09/itt-erzem-magam-otthon-producerek-martonffy-zoltan-farkas-adam-cinesuper-mitol-fuggetlen-egy-film',
                lead:
                  'Interjú a producerekkel a film keletkezéséről és arról, mitől független egy film Magyarországon.',
              },
              {
                source: '24.hu',
                date: '2026. febr. 20.',
                headline: 'Molnár Áron a rendszerkritikáról és a politikáról',
                url: 'https://24.hu/szorakozas/2026/02/20/molnar-aron-rendszerkritika-politika/',
                lead: 'A bemutató utáni interjú: hogyan látja ő a film politikai olvasatát.',
              },
              {
                source: 'Revizor',
                headline: 'Foglyul ejtett ország — Itt érzem magam otthon',
                url: 'https://revizoronline.com/holtai-gabor-itt-erzem-magam-otthon/',
                lead: 'A kritika, amely a filmet politikai allegóriaként olvassa.',
              },
            ],
            videos: [
              {
                id: 'BWg1IqIrIhM',
                label: 'IGN Hungary · 2026. jan. 14.',
                title: 'Itt érzem magam otthon — előzetes',
                summary:
                  'A film hivatalos előzetese Lovas Rozi és Molnár Áron főszereplésével, egy hónappal a február 19-i bemutató előtt.',
              },
            ],
          },
          {
            title: 'Magyarország Kedvenc Reggeli Műsora — napi politikai tartalom',
            when: '2026-tól',
            body:
              '2026-ban Molnár Áron közéleti szerepe új formát kapott: a Magyarország Kedvenc Reggeli Műsora rendszeres hírelemző adásaiban Lengyel Tamás és Rainer-Micsinyei Nóra mellett szerepel. A műsor keddenként és csütörtökönként jelentkezik, és a napi politikai híreket, közéleti ügyeket és a politikai szereplők kommunikációját kommentálja.',
            more: [
              'Ez lényegesen más modell, mint a noÁr eredeti működése. A noÁr ügyeket próbált népszerűsíteni; a reggeli műsor klasszikus hírelemző formátum, amely napi eseményekre reagál. Az adások jelentős közönséget érnek el — a márciusi és áprilisi epizódok egyenként 140 ezer körüli megtekintésnél járnak.',
              'Ez azért fontos, mert Molnár Áron közéleti jelenléte 2026-ra már nem kizárólag a noÁr örökségéből élt: önálló politikai médiakarakterré vált.',
            ],
            videos: [
              {
                id: 'h4Bswz6ztZw',
                label: 'Magyarország Kedvenc Műsora · 2026. márc. 12.',
                title: 'ORBÁN telefonál, indul az országjárás! — #7',
                summary: 'A 2026-os korszak jellemző tartalma: napi politikai hírek kommentálása. 141 ezer megtekintés.',
              },
              {
                id: 'vu1kFXJ7d94',
                label: 'Magyarország Kedvenc Műsora · 2026. ápr. 1.',
                title: 'A SZAVAZAT ára! — #13',
                summary:
                  'Az áprilisi választás előtti adás, közvetlenül a választási rendszerről és a politikai részvételről. 143 ezer megtekintés.',
              },
            ],
          },
          {
            title: 'Az NKA-botrány kirobbantása',
            when: '2026. áprilistól',
            body:
              'Az NKA-botrány 2026. április 24-én robbant ki: Molnár Áron a Magyarország Kedvenc Reggeli Műsorában olyan információkat hozott nyilvánosságra, amelyek szerint a Nemzeti Kulturális Alap és az NKTK környezetében egy több milliárd forintos, nem megfelelően átlátható kulturális támogatási rendszer működött. A nyilvánosságra hozott adatok egy nagyságrendileg 17 milliárd forintos keretre irányították a figyelmet, amelynek egy részéről egy addig gyakorlatilag ismeretlen testület, a „Kiemelt Kulturális Programok Ideiglenes Kollégiuma" döntött — vagyis a szakmai kollégiumi rendszert meg lehetett kerülni.',
            links: [{ text: 'NKA-botrány', href: '/ugyek/nka-botrany' }],
            promoPlacement: 'top',
            more: [
              'A forrás később személyesen is azonosította magát: Papp Gergely, az NKTK projektmenedzsere elmondta, hogy ő szolgáltatott információkat a támogatási keretről, amelyről állítása szerint az intézményen belül is sokan nem tudtak. A nyertesek listája ezt követően vált olyan formában elérhetővé, amelyből a kedvezményezettek és az összegek vizsgálhatók lettek.',
              'A feltárás nem egyszeri bejelentés volt: májusban Molnár Áron további dokumentumokat is bemutatott — köztük egy e-mailt, amely a 24.hu beszámolója szerint azt dokumentálta, hogy Mága Zoltán koncertsorozatához közel félmilliárd forintos állami támogatást próbáltak biztosítani, a kampányidőszakhoz kötött célokkal. Augusztusban újabb szervezeteket nevezett meg a kedvezményezettek közül, szeptemberben pedig mentelmi jogok felfüggesztését követelte az érintett politikusoknál.',
              'Fontos a szerepek elkülönítése. Nem ő indította a NAV nyomozását, nem ő hozott bírósági döntéseket, és nem lehet minden későbbi hatósági eredményt neki tulajdonítani. A dokumentálható állítás ennél szűkebb: egy belső forrástól kapott információkat és dokumentumokat hozott nyilvánosságra, és ezzel hozzájárult ahhoz, hogy az NKA-botrányból országos közpénzügyi ügy legyen. A későbbi büntetőeljárásokban érintettek bűnösségét nem lehet előre kijelenteni.',
            ],
            sources: [
              {
                source: 'Index',
                date: '2026. ápr. 28.',
                headline: 'Nem csitul a botrány a Fidesz-holdudvarnak kifizetett milliárdok körül',
                url: 'https://index.hu/kultur/2026/04/28/nemzeti-kulturalis-alap-fidesz-holdudvar-milliardok-hanko-balazs-molnar-aron/',
                lead: 'Az ügy kiszélesedése a nyilvánosságra hozatal után néhány nappal.',
              },
              {
                source: 'Telex',
                date: '2026. ápr. 30.',
                headline: 'Fideszes képviselők vurstlijára mentek el tízmilliók az NKA eltitkolt keretéből',
                url: 'https://telex.hu/belfold/2026/04/30/fideszes-kepviselok-vurstlijara-mentek-el-tizmilliok-az-nka-eltitkolt-keretebol',
                lead: 'Konkrét tételek a keretből, nevesített kedvezményezettekkel.',
              },
              {
                source: '24.hu',
                date: '2026. máj. 18.',
                headline: 'Molnár Áron: Mága Zoltán Hankó Balázs támogatásával kért állami pénzt a Fidesz kampányára',
                url: 'https://24.hu/kultura/2026/05/18/molnar-aron-maga-zoltan/',
                lead: 'A bemutatott dokumentum és ami kiolvasható belőle.',
              },
              {
                source: 'Telex',
                date: '2026. máj. 18.',
                headline: 'Mága Zoltán 500 milliós NKA-kérelme',
                url: 'https://telex.hu/belfold/2026/05/18/hanko-balazs-miniszterium-nka-500-millio-novo-studium-maga-zoltan-nemzeti-oldal-valasztasi-gyozelme',
                lead: 'Ugyanaz a kérelem független feldolgozásban, a minisztériumi háttérrel.',
              },
              {
                source: '444',
                date: '2026. júl. 2.',
                headline: 'Az NKA-pénzek elfogadásával vádolt Molnár Áron szerint nem fogadott el NKA-pénzeket',
                url: 'https://444.hu/2026/07/02/az-nka-penzek-elfogadasaval-vadolt-molnar-aron-szerint-nem-fogadott-el-nka-penzeket',
                lead:
                  'A visszatámadás: a feltárás után őt magát is megvádolták NKA-pénzek elfogadásával, amit visszautasított.',
              },
            ],
            videos: [
              {
                id: 'iEEH5e1_-rc',
                label: 'Magyarország Kedvenc Műsora · 2026. máj. 6.',
                title: 'Kitálal az NKA forrásunk! — #23',
                summary:
                  'Az az adás, amelyben a belső forrás maga szólal meg a támogatási keretről. 285 ezer megtekintés.',
              },
            ],
            promo: {
              href: '/ugyek/nka-botrany',
              eyebrow: 'KIEMELT ÜGY',
              title: 'NKA-botrány',
              lead:
                'Hol tart most az NKA-botrány? Nézd meg az ügy teljes történetét az első hírektől a mai fejleményekig: videók, cikkek, gyanúsítottak, őrizetbe vételek, letartóztatások és visszafizetések — minden egy helyen, folyamatosan frissítve.',
              cta: 'Az ügy adatlapja',
            },
          },
        ],
      },
      extra: [
        {
          heading: 'A módszer: művészet, közösség, média, dokumentum',
          paragraphs: [
            'Kulturális megszólítás: dalokkal, klipekkel és koncertekkel olyan közönséget is elért, amelyet a klasszikus politikai kommunikáció nehezebben ér el.',
            'Közösségi mozgósítás: a noÁr az oktatási és kulturális ügyeket tüntetésekkel, kampányokkal és adománygyűjtésekkel kapcsolta össze.',
            'Független művészeti tér: a Loupe Színházi Társulással a társadalmi kérdések a színpadon is megjelentek.',
            'Politikai tartalom és dokumentumok: 2026-ban már napi politikai híreket kommentált, az NKA-ügyben pedig belső információkat és dokumentumokat tett nyilvánossá.',
            'A módszer változása a lényeg. A 2018-as Molnár Áron azt kérdezte, hogyan lehet egy dalt politikai üggyé tenni; a 2026-os Molnár Áron napi politikai műsort készít és közpénzügyi dokumentumokat dolgoz fel. Ez az aktivista szerep fokozatos átalakulása a kulturális mozgósítótól a politikai tartalomkészítőig.',
          ],
        },
        {
          heading: 'Milyen kritikák érték a munkáját?',
          paragraphs: [
            'A legfontosabb a személycentrikusság. A noÁr jelentős része Molnár Áron ismertségére épült, ami komoly elérést biztosított, de felvetette a kérdést, mennyire képes egy mozgalom egyetlen ismert arc nélkül önállóan működni.',
            'A második a politikai elfogultság. Molnár Áron nem semleges kulturális kommentátorként beszél a közéletről: nyíltan rendszerkritikus, és 2026-ban már politikai műsorban vesz részt. A megszólalásait ezért ugyanúgy forrásokkal és dokumentumokkal kell ellenőrizni, mint bármely más politikai szereplő állításait.',
            'A harmadik a kulturális aktivizmus eredményének mérhetősége. Egy többmilliós megtekintés nem jelenti azt, hogy ugyanennyi ember politikai álláspontja megváltozott, és egy tüntetés létszáma sem azonos egy jogszabályi eredménnyel. Az NKA-ügyben ezért különösen fontos az időrend betartása: ő információkat és dokumentumokat hozott nyilvánosságra, a NAV-nyomozás, az őrizetbe vételek és a visszafizetések már hatósági és más sajtóforrásokból dokumentálhatók.',
            'A negyedik a közéleti és a művészi szerep összemosódása. Egyszerre színész, producer, színházi alkotó és politikai tartalomkészítő — ez új közönséget biztosít, ugyanakkor egy-egy politikai állítása könnyen összekeverhető a művészi munkájával. A Dicsőségfalon ezért a két szerepet külön kezeljük: nem azért kerül ide, mert jó színész, hanem azért, mert a nyilvánosságát következetesen közéleti ügyekre használta.',
          ],
        },
        {
          heading: 'Miért van Molnár Áronnak helye a Dicsőségfalon?',
          paragraphs: [
            'A története nem egyetlen korrupciós ügy története. A noÁr az oktatás ügyét vitte el a kulturális közegbe, az SZFE ügyében a kulturális autonómia mellett szólalt fel, a Loupe-on keresztül társadalmi kérdéseket vitt színpadra, 2026-ban pedig rendszeres politikai hírelemző szerepet vállalt.',
            'Az NKA-ügyben egy belső forrás által átadott információk nyilvánosságra hozatalával hozzájárult egy olyan közpénzügyi ügy feltárásához, amely később hatósági nyomozásig, kényszerintézkedésekig és több milliárd forintos visszafizetésekig jutott. Ez nem jelenti azt, hogy ő lenne az ügy nyomozója, vagy hogy minden későbbi eredmény neki tulajdonítható.',
            'A dokumentálható teljesítmény pontosan ennyi: a magyar rendszerkritikus közélet egyik olyan szereplője, aki a művészi ismertséget, a közösségi médiát, a közösségszervezést, a színházat és 2026-tól a politikai tartalomgyártást is következetesen közéleti ügyek szolgálatába állította. A helye tehát közéleti aktivistaként, kulturális mozgósítóként és politikai tartalomkészítőként értelmezhető.',
          ],
        },
      ],
      faq: [
        {
          q: 'Ki Molnár Áron?',
          a: 'Színész, szinkronszínész, közéleti aktivista és producer. A noÁr Mozgalom alapítója, valamint a Loupe Színházi Társulás alapító tagja és művészeti tanácsának tagja.',
        },
        {
          q: 'Mi a noÁr?',
          a: '2018-ban létrehozott kulturális és aktivista mozgalom, amely művészeti eszközökkel, közösségi médiával, kampányokkal és közösségszervezéssel foglalkozott társadalmi ügyekkel. Működését 2024-ben felfüggesztették.',
        },
        {
          q: 'Mi volt a noÁr legfontosabb ügye?',
          a: 'Az oktatás. A Tanulni akarunk! és a Tanítani akarunk! kampányok a diákok, illetve a pedagógusok helyzetére hívták fel a figyelmet — az előbbi több mint 1,9 millió megtekintésnél jár.',
        },
        {
          q: 'Molnár Áron oknyomozó újságíró?',
          a: 'A klasszikus értelemben nem. Elsősorban színész, aktivista, művészeti alkotó és politikai tartalomkészítő. Az NKA-ügyben információkat és dokumentumokat hozott nyilvánosságra, de a büntetőeljárást a hatóságok folytatják.',
        },
        {
          q: 'Mi volt Molnár Áron szerepe az NKA-botrányban?',
          a: '2026 áprilisában egy belső forrástól kapott információkat hozott nyilvánosságra a Nemzeti Kulturális Alap támogatási rendszeréről. A forrás később Papp Gergely NKTK-projektmenedzserként azonosította magát. Az ügy ezt követően hatósági nyomozássá szélesedett.',
        },
        {
          q: 'Miért fontos az NKA-ügy?',
          a: 'Az ügy nagyságrendileg 17 milliárd forintnyi támogatási döntést érintett, a NAV hűtlen kezelés gyanújával nyomozott, és több érintett ellen kényszerintézkedést is elrendeltek. A Kegyencjárat külön adatlapban követi az ügyet, a visszafizetéseket és az érintett személyeket.',
        },
        {
          q: 'Mi az a Magyarország Kedvenc Reggeli Műsora?',
          a: '2026-ban indult rendszeres politikai hírelemző műsor, amelyben Molnár Áron, Lengyel Tamás és Rainer-Micsinyei Nóra vesz részt. Az adások keddenként és csütörtökönként jelentkeznek.',
        },
        {
          q: 'Mi a Loupe Színházi Társulás?',
          a: 'Független színházi formáció, amelynek Molnár Áron alapító tagja és művészeti tanácsának tagja. Előadásaiban rendszeresen jelennek meg társadalmi kérdések.',
        },
        {
          q: 'Mi az Itt érzem magam otthon?',
          a: 'Holtai Gábor 2026-os magyar nagyjátékfilmje, amelyben Molnár Áron főszereplőként és executive producerként vett részt. A film 2026. február 19-én került a mozikba; több kritika politikai allegóriaként értelmezte.',
        },
        {
          q: 'Molnár Áron csak a Fideszt kritizálja?',
          a: 'A kommunikációja alapvetően erősen rendszerkritikus és a Fidesz-kormányt gyakran bíráló, miközben 2026-ban a reggeli műsorban szélesebb politikai hírelemzést folytat. A Dicsőségfal nem azt állítja, hogy minden politikai értékelése helyes, hanem a dokumentálható közéleti tevékenységét mutatja be.',
        },
        {
          q: 'Miért van Molnár Áron a Dicsőségfalon?',
          a: 'Nem azért, mert színész, és nem azért, mert minden közéleti állításával egyet kellene érteni. Azért, mert 2018 óta következetesen közéleti ügyekre használja a nyilvánosságát: a noÁr révén kulturális mozgósítást végzett, az oktatási tiltakozásokban részt vett, az SZFE autonómiája mellett állt ki, a Loupe-on keresztül társadalmi témákat vitt színpadra, 2026-ban pedig politikai hírműsorban szerepelt és az NKA-ügyben dokumentumokat hozott nyilvánosságra.',
        },
      ],
      sources: [
        {
          source: 'Kegyencjárat',
          headline: 'NKA-botrány — az ügy teljes adatlapja',
          url: 'https://www.kegyencjarat.hu/ugyek/nka-botrany',
        },
        {
          source: 'Kegyencjárat',
          headline: 'NKA-pályázatok: így működött a rendszer',
          url: 'https://www.kegyencjarat.hu/ugyek/nka-botrany/nka-palyazatok',
        },
        {
          source: 'Kegyencjárat',
          headline: 'Visszaszerzett és visszakövetelt vagyon',
          url: 'https://www.kegyencjarat.hu/visszaszerzett-vagyon?sort=amount',
        },
        {
          source: '24.hu',
          date: '2026. máj. 18.',
          headline: 'Molnár Áron: Birtokunkban van egy bizonyíték az eddigi legsúlyosabb tiltott kampányfinanszírozásról',
          url: 'https://24.hu/kultura/2026/05/18/molnar-aron-nka-visszaeles/',
        },
        {
          source: 'CineFest',
          headline: 'Itt érzem magam otthon — filmadatlap',
          url: 'https://www.cinefest.hu/film/itt-erzem-magam-otthon/',
        },
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
    photo: '/images/rendszervaltas/videki-prokator.webp',
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
          'A Kegyencjárat láncmunka-elmélete alapján a Vidéki Prókátor a tökéletes kapocs a feltáró és a terjesztő szerepkörök között. Érdemes összevetni a Dicsőségfal más szereplőivel, hogy látsszon, ki mit tett hozzá.',
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


/**
 * A lapon kiírt „Frissítve" dátum.
 *
 * A hubon a legfrissebb tartalomváltozás számít — akár a hub saját szövegéé,
 * akár bármelyik profil-aloldalé (user, 2026-09-24). Egy profiloldalon a saját
 * dátuma, annak hiányában a hubé.
 */
export function contentUpdatedAt(feltaro?: Feltaro): string {
  if (feltaro) return feltaro.updatedAt ?? RENDSZERVALTAS_HUB.updatedAt;
  const all = [RENDSZERVALTAS_HUB.updatedAt, ...FELTAROK.map((f) => f.updatedAt).filter((d): d is string => Boolean(d))];
  return all.reduce((latest, d) => (d > latest ? d : latest), RENDSZERVALTAS_HUB.updatedAt);
}
