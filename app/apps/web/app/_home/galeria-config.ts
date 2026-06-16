export type GaleriaDetention = 'busted' | 'pretrial' | 'investig' | 'loose' | 'wanted';
export type GaleriaHair = 'short' | 'bald' | 'wave' | 'cap' | 'slick';

export interface PersonCaseItem {
  title: string;
  description: string;
  estimatedDamage?: string;
  crimeTypes: string[];
  sourceUrl?: string;
  sourceLabel?: string;
}

export interface GaleriaEntry {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  detention: GaleriaDetention;
  detentionLabel: string;
  crimes: string[];
  amountLabel: string;
  amount: string;
  // Mugshot params
  variant?: number;
  glasses?: boolean;
  hair?: GaleriaHair;
  // Photo (user-provided URL) + credit
  photoUrl?: string;
  photoCredit?: string;
  // Detail page data
  videoId?: string;
  newsTag?: string;
  newsKeywords?: string[];
  personCases?: PersonCaseItem[];
}

export const GALERIA: GaleriaEntry[] = [
  {
    id: 'orban-viktor',
    name: 'Orbán Viktor',
    subtitle: 'Volt miniszterelnök',
    description: '16 éves kormányzás alatt épített ki rendszert, amelyben állami vagyon és közpénzek politikailag közelálló vállalkozókhoz áramlottak. Az aranykonvoj-ügyben ügyvéd benyújtott feljelentés terrorcselekmény gyanúját is felveti. A Hatvanpuszta-majorság forrása máig megmagyarázatlan.',
    detention: 'investig',
    detentionLabel: 'Feljelentés benyújtva',
    crimes: ['Hűtlen kezelés', 'Közpénzek elherdálása', 'Befolyással visszaélés'],
    amountLabel: 'Becsült közpénzérintettség',
    amount: 'Több ezer milliárd Ft',
    variant: 2, glasses: false, hair: 'slick',
    photoUrl: '/images/persons/orban.jpg',
    photoCredit: 'Orbán Viktor Facebook oldala',
    videoId: 'HiW9r1M32ug',
    newsTag: 'orbán',
    newsKeywords: ['orbán viktor', 'orbán', 'hatvanpuszta', 'aranykonvoj', 'zsigmond ágost', 'nemzeti múzeum'],
    personCases: [
      {
        title: 'Hatvanpuszta',
        description: 'A 250 hektáros, ~20 milliárd forintra becsült majorság hivatalosan nem Orbán Viktoré, hanem édesapja, Orbán Győző nevén van — Orbán mindmáig tagadja, hogy a major az övé lenne, mégis ő lakja és kezelteti. A finanszírozási forrás és a tényleges haszonélvező ismeretlen; az ingatlan értéke összeegyeztethetetlen a nyilvánosan bejelentett vagyonával. 2025-ben Hadházy Ákos feljelentést tett, mert a majoron műemlék jellegű épületet bontottak le engedély nélkül — az ügyészség nyomozást indított.',
        estimatedDamage: '~20 milliárd Ft (ingatlanérték)',
        crimeTypes: ['Vagyonnyilatkozat megsértése', 'Megmagyarázatlan vagyonosodás', 'Stróman-tulajdon (gyanú)', 'Engedély nélküli műemlékbontás'],
        sourceUrl: 'https://telex.hu/belfold/2025/10/12/hadhazy-akos-hatvanpuszta-ugyeszseg-muemlek',
        sourceLabel: 'Telex',
      },
      {
        title: 'Aranykonvoj-ügy',
        description: '2026 tavaszán a NAV és a titkosszolgálat megakadályozott egy Ukrajna határán átkelő konvojt, amely aranyat és devizát szállított Orbán-közelből. Az ügyvéd feljelentésben terrorcselekmény-gyanú is szerepel.',
        estimatedDamage: 'Ismeretlen (arany + deviza)',
        crimeTypes: ['Pénzmosás', 'Terrorcselekmény (gyanú)', 'Csempészet'],
        sourceUrl: 'https://444.hu/2026/06/14/egy-nav-os-belso-jelentes-szerint-torvenysertoen-jarhatott-el-a-legfobb-ugyeszseg-az-aranykonvoj-ugyben',
        sourceLabel: '444',
      },
      {
        title: 'NER rendszer kiépítése',
        description: 'A Nemzeti Együttműködés Rendszere keretében szisztematikusan kerültek az állami megrendelések Orbán-közeliekhez — Mészáros, Tiborcz, Balásy és más oligarchák cégeihez — közbeszerzési verseny mellőzésével.',
        estimatedDamage: 'Több ezer milliárd Ft (teljes rendszer)',
        crimeTypes: ['Közbeszerzési visszaélés', 'Összeférhetetlenség', 'Közhatalommal visszaélés'],
        sourceUrl: 'https://telex.hu/g7/penz/2026/06/16/ner-vagyon-leggazdagabb-magyarok',
        sourceLabel: 'Telex / G7',
      },
      {
        title: 'Nemzeti Múzeum műkincs-elajándékozás',
        description: 'A Válasz Online 2026 májusában tárta fel, hogy az Orbán-kormány Zsigmond Ágost lengyel király diszpáncélját — a Nemzeti Múzeum egyik legritkább középkori darabját — elajándékozta Lengyelországnak. Az átadás mögött NER-diplomáciai érdekek állnak; a döntés a köz megkérdezése és parlamenti jóváhagyás nélkül született.',
        estimatedDamage: '1,53 milliárd Ft',
        crimeTypes: ['Nemzeti örökség elherdálása', 'Közvagyon elajándékozása', 'Átláthatóság megsértése'],
        sourceUrl: 'https://www.valaszonline.hu/2026/05/15/zsigmond-agost-diszpancelja-elajandekozas-nemzeti-muzeum-mutargyak-ner-lengyelorszag/',
        sourceLabel: 'Válasz Online',
      },
    ],
  },
  {
    id: 'rogan-antal',
    name: 'Rogán Antal',
    subtitle: 'Volt kabinetirodát vezető miniszter',
    description: 'A letelepedési kötvény-botrány kulcsfigurája: Rogán Antal belügyminiszteri szerepkörében felügyelte azt a programot, amelyen keresztül kb. 7 000 tartózkodási engedély kelt el egyenként 300 000 euróért — a kezelési díjak és jutalékok Rogán-közeli offshore hálózatokba folytak. Az USA OFAC 2024-ben szankciókat vetett ki rá korrupcióval és demokratikus intézmények aláásásával összefüggésben.',
    detention: 'investig',
    detentionLabel: 'OFAC szankció · vizsgálat',
    crimes: ['Letelepedési kötvény botrány', 'OFAC szankció', 'Befolyással visszaélés'],
    amountLabel: 'Becsült érintett összeg',
    amount: 'Több száz milliárd Ft',
    variant: 0, glasses: false, hair: 'short',
    photoUrl: 'https://image.blikk.hu/1/S9Ck9kpTURBXy81ZjE4ZDcwZjI3M2FmYzE0ZjY1YWZkNmNkZDk5ODA1Ny5qcGeTlQMAO80Ra80JzJMJpmY2OGQ5MAaTBc0DMM0CZN4AAaEwBQ/rogan-antal-megszolalt-a-valasztasok-utan-foto-korponai-tamas',
    photoCredit: 'Blikk / Korponai Tamás',
    videoId: 'ePRovUEGY1c',
    newsTag: 'rogán',
    newsKeywords: ['rogán antal', 'rogán', 'letelepedési kötvény'],
    personCases: [
      {
        title: 'Letelepedési kötvény-botrány',
        description: 'A 2012–2017 között működő program keretében Magyarország tartózkodási engedélyeket értékesített főleg kínai és közel-keleti befektetőknek, egyenként 300 000 euróért. A kötvények kibocsátását és értékesítését irányító offshore cégek (köztük a Discus Holdings és az Arton Capital) Rogán-közeli hálózatokhoz köthetők. A program 2,1 milliárd eurós forgalmat bonyolított, miközben az átvilágítás minimális volt — az OLAF és több külföldi hatóság is vizsgálta.',
        estimatedDamage: '~2,1 milliárd EUR (teljes programforgalom)',
        crimeTypes: ['Korrupció', 'Pénzmosás', 'Befolyással visszaélés', 'Átláthatóság megsértése'],
        sourceUrl: 'https://444.hu/2018/10/08/30-milliard-forintot-buktak-a-magyar-emberek-a-rogan-fele-letelepedesi-kotvenyeken',
        sourceLabel: '444',
      },
      {
        title: 'NAV nyomozás – Rogán találmánya',
        description: 'A NAV nyomozása, amely Rogán Antal "találmányaként" elhíresült offshore-hálózat előzményeit vizsgálja, 2026-ban is aktívan folyik — a 444.hu szerint a nyomozás nem állt le, sőt kiszélesedett.',
        crimeTypes: ['Korrupció', 'Pénzmosás (gyanú)', 'Adócsalás (gyanú)'],
        sourceUrl: 'https://444.hu/2026/06/11/nem-allt-le-sot-aktivan-folyik-az-a-nav-os-nyomozas-ami-rogan-antal-talalmanyanak-elozmenyeit-is-vizsgalja',
        sourceLabel: '444',
      },
      {
        title: 'OFAC szankció',
        description: 'Az USA Pénzügyminisztériuma 2024-ben szankciókat vetett ki Rogánra, részletezve a korrupciót és a demokratikus intézmények szisztematikus aláásását. A szankció a letelepedési kötvény-hálózathoz is kapcsolódik.',
        crimeTypes: ['Korrupció', 'Demokratikus intézmények aláásása'],
        sourceUrl: 'https://24.hu/belfold/2025/01/07/rogan-antal-usa-szankcios-lista-magnyickij-torveny-korrupcio/',
        sourceLabel: '24.hu',
      },
      {
        title: 'NER propagandagépezet',
        description: 'Rogán Antal a Centrál Médiacsoport és a KESMA médiakonszolidáció mögötti politikai irányítóként koordinálta az állami hirdetési pénzek politikailag lojális médiumokhoz irányítását.',
        estimatedDamage: 'Több száz milliárd Ft reklámköltés',
        crimeTypes: ['Befolyással visszaélés', 'Közhatalommal visszaélés'],
        sourceUrl: 'https://444.hu/2026/06/14/101-ev-plakathiszteria-rogan-antal-es-balasy-gyula-magyarorszagan',
        sourceLabel: '444',
      },
    ],
  },
  {
    id: 'meszaros-lorinc',
    name: 'Mészáros Lőrinc',
    subtitle: 'Üzletember · Felcsút',
    description: 'Orbán Viktor gyerekkori barátja az elmúlt évtizedben az ország leggazdagabb emberévé vált — közbeszerzések, energetikai koncessziók és médiabirodalom révén. Vagyona 2010 előtt néhány száz millió, 2026-ra közel 900 milliárd forintra becsült.',
    detention: 'investig',
    detentionLabel: 'Vagyonvizsgálat folyamatban',
    crimes: ['Közbeszerzési visszaélés', 'Jogtalan vagyonosodás', 'Bennfentes ügyletek'],
    amountLabel: 'Becsült vagyonnövekedés',
    amount: '~900 milliárd Ft',
    variant: 3, glasses: false, hair: 'bald',
    photoUrl: 'https://kep.cdn.indexvas.hu/1/0/1985/19857/198573/19857367_80ff5bffe0beda9d134343dec5c5d50d_wm.jpg',
    photoCredit: 'index.hu',
    videoId: 'rFpHB2w_O1o',
    newsTag: 'Mészáros Lőrinc',
    newsKeywords: ['mészáros lőrinc', 'mészáros'],
    personCases: [
      {
        title: 'Közbeszerzési birodalom',
        description: '2010 és 2026 között Mészáros cégei több ezer milliárdos állami és EU-finanszírozott közbeszerzési megrendelést nyertek el. Az Opus Global Nyrt. napjainkra az egyik legnagyobb magyar vállalat.',
        estimatedDamage: 'Több ezer milliárd Ft (közbeszerzések)',
        crimeTypes: ['Közbeszerzési visszaélés', 'Összeférhetetlenség'],
        sourceUrl: 'https://rtl.hu/hirado/2026/06/16/meszaros-lorinc-tovabbra-is-a-leggazdagabb-magyar-rekordot-dontott-a-hazai-milliardosok-vagyona',
        sourceLabel: 'RTL Híradó',
      },
      {
        title: 'KESMA médiakonszolidáció',
        description: 'Mészáros Lőrinc nevéhez fűződik a KESMA (Közép-európai Sajtó és Média Alapítvány) létrehozása, amely 500+ médiumot tömörít — így a politikailag lojális sajtó fenntartásának pénzügyi motorja.',
        crimeTypes: ['Médiapiaci torzítás', 'Politikai befolyásszerzés'],
        sourceUrl: 'https://telex.hu/tag/kesma',
        sourceLabel: 'Telex',
      },
    ],
  },
  {
    id: 'tiborcz-istvan',
    name: 'Tiborcz István',
    subtitle: 'Orbán Viktor veje · BDPST Csoport alapítója',
    description: 'Tiborcz cégei 2011–2015 között közel 50 milliárd forintnyi EU-finanszírozott közvilágítási szerződést szereztek az Elios Innovatív Zrt.-n keresztül — az OLAF 16 milliárd Ft visszafizetését javasolta, magyar büntetőeljárás nem indult. A BDPST Csoporton keresztül azóta prémium ingatlanokból álló birodalmat épített ki: a cégcsoport becsült vagyona meghaladja a 188 milliárd forintot, 52 milliárd forint felhalmozott eredménytartalékkal. Orbán vejének politikai kapcsolatai vitathatatlan versenyelőnyt biztosítottak.',
    detention: 'investig',
    detentionLabel: 'OLAF vizsgálat · visszafizetés ajánlva',
    crimes: ['EU-forrás szabálytalan felhasználása', 'Bennfentes közbeszerzés', 'Jogtalan vagyonosodás'],
    amountLabel: 'Becsült vagyon (BDPST csoport)',
    amount: '188+ milliárd Ft',
    variant: 5, glasses: false, hair: 'short',
    photoUrl: 'https://bbj.hu/wp-content/uploads/2024/06/Tiborcz-Istvan-OK-1-1365x2048.jpg.webp',
    photoCredit: 'bbj.hu',
    videoId: '26q4cPw-W3A',
    newsTag: 'Tiborcz',
    newsKeywords: ['tiborcz istván', 'tiborcz', 'elios'],
    personCases: [
      {
        title: 'Elios Innovatív Zrt. – közvilágítási botrány',
        description: 'Az Elios 2011–2015 között ~50 milliárdos EU-s közvilágítási tender-sorozatot nyert. Az OLAF 2017-ben 43,7 millió EUR szabálytalanságot tárt fel. Tiborcz 2015-ben eladta részesedését, de a vizsgálat alatt.',
        estimatedDamage: '43,7 millió EUR (OLAF javaslat)',
        crimeTypes: ['EU-forrás szabálytalan felhasználása', 'Bennfentes közbeszerzés'],
        sourceUrl: 'https://atlatszo.hu/kozpenz/2022/02/04/vegre-nyilvanos-az-elios-ugyrol-szolo-olaf-jelentes-bar-tiborcz-istvan-es-az-elios-nevet-kitakartak-benne/',
        sourceLabel: 'Átlátszó',
      },
      {
        title: 'BDPST Csoport – ingatlanbirodalom',
        description: 'Tiborcz a Párisi Udvar felújításával indult, azóta a BDPST Csoport az egyik legnagyobb prémium ingatlanfejlesztő Magyarországon. A cégcsoport 52 milliárd Ft eredménytartalékot halmozott fel; teljes becsült vagyona 188 milliárd Ft feletti. 2015–2026 között 11,4 milliárd Ft osztalékot vett ki. Az ingatlanok megszerzése és finanszírozása rendszeres sajtókritika tárgyát képezi.',
        estimatedDamage: '188+ milliárd Ft (becsült cégvagyon)',
        crimeTypes: ['Jogtalan vagyonosodás (gyanú)', 'Összeférhetetlenség'],
      },
      {
        title: 'Andezit Holding – magántőkealap',
        description: '2026 tavaszán az Andezit Holding és az ahhoz kötött magántőkealap-struktúra kapott sajtófigyelmet: állami hátterű pénzek és Tiborcz-érdekeltségek összefonódásáról számoltak be.',
        crimeTypes: ['Összeférhetetlenség (gyanú)', 'Közvagyon-közel üzleti érdekek'],
        sourceUrl: 'https://24.hu/fn/gazdasag/2026/04/01/tiborcz-istvan-andezit-magantokealap/',
        sourceLabel: '24.hu',
      },
      {
        title: 'Galyatetői hotel – közpénzmilliárdos felügyelet',
        description: 'Az Átlátszó 2026-ban tárta fel, hogy Tiborcz István és Orbán Ráhel is felügyeli a galyatetői szállodai beruházást, amelybe közpénzmilliárdok folynak.',
        crimeTypes: ['Összeférhetetlenség', 'Közvagyon-közel magánérdek'],
        sourceUrl: 'https://atlatszo.hu/orszagszerte/2026/06/15/galyatetoi-hotel-tiborcz-istvan-es-orban-rahel-is-felugyeli-a-kozpenzmilliardos-beruhazast/',
        sourceLabel: 'Átlátszó',
      },
    ],
  },
  {
    id: 'szijjarto-peter',
    name: 'Szíjjártó Péter',
    subtitle: 'Volt külügyminiszter',
    description: 'Miniszteri időszaka alatt több stratégiai szerződés körül érdekkonfliktust és átláthatósági problémákat azonosított a sajtó. Az azerbajdzsáni és orosz energetikai cégekhez fűződő üzleti kapcsolatai 2026-ban parlamenti vizsgálat tárgyát képezik.',
    detention: 'investig',
    detentionLabel: 'Vizsgálat folyamatban',
    crimes: ['Érdekkonfliktus', 'Átláthatóság megsértése', 'Közbeszerzési visszaélés'],
    amountLabel: 'Érintett szerződések értéke',
    amount: 'Több száz milliárd Ft',
    variant: 4, glasses: false, hair: 'short',
    photoUrl: 'https://symposium.org/wp-content/uploads/2023/12/Szijjarto_Peter_kep.jpg',
    photoCredit: 'symposium.org',
    videoId: '89pePZybTXo',
    newsTag: 'Szíjjártó Péter',
    newsKeywords: ['szíjjártó péter', 'szíjjártó'],
    personCases: [
      {
        title: 'Azerbajdzsáni kapcsolatok',
        description: 'Szíjjártó miniszteri évei alatt kötött azerbajdzsáni energetikai és befektetési szerződések körül az ellenzék és a sajtó összeférhetetlenséget azonosított. A Vagif Aliyev-üggyel való kapcsolat vizsgálat alatt.',
        crimeTypes: ['Érdekkonfliktus', 'Közbeszerzési visszaélés'],
        sourceUrl: 'https://telex.hu/tag/szijjarto-peter',
        sourceLabel: 'Telex',
      },
      {
        title: 'Felesége cégének terjeszkedése',
        description: 'A HVG 2026-ban tárta fel, hogy Szíjjártó Péter felesége, Nagy Szilvia interior design cége a miniszteri évek alatt figyelemre méltó terjeszkedésen esett át — az összeférhetetlenség és a politikai protekció gyanúja sajtóvitát váltott ki.',
        crimeTypes: ['Összeférhetetlenség (gyanú)', 'Közvetlen érdekkonfliktus'],
        sourceUrl: 'https://hvg.hu/kkv/20260531_szijjarto-peter-nagy-szilvia-interior-design',
        sourceLabel: 'HVG',
      },
    ],
  },
  {
    id: 'takacs-peter',
    name: 'Takács Péter',
    subtitle: 'Volt egészségügyi államtitkár',
    description: 'A 2020-as lélegeztetőgép-vásárlás körül derült ki, hogy Takács sógora (Kőszegi Gábor) és Orbán főtanácsadójának fivére a Fourcardinal Zrt.-ből összesen milliárdos osztalékot vont ki. KEHI és NAV vizsgálata eljárás nélkül zárult.',
    detention: 'loose',
    detentionLabel: 'Nincs ismert eljárás',
    crimes: ['Érdekkonfliktus', 'Összeférhetetlenség'],
    amountLabel: 'Sógor által felvett osztalék',
    amount: '~8 milliárd Ft',
    variant: 1, glasses: true, hair: 'short',
    photoUrl: 'https://kep.cdn.indexvas.hu/1/0/6426/64266/642665/64266583_02646dcda0e9534845ab8f0750026dc5_wm.jpg',
    photoCredit: 'Index',
    videoId: 'DrHUAmHMZBM',
    newsTag: 'Takács Péter',
    newsKeywords: ['takács péter', 'lélegeztetőgép', 'fourcardinal'],
    personCases: [
      {
        title: 'Lélegeztetőgép-botrány – rokoni kapcsolat',
        description: 'Takács Péter sógora (Kőszegi Gábor) a Silk Road Fund Holding Zrt.-n keresztül 8 milliárd Ft osztalékot vett fel a Fourcardinal Zrt.-ből — abból a cégből, amely a 300 milliárdos lélegeztetőgép-ügyletből hasznot húzott.',
        estimatedDamage: '~8 milliárd Ft (sógor osztaléka)',
        crimeTypes: ['Összeférhetetlenség', 'Érdekkonfliktus'],
        sourceUrl: 'https://444.hu/2026/06/08/a-fidesz-tovabbra-is-ott-tart-hogy-nem-vizsgalni-kellene-a-300-milliardos-lelegeztetogep-beszerzest-hanem-megkoszonni-azt',
        sourceLabel: '444',
      },
    ],
  },
  {
    id: 'matolcsy-gyorgy',
    name: 'Matolcsy György',
    subtitle: 'Volt MNB-elnök',
    description: 'Matolcsy György az MNB elnökeként 2013–2025 között 266 milliárd forintnyi közpénzt csatornázott át a jegybank alapítványain keresztül. Az ÁSZ (Állami Számvevőszék) kiszivárgott jelentés-tervezete súlyos vagyonvesztést és szabálytalanságokat tárt fel. Az ügyészség 2026-ban nyomozást indított hűtlen kezelés és más bűncselekmények gyanúja miatt.',
    detention: 'investig',
    detentionLabel: 'Nyomozás folyamatban',
    crimes: ['Hűtlen kezelés', 'Közpénzek hűtlen kezelése', 'Közhatalommal visszaélés'],
    amountLabel: 'ÁSZ által feltárt vagyonvesztés',
    amount: '266+ milliárd Ft',
    variant: 5, glasses: false, hair: 'wave',
    photoUrl: 'https://www.valaszonline.hu/wp-content/uploads/2025/04/ADSZZS202004160004-1536x864.jpg',
    photoCredit: 'Válasz Online',
    videoId: 'bgA0PTDFKlY',
    newsTag: 'MNB',
    newsKeywords: ['matolcsy', 'mnb botrány', 'jegybank botrány', 'mnb-ügy'],
    personCases: [
      {
        title: 'MNB alapítványok – vagyonvesztés',
        description: 'Az MNB 266 milliárd forintot utalt át alapítványaiba (PSFN és társai), amelyek az ÁSZ kiszivárgott jelentés-tervezete szerint súlyos vagyonvesztést szenvedtek el. Az alapítványok céljai és a tényleges felhasználás között óriási szakadék tátong.',
        estimatedDamage: '266+ milliárd Ft',
        crimeTypes: ['Hűtlen kezelés', 'Közpénzek szabálytalan felhasználása'],
        sourceUrl: 'https://telex.hu/gazdasag/2026/06/11/matolcsy-gyorgy-170-millio-szabadsag-magyar-nemzeti-bank-vizsgalat',
        sourceLabel: 'Telex',
      },
      {
        title: 'ÁSZ vizsgálat és a kiszivárgott jelentés',
        description: 'Az Állami Számvevőszék jelentés-tervezete 2025-ben szivárgott ki — súlyos vagyonvesztést, átláthatatlansági problémákat és más szabálytalanságokat tárt fel Matolcsy György alapítványi rendszerénél. A hivatalos ÁSZ-jelentés végleges verziója ezután politikai nyomás alatt módosult.',
        crimeTypes: ['Közhatalommal visszaélés', 'Közpénzek ellenőrzésének akadályozása'],
        sourceUrl: 'https://444.hu/2025/03/19/tobb-buncselekmeny-gyanujaval-feljelentest-tett-a-szamvevoszek-az-mnb-alapitvanyok-gazdalkodasa-miatt',
        sourceLabel: '444',
      },
      {
        title: 'MNB székházfelújítás és ingatlanügyek',
        description: 'A Telex feltárta, hogy az MNB székházfelújítási projektjében a RAW Development érintett, amellyel szemben feljelentés is érkezett. Az MNB Ingatlan Kft. ügyletei számos átláthatósági kérdést vetnek fel.',
        crimeTypes: ['Közbeszerzési visszaélés', 'Átláthatóság megsértése'],
        sourceUrl: 'https://telex.hu/gazdasag/2025/10/20/mnb-szekhaz-felujitas-mnb-ingatlan-kft-feljelentes-raw-development',
        sourceLabel: 'Telex',
      },
      {
        title: 'Kecskeméti Neumann János Egyetem alapítvány',
        description: 'Az MNB-közelből finanszírozott alapítvány által felvásárolt kecskeméti campus és az "okosváros" projekt sorsa a Matolcsy-klán távozása után kérdésessé vált. A Telex belső dokumentumokra hivatkozva tárta fel, hogy az Optimából 170 millió forint tűnt el.',
        crimeTypes: ['Közpénzek szabálytalan felhasználása', 'Összeférhetetlenség'],
        sourceUrl: 'https://telex.hu/gazdasag/2026/04/30/mnb-ugy-kecskemet-njea-neumann-janos-egyetem-boross-ildiko-optimabol-tunt-el-a-penzt',
        sourceLabel: 'Telex',
      },
    ],
  },
  {
    id: 'lazar-janos',
    name: 'Lázár János',
    subtitle: 'Volt építési és közlekedési miniszter · volt polgármester, Miniszterelnökséget vezető miniszter',
    description: 'Középosztályból érkező politikusként vált az ország egyik legvagyonosabb képviselőjévé: 46 ingatlan, 3 luxusautó, 1+ milliárd forint nettó vagyon egy közpénzből élő politikus esetén. A batidai kastélyhoz vezető utat 2024-ben 3,3 milliárd forint közpénzből újíttatta fel — miközben mint építési és közlekedési miniszter dönthetett ilyen fejlesztésekről. Miniszterként egy tollvonással állíttatott le több száz MÁV-fejlesztést.',
    detention: 'investig',
    detentionLabel: 'Vagyonvizsgálat indokolt',
    crimes: ['Megmagyarázatlan vagyonosodás', 'Érdekkonfliktus', 'Közpénzek visszaélésszerű felhasználása'],
    amountLabel: 'Közpénzből felújított magánút',
    amount: 'min. 3,3 milliárd Ft',
    variant: 0, glasses: false, hair: 'short',
    photoUrl: 'https://ahang.hu/lopnak/wp-content/uploads/sites/3/2025/10/lazar-janos.jpg',
    photoCredit: 'ahang.hu',
    videoId: 'Zso0FRjX9cM',
    newsTag: 'Lázár',
    newsKeywords: ['lázár jános', 'lázár', 'batida'],
    personCases: [
      {
        title: 'Batida kastély és a 3,3 milliárdos közút',
        description: 'Lázár János a batidai vadászháza körüli földek felvásárlására 181 millió forintot költött, és mára a kastély 40%-os tulajdonosa — korábban tagadta, hogy köze lenne az ingatlanhoz. 2024-ben az odavezető utat 3,3 milliárd forint közpénzből újíttatták fel, miközben Lázár mint építési és közlekedési miniszter felügyeli az ilyen beruházásokat.',
        estimatedDamage: '3,3 milliárd Ft (közút) · 181 millió Ft (földvásárlás)',
        crimeTypes: ['Érdekkonfliktus', 'Közpénzek visszaélésszerű felhasználása'],
        sourceUrl: 'https://444.hu/2025/04/14/kiveteles-alapossaggal-ujitottak-fel-a-lazar-janos-batidai-kastelyahoz-vezeto-utat',
        sourceLabel: '444',
      },
      {
        title: 'Megmagyarázatlan vagyonosodás',
        description: 'Lázár vagyonnyilatkozata szerint 46 ingatlan (3 lakóház, 35 szántó, 3 szőlő, 3 erdő, 1 töltés, 1 kivett mocsár), 3 luxusautó (Mini Cooper Cabrio, Land Rover Defender, Audi A6 Allroad), 200 millió Ft értékpapír, 90 millió Ft bankkövetelés, 30 millió Ft készpénz. A Népszava számítása szerint nettó vagyona meghaladja az 1 milliárd forintot.',
        estimatedDamage: '1+ milliárd Ft nettó vagyon',
        crimeTypes: ['Megmagyarázatlan vagyonosodás', 'Vagyonnyilatkozat-megkerülés gyanúja'],
        sourceUrl: 'https://nepszava.hu/3283192_lazar-janos-vagyona-milliardos',
        sourceLabel: 'Népszava',
      },
      {
        title: 'MÁV-fejlesztések leállítása',
        description: '2023-ban Lázár János egy döntéssel több száz MÁV fejlesztési projektet és részben karbantartási munkálatokat is felfüggesztett. 2024 júniusában ez közlekedési katasztrófához vezetett: a Budapest–Balaton vonalon a nyár első hétvégéin órákon át megbénult a vasúti forgalom.',
        crimeTypes: ['Közérdekű mulasztás', 'Közlekedésbiztonsági kockázat'],
        sourceUrl: 'https://nepszava.hu/3197594_lazar-janos-beruhazasok-felfuggesztes',
        sourceLabel: 'Népszava',
      },
    ],
  },
  {
    id: 'balasy-gyula',
    name: 'Balásy Gyula',
    subtitle: 'New Land Media alapítója',
    description: 'A New Land Media alapítója közel 700 milliárd forintnyi állami reklámköltést csatornázott át a Fidesz-közeli médiarendszeren keresztül. Balásy cégei közbeszerzés nélkül, háttéralkuk révén kapták a megrendeléseket. Az új kormány 2026-ban visszaköveti az állami pénzeket.',
    detention: 'investig',
    detentionLabel: 'Vagyonvizsgálat folyamatban',
    crimes: ['Közbeszerzési visszaélés', 'Állami pénzek hűtlen kezelése', 'Politikai összeférhetetlenség'],
    amountLabel: 'Érintett állami reklámköltés',
    amount: '~700 milliárd Ft',
    variant: 4, glasses: false, hair: 'wave',
    photoUrl: 'https://ahang.hu/lopnak/wp-content/uploads/sites/3/2025/09/balasy-gyula-1.jpg',
    photoCredit: 'ahang.hu',
    videoId: 'cslzmXaC51M',
    newsTag: 'Balásy Gyula',
    newsKeywords: ['balásy gyula', 'balásy', 'new land media'],
    personCases: [
      {
        title: 'Állami reklámbirodalom',
        description: 'Balásy Gyula New Land Media csoportja 2010–2026 között politikailag lojális médiumok felé irányította az állami reklámköltést, közbeszerzési verseny mellőzésével, közvetlen minisztériumi megrendelésekkel.',
        estimatedDamage: '~700 milliárd Ft (2010–2026)',
        crimeTypes: ['Közbeszerzési visszaélés', 'Hűtlen kezelés'],
        sourceUrl: 'https://telex.hu/gazdasag/2026/06/14/balasy-gyula-ceg-magantokealap-allam-felajanlas-vagyonleltar',
        sourceLabel: 'Telex',
      },
    ],
  },
  {
    id: 'semjen-zsolt',
    name: 'Semjén Zsolt',
    subtitle: 'Volt miniszterelnök-helyettes · KDNP elnök',
    description: 'A KDNP elnökeként és miniszterelnök-helyettesként az egyházi és vallási szektor milliárdos állami finanszírozásának kulcsszereplője. Nevéhez fűzódik az egyházi ingatlanok visszaadása és az aránytalanul magas egyházi normatívák rendszere, amelyek évente több tízmilliárd forint pluszt biztosítanak az egyházi fenntartóknak.',
    detention: 'loose',
    detentionLabel: 'Nincs ismert eljárás',
    crimes: ['Közpénzek aránytalanul elosztása', 'Egyházi privilégiumok jogtalan kiterjesztése'],
    amountLabel: 'Egyházi normatíva-különbözet',
    amount: 'Több száz milliárd Ft',
    variant: 1, glasses: true, hair: 'cap',
    photoUrl: 'https://temabaranya.hu/wp-content/uploads/2025/05/semjen_zsolt_vasarnap.hu_szennyes_krisztian_1000.jpg',
    photoCredit: 'témabaranya.hu',
    videoId: 'FlvGWxP5dzw',
    newsTag: 'Semjén',
    newsKeywords: ['semjén zsolt', 'semjén', 'zsolti bácsi', 'zsolt bácsi', 'kdnp'],
    personCases: [
      {
        title: 'Egyházi ingatlanvissza-adások',
        description: 'Semjén irányítása alatt az állam milliárd négyzetméternyi ingatlant adott vissza egyházaknak — sok esetben olyanokat is, amelyek sosem voltak egyházi tulajdonban, vagy amelyekre az egyháznak aktív igénye nem volt bizonyított.',
        estimatedDamage: 'Ismeretlen (ingatlanok piaci értéke)',
        crimeTypes: ['Közvagyon aránytalanul elosztása', 'Közhatalommal visszaélés'],
        sourceUrl: 'https://hvg.hu/itthon/20241114_Semjen-Zsolt-ingatlan-egyhaz-onkormanyzat-iskola',
        sourceLabel: 'HVG',
      },
      {
        title: 'Aránytalanul magas egyházi normatívák',
        description: 'Az egyházi iskolák állami normatívája 30–40%-kal magasabb az állami intézményeknél, miközben az egyházi szelekció torzítja az oktatási rendszert. A különbözet évente több tízmilliárd forint pluszt jelent az egyházi fenntartóknak.',
        estimatedDamage: 'Több tízmilliárd Ft/év',
        crimeTypes: ['Közpénzek aránytalanul elosztása'],
      },
    ],
  },
];
