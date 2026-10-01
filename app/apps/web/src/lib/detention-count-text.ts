/**
 * A „{elozetesben}” szám-token tisztán szöveges feloldása — DB-hozzáférés
 * nélkül, ezért kliens-komponensből (UgyekClient) is importálható. A számot
 * a szerveroldali loadDetentionCounts() adja (detention-counts.ts).
 */
export const DETENTION_COUNT_TOKEN = '{elozetesben}';

export type DetentionCounts = ReadonlyMap<string, number>;

/**
 * A tokent a számra cseréli. `null`, ha a szöveget nem szabad kiírni: a szám
 * nem ismert (DB-hiba), vagy 0 („0 személy előzetesben” értelmetlen).
 */
export function fillDetentionCount(text: string, ugyId: string, counts: DetentionCounts | null): string | null {
  if (!text.includes(DETENTION_COUNT_TOKEN)) return text;
  const n = counts?.get(ugyId) ?? 0;
  if (!counts || n <= 0) return null;
  return text.split(DETENTION_COUNT_TOKEN).join(String(n));
}

/** Eyebrow („Aktív · {elozetesben} személy előzetesben”): a fel nem oldható
 *  ` · `-szakasz kimarad, a többi megmarad. */
export function fillEyebrow(eyebrow: string, ugyId: string, counts: DetentionCounts | null): string {
  return eyebrow
    .split(' · ')
    .flatMap((part) => {
      const filled = fillDetentionCount(part, ugyId, counts);
      return filled === null ? [] : [filled];
    })
    .join(' · ');
}

/** Státuszsorok: a fel nem oldható sor kimarad. */
export function fillStatusItems<T extends { value: string }>(items: T[] | undefined, ugyId: string, counts: DetentionCounts | null): T[] | undefined {
  return items?.flatMap((it) => {
    const value = fillDetentionCount(it.value, ugyId, counts);
    return value === null ? [] : [{ ...it, value }];
  });
}
