export interface BigCaseStatus {
  icon: string;
  label: string;
  value: string;
}

export interface BigCaseVideo {
  id: string;
  label: string;
  title: string;
  featured?: boolean;
  summary?: string;
}

export interface BigCaseRef {
  label: string;
  url: string;
}

export type BreakingGroupArticle = { source: string; headline: string; lead?: string; url: string; date?: string };

export type DescriptionBlock =
  | { type: 'text'; heading?: string; content: string }
  | { type: 'video'; id: string; label?: string; title?: string; summary?: string }
  | { type: 'article-card'; source: string; headline: string; lead?: string; url: string; date?: string; breaking?: boolean }
  | { type: 'breaking-box'; headline: string; lead?: string }
  | { type: 'breaking-group'; headline: string; lead?: string; articles: BreakingGroupArticle[] }
  | { type: 'quote'; text: string; author?: string; note?: string; url?: string }
  | { type: 'pdf-link'; url: string; label: string; note?: string }
  | { type: 'image-pair'; src1: string; alt1?: string; src2: string; alt2?: string; caption?: string }
  | { type: 'audio-link'; url: string; title: string; source: string; duration?: string };

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
  descriptionBlocks?: DescriptionBlock[];
  videoId?: string;
  videoChannel?: string;
  videoTitle?: string;
  videoSummary?: string;
  additionalVideos?: BigCaseVideo[];
  estimatedDamage?: string;
  estimatedDamageLabel?: string;
  responsiblePersons?: string[];
  crimeTypes?: string[];
  relatedPersonIds?: string[];
  articleTag?: string;
  articleKeywords?: string[];
  /**
   * AND-groups of headline keywords, OR'd together — for cases where a
   * single broad keyword (e.g. "vagyonvesztés") is too generic on its own
   * but becomes a confident match paired with a second, case-specific term.
   */
  articleKeywordGroups?: string[][];
  /**
   * Hand-curated "Kapcsolódó hírek" entries for older/background articles
   * that predate the site's own scrape pipeline (so they'd never surface
   * via articleKeywords/articleTag matching against NewsArticle). Rendered
   * alongside the auto-matched DB articles, not instead of them.
   */
  pinnedNews?: BreakingGroupArticle[];
  moreUrl?: string;
  sourceRefs?: BigCaseRef[];
  statusItems: BigCaseStatus[];
}

// FONTOS JOGI KORLÁTOZÁS:
// A "zsolt-bacsi" ügy NEM kapcsolódik Semjén Zsolt személyéhez.
// Semjén Zsolt neve TILOS bármilyen formában megjelenni ebben az ügyben.
// A „Zsolti bácsi" egy különálló személy egy gyermekvédelmi botránnyal összefüggésben.
const _ZSOLT_BACSI_SEMJEN_GUARD = null; // intentionally unused — marker comment only

// Old /ugyek/<id> slugs that now redirect to a renamed canonical id — e.g.
// 2026-07-14: 'zsolt-bacsi' -> 'ki-az-a-zsolt-bacsi' for SEO (matches the
// actual search phrase people use). See [id]/page.tsx for the redirect().
export const UGYEK_REDIRECTS: Record<string, string> = {
  'zsolt-bacsi': 'ki-az-a-zsolt-bacsi',
};

