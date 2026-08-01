// Egyetlen forrás a "/birosagi-iteletek" (VerdictList.tsx) stat-sorára.
// A verdictType oszlop szabad `text`, DB-szinten a
// supabase/migrations/0050_court_verdict_type_check.sql CHECK constraint-je
// zárja le a 8 érvényes értékre — az alábbi lista ONNAN származik, ott KELL
// frissíteni, ha egy új verdictType kerül be (l. verdict-stats.test.ts,
// ami minden itt felsorolt értékre lefuttatja az invariánst).
//
// A partíció itt már eleve KIZÁRÁS-alapú (RELEASED_TYPES + 'előzetesben'
// NEM ez, a többi IGEN "Ítélet összesen") — ez a minta 2026-08-02 előtt is
// helyes volt, ezt a modult csak a resignation-stats.ts / media-closure-
// stats.ts mintájának megfelelően emeltük ki tesztelhető, önálló fájlba.

export const RELEASED_TYPES = ['szabadlábra helyezve', 'eljárás megszűnt', 'felmentve'] as const;
export type ReleasedType = (typeof RELEASED_TYPES)[number];

export function isReleased(t: string): t is ReleasedType {
  return (RELEASED_TYPES as readonly string[]).includes(t);
}

export type VerdictStatRow = { verdictType: string; sentenceYears: number };

export interface VerdictStats {
  pretrialCount: number;
  /** "Ítélet összesen" — minden aktív (nem kiengedett/lezárt) ÉS nem előzetesben lévő sor. */
  nonPretrialCount: number;
  jogerosCount: number;
  totalYears: number;
  releasedCount: number;
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
