import { describe, expect, it } from 'vitest';
import { computeVerdictStats, isReleased, type VerdictStatRow } from './verdict-stats';

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

  it('isReleased recognizes exactly the 3 closed-case types', () => {
    expect(isReleased('szabadlábra helyezve')).toBe(true);
    expect(isReleased('eljárás megszűnt')).toBe(true);
    expect(isReleased('felmentve')).toBe(true);
    expect(isReleased('jogerős')).toBe(false);
    expect(isReleased('előzetesben')).toBe(false);
  });
});
