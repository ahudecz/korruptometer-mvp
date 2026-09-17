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

/**
 * TÉNYLEGES ÍTÉLET — a 8 verdictType közül csak kettő az.
 *
 * 2026-09-16, a leltárból: a Facebook tartalék-poszt (summary_stats,
 * check-social-triggers.ts) nyers `count(*)`-ot írt ki a CourtVerdict
 * táblából "jogerős/elsőfokú ítélet" címkével — vagyis az előzetesben lévők,
 * a vádemelések, a kiengedettek és a gyanúsítottak is "ítéletnek" számítottak.
 * Ez a hibaosztály HÁROMSZOR ment ki élesre (l. [[project-verdict-label-conflation]]),
 * legutóbb egy FB-poszton "21 jogerős/elsőfokú ítélet" — miközben a valós
 * szám 0 volt.
 *
 * A facebook-content-brief.md 11. pontja külön kimondja: az őrizet, az
 * előzetes, a vádemelés és az ítélet NEM szinonimák. Ezért a számláló innen,
 * EGY helyről jön, és nem a hívó oldalon ismétlődik meg a feltétel.
 */
/**
 * VÁDEMELVE VAGY ELÍTÉLVE — engedélyező lista, nem „minden más".
 *
 * 2026-09-17, user report: „ott van benne Pilz Tamás, akit csak
 * gyanúsítanak." Igaza volt, és ez nem egyedi eset, hanem a partíció
 * szerkezetéből következett: a `charged` kupac KIZÁRÁS-alapú volt (ami nem
 * kiengedett és nem előzetes, az ide esett), így az 'egyéb' — vagyis a
 * puszta gyanúsítás — is a legsúlyosabb nevű szakaszba került.
 *
 * Az engedélyező lista ezt a hibaosztályt szünteti meg: ha egy kilencedik
 * verdictType kerül a CHECK constraintbe, az NEM a vádemelés/ítélet
 * szakaszba csúszik be némán, hanem a semleges „gyanúsítás, eljárás alatt"
 * kupacba. Ugyanaz a tanulság, mint az [[project-verdict-label-conflation]]
 * háromszor kiment hibájánál: a címke sose legyen súlyosabb a ténynél.
 */
export const CHARGED_TYPES = ['vádemelés', 'elsőfokú', 'jogerős'] as const;
export type ChargedType = (typeof CHARGED_TYPES)[number];

export function isCharged(t: string): t is ChargedType {
  return (CHARGED_TYPES as readonly string[]).includes(t);
}

export const ACTUAL_VERDICT_TYPES = ['elsőfokú', 'jogerős'] as const;
export type ActualVerdictType = (typeof ACTUAL_VERDICT_TYPES)[number];

export function isActualVerdict(t: string): t is ActualVerdictType {
  return (ACTUAL_VERDICT_TYPES as readonly string[]).includes(t);
}

/** Hány soron született TÉNYLEGES (első- vagy jogerős fokú) ítélet. */
export function countActualVerdicts(rows: Array<{ verdictType: string }>): number {
  return rows.filter((r) => isActualVerdict(r.verdictType)).length;
}

export type VerdictStatRow = { verdictType: string; sentenceYears: number };

export interface VerdictStats {
  pretrialCount: number;
  /** "Vádemelve vagy elítélve" — CSAK vádemelés / elsőfokú / jogerős (l. CHARGED_TYPES). */
  nonPretrialCount: number;
  /** "Gyanúsítás, eljárás alatt" — se nem kiengedett, se nem előzetes, se nem vádemelt. */
  suspectedCount: number;
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
  suspected: T[];
  released: T[];
} {
  const pretrial: T[] = [];
  const charged: T[] = [];
  const suspected: T[] = [];
  const released: T[] = [];
  for (const r of rows) {
    if (isReleased(r.verdictType)) released.push(r);
    else if (r.verdictType === 'előzetesben') pretrial.push(r);
    else if (isCharged(r.verdictType)) charged.push(r);
    // Minden maradék (ma: 'egyéb') a semleges kupacba — l. CHARGED_TYPES.
    else suspected.push(r);
  }
  return { pretrial, charged, suspected, released };
}

export function computeVerdictStats(rows: VerdictStatRow[]): VerdictStats {
  // A számok UGYANEBBŐL a partícióból jönnek, mint a lista csoportjai —
  // enélkül a doboz száma és a hozzá görgetett lista hossza elcsúszhatna.
  const { pretrial, charged, suspected, released } = partitionVerdicts(rows);
  return {
    pretrialCount: pretrial.length,
    nonPretrialCount: charged.length,
    suspectedCount: suspected.length,
    jogerosCount: charged.filter(r => r.verdictType === 'jogerős').length,
    // Börtönév csak ítéletes soron lehet (l. verdict-gate.ts
    // coerceSentenceToVerdictType), de a szűkítés itt is explicit.
    totalYears: charged.reduce((s, r) => s + r.sentenceYears, 0),
    releasedCount: released.length,
  };
}
