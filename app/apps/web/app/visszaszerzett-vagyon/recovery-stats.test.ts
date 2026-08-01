import { describe, expect, it } from 'vitest';
import { computeRecoveryTotal, type RecoveryStatRow } from './recovery-stats';

describe('computeRecoveryTotal', () => {
  it('sums every row unconditionally — no category can be silently excluded', () => {
    const rows: RecoveryStatRow[] = [
      { amountFt: 1_000_000_000n },
      { amountFt: 2_500_000_000n },
      { amountFt: 0n },
    ];
    expect(computeRecoveryTotal(rows)).toBe(3_500_000_000n);
  });

  it('returns 0n for an empty table (still-pending state)', () => {
    expect(computeRecoveryTotal([])).toBe(0n);
  });
});
