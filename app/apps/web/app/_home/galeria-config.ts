export type GaleriaDetention = 'busted' | 'pretrial' | 'investig' | 'loose' | 'wanted';
export type GaleriaHair = 'short' | 'bald' | 'wave' | 'cap' | 'slick';

export interface PersonCaseItem {
  title: string;
  description: string;
  estimatedDamage?: string;
  crimeTypes: string[];
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
    subtitle: 'Miniszterelnök (2010–2026)',
    description: '16 éves kormányzás alatt épített ki rendszert, amelyben állami vagyon és közpénzek politikailag közelálló vállalkozókhoz áramlottak. Az aranykonvoj-ügyben ügyvéd benyújtott feljelentés terrorcselekmény gyanúját is felveti. A Hatvanpuszta-majorság forrása máig megmagyarázatlan.',
    detention: 'investig',
    detentionLabel: 'Feljelentés benyújtva',
    crimes: ['Hűtlen kezelés', 'Közpénzek elherdálása', 'Befolyással visszaélés'],
    amountLabel: 'Becsült közpénzérintettség',
    amount: 'Több ezer milliárd Ft',
    variant: 2, glasses: false, hair: 'slick',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Viktor_Orban_2025_%28cropped%29.jpg/400px-Viktor_Orban_2025_%28cropped%29.jpg',
    videoId: 'HiW9r1M32ug',
    newsTag: 'orbán',
    newsKeywords: ['orbán viktor', 'orbán', 'hatvanpuszta', 'aranykonvoj'],
    personCases: [
      {
        title: 'Hatvanpuszta',
        description: 'Orbán Viktor 250 hektáros, ~20 milliárd forintra becsült majorságának valódi tulajdonosa és finanszírozási forrása ismeretlen — az ingatlan értéke összeegyeztethetetlen Orbán nyilvánosan bejelentett vagyonával.',
        estimatedDamage: '~20 milliárd Ft (ingatlanérték)',
        crimeTypes: ['Vagyonnyilatkozat megsértése', 'Megmagyarázatlan vagyonosodás'],
      },
      {
        title: 'Aranykonvoj-ügy',
        description: '2026 tavaszán a NAV és a titkosszolgálat megakadályozott egy Ukrajna határán átkelő konvojt, amely aranyat és devizát szállított Orbán-közelből. Az ügyvéd feljelentésben terrorcselekmény-gyanú is szerepel.',
        estimatedDamage: 'Ismeretlen (arany + deviza)',
        crimeTypes: ['Pénzmosás', 'Terrorcselekmény (gyanú)', 'Csempészet'],
      },
      {
        title: 'NER rendszer kiépítése',
        description: 'A Nemzeti Együttműködés Rendszere keretében szisztematikusan kerültek az állami megrendelések Orbán-közeliekhez — Mészáros, Tiborcz, Balásy és más oligarchák cégeihez — közbeszerzési verseny mellőzésével.',
        estimatedDamage: 'Több ezer milliárd Ft (teljes rendszer)',
        crimeTypes: ['Közbeszerzési visszaélés', 'Összeférhetetlenség', 'Közhatalommal visszaélés'],
      },
    ],
  },
  {
    id: 'rogan-antal',
    name: 'Rogán Antal',
    subtitle: 'Kabinetirodát vezető miniszter',
    description: 'A letelepedési kötvény-botrány kulcsfigurája: Rogán Antal belügyminiszteri szerepkörében felügyelte azt a programot, amelyen keresztül kb. 7 000 tartózkodási engedély kelt el egyenként 300 000 euróért — a kezelési díjak és jutalékok Rogán-közeli offshore hálózatokba folytak. Az USA OFAC 2024-ben szankciókat vetett ki rá korrupcióval és demokratikus intézmények aláásásával összefüggésben.',
    detention: 'investig',
    detentionLabel: 'OFAC szankció · vizsgálat',
    crimes: ['Letelepedési kötvény botrány', 'OFAC szankció', 'Befolyással visszaélés'],
    amountLabel: 'Becsült érintett összeg',
    amount: 'Több száz milliárd Ft',
    variant: 0, glasses: false, hair: 'short',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Rog%C3%A1n_Antal_2009_Solymar_%28crop%29.jpg/400px-Rog%C3%A1n_Antal_2009_Solymar_%28crop%29.jpg',
    videoId: 'ePRovUEGY1c',
    newsTag: 'rogán',
    newsKeywords: ['rogán antal', 'rogán', 'letelepedési kötvény'],
    personCases: [
      {
        title: 'Letelepedési kötvény-botrány',
        description: 'A 2012–2017 között működő program keretében Magyarország tartózkodási engedélyeket értékesített főleg kínai és közel-keleti befektetőknek, egyenként 300 000 euróért. A kötvények kibocsátását és értékesítését irányító offshore cégek (köztük a Discus Holdings és az Arton Capital) Rogán-közeli hálózatokhoz köthetők. A program 2,1 milliárd eurós forgalmat bonyolított, miközben az átvilágítás minimális volt — az OLAF és több külföldi hatóság is vizsgálta.',
        estimatedDamage: '~2,1 milliárd EUR (teljes programforgalom)',
        crimeTypes: ['Korrupció', 'Pénzmosás', 'Befolyással visszaélés', 'Átláthatóság megsértése'],
      },
      {
        title: 'OFAC szankció',
        description: 'Az USA Pénzügyminisztériuma 2024-ben szankciókat vetett ki Rogánra, részletezve a korrupciót és a demokratikus intézmények szisztematikus aláásását. A szankció a letelepedési kötvény-hálózathoz is kapcsolódik.',
        crimeTypes: ['Korrupció', 'Demokratikus intézmények aláásása'],
      },
      {
        title: 'NER propagandagépezet',
        description: 'Rogán Antal a Centrál Médiacsoport és a KESMA médiakonszolidáció mögötti politikai irányítóként koordinálta az állami hirdetési pénzek politikailag lojális médiumokhoz irányítását.',
        estimatedDamage: 'Több száz milliárd Ft reklámköltés',
        crimeTypes: ['Befolyással visszaélés', 'Közhatalommal visszaélés'],
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
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FeHoVa_2024_%2813%29.jpg/400px-FeHoVa_2024_%2813%29.jpg',
    videoId: 'rFpHB2w_O1o',
    newsTag: 'Mészáros Lőrinc',
    newsKeywords: ['mészáros lőrinc', 'mészáros'],
    personCases: [
      {
        title: 'Közbeszerzési birodalom',
        description: '2010 és 2026 között Mészáros cégei több ezer milliárdos állami és EU-finanszírozott közbeszerzési megrendelést nyertek el. Az Opus Global Nyrt. napjainkra az egyik legnagyobb magyar vállalat.',
        estimatedDamage: 'Több ezer milliárd Ft (közbeszerzések)',
        crimeTypes: ['Közbeszerzési visszaélés', 'Összeférhetetlenség'],
      },
      {
        title: 'KESMA médiakonszolidáció',
        description: 'Mészáros Lőrinc nevéhez fűződik a KESMA (Közép-európai Sajtó és Média Alapítvány) létrehozása, amely 500+ médiumot tömörít — így a politikailag lojális sajtó fenntartásának pénzügyi motorja.',
        crimeTypes: ['Médiapiaci torzítás', 'Politikai befolyásszerzés'],
      },
    ],
  },
  {
    id: 'tiborcz-istvan',
    name: 'Tiborcz István',
    subtitle: 'Orbán Viktor veje · BDPST Csoport alapítója',
    description: 'Tiborcz cégei 2011–2015 között közel 50 milliárd forintnyi EU-finanszírozott közvilágítási szerződést szereztek az Elios Innovatív Zrt.-n keresztül. Az OLAF 43,7 millió EUR visszafizetését javasolta. Magyar büntetőeljárás nem indult.',
    detention: 'investig',
    detentionLabel: 'OLAF vizsgálat · visszafizetés ajánlva',
    crimes: ['EU-forrás szabálytalan felhasználása', 'Bennfentes közbeszerzés', 'Jogtalan vagyonosodás'],
    amountLabel: 'OLAF által jelzett összeg',
    amount: '43,7 millió EUR (~16 milliárd Ft)',
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
      },
      {
        title: 'BDPST Csoport – ingatlanbirodalom',
        description: 'Tiborcz a Párisi Udvar felújításával és más prémium ingatlanfejlesztésekkel hatalmas vagyont épített. Az ingatlanok megszerzésének körülményei rendszeres sajtókritika tárgyát képezik.',
        crimeTypes: ['Jogtalan vagyonosodás (gyanú)', 'Összeférhetetlenség'],
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
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/P%C3%A9ter_Szijj%C3%A1rt%C3%B3_in_2025_%28cropped%29.jpg/400px-P%C3%A9ter_Szijj%C3%A1rt%C3%B3_in_2025_%28cropped%29.jpg',
    videoId: '89pePZybTXo',
    newsTag: 'Szíjjártó Péter',
    newsKeywords: ['szíjjártó péter', 'szíjjártó'],
    personCases: [
      {
        title: 'Azerbajdzsáni kapcsolatok',
        description: 'Szíjjártó miniszteri évei alatt kötött azerbajdzsáni energetikai és befektetési szerződések körül az ellenzék és a sajtó összeférhetetlenséget azonosított. A Vagif Aliyev-üggyel való kapcsolat vizsgálat alatt.',
        crimeTypes: ['Érdekkonfliktus', 'Közbeszerzési visszaélés'],
      },
    ],
  },
  {
    id: 'takacs-peter',
    name: 'Takács Péter',
    subtitle: 'Egészségügyi államtitkár',
    description: 'A 2020-as lélegeztetőgép-vásárlás körül derült ki, hogy Takács sógora (Kőszegi Gábor) és Orbán főtanácsadójának fivére a Fourcardinal Zrt.-ből összesen milliárdos osztalékot vont ki. KEHI és NAV vizsgálata eljárás nélkül zárult.',
    detention: 'loose',
    detentionLabel: 'Nincs ismert eljárás',
    crimes: ['Érdekkonfliktus', 'Összeférhetetlenség'],
    amountLabel: 'Sógor által felvett osztalék',
    amount: '~8 milliárd Ft',
    variant: 1, glasses: true, hair: 'short',
    photoUrl: 'https://static-wq-old.magyarhirlap.hu/images/202308/md/306345908-106373672225799-7326414474872785375-n.jpg',
    photoCredit: 'Magyar Hírlap',
    videoId: 'DrHUAmHMZBM',
    newsTag: 'Takács Péter',
    newsKeywords: ['takács péter', 'lélegeztetőgép', 'fourcardinal'],
    personCases: [
      {
        title: 'Lélegeztetőgép-botrány – rokoni kapcsolat',
        description: 'Takács Péter sógora (Kőszegi Gábor) a Silk Road Fund Holding Zrt.-n keresztül 8 milliárd Ft osztalékot vett fel a Fourcardinal Zrt.-ből — abból a cégből, amely a 300 milliárdos lélegeztetőgép-ügyletből hasznot húzott.',
        estimatedDamage: '~8 milliárd Ft (sógor osztaléka)',
        crimeTypes: ['Összeférhetetlenség', 'Érdekkonfliktus'],
      },
    ],
  },
  {
    id: 'matolcsy-gyorgy',
    name: 'Matolcsy György',
    subtitle: 'Volt MNB-elnök (2013–2025)',
    description: 'Matolcsy György az MNB elnökeként 2013–2025 között 266 milliárd forintnyi közpénzt csatornázott át a jegybank alapítványain keresztül. Az ÁSZ (Állami Számvevőszék) kiszivárgott jelentés-tervezete súlyos vagyonvesztést és szabálytalanságokat tárt fel. Az ügyészség 2026-ban nyomozást indított hűtlen kezelés és más bűncselekmények gyanúja miatt.',
    detention: 'investig',
    detentionLabel: 'Nyomozás folyamatban',
    crimes: ['Hűtlen kezelés', 'Közpénzek hűtlen kezelése', 'Közhatalommal visszaélés'],
    amountLabel: 'ÁSZ által feltárt vagyonvesztés',
    amount: '266+ milliárd Ft',
    variant: 5, glasses: false, hair: 'wave',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Matolcsy-Gy%C3%B6rgy_Portrait.jpg/400px-Matolcsy-Gy%C3%B6rgy_Portrait.jpg',
    videoId: 'bgA0PTDFKlY',
    newsTag: 'MNB',
    newsKeywords: ['matolcsy', 'mnb botrány', 'jegybank botrány', 'mnb-ügy'],
    personCases: [
      {
        title: 'MNB alapítványok – vagyonvesztés',
        description: 'Az MNB 266 milliárd forintot utalt át alapítványaiba (PSFN és társai), amelyek az ÁSZ kiszivárgott jelentés-tervezete szerint súlyos vagyonvesztést szenvedtek el. Az alapítványok céljai és a tényleges felhasználás között óriási szakadék tátong.',
        estimatedDamage: '266+ milliárd Ft',
        crimeTypes: ['Hűtlen kezelés', 'Közpénzek szabálytalan felhasználása'],
      },
      {
        title: 'ÁSZ vizsgálat és a kiszivárgott jelentés',
        description: 'Az Állami Számvevőszék jelentés-tervezete 2025-ben szivárgott ki — súlyos vagyonvesztést, átláthatatlansági problémákat és más szabálytalanságokat tárt fel Matolcsy György alapítványi rendszerénél. A hivatalos ÁSZ-jelentés végleges verziója ezután politikai nyomás alatt módosult.',
        crimeTypes: ['Közhatalommal visszaélés', 'Közpénzek ellenőrzésének akadályozása'],
      },
      {
        title: 'MNB székházfelújítás és ingatlanügyek',
        description: 'A Telex feltárta, hogy az MNB székházfelújítási projektjében a RAW Development érintett, amellyel szemben feljelentés is érkezett. Az MNB Ingatlan Kft. ügyletei számos átláthatósági kérdést vetnek fel.',
        crimeTypes: ['Közbeszerzési visszaélés', 'Átláthatóság megsértése'],
      },
      {
        title: 'Kecskeméti Neumann János Egyetem alapítvány',
        description: 'Az MNB-közelből finanszírozott alapítvány által felvásárolt kecskeméti campus és az "okosváros" projekt sorsa a Matolcsy-klán távozása után kérdésessé vált. A Telex belső jegyzőkönyvekre hivatkozva tárta fel a visszásságokat.',
        crimeTypes: ['Közpénzek szabálytalan felhasználása', 'Összeférhetetlenség'],
      },
    ],
  },
  {
    id: 'szalay-bobrovniczky',
    name: 'Szalay-Bobrovniczky Kristóf',
    subtitle: 'Volt honvédelmi miniszter',
    description: 'A honvédelmi tárca irányítása alatt kötött fegyverzetbeszerzési és infrastrukturális szerződések átláthatóságát az ellenzék és a sajtó megkérdőjelezte. A közbeszerzési eljárások mellőzésével kötött megállapodások vizsgálata 2026-ban megkezdődött.',
    detention: 'investig',
    detentionLabel: 'Vizsgálat folyamatban',
    crimes: ['Közbeszerzési visszaélés', 'Átláthatóság hiánya'],
    amountLabel: 'Érintett szerződések értéke',
    amount: 'Több száz milliárd Ft',
    variant: 0, glasses: false, hair: 'short',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Szalay-Bobrovniczky_Krist%C3%B3f_-.jpg/400px-Szalay-Bobrovniczky_Krist%C3%B3f_-.jpg',
    videoId: 'mUNhhIxmMAA',
    newsTag: 'Szalay-Bobrovniczky',
    newsKeywords: ['szalay-bobrovniczky', 'szalay bobrovniczky', 'honvédelmi'],
    personCases: [
      {
        title: 'Honvédelmi közbeszerzések',
        description: 'A Rheinmetall és más fegyvergyártókkal kötött szerződések, valamint hazai védelmi fejlesztési programok transzparenciájáról az ellenzék és a Számvevőszék is aggályokat fogalmazott meg.',
        crimeTypes: ['Közbeszerzési visszaélés', 'Átláthatóság megsértése'],
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
      },
    ],
  },
  {
    id: 'semjen-zsolt',
    name: 'Semjén Zsolt',
    subtitle: 'Miniszterelnök-helyettes · KDNP elnök · "Zsolt bácsi"',
    description: '"Zsolt bácsi" — ahogy a NER-ben hívják — a KDNP elnökeként és miniszterelnök-helyettesként az egyházi és vallási szektor milliárdos állami finanszírozásának kulcsszereplője. Nevéhez fűzödik az egyházi ingatlanok visszaadása és az aránytalanul magas egyházi normatívák rendszere.',
    detention: 'loose',
    detentionLabel: 'Nincs ismert eljárás',
    crimes: ['Közpénzek aránytalanul elosztása', 'Egyházi privilégiumok jogtalan kiterjesztése'],
    amountLabel: 'Egyházi normatíva-különbözet',
    amount: 'Több száz milliárd Ft (2010–2026)',
    variant: 1, glasses: true, hair: 'cap',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Semjen_Zsolt_portre.jpg/400px-Semjen_Zsolt_portre.jpg',
    videoId: 'FlvGWxP5dzw',
    newsTag: 'Semjén',
    newsKeywords: ['semjén zsolt', 'semjén', 'zsolt bácsi', 'kdnp'],
    personCases: [
      {
        title: 'Egyházi ingatlanvissza-adások',
        description: 'Semjén irányítása alatt az állam milliárd négyzetméternyi ingatlant adott vissza egyházaknak — sok esetben olyanokat is, amelyek sosem voltak egyházi tulajdonban, vagy amelyekre az egyháznak aktív igénye nem volt bizonyított.',
        estimatedDamage: 'Ismeretlen (ingatlanok piaci értéke)',
        crimeTypes: ['Közvagyon aránytalanul elosztása', 'Közhatalommal visszaélés'],
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
