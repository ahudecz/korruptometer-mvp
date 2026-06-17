export interface BigCaseStatus {
  icon: string;
  label: string;
  value: string;
}

export interface BigCaseVideo {
  id: string;
  label: string;
  title: string;
}

export interface BigCaseRef {
  label: string;
  url: string;
}

export interface UgyekConfig {
  id: string;
  eyebrow: string;
  title: string;
  responsible?: string;
  responsibleGaleriaId?: string;
  photo?: string;
  photoCredit?: string;
  photoPosition?: string;
  summary: string;
  description: string;
  videoId?: string;
  videoChannel?: string;
  videoTitle?: string;
  videoSummary?: string;
  additionalVideos?: BigCaseVideo[];
  estimatedDamage?: string;
  responsiblePersons?: string[];
  crimeTypes?: string[];
  relatedPersonIds?: string[];
  articleTag?: string;
  articleKeywords?: string[];
  moreUrl?: string;
  sourceRefs?: BigCaseRef[];
  statusItems: BigCaseStatus[];
}

// FONTOS JOGI KORLÁTOZÁS:
// A "zsolt-bacsi" ügy NEM kapcsolódik Semjén Zsolt személyéhez.
// Semjén Zsolt neve TILOS bármilyen formában megjelenni ebben az ügyben.
// A „Zsolti bácsi" egy különálló személy egy gyermekvédelmi botránnyal összefüggésben.
const ZSOLT_BACSI_SEMJEN_GUARD = null; // intentionally unused — marker comment only

