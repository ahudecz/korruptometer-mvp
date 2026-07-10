const KEYWORDS = [
  // Személyek — NER-közeliek és vizsgált politikusok
  'orbán viktor',
  'tiborcz istván', 'tiborcz',
  'hadházy ákos', 'hadházy',
  'lázár jános',
  'rogán antal', 'rogán',
  'semjén zsolt', 'semjén', 'zsolti bácsi', 'zsolt bácsi',
  'tuzson bence',
  'takács péter',
  'szíjjártó péter', 'szíjjártó',
  'mészáros lőrinc',
  'hankó balázs', 'hankó',
  'balásy gyula', 'balásy',
  'matolcsy györgy', 'matolcsy',
  'bánki erik',
  'pócs jános', 'rétvári bence', 'gulyás gergely',
  'sulyok tamás', 'polt péter',
  'kubatov gábor', 'kubatov',
  'ligeti miklós', 'ligeti',
  'zsigó róbert', 'zsigó',
  'ruff bálint',
  // Intézmények / ügyek
  'nka ', 'nemzeti kulturális alap',
  'mnb ', 'jegybank', 'magyar nemzeti bank',
  'nemzeti filmintézet', 'nfi ', 'káel csaba',
  // 'ász ' (rövid ÁSZ-alak) szándékosan NINCS itt: substring-illeszkedéssel
  // hamis pozitívot adott a "Hamász" szóra (2026-07-09, egy gázai háborús
  // cikk emiatt jutott át a /kulfold/ URL-szekció-szűrőn is, mert isRelevant()
  // előbb fut le, mint isForeignOrJunk()). A teljes 'állami számvevőszék' és
  // 'számvevőszék' alak elég a valós ÁSZ-hírekhez.
  'állami számvevőszék', 'számvevőszék',
  'aranykonvoj',
  'volvo gate', 'volvo-gate', 'tüke zrt', 'tüke busz',
  'szőlő utca',
  'kegyelmi botrány',
  'nemzeti vagyonvisszaszerzési hivatal', 'vagyonvisszaszerzés', 'vagyonvisszaszerzési hivatal',
  'transparency',
  // Helyek / NER-specifikus témák
  'hatvanpuszta', 'vitnyéd', 'batida',
  // Pártok, szervezetek
  'fidesz', 'tisza párt', 'tisza-párt',
  'mcc ', 'mathias corvinus', 'kekva', 'bdpst', 'nke ',
  // Közjogi fogalmak
  'alkotmánybíróság',
  'legfőbb ügyész', 'köztársasági elnök',
  'kúria',
  // Közbeszerzés — magyar politikai kontextusban specifikus
  'közbeszerzés',
  'túlárazás',
  'mutyi',
  // NER-specifikus ügyek
  'lélegeztetőgép',
  'akkugyár',
  'megafon',
  // Sajtó, média — csak specifikus, NER-közeli cégek/kiadványok
  'mediaworks',
  // KESMA csoport — nyomtatott
  'kesma', 'magyar nemzet', 'pesti srácok', 'világgazdaság',
  'délmagyarország', 'észak-magyarország', 'kisalföld',
  'petőfi népe', 'somogyi hírlap', 'zalai hírlap',
  'vas népe', 'tolnai népújság', 'fejér megyei hírlap',
  'hajdú-bihari napló', 'békés megyei hírlap',
  'kelet-magyarország', 'új néplap', 'új dunántúli napló',
  'szabad föld', 'vasárnap reggel',
  // KESMA csoport — digitális
  'origo', 'hír tv', 'hír fm', 'retro rádió',
  'bama.hu', 'baon.hu', 'beol.hu', 'boon.hu',
  'borsonline', 'delmagyar.hu', 'duol.hu', 'feol.hu',
  'haon.hu', 'heol.hu', 'hirvilag.hu', 'kemma.hu',
  'kisalfold.hu', 'likebalaton.hu', 'mainap.hu',
  'magyarnemzet.hu', 'nool.hu', 'sonline.hu',
  'szoljon.hu', 'szon.hu', 'teol.hu',
  'vaol.hu', 'veol.hu', 'zaol.hu',
  'newsfeed.hu', 'videa.hu',
] as const;

// 'tisztítótűz' csak akkor releváns, ha politikai kontextusban szerepel
const TISZTITOTUZ_CONTEXT = ['magyar péter', 'fidesz', 'vagyonvisszaszerzés'];

