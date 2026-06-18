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
  // Intézmények / ügyek
  'nka ', 'nemzeti kulturális alap',
  'mnb ', 'jegybank', 'magyar nemzeti bank',
  'állami számvevőszék', 'számvevőszék', 'ász ',
  'aranykonvoj',
  'volvo gate', 'volvo-gate', 'tüke zrt', 'tüke busz',
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

export function isRelevant(headline: string, excerpt: string): boolean {
  const text = `${headline} ${excerpt}`.toLowerCase();
  return KEYWORDS.some((kw) => text.includes(kw));
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
] as const;

export function shouldFeature(headline: string, excerpt: string): boolean {
  const text = `${headline} ${excerpt}`.toLowerCase();
  return FEATURED_KEYWORDS.some((kw) => text.includes(kw));
}
