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
  'állami számvevőszék', 'számvevőszék', 'ász ',
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

// Statikus figyelt lista — WATCH_LIST + GALERIA + extra ügyek
const BREAKING_MONITORED = [
  // Kiemelt személyek (WATCH_LIST)
  'sulyok tamás', 'polt péter', 'nagy gábor bálint',
  'varga zs. andrás', 'windisch lászló', 'rigó csaba balázs',
  'koltay andrás', 'senyei györgy',
  // Galéria személyek
  'orbán viktor', 'rogán antal', 'mészáros lőrinc', 'tiborcz istván',
  'szíjjártó péter', 'takács péter', 'matolcsy györgy', 'lázár jános',
  'balásy gyula', 'semjén zsolt',
  // Extra személyek
  'czeglédy csaba', 'simonka györgy', 'borkai zsolt', 'tasnádi andrás',
  'zsigó róbert', 'tilky zoltán', 'pócs jános', 'schadl györgy',
  // Extra ügyek / kulcsszavak
  'budapest-belgrád vasútvonal', 'budapest–belgrád',
  'kaleta', 'mátrai erőmű',
  'voldemort',
  'végrehajtói botrány',
  'atlétikai vb stadion', 'atlétikai stadion',
  'úszó vb', 'úszóvb',
  'zuglói parkolás',
  'parkfenntartási botrány',
  // Már meglévő KEYWORDS-ből is breaking-képesek
  'nka ', 'mnb ', 'volvo-gate', 'szőlő utca', 'aranykonvoj',
  'lélegeztetőgép', 'kegyelmi botrány',
];

export function isBreaking(headline: string, excerpt: string): boolean {
  const text = `${headline} ${excerpt}`.toLowerCase();
  const hasTrigger = BREAKING_TRIGGERS.some((t) => text.includes(t));
  if (!hasTrigger) return false;
  return BREAKING_MONITORED.some((m) => text.includes(m));
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
