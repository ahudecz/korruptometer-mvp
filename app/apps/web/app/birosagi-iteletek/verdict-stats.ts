// Egyetlen forrás a "/birosagi-iteletek" (VerdictList.tsx) stat-sorára.
// A verdictType oszlop szabad `text`, DB-szinten a
// supabase/migrations/0050_court_verdict_type_check.sql CHECK constraint-je
// zárja le a 8 érvényes értékre — az alábbi lista ONNAN származik, ott KELL
// frissíteni, ha egy új verdictType kerül be (l. verdict-stats.test.ts,
// ami minden itt felsorolt értékre lefuttatja az invariánst).
//
// A partíció itt már eleve KIZÁRÁS-alapú (RELEASED_TYPES + 'előzetesben'
// NEM ez, a többi IGEN "Vádemelve vagy elítélve") — ez a minta 2026-08-02
// előtt is helyes volt, ezt a modult csak a resignation-stats.ts / media-
// closure-stats.ts mintájának megfelelően emeltük ki tesztelhető, önálló
// fájlba. A UI-felirat 2026-08-17-én változott "Ítélet összesen"-ről (ez a
// vádemelés/fellebbezés-alatt szakaszra is ráillett, holott azok nem
// ítéletek — user report) — a SZÁMÍTÁS (kizárás-alapú partíció) nem
// változott, csak a szöveg lett pontosabb.

export const RELEASED_TYPES = ['szabadlábra helyezve', 'eljárás megszűnt', 'felmentve'] as const;
export type ReleasedType = (typeof RELEASED_TYPES)[number];

export function isReleased(t: string): t is ReleasedType {
  return (RELEASED_TYPES as readonly string[]).includes(t);
}

export type VerdictStatRow = { verdictType: string; sentenceYears: number };

export interface VerdictStats {
  pretrialCount: number;
  /** "Vádemelve vagy elítélve" — minden aktív (nem kiengedett/lezárt) ÉS nem előzetesben lévő sor. */
  nonPretrialCount: number;
  jogerosCount: number;
  totalYears: number;
  releasedCount: number;
}

/**
 * Ugyanaz a hármas partíció, amiből computeVerdictStats() alább a számokat
 * képezi — kiemelve, hogy a LISTA csoportosítása (VerdictList.tsx) is
 * ebből az egyetlen forrásból jöjjön.
 *
 * 2026-09-09 user kérés: az "Előzetesben van" és a "Vádemelve vagy elítélve"
 * stat-doboz külön-külön listához görget, nem egy közös "eljárás alatt"
 * szekcióhoz. Ha a lista a feltételt saját kezűleg ismételné meg
 * (`r.verdictType === 'előzetesben'` stb.), a doboz SZÁMA és a hozzá
 * görgetett LISTA hossza némán elcsúszhatna egymástól, amint a besorolás
 * változik — pontosan az a hibaosztály, ami ellen ez a modul 2026-08-02-ben
 * kiemelésre került. A verdict-stats.test.ts invariánsa mindkettőt egyszerre
 * védi.
 */
export function partitionVerdicts<T extends VerdictStatRow>(rows: T[]): {
  pretrial: T[];
  charged: T[];
  released: T[];
} {
  const pretrial: T[] = [];
  const charged: T[] = [];
  const released: T[] = [];
  for (const r of rows) {
    if (isReleased(r.verdictType)) released.push(r);
    else if (r.verdictType === 'előzetesben') pretrial.push(r);
    else charged.push(r);
  }
  return { pretrial, charged, released };
}

export function computeVerdictStats(rows: VerdictStatRow[]): VerdictStats {
  const active = rows.filter(r => !isReleased(r.verdictType));
  const released = rows.filter(r => isReleased(r.verdictType));
  const nonPretrial = active.filter(r => r.verdictType !== 'előzetesben');
  return {
    pretrialCount: active.filter(r => r.verdictType === 'előzetesben').length,
    nonPretrialCount: nonPretrial.length,
    jogerosCount: nonPretrial.filter(r => r.verdictType === 'jogerős').length,
    totalYears: nonPretrial.reduce((s, r) => s + r.sentenceYears, 0),
    releasedCount: released.length,
  };
}
