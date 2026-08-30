/**
 * Sablon-alapú (NEM LLM-generált) feliratszöveg a Social Post Outbox
 * posztjaihoz — user kérés, 2026-08-30. Szándékosan determinisztikus: a napi
 * $0,50-os Anthropic-keretet ez a funkció ne terhelje (l. feedback-llm-
 * cost-isolation memória).
 */

export function milestoneCaption(amountLabel: string): string {
  return [
    `🚨 Elérte a(z) ${amountLabel}-ot a NER-hez és államigazgatáshoz köthető feltételezett bűncselekmények miatt tett feljelentések összértéke.`,
    '',
    'Ez nem jelenti, hogy ennyi pénzt elloptak — ez az érintett szerződések teljes értéke, aminek egy része teljesült is, de a gyanú szerint jelentős összeg veszhetett el.',
    '',
    'Minden adat, forrás és részlet: kegyencjarat.hu/birosagi-iteletek',
    '#kegyencjarat #korrupció #közpénz',
  ].join('\n');
}

export function breakingCaption(kicker: string, headline: string, detail?: string): string {
  return [
    `🚨 ${kicker}`,
    '',
    headline,
    detail ? `\n${detail}` : null,
    '',
    'Részletek: kegyencjarat.hu',
    '#kegyencjarat #korrupció',
  ].filter((l) => l !== null).join('\n');
}