export const UGYEK: UgyekConfig[] = [
  {
    id: 'nka-botrany',
    eyebrow: 'Aktív · Nyomozás alatt',
    title: 'NKA botrány',
    responsible: 'Hankó Balázs',
    responsibleGaleriaId: undefined,
    photo: 'https://kultura.hu/uploads/media/default/0003/10/thumb_209752_default_big.jpg',
    photoCredit: 'kultura.hu',
    estimatedDamage: 'Több tízmilliárd Ft — tiltott pártfinanszírozásra kiosztott közpénz',
    responsiblePersons: ['Hankó Balázs — volt kulturális miniszter'],
    crimeTypes: ['Hűtlen kezelés', 'Költségvetési csalás', 'Közbeszerzési szabálysértés'],
    relatedPersonIds: [],
    articleTag: 'NKA',
    moreUrl: '/ugyek/nka-botrany',
    summary: 'Hankó Balázs volt kulturális miniszter a 2026-os választások előtt szabálytalanul osztott ki milliárdos NKA-támogatásokat. A NAV hűtlen kezelés és költségvetési csalás gyanújával nyomoz — Győrben is indult eljárás. Tarr Zoltán közel 400 millió forintnyi támogatást vont vissza.',
    videoId: 'NRA-QuItdUA',
    videoChannel: 'Molnár Áron',
    videoTitle: 'Megszólal a forrás',
    videoSummary: 'Egy bennfentes forráson keresztül tárja fel ez a videó, hogyan osztotta ki Hankó Balázs kulturális miniszter a választások előtt a közpénzeket az NKA-n keresztül. Az ügyet elsőként hozó riporter egyenesen a forrástól hallja a részleteket.',
    additionalVideos: [
      { id: 'OfMzRRIJ9WQ', label: 'Telex', title: 'Segélyszervezetnek tűnt, aztán rájöttünk, hogy ez a Fidesz – az NKA-botrány mélyére mentünk' },
      { id: 'df2GNzmh7pY', label: 'ATV', title: 'Botrányos kifizetések az NKA-nál: Rónai Egon megizzasztotta a minisztert' },
      { id: 'L8DWqeZp2l4', label: 'Partizán', title: 'Újabb 700 millió Orbán Ráhel lieblingjének, milliárdok a csókosoknak | Közpénzszivattyú az NKA-nál' },
      { id: 'vdNQGR9kzYk', label: 'ATV', title: 'NKA-botrány: Magyar Péter is megszólalt az ügyben' },
      { id: 'zAx4e6GhVQQ', label: 'ATV', title: '"Nagyon sok minden van, amiről nem tudunk" – Az NKA-botrány csak a jéghegy csúcsa?' },
      { id: 'lkFb77t0h-w', label: 'ATV', title: 'NKA-botrány: Tóth Gabi, Muri Enikő és Pataky Attila is komoly pénzeket kaphatott' },
    ],
    statusItems: [
      { icon: '⚖️', label: 'Nyomozás', value: 'NAV — hűtlen kezelés + költségvetési csalás (Győr is)' },
      { icon: '💰', label: 'Visszaszerzett vagyon', value: '~2,1 milliárd Ft — 1,69 Mrd visszautalt + ~400 M visszavonva' },
      { icon: '👤', label: 'Felelős', value: 'Hankó Balázs — volt kulturális miniszter' },
      { icon: '🚪', label: 'Lemondások', value: 'Bús Balázs (ápr. 28.) · Báán László (ápr. 30.) · Vidnyánszky Attila (máj. 2.) — mind lemondtak az NKA bizottságból' },
    ],
    sourceRefs: [
      { label: 'Telex: NAV nyomoz az NKA-ügyben', url: 'https://telex.hu/belfold/2026/06/16/nka-nyomozas-nav' },
      { label: 'Telex: 49 pályázó 1,69 milliárdot utalt vissza', url: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' },
      { label: '444: Tarr Zoltán ~400 M Ft-ot vont vissza', url: 'https://444.hu/2026/06/15/tarr-zoltan-kozel-400-millio-forintnyi-nka-tamogatast-von-vissza-amit-hanko-balazs-a-valasztas-elott-osztott-ki' },
    ],
    description: `A Nemzeti Kulturális Alap (NKA) botránya az egyik legsúlyosabb közpénzügyi visszaélés, amelyet a Fidesz-korszak vége előtt tártak fel. Hankó Balázs kulturális miniszter négy nappal a 2026-os parlamenti választások előtt — 2026. április 8-án — közel 394 millió forintnyi egyedi miniszteri keretből osztott ki támogatásokat. Tarr Zoltán, az új kormány kulturális minisztere ezeket a döntéseket visszavonta, majd elrendelte a kifizetések átvizsgálását.

A botrány nem állt meg a visszavonásnál. Az Index közérdekű adatigénylésből kiderült, hogy a korábbi NKA-döntések alapján összesen 49 pályázó — köztük Kis-Grófo énekes és a Városliget Zrt. — önként visszautalt az NKA-nak 1,69 milliárd forintot. Kis-Grófo maga 5 millió forintot utalt vissza, elismerve, hogy a pályázaton kapott összeg aránytalanul magas volt tekintettel a valódi kulturális értékre — írta a Telex. A visszautalók listáján számos, politikai kötődéssel rendelkező szervezet szerepel, amelyek korábban az NKA kuratóriumán keresztül jutottak hozzá a forrásokhoz.

A Nemzeti Adó- és Vámhivatal (NAV) hűtlen kezelés és költségvetési csalás gyanújával nyomozást indított. A nyomozás nemcsak Budapesten folyik: Győrben is indult eljárás, ahol helyi kulturális szervezetek kaptak aránytalanul nagy összegeket. A NAV Molnár Áront, a közismert humoristát is tanúként hallgatta ki az NKA-val kapcsolatos ügyekben — számolt be a Telex.

Az NKA botránya az intézményi lemondások sorát is elindította. Bús Balázs, az NKA alelnöke 2026. április 28-án mondott le. Báán László, a Szépművészeti Múzeum igazgatója április 30-án követte őt, szintén kilépett az NKA bizottságából. Vidnyánszky Attila, a Nemzeti Színház igazgatója május 2-án mondott le az NKA-s pozícióból — bár a Nemzeti Színház élén egyelőre megmaradt. Mindhárom visszalépés azt jelzi, hogy az NKA korábbi döntéshozói felismerték: a fennmaradó politikai felelősségtől való távolságtartás az egyetlen reális opció.

Az ügy hátterét az NKA egy egykori kuratóriumi tagjának nyilatkozata világítja meg a legjobban. Ő nyilvánosan kijelentette: a Kulturális Alaptól „érdemtelenek kaptak érdemtelenül sok pénzt többnyire értelmezhetetlen projektekre" — 17 milliárd forint értékben — írta a Telex a visszautalásokról szóló cikkében. Ez az összeg a teljes NKA-szétosztatlan keret igen nagy hányada, és azt sugallja, hogy a visszautaló 49 pályázón kívül még jóval többen is politikai logika szerint, nem kulturális szempontok alapján jutottak forráshoz.

A NAV nyomozása jelenleg is tart. Az eljárás tétje nem csupán Hankó Balázs egyéni felelőssége, hanem az NKA teljes döntéshozatali mechanizmusa: kinek a nevében, kinek a számlájára, milyen kritériumok alapján mentek ki a közpénzek az elmúlt évtizedben. Az NKA-botrány a „legdurvább ügyek" listáján elsősorban azért szerepel, mert ez az egyetlen ügy a sorozatból, ahol a pénz — részben — visszajött.`,
  },

  {
    id: 'lelegeztetogep',
    eyebrow: 'Lezáratlan · Nincs felelős',
    title: 'Lélegeztetőgép-botrány',
    responsible: 'Takács Péter',
    responsibleGaleriaId: 'takacs-peter',
    estimatedDamage: '~300 milliárd Ft — EU legdrágább lélegeztetőgép-vásárlása',
    responsiblePersons: ['Takács Péter — volt belügyminiszter-helyettes', 'Fourcardinal Kft. tulajdonosi köre — Orbán-tanácsadó fivérével'],
    crimeTypes: ['Közbeszerzési visszaélés', 'Hűtlen kezelés (gyanú)', 'Bennfentes kereskedelem (gyanú)'],
    relatedPersonIds: ['takacs-peter', 'orban-viktor'],
    articleKeywords: ['lélegeztetőgép'],
    moreUrl: '/ugyek/lelegeztetogep',
    summary: '2020-ban a magyar kormány az EU legdrágábban vásárolta a kínai lélegeztetőgépeket — 17 ezer darabot, egységenként 17–20 millió forintért, miközben az EU-s átlag 4 millió volt. A 300 milliárdos ügyletből Orbán főtanácsadójának fivére és Takács Péter sógora milliárdokat vett fel osztalékként. Büntetőeljárás mind a mai napig nincs.',
    videoId: 'DrHUAmHMZBM',
    videoChannel: 'Puzser Robert',
    videoTitle: 'Közpénztékozlás vagy pánikvasárlás?',
    videoSummary: '2020-ban Magyarország az EU-ban a legdrágábban vásárolta a kínai lélegeztetőgépeket — háromszoros áron, miközben a pénz egy ismeretlen Fourcardinal Kft.-n folyt át. Ez a videó a 300 milliárdos ügylet mögé néz: ki döntött, ki keresett rajta, és miért nincs eddig senki felelősségre vonva.',
    additionalVideos: [
      { id: 'wv8Xnl1UhUY', label: 'Telex', title: 'Hogy választották ki a cégét lélegeztetőgép-beszerzésre? – Viszonthallásra, csókolom!' },
      { id: 'wSAiX5LqzlY', label: 'ATV', title: 'Lélegeztetőgép-biznisz: megsemmisítette a Külügyminisztérium az iratokat' },
      { id: 'rQIj--mE__g', label: 'HVG', title: 'A „halál vámszedői" voltak a lélegeztetőgép-bizniszben érintettek is?' },
      { id: '6Uu4efzlhSM', label: 'Puzsér Róbert', title: 'Újabb közpényherdáló lélegeztetőgép-vásárlás, csúcsra járatott mutyi és forgóajtóban előző magyarok' },
      { id: 'jynDYieouFs', label: 'Hadházy Ákos', title: 'Korrupcióinfó: A nagy lélegeztetőgép-panama' },
    ],
    statusItems: [
      { icon: '💰', label: 'Érintett összeg', value: '~300 milliárd Ft — EU legdrágább lélegeztetőgép-vásárlása' },
      { icon: '👤', label: 'Érintett', value: 'Takács Péter sógora — 8 Mrd Ft osztalékot vett fel a Fourcardinalból' },
      { icon: '⚖️', label: 'Státusz', value: 'Nincs büntetőeljárás — KEHI és NAV "nem talált szabálytalanságot"' },
    ],
    sourceRefs: [],
    description: `A lélegeztetőgép-botrány a magyar korrupcióipar egyik legszemtelenebb esete: a COVID-19 járvány első hullámában a magyar állam 300 milliárd forintot fizetett 17 ezer kínai lélegeztetőgépért — miközben az EU-s piaci átlagár töredéke lett volna az indokolt vételár.

A számok magukért beszélnek. Magyarország 2020-ban egységenként 17–20 millió forintot fizetett olyan lélegeztetőgépekért, amelyeket az EU többi tagállama 3–4 millió forintos áron szerzett be. A teljes ügylet értéke így kb. 300 milliárd forint volt — ez az EU-s legdrágább lélegeztetőgép-vásárlás. Sem a kormány, sem egyetlen közbeszerzési szabályzat nem indokolta, miért kellett ennyit fizetni.

A vásárlás nyertesei egyértelműen azonosíthatók. A Fourcardinal Kft. — amely a szerződések egyik fő haszonélvezője volt — tulajdonosi körében megtalálható Orbán Viktor egy közeli tanácsadójának fivére, valamint Takács Péter belügyminiszter-helyettes sógorának neve. A Fourcardinalból 8 milliárd forint értékű osztalékot vett fel Takács Péter sógora rövid idő alatt — egy olyan cégen keresztül, amely korábban nem folytatott orvostechnikai eszköz-kereskedelmet.

Az elszámoltatás teljes mértékben elmaradt. A Kormányzati Ellenőrzési Hivatal (KEHI) és a NAV egyaránt vizsgálatot folytatott, de mindkét testület arra a következtetésre jutott, hogy szabálytalanságot nem talált. A vizsgálatok rövidek és felszínesek voltak; a tényleges haszonélvezők kilétét egyik hatóság sem tárta fel nyilvánosan. Semmilyen büntetőeljárás nem indult.

A lélegeztetőgépek egy részét soha nem vetették be klinikai használatban: rosszul szellőztetett raktárakban tárolták őket, majd az egészségügyi intézmények visszautasították a gépek egy részét alkalmatlanság miatt. Az elvesztegetett közpénz mégsem vált bírósági üggyé.

Ez az ügy nemcsak a közvetlen anyagi kár miatt kerül a legdurvább ügyek közé, hanem azért is, mert a teljes intézményi elszámoltatási rendszer — KEHI, NAV, ügyészség — koordináltan mondott csődöt. A 2026-os kormányváltás után a nyomozóhatóságok elvben újra megvizsgálhatják az ügyet, de ez egyelőre nem történt meg.`,
  },

  {
    id: 'hatvanpuszta',
    eyebrow: 'Lezáratlan · Nincs eljárás',
    title: 'Hatvanpuszta',
    responsible: 'Orbán Viktor',
    responsibleGaleriaId: 'orban-viktor',
    estimatedDamage: '~20 milliárd Ft becsült ingatlanérték — ismeretlen forrásból',
    responsiblePersons: ['Orbán Viktor — miniszterelnök'],
    crimeTypes: ['Vagyonnyilatkozat megsértése (gyanú)', 'Ismeretlen vagyonforrás', 'Pénzmosás (gyanú)'],
    relatedPersonIds: ['orban-viktor'],
    articleKeywords: ['hatvanpuszta'],
    moreUrl: '/ugyek/hatvanpuszta',
    summary: 'Orbán Viktor 250 hektáros, ~20 milliárd forintra becsült majorságának valódi tulajdonosa és finanszírozási forrása ismeretlen — az ingatlan értéke összeegyeztethetetlen Orbán nyilvánosan bejelentett vagyonával. A sajtó többször vetette fel a vagyonnyilatkozat megsértését.',
    videoId: 'HiW9r1M32ug',
    videoChannel: '444.hu',
    videoTitle: 'Hatvanpuszta — Orbán titkos majorja',
    videoSummary: 'Drónfelvételek, helyszíni riport és korábbi képek összehasonlítása mutatja meg, hogyan fejlődött az elmúlt években az a major, amelynek valódi tulajdonosa és finanszírozási forrása máig ismeretlen — és amelynek értéke összeegyeztethetetlen Orbán nyilvánosan bejelentett vagyonával.',
    additionalVideos: [
      { id: 'aJwSuQ6jXQU', label: 'Hadházy Ákos', title: 'Mit rejt Hatvanpuszta? – Belső felvételek, amiket látni kell' },
      { id: '1AMXLof1-rY', label: '24.hu', title: 'Hatvanpuszta az Orbán család kegyelmi ügye?' },
      { id: '0-bgf65aqGc', label: 'Kontroll', title: 'A hatvanpusztai zebráknak nem volt választásuk // Drónfelvételek Orbán és Mészáros birtokairól' },
      { id: 'JHsdnuogC7o', label: 'Gulyáságyú Média', title: 'Zebrák Mészáros Lőrincéknél Hatvanpuszta és Bicske között' },
      { id: 'GvEyTRl2NTM', label: 'Kalapacs', title: 'Építész reagál a HATVANPUSZTAI BIRTOKRA' },
    ],
    statusItems: [
      { icon: '🏡', label: 'Becsült érték', value: '~20 milliárd Ft · 250 hektár · Vas megye' },
      { icon: '❓', label: 'Forrás', value: 'Ismeretlen — összeegyeztethetetlen a vagyonnyilatkozattal' },
      { icon: '⚖️', label: 'Státusz', value: 'Nincs ismert büntetőeljárás' },
    ],
    sourceRefs: [],
    description: `Hatvanpuszta Orbán Viktor 250 hektáros majorsága Vas megyében. Az ingatlan — amelynek becsült értéke 15–20 milliárd forint körül van — nem szerepelt soha teljes értéken Orbán kötelező vagyonnyilatkozatában. A valódi tulajdonosi struktúra, az ingatlan eredeti megszerzési ára és a finanszírozás forrása máig nem nyilvános.

A kérdés egyszerű: egy miniszterelnök, akinek hivatalos jövedelme a köztisztviselői fizetésből áll, hogyan tarthat fenn egy 250 hektáros, tízmilliárdos értékű ingatlant? A sajtóban feltárt adatok szerint a hatvanpusztai major épületei, a gazdasági infrastruktúra és a telek nagysága messze meghaladja azt, amit bármely fővárosi politikus bejelentett jövedelmeiből fenn lehetne tartani.

Az ingatlan tényleges tulajdonosi köre sem tisztázott. A formalitások szintjén különböző cégek és alapítványok jelennek meg tulajdonosként, de ezek valódi haszonélvezője és az indulótőke forrása ismeretlen. A K-Monitor adatbázisában és az investigatív sajtóban (Direkt36, 444, Átlátszó) megjelent elemzések rámutattak, hogy a látható tulajdonosi struktúra jellemzően nem kapcsolható Orbán közvetlen nevéhez — ez az anonimitás nem véletlenszerű.

A hatvanpusztai ügy politikailag különösen kényes, mert közvetlen bizonyítékot adhat Orbán személyes vagyongyarapodásáról — szemben a NER többi tagjával, akiknél az érintett vagyonelemek más személyek nevén futnak. Ha Hatvanpuszta valóban Orbán tényleges vagyonaként kezelendő, az vagyonnyilatkozati visszaélést, adócsalást és ismeretlen forrású vagyon megszerzését is felvetné egyszerre.

Intézményes vizsgálat mindeddig nem volt. A 2026-os kormányváltás után elméletileg megnyílik az út, hogy az Állami Számvevőszék, a NAV és az ügyészség is megvizsgálja Orbán vagyonnyilatkozatainak valóságtartalmát.`,
  },

  {
    id: 'aranykonvoj',
    eyebrow: 'Aktív · Feljelentés benyújtva',
    title: 'Aranykonvoj-ügy',
    responsible: 'Orbán Viktor',
    responsibleGaleriaId: 'orban-viktor',
    estimatedDamage: 'Ismeretlen — lefoglalt arany és deviza, összeg nem nyilvános',
    responsiblePersons: ['Az Orbán-körhöz köthető személyek — ügyvédi feljelentés alapján'],
    crimeTypes: ['Terrorcselekmény (gyanú)', 'Pénzmosás (gyanú)', 'Illegális vagyonkimenekítés (gyanú)'],
    relatedPersonIds: ['orban-viktor'],
    articleKeywords: ['aranykonvoj'],
    moreUrl: '/ugyek/aranykonvoj',
    summary: '2026 tavaszán a NAV és a titkosszolgálat megállított egy Ukrajna határán átkelő konvojt, amely aranyat és devizát szállított. Az ügyvéd feljelentése terrorcselekmény-gyanút is tartalmaz. Az ügy közvetlenül az Orbán-körhöz köthető személyekhez vezet.',
    videoId: 'cLBTdDVztR0',
    videoChannel: 'Telex.hu',
    videoTitle: 'Az aranykonvoj rejtélye',
    videoSummary: '2026 tavaszán a NAV és a titkosszolgálat egy Ukrajna felé tartó konvojt állított meg a határon — arannyal és devizával megrakva. De kié volt, és hova tartott? Ez a videó az ügy első nyilvános összefoglalója, amelyből kiderül: a szálak az Orbán-körhöz vezető személyekhez futnak vissza.',
    additionalVideos: [
      { id: 'WevENutaeuw', label: 'ATV', title: 'Politikai döntés állhat az ukrán „aranykonvoj" hirtelen visszaadásának hátterében' },
      { id: 'uXifE1zlyIE', label: 'ATV', title: 'Aranykonvoj: Terrorcselekmény-részesség is felmerülhet Sulyok Tamás esetében?' },
      { id: 'wY6l64N9yDE', label: 'Klikk TV', title: 'LÁZÁR robbantott – Az ukrán ARANYKONVOJ ügye ORBÁNHOZ vezet' },
      { id: 'B0ofUa1X0QU', label: 'DW Magyar', title: 'Aranykonvoj: Orbán szerepe és a nemzetbiztonsági kockázatok az ukrán pénzszállítók elleni akcióban' },
    ],
    statusItems: [
      { icon: '⚖️', label: 'Eljárás', value: 'Feljelentés benyújtva — terrorcselekmény gyanúja is' },
      { icon: '🏦', label: 'Lefoglalt', value: 'Arany + deviza — pontos összeg nem nyilvános' },
      { icon: '👤', label: 'Kapcsolat', value: 'Orbán-körhöz köthető személyek érintettségét veti fel az ügyvéd' },
    ],
    sourceRefs: [],
    description: `Az aranykonvoj-ügy 2026 tavaszán robbant a köztudatba, amikor a Nemzeti Adó- és Vámhivatal (NAV) és a titkosszolgálat közös akcióban megállított egy konvojt a magyar–ukrán határon. A konvoj aranyat és jelentős mennyiségű külföldi devizát szállított Ukrajna irányába.

A vagyonkimenekítés gyanúja azonnal felmerült. A konvoj megállítása egybeesett azzal az időszakkal, amikor a Fidesz-kormány elvesztette a választásokat, és a hatalomátadás közeledett. Az időzítés és a szállított vagyon jellege — arany, készpénz, deviza — arra utalt, hogy valaki sietett a vagyont az ország határain kívülre juttatni.

Az ügyvédi feljelentés terrorcselekmény gyanúját is tartalmazza. Ez szokatlan jogi minősítés egy vagyonkimenekítési ügynél, de az ügyvéd érvelése szerint a szándékos állami vagyonkárosítás és az elkövetők köre indokolttá teszi. A feljelentést benyújtó ügyvéd szerint a konvoj tulajdonosi köre közvetlenül kapcsolódik az Orbán-kormány belső köréhez.

A lefoglalt arany és deviza pontos értéke nem nyilvános; a nyomozó hatóságok nem közöltek részleteket. Az ügy vizsgálata folyamatban van, de az eljárás ütemezése és eddigi eredményei a közvélemény előtt ismeretlenek.

Az aranykonvoj-ügy szimbolikus értéke rendkívül magas: ha bebizonyosodik, hogy a Fidesz-kör szándékosan menekítette ki az ország vagyonát az elveszített választások után, az nemcsak büntetőjogi, hanem alkotmányos és politikai következményekkel is jár.`,
  },

  {
    id: 'mnb-botrany',
    eyebrow: 'Aktív · Nyomozás folyamatban',
    title: 'MNB botrány',
    responsible: 'Matolcsy György',
    responsibleGaleriaId: 'matolcsy-gyorgy',
    estimatedDamage: '266+ milliárd Ft — közpénz MNB alapítványokon átfolyva',
    responsiblePersons: ['Matolcsy György — MNB elnöke (2013–2025)'],
    crimeTypes: ['Hűtlen kezelés', 'Sikkasztás (gyanú)', 'Közbeszerzési visszaélés'],
    relatedPersonIds: ['matolcsy-gyorgy'],
    articleTag: 'MNB',
    moreUrl: '/ugyek/mnb-botrany',
    summary: 'Matolcsy György az MNB elnökeként 266 milliárd forintot csatornázott alapítványokon keresztül. Az ÁSZ kiszivárgott jelentés-tervezete súlyos vagyonvesztést és szabálytalanságokat tárt fel. Az ügyészség 2026-ban nyomozást indított hűtlen kezelés és más bűncselekmények gyanúja miatt.',
    videoId: 'bgA0PTDFKlY',
    videoChannel: 'Telex.hu',
    videoTitle: 'Az MNB-botrány egy évvel később',
    videoSummary: 'Matolcsy György jegybankelnökként 266 milliárd forintot csatornázott alapítványokon keresztül magánkezekbe. Egy évvel a botrány kirobbanása után ez a videó megnézi: mi változott? A válasz rövid — szinte semmi. A főszereplők szabadon élnek, vagyon nem tért vissza.',
    additionalVideos: [
      { id: 'ooMNrvuHF0Q', label: 'ATV', title: 'MNB-botrány: Varga Mihály mindenről tudott – állítja a Transparency International' },
      { id: 'digiZ-bQz_c', label: 'Telex', title: 'A nagy játszma' },
      { id: 'ELm-NEReBBk', label: 'ATV', title: 'MNB-botrány: Óriási mennyiségű adatot foglaltak le a hatóságok – megszólalt a legfőbb ügyész' },
      { id: 'c-P_pqmnSYQ', label: 'ATV', title: '„Négyszer zsarolták meg a bankot" – Súlyos állítást tett a Matolcsy-korszakról az MNB volt alelnöke' },
      { id: '-JuOo5O_Qeo', label: 'Klubrádió', title: 'A világ legnagyobb bankrablása.... A Matolcsy ügyről...Simor András, az MNB volt elnöke' },
    ],
    statusItems: [
      { icon: '💰', label: 'Érintett közpénz', value: '266+ milliárd Ft — MNB alapítványokon átfolyva' },
      { icon: '📋', label: 'Feltárta', value: 'ÁSZ (Állami Számvevőszék) — kiszivárgott jelentés-tervezet' },
      { icon: '⚖️', label: 'Nyomozás', value: 'Ügyészség 2026-ban indított nyomozást — hűtlen kezelés gyanúja' },
    ],
    sourceRefs: [
      { label: '444: ÁSZ vizsgálat az MNB alapítványokról', url: 'https://444.hu/2025/03/19/az-allami-szamvevoszek-vizsgalja-az-mnb-alapitvanyait' },
    ],
    description: `A Magyar Nemzeti Bank (MNB) botránya az évtized egyik legsúlyosabb közpénzügyi ügye. Matolcsy György jegybankelnök 2013 és 2025 között összesen 266 milliárd forintot csatornázott ki a jegybank mérlegéből különböző alapítványokba — a Pallas Athéné Alapítványcsalád tagjaiba, a Közgazdasági Ismeretterjesztő Alapítványba és más szatellit-szervezetekbe.

Az összeg rendkívülisége nem vitatható: 266 milliárd forint nagyjából annyi, mint az ország éves egészségügyi fejlesztési büdzséjének fele. A pénzt az MNB törvényi keretek alapján „közfeladat-ellátásra" utalhatta, de a konkrét célok és az eredmények soha nem kerültek nyilvánosan átlátható formában közzétételre.

Az ÁSZ kiszivárgott jelentés-tervezete 2025-ben döntő fordulatot hozott. A tervezet, amelyet az Átlátszó és más investigatív portálok is idéztek, súlyos vagyonvesztést és rendszeres szabálytalanságokat tárt fel az MNB alapítványainak gazdálkodásában. Az ÁSZ megállapításai szerint az alapítványoknak átadott eszközök és pénzeszközök egy részénél nem volt kimutatható, hogy azok visszakerültek volna a jegybankhoz, és nem volt nyilvánosan igazolható a befektetési hozam sem.

A tulajdonosi körökre vonatkozó gyanú is felmerült. Matolcsy György unokatestvérének neve — Balogh Csaba — megjelent az alapítványi körrel üzleti kapcsolatban álló szervezeteknél. Ez közvetlen összefonódást sugall a jegybankelnök és a közpénzek haszonélvezői között.

A 2026-ban megalakuló új kormány ügyészsége nyomozást indított. Az eljárás hűtlen kezelés gyanújával indul, de az ügyészség tájékoztatása szerint a lehetséges bűncselekmények köre szélesebb lehet. Matolcsy Györgynek le kellett mondania az MNB elnöki posztjáról; az MNB új elnöke megkezdte az intézményi átvilágítást.

Az MNB-botrány különlegessége, hogy egy törvényileg autonóm intézmény — az MNB — törvényi keretek között, de a valódi közérdek ellenében csatornázta ki a közpénzt. Ez a jogi szürkezóna megnehezíti az elszámoltatást, de nem teszi lehetetlenné.`,
  },

  {
    // JOGI FIGYELMEZTETÉS: Ez az ügy NEM Semjén Zsolt személyéről szól.
    // „Zsolti bácsi" egy gyermekvédelmi intézménnyel kapcsolatos külön személy.
    // Semjén Zsolt neve TILOS ebben a bejegyzésben szerepelni bármilyen formában.
    id: 'zsolt-bacsi',
    eyebrow: 'Aktív · Nyomozás folyamatban',
    title: 'Ki az a Zsolti bácsi?',
    responsible: 'Ismeretlen személy',
    responsibleGaleriaId: undefined,
    estimatedDamage: undefined,
    responsiblePersons: [
      '„Zsolti bácsi" — gyermekvédelmi intézménnyel kapcsolatos személyazonosság',
      'Felügyeleti hatóságok — az eltussolás gyanúja miatt vizsgálat alatt',
    ],
    crimeTypes: [
      'Kiskorú sérelmére elkövetett bűncselekmény (gyanú)',
      'Hatósági eltussolás (gyanú)',
      'Felügyelet elmulasztása',
    ],
    relatedPersonIds: [],
    articleKeywords: ['zsolti bácsi', 'zsolt bácsi', 'szőlő utca', 'szőlő utcai'],
    moreUrl: '/ugyek/zsolt-bacsi',
    summary: 'A „Zsolti bácsi"-ügy egy gyermekvédelmi intézménnyel összefüggő bántalmazási botrány, amelynek koronatanúja vallomást tett a Szőlő utcai ügy eljárása során. A kormány — miután az ügy nyilvánosságra került — ellentámadásba lendült. Az eljárás folyamatban van.',
    videoId: 'QXW84vh1hV8',
    videoChannel: 'Juhász Péter | Juhi',
    videoTitle: 'A Szőlő utcai ügy',
    videoSummary: 'A gyermekvédelmi rendszer egyik legsúlyosabb botránya: hogyan bántalmazhatott éveken át egy ismeretlen elkövető kiskorúakat egy állami intézménnyel összefüggésben, és miért nem tette meg senki a feljelentést? Juhász Péter investigatív riporter feltárása.',
    additionalVideos: [
      { id: '73cykWAjq6o', label: 'Kontroll', title: 'Zsolti bácsiról is vallomást tett a Szőlő utcai ügy koronatanúja' },
      { id: 'hn532z03I-o', label: 'Népszava', title: 'Juhász Péter: Zsolt bácsi azt hitte, bármit megtehet' },
      { id: 'fGJfg_5j5mw', label: 'ATV', title: 'Kicsoda Zsolti bácsi?' },
      { id: 'rGSLneeWtOc', label: 'Kontroll', title: 'A „Zsolti bácsi ügy" tanulságairól és a gyermekvédelem előtt álló feladatokról' },
      { id: '3TGfMPd9WE0', label: 'ATV', title: 'Zsolti bácsi-ügy – ellentámadásba lendült a kormány' },
    ],
    statusItems: [
      { icon: '⚖️', label: 'Eljárás', value: 'Nyomozás folyamatban — Szőlő utcai ügy keretében' },
      { icon: '🧒', label: 'Érintett', value: 'Gyermekvédelmi intézményben gondozott gyerekek' },
      { icon: '📢', label: 'Koronatanú', value: 'Vallomást tett a Szőlő utcai ügy eljárása során' },
      { icon: '🏛️', label: 'Kormány reakciója', value: 'Az ügy nyilvánosságra kerülése után ellentámadásba lendült' },
    ],
    sourceRefs: [],
    description: `A „Zsolti bácsi"-ügy a magyar gyermekvédelmi rendszer egyik legsúlyosabb, nyilvánosságra került botránya. Az ügyet a „Szőlő utcai ügy" tette ismertté: egy gyermekvédelmi intézménnyel kapcsolatos eljárás során a koronatanú vallomást tett a „Zsolti bácsi" nevű személy tevékenységéről.

Az ügy egy gyermekvédelmi intézmény körül forgott, ahol a gondozottak gyerekek sérelmére elkövetett bűncselekmények gyanúja merült fel. A „Zsolti bácsi" elnevezés az érintett személy beceneve — személyazonossága az eljárás előrehaladtával vált részben nyilvánossá a sajtóban.

Az ügyet Juhász Péter és más investigatív újságírók tárták fel. Juhász Péter nyilvánosan kijelentette: „Zsolt bácsi azt hitte, bármit megtehet" — utalva arra, hogy az érintett személy a védettsége tudatában cselekedett. Ez a védettség a gyermekvédelmi intézményi háttérből és a hatósági figyelmetlenségből fakadhatott.

Az ügy nyilvánosságra kerülése után a korábbi kormány ellentámadásba lendült. Az ATV értesülései szerint a kormány politikai nyomást igyekezett gyakorolni az ügy kezelésére, ami az eltussolás gyanúját is felvetette. A parlamenti reakciók a gyermekvédelmi rendszer teljes átvilágítását sürgették.

A nyomozás jelenleg is folyamatban van. Az ügy tétje kettős: egyrészt az egyéni felelősség megállapítása az intézményi bántalmazásért, másrészt a rendszerszintű hiányosságok feltárása — hogy a gyermekvédelmi intézmények hogyan nyújthattak védelmet a bántalmazónak ahelyett, hogy a gyerekeket védték volna.`,
  },

  {
    id: 'pecsi-volvo-gate',
    eyebrow: 'Aktív · Újabb nyomozás indult',
    title: 'Pécsi Volvo-gate',
    responsible: 'Bánki Erik',
    responsibleGaleriaId: undefined,
    photo: 'https://assets.telex.hu/images/20240228/1709123621-temp-BIgOPf_hero-normal:xl@1.25x.jpg',
    photoCredit: 'Telex',
    photoPosition: 'right top',
    estimatedDamage: '~700 millió Ft közkár — 3,5 Mrd Ft helyett 2,8 Mrd lett volna a piaci ár',
    responsiblePersons: ['Bánki Erik — fideszes országgyűlési képviselő'],
    crimeTypes: ['Közbeszerzési visszaélés', 'Hűtlen kezelés', 'Vesztegetés (gyanú)'],
    relatedPersonIds: [],
    articleKeywords: ['volvo', 'Bánki', 'Tüke'],
    moreUrl: '/ugyek/pecsi-volvo-gate',
    summary: 'A pécsi Tüke Zrt. 2010-ben 115 használt Volvo buszt vásárolt Hollandiából 3,5 milliárd forintért — miközben azonos buszokat pár hónappal korábban 2,8 milliárdért kínáltak. A ~700 millió forintos közkárból 170 millió forint egy Bánki Erik fideszes képviselőhöz köthető cégnek folyt ki, 550 000 EUR részben Thaiföldre vándorolt. Éveken át eltussolták; Hadházy 2026-os feljelentése nyomán újabb nyomozás indult.',
    videoId: 'feWPUeFNDmU',
    videoChannel: 'Bogos Csaba',
    videoTitle: 'A Volvo-gate: Fidesz-módra üzletelni',
    videoSummary: '115 használt Volvo busz, 700 millió forintos közkár, és egy fideszes képviselőhöz köthető cég, amely busásan keresett az ügyleten. A videó bemutatja, hogyan működött a pécsi Tüke Zrt. 2010-es buszbeszerzése — és miért tart a nyomozás máig.',
    additionalVideos: [
      { id: 'fHYq5M2I_Bc', label: 'Keresztes László Lóránt', title: 'Jogerős ítélet a Volvo-ügyben: korrupció, gazdasági csalás, pénzmosás' },
      { id: '5MAc48hLzGg', label: 'Hadházy Ákos', title: 'A pécsi Volvo-gate: Bánki-ügy eltussolva' },
      { id: 'yyEfZLGCkz4', label: 'Szabad Pécs', title: 'Öt év börtönre ítélte a Volvo-gate vádlottjait a Szekszárdi Törvényszék' },
      { id: 'ei1y20B8rig', label: 'Szabad Pécs', title: 'Bánki Erik: „szerénység és alázat"' },
    ],
    statusItems: [
      { icon: '💰', label: 'Becsült közkár', value: '~700 millió Ft' },
      { icon: '💸', label: 'Bánki-közeli céghez folyt', value: '52 M Ft Bánki cégéhez · 550 000 EUR Thaiföldre utalva (170 M Ft)' },
      { icon: '⚖️', label: 'Eljárás', value: 'Szekszárdi Törvényszék újratárgyalja · 2026-ban Hadházy feljelentése nyomán újabb nyomozás' },
      { icon: '👤', label: 'Érintett', value: 'Bánki Erik — tanúként harmadszor hallgatták meg 2025-ben' },
    ],
    sourceRefs: [],
    description: `A pécsi Volvo-gate az a típusú közbeszerzési botrány, ahol minden egyes szám hazugságot bizonyít — csak éppen soha senkit nem ítéltek el érte.

2010-ben a pécsi Tüke Busz Zrt. 115 darab használt Volvo autóbuszt vásárolt holland közvetítőkön keresztül. A vételár: 3,5 milliárd forint. A probléma: ugyanezeket a buszokat — vagy azonos típusú, hasonló állapotú járműveket — fél évvel korábban 2,8 milliárd forintos ajánlati áron lehetett volna megvenni. A különbözet 700 millió forint: ez a közkár.

A 700 millió forintnyi különbözet nem tűnt el a levegőben. Egy Bánki Erikhez köthető cég 52 millió forintnyi részt kapott a tranzakcióból tanácsadói díj formájában — derült ki az évek során felhalmozódott nyomozati anyagokból. A feltárt összegek egy részét — körülbelül 550 000 eurót, azaz kb. 170 millió forintot — Thaiföldre utalták el. Az összegek végső sorsát és az offshore struktúra pontos jellegét a nyomozás soha nem derítette fel teljes egészében.

Bánki Erik fideszes képviselő 2025-ig háromszor tett tanúvallomást az üggyel kapcsolatban. Minden alkalommal tagadott. Közvetlen személyes felelősséget a bírósági ítélet eddig nem állapított meg.

Hadházy Ákos független képviselő 2026-ban új feljelentést nyújtott be az ügyben, amelyet a Fejér Megyei Rendőrkapitányság el is fogadott. Párhuzamosan a Szekszárdi Törvényszék is újratárgyalja az ügyet. A két párhuzamos eljárás felkeltette az ügy iránt évek óta lanyhult figyelmet.

A Volvo-gate azért kerül a legdurvább ügyek közé, mert ez az egyik legjobban dokumentált, adatokkal alátámasztott közbeszerzési visszaélés — ahol a közkár összege, az érintett cég neve és a pénzáramlás iránya egyaránt nyomon követhető —, és mégsem született jogerős ítélet másfél évtized alatt.`,
  },
];
