import { describe, expect, it } from 'vitest';
import { computeVerdictStats, countActualVerdicts, isActualVerdict, isReleased, partitionVerdicts, type VerdictStatRow } from './verdict-stats';

// Forrás: supabase/migrations/0050_court_verdict_type_check.sql — a
// verdictType oszlop szabad text, ez a CHECK constraint az egyetlen hely,
// ahol az érvényes 8 érték fel van sorolva. Ha ez a migráció bővül, ezt a
// listát (és minden itt épülő invariánst) frissíteni kell.
const ALL_TYPES = [
  'előzetesben', 'elsőfokú', 'jogerős', 'vádemelés',
  'szabadlábra helyezve', 'eljárás megszűnt', 'felmentve', 'egyéb',
];

describe('computeVerdictStats', () => {
  it('every CHECK-constraint verdictType lands in exactly one of {pretrial, released, active-verdict}', () => {
    for (const type of ALL_TYPES) {
      const rows: VerdictStatRow[] = [{ verdictType: type, sentenceYears: 0 }];
      const stats = computeVerdictStats(rows);
      const buckets = [
        stats.pretrialCount === 1,
        stats.releasedCount === 1,
        stats.nonPretrialCount === 1,
      ].filter(Boolean).length;
      expect(buckets, `verdictType "${type}" must land in exactly one bucket`).toBe(1);
    }
  });

  it('totalYears only sums non-pretrial, non-released rows (a released person\'s old sentence should not inflate "kiszabott börtönév")', () => {
    const rows: VerdictStatRow[] = [
      { verdictType: 'jogerős', sentenceYears: 5 },
      { verdictType: 'előzetesben', sentenceYears: 0 },
      { verdictType: 'szabadlábra helyezve', sentenceYears: 3 },
    ];
    expect(computeVerdictStats(rows).totalYears).toBe(5);
  });

  // 2026-09-09: a stat-dobozok külön listához görgetnek, ezért a lista
  // csoportosításának BIT-RE egyeznie kell a dobozok számaival — enélkül a
  // "14 előzetesben" doboz egy 13 elemű listához vihetne.
  it('partitionVerdicts buckets match computeVerdictStats counts for every CHECK-constraint type', () => {
    for (const type of ALL_TYPES) {
      const rows: VerdictStatRow[] = [{ verdictType: type, sentenceYears: 0 }];
      const stats = computeVerdictStats(rows);
      const { pretrial, charged, released } = partitionVerdicts(rows);
      expect(pretrial.length, `pretrial mismatch for "${type}"`).toBe(stats.pretrialCount);
      expect(charged.length, `charged mismatch for "${type}"`).toBe(stats.nonPretrialCount);
      expect(released.length, `released mismatch for "${type}"`).toBe(stats.releasedCount);
    }
  });

  it('partitionVerdicts puts every row in exactly one bucket and loses none', () => {
    const rows: VerdictStatRow[] = ALL_TYPES.map(t => ({ verdictType: t, sentenceYears: 1 }));
    const { pretrial, charged, released } = partitionVerdicts(rows);
    expect(pretrial.length + charged.length + released.length).toBe(rows.length);
  });

  it('isReleased recognizes exactly the 3 closed-case types', () => {
    expect(isReleased('szabadlábra helyezve')).toBe(true);
    expect(isReleased('eljárás megszűnt')).toBe(true);
    expect(isReleased('felmentve')).toBe(true);
    expect(isReleased('jogerős')).toBe(false);
    expect(isReleased('előzetesben')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2026-09-16 — a Facebook tartalék-poszt (summary_stats) nyers count(*)-ot
// írt ki "jogerős/elsőfokú ítélet" címkével. Ugyanez a hibaosztály háromszor
// ment ki élesre; ez a teszt zárja le, a CHECK constraint mind a 8 értékére.
// ---------------------------------------------------------------------------

describe('countActualVerdicts', () => {
  it('a 8 verdictType közül PONTOSAN kettő számít ítéletnek', () => {
    const actual = ALL_TYPES.filter(isActualVerdict);
    expect(actual).toEqual(['elsőfokú', 'jogerős']);
  });

  it('a teljes tábla nyers hossza SOSEM az ítéletek száma', () => {
    const rows = ALL_TYPES.map((verdictType) => ({ verdictType }));
    expect(countActualVerdicts(rows)).toBe(2);
    expect(countActualVerdicts(rows)).not.toBe(rows.length);
  });

  // A konkrét élesre kiment eset: csupa előzetes/vádemelés/gyanúsítás, egy
  // ítélet sem — a poszt mégis "21 jogerős/elsőfokú ítéletet" írt.
  it('ítélet nélküli táblára 0-t ad', () => {
    const rows = [
      { verdictType: 'előzetesben' }, { verdictType: 'előzetesben' },
      { verdictType: 'vádemelés' }, { verdictType: 'egyéb' },
      { verdictType: 'szabadlábra helyezve' },
    ];
    expect(countActualVerdicts(rows)).toBe(0);
  });

  it('a kiengedett elítéltet is számolja (az ítélet attól még megszületett)', () => {
    expect(countActualVerdicts([{ verdictType: 'jogerős' }, { verdictType: 'elsőfokú' }])).toBe(2);
  });
});
