const KEYWORDS = [
  // Személyek
  'magyar péter', 'polt péter', 'sulyok tamás', 'németh balázs',
  'pócs jános', 'rétvári bence', 'kapitány istván', 'ruszin-szendi romulusz',
  'forsthoffer ágnes', 'radnai márk', 'gulyás gergely', 'orbán viktor',
  'orbán', 'tiborcz istván', 'tiborcz', 'hadházy ákos', 'hadházy',
  'lázár jános', 'lázár', 'rogán antal', 'rogán', 'semjén zsolt',
  'semjén', 'zsolt bácsi', 'tuzson bence', 'tuzson', 'takács péter',
  'szíjjártó péter', 'szíjjártó',
  'mészáros lőrinc', 'mészáros',
  'balásy',
  // Helyek
  'hatvanpuszta', 'vitnyéd',
  // Pártok, szervezetek
  'fidesz', 'tisza párt', 'tisza-párt', 'mszp', 'dk', 'momentum',
  'mcc ', 'mathias corvinus', 'kekva', 'bdpst', 'nke ',
  // Közjogi fogalmak
  'parlament', 'miniszter', 'miniszterelnök', 'kormány', 'képviselő',
  'polgármester', 'alpolgármester', 'önkormányzat', 'alkotmánybíróság',
  'legfőbb ügyész', 'ügyészség', 'köztársasági elnök',
  // Korrupció, bűnügyek
  'korrupció', 'korrupt', 'közbeszerzés', 'sikkaszt', 'hűtlen kezelés',
  'lopás', 'embercsempész', 'költségvetési csalás', 'kenőpénz', 'túlárazás',
  'vesztegetés', 'zsarolás', 'megvesztegetés', 'visszaélés',
  'hivatali visszaélés', 'tiltott állami finanszírozás',
  'feljelentés', 'letartóztat', 'letartóztatás', 'letartóztatták', 'őrizetbe',
  'vádirat', 'vádemelés', 'bűn', 'bűnvádi', 'nyomozás', 'nyomozati', 'razzia',
  'terror', 'terrorcselekmény', 'aranykonvoj',
  'sajtóper', 'eljárás', 'per ', 'peres', 'ítélet', 'titkos szerződés',
  'kúria', 'államkincstár', 'mutyi',
  // NER-specifikus
  'lélegeztetőgép', 'hatvanpuszta', 'pedofil', 'pedofília',
  'luxusgép', 'luxusyacht', 'akkugyár', 'gyerekbántalmazás',
  'vezetőszár', 'menekült', 'migráns', 'bevándorló',
  // Sajtó, média
  'mediaworks', 'média', 'propaganda',
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
  // Bűncselekmény
  'korrupció', 'hűtlen kezelés', 'lopás', 'túlárazás',
  'költségvetési csalás', 'sikkaszt', 'veszteget', 'kenőpénz',
  'vádemelés', 'vádirat', 'letartóztatták', 'letartóztatás', 'őrizetbe',
  // Személyek (mindig kiemelt)
  'balásy',
] as const;

export function shouldFeature(headline: string, excerpt: string): boolean {
  const text = `${headline} ${excerpt}`.toLowerCase();
  return FEATURED_KEYWORDS.some((kw) => text.includes(kw));
}