export const UGYEK: UgyekConfig[] = [
  {
    id: 'nka-botrany',
    eyebrow: 'Aktív · 6 személy előzetesben, 7. gyanúsított letartóztatása folyamatban',
    title: 'NKA botrány',
    responsible: 'Hankó Balázs',
    responsibleGaleriaId: undefined,
    photo: '/images/persons/hanko-balazs.png',
    photoCredit: 'Eredeti fotó: kultura.hu',
    estimatedDamage: 'Több tízmilliárd Ft — tiltott pártfinanszírozásra kiosztott közpénz',
    responsiblePersons: ['Hankó Balázs — volt kulturális miniszter'],
    crimeTypes: ['Hűtlen kezelés', 'Költségvetési csalás', 'Közbeszerzési szabálysértés'],
    relatedPersonIds: [],
    articleTag: 'NKA',
    // articleTag='NKA' csak a 2026 tavaszi egyszeri import-nka.ts szkript
    // kézi tag-jét találja meg — a folyamatos scraper (scrape-news.ts) soha
    // nem oszt ki ilyen ügy-specifikus tag-et, csak generikus kategóriákat
    // (korrupció/lemondás/médiaügy stb.), ezért minden azóta érkezett
    // NKA-cikk kimaradt a "kapcsolódó hírekből". A többi ügy (aranykonvoj,
    // hatvanpuszta stb.) articleKeywords-szel működik folyamatosan — ugyanezt
    // pótoljuk itt is.
    articleKeywords: ['NKA', 'Hankó Balázs', 'Nemzeti Kulturális Alap'],
    moreUrl: '/ugyek/nka-botrany',
    summary: 'Hankó Balázs volt kulturális miniszter a 2026-os választások előtt szabálytalanul osztott ki milliárdos NKA-támogatásokat — közel 394 millió forintnyi egyedi miniszteri keretből. A NAV hűtlen kezelés bűntett gyanújával nyomoz, az ügy 17+ milliárd Ft-ot érint. Tarr Zoltán a kifizetések átvizsgálását rendelte el.',
    videoId: 'NRA-QuItdUA',
    videoChannel: 'Molnár Áron',
    videoTitle: 'Megszólal a forrás',
    videoSummary: 'Egy bennfentes forráson keresztül tárja fel ez a videó, hogyan osztotta ki Hankó Balázs kulturális miniszter a választások előtt a közpénzeket az NKA-n keresztül. Az ügyet elsőként hozó riporter egyenesen a forrástól hallja a részleteket.',
    additionalVideos: [
      { id: 'OfMzRRIJ9WQ', label: 'Telex', title: 'Segélyszervezetnek tűnt, aztán rájöttünk, hogy ez a Fidesz – az NKA-botrány mélyére mentünk' },
      { id: 'df2GNzmh7pY', label: 'ATV', title: 'Botrányos kifizetések az NKA-nál: Rónai Egon megizzasztotta Hankó Balázs ex-minisztert' },
      { id: 'L8DWqeZp2l4', label: 'Partizán', title: 'Újabb 700 millió Orbán Ráhel lieblingjének, milliárdok a csókosoknak | Közpénzszivattyú az NKA-nál' },
      { id: 'vdNQGR9kzYk', label: 'ATV', title: 'NKA-botrány: Magyar Péter is megszólalt az ügyben' },
      { id: 'zAx4e6GhVQQ', label: 'ATV', title: '"Nagyon sok minden van, amiről nem tudunk" – Az NKA-botrány csak a jéghegy csúcsa?' },
      { id: 'lkFb77t0h-w', label: 'ATV', title: 'NKA-botrány: Tóth Gabi, Muri Enikő és Pataky Attila is komoly pénzeket kaphatott' },
      {
        id: 'wKZSqY6168E',
        label: 'ATV',
        title: 'Megkérdeztük Fásy Ádámtól, kapott-e 101 millió forintot Fásy Zsüliett az NKA-tól',
        featured: true,
        summary: 'Az ATV Fásy Ádámot kereste meg azzal a felvetéssel, hogy lánya, Fásy Zsüliett cége összesen 101 millió forintnyi NKA-támogatást kapott — a kifizetés így az NKA-botrány egyre bővülő érintetti listájára került.',
      },
    ],
    statusItems: [
      { icon: '🔴', label: 'Őrizetbe vétel', value: '6 személy előzetesben — köztük Bús Balázs volt óbudai polgármester (jún. 23.)' },
      { icon: '🆕', label: '7. gyanúsított', value: 'Fidesz-frakciós, kormánytisztviselőként is dolgozó munkatárs — kedd hajnalban elvitték, letartóztatását az ügyészség szerdán indítványozta, kilétét egyelőre nem hozták nyilvánosságra (júl. 22.)' },
      { icon: '⚖️', label: 'Nyomozás', value: 'NAV — hűtlen kezelés bűntett gyanúja, 17+ milliárd Ft érintett összeg' },
      { icon: '💰', label: 'Visszaszerzett vagyon', value: '~2,56 milliárd Ft — 2,16 Mrd visszautalt + ~400 M visszatartott (Tarr Zoltán)' },
      { icon: '👤', label: 'Felelős', value: 'Hankó Balázs — volt kulturális miniszter' },
    ],
    sourceRefs: [
      { label: '444: Újabb fideszes gyanúsított és letartóztatás az NKA-ügyben (júl. 22.)', url: 'https://444.hu/2026/07/22/ujabb-fideszes-gyanusitott-es-letartoztatas-az-nka-ugyben' },
      { label: 'NAV.hu: Áttörés az NKA-ügyben — 6 személy őrizetbe véve (jún. 23.)', url: 'https://nav.gov.hu/sajtoszoba/hirek/Attores_az_NKA-ugyben' },
      { label: 'Telex: 6 személyt vett őrizetbe a NAV (jún. 23.)', url: 'https://telex.hu/belfold/2026/06/23/nka-botrany-hat-szemelyt-orizetbe-vett-a-nav-hanko-balazs-tarr-zoltan' },
      { label: 'Telex: NAV nyomoz az NKA-ügyben', url: 'https://telex.hu/belfold/2026/06/16/nka-nyomozas-nav' },
      { label: 'Telex: 49 pályázó 1,69 milliárdot utalt vissza', url: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-valosliget-zrt' },
      { label: '444: Tarr Zoltán ~400 M Ft-ot vont vissza', url: 'https://444.hu/2026/06/15/tarr-zoltan-kozel-400-millio-forintnyi-nka-tamogatast-von-vissza-amit-hanko-balazs-a-valasztas-elott-osztott-ki' },
    ],
    description: `A Nemzeti Kulturális Alap (NKA) botránya az egyik legsúlyosabb közpénzügyi visszaélés, amelyet a Fidesz-korszak vége előtt tártak fel.`,
    descriptionBlocks: [
      {
        type: 'breaking-group',
        headline: '2026. július 22. — Hetedik gyanúsítottat is letartóztattak',
        lead: 'A Fidesz frakciójának egyik, kormánytisztviselőként is dolgozó munkatársát kedd hajnalban vitték el otthonából — ő a hetedik letartóztatott az NKA-ügyben. A Fidesz képviselőcsoportja számolt be az őrizetbe vételről az MTI-nek, de Havasi Bertalan nem volt hajlandó megnevezni az érintettet, és továbbra is politikailag motiváltnak, koncepciósnak nevezte az eljárásokat. A Bács-Kiskun Megyei Főügyészség megerősítette a letartóztatást a Népszavának: Bodó Marianna szóvivő szerint a gyanúsított letartóztatását különösen jelentős vagyoni hátrányt okozó hűtlen kezelés bűntettének megalapozott gyanújával az ügyészség szerdán indítványozta. A nyomozók kedden lefoglalták a Fidesz teljes kommunikációs rendszerét és adatbázisait is a párt szervereit biztosító központban.',
        articles: [
          {
            source: '444',
            headline: 'Újabb fideszes gyanúsított és letartóztatás az NKA-ügyben',
            lead: 'A Fidesz frakciójának egyik munkatársát kedd hajnalban vitték el otthonából — ő már a hetedik letartóztatott az NKA-ügyben. A Bács-Kiskun Megyei Főügyészség megerősítette, hogy a gyanúsított letartóztatását szerdán indítványozták.',
            url: 'https://444.hu/2026/07/22/ujabb-fideszes-gyanusitott-es-letartoztatas-az-nka-ugyben',
            date: '2026. július 22.',
          },
        ],
      },
      {
        type: 'breaking-group',
        headline: '2026. június 23. — Hat személyt vett őrizetbe a NAV',
        lead: 'A NAV nyomozói hat személyt vettek előzetesbe hűtlen kezelés bűntett megalapozott gyanúja miatt — köztük Bús Balázs volt fideszes óbudai polgármestert, az NKA alelnökét, aki részletes vallomást tett. Az elkövetők az NKTK és a Kulturális és Innovációs Minisztérium alkalmazottai. Letartóztatásukat az ügyészségnél kezdeményezték.',
        articles: [
          {
            source: 'NAV.hu',
            headline: 'Áttörés az NKA-ügyben — hat személyt vett őrizetbe a NAV',
            lead: 'A NAV nyomozói hűtlen kezelés bűntett megalapozott gyanúja miatt hat személyt vettek őrizetbe. Az ügy több mint 17 milliárd forintot érint. Letartóztatásukat az ügyészségnél kezdeményezték.',
            url: 'https://nav.gov.hu/sajtoszoba/hirek/Attores_az_NKA-ugyben',
            date: '2026. június 23.',
          },
          {
            source: 'Telex',
            headline: 'NKA-botrány: hat személyt vett őrizetbe a NAV — köztük Bús Balázs volt óbudai polgármester',
            lead: 'Köztük Bús Balázs volt fideszes óbudai polgármester, az NKA alelnöke, aki részletes vallomást tett.',
            url: 'https://telex.hu/belfold/2026/06/23/nka-botrany-hat-szemelyt-orizetbe-vett-a-nav-hanko-balazs-tarr-zoltan',
            date: '2026. június 23.',
          },
        ],
      },
      {
        type: 'text',
        content: 'A Nemzeti Kulturális Alap (NKA) botránya az egyik legsúlyosabb közpénzügyi visszaélés, amelyet a Fidesz-korszak vége előtt tártak fel. Hankó Balázs kulturális miniszter négy nappal a 2026-os parlamenti választások előtt — 2026. április 8-án — közel 394 millió forintnyi egyedi miniszteri keretből osztott ki támogatásokat. Tarr Zoltán, az új kormány kulturális minisztere ezeket a döntéseket visszavonta, majd elrendelte a kifizetések átvizsgálását.',
      },
      {
        type: 'text',
        content: 'A botrány nem állt meg a visszavonásnál. Az Index közérdekű adatigénylésből kiderült, hogy a korábbi NKA-döntések alapján összesen 49 pályázó — köztük Kis-Grófo énekes és a Városliget Zrt. — önként visszautalt az NKA-nak 1,69 milliárd forintot. Kis-Grófo maga 5 millió forintot utalt vissza, elismerve, hogy a pályázaton kapott összeg aránytalanul magas volt tekintettel a valódi kulturális értékre — írta a Telex. A visszautalók listáján számos, politikai kötődéssel rendelkező szervezet szerepel, amelyek korábban az NKA kuratóriumán keresztül jutottak hozzá a forrásokhoz.',
      },
      {
        type: 'article-card',
        source: 'Telex',
        headline: 'Visszafizették a 17 milliárdos NKA pályázati pénzek tizedét, Kis Grófo is visszaadott 5 millió forintot',
        lead: '49 pályázó összesen 1,69 milliárd forintot utalt vissza az NKA-nak — köztük a Városliget Zrt. és Kis-Grófo, aki elismerte, hogy a kapott összeg aránytalanul magas volt a valódi kulturális értékhez képest.',
        url: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt',
        date: '2026. május 23.',
      },
      {
        type: 'text',
        content: 'A Nemzeti Adó- és Vámhivatal (NAV) hűtlen kezelés bűntett gyanújával nyomozást indított. Az elkövetők az NKTK és a Kulturális és Innovációs Minisztérium alkalmazottai. A nyomozás nemcsak Budapesten folyik: Győrben is indult eljárás, ahol helyi kulturális szervezetek kaptak aránytalanul nagy összegeket. A NAV Molnár Áront, a közismert humoristát is tanúként hallgatta ki az NKA-val kapcsolatos ügyekben — számolt be a Telex.',
      },
      {
        type: 'article-card',
        source: 'Portfolio',
        headline: 'Dagad az NKA-botrány, már Győrben is nyomoznak',
        lead: 'A NAV Győrben is nyomozást indított: négy helyi kulturális szervezet kapott aránytalanul nagy NKA-összegeket annak ellenére, hogy érdemi tevékenységet nem folytattak. Mind a négynek közös a bejegyzési dátuma és a Fidesz-közeli kapcsolati háló.',
        url: 'https://www.portfolio.hu/gazdasag/20260616/dagad-az-nka-botrany-mar-gyorben-is-nyomoznak-843584',
        date: '2026. június 16.',
      },
      {
        type: 'text',
        content: 'Az NKA botránya az intézményi lemondások sorát is elindította. Bús Balázs, az NKA alelnöke 2026. április 28-án mondott le. Báán László, a Szépművészeti Múzeum igazgatója április 30-án követte őt, szintén kilépett az NKA bizottságából. Vidnyánszky Attila, a Nemzeti Színház igazgatója május 2-án mondott le az NKA-s pozícióból — bár a Nemzeti Színház élén egyelőre megmaradt. Mindhárom visszalépés azt jelzi, hogy az NKA korábbi döntéshozói felismerték: a fennmaradó politikai felelősségtől való távolságtartás az egyetlen reális opció.',
      },
      {
        type: 'article-card',
        source: 'Telex',
        headline: 'Tanúként hallgatta ki Molnár Áront a NAV az NKA-s ügyben',
        lead: 'A NAV tanúként hallgatta ki Molnár Áron humoristát, aki korábban nyilvánosságra hozta, hogy közel 20 milliárd forint állami támogatást osztottak szét NKA-n keresztül kormányzat-közeli szervezeteknek.',
        url: 'https://telex.hu/belfold/2026/06/03/tanukent-hallgatta-ki-molnar-aront-a-nav-az-nka-s-ugyben',
        date: '2026. június 3.',
      },
      {
        type: 'video',
        id: 'ZzNVujJun1Y',
        label: 'Molnár Áron Összeállítások',
        title: 'Ők osztottak szét 17 MILLIÁRD ADÓFIZETŐ FORINTOT',
        summary: 'Molnár Áron összeállítása azokról, akik az NKA-n keresztül 17 milliárd forint közpénzt osztottak szét — kiknek, milyen indokkal, és miért nem kellett érte felelniük.',
      },
      {
        type: 'text',
        content: 'Az ügy hátterét az NKA egy egykori kuratóriumi tagjának nyilatkozata világítja meg a legjobban. Ő nyilvánosan kijelentette: a Kulturális Alaptól „érdemtelenek kaptak érdemtelenül sok pénzt többnyire értelmezhetetlen projektekre" — 17 milliárd forint értékben — írta a Telex a visszautalásokról szóló cikkében. Ez az összeg a teljes NKA-szétosztatlan keret igen nagy hányada, és azt sugallja, hogy a visszautaló 49 pályázón kívül még jóval többen is politikai logika szerint, nem kulturális szempontok alapján jutottak forráshoz.',
      },
      {
        type: 'text',
        content: 'A NAV nyomozása jelenleg is tart. Az eljárás tétje nem csupán Hankó Balázs egyéni felelőssége, hanem az NKA teljes döntéshozatali mechanizmusa: kinek a nevében, kinek a számlájára, milyen kritériumok alapján mentek ki a közpénzek az elmúlt évtizedben. Az NKA-botrány a „legdurvább ügyek" listáján elsősorban azért szerepel, mert ez az egyetlen ügy a sorozatból, ahol a pénz — részben — visszajött.',
      },
    ],
  },

  {
    id: 'aranykonvoj',
    eyebrow: 'Aktív · Vizsgálat folyamatban',
    title: 'Aranykonvoj-ügy',
    responsible: 'Orbán Viktor',
    responsibleGaleriaId: 'orban-viktor',
    estimatedDamageLabel: 'Lehetséges bűncselekmények',
    estimatedDamage: 'Jogellenes fogva tartás · Állami kényszerítés · Ügyészségi törvénysértés · Testi sértés (injekció) · Közhatalommal visszaélés',
    responsiblePersons: ['Orbán Viktor — személyesen rendelte el az akciót', 'Sulyok Tamás — köztársasági elnök, büntetőjogi felelőssége is felmerül'],
    crimeTypes: ['Jogellenes fogva tartás', 'Állami kényszerítés (külföldi nyomásgyakorlás)', 'Ügyészségi törvénysértés (gyanú)'],
    relatedPersonIds: ['orban-viktor', 'lazar-janos', 'sulyok-tamas', 'nagy-gabor-balint'],
    articleKeywords: ['aranykonvoj'],
    moreUrl: '/ugyek/aranykonvoj',
    summary: '2026 márciusában TEK-kommandósok az M0-son megállítottak egy Ausztriából Ukrajna felé tartó szállítmányt, amely az ukrán Oschadbank 27 milliárd forint értékű aranyát és valutáját szállította. A NAV tudott a szállítmányról és engedélyezte az országba lépést. A rajtaütés időpontját Orbán Viktor kormányzata rendelte el — a cél: Ukrajna rákényszerítése a Barátság-kőolajvezeték megnyitására, és a közelgő választások előtt eszkaláció kiprovokálása Zelenszkijjel.',
    videoId: 'cLBTdDVztR0',
    videoChannel: 'Telex.hu',
    videoTitle: 'Az aranykonvoj rejtélye',
    videoSummary: 'Ez a videó az aranykonvoj-ügy első nyilvános összefoglalója: TEK-kommandósok az M0-son állítottak meg egy ukrán Oschadbank-szállítmányt, amelynek visszatartása Orbán Viktor személyes döntéséből eredt. A cél Ukrajna olajvezetékes zsarolása volt — az ukrán pénzszállítókkal pedig súlyosan törvénysértő módon bántak.',
    additionalVideos: [
      { id: 'WevENutaeuw', label: 'ATV', title: 'Politikai döntés állhat az ukrán „aranykonvoj" hirtelen visszaadásának hátterében' },
      { id: 'uXifE1zlyIE', label: 'ATV', title: 'Aranykonvoj: Terrorcselekmény-részesség is felmerülhet Sulyok Tamás esetében?' },
      { id: 'wY6l64N9yDE', label: 'Klikk TV', title: 'LÁZÁR robbantott – Az ukrán ARANYKONVOJ ügye ORBÁNHOZ vezet' },
      { id: 'B0ofUa1X0QU', label: 'DW Magyar', title: 'Aranykonvoj: Orbán szerepe és a nemzetbiztonsági kockázatok az ukrán pénzszállítók elleni akcióban' },
    ],
    statusItems: [
      { icon: '💰', label: 'Lefoglalt összeg', value: '~27 milliárd Ft értékű arany és valuta — ukrán Oschadbank tulajdona' },
      { icon: '🛑', label: 'Az akció elrendelője', value: 'Orbán Viktor — a rajtaütés időpontját a kormányzattól kapta a TEK' },
      { icon: '⚖️', label: 'Ügyészség', value: 'Fürcht Pál főügyész lemondott — NAV belső jelentés: törvénysértő eljárás' },
      { icon: '🏛️', label: 'Sulyok érintettsége', value: 'Dr. Horváth Lóránt: a köztársasági elnök vagy bűnrészes, vagy alkalmatlan' },
    ],
    sourceRefs: [
      { label: 'Telex: Orbán döntött — ő rendelte meg az akciót és annak időpontját', url: 'https://telex.hu/belfold/2026/06/03/aranykonvoj-ukrajna-nav-titkosszolgalat-orban-kormany-tek' },
      { label: '444: NAV belső jelentés — törvénysértően járt el a Legfőbb Ügyészség', url: 'https://444.hu/2026/06/14/egy-nav-os-belso-jelentes-szerint-torvenysertoen-jarhatott-el-a-legfobb-ugyeszseg-az-aranykonvoj-ugyben' },
      { label: 'Telex: Kommandósok, injekció, jogellenes fogva tartás — így bántak az ukrán pénzszállítókkal', url: 'https://telex.hu/belfold/2026/04/02/ukran-penzszallitok-ugyvedek-oscsadbank' },
      { label: '24.hu: Sulyok Tamás büntetőjogi felelőssége az aranykonvoj-ügyben', url: 'https://24.hu/belfold/2026/06/11/aranykonvoj-sulyok-tamas-felelosseg/' },
      { label: '444: Videón, ahogy a vagyon elhagyja az országot', url: 'https://444.hu/2026/05/06/videon-ahogy-27-milliard-forintnyi-arany-es-bankjegyek-elhagyjak-az-orszagot' },
      { label: '444: Visszavonták az ukrán pénzszállítók kiutasítását', url: 'https://444.hu/2026/05/18/ugyvedjuk-szerint-visszavontak-az-aranykonvoj-ugyben-erintett-ukran-penzszallitok-kiutasitasat' },
      { label: '444: A törvényről szóló utolsó parlamenti vita', url: 'https://444.hu/2026/03/10/az-ukran-penzszallitokra-szabott-torvenyrol-szolt-a-valasztasok-elotti-utolso-vita-a-parlamentben' },
    ],
    descriptionBlocks: [
      {
        type: 'text',
        heading: 'Mi történt?',
        content: '2026 márciusában TEK-kommandósok az M0-son megállítottak egy Ausztriából Ukrajna felé tartó szállítmányt — az ukrán állami Oschadbank tulajdonát képező kb. 27 milliárd forint értékű aranyat és valutát. A NAV előzetesen tudott a szállítmányról és engedélyezte az országba lépést. A leállítás nem szakmai alapon, hanem politikai parancsra történt.',
      },
      {
        type: 'text',
        heading: 'Orbán rendelte el — a Barátság-kőolajvezeték volt a tét',
        content: 'A Telex 2026. júniusi összefoglalója szerint az akció nem szakmai alapokon, hanem politikai döntésből eredt. Orbán Viktor személyesen rendelte meg a beavatkozást, és a rajtaütés időpontját is a Miniszterelnöki Kabinetiroda adta le a TEK-nek. Az osztrák hatóságok semmilyen szabálytalanságot nem találtak a szállítmányban — a pénzmosás-gyanú utólag konstruált ürügy volt. Orbán deklarált célja: Ukrajna rákényszerítése a Barátság-kőolajvezeték újranyitására. A feltételezés az volt, hogy ha a lefoglalás elég feszültséget kelt, Zelenszkij mond valamit, amit fel lehet használni a közelgő választási kampányban.',
      },
      {
        type: 'article-card',
        source: 'Telex',
        headline: 'Orbán döntött arról, hogy le kell csapni az ukrán aranykonvojra — még a rajtaütés időpontja is a kormányzattól jött',
        lead: 'A Telex részletes rekonstrukciója szerint az aranykonvoj megállítása Orbán Viktor személyes döntése volt. A Miniszterelnöki Kabinetiroda adta le az utasítást a TEK-nek, az osztrákok nem találtak szabálytalanságot — a pénzmosás-eljárás politikai ürügy volt.',
        url: 'https://telex.hu/belfold/2026/06/03/aranykonvoj-ukrajna-nav-titkosszolgalat-orban-kormany-tek',
        date: '2026. június 3.',
      },
      {
        type: 'text',
        heading: 'Hogyan bántak az ukrán pénzszállítókkal',
        content: '2026. március 5-én TEK-kommandósok az M0-s autóúton állították meg az ukrán szállítókat és foglalták le a szállítmányt. Az egyik szállítmányozó, Hennagyij Kuznyecov — aki cukorbeteg — ismeretlen injekciót kapott a fogva tartás alatt, amelytől életveszélyes állapotba került. Két független orvosi vizsgálat igazolta, hogy idegen anyagot juttattak a szervezetébe. Az ügyvédek szerint az akció teljes káosz volt, a fogva tartás jogellenesen zajlott.',
      },
      {
        type: 'article-card',
        source: 'Telex',
        headline: 'Kommandósok, ismeretlen injekció, jogellenes fogva tartás — így bántak az ukrán pénzszállítókkal',
        lead: 'A TEK kommandósai az M0-son állítottak meg egy ukrán Oschadbank-szállítmányt. Az egyik szállítmányozó ismeretlen injekciót kapott fogva tartása alatt, amelytől életveszélyes állapotba került — két orvosi vizsgálat igazolta az idegen anyag bejuttatását.',
        url: 'https://telex.hu/belfold/2026/04/02/ukran-penzszallitok-ugyvedek-oscsadbank',
        date: '2026. április 2.',
      },
      {
        type: 'text',
        heading: 'NAV belső jelentés: törvénysértő volt az ügyészségi eljárás',
        content: 'Egy NAV belső jelentés szerint a Legfőbb Ügyészség törvénysértően járt el az aranykonvoj-ügyben: a pénzmosás-nyomozás elrendelése szakmailag hibás volt, az eljárás több ponton szabálytalan. Az Alkotmányvédelmi Hivatal szintén megerősítette, hogy a döntés kormányzati szintről érkezett. Fürcht Pál főügyész 2026. június 8-án lemondott — szakmai nézetkülönbségekre hivatkozva. Miután a Fidesz elveszítette a választásokat, a NAV visszaadta a vagyont az ukránoknak.',
      },
      {
        type: 'article-card',
        source: '444',
        headline: 'NAV belső jelentés: törvénysértően járt el a Legfőbb Ügyészség az aranykonvoj-ügyben',
        lead: 'Egy belső NAV-jelentés szerint az aranykonvoj-ügyben a pénzmosás-eljárás szakmailag hibás és jogszerűtlen volt. A főügyész lemondott. Az Alkotmányvédelmi Hivatal megerősítette: a döntés kormányzati parancsból eredt.',
        url: 'https://444.hu/2026/06/14/egy-nav-os-belso-jelentes-szerint-torvenysertoen-jarhatott-el-a-legfobb-ugyeszseg-az-aranykonvoj-ugyben',
        date: '2026. június 14.',
      },
      {
        type: 'text',
        heading: 'Sulyok Tamás szerepe: bűnrészes vagy alkalmatlan',
        content: 'Dr. Horváth Lóránt, az ukrán pénzszállítókat és az Oschadbankot képviselő ügyvéd nyilvánosan feltette a kérdést: mi Sulyok Tamás köztársasági elnök felelőssége? Az ügyben ugyanis törvényt fogadtak el (2026. évi II. törvény), amelyet az elnök kihirdetett. Ez a törvény egy állami kényszerítő intézkedést nyíltan külpolitikai nyomásgyakorlás eszközeként rögzített — összekapcsolva a Barátság-kőolajvezeték megnyitásának követelésével. Az ügyvéd szerint ha az elnök felismerte a célzatot, akkor bűnrészes volt; ha nem, akkor alkalmatlan.',
      },
      {
        type: 'quote',
        text: '„Az egésszel a legnagyobb probléma az, hogyha a köztársasági elnök felismerte a célzatot, akkor bűnrészes, ha nem akkor pedig alkalmatlan."',
        author: 'Dr. Horváth Lóránt',
        note: '— az ukrán pénzszállítókat és az Oschadbankot képviselő ügyvéd',
      },
      {
        type: 'article-card',
        source: '24.hu',
        headline: 'Sulyok Tamás büntetőjogi felelőssége is felmerül az aranykonvoj-ügyben',
        lead: 'Dr. Horváth Lóránt ügyvéd szerint Sulyok Tamás köztársasági elnök felelőssége az aranykonvoj ügyében jogi szempontból rendkívül aggályos: a 2026. évi II. törvény kihirdetésével egy állami kényszerítő intézkedést nyíltan külpolitikai eszközként legitimált.',
        url: 'https://24.hu/belfold/2026/06/11/aranykonvoj-sulyok-tamas-felelosseg/',
        date: '2026. június 11.',
      },
      {
        type: 'text',
        heading: 'Lázár János beismerős vallomása',
        content: 'Lázár János nyilvánosan szólalt meg az ügyről — és amit mondott, az gyakorlatilag beismerés. Kijelentette: „Nem véletlenül csináltuk, amit csináltunk" — majd összekapcsolta a pénzvisszatartást a Barátság kőolajvezeték megnyitásával, és azt is hozzátette: várják a további ukrán szállítmányokat. Nem állami kényszerintézkedést tagadott, hanem büszkén vállalta azt — miközben a törvény alapján a lefoglalás célja formálisan pénzmosás-nyomozás lett volna.',
      },
      {
        type: 'quote',
        text: '„Nem véletlenül csináltuk, amit csináltunk, a pénzt vissza nem adjuk."',
        author: 'Lázár János',
        note: '— majd hozzátette: várják, mikor nyílik meg a Barátság kőolajvezeték, és várják a további ukrán szállítmányokat',
      },
      {
        type: 'video',
        id: 'PIvMQz_zSxY',
        label: 'Lázár János',
        title: '„Nem véletlenül csináltuk, amit csináltunk" — Lázár az aranykonvojról',
        summary: 'Lázár János nyilvánosan vállalja az aranykonvoj mögötti szándékot: nem véletlenszerű volt az akció, a pénzt visszatartani akarták, és összekapcsolja ezt a Barátság kőolajvezeték megnyitásának követelésével. Várják a további ukrán szállítmányokat.',
      },
      {
        type: 'article-card',
        source: '444',
        headline: 'Az ukrán pénzszállítókra szabott törvényről szólt a választások előtti utolsó vita a parlamentben',
        lead: 'A parlament 119:25 arányban fogadta el a 2026. évi II. törvényt, amely 60 napot biztosított a NAV-nak titkos adatgyűjtésre az aranykonvoj-ügyben. Több kormánytag — köztük Orbán Viktor — nem szavazott. Az ukrán külügyminiszter törvénytelenségnek nevezte az egész eljárást.',
        url: 'https://444.hu/2026/03/10/az-ukran-penzszallitokra-szabott-torvenyrol-szolt-a-valasztasok-elotti-utolso-vita-a-parlamentben',
        date: '2026. március 10.',
      },
      {
        type: 'text',
        heading: 'Az ügy vége: visszaadták a pénzt, visszavonták a kiutasítást',
        content: 'A Fidesz választási veresége után az eljárás gyorsan összeomlott. 2026. május 6-án a lefoglalt vagyon — 35 millió euró, 40 millió dollár és 9 kg arany — elhagyta Magyarország területét; Zelenszkij ukrán elnök Facebook-posztban közölte elsőként a hírt. A pénz visszaadása a nyomozóhatóság saját belátásából történt, annak ellenére, hogy a törvény erre nem adott kifejezett felhatalmazást. 2026. május 18-án az Országos Idegenrendészeti Főigazgatóság visszavonta a hét ukrán pénzszállító kiutasítását és háromévnyi beutazási tilalmát — a szállítók csaknem 30 órát töltöttek korábban bilincsben. A közigazgatási perek a Fővárosi Törvényszéken még folyamatban vannak.',
      },
      {
        type: 'article-card',
        source: '444',
        headline: 'Videón, ahogy 27 milliárd forintnyi arany és bankjegyek elhagyják az országot',
        lead: 'A Fidesz választási veresége után visszaadták az ukrán Oschadbank lefoglalt vagyonát. Zelenszkij Facebook-posztban közölte elsőként a hírt. A szállítmány 35 millió eurót, 40 millió dollárt és 9 kg aranyat tartalmazott.',
        url: 'https://444.hu/2026/05/06/videon-ahogy-27-milliard-forintnyi-arany-es-bankjegyek-elhagyjak-az-orszagot',
        date: '2026. május 6.',
      },
      {
        type: 'article-card',
        source: '444',
        headline: 'Visszavonták az aranykonvoj-ügyben érintett ukrán pénzszállítók kiutasítását',
        lead: 'Az Országos Idegenrendészeti Főigazgatóság visszavonta a hét ukrán pénzszállító kiutasítását és háromévnyi beutazási tilalmát. A szállítók csaknem 30 órát töltöttek bilincsben — a közigazgatási perek még folyamatban vannak.',
        url: 'https://444.hu/2026/05/18/ugyvedjuk-szerint-visszavontak-az-aranykonvoj-ugyben-erintett-ukran-penzszallitok-kiutasitasat',
        date: '2026. május 18.',
      },
    ],
    description: `Az aranykonvoj-ügy 2026 tavaszán robbant a köztudatba. TEK-kommandósok az M0-s autóúton megállítottak egy Ausztriából Ukrajna felé tartó szállítmányt, amely az ukrán állami Oschadbank kb. 27 milliárd forint értékű aranyát és valutáját szállította. A NAV tudott a szállítmányról, és engedélyezte az országba lépést. A rajtaütés politikai parancsra érkezett: Orbán Viktor személyesen rendelte el, a Miniszterelnöki Kabinetiroda adta le az időpontot a TEK-nek. Az osztrák hatóságok semmilyen szabálytalanságot nem találtak a szállítmányban — a pénzmosás-gyanú ürügy volt. A cél Ukrajna zsarolása a Barátság-kőolajvezeték megnyitásáért. Miután a Fidesz elveszítette a választásokat, a NAV visszaadta az ukránoknak a vagyont.`,
  },

  {
    id: 'parkfenntartas',
    eyebrow: 'Aktív · 7 személy előzetesben',
    title: 'Parkfenntartási kenőpénzbotrány',
    responsible: 'Több felelős',
    estimatedDamage: '2+ milliárd Ft kenőpénz',
    estimatedDamageLabel: 'Becsült kenőpénz összesen',
    responsiblePersons: [
      'Őrsi Gergely — II. ker. polgármester (DK)',
      'Láng Zsolt — II. ker. volt polgármester (Fidesz)',
      'Puskás Péter — óbudai Fidesz-elnök',
      'Szkaliczki Tünde — Momentum, volt képviselő',
      'Matisz Károly — Momentum pártigazgató',
      'Molnár Zsolt — MSZP, volt OGY képviselő',
      'Z. Zsolt és „Pék" — vállalkozók',
    ],
    crimeTypes: ['Befolyással üzérkedés', 'Vesztegetés', 'Kenőpénz'],
    articleKeywords: ['parkfenntartás', 'Őrsi Gergely', 'parkfenntartá'],
    moreUrl: '/ugyek/parkfenntartas',
    videoId: '7A-NUGjuKGg',
    videoChannel: 'ATV Magyarország',
    videoTitle: 'Robbant az óbudai korrupciós ügy – Magyar Péter is megszólalt',
    videoSummary: '2026 júniusában nyolc embert — köztük hat politikust — tartóztattak le a budapesti parkfenntartási kenőpénzbotrányban. A videó az ügy kirobbanását és Magyar Péter reakcióját dolgozza fel.',
    additionalVideos: [
      { id: 'iditf3NLfos', label: 'Kapcsolódó riport', title: 'Újabb részletek derültek ki a budapesti korrupciós parkfenntartási ügyben' },
      { id: '94cOBsarL00', label: 'Kapcsolódó riport', title: 'Először igazolta az ügyészség a legendás 70-30-as korrupciós leosztást' },
      { id: 'HDzrxp3GAkE', label: 'Kapcsolódó riport', title: 'Parkfenntartási botrány Budapesten, de ennek az ügynek semmi köze a fűnyíráshoz' },
    ],
    summary: '8 személyt tartóztattak le 2026. június 4-én — köztük Őrsi Gergely (DK) II. kerületi polgármestert, Láng Zsolt (Fidesz) volt polgármestert és négy más politikust. Puskás Péter letartóztatását 2026. július 1-jén megszüntette az ügyészség. A maradék 7 gyanúsított letartóztatását +3 hónappal hosszabbította meg. Z. Zsolt parkfenntartó vállalkozó cégei 2011–2024 között közel 2 milliárd forint kenőpénzt fizethettek budapesti politikusoknak milliárdos közpénzes szerződésekért cserébe — minden nagy párt érintett.',
    description: `A parkfenntartási kenőpénzbotrány egyedülálló a magyar korrupciós ügyekben: egy átpárti, szisztematikus kenőpénz-rendszert tárt fel a budapesti önkormányzati közpénzek körül — amelybe Fidesz, DK, Momentum és MSZP politikusok egyaránt belekeveredtek.

Z. Zsolt parkfenntartó vállalkozó és cégei — köztük a Pannon Park Forest Kft. — 2011 és 2024 között milliárdos közpénzes szerződéseket nyertek Budapest több kerületében és vidéki önkormányzatoknál is. A „Pék" nevű közvetítőn keresztül áramló kenőpénz politikusokat ért el a II., III., VIII., XIII. és XIV. kerületben egyaránt.

A Fővárosi Törvényszék 2026. június 4-én 30 napra letartóztatott hat politikust és két vállalkozót. A gyanú: befolyással üzérkedés és vesztegetés. Az érintett összeg: közel 2 milliárd forint kenőpénz — és 35+ milliárd forintos szerződésállomány a XIII. kerületben egyedül.

Kerényi György, a Klub Rádió újságírója 2020-ban már részletesen megírta a botrány főbb vonásait — sem az ügyészség, sem a rendőrség nem reagált. A tényleges nyomozás 6 évvel később, 2026-ban indult el.`,
    statusItems: [
      { icon: '🔴', label: 'Letartóztatva', value: '8 személy — 6 politikus (Fidesz, DK, Momentum, MSZP) + 2 vállalkozó · 2026. jún. 4. · Puskás Péter kiengedve 2026. júl. 1.' },
      { icon: '⚖️', label: 'Gyanú', value: 'Befolyással üzérkedés · Vesztegetés — Fővárosi Törvényszék, 30 nap előzetes' },
      { icon: '💰', label: 'Kenőpénz', value: '2+ milliárd Ft kenőpénz · 35+ milliárd Ft szerződésállomány' },
      { icon: '🏙️', label: 'Érintett területek', value: 'II., III., VIII., XIII., XIV. kerület + vidéki önkormányzatok · 2011–2024' },
    ],
    sourceRefs: [
      { label: 'Telex: Letartóztatások — Őrsi Gergely és más politikusok (2026. jún. 4.)', url: 'https://telex.hu/belfold/2026/06/04/orsi-gergely-reakcio-letartoztatas' },
      { label: 'Telex: Pék és Karácsony Gergely neve a parkfenntartási ügyben (2026. jún. 22.)', url: 'https://telex.hu/belfold/2026/06/22/pek-korrupcio-karacsony-gergely-neveben-parkfenntartas' },
      { label: 'G7 / Telex: Milliárdos szerződések az óbudai parkfenntartási botrányban (2026. jún. 22.)', url: 'https://telex.hu/g7/vallalat/2026/06/22/parkfenntartas-obudai-korrupcios-ugy-szerzodes' },
      { label: 'Népszava: Bús Balázs és az óbudai parkfenntartási korrupció', url: 'https://nepszava.hu/3326824_bus-balazs-obuda-parkfenntartasi-korrupcio' },
      { label: 'HVG: Bűnismétlés — gyanúsítotti letartóztatás a parkfenntartási ügyben (2026. jún. 5.)', url: 'https://hvg.hu/itthon/20260605_bunismetles-parkfenntartasi-kenopenzbotrany-gyanusitott-letartoztatas' },
      { label: 'Klub Rádió: Kerényi György hanganyaga a parkfenntartási korrupcióról (2020)', url: 'https://www.klubradio.hu/adas?hanganyag_id=58202' },
    ],
    descriptionBlocks: [
      {
        type: 'text',
        heading: 'Az ügy háttere',
        content: 'Z. Zsolt parkfenntartó vállalkozó cégei — köztük a Pannon Park Forest Kft. és a Parkfenntartó Kft. — 2011–2024 között milliárdos közpénzes szerződéseket nyertek Budapest több kerületében túlárazott közbeszerzések révén. A vállalkozó vallomása szerint összesen közel 2 milliárd forint kenőpénzt fizetett helyi politikusoknak — köztük fideszes, momentumos, szocialista és ellenzéki önkormányzati képviselőknek egyaránt.',
      },
      {
        type: 'text',
        heading: 'A kenőpénz mechanizmusa',
        content: '„Pék" nevű közvetítőn keresztül a kenőpénz Budapest különböző kerületeinek politikusai felé áramlott — a II., III., VIII., XIII., XIV. kerületben és vidéki önkormányzatoknál is. A XIII. kerületben a Pannon Park cégek összesen 35+ milliárd forintnyi parkfenntartási szerződést nyertek el. Pék a kihallgatáson azt állította, hogy Karácsony Gergely nevében is gyűjtött pénzt — ezt Karácsony cáfolja.',
      },
      {
        type: 'article-card',
        source: 'Telex',
        headline: 'Pék és Karácsony Gergely neve a parkfenntartási ügyben',
        lead: 'A „Pék" nevű közvetítő azt állítja, hogy Karácsony Gergely nevében is gyűjtött kenőpénzt a parkfenntartási szerződésekért cserébe — Karácsony cáfolja az állítást.',
        url: 'https://telex.hu/belfold/2026/06/22/pek-korrupcio-karacsony-gergely-neveben-parkfenntartas',
        date: '2026. június 22.',
      },
      {
        type: 'article-card',
        source: 'G7 / Telex',
        headline: 'Milliárdos szerződések az óbudai parkfenntartási botrányban',
        lead: 'A Pannon Park cégcsoport az óbudai (III. ker.) és más kerületi parkfenntartási szerződéseken milliárdos közpénzeket vett fel — a G7 feltárta a szerződések részleteit és az érintett összegeket.',
        url: 'https://telex.hu/g7/vallalat/2026/06/22/parkfenntartas-obudai-korrupcios-ugy-szerzodes',
        date: '2026. június 22.',
      },
      {
        type: 'article-card',
        source: 'Népszava',
        headline: 'Bús Balázs és az óbudai parkfenntartási korrupció',
        lead: 'A Népszava cikke az óbudai (III. kerületi) szálat vizsgálja — Bús Balázs neve a parkfenntartási szerződések körüli korrupciós gyanúval is összefüggésbe kerül.',
        url: 'https://nepszava.hu/3326824_bus-balazs-obuda-parkfenntartasi-korrupcio',
      },
      {
        type: 'text',
        heading: '6 éves lappangás — 2020-ban már megírták',
        content: 'Kerényi György, a Klub Rádió újságírója 2020-ban már részletesen megírta a parkfenntartási korrupció főbb vonásait. Riportja hanganyagban is elérhető. Sem az ügyészség, sem a rendőrség nem reagált akkoriban. Az ügyben az érdemi nyomozás csak 6 évvel később, 2026-ban indult el.',
      },
      {
        type: 'audio-link',
        source: 'Klub Rádió',
        title: 'Kerényi György riportja a parkfenntartási korrupcióról — 2020',
        url: 'https://www.klubradio.hu/adas?hanganyag_id=58202',
      },
      {
        type: 'breaking-group',
        headline: '2026. június 4. — 8 személyt tartóztatott le a Fővárosi Törvényszék',
        lead: 'A Fővárosi Törvényszék 2026. június 4-én 30 napra előzetesbe helyezte a parkfenntartási kenőpénzbotrány nyolc gyanúsítottját — hat politikust és két vállalkozót. A gyanú: befolyással üzérkedés és vesztegetés.',
        articles: [
          {
            source: 'Telex',
            headline: 'Őrsi Gergely és a letartóztatottak — az ügy keretei',
            lead: 'Hat politikus: Őrsi Gergely (DK), Láng Zsolt (Fidesz), Puskás Péter (Fidesz), Szkaliczki Tünde (Momentum), Matisz Károly (Momentum) és Molnár Zsolt (MSZP) is előzetesbe kerültek.',
            url: 'https://telex.hu/belfold/2026/06/04/orsi-gergely-reakcio-letartoztatas',
            date: '2026. június 4.',
          },
          {
            source: 'HVG',
            headline: 'Bűnismétlés — gyanúsítotti letartóztatás a parkfenntartási kenőpénzbotrányban',
            url: 'https://hvg.hu/itthon/20260605_bunismetles-parkfenntartasi-kenopenzbotrany-gyanusitott-letartoztatas',
            date: '2026. június 5.',
          },
        ],
      },
      {
        type: 'article-card',
        source: 'Telex',
        headline: 'Megszüntették Puskás Péter letartóztatását — a többi 7 gyanúsított marad előzetesben',
        lead: 'Az ügyészség Puskás Péter esetében megszüntette a kényszerintézkedést, mert különös okai időközben megszűntek. Őrsi Gergely, Láng Zsolt, Molnár Zsolt, Szkaliczki Tünde, Matisz Károly és a két vállalkozó letartóztatását +3 hónappal hosszabbítja meg.',
        url: 'https://telex.hu/belfold/2026/07/01/obudai-korrupcios-ugy-vadlott-letartoztatas-megszuntetese-fidesz',
        date: '2026. július 1.',
      },
      {
        type: 'quote',
        text: 'A jelenlegi helyzetben a legfontosabb, hogy elmondjam Önöknek, a II. kerületi Önkormányzat működik, minden feladatot zökkenőmentesen ellát. Szeretném nyilvánvalóvá tenni: minden körülmények között tartom magam eskümhöz és ahhoz a vállaláshoz, hogy számomra a II. kerület boldogulása, fejlődése a legfontosabb. Biztosan tudom, hogy esküm és lelkiismeretem szerint mindig a törvényeknek megfelelően jártam el — ahogy a Hivatal is. Felháborít és egyben elszomorít, hogy sarokba szorított ember/emberek szavára alapozva történhet letartóztatás, de ez nem változtat azon, hogy az igazság ki fog derülni. A velem szemben közölt gyanúsítás azonban teljes egészében megalapozatlan, az ténybeli és jogi alapokon sem állja meg a helyét.',
        author: 'Őrsi Gergely, II. kerületi polgármester',
        note: 'Letartóztatása napján, 2026. június 4-én kiadott nyilatkozat',
        url: 'https://www.facebook.com/orsigergely2kerulet/posts/pfbid06rznwFFRyRHxfvvuvCQfCFfQfyKjFThWKqk5qFwGuCA43oyojgVkdQ3PZAxwa8oil',
      },
    ],
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
    pinnedNews: [
      {
        source: 'K-Monitor (k.blog.hu)',
        headline: 'Szijjártó dönthetett a koronabeszerzések mentesítéséről',
        lead: 'Szijjártó Péter felhatalmazást kapott a koronavírus-járvánnyal összefüggő beszerzések közbeszerzési szabályok alóli felmentésére — köztük egészségügyi eszközök beszállítóival kötött szerződésekre is.',
        date: '2020. augusztus 8.',
        url: 'https://k.blog.hu/2020/08/08/szijjarto_mentesites',
      },
      {
        source: 'Direkt36',
        headline: 'A kormány dicsekedett a lélegeztetőgépek vásárlásával, mégis ők kötötték a legrosszabb üzletet Kínával az egész EU-ból',
        lead: 'Uniós kereskedelmi statisztikák elemzése alapján Magyarország a kínai lélegeztetőgép-beszerzések során az EU-ban a legrosszabb, kilogrammonként legdrágább árat fizette — más tagállamok jóval alacsonyabb áron jutottak azonos eszközökhöz.',
        date: '2020. augusztus 27.',
        url: 'https://www.direkt36.hu/a-kormany-dicsekedett-a-lelegeztetogepek-vasarlasaval-megis-ok-kotottek-a-legrosszabb-uzletet-kinaval-az-egesz-eu-bol/',
      },
      {
        source: 'HVG',
        headline: 'Annál is több lélegeztetőgépre szerződött a külügy, mint amennyiről tudni lehetett',
        lead: 'Közérdekű adatigénylés nyomán kiderült: a Külgazdasági és Külügyminisztérium összesen 17 402 lélegeztetőgépre kötött szerződést — jóval többre, mint amennyit korábban egy uniós parlamenti képviselőnek jelentettek.',
        date: '2020. november 17.',
        url: 'https://hvg.hu/gazdasag/20201117_lelegeztetogep_szerzodes_kkm',
      },
      {
        source: '444',
        headline: 'Kezd kirajzolódni, hogyan rendelte jelentősen túl magát lélegeztetőgépekből Magyarország',
        lead: 'A minisztérium a járvány tavaszi csúcsa után is folytatta a lélegeztetőgépek tömeges megrendelését, jóval a tényleges kórházi kapacitásigény fölött — több tízmilliárd forint értékben.',
        date: '2020. augusztus 26.',
        url: 'https://444.hu/2020/08/26/kezd-kirajzolodni-hogyan-rendelte-jelentosen-tul-magat-lelegeztetogepekbol-magyarorszag',
      },
      {
        source: 'K-Monitor adatbázis',
        headline: 'Fourcardinal Tanácsadó Kft. — kapcsolódó ügyek',
        lead: 'A Fourcardinal Tanácsadó Kft. a kormányzati lélegeztetőgép-üzlet egyik legnagyobb nyertese volt, mintegy 17 milliárd forintos beszerzést bonyolítva, majd jogutód nélkül megszűnt.',
        url: 'https://adatbazis.k-monitor.hu/adatbazis/cimkek/fourcardinal-tanacsado-kft',
      },
    ],
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
    sourceRefs: [
      { label: 'HVG: Tavaly is rengeteg pénz áradt a lélegeztetőgép-biznisz sikercége felé', url: 'https://hvg.hu/kkv/20220509_Tavaly_is_rengeteg_penz_aramlott_a_lelegeztetogepbiznisz_sikercege_fele_a_tulajdonos_vaskos_sikerdijjal_bucsuztatja_a_vallalkozast' },
      { label: 'HVG: 13 ezerért se kelltek a külügy 10 milliós lélegeztetőgépei — eredménytelen árverés', url: 'https://hvg.hu/kkv/20240227_lelegeztetogep_kulugyminiszterium_tmt_technics_eredmenytelen_arveres' },
      { label: 'Transparency International: Lélegeztetőgépek — kudarcba fulladt továbbértékesítés (2023)', url: 'https://transparency.hu/hirek/lelegeztetogep_kudarcos_tovabbertekesites/' },
      { label: 'HVG: Lélegeztetőgépek beüzemelése, túlvásárlás, NER-biznisz (2021)', url: 'https://hvg.hu/360/202130__lelegeztetogepek_beuzemelese__tulvasarlas__nerbiznisz__felpumpaltak' },
      { label: 'HVG: A lélegeztetőgép-bizniszben érdekelt vállalat anyacégét is felszámolják', url: 'https://hvg.hu/kkv/20221221_A_lelegeztetogepbizniszben_erdekelt_vallalat_anyaceget_is_felszamoljak' },
      { label: 'HVG: Iratmegsemmisítés — Külügyminisztérium lélegeztetőgép-biznisz', url: 'https://hvg.hu/itthon/20230522_lelegeztetogep_biznisz_Kulugyminiszterium_Transparency_iratmegsemmisites' },
    ],
    descriptionBlocks: [
      {
        type: 'text',
        content: 'A lélegeztetőgép-botrány a magyar korrupcióipar egyik legszemtelenebb esete: a COVID-19 járvány első hullámában a magyar állam 300 milliárd forintot fizetett 17 ezer kínai lélegeztetőgépért — miközben az EU-s piaci átlagár töredéke lett volna az indokolt vételár.',
      },
      {
        type: 'text',
        content: 'A számok magukért beszélnek. Magyarország 2020-ban egységenként 17–20 millió forintot fizetett olyan lélegeztetőgépekért, amelyeket az EU többi tagállama 3–4 millió forintos áron szerzett be. A teljes ügylet értéke így kb. 300 milliárd forint volt — ez az EU-s legdrágább lélegeztetőgép-vásárlás. Sem a kormány, sem egyetlen közbeszerzési szabályzat nem indokolta, miért kellett ennyit fizetni.',
      },
      {
        type: 'text',
        content: 'A vásárlás nyertesei egyértelműen azonosíthatók. A Fourcardinal Kft. — amely a szerződések egyik fő haszonélvezője volt — tulajdonosi körében megtalálható Orbán Viktor egy közeli tanácsadójának fivére, valamint Takács Péter belügyminiszter-helyettes sógorának neve. A Fourcardinalból 8 milliárd forint értékű osztalékot vett fel Takács Péter sógora rövid idő alatt — egy olyan cégen keresztül, amely korábban nem folytatott orvostechnikai eszköz-kereskedelmet.',
      },
      {
        type: 'article-card',
        source: 'HVG',
        headline: 'Tavaly is rengeteg pénz áradt a lélegeztetőgép-biznisz sikercége felé — a tulajdonos vaskos sikerdíjjal búcsúztatja a vállalkozást',
        lead: '2022-ben is százmilliók áramlottak a lélegeztetőgép-üzlet nyertes szereplői felé — miközben maga a cég felszámolás előtt állt. A tulajdonos busás sikerdíjat emelt ki, mielőtt a vállalkozás bezárt.',
        url: 'https://hvg.hu/kkv/20220509_Tavaly_is_rengeteg_penz_aramlott_a_lelegeztetogepbiznisz_sikercege_fele_a_tulajdonos_vaskos_sikerdijjal_bucsuztatja_a_vallalkozast',
        date: '2022. május 9.',
      },
      {
        type: 'text',
        content: 'Az elszámoltatás teljes mértékben elmaradt. A Kormányzati Ellenőrzési Hivatal (KEHI) és a NAV egyaránt vizsgálatot folytatott, de mindkét testület arra a következtetésre jutott, hogy szabálytalanságot nem talált. A vizsgálatok rövidek és felszínesek voltak; a tényleges haszonélvezők kilétét egyik hatóság sem tárta fel nyilvánosan. Semmilyen büntetőeljárás nem indult.',
      },
      {
        type: 'text',
        heading: 'A Külügyminisztérium 10 milliós gépeit 13 ezerért se vette meg senki',
        content: 'A lélegeztetőgép-vásárlás nem állt meg a Fourcardinal-ügynél. A Külügyminisztérium is vásárolt gépeket — egységenként körülbelül 10 millió forintért. Amikor ezeket a gépeket 2024-ben értékesíteni próbálták, árverést hirdettek. Az árverés eredménytelen lett: a gépekre 13 ezer forintos kikiáltási árral sem érkezett ajánlat. Az adófizetők 10 millió forintot fizettek darabonként olyan eszközökért, amelyekre a piacon nem akadt vevő 13 ezerért sem.',
      },
      {
        type: 'article-card',
        source: 'HVG',
        headline: '13 ezerért se kelltek senkinek a Külügyminisztérium által 10 millióért vásárolt lélegeztetőgépek — eredménytelen árverés',
        lead: 'A TMT Technics Kft.-n keresztül a Külügyminisztérium által vásárolt lélegeztetőgépek értékesítésére kiírt árverés 2024 elején eredménytelenül zárult: a gépeket 13 ezer forintos kikiáltási áron sem vette meg senki.',
        url: 'https://hvg.hu/kkv/20240227_lelegeztetogep_kulugyminiszterium_tmt_technics_eredmenytelen_arveres',
        date: '2024. február 27.',
      },
      {
        type: 'text',
        heading: 'Raktárban porosodnak — és még mindig adófizetői pénzbe kerülnek',
        content: 'A lélegeztetőgépek egy részét soha nem vetették be klinikai használatban: rosszul szellőztetett raktárakban tárolták őket, az egészségügyi intézmények pedig visszautasították a gépek egy részét alkalmatlanság miatt. A gépek jelenleg is raktárban porosodnak — és tárolásuk, kezelésük, árverezési kísérletük mind-mind tovább terheli az adófizetőket. Hogy pontosan mekkora összegbe kerül ez évente, azt a közérdekű adatigénylések nélkül soha nem lehetett volna megtudni: a Transparency International pereskedni kényszerült, hogy az állam eláruljon alapvető tényeket a gépek további sorsáról.',
      },
      {
        type: 'article-card',
        source: 'Transparency International Magyarország',
        headline: 'Lélegeztetőgépek: kudarcba fulladt továbbértékesítés — perrel kellett kicsikarni az adatokat',
        lead: '2023 augusztusában a Transparency International feltárta: a lélegeztetőgép-ügy a vásárlással nem zárult le. A gépek egy része raktárban maradt, és a továbbértékesítési kísérlet csúfos kudarcba fulladt. Az alapvető adatok nyilvánosságra hozatalához pereskedni kellett.',
        url: 'https://transparency.hu/hirek/lelegeztetogep_kudarcos_tovabbertekesites/',
        date: '2023. augusztus 29.',
      },
      {
        type: 'text',
        content: 'Ez az ügy nemcsak a közvetlen anyagi kár miatt kerül a legdurvább ügyek közé, hanem azért is, mert a teljes intézményi elszámoltatási rendszer — KEHI, NAV, ügyészség — koordináltan mondott csődöt. A 2026-os kormányváltás után a nyomozóhatóságok elvben újra megvizsgálhatják az ügyet, de ez egyelőre nem történt meg.',
      },
    ],
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
    relatedPersonIds: ['orban-viktor', 'meszaros-lorinc'],
    articleKeywords: ['hatvanpuszta'],
    pinnedNews: [
      {
        source: '24.hu',
        headline: 'Ennyibe kerülhet Hatvanpuszta fenntartása évente – brutális lehet a számla',
        lead: 'A birtok éves fenntartása — a parkgondozástól a biztonsági szolgálaton át az energiaköltségekig — akár egymilliárd forintot is meghaladhat, a számlát Mészáros Lőrinc cégei állhatják.',
        date: '2026. május 28.',
        url: 'https://24.hu/belfold/2026/05/28/hatvanpuszta-kastely-orban-csalad-fenntartas/',
      },
      {
        source: 'Telex',
        headline: 'Légifotókon mutatjuk meg, mivé változott 16 év alatt Orbánék felcsúti és hatvanpusztai birodalma',
        lead: 'Légi felvételeken mutatjuk be, hogyan alakult át 16 kormányzati év alatt Orbán Viktor felcsúti és hatvanpusztai környezete, a birtokoktól a vadaskerten és golfklubon át a stadionig.',
        date: '2026. május 26.',
        url: 'https://telex.hu/foto/2026/05/26/hatvanpuszta-felcsut-orban-viktor-meszaros-lorinc-tiborcz-istvan-1',
      },
      {
        source: 'Telex',
        headline: 'Dolgoztam Anikó nénivel, virágokat ültettünk – hatvanpusztai munkájáról mesélt egy férfi',
        lead: 'Egy férfi elmondta, hogy közel két évig dolgozott a hatvanpusztai birtok kertészeti munkálatain, és rendszeresen találkozott Lévai Anikóval, aki szerinte úgy viszonyult a birtokhoz, mintha a sajátja lenne.',
        date: '2026. május 12.',
        url: 'https://telex.hu/belfold/2026/05/12/hatvanpuszta-parkrendezes-dolgozo-levai-aniko-munka',
      },
      {
        source: 'Népszava',
        headline: 'Hadházy Ákos szerint beteges, hogy a hatvanpusztai könyvtár kandallójára Szent Mihály szobrát tették',
        lead: 'Hadházy Ákos újabb fotókat tett közzé a hatvanpusztai könyvtárról, amelyeken egy Szent Mihály arkangyalt ábrázoló szobor látható a kandallón — egy későbbi fotón a szobor már nem szerepel.',
        date: '2026. április 2.',
        url: 'https://nepszava.hu/3317507_hadhazy-akos-hatvanpuszta-konyvtar',
      },
      {
        source: 'HVG',
        headline: 'Hatvanpuszta: könyvespolcba épített titkos lépcső, saját lakás a komornyiknak — megszereztük az eredeti tervek teljes listáját',
        lead: 'A HVG360 megszerezte a hatvanpusztai birtok eredeti építési terveinek teljes listáját, amely szerint a komplexum akár 534 fő egyidejű elhelyezésére is alkalmas lehetne.',
        date: '2025. december 18.',
        url: 'https://hvg.hu/360/20251218_orban-csalad-hatvanpuszta-projektleiras-titkos-lepcso',
      },
      {
        source: '24.hu',
        headline: 'Hadházy: a főkertész elkotyogta, nem Orbán apja, hanem Tiborcz cége üzemelteti Hatvanpusztát',
        lead: 'Hadházy Ákos szerint a hatvanpusztai főkertész vallomásából kiderült, hogy a birtokot nem Orbán Győző, hanem Tiborcz István BDPST csoportjához tartozó cége üzemelteti.',
        date: '2025. november 17.',
        url: 'https://24.hu/belfold/2025/11/17/hadhazy-akos-orban-viktor-hatvanpuszta-tiborcz-istvan-bdpst-meszaros-lorinc-majorsag-vallomas-elkotyog-fokertesz/',
      },
      {
        source: '24.hu',
        headline: 'Így dolgozhatott össze Mészáros Lőrinc és az Orbán család Hatvanpusztán',
        lead: 'Orbán Győző kőbányájából tíz év alatt megtermelt ~10 milliárdos bevétele jelentősen elmarad a hatvanpusztai beruházás becsült 20–25 milliárdos költségétől — ami arra utal, hogy Mészáros Lőrinc cégbirodalma finanszírozhatta a projektet.',
        date: '2025. október 16.',
        url: 'https://24.hu/fn/gazdasag/2025/10/16/hatvanpuszta-luxusberuhazas-korrupcio-meszaros-lorinc-orban-viktor-csaladja/',
      },
      {
        source: 'Válasz Online',
        headline: 'Exkluzív: Hatvanpuszta összes titka egy helyen',
        lead: 'Hadházy Ákos és építész szakértők közreműködésével átfogó elemzés arról, hogyan alakították át a védett gazdasági majorságot luxus lakókomplexummá, miközben a hivatalos műemléki védettség formálisan megmaradt.',
        date: '2025. szeptember 11.',
        url: 'https://www.valaszonline.hu/2025/09/11/hatvanpuszta-majorsag-hadhazy-akos-alaprajzok-fenykepek-epitkezes/',
      },
      {
        source: 'Telex',
        headline: 'Hadházy Ákos szerint így néz ki a hatvanpusztai birtok tervrajza',
        lead: 'Hadházy Ákos nyilvánosságra hozta a hatvanpusztai birtok építészeti terveit, amelyek szerinte lakófunkciókat — lakásokat, liftet, étkezőket — tartalmaznak, cáfolva a birtok „befejezetlen mezőgazdasági üzemként" való hivatalos jellemzését.',
        date: '2025. szeptember 1.',
        url: 'https://telex.hu/belfold/2025/09/01/hatvanpuszta-birtok-tervrajzok-hadhazy-akos-orban-viktor',
      },
    ],
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
    id: 'mnb-botrany',
    eyebrow: 'Aktív · Nyomozás folyamatban',
    title: 'MNB botrány',
    responsible: 'Matolcsy György',
    responsibleGaleriaId: 'matolcsy-gyorgy',
    estimatedDamage: '266+ milliárd Ft — közpénz MNB alapítványokon átfolyva',
    responsiblePersons: ['Matolcsy György — MNB elnöke (2013–2025)'],
    crimeTypes: ['Hűtlen kezelés', 'Sikkasztás (gyanú)', 'Közbeszerzési visszaélés'],
    relatedPersonIds: ['matolcsy-gyorgy', 'windisch-laszlo'],
    articleTag: 'MNB',
    // A régi articleKeywordGroups két szűk AND-párra korlátozódott (mindkét
    // szó kellett a címben) — sok friss MNB/Matolcsy-cikk kimaradt belőle,
    // ugyanaz a mintázat, ami az NKA-nál is előfordult. Plusz sima
    // articleKeywords, ami bármelyik kifejezésre önmagában is illeszkedik.
    articleKeywords: ['Matolcsy', 'PADME', 'Pallas Athéné', 'MNB-botrány', 'MNB alapítvány'],
    articleKeywordGroups: [
      ['MNB alapítvány', 'Neumann János Egyetem'],
      ['MNB alapítvány', 'vagyonvesztés'],
    ],
    pinnedNews: [
      {
        source: 'mfor.hu',
        headline: 'Sok munka vár az új kormányra még az MNB-s alapítványok miatt',
        lead: 'Az Európai Bizottság konvergenciajelentése szerint az MNB alapítványainak szabályozása továbbra sem felel meg az uniós elvárásoknak, mivel a 2026 februárjában bejelentett törvénymódosítások hatástalannak bizonyultak.',
        date: '2026. július 7.',
        url: 'https://mfor.hu/cikkek/makro/sok-munka-var-az-uj-kormanyra-meg-az-mnb-s-alapitvanyok-miatt.html',
      },
      {
        source: 'HVG',
        headline: 'Forr a levegő Kecskeméten az MNB-alapítvány által lenyúlt pénz miatt',
        lead: 'A könyvvizsgáló nem tudott véleményt adni a kecskeméti Neumann János Egyetemért Alapítvány 2025-ös mérlegéről, mert nem lehetett felmérni az MNB-alapítvány vagyonkezelőjének adott 127,5 milliárd forintos kölcsön hitelkockázatát.',
        date: '2026. július 3.',
        url: 'https://hvg.hu/360/20260703_kecskemeti-egyetem-alapitvany-pallas-athene-mnb-alapitvany-merleg',
      },
      {
        source: 'HVG',
        headline: 'Itt az MNB-alapítvány mérlege: az induló közvagyon tizede sincs meg',
        lead: 'A Pallas Athéné Alapítvány friss mérlege szerint a vagyon egy év alatt 25 milliárd forintra nőtt, miközben korábban ennek tízszerese tűnt el.',
        date: '2026. július 1.',
        url: 'https://hvg.hu/360/20260701_pallas-athene-alapitvany-friss-merleg-vagyonvisszaszerzesi-eselyek-csepp-a-tengerben-hvg',
      },
      {
        source: '444',
        headline: 'Matolcsy Ádám dubaji cégében kötött ki egy milliárdos értékű, egykori MNB-alapítványos Vörösmarty téri ingatlan',
        lead: 'Egy milliárdos értékű, a jegybanki alapítványi körhöz köthető Vörösmarty téri ingatlan tulajdonosváltásai Száraz István érdekeltségein keresztül végül Matolcsy Ádám dubaji cégéhez vezettek.',
        date: '2026. június 19.',
        url: 'https://444.hu/2026/06/19/matolcsy-adam-dubaji-cegeben-kotott-ki-egy-milliardos-erteku-egykori-mnb-alapitvanyos-vorosmarty-teri-ingatlan',
      },
      {
        source: 'Telex',
        headline: 'Egyáltalán nem megnyugtató az MNB-ügy érintettjeinek, ha eddig nem hallgatták meg őket',
        lead: 'Az MNB-alapítványokat érintő nyomozásban mostanáig 91,8 milliárd forintot foglaltak le, ugyanakkor gyanúsítás vagy kényszerintézkedés még nem történt, és kevés érintettet hallgattak meg.',
        date: '2026. június 2.',
        url: 'https://telex.hu/gazdasag/2026/06/02/mnb-ugy-matolcsy-adam-nyomozas-rendorseg-ugyeszseg',
      },
      {
        source: 'HVG',
        headline: 'Ügyvédek, gazdasági szakemberek sokasága építette fel az MNB-s bankrablást: 92 milliárdot zároltak, 97 magánszemély, 36 cég és 11 magántőkealap körül kutakodnak',
        lead: 'Az MNB-alapítványok körüli vagyonvesztést szervező jogi és pénzügyi hálózat — a nyomozás során eddig 92 milliárd forintot zároltak, 97 magánszemély, 36 cég és 11 magántőkealap érintettségét vizsgálják.',
        date: '2026. május 29.',
        url: 'https://hvg.hu/gazdasag/20260529_mnb-botrany-matolcsy-gyorgy-nyomozas-kutatas-ugyeszseg',
      },
      {
        source: 'Telex',
        headline: 'Több helyszínen is razziáztak a nyomozók az MNB-ügyben',
        lead: 'A Központi Nyomozó Főügyészség a Nemzeti Nyomozó Iroda közreműködésével több helyszínen, köztük a Somlai Bálinthoz köthető Raw Development infoparki irodájában is vizsgálódott.',
        date: '2026. május 28.',
        url: 'https://telex.hu/gazdasag/2026/05/28/mnb-ugy-razzia-kozponti-nyomozo-fougyeszseg',
      },
      {
        source: 'Telex',
        headline: 'Az MNB-alapítvány váratlanul növelte a részesedését a svájci Ultima SA luxusingatlanos cégben',
        lead: 'Az alapítvány vagyonkezelője, az Optima Zrt. más eszközök értékesítéséből növelte részesedését az Ultima SA-ban, amely a vagyonelemek közül a legígéretesebbnek tűnik — de a remélt bevételek még mindig nem fedeznék az alapítvány teljes adósságát.',
        date: '2026. május 27.',
        url: 'https://telex.hu/gazdasag/2026/05/27/mnb-alapitvany-ultima-sa-gtc-mbh-hitel-kecskemet-luxusingatlan-vagyonvesztes',
      },
      {
        source: '24.hu',
        headline: 'Ezért nem gyanúsítottak meg senkit egy év alatt az MNB-ügyben – válaszolt az ORFK',
        lead: 'Az ORFK szerint a nyomozás során több mint 80 ezer adatállományt kellett begyűjteni és feldolgozni — ez magyarázza, hogy egy év alatt miért nem történt gyanúsítás az ügyben.',
        date: '2026. május 26.',
        url: 'https://24.hu/belfold/2026/05/26/mnb-ugy-orfk-nyomozas/',
      },
      {
        source: 'Telex',
        headline: 'Milliárdos rejtett aknákat találtunk az MNB-alapítvány egyeteménél',
        lead: 'Az Állami Számvevőszék vizsgálata után több milliárdos rejtett kötelezettség derült ki a Budapesti Metropolitan Egyetem gazdálkodásában, köztük előnytelen ingatlanbérleti szerződések és magas végkielégítések.',
        date: '2026. május 21.',
        url: 'https://telex.hu/gazdasag/2026/05/21/metu-mnb-alapitvany-veszteseg-kozpenz-matolcsy',
      },
      {
        source: 'Telex',
        headline: '205 nap után kiadták az MNB-ügyben érintett kecskeméti egyetemi alapítvány intézkedési tervét',
        lead: 'A Neumann János Egyetemért Alapítvány 205 nappal az eredeti adatigénylés után hozta nyilvánosságra a tavalyi intézkedési tervét, amely az MNB-alapítvánnyal kapcsolatos pénzügyi problémákra reagált.',
        date: '2026. május 19.',
        url: 'https://telex.hu/gazdasag/2026/05/19/kecsup-intezkedesi-terv-neumann-janos-egyetem',
      },
      {
        source: 'HVG',
        headline: 'A Matolcsy-kör úgy vette meg a Metropolitan Egyetemet, hogy az árat az egyetem fizette',
        lead: 'Kucsera Tamás Gergely lemondott a Metropolitan Egyetem rektori posztjáról, néhány nappal azután, hogy Czene Gréta elnök-vezérigazgató is távozott. Az ÁSZ vizsgálata szerint az MNB-alapítványi felvásárlást valójában maga az egyetem finanszírozta.',
        date: '2026. május 14.',
        url: 'https://hvg.hu/360/20260514_hvg-matolcsyklan-mnb-alapitvany-metropolitan-egyetem-metu-kucsera-tamas-gergely-czene-greta-asz-vizsgalat',
      },
      {
        source: 'Portfolio',
        headline: 'A magyar leánya is veszteséges az MNB-botrányban érintett ingatlancégnek',
        lead: 'A GTC Magyarország csoport 2025-ben 23,1 millió eurós veszteséget könyvelt el az előző évi 28,2 millió eurós profit helyett — a bevételek visszaesése és a befektetési célú ingatlanok átértékelése rontotta az eredményt.',
        date: '2026. május 14.',
        url: 'https://www.portfolio.hu/ingatlan/20260514/a-magyar-leanya-is-veszteseges-az-mnb-botranyban-erintett-ingatlancegnek-836852',
      },
    ],
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
      { label: 'Telex / Direkt36: Panyi Szabolcs és Szőke Dániel — az ÁSZ kiszivárgott jelentés-tervezetének teljes elemzése', url: 'https://telex.hu/direkt36/2025/03/17/hatalmas-vagyonvesztest-es-mas-sulyos-problemakat-talalt-az-asz-matolcsyek-alapitvanyanal-a-kiszivargott-jelentesterv-szerint' },
      { label: 'Telex: Szemereyné Pataki Klaudia — a kecskeméti polgármester és a 144 milliárd', url: 'https://telex.hu/zacc/2025/04/16/kecskemet-polgarmester-szemereyne-pataki-klaudia-neumann-janos-egyetem' },
      { label: '24.hu: A polgármester férje 400 millió forint MNB Növekedési Hitelt kapott', url: 'https://24.hu/fn/penzugy/2016/05/09/rtl-klub-a-kecskemeti-polgarmester-ferje-is-kapott-400-milliot-az-mnb-tol/' },
      { label: 'Portfolio: Matolcsy megszólalt — szerinte nem az történt, amit mindenki gondol', url: 'https://www.portfolio.hu/gazdasag/20260422/megszolalt-matolcsy-az-mnb-botranyrol-szerinte-nem-az-tortent-amit-mindenki-gondol-832114' },
      { label: 'HVG: Az MNB-botrány jelenlegi állása — nyomozás, kutatás, ügyészség', url: 'https://hvg.hu/gazdasag/20260529_mnb-botrany-matolcsy-gyorgy-nyomozas-kutatas-ugyeszseg' },
      { label: '444: ÁSZ vizsgálat az MNB alapítványokról', url: 'https://444.hu/2025/03/19/az-allami-szamvevoszek-vizsgalja-az-mnb-alapitvanyait' },
    ],
    descriptionBlocks: [
      {
        type: 'text',
        heading: 'Az ügy háttere',
        content: 'A Magyar Nemzeti Bank (MNB) botránya az évtized egyik legsúlyosabb közpénzügyi ügye. Matolcsy György jegybankelnök 2013 és 2025 között összesen 266 milliárd forintot csatornázott ki a jegybank mérlegéből különböző alapítványokba — a Pallas Athéné Alapítványcsalád tagjaiba, a Közgazdasági Ismeretterjesztő Alapítványba és más szatellit-szervezetekbe. Az összeg rendkívülisége nem vitatható: 266 milliárd forint nagyjából annyi, mint az ország éves egészségügyi fejlesztési büdzséjének fele.',
      },
      {
        type: 'text',
        content: 'Az ÁSZ kiszivárgott jelentés-tervezete 2025-ben döntő fordulatot hozott. A Pallas Athéné Domus Meriti Alapítványt (PADME) és az Optima Befektetési Zrt.-t vizsgáló dokumentum súlyos vagyonvesztést tárt fel: az Optima közel 500 milliárd forint felett rendelkezett, ebből több mint 400 milliárd közpénzből származott. Az ÁSZ átláthatatlan céghálózatot, rossz befektetési döntéseket és hiányos kontrollrendszert azonosított. A GTC-befektetésen több mint 160 milliárd forint értékvesztés keletkezett; a lengyelrészvény-portfolio értéke összeomlott.',
      },
      {
        type: 'text',
        content: 'A tulajdonosi körökre vonatkozó gyanú is felmerült. Matolcsy György unokatestvérének neve — Balogh Csaba — megjelent az alapítványi körrel üzleti kapcsolatban álló szervezeteknél. Csizmadia Norbert, mindkét alapítvány kuratóriumának korábbi elnöke, korábban Matolcsy mellett dolgozott. Ez az összefonódás a jegybankelnök és a közpénzek haszonélvezői között közvetlen kapcsolatot sugall.',
      },
      {
        type: 'text',
        heading: 'A kecskeméti polgármester és a 144 milliárd',
        content: 'Az MNB-alapítványok botrányának egyik legelképesztőbb mellékszála a Neumann János Egyetemért Alapítvány ügye. Az alapítvány 2020–2021-ben 144 milliárd forintot kapott az államtól — ebből 127,5 milliárdot az Optima Befektetési Zrt.-nek kölcsönöztek kirívóan alacsony kamattal. Az Optima ezt értékvesztett lengyel részvényekbe fektette. A kecskeméti campus félkész maradt, a „tudásváros" soha el sem kezdődött, a pénz visszaszerzésére nincs lehetőség. Amikor 2025 áprilisában a kecskeméti városházán kérdezték Szemereyné Pataki Klaudia polgármestert a 144 milliárdról, arrogánsan söpörte le a kérdéseket.',
      },
      {
        type: 'article-card',
        source: 'Telex',
        headline: 'Kecskeméti polgármester és a 144 milliárd — Szemereyné Pataki Klaudia nem volt hajlandó válaszolni',
        lead: 'Az ÁSZ megállapította: a Neumann János Egyetemért Alapítvány 144 milliárdját értékvesztett lengyel részvényekbe fektette az Optima. A campus félkész, a pénz odavan. A polgármesternél a városházán faggatták az újságírók — és arrogánsan lesöpörte a kérdéseket.',
        url: 'https://telex.hu/zacc/2025/04/16/kecskemet-polgarmester-szemereyne-pataki-klaudia-neumann-janos-egyetem',
        date: '2025. április 16.',
      },
      {
        type: 'text',
        content: 'A polgármester arroganciája nem véletlen: a Szemereyné-szál nem ér véget a 144 milliárdnál. 9 évvel korábban, 2016-ban kiderült, hogy a polgármester férjének cége — a Szempont Consulting Kft. — 400 millió forint MNB Növekedési Hitelt kapott. A cég törzstőkéje mindössze 3 millió forint volt; ez szolgált fedezetként a 400 millióhoz. A cég 2014-es összforgalma 8,5 millió forint, nyeresége 1,5 millió forint volt. Erre a 3 milliós alaptőkéjű, 8 milliós forgalmú cégre folyósított az MNB 400 millió forintot.',
      },
      {
        type: 'article-card',
        source: '24.hu',
        headline: 'A kecskeméti polgármester férje is kapott 400 millió forintot az MNB-től',
        lead: 'A Szempont Consulting Kft. — amelynek törzstőkéje 3 millió forint és 2014-es forgalma 8,5 millió forint volt — 400 millió forint MNB Növekedési Hitelt kapott. A cég tulajdonosa a kecskeméti polgármester férje.',
        url: 'https://24.hu/fn/penzugy/2016/05/09/rtl-klub-a-kecskemeti-polgarmester-ferje-is-kapott-400-milliot-az-mnb-tol/',
        date: '2016. május 9.',
      },
      {
        type: 'text',
        heading: 'Matolcsy megszólalt: szerinte csak módszertanról van szó',
        content: '2026 áprilisában Matolcsy György megszólalt az ügyről. Álláspontja szerint az alapítványok vagyona nem tűnt el — csupán az értékelési módszertanokról folyik vita. Ez az érvelés szembekerül az ÁSZ kiszivárgott megállapításaival, amelyek konkrét, visszafordíthatatlan vagyonvesztést dokumentálnak, és azzal a ténnyel, hogy az ezermilliárdos nagyságrendű ügyhöz köthető befektetések szinte kivétel nélkül értéktelenné váltak.',
      },
      {
        type: 'article-card',
        source: 'Portfolio',
        headline: 'Megszólalt Matolcsy az MNB-botrányról — szerinte nem az történt, amit mindenki gondol',
        lead: 'Matolcsy György 2026 áprilisában reagált: az alapítványok vagyona szerinte nem tűnt el, a vita az értékelési módszertanokról szól. A Nemzeti Nyomozó Iroda vizsgálatát eközben a szövetségi ügyészségre adták át.',
        url: 'https://www.portfolio.hu/gazdasag/20260422/megszolalt-matolcsy-az-mnb-botranyrol-szerinte-nem-az-tortent-amit-mindenki-gondol-832114',
        date: '2026. április 22.',
      },
      {
        type: 'text',
        heading: 'Az ügy jelenlegi állása',
        content: 'A 2026-ban megalakuló új kormány ügyészsége nyomozást indított hűtlen kezelés gyanújával. A Nemzeti Nyomozó Iroda vizsgálatát az ügyészségre adták át; az eljárásban óriási mennyiségű adatot foglaltak le. Matolcsy Györgynek le kellett mondania az MNB elnöki posztjáról; az MNB új elnöke megkezdte az intézményi átvilágítást és személycseréket végzett az érintett alapítványoknál. Vádemelésre eddig nem került sor.',
      },
      {
        type: 'article-card',
        source: 'HVG',
        headline: 'MNB-botrány 2026 — nyomozás, kutatás, ügyészség: hol tart az ügy?',
        lead: 'A HVG összefoglalója az MNB-botrány jelenlegi állásáról: a nyomozás tart, az ügyészség dolgozik, de vádemelés még nem történt. Matolcsy szabadon él.',
        url: 'https://hvg.hu/gazdasag/20260529_mnb-botrany-matolcsy-gyorgy-nyomozas-kutatas-ugyeszseg',
        date: '2026. május 29.',
      },
      {
        type: 'text',
        heading: 'A Direkt36 feltárása — a leghitelesebb nyilvános elemzés',
        content: 'Ha az ügy részletei érdekelnek, Panyi Szabolcs és Szőke Dániel (Direkt36 / Telex) az ÁSZ kiszivárgott jelentés-tervezetét teljes mélységében feldolgozó összefoglalóját ajánljuk — ez az egyik legjobb és leghitelesebb, nyilvánosan elérhető elemzés az MNB-alapítványok botrányáról.',
      },
      {
        type: 'article-card',
        source: 'Telex / Direkt36',
        headline: 'Hatalmas vagyonvesztést és más súlyos problémákat talált az ÁSZ Matolcsyék alapítványánál — a kiszivárgott jelentésterv szerint',
        lead: 'Panyi Szabolcs és Szőke Dániel részletes elemzése az ÁSZ kiszivárgott vizsgálati tervezetéről: átláthatatlan céghálózat, értékvesztett külföldi befektetések, hiányos kontroll — és mindez a jegybankelnök közvetlen köreiben.',
        url: 'https://telex.hu/direkt36/2025/03/17/hatalmas-vagyonvesztest-es-mas-sulyos-problemakat-talalt-az-asz-matolcsyek-alapitvanyanal-a-kiszivargott-jelentesterv-szerint',
        date: '2025. március 17.',
      },
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
    id: 'ki-az-a-zsolt-bacsi',
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
    moreUrl: '/ugyek/ki-az-a-zsolt-bacsi',
    summary: 'A „Zsolti bácsi"-ügy egy gyermekvédelmi intézménnyel összefüggő bántalmazási botrány, amelynek koronatanúja vallomást tett a Szőlő utcai ügy eljárása során. A kormány — miután az ügy nyilvánosságra került — ellentámadásba lendült. Az eljárás folyamatban van.',
    videoId: 'oa5h1wi3FSo',
    videoChannel: '',
    videoTitle: 'Zsolti bácsi-ügy – legújabb összefoglaló',
    videoSummary: 'Bangó Sándor, a Zsolti bácsi-ügy egyik főszereplője ebben a videóban szólal meg — és cáfolja a Fidesz ellentámadásának legfőbb elemét. A Fidesz ugyanis azzal gyanúsítja meg, hogy 4 millió forintot kapott cserébe azért, hogy a pártról ilyen súlyos vádakat fogalmazzon meg. Bangó Sándor határozottan visszautasítja ezt a vádat, és részletesen elmondja, mi az igazság: az ügy nem politikai megrendelésre született, hanem valós bántalmazásokról szól, amelyeket éveken át eltussoltak. A videóban elhangzik az az ígéret is, hogy hamarosan nyilvánosan megnevezik: ki valójában „Zsolti bácsi" — az a személy, aki ellen a gyermekvédelmi intézménnyel összefüggő bántalmazás gyanúja fennáll, és akit eddig az intézményi háttér és a hatósági passzivitás védett. A Fidesz támadása visszafelé sülhet el: a névközzététel után az ügy már nem lesz politikai labda, hanem konkrét személy konkrét felelőssége.',
    additionalVideos: [
      { id: 'QXW84vh1hV8', label: 'Juhász Péter | Juhi', title: 'A Szőlő utcai ügy' },
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
    sourceRefs: [
      { label: 'HVG: Tuzson Bence 3 oldalas jelentése a pedofilbotrányról', url: 'https://hvg.hu/itthon/20250924_tuzson-bence-jelentes-pedofilbotrany-ellenzeki-csalad-ugynokvad-mi6-ebx' },
      { label: 'A Tuzson-jelentés teljes szövege (PDF, kormány.hu)', url: 'https://cdn.kormany.hu//uploads/sheets//a/a2/a25/a251a2ec2e2b0d963991717f7093bd7.pdf' },
      { label: 'HVG: Tuzson Bence szerint nincs kiskorú sértett a Szőlő utcai ügyben', url: 'https://hvg.hu/itthon/20250924_Tuzson-Bence-a-Szolo-utcai-javitointezet-ugyerol-kiskoru-sertett-nem-volt-es-politikusok-neve-sem-kerult-elo' },
      { label: 'Magyar Hang: Gulyás Gergely ismételte — nincs kiskorú sértett', url: 'https://hang.hu/belfold/a-szolo-utcai-ugyben-nincs-kiskoru-sertett-ismetelte-meg-gulyas-gergely-181303' },
      { label: '444: A legfőbb ügyész elismerte, hogy van kiskorú sértett', url: 'https://444.hu/2025/12/17/a-legfobb-ugyesz-elismerte-hogy-van-kiskoru-sertett-a-szolo-utcai-ugynek' },
      { label: 'HVG: Az igazgató szerint elfogadhatatlan volt, amit Tuzson mondott', url: 'https://hvg.hu/itthon/20260429_szolo-utca-igazgato-kiskoru-sertett-elfogadhatatlan-tuzson-parlament' },
      { label: 'Telex: Legalább 15 kiskorú sértett van a Szőlő utcai ügyben', url: 'https://telex.hu/belfold/2026/01/13/szolo-utca-gyanusitas-15-kiskoru-sertett' },
    ],
    descriptionBlocks: [
      {
        type: 'text',
        heading: 'Az ügy háttere',
        content: 'A „Zsolti bácsi"-ügy a magyar gyermekvédelmi rendszer egyik legsúlyosabb, nyilvánosságra került botránya. Az ügyet a „Szőlő utcai ügy" tette ismertté: egy gyermekvédelmi intézménnyel kapcsolatos eljárás során a koronatanú vallomást tett a „Zsolti bácsi" nevű személy tevékenységéről.',
      },
      {
        type: 'text',
        content: 'Az ügy egy gyermekvédelmi intézmény körül forgott, ahol a gondozottak gyerekek sérelmére elkövetett bűncselekmények gyanúja merült fel. A „Zsolti bácsi" elnevezés az érintett személy beceneve — személyazonossága az eljárás előrehaladtával vált részben nyilvánossá a sajtóban.',
      },
      {
        type: 'text',
        content: 'Az ügyet Juhász Péter és más investigatív újságírók tárták fel. Juhász Péter nyilvánosan kijelentette: „Zsolt bácsi azt hitte, bármit megtehet" — utalva arra, hogy az érintett személy a védettsége tudatában cselekedett. Ez a védettség a gyermekvédelmi intézményi háttérből és a hatósági figyelmetlenségből fakadhatott. Bangó Sándor, az ügy egyik főszereplője pedig nyilvánosan szólalt meg a történtekről.',
      },
      {
        type: 'text',
        content: 'Az ügy nyilvánosságra kerülése után a korábbi kormány ellentámadásba lendült. Az ATV értesülései szerint a kormány politikai nyomást igyekezett gyakorolni az ügy kezelésére, ami az eltussolás gyanúját is felvetette. A parlamenti reakciók a gyermekvédelmi rendszer teljes átvilágítását sürgették.',
      },
      {
        type: 'text',
        content: 'A nyomozás jelenleg is folyamatban van. Az ügy tétje kettős: egyrészt az egyéni felelősség megállapítása az intézményi bántalmazásért, másrészt a rendszerszintű hiányosságok feltárása — hogy a gyermekvédelmi intézmények hogyan nyújthattak védelmet a bántalmazónak ahelyett, hogy a gyerekeket védték volna.',
      },
      {
        type: 'text',
        heading: 'A Tuzson Bence-szál: a tagadástól a magyarázkodásig',
        content: 'Tuzson Bence volt igazságügyi miniszter 2025 szeptemberében saját Facebook oldalán közzétett egy rövid videót, amelyben határozottan kijelentette: a Szőlő utcai ügynek nincs kiskorú sértettje. Ezt egy általa készített jelentésre alapozta — egy mindössze 3 oldalas, sebtiben összedobott dokumentumra, amelyet még azelőtt tett közzé, hogy a vizsgálatra hivatalos megbízást kapott volna. A vizsgálatot 3 óra alatt folytatta le.',
      },
      {
        type: 'video',
        id: 'sngeCfUImuQ',
        label: 'Tuzson Bence / Facebook',
        title: 'Tuzson Bence: nincs kiskorú sértett a Szőlő utcai ügyben',
        summary: 'Tuzson Bence 2025 szeptemberében saját Facebook oldalán állítja: a Szőlő utcai ügynek nincs kiskorú sértettje. A kijelentés alapja egy 3 oldalas, sebtiben összeállított, a hivatalos megbízás előtt elvégzett vizsgálat.',
      },
      {
        type: 'text',
        content: 'A HVG feltárta, hogy a Tuzson-féle dokumentum mindössze 3 oldal, és az elkészítése előtt nem kapott hivatalos vizsgálati megbízást — a jelentést azelőtt készítette el, minthogy erre felkérést kapott volna. A dokumentum teljes szövege a kormány weboldalán érhető el.',
      },
      {
        type: 'pdf-link',
        url: 'https://cdn.kormany.hu//uploads/sheets//a/a2/a25/a251a2ec2e2b0d963991717f7093bd7.pdf',
        label: 'A Tuzson-jelentés teljes szövege',
        note: 'kormany.hu · PDF · 3 oldal',
      },
      {
        type: 'text',
        content: 'A tagadást a kormány más szereplői is átvették. Gulyás Gergely Kormányinfón megerősítette a Tuzson-féle állítást.',
      },
      {
        type: 'article-card',
        source: 'Magyar Hang',
        headline: 'A Szőlő utcai ügyben nincs kiskorú sértett — ismételte meg Gulyás Gergely',
        lead: 'Gulyás Gergely Kormányinfón megismételte Tuzson Bence korábbi kijelentését: a Szőlő utcai javítóintézeti ügynek nincs kiskorú sértettje. A kijelentés a Tuzson-féle 3 oldalas gyorsjelentésen alapult.',
        url: 'https://hang.hu/belfold/a-szolo-utcai-ugyben-nincs-kiskoru-sertett-ismetelte-meg-gulyas-gergely-181303',
        date: '',
      },
      {
        type: 'article-card',
        source: 'Telex',
        headline: 'Legalább 15 kiskorú sértett van a Szőlő utcai ügyben',
        lead: 'A Telex 2026. január 13-án feltárta: a kormány által tagadott kiskorú sértettek valójában legalább 15-en vannak — közvetlen ellentmondásba kerülve a Tuzson–Gulyás-féle nyilatkozatokkal.',
        url: 'https://telex.hu/belfold/2026/01/13/szolo-utca-gyanusitas-15-kiskoru-sertett',
        date: '2026. január 13.',
      },
      {
        type: 'quote',
        text: '„Abban az időpontban, amikor ezt a jelentést megírtam, abban az időszakban az ebbe foglalt állítás az mind igaz volt."',
        author: 'Tuzson Bence',
        note: '— 9 perces parlamenti kérdezz-feleken 7-szer ismételte meg, majdnem szóról szóra',
      },
      {
        type: 'video',
        id: 'Ro5TywCJn3Y',
        label: 'Parlamenti kérdezz-felelek',
        title: 'Tuzson Bence: „Abban az időpontban az állítás igaz volt" — 7-szer egymás után',
        summary: 'A 9 perces parlamenti kérdezz-felelek során Tuzson Bence 7-szer ismétli meg — majdnem szóról szóra — ugyanazt a mondatot: „Abban az időpontban, amikor ezt a jelentést megírtam, abban az időszakban az ebbe foglalt állítás az mind igaz volt." Az ellenzéki képviselők felváltva tesznek fel kérdéseket a 15 kiskorú sértettről, ő minden alkalommal ezzel a formulával válaszol.',
      },
      {
        type: 'text',
        heading: 'Az ügy jelenlegi állása',
        content: 'A legfőbb ügyész 2025 decemberében elismerte, hogy igenis van kiskorú sértett az ügyben — ezzel a Tuzson–Gulyás-féle tagadás végérvényesen megdőlt. 2026 áprilisában az intézet igazgatója a parlamentben elfogadhatatlannak nevezte, hogy Tuzson ilyen kijelentéseket tett. A nyomozás folyamatban van. Bangó Sándor a Fidesz azon vádját is visszautasítja, miszerint 4 millió forintot kapott volna a kormányellenes állítások megtételéért.',
      },
    ],
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
    photo: '/images/persons/banki-erik.png',
    photoCredit: 'Eredeti fotó: Telex',
    photoPosition: 'right top',
    estimatedDamage: '~700 millió Ft közkár — 3,5 Mrd Ft helyett 2,8 Mrd lett volna a piaci ár',
    responsiblePersons: ['Bánki Erik — fideszes országgyűlési képviselő'],
    crimeTypes: ['Közbeszerzési visszaélés', 'Hűtlen kezelés', 'Vesztegetés (gyanú)'],
    relatedPersonIds: [],
    articleKeywords: ['volvo', 'Bánki', 'Tüke'],
    pinnedNews: [
      {
        source: 'HVG',
        headline: 'Hadházy Ákos: újabb nyomozás indult a pécsi buszbeszerzések ügyében',
        lead: 'Hadházy Ákos feljelentése nyomán a Baranya Vármegyei Rendőrség új nyomozást rendelt el a pécsi Volvo-buszbeszerzés ügyében, amelyben Bánki Erik neve is felmerül.',
        date: '2026. június 16.',
        url: 'https://hvg.hu/gazdasag/20260616_hadhazy-akos-banki-erik-pecs-buszbeszerzes-volvo-ugyeszseg-uj-nyomozas',
      },
      {
        source: '444',
        headline: 'Hadházy másodszor is feljelentette Bánki Eriket a Volvo-csalás miatt',
        lead: 'Hadházy Ákos másodszor is feljelentést tett Bánki Erik ellen a túlárazott pécsi buszbeszerzés ügyében, amely mintegy 650 millió forintos kárt okozott az önkormányzatnak.',
        date: '2026. április 27.',
        url: 'https://444.hu/2026/04/27/hadhazy-masodszor-is-feljelentette-banki-eriket-a-volvo-csalas-miatt',
      },
      {
        source: '444',
        headline: 'Jogerősen elítéltek két vádlottat a túlárazott pécsi buszvásárlás ügyében, aminek még az utolsó perbeszédében is előkerült a fideszes Bánki Erik neve',
        lead: 'A Pécsi Ítélőtábla jogerőre emelte két vádlott 5-5 éves börtönbüntetését gazdasági csalás és pénzmosás miatt — az ítéletben ismét felmerült Bánki Erik neve.',
        date: '2026. április 8.',
        url: 'https://444.hu/2026/04/08/volvogate-pecsi-itelotabla-jogeros-itelet-gazdasagi-csalas-penzmosas-pecs-tuke-busz-csizi-peter-banki-erik-pava-zsolt',
      },
      {
        source: 'Szabad Pécs',
        headline: 'Öt év börtönbüntetésre ítélte a Szekszárdi Törvényszék a Volvo-gate két vádlottját',
        lead: 'A Szekszárdi Törvényszék öt év börtönbüntetésre és teljes vagyonelkobzásra ítélte a Volvo-gate két vádlottját gazdasági csalás és pénzmosás miatt, miután a korábbi felmentő ítéletet a másodfok hatályon kívül helyezte.',
        date: '2025. június 17.',
        url: 'https://szabadpecs.hu/2025/06/ot-ev-bortonbuntetesre-itelte-a-szekszardi-torvenyszek-a-volvo-gate-ket-vadlottjat/',
      },
      {
        source: 'Szabad Pécs',
        headline: 'Színlelt közbeszerzési eljárás után vették Pécsnek buszokat a Volvo-per ügyésze szerint, aki emiatt letöltendőt kért a két talpon maradt vádlottra',
        lead: 'A Volvo-per ügyésze szerint Pécs színlelt közbeszerzési eljárás keretében vásárolt buszokat, mintegy 720 millió forintos kárt okozva, ezért letöltendő börtönbüntetést kért a két talpon maradt vádlottra.',
        date: '2025. június 3.',
        url: 'https://szabadpecs.hu/2025/06/szinlelt-kozbeszerzesi-eljaras-utan-vettek-pecsnek-buszokat-a-volvo-per-ugyesze-szerint-aki-emiatt-letoltendot-kert-a-ket-talpon-maradt-vadlottra/',
      },
      {
        source: '444',
        headline: 'Bánki Erik papírt hozott arról, hogy a volt cége nem kapott 52 milliót – aztán a volt üzlettársa beismerte, hogy de igen',
        lead: 'A szekszárdi törvényszéken zajló Volvogate-perben Bánki Erik azt állította, hogy volt cége nem kapott 52 millió forintot, ám volt üzlettársa a tárgyaláson ennek ellenkezőjét ismerte be.',
        date: '2025. május 5.',
        url: 'https://444.hu/2025/05/05/volvogate-pecs-birosag-szekszardi-torvenyszek-buntetoper-buszbeszerzes-banki-erik',
      },
      {
        source: '444',
        headline: 'Hadházy Ákos közzétette Bánki Eriknek a túlárazott pécsi buszbeszerzés perében tett első tanúvallomását',
        lead: 'Hadházy Ákos nyilvánosságra hozta Bánki Erik 2022-es tanúvallomását a túlárazott pécsi buszbeszerzés ügyében indult perből.',
        date: '2025. április 29.',
        url: 'https://444.hu/2025/04/29/hadhazy-akos-kozzetette-banki-eriknek-a-tularazott-pecsi-buszbeszerzes-pereben-tett-elso-tanuvallomasat',
      },
      {
        source: '444',
        headline: 'A politikus, aki bíróságon vallotta, hogy nem emlékszik, milyen koncertre ment Hollandiába Bánki Erikkel',
        lead: 'A Volvo-gate perben tanúként kihallgatott Csizi Péter volt pécsi alpolgármester azt vallotta, nem emlékszik, milyen koncertre utazott Hollandiába Bánki Erikkel 2015-ben.',
        date: '2025. április 24.',
        url: 'https://444.hu/2025/04/24/a-politikus-aki-birosagon-vallotta-hogy-nem-emlekszik-milyen-koncertre-ment-hollandiaba-banki-erikkel',
      },
      {
        source: 'Szabad Pécs',
        headline: 'Te tudnád, kinek a koncertjén voltál ingyen Amszterdamban? Csizi Péternek fogalma sem volt róla, pedig Bánki Erik hívta meg',
        lead: 'Csizi Péter volt alpolgármester a bíróságon azt állította, hogy 2015-ös hollandiai útja Bánki Erikkel csak egy koncertre szólt, és nem tudott a buszbeszerzésnél kedvezőbb holland ajánlatról.',
        date: '2025. április 23.',
        url: 'https://szabadpecs.hu/2025/04/te-tudnad-kinek-a-koncertjen-voltal-ingyen-amszterdamban-csizi-peternek-fogalma-sem-volt-rola-pedig-banki-erik-hivta-meg-buszugyeket-viszont-10000-hogy-nem-intezett-hollandiaban/',
      },
      {
        source: 'Népszava',
        headline: 'Lerázná magáról a pert a fideszes Bánki Erik, de a bíró nem hagyja',
        lead: 'A szekszárdi bíróság 300 ezer forintos rendbírsággal sújtotta a tanúként megidézett Bánki Eriket, aki másodszor sem jelent meg a pécsi Volvo-buszperben, a bíró pedig nem fogadta el a parlamentből érkezett halasztási kérelmet.',
        date: '2025. április 14.',
        url: 'https://nepszava.hu/3276096_banki-erik-pecsi-buszper-birosag-buntetes',
      },
      {
        source: '444',
        headline: 'Rendszeresen voltak titkos egyeztetések Bánki Erik és a fideszes pécsi városvezetés között egy tanúvallomás szerint',
        lead: 'Egy tanúvallomás szerint a 2010-es években rendszeres, titkos egyeztetések zajlottak Bánki Erik és a pécsi fideszes városvezetés között, amelyeken állítólag a túlárazott buszbeszerzés is szóba került.',
        date: '2025. március 31.',
        url: 'https://444.hu/2025/03/31/pecs-pava-zsolt-madar-jozsef-peter-szekszardi-torvenyszek-buntetoper-volvogate-pava-zsolt-buszbeszerzes-gazdasagi-csalas',
      },
    ],
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
    description: `A pécsi Volvo-gate az a típusú közbeszerzési botrány, ahol minden egyes szám hazugságot bizonyít — csak éppen soha senkit nem ítéltek el érte.`,
    descriptionBlocks: [
      {
        type: 'text',
        content: 'A pécsi Volvo-gate az a típusú közbeszerzési botrány, ahol minden egyes szám hazugságot bizonyít — csak éppen soha senkit nem ítéltek el érte.',
      },
      {
        type: 'text',
        content: '2010-ben a pécsi Tüke Busz Zrt. 115 darab használt Volvo autóbuszt vásárolt holland közvetítőkön keresztül. A vételár: 3,5 milliárd forint. A probléma: ugyanezeket a buszokat — vagy azonos típusú, hasonló állapotú járműveket — fél évvel korábban 2,8 milliárd forintos ajánlati áron lehetett volna megvenni. A különbözet 700 millió forint: ez a közkár.',
      },
      {
        type: 'text',
        content: 'A 700 millió forintnyi különbözet nem tűnt el a levegőben. Egy Bánki Erikhez köthető cég 52 millió forintnyi részt kapott a tranzakcióból tanácsadói díj formájában — derült ki az évek során felhalmozódott nyomozati anyagokból. A feltárt összegek egy részét — körülbelül 550 000 eurót, azaz kb. 170 millió forintot — Thaiföldre utalták el. Az összegek végső sorsát és az offshore struktúra pontos jellegét a nyomozás soha nem derítette fel teljes egészében.',
      },
      {
        type: 'text',
        content: 'Bánki Erik fideszes képviselő 2025-ig háromszor tett tanúvallomást az üggyel kapcsolatban. Minden alkalommal tagadott. Közvetlen személyes felelősséget a bírósági ítélet eddig nem állapított meg.',
      },
      {
        type: 'text',
        content: 'Hadházy Ákos független képviselő 2026-ban új feljelentést nyújtott be az ügyben, amelyet a Fejér Megyei Rendőrkapitányság el is fogadott. Párhuzamosan a Szekszárdi Törvényszék is újratárgyalja az ügyet. A két párhuzamos eljárás felkeltette az ügy iránt évek óta lanyhult figyelmet.',
      },
      {
        type: 'text',
        content: 'A Volvo-gate azért kerül a legdurvább ügyek közé, mert ez az egyik legjobban dokumentált, adatokkal alátámasztott közbeszerzési visszaélés — ahol a közkár összege, az érintett cég neve és a pénzáramlás iránya egyaránt nyomon követhető —, és mégsem született jogerős ítélet másfél évtized alatt.',
      },
      {
        type: 'text',
        heading: 'Bánki Erik más ügyei is gyanúsak',
        content: 'A Volvo-gate mellett Bánki Erik neve egy másik, párhuzamos korrupciós ügyben is felbukkan: az óbudai közétkeztetési botrányban. Az ügy egyik gyanúsítottjának vallomása szerint Bánki a Hungast nevű közétkeztetési cég tényleges, be nem jegyzett 50%-os tulajdonosa, és ő fizeti pénzzel az önkormányzatokat. Bánki tagad. Hadházy Ákos 2024-ben lefotózta, hogy Bánki Erik egy Hungast-cégre bejegyzett sport BMW-vel járt a parlamentbe — a rendszám betűi ráadásul véletlenül a Volvo-ügy harmadrendű vádlottjának nevére utalnak.',
      },
      {
        type: 'quote',
        text: 'A Telex idézett az »óbudai ügy« gyanúsítottjának vallomásából, ami szerint Bánki Erik a Hungast nevű közéheztetési cég valódi tulajdonosa és ő keni pénzzel az önkormányzatokat. Bánki persze tagad. Érdekes tény: korábban lefotóztam, hogy Bánki véletlenül a Hungast nevén levő sport BMW-vel járt a parlamentbe… (Fun fact: a rendszám betűi meg véletlenül a Volvo ügy harmadrendű vádlottjának, Paczek Bandinak a nevére utalnak) De miért nincs még előzetesben, főleg, miután a Volvo nyomozást is újranyitották?',
        author: 'Hadházy Ákos',
        note: 'Facebook · 2026. június 20.',
      },
      {
        type: 'image-pair',
        src1: '/images/cases/banki-bmw.jpeg',
        alt1: 'Bánki Erik a Hungast BMW-vel a parlament parkolójában',
        src2: '/images/cases/banki-bmw-2.jpeg',
        alt2: 'A Hungast cégre bejegyzett BMW rendszáma',
        caption: 'Hadházy Ákos fotói — Bánki Erik a Hungast-cégre bejegyzett BMW-vel a parlament parkolójában (2024)',
      },
      {
        type: 'article-card',
        source: 'RTL',
        headline: 'Hadházy: Bánki Erik a Hungast-csoport BMW-jével járt a parlamentbe',
        lead: 'Hadházy Ákos lefotózta, hogy Bánki Erik egy Hungast-cégre bejegyzett sport BMW-vel érkezett az Országgyűlés parkolójába. A rendszám betűi ráadásul a Volvo-ügy harmadrendű vádlottjának nevére utalnak.',
        url: 'https://rtl.hu/belfold/2024/07/09/banki-erik-hungast-csoport-sportauto-bmw-hadhazy-akos',
        date: '2024. július 9.',
      },
      {
        type: 'article-card',
        source: 'Telex',
        headline: 'A gyanúsított vallomása: Bánki Erik a Hungast tényleges tulajdonosa, ő fizette az önkormányzatokat',
        lead: 'Az óbudai közétkeztetési korrupciós ügyben az egyik gyanúsított azt vallotta: Bánki Erik a Hungast be nem jegyzett 50%-os tulajdonosa, és az Oxygen Wellness VIP-részlegén találkoztak. Bánki tagadja, hogy valaha találkozott volna a vallomást tevő személlyel.',
        url: 'https://telex.hu/belfold/2026/06/20/hungast-ugy-obudai-korrupcios-ugy-oxygen-wellness-vip-reszleg-talalkozo',
        date: '2026. június 20.',
      },
    ],
  },
];