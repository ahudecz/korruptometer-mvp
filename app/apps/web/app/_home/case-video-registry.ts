/**
 * Per-person YouTube videos for ADATBÁZIS case detail pages.
 * Keyed by the normalized primary person name (scandal.person).
 *
 * Only videoId is required. title and channel are auto-fetched from YouTube
 * oEmbed at render time (cached 24h). summary is an optional editorial
 * description shown below the video title. linkOnly skips the iframe and
 * renders a framed external link instead (use for RTL-restricted videos).
 */
export interface CaseVideo {
  videoId: string;
  channel?: string;
  title?: string;
  summary?: string;
  moreLabel?: string;
  moreUrl?: string;
  linkOnly?: boolean;
}

function normPerson(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

const VIDEOS: Record<string, CaseVideo> = {
  [normPerson('Balásy Gyula')]: {
    videoId: 'RJ-nGkKzhoY',
    channel: 'Telex',
    title: 'Rogán és Balásy 16 évig tolták az arcunkba a hazugságaikat',
    summary: 'Az országot beborító kék plakátok és a kormányzati információnak álcázott propaganda Orbán Viktor kormányzásának szimbólumai lettek. Megnéztük honnan indult és hova jutott tizenhat év alatt a Fidesz tömegmanipulációs gépezete, aminek az egyik legfőbb felelőse és nyertese Balásy Gyula, a héten sírva ajánlotta fel a cégeit az államnak.',
  },
  [normPerson('Mészáros Lőrinc')]: {
    videoId: 'BsNbeQ5imq4',
    moreLabel: '1. rész és további anyagok: Mészáros Lőrinc (Galéria) →',
    moreUrl: '/galeria/meszaros-lorinc',
  },
  [normPerson('Orbán Viktor')]: {
    videoId: 'HiW9r1M32ug',
    summary: 'Drónfelvételek és helyszíni riport mutatja meg, hogyan fejlődött az elmúlt években az a 250 hektáros major, amelynek valódi tulajdonosa és finanszírozási forrása máig ismeretlen — és amelynek értéke összeegyeztethetetlen Orbán nyilvánosan bejelentett vagyonával.',
    moreLabel: 'Orbán Viktor (Galéria) →',
    moreUrl: '/galeria/orban-viktor',
  },
  [normPerson('Rogán Antal')]: {
    videoId: 'ePRovUEGY1c',
    summary: 'A NER 100 sorozat Rogán Antal hatalmának forrásait térképezi fel. A letelepedési kötvényprogram több száz millió eurós forgalmat generált, és Rogán neve rendszeresen felbukkan a közelében — de pontosan mit tudunk bizonyítani?',
    moreLabel: 'Rogán Antal (Galéria) →',
    moreUrl: '/galeria/rogan-antal',
  },
  [normPerson('Tiborcz István')]: {
    videoId: '26q4cPw-W3A',
    summary: 'Orbán veje személyesen reagál az Elios-botrányra: karrierje szerinte már az uniós vizsgálat előtt elindult. De hogyan épített milliárdos vagyont egy huszonéves fiú néhány év alatt? A videóban Tiborcz saját szavaival mondja el — és olykor többet árul el, mint szeretne.',
    moreLabel: 'Tiborcz István (Galéria) →',
    moreUrl: '/galeria/tiborcz-istvan',
  },
  [normPerson('Matolcsy György')]: {
    videoId: 'bgA0PTDFKlY',
    summary: 'Matolcsy György jegybankelnökként 266 milliárd forintot csatornázott alapítványokon keresztül magánkezekbe. Egy évvel a botrány kirobbanása után ez a videó megnézi: mi változott? A válasz rövid — szinte semmi. A főszereplők szabadon élnek, vagyon nem tért vissza.',
    moreLabel: 'Matolcsy György (Galéria) →',
    moreUrl: '/galeria/matolcsy-gyorgy',
  },
  [normPerson('Kósa Lajos')]: {
    videoId: 'ZdeulAaa8J0',
    summary: 'Az ATV riportja azt vizsgálja, hogy az 1300 milliárdos közbeszerzési botrány fényében le kellene-e mondania Kósa Lajosnak. A volt honvédelmi miniszterhez kötött cégek aránytalanul nagy állami megrendeléseket kaptak védelmi és infrastrukturális területen.',
  },
  [normPerson('Habony Árpád')]: {
    videoId: 'LDTH5Ea9Cio',
    summary: 'A 7/24 portréja Orbán Viktor rejtélyes háttéremberéről: Habony Árpád soha nem töltött be hivatalos pozíciót, mégis évtizedek óta a hatalom belső körébe tartozik — PR-cégein keresztül állami megrendeléseket kapott, miközben befolyása és vagyona folyamatosan nőtt.',
  },
  [normPerson('Tarsoly Csaba')]: {
    videoId: 'U0Agw-tk6Qo',
    summary: 'A Quaestor-csőd után az ügyfélvagyon egy része ötöd piaci áron cserélt gazdát NER-közeli vevőkhöz. Juhász Péter feltárja, hogyan profitáltak Orbán-közeliek a 2015-ös brókerbotrányból, amelynek 32 000 károsultja volt.',
  },
  [normPerson('Horváth Csaba')]: {
    videoId: 'lFQxesQQcCU',
    summary: 'Az ATV kamerái elé állt Horváth Csaba, miután a hatóságok meggyanúsították. A volt politikus igyekszik magyarázatot adni a felé irányuló vádakra — de az interjú több kérdést vet fel, mint amennyit megválaszol.',
  },
  [normPerson('Orbán Balázs')]: {
    videoId: 'bLp9BT3me6Y',
    summary: 'Orbán Balázs, a Fidesz kampányfőnöke nem tud egyetlen konkrét bizonyítékot sem felmutatni a kormány által hangoztatott „Tisza-adó" kapcsán a Népszava riporterének. Az interjú a NER politikai kommunikációjának alaptalan állításait leplezi le.',
  },
  [normPerson('Szíjj László')]: {
    videoId: 'KwCIyPn16c8',
    summary: 'Szíjj László Duna Aszfalt Zrt.-je hogyan vált Magyarország egyik legnagyobb közbeszerzési nyertesévé? A Partizán Oligarchia sorozata megmutatja, milyen állami útépítési megrendelések tették lehetővé a milliárdos vagyonbirodalom felépítését.',
  },
  [normPerson('Bige László')]: {
    videoId: '8AC5uDI6iMQ',
    summary: 'Az ATV stúdiójában Bige László rejtélyes kijelentést tesz: kölcsönösen jobb, ha ő és Magyar Péter nem ismerik egymást. A kemikália-milliárdos az interjúban saját vagyonáról és a NER-hez fűződő viszonyáról is megszólal.',
  },
  [normPerson('Hernádi Zsolt')]: {
    videoId: 'OHYMfUNmelw',
    summary: 'A Partizán PartizánINFO sorozatának portréja a MOL-vezérről: hogyan vált Hernádi Zsolt a NER egyik legbefolyásosabb oligarchájává? A riport a horvát hatóságok körözési parancsát, a MOL–INA ügyet és a politikai kapcsolatrendszert térképezi fel.',
  },
  [normPerson('Homlok Zsolt')]: {
    videoId: 'rtJQpXsM1zs',
    linkOnly: true,
    summary: 'Riport arról, hogyan gazdagszik Mészáros Lőrinc veje, Homlok Zsolt — és milyen mértékben támaszkodik apósa politikai kapcsolathálójára üzleti terjeszkedésénél.',
  },
  [normPerson('Lázár János')]: {
    videoId: 'Zso0FRjX9cM',
    summary: 'Márki-Zay Péter a batidai Lázár-kastély előtt nyilatkozik — szembesítve a minisztert az ingatlan valódi értékével és finanszírozási kérdéseivel. Lázár János hogyan engedheti meg magának? A videó a közpénz és a magánvagyon határán jár.',
    moreLabel: 'Lázár János (Galéria) →',
    moreUrl: '/galeria/lazar-janos',
  },
  [normPerson('Sára Botond')]: {
    videoId: 'j17gTeG50uM',
    summary: 'A Magyar Hang Flaszter sorozata Sára Botond ügyét boncolgatja — és arra jut, hogy a szálak Orbán Viktorig érnek. A volt főpolgármester-jelölt körüli botrány a NER ingatlanhálózatának egy újabb fejezetét tárja fel.',
  },
  [normPerson('Leisztinger Tamás')]: {
    videoId: 'Ap4-mMM3sb0',
    summary: 'Az Átlátszó feltárja: az állam közel 4 milliárd forintot fizetett Leisztinger Tamás bányavállalkozásáért — egy olyan tranzakció keretében, amelynek árazása és indokoltsága komoly kérdéseket vet fel a közpénzek kezelésével kapcsolatban.',
  },
  [normPerson('Nagy Márton')]: {
    videoId: '2UYi1_606hk',
    summary: 'A Telex összegyűjtötte Nagy Márton gazdasági miniszter legemlékezetesebb nyilvános pillanatait — amelyek jól illusztrálják a NER gazdaságpolitikájának kommunikációs stílusát, és azt, hogy milyen kérdések merülnek fel a miniszter pénzügyi felelőssége kapcsán.',
  },
  [normPerson('Balázs Attila')]: {
    videoId: 'KT6ErV2CLxM',
    summary: 'Az ATV riportja a Bosnyák téri ingatlanspekulációról: a zuglói önkormányzat beperelte az új negyed beruházóját. Az ügy Balázs Attila volt zuglói polgármester idején indult, és a városvezetésben érintett személyek körüli összeférhetetlenségi kérdéseket vet fel.',
  },
};

export function getCaseVideo(person: string | null | undefined): CaseVideo | null {
  if (!person) return null;
  return VIDEOS[normPerson(person)] ?? null;
}
