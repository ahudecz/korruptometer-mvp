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
    'Kattints és nézd meg, kik a legnagyobb feljelentők a kormány mellett!',
    '#kegyencjarat #korrupció #közpénz',
  ].join('\n');
}

// user kérés, 2026-09-03: minden posztba kell CTA (call-to-action) — a
// legtöbb típusnál egy általános "olvasd el a friss híreket"-féle sor, a
// szavazásnál viszont ("Szavazz te is!") a hívó (check-social-triggers.ts)
// felülírja explicit cta paraméterrel.
const DEFAULT_BREAKING_CTA = '👉 Kattints és olvasd el a legfrissebb híreket!';

export function breakingCaption(kicker: string, headline: string, detail?: string, linkPath?: string, cta: string = DEFAULT_BREAKING_CTA): string {
  return [
    `🚨 ${kicker}`,
    '',
    headline,
    detail ? `\n${detail}` : null,
    '',
    `Részletek: kegyencjarat.hu${linkPath ?? ''}`,
    cta,
    '#kegyencjarat #korrupció',
  ].filter((l) => l !== null).join('\n');
}

// Napi tartalék-poszt (nincs elég friss esemény aznapra) — futó összesítő
// számok, mindig kegyencjarat.hu-s linkkel. l. check-social-triggers.ts
// buildSummaryStatsTrigger.
export function summaryCaption(lines: string[], linkPath: string, cta: string = '👉 Nézd meg a teljes adatbázist!'): string {
  return [
    '📊 EDDIG A KEGYENCJÁRATON',
    '',
    ...lines,
    '',
    `Minden adat, forrás és részlet: kegyencjarat.hu${linkPath}`,
    cta,
    '#kegyencjarat #korrupció',
  ].join('\n');
}