// ─── Tisza-kormány / állami cégek — kirúgás-kombináció ────────────────────
// Csak akkor 'in', ha a névre/cégre ÉS kirúgás/felmentés szóra egyszerre illeszkedik.
// Így pl. Vitézy közlekedési híreit nem gyűjti be, csak a pozícióváltásait.
const RESIGN_WATCHLIST_NAMES = [
  // Tisza-kormány miniszterei
  'magyar péter',
  'orbán anita',
  'ruff bálint',
  'kármán andrás', 'kármán',
  'pósfai gábor',
  'görög márta',
  'hegedűs zsolt',
  'lannert judit',
  'kapitány istván',
  // Kultúráért felelős államtitkár — rendszeresen jelent be NER-közeli
  // intézményvezetők (NFI, MCC stb.) menesztését, ezért a saját neve is
  // trigger, nem csak az intézmény neve (2026-07-10, Káel Csaba/NFI-ügy
  // csak azért maradt ki a scrape-ből, mert sem az intézmény, sem
  // Nagy Ervin neve nem volt a kulcsszavak közt).
  'nagy ervin',
  'vitézy dávid', 'vitézy',
  'ruszin-szendi romulusz',
  'bóna szabolcs',
  'kátai-németh vilmos',
  'lőrincz viktória',
  'gajdos lászló',
  'tarr zoltán',
  'tanács zoltán',
  'forsthoffer ágnes', 'forsthoffer',
  // Legfőbb állami cégek
  'mvm ', 'mvm zrt',
  'máv ', 'máv-start', 'máv zrt',
  'mol nyrt', 'mol zrt',
  'magyar posta',
  'nkm ', 'nkm energia',
  'szerencsejáték zrt', 'szerencsejáték',
  'mfb ', 'magyar fejlesztési bank',
  'eximbank',
  'hungarocontrol',
  'bkk ', 'budapesti közlekedési',
  'nhkv ',
  'mti ', 'magyar távirati iroda',
] as const;

const RESIGN_TRIGGERS = [
  'lemondott', 'lemondás', 'lemond',
  'kirúgták', 'kirúgás', 'kirúgta',
  'felmentette', 'felmentés', 'felmentették',
  'leváltotta', 'leváltás', 'menesztette', 'menesztés',
  'visszahívták', 'visszahívás',
] as const;

function isResignWatchlistEvent(headline: string, excerpt: string): boolean {
  const text = `${headline} ${excerpt}`.toLowerCase();
  if (!RESIGN_WATCHLIST_NAMES.some((n) => text.includes(n))) return false;
  return RESIGN_TRIGGERS.some((t) => text.includes(t));
}

export function isRelevant(headline: string, excerpt: string): boolean {
  const text = `${headline} ${excerpt}`.toLowerCase();
  if (KEYWORDS.some((kw) => text.includes(kw))) return true;
  if (text.includes('tisztítótűz') && TISZTITOTUZ_CONTEXT.some((ctx) => text.includes(ctx))) return true;
  if (isResignWatchlistEvent(headline, excerpt)) return true;
  return false;
}

const FEATURED_KEYWORDS = [
  // Lemondás, kirúgás, felmentés
  'lemondott', 'lemondás', 'lemond', 'kirúgták', 'kirúgás', 'kirúgta',
  'felmentette', 'felmentés', 'felmentették', 'leváltotta', 'leváltás',
  'menesztette', 'menesztés', 'visszahívták', 'visszahívás',
  // Médium megszűnés
  'megszűnt', 'megszűnés', 'leáll', 'bezárt', 'bezárás', 'leépítés',
  // Személyek / ügyek (mindig kiemelt)
  'balásy', 'hankó', 'nka ',
  'matolcsy', 'mnb ',
  // Médiabezárások / újságíró-kirúgások
  'pesti srácok', 'világgazdaság',
  // Volvo-gate
  'volvo gate', 'volvo-gate', 'bánki erik',
  // Vagyonvisszaszerzés, kegyelmi botrány
  'szőlő utca', 'kegyelmi botrány',
  'vagyonvisszaszerzés', 'transparency', 'ligeti miklós', 'ligeti',
] as const;

export function shouldFeature(headline: string, excerpt: string): boolean {
  const text = `${headline} ${excerpt}`.toLowerCase();
  if (FEATURED_KEYWORDS.some((kw) => text.includes(kw))) return true;
  if (text.includes('tisztítótűz') && TISZTITOTUZ_CONTEXT.some((ctx) => text.includes(ctx))) return true;
  return false;
}

// ─── Breaking News detekció ───────────────────────────────────────────────────

const BREAKING_TRIGGERS = [
  'őrizetbe vett', 'őrizetbe vétel', 'letartóztatták', 'letartóztatás',
  'előzetesbe', 'előzetes letartóztatás', 'vádat emeltek', 'vádemelés',
  'bírósági ítélet', 'elítélték', 'elítélte', 'jogerős ítélet',
  'házkutatás', 'razzia', 'gyanúsítottként hallgatták',
  'nyomozást rendeltek el', 'körözik', 'európai elfogatóparancs',
];

