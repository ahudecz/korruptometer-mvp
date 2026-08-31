/**
 * Sablon-alapú (NEM LLM-generált) feliratszöveg a Social Post Outbox
 * posztjaihoz — user kérés, 2026-08-30. Szándékosan determinisztikus: a napi
 * $0,50-os Anthropic-keretet ez a funkció ne terhelje (l. feedback-llm-
 * cost-isolation memória).
 */

export function milestoneCaption(amountLabel: string): string {
  return [
    `🚨 Elérte a ${amountLabel}-ot a NER-hez és államigazgatáshoz köthető feltételezett bűncselekmények miatt tett feljelentések összértéke.`,
    '',
    'A fenti közpénz összegek a feljelentésekben megfogalmazott becslések, a tényleges vagyoni kár a bírósági eljárásokban szakértők által kerül megállapításra.',
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
