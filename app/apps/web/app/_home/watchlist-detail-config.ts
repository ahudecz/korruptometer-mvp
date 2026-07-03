export interface WatchlistKeyCase {
  title: string;
  description: string;
  crimeTypes: string[];
  sourceUrl?: string;
  sourceLabel?: string;
  videoId?: string;
  videoLabel?: string;
  videoTitle?: string;
  videoSummary?: string;
}

export interface WatchlistVideoSummary {
  source: string;
  title: string;
  description: string;
}

export interface WatchlistPinnedLink {
  url: string;
  title: string;
  source: string;
}

export interface WatchlistBreakingBlock {
  source: string;
  date: string;
  headline: string;
  lead?: string;
  url?: string;
}

export interface WatchlistDetailEntry {
  id: string;
  fullTitle: string;
  bio: string;
  nerRole: string;
  keyCases: WatchlistKeyCase[];
  newsKeywords: string[];
  videoId?: string;
  videoSummary?: WatchlistVideoSummary;
  pinnedLinks?: WatchlistPinnedLink[];
  breakingBlock?: WatchlistBreakingBlock;
}

export const WATCHLIST_DETAIL: WatchlistDetailEntry[] = [
  {
    id: 'sulyok-tamas',
    fullTitle: 'köztársasági elnök',
    videoId: 'BeWp_rHonOY',
    videoSummary: {
      source: 'ATV Magyarország',
      title: 'Sulyok nem mond le — Alaptörvény-módosítás jöhet',
      description: 'ATV riport: Sulyok Tamás minden lemondási felszólítást visszautasít, miközben a Fidesz alaptörvény-módosítással próbálja bebetonozni az elnök pozícióját.',
    },
    bio: 'Sulyok Tamás 2024 februárjában lett Magyarország köztársasági elnöke, miután elődje, Novák Katalin a kegyelmi botrány miatt lemondott. Korábban az Alkotmánybíróság elnökeként következetesen Fidesz-érdekeket képviselő döntéseket hozott. Elnökként egyetlen politikailag kényelmetlen törvényt sem küldött vissza az Országgyűlésnek, súlyos botrányokban hallgatott, és Oroszországgal szembeni bármilyen határozottabb állásfoglalást is kerül.',
    nerRole: 'Sulyok a NER egyik kulcsfontosságú jogi pillérét testesíti meg: az Alkotmánybíróságot a Fidesz befolyása alá vonta. Köztársasági elnökként az ország legfontosabb szimbolikus és jogi intézményének kellene lennie — ehelyett hallgatásával és tétlenségével fedezi a rendszert.',
    keyCases: [
      {
        title: 'Kegyelmi ügy folytatása',
        description: 'Sulyok elnöksége az előd kegyelmi botránya árnyékában kezdődött. Az új elnök nem tett lépéseket az ügy teljes kivizsgálása irányában, és a kegyelmi rendszer átláthatóbbá tétele sem szerepelt programjában.',
        crimeTypes: ['intézményi átláthatóság hiánya', 'felelősségre vonás akadályozása'],
      },
      {
        title: 'Alkotmánybírósági elfogultság',
        description: 'Az Ab elnökeként Sulyok vezette azt a testületet, amelyik az ellenzéki önkormányzatokat hátrányosan érintő finanszírozási törvényeket rendre alkotmányosnak nyilvánította, miközben a Fideszt érintő ügyeket évekig nem tárgyalta.',
        crimeTypes: ['hatalmi visszaélés', 'bírói függetlenség sérelme'],
        sourceUrl: 'https://telex.hu/belfold/2024/02/27/sulyok-tamas-koztarsasagi-elnok-alkotmanybiro-kazai-viktor-zoltan-elemzes',
        sourceLabel: 'Telex',
      },
      {
        title: 'Poloskázás-botrányban hallgatott',
        description: 'A „poloskák" kifejezés körül kirobbant politikai botrány — amelynek középpontjában a lehallgatóeszközök és a gyűlöletkeltés vádjai álltak — közvetlen elnöki reakciót várt volna el. Sulyok Tamás köztársasági elnök nem szólalt fel, sem az üggyel kapcsolatos jogi és etikai aggályokban, sem Magyar Péter ezzel összefüggő nyilatkozataira reagálva.',
        crimeTypes: ['elnöki tétlenség', 'intézményi passzivitás'],
        sourceUrl: 'https://24.hu/belfold/2025/03/31/sulyok-tamas-gyuloletbeszed-reakcio-magyar-peter-orban-viktor-poloska/',
        sourceLabel: '24.hu',
      },
      {
        title: 'Törölte az „orosz" szót a munkácsi rakétatámadásnál',
        description: '2025 augusztusában orosz rakéta csapott le a kárpátaljai Munkácsra, ahol magyarok is laknak. Sulyok közzétett egy részvétnyilvánítást, majd utólag kivágta belőle az „orosz" szót — a módosítást a Telex is rögzítette. Ez az egyetlen eset is jelzi, mennyire kerüli Oroszország nevesítését.',
        crimeTypes: ['Oroszország-barát passzivitás', 'elnöki hitelesség sérelme'],
        sourceUrl: 'https://telex.hu/belfold/2025/08/21/sulyok-tamas-ukrajna-munkacs-karpatalja-orosz-raketatamadas-egyutterzes',
        sourceLabel: 'Telex',
      },
      {
        title: 'Gandalf-ügyben hallgatott',
        description: 'A Gandalf-ügy Magyar Péter szerint a magyar demokrácia legnagyobb politikai és nemzetbiztonsági botránya: titkosszolgálati visszaélésekről és a politikai ellenfelek megfigyeléséről szólt. A köztársasági elnöknek intézményes feladata lett volna a parlament és az alkotmányosság védelmében felszólalni — Sulyok ezt nem tette.',
        crimeTypes: ['elnöki tétlenség', 'alkotmányos felelősség elmulasztása'],
        sourceUrl: 'https://24.hu/belfold/2026/03/31/magyar-peter-sulyok-tamas-uzenet-titkosszolgalat/',
        sourceLabel: '24.hu',
      },
    ],
    pinnedLinks: [
      {
        url: 'https://hvg.hu/itthon/20260618_jogtudosok-kozjogi-tisztsegviselok-levaltasa-sulyok-tamas-kuria-alkotmanybirosag',
        title: 'Jogtudósok: le kell váltani Sulyok Tamást, a Kúria és az Alkotmánybíróság elnökét',
        source: 'HVG',
      },
    ],
    newsKeywords: ['Sulyok Tamás', 'köztársasági elnök', 'Sulyok elnök'],
  },
  {
    id: 'polt-peter',
    fullTitle: 'Alkotmánybíróság elnöke',
    videoId: 'UEsS6-d6pfw',
    videoSummary: {
      source: 'Momentum Mozgalom',
      title: 'Polt „válasza" a korrupciós vádakra',
      description: 'A Momentum összeállítása Polt Péter egész pályafutását végigköveti: 21 éven át egyetlen NER-közeli korrupciós ügyre sem reagált — ez a videó megmutatja, hogyan nézett ki ez a gyakorlatban.',
    },
    bio: 'Polt Péter 21 évig volt Magyarország legfőbb ügyésze — 1990–1994, majd 2010–2025 között —, ezzel ő töltötte be a leghosszabb ideig ezt a posztot Európában. 2025-ben az Alkotmánybíróság elnöke lett. Ügyészként a Telex összefoglalója szerint szisztematikusan megakadályozta a NER-hez kötődő korrupciós nyomozásokat: az Elios-ügyet, a lélegeztetőgép-közbeszerzést, az MNB-alapítványok ügyét és a Microsoft-licencelési botrányt sem vitte vádig.',
    nerRole: 'Polt az igazságszolgáltatás leghatékonyabb kapusává vált: bármennyire is bizonyítottnak látszott egy korrupciós ügy, ha NER-közeli személy érintett volt, az eljárás az ő asztalán akadt el. 21 év alatt az ügyészség senkit nem ítélt el a Fidesz-rendszer belső köreiből.',
    keyCases: [
      {
        title: 'Elszabotált nyomozások: 20 fontos ügy, ami megakadt az ügyészségen — az Atlatszo.hu összefoglalója',
        description: 'Az Atlatszo.hu 2021-ben dokumentálta azt a 20 legfontosabb ügyet, amelyekben Polt Péter ügyészsége évek óta nem lépett. A lista: (1) Öveges-program — természettudományi oktatási fejlesztés visszaélései; (2) Híd a munka világába — roma foglalkoztatási projekt; (3) Szajol–Püspökladány vasútvonal felújítása; (4) Orbán fogorvosa — fogászati berendezések; (5) Rogán találmánya — digitális aláírás fejlesztés; (6) Microsoft-licencelés — szoftverlicenc-túlárazás; (7) Elios — közvilágítás, OLAF által vizsgált uniós visszaélés; (8) 4-es metró — metrópályaépítés szabálytalanságai; (9) Budapest Szíve — belváros-fejlesztés; (10) Mátrai Erőmű — állami megvásárlás veszteséggel; (11) Provital — közbeszerzési tanácsadó túlszámlázása; (12) Lószolárium — lovasközpont-támogatás; (13) Nyíregyháza-Sóstó — turisztikai projekt; (14) Biodóm — állatkert beruházás; (15) 3-as metró szerelvényei — orosz szerelvény felújítása; (16) Budapest–Belgrád vasútvonal finanszírozása; (17) Lélegeztetőgépek — Covid-közbeszerzések; (18) Tiborcz szállodabiznisze — visegrádi hotel osztalék; (19) TAO-támogatások Felcsútra; (20) KLIK szoftverügye — iskolarendszer informatikája. Egyikben sem emelt vádat az ügyészség.',
        crimeTypes: ['korrupció eltussolása', 'szelektív igazságszolgáltatás', 'közpénzekkel való visszaélés'],
        sourceUrl: 'https://atlatszo.hu/kozpenz/2021/09/16/elszabotalt-nyomozasok-20-fontos-ugy-ami-megakadt-az-ugyeszsegen/',
        sourceLabel: 'Atlatszo.hu',
      },
      {
        title: 'Elios-ügy — nem indított vádat',
        description: 'Az OLAF európai csalásellenes hivatal 2017-ben 43 milliárd forintos uniós pénzek visszaélését állapította meg az Elios Zrt. közvilágítási projektjeinél — a cég akkori tulajdonosa Orbán Viktor veje volt. Polt ügyészsége az OLAF-ajánlás ellenére nem emelt vádat senki ellen.',
        crimeTypes: ['korrupció eltussolása', 'EU-s pénzek visszaélése', 'szelektív igazságszolgáltatás'],
        sourceUrl: 'https://telex.hu/belfold/2025/06/11/polt-peter-alkotmanybirosag-elnok-kozma-akos-orszaggyules-szavazas',
        sourceLabel: 'Telex',
      },
      {
        title: 'Lélegeztetőgép-közbeszerzés — vizsgálat leállítva',
        description: 'A Covid-járvány idején a kormány 300 milliárd forintért kötött szerződést Mészáros Lőrinc köréhez köthető cégekkel kínai lélegeztetőgépek szállítására — az eszközök jelentős része soha nem került kórházba, vagy nem volt használható. Az ügyészség nem vizsgálta az ügyet.',
        crimeTypes: ['korrupció eltussolása', 'közpénzek elherdálása'],
        sourceUrl: 'https://telex.hu/belfold/2025/06/11/polt-peter-alkotmanybirosag-elnok-kozma-akos-orszaggyules-szavazas',
        sourceLabel: 'Telex',
      },
      {
        title: 'MNB-alapítványok — milliárdok nyomtalanul',
        description: 'A Magyar Nemzeti Bank 2013–2015 között 266 milliárd forintot csatornázott át NER-közeli alapítványokba a törvényi korlátok megkerülésével. Az Állami Számvevőszék és az Európai Parlament is bírálta az ügyet. Polt ügyészsége nem indított nyomozást.',
        crimeTypes: ['korrupció eltussolása', 'közpénzekkel való visszaélés'],
        sourceUrl: 'https://telex.hu/belfold/2025/06/11/polt-peter-alkotmanybirosag-elnok-kozma-akos-orszaggyules-szavazas',
        sourceLabel: 'Telex',
      },
      {
        title: 'Felülbírálati indítvány trükközése',
        description: 'Polt ügyészsége a felülbírálati indítvány jogintézményével is élt NER-érdekű ügyekben: ahol az alacsonyabb fokú bíróság marasztaló ítéletet hozott, az ügyészség felülbírálati indítványt nyújtott be az elítélt javára — ezzel gyengítve az eredeti ítéletet ahelyett, hogy szigorítást kért volna.',
        crimeTypes: ['szelektív igazságszolgáltatás', 'jogi trükközés'],
      },
    ],
    pinnedLinks: [
      {
        url: 'https://hvg.hu/itthon/20260618_jogtudosok-kozjogi-tisztsegviselok-levaltasa-sulyok-tamas-kuria-alkotmanybirosag',
        title: 'Jogtudósok: le kell váltani Sulyok Tamást, a Kúria és az Alkotmánybíróság elnökét',
        source: 'HVG',
      },
    ],
    newsKeywords: ['Polt Péter', 'Alkotmánybíróság elnöke', 'Polt ügyész'],
  },
  {
    id: 'nagy-gabor-balint',
    fullTitle: 'legfőbb ügyész',
    videoId: 'l1qpO6R166w',
    videoSummary: {
      source: 'Kontroll',
      title: 'Az ügyészség politikai utasításra működik',
      description: 'Magyar Péter a Kontroll csatornán: politikai utasítás nélkül a Legfőbb Ügyészség sem így működne. Nagy Gábor Bálint a Polt-korszak közvetlen folytatója — a szelektív igazságszolgáltatás intézményesített maradt.',
    },
    bio: 'Nagy Gábor Bálint 2025-ben lett Magyarország legfőbb ügyésze, Polt Péter utódjaként. Pályafutása során végig az ügyészségi hierarchiában emelkedett, Polt közvetlen bizalmasaként tartják számon. Kinevezése az Országgyűlésen ment át, a Fidesz szavazataival. Rövid idő alatt máris bebizonyosodott: a Polt-éra szelektív igazságszolgáltatási gyakorlata folytatódik.',
    nerRole: 'Nagy Polt örökségét viszi tovább: a NER-hez köthető korrupciós ügyek megakadályozása és az ellenzék elleni szelektív igazságszolgáltatás intézményes fenntartása a legfőbb ügyészi hivatal fő funkciója maradt. Magyar Péternek azt mondta: ha Völner szökni akarna, már megtette volna — de nyomozást nem indított.',
    keyCases: [
      {
        title: 'Völner-ügy — „ha szökni akarna, már megtette volna"',
        description: 'Magyar Péter legfőbb ügyészhez fordult a Völner Pál-üggyel kapcsolatban. Nagy Gábor Bálint azt válaszolta: ha Völner szökni akarna, már megtette volna. Nyomozást nem indított, az ügyet lezártnak tekinti — miközben az érintett NER-közeli háttérhálózatot a per alig érintette.',
        crimeTypes: ['korrupció eltussolása', 'szelektív igazságszolgáltatás'],
        sourceUrl: 'https://444.hu/2026/03/02/magyar-peternek-azt-mondta-a-legfobb-ugyesz-hogy-ha-volner-szokni-akarna-mar-megtette-volna',
        sourceLabel: '444.hu',
      },
      {
        title: 'MNB-botrány — nem indított vizsgálatot',
        description: 'A Magyar Nemzeti Bank alapítványainak botrányában — amelyben több százmilliárd forint NER-közeli szervezetekhez áramlott — Nagy Gábor Bálint ügyészsége sem indított nyomozást, folytatva Polt Péter gyakorlatát. A Szóló utcai ügy szimbolikus: az MNB-s pénzek egy részéből épített ingatlanok körüli visszaéléseket sem vizsgálják.',
        crimeTypes: ['korrupció eltussolása', 'közpénzekkel való visszaélés'],
        sourceUrl: 'https://www.blikk.hu/aktualis/belfold/mnb-botrany-szolo-utca-ugyeszseg-legfobb-ugyesz/91hy95x',
        sourceLabel: 'Blikk',
      },
      {
        title: '🆕 FRISS — Hangfelvétel: a legfőbb ügyész utasítására szüntetik meg a politikailag kényes ügyeket',
        description: 'A hangfelvétel közvetlen bizonyíték arra, hogy a szelektív igazságszolgáltatás nem egyedi döntések, hanem Nagy Gábor Bálint legfőbb ügyész utasításának eredménye. Juhász-Bauer Tuzson Bence ellen is feljelentést tett: bizonyíthatóan tudnia kellett, amikor kiállt a nyilvánosság elé, hogy van kiskorú sértett a Szőlő utcai ügyben. Az ügyészség nem kívánja kinyomozni — a feljelentést elutasítják, a nyomozást egy vidéki ügyészségre teszik át, ahol sem jogosítványuk, sem lehetőségük nincs az ügy érdemi folytatására.',
        crimeTypes: ['szelektív igazságszolgáltatás', 'utasításra mellőzött ügyek', 'visszaélés hivatali hatalommal', 'Szőlő utca eltussolása'],
        videoId: '3strFkmcGbo',
        videoLabel: 'Juhász Péter | Juhi',
        videoTitle: 'Eltüntetik a kényes ügyeket? Hangfelvétel került elő az ügyészségről',
        videoSummary: 'Tura Tímea, a Tolna Vármegyei Főügyészség alkalmazottja telefonban elismerte, hogy ügyészségi utasításra nem foglalkoztak bizonyos ügyekkel. Juhász-Bauer Ágoston Bálint, aki évek óta küzd az igazságszolgáltatási rendszerrel, tette közzé a felvételt.',
      },
      {
        title: 'Gyermekvédelem — visszaélések kivizsgálatlanul',
        description: 'A gyermekvédelmi rendszerben feltárt visszaélések kapcsán — amelyekről a Blikk is részletesen írt — az ügyészség nem lépett. Nagy Gábor Bálint legfőbb ügyészségének ideje alatt a gyermekvédelmi intézményekhez kötődő visszaélések szintén kivizsgálatlanok maradtak.',
        crimeTypes: ['intézményi passzivitás', 'szelektív igazságszolgáltatás'],
        sourceUrl: 'https://www.blikk.hu/aktualis/belfold/mnb-botrany-szolo-utca-ugyeszseg-legfobb-ugyesz/91hy95x',
        sourceLabel: 'Blikk',
      },
    ],
    pinnedLinks: [
      {
        url: 'https://hvg.hu/itthon/20260618_jogtudosok-kozjogi-tisztsegviselok-levaltasa-sulyok-tamas-kuria-alkotmanybirosag',
        title: 'Jogtudósok: le kell váltani Sulyok Tamást, a Kúria és az Alkotmánybíróság elnökét',
        source: 'HVG',
      },
    ],
    newsKeywords: ['Nagy Gábor Bálint', 'legfőbb ügyész', 'ügyészség vezető'],
  },
  {
    id: 'varga-zs-andras',
    fullTitle: 'Kúria elnöke',
    videoId: 'hcPMPrT899I',
    videoSummary: {
      source: 'ATV Magyarország',
      title: 'Varga Zs. András megosztja a jogi szakmát',
      description: 'ATV riport a Kúria vitatott elnökéről: bírói szervezetek és jogi szakemberek megosztottak Varga Zs. kinevezése és elnöki lépései kapcsán — miközben jogerős ítéletek mondták ki, hogy törvénysértően járt el.',
    },
    bio: 'Varga Zs. András 2020-tól vezeti a Kúriát, Magyarország legfelsőbb bíróságát. Korábban alkotmánybíróként és az Alaptörvény egyik tervezőjeként ismert — az új alkotmány, amelyet az ellenzék és az Európa Tanács is bírált. Elnökként bírókat függesztett fel és bocsátott el jogerős ítéletek szerint törvénysértően, és feljelentette a Tisza-párthoz köthető alkalmazást letöltő bírákat.',
    nerRole: 'Varga Zs. a NER igazságügyi rendszerének legmagasabb szintű képviselője. A Kúria irányítása révén meghatározza azt a joggyakorlatot, amelyet az összes alacsonyabb fokú bíróság követ — és jogerős ítéletek tanúsága szerint visszaélt munkáltatói hatalmával is.',
    keyCases: [
      {
        title: 'Kovács András felfüggesztése — jogerősen törvénysértő',
        description: 'Varga Zs. András törvénysértően függesztette fel Kovács Andrást, a Kúria egyik tanácselnökét. A bíróság jogerős ítélettel állapította meg a törvénysértést — ez dokumentált, bírósági ítélettel igazolt hatalmi visszaélés a legfőbb bírói fórum élén.',
        crimeTypes: ['bírói függetlenség sérelme', 'törvénysértő hatalomgyakorlás'],
        sourceUrl: 'https://helsinki.hu/jogeros-torvenyserto-varga-zs-andras/',
        sourceLabel: 'Magyar Helsinki Bizottság',
      },
      {
        title: 'Bartha Ildikó elbocsátása — jogerősen jogellenes',
        description: 'Varga Zs. törvénysértően bocsátotta el Bartha Ildikó főtanácsadót, miután az kritizálta a Kúria működését. A bíróság jogerősen jogellenesnek ítélte az elbocsátást — ez Varga Zs. második dokumentált, jogerősen megállapított törvénysértése munkáltatóként.',
        crimeTypes: ['törvénysértő hatalomgyakorlás', 'véleménynyilvánítás elfojtása'],
        sourceUrl: 'https://telex.hu/belfold/2026/05/29/varga-zs-andras-kuria-elnoke-elbocsatas-jogellenes-bartha-ildiko-fotanacsado-felmentes-birosag',
        sourceLabel: 'Telex',
      },
      {
        title: 'Tisza-appot letöltő bírók feljelentése és listázása',
        description: 'Varga Zs. András levélben kérdőjelezte meg azoknak a bíráknak a pártatlanságát, akik letöltötték a Tisza párt mobilalkalmazását. A bírák adatait összegyűjtötték, rendőrségi eljárás is indult — az OBT (Országos Bírói Tanács) nyíltan szembefordult Varga Zs. lépéseivel.',
        crimeTypes: ['bírói függetlenség sérelme', 'politikai megfélemlítés', 'véleményszabadság sérelme'],
        sourceUrl: 'https://telex.hu/belfold/2025/11/26/birok-listazasa-konfliktus-az-obt-es-a-kuria-kozott-megis-mi-folyik-itt',
        sourceLabel: 'Telex',
      },
    ],
    pinnedLinks: [
      {
        url: 'https://hvg.hu/itthon/20260618_jogtudosok-kozjogi-tisztsegviselok-levaltasa-sulyok-tamas-kuria-alkotmanybirosag',
        title: 'Jogtudósok: le kell váltani Sulyok Tamást, a Kúria és az Alkotmánybíróság elnökét',
        source: 'HVG',
      },
    ],
    newsKeywords: ['Varga Zs. András', 'Kúria elnöke', 'Kúria'],
  },
  {
    id: 'windisch-laszlo',
    fullTitle: 'ÁSZ elnöke',
    videoId: 'pvgbAw8b0QA',
    videoSummary: {
      source: 'ATV Magyarország',
      title: 'MNB-botrány: az ÁSZ kihagyott egy fontos részletet',
      description: 'ATV riport: az ÁSZ MNB-alapítványokról szóló jelentéséből eltűnt egy kulcsrészlet. Windisch László maga is az MNB egykori alelnöke volt, miközben a visszaélések zajlottak — a jelentést ő jegyezte.',
    },
    pinnedLinks: [
      {
        url: 'https://hvg.hu/itthon/20260618_jogtudosok-kozjogi-tisztsegviselok-levaltasa-sulyok-tamas-kuria-alkotmanybirosag',
        title: 'Jogtudósok: le kell váltani Sulyok Tamást, a Kúria és az Alkotmánybíróság elnökét',
        source: 'HVG',
      },
      {
        url: 'https://telex.hu/gazdasag/2025/03/31/matolcsy-gyorgy-allami-szamvevoszek-mnb-alapitvany-kecskemeti-egyetem-windisch-laszlo',
        title: '„Felfoghatatlan hiba" – Matolcsy hazugsággal vádolta meg Windisch Lászlót',
        source: 'Telex',
      },
      {
        url: 'https://24.hu/fn/gazdasag/2025/09/04/allami-szamvevoszek-windisch-laszlo-mnb-alapitvany-matolcsy-gyorgy-jegybank-asz-lopas/',
        title: 'Az ÁSZ vizsgálata az MNB-alapítványokról — Windisch László és Matolcsy György',
        source: '24.hu',
      },
    ],
    bio: 'Windisch László 2018 óta az Állami Számvevőszék elnöke. Korábban a Fidesz parlamenti frakcióját vezette, közvetlen pártkarrierből lépett az elvileg független ellenőrző szerv élére. Az ÁSZ az állami pénzügyek fő ellenőrző hatósága — és Windisch alatt szisztematikusan az ellenzéket büntette, miközben a NER-projekteket érintetlenül hagyta.',
    nerRole: 'A Windisch vezette ÁSZ nem vizsgálta meg komolyan a Fidesz-közeli NER-projektek finanszírozását, ugyanakkor az ellenzéki önkormányzatokat és pártokat számos alkalommal megbírságolta. Az MNB-botrányban csak Matolcsy bukása után szólalt meg — holott Windisch maga is az MNB alelnöke volt, miközben „az egész varázslat" zajlott.',
    keyCases: [
      {
        title: 'Ellenzéki pártok megbírságolása — 260 millió forint',
        description: 'Az ÁSZ több ellenzéki pártot — köztük az MSZP-t, a Jobbikot és a Momentumot — többszáz millió forintos bírsággal sújtotta kampányfinanszírozási szabálysértésekre hivatkozva. A 6 ellenzéki párt ellen összesen 260 millió forintos büntetés született; a Márki-Zay-féle kampánytámogatás ürügyén 33 milliárdos büntetéssel is fenyegette az ellenzéket. A Fidesz-közeli pártokat nem vizsgálta hasonló szigorral.',
        crimeTypes: ['szelektív intézményi fellépés', 'politikai visszaélés'],
        sourceUrl: 'https://hvg.hu/itthon/20231206_260_milliora_buntetes_Allami_Szamvevoszek_ellenzeki_partok',
        sourceLabel: 'hvg.hu',
      },
      {
        title: 'MNB-botrány: a szemük előtt zajlott, csak Matolcsy bukása után szóltak',
        description: 'Az ÁSZ 2025-ben végül vizsgálatot indított az MNB-alapítványok ügyében — de csak miután Matolcsy György már elhagyta a jegybank élét. Ács Dániel fogalmazta meg a lényeget: „Az is mennyire orbáni ebben az ügyben, hogy az ÁSZ jelentést az a Windisch László jegyzi, aki 2019-ig a Magyar Nemzeti Bank pénzügyi szervezetek felügyeletéért és fogyasztóvédelemért felelős alelnöke volt, akinek a szeme előtt zajlott le az egész varázslat, de csak most, amikor Matolcsy már távozott, szólt/szólhatott róla."',
        crimeTypes: ['ellenőrzési kötelezettség elmulasztása', 'intézményi összefonódás'],
        sourceUrl: 'https://hvg.hu/gazdasag/20250409_allami-szamvevoszek-mnb-velemenycikk-reagalas',
        sourceLabel: 'hvg.hu',
      },
      {
        title: 'NER védése — „nem kutakodunk minisztériumok pincéjében"',
        description: 'Magyar Péter felszólította az ÁSZ-t, hogy vizsgálja ki a NER legfontosabb közpénzügyeit. Az ÁSZ válasza: eddig sem kutakodtak minisztériumok pincéjében, és ezután sem fognak. Ez nyílt beismerése annak, hogy az intézmény nem kívánja a NER-struktúrát vizsgálni.',
        crimeTypes: ['ellenőrzési kötelezettség elmulasztása', 'intézményi passzivitás'],
        sourceUrl: 'https://444.hu/2026/05/19/az-asz-uzeni-magyar-peternek-hogy-eddig-sem-kutakodtak-miniszteriumok-pincejeben-es-ezutan-sem-fognak',
        sourceLabel: '444.hu',
      },
    ],
    newsKeywords: ['Windisch László', 'Állami Számvevőszék elnöke', 'ÁSZ elnök'],
  },
  {
    id: 'rigo-csaba-balazs',
    fullTitle: 'GVH elnöke',
    videoId: 'iMOrPSLhGTg',
    videoSummary: {
      source: 'Partizán',
      title: 'GVH belülről: a Lidlt büntetik, az oligarchát védik',
      description: 'Partizán-interjú a Gazdasági Versenyhivatal egykori belső munkatársával: hogyan működik a GVH a valóságban — a multinacionálisokat megbüntetik, a NER-közeli vállalkozókat érintetlenül hagyják.',
    },
    pinnedLinks: [
      {
        url: 'https://hvg.hu/itthon/20260618_jogtudosok-kozjogi-tisztsegviselok-levaltasa-sulyok-tamas-kuria-alkotmanybirosag',
        title: 'Jogtudósok: le kell váltani Sulyok Tamást, a Kúria és az Alkotmánybíróság elnökét',
        source: 'HVG',
      },
      {
        url: 'https://www.klubradio.hu/hirek/orban-bebetonozta-a-gvh-fideszes-elnoket-159393',
        title: 'Orbán bebetonozta a GVH fideszes elnökét',
        source: 'Klubrádió',
      },
      {
        url: 'https://www.economx.hu/gazdasag/2026/06/17/lemondas-helyett-turk-tanacs-gvh-elnoke-nav/',
        title: 'Lemondás helyett türk front — a GVH elnöke a NAV-val is tovább él',
        source: 'Economx',
      },
    ],
    bio: 'Rigó Csaba Balázs 2021 óta a Gazdasági Versenyhivatal elnöke. Korábban a Miniszterelnökség és a Pénzügyminisztérium jogi területein dolgozott, szoros kapcsolatban a kormányzati gazdaságpolitikával. Kinevezése az Országgyűlésen ment át, Orbán Viktor pedig bebetonozta a pozícióba. A GVH vezető közgazdásza nyilvánosan bírálta a hivatal működését — Rigó kirúgta.',
    nerRole: 'A GVH az elvileg független versenyhatóság, ám Rigó alatt a hivatal nem vizsgálta meg az oligarchák piaci monopóliumait. A Mészáros-féle médiabirodalom mentesítésétől a vezető közgazdász kirúgásáig minden lépés arra mutat: a GVH NER-érdekeket szolgál.',
    keyCases: [
      {
        title: 'KESMA-mentesítés — Mészáros médiabirodalmának tűrése',
        description: '2018-ban több mint 500 NER-közeli médium jutott Mészáros Lőrinc befolyása alá egyetlen összefonódásban. A GVH versenyhatósági eljárás helyett mentességet adott — ez a döntés tette lehetővé, hogy Magyarország médiapiacának közel fele politikailag összehangolt kézbe kerüljön.',
        crimeTypes: ['versenyjog megsértése', 'piaci koncentráció eltussolása'],
        sourceUrl: 'https://atlatszo.hu/impakt/2023/10/05/a-gazdasagi-versenyhivatal-nem-latta-eleg-gyanusnak-a-meszaros-m1-furcsa-gyozelmeit/',
        sourceLabel: 'Atlatszo.hu',
      },
      {
        title: 'NER-cégek versenypiaci visszaélései kivizsgálatlanul',
        description: 'A Partizán-interjúban a GVH egyik vezető közgazdásza nyilvánosan elmondta: a hivatal nem vizsgálja a NER-közeli vállalkozók közbeszerzési dominanciáját és piaci torzulásait. Az Atlatszo.hu dokumentálta, hogy a Mészáros-féle M1-győzelmek sorozatát a GVH nem tartotta elég gyanúsnak versenyhatósági beavatkozáshoz.',
        crimeTypes: ['versenyjog megsértése', 'NER-érdekek védelme'],
        sourceUrl: 'https://telex.hu/gazdasag/2026/04/06/gvh-vezeto-kozgazdasz-partizan-interju',
        sourceLabel: 'Telex',
      },
      {
        title: 'Vezető közgazdász kirúgása kritika miatt',
        description: 'Miután a GVH vezető közgazdásza nyilvánosan bírálta a hivatal NER-kiszolgáló működését, Rigó Csaba Balázs kirúgta. A hvg.hu és a Forbes is megírta: a kirúgást a bíróság érdemtelennek minősítette. A lépés üzenete egyértelmű — a hivatal nem tűri a belső kritikát.',
        crimeTypes: ['hivatali visszaélés', 'véleménynyilvánítás elfojtása'],
        sourceUrl: 'https://hvg.hu/gazdasag/20260429_berezvai-zombor-gazdasagi-versenyhivatal-gvh-erdemtelenseg-kirugas',
        sourceLabel: 'hvg.hu',
      },
    ],
    newsKeywords: ['Rigó Csaba Balázs', 'GVH elnöke', 'Gazdasági Versenyhivatal elnöke'],
  },
  {
    id: 'koltay-andras',
    fullTitle: 'Médiahatóság elnöke',
    videoId: 'U846SvnrGY8',
    videoSummary: {
      source: 'ATV Magyarország',
      title: 'AI a kampányban: hol húzódik a manipuláció határa?',
      description: 'ATV-riport a mesterséges intelligencia kampánybeli felhasználásáról — és arról, hogy a médiaszabályozó miért nem lép. A Médiahatóság eszközei megvannak, de Koltay alatt nem használják őket a NER-közeli dezinformáció ellen.',
    },
    pinnedLinks: [
      {
        url: 'https://hvg.hu/itthon/20260618_jogtudosok-kozjogi-tisztsegviselok-levaltasa-sulyok-tamas-kuria-alkotmanybirosag',
        title: 'Jogtudósok: le kell váltani Sulyok Tamást, a Kúria és az Alkotmánybíróság elnökét',
        source: 'HVG',
      },
      {
        url: 'https://kontroll.hu/cikk/belfold/2026/05/26/a-parlamenti-bizottsag-nem-fogadta-el-koezmedia-2025-oes-elszamolasat',
        title: 'Nem fogadta el a Médiahatóság elnökének beszámolóját a parlament pénzügyi bizottsága',
        source: 'Kontroll',
      },
      {
        url: 'https://telex.hu/after/2025/05/15/feher-lotusz-nemzeti-media-es-hirkozlesi-hatosag-max-jason-isaacs-timothy-ratliff',
        title: 'Az NMHH felnyomta a Maxot a holland médiahatóságnál a Fehér Lótusz péniszvillantós epizódja miatt',
        source: 'Telex',
      },
      {
        url: 'https://telex.hu/belfold/2025/01/16/kossuth-radio-buntetes-gyuleletkeltes-szazezer-forint',
        title: 'Megbüntették a Kossuth rádiót, miután egy betelefonáló kézigránáttal fenyegette a Tisza Pártot',
        source: 'Telex',
      },
      {
        url: 'https://telex.hu/zacc/2025/07/11/nmhh-mediatanacs-vizsgalat-peppa-malac-a-veszekedes-fajvaltas-aranyos-fiuk',
        title: 'Megpróbáltuk kideríteni, miért nyomhatta fel valaki Peppa malacot az NMHH-nál',
        source: 'Telex',
      },
      {
        url: 'https://telex.hu/after/2026/05/28/nmhh-koltsegvetesi-biztos-koltay-andras-kozmedia',
        title: 'A Médiahatóság szerint nem jogszerű, hogy a kormány költségvetési biztost küld rájuk',
        source: 'Telex',
      },
    ],
    bio: 'Koltay András 2021-től 2026 júliusáig vezette a Nemzeti Média- és Hírközlési Hatóságot (NMHH). Médiajogi professzorként munkái a médiaszabadság szűkítését igazoló elméleti kereteket nyújtottak. Az NMHH alatt a Fidesz háborús riogatós videóját nem ítélte jogsértőnek, bíróság által betiltott NER-médiumot védelmébe vett, és 1,3 milliárdot költ reklámtábla-ellenőrzésre kormányközeli cégeken keresztül.',
    breakingBlock: {
      source: 'hvg.hu',
      date: '2026. júl. 1.',
      headline: 'Magyar Péter javaslatára felmentette Sulyok Tamás az NMHH elnökét',
      lead: 'Sulyok Tamás köztársasági elnök Magyar Péter miniszterelnök javaslatára felmentette Koltay Andrást a Nemzeti Média- és Hírközlési Hatóság (NMHH) elnöki pozíciójából. Koltay 2021 óta töltötte be a tisztséget.',
      url: 'https://hvg.hu/itthon/20260701_magyar-peter-felmentes-sulyok-tamas-nmhh-elnoke-koltay-andras',
    },
    nerRole: 'Koltay médiahatósága NER-barát szelektivitással működik: a Fidesz kampánymanipulációja ellen nem lép, a független médiumokat megbünteti, a bíróság döntéseit figyelmen kívül hagyja — majd a választások után hirtelen tud eljárásokat indítani a volt kormánymédia ellen.',
    keyCases: [
      {
        title: 'Klubrádió frekvenciamegvonása — jogsértőnek ítélte az EU Bírósága',
        description: '2021-ben a Médiatanács megtagadta a Klubrádió frekvenciaengedélyének megújítását. Az Európai Bíróság jogsértőnek ítélte a döntést — de az NMHH nem nyilatkozott az ügyről, és a Klubrádió nem kapta vissza frekvenciáját.',
        crimeTypes: ['médiaszabadság sérelme', 'uniós jog megsértése'],
        sourceUrl: 'https://www.klubradio.hu/adasok/az-nmhh-nem-nyilatkozik-a-klubradio-ugyeben-159043',
        sourceLabel: 'Klubrádió',
      },
      {
        title: 'Fidesz háborús riogatás védelme — nem jogsértő, mondja az NMHH',
        description: 'A Fidesz „fejbe lőve" videóját a Médiahatóság nem találta jogsértőnek. Miközben a hatóságnak lennének eszközei a kampánymanipuláció és álhírek ellen, 2026 választási kampányában semmit nem tett — majd a választások után hirtelen eljárásokat indított a volt kormánymédia ellen.',
        crimeTypes: ['szelektív szabályozás', 'kampánymanipuláció tűrése'],
        sourceUrl: 'https://telex.hu/belfold/2026/02/24/az-nmhh-szerint-nem-tudnak-mit-kezdeni-a-fidesz-fejbelovos-videojaval',
        sourceLabel: 'Telex',
      },
      {
        title: 'Bíróság által betiltott Bors-különszám — az NMHH szerint nem jogsértő',
        description: 'A bíróság betiltotta a Bors Tisza-ellenes különszámát, a Médiatanács mégis úgy ítélte meg: nem jogsértő. Ez az eset a NER-média intézményes védelmének iskolapéldája — Koltay hatósága a bírósági döntéssel szemben is kiállt a kormányközeli médium mellett.',
        crimeTypes: ['NER-érdekek védelme', 'bírói döntés figyelmen kívül hagyása'],
        sourceUrl: 'https://telex.hu/belfold/2026/03/05/nmhh-nem-jogserto-bors-kulonszam',
        sourceLabel: 'Telex',
      },
      {
        title: 'Kormányközeli cégek — 1,3 milliárd reklámtábla-ellenőrzésre',
        description: 'Az NMHH 1,3 milliárd forintot költ arra, hogy az összes reklámtáblát ellenőrizze — az Atlatszo.hu szerint a szerződés kormányközeli cégekhez kerül. A közpénzköltés átláthatatlansága és a feladat aránytalan mérete politikai motivációkra utal.',
        crimeTypes: ['közpénzek pazarlása', 'kormányközeli összefonódás'],
        sourceUrl: 'https://atlatszo.hu/kozpenz/2026/03/26/13-milliardot-kolt-arra-a-mediahatosag-hogy-az-osszes-reklamtablat-ellenorizze/',
        sourceLabel: 'Atlatszo.hu',
      },
    ],
    newsKeywords: ['Koltay András', 'NMHH', 'Médiatanács elnöke'],
  },
  {
    id: 'senyei-gyorgy',
    fullTitle: 'OBH elnöke',
    videoId: 'SklrNPa4j08',
    videoSummary: {
      source: 'ATV Magyarország',
      title: 'Megsértették a bírói függetlenséget a Tisza-appot letöltő bírók esetén?',
      description: 'ATV riport arról, hogyan vizsgálják a Tisza-applikációt letöltő bírák pártatlanságát — és hogy ez vajon a bírói függetlenség megsértése-e. Az OBH az ügy háttérszereplője.',
    },
    pinnedLinks: [
      {
        url: 'https://hvg.hu/itthon/20260618_jogtudosok-kozjogi-tisztsegviselok-levaltasa-sulyok-tamas-kuria-alkotmanybirosag',
        title: 'Jogtudósok: le kell váltani Sulyok Tamást, a Kúria és az Alkotmánybíróság elnökét',
        source: 'HVG',
      },
      {
        url: 'https://444.hu/2026/05/10/azonnali-lemondasra-szolitotta-fel-a-tiszas-mellethei-barna-a-fideszes-kinevezetteket-polttol-windischig',
        title: 'Azonnali lemondásra szólította fel a tiszás Melléthei-Barna a fideszes kinevezetteket Polttól Windischig',
        source: '444.hu',
      },
    ],
    bio: 'Senyei György 2020 óta az Országos Bírósági Hivatal elnöke. Az OBH-t a Fidesz 2011-ben hozta létre, kivonva a bírói önigazgatást és egyetlen vezető kezébe koncentrálva a bírói kinevezések, előléptetések és ügykiosztások irányítását. Senyei egy kormányülésen is részt vett — az elvileg kormánytól független bírósági adminisztrációs szerv vezető jeként. A Völner-Schadl-ügyben hangfelvétel tanúsítja személyes jó viszonyát a korrupcióba keveredett Schadl Györggyel.',
    nerRole: 'Az OBH elnöke elvileg igazgatási szerepet tölt be, de a bírói kinevezésekre és ügykiosztásokra gyakorolt befolyása révén az igazságügyi rendszer politikai kontrollja az ő kezén átmenő döntések révén valósul meg. A Schadl-kapcsolat és a kormányülésen való megjelenés azt jelzi: a függetlenség nem csak formálisan, hanem személyes szinten is sérül.',
    keyCases: [
      {
        title: 'Bírói kinevezések átláthatatlansága',
        description: 'Az OBH több esetben mellőzte a bírói tanácsok jelölését és saját hatáskörben nevezett ki bírákat és bírósági vezetőket — a döntések politikai motivációit civil szervezetek és bírói egyesületek egyaránt bírálták.',
        crimeTypes: ['bírói függetlenség sérelme', 'hatalmi visszaélés'],
        sourceUrl: 'https://helsinki.hu/akta/birosagok-fuggetlensege/',
        sourceLabel: 'Magyar Helsinki Bizottság',
      },
      {
        title: 'Már a látszatra se adnak — kormányülésen az OBH elnöke',
        description: 'Senyei György megjelent egy kormányülésen, ahol a bíróságok költségvetéséről tárgyaltak. Az elvileg a végrehajtó hatalomtól független bírósági igazgatási szerv elnöke így formálisan is összefonódást mutatott a kormányzattal — a látszat megőrzése sem volt szempont.',
        crimeTypes: ['intézményi függetlenség sérelme', 'összefonódás a végrehajtó hatalommal'],
        sourceUrl: 'https://telex.hu/belfold/2024/04/09/kormanyules-senyei-gyorgy-orszagos-biroi-hivatal-koltsegvetes',
        sourceLabel: 'Telex',
      },
      {
        title: 'Potenciális összejátszás a Völner–Schadl-ügyben',
        description: 'A Völner–Schadl-korrupciós ügy középpontjában Schadl György végrehajtói kamara elnöke állt, aki bírósági végrehajtói kinevezésekért fizette meg Völner Pált — ezek a kinevezések az OBH-n is átmentek. A 24.hu cikke szerint Schadl az OBH-n keresztül indított „bosszúhadjáratot" egy bíró ellen. 2023-ban egy hangfelvétel is napvilágot látott, amelyen Senyei György és Schadl György barátiasan nevetgélnek — ez a személyes közelség mélyen aggasztó, tekintve Schadl súlyos bűnügyi érintettségét.',
        crimeTypes: ['potenciális korrupciós összefonódás', 'intézményi függetlenség sérelme'],
        sourceUrl: 'https://hvg.hu/itthon/20230203_senyei_obh_hangfelvetel_schadl',
        sourceLabel: 'hvg.hu',
      },
    ],
    newsKeywords: ['Senyei György', 'OBH elnöke', 'Országos Bírósági Hivatal elnöke'],
  },
];