// Fallback figyelt lista — csak akkor használt, ha a hívó (apps/web) nem ad
// át élő listát. A packages/scrapers csomag nem importálhatja közvetlenül az
// apps/web GALERIA/WATCH_LIST/UGYEK configjait (külön build-egység), ezért
// apps/web/src/lib/breaking-monitored.ts állítja elő az élő listát ezekből a
// configokból, és azt adja át isBreaking() paramétereként (spec
// 007-political-prosecution-detection, FR-008/FR-009). Ez a tömb csak
// biztonsági háló arra az esetre, ha az élő lista valamiért nem érhető el,
// és a közvetlen (nem apps/web-es) hívóknak/teszteknek.
export const BREAKING_MONITORED_FALLBACK = [
  // Kiemelt személyek (WATCH_LIST — top 8 lemondásra felszólított)
  'sulyok tamás', 'polt péter', 'nagy gábor bálint',
  'varga zs. andrás', 'windisch lászló', 'rigó csaba balázs',
  'koltay andrás', 'senyei györgy',
  // Galéria személyek (top 10)
  'orbán viktor', 'rogán antal', 'mészáros lőrinc', 'tiborcz istván',
  'szíjjártó péter', 'takács péter', 'matolcsy györgy', 'lázár jános',
  'balásy gyula', 'semjén zsolt',
  // Kiemelt ügyek (UGYEK config articleKeywords)
  'nka', 'mnb', 'volvo-gate', 'volvo gate', 'bánki', 'tüke',
  'szőlő utca', 'szőlő utcai', 'zsolti bácsi', 'zsolt bácsi',
  'aranykonvoj', 'lélegeztetőgép', 'hatvanpuszta',
  'parkfenntartás', 'parkfenntartá', 'őrsi gergely',
];

export function isBreaking(
  headline: string,
  excerpt: string,
  monitoredNames: readonly string[] = BREAKING_MONITORED_FALLBACK,
): boolean {
  const headlineText = headline.toLowerCase();
  const fullText = `${headlineText} ${excerpt}`.toLowerCase();
  const hasTrigger = BREAKING_TRIGGERS.some((t) => fullText.includes(t));
  if (!hasTrigger) return false;
  // A figyelt névnek/ügynek a CÍMBEN kell szerepelnie, nem elég, ha csak az
  // excerpt egy mellékes, más témájú mondatában bukkan fel — az adta a fenti
  // hamis pozitívokat.
  return monitoredNames.some((m) => headlineText.includes(m));
}

// ─── Scrape relevance tiering (003-detection-review-engine) ───────────────────
// Ingyenes előszűrés, hogy a scrape-idejű AI CSAK a bizonytalan "maybe" kupacra
// fusson. A "biztos jó" és "biztos kuka" eldől kulcsszó/URL alapján, AI nélkül.

// URL-szekciók, amik egyértelműen nem magyar-politikai tartalom → biztos kuka.
const FOREIGN_URL_SECTIONS = [
  '/kulfold/', '/vilag/', '/world/', '/sport/', '/tech/',
  '/gasztro/', '/utazas/', '/elet-stilus/', '/eletmod/', '/auto/',
];

// Néhány nagyon specifikus külföldi marker arra az esetre, ha az URL nem árulkodik.
// Szándékosan szűk lista, hogy ne dobjon el valódi magyar-politikai cikket.
const JUNK_TERMS = ['vučić', 'vucic', 'örmény népirtás'];

export function isForeignOrJunk(headline: string, excerpt: string, url?: string): boolean {
  if (url && FOREIGN_URL_SECTIONS.some((s) => url.toLowerCase().includes(s))) return true;
  const text = `${headline} ${excerpt}`.toLowerCase();
  return JUNK_TERMS.some((t) => text.includes(t));
}

export type ScrapeTier = 'in' | 'out' | 'maybe';

/**
 * 3 kupac:
 *   'in'    — erős magyar-politikai kulcsszó → bemegy, AI nélkül (ingyen)
 *   'out'   — külföld-szekció / szemét, vagy nincs kulcsszó nem-default forrásnál → eldobjuk, AI nélkül (ingyen)
 *   'maybe' — megbízható tág forrás (relevantByDefault) kulcsszó nélkül → CSAK erre fut az AI
 */
export function scrapeRelevanceTier(
  headline: string,
  excerpt: string,
  url: string,
  relevantByDefault: boolean,
): ScrapeTier {
  if (isRelevant(headline, excerpt)) return 'in';
  if (isForeignOrJunk(headline, excerpt, url)) return 'out';
  if (relevantByDefault) return 'maybe';
  return 'out';
}
