import { describe, expect, it } from 'vitest';
import {
  computeComplaintBarMax,
  computeComplaintTotal,
  parseComplaintAmountFt,
  COMPLAINT_BAR_BASE_FT,
  COMPLAINT_BAR_JUMPED_FT,
} from './complaint-stats';

describe('parseComplaintAmountFt', () => {
  it('parses a plain "milliárd Ft" label', () => {
    expect(parseComplaintAmountFt('59 milliárd Ft')).toBe(59_000_000_000n);
  });

  it('parses a plain "millió Ft" label', () => {
    expect(parseComplaintAmountFt('800 millió Ft')).toBe(800_000_000n);
  });

  it('parses a Hungarian decimal comma', () => {
    expect(parseComplaintAmountFt('1,52 milliárd Ft')).toBe(1_520_000_000n);
  });

  it('ignores a leading "~" (approximation marker)', () => {
    expect(parseComplaintAmountFt('~400 milliárd Ft')).toBe(400_000_000_000n);
  });

  it('ignores a trailing "felett" (lower-bound marker)', () => {
    expect(parseComplaintAmountFt('100 milliárd Ft felett')).toBe(100_000_000_000n);
  });

  it('sums every tétel in a compound label', () => {
    expect(parseComplaintAmountFt('2,8 milliárd Ft (informatikai rendszer) + 4,6 milliárd Ft (üzemeltetés)'))
      .toBe(7_400_000_000n);
  });

  it('recognizes the word "félmilliárd" as 0,5 milliárd', () => {
    expect(parseComplaintAmountFt('félmilliárd Ft')).toBe(500_000_000n);
  });

  it('returns 0 for null/empty/no-figure labels — never throws, never guesses', () => {
    expect(parseComplaintAmountFt(null)).toBe(0n);
    expect(parseComplaintAmountFt('')).toBe(0n);
    expect(parseComplaintAmountFt('nincs megjelölt összeg')).toBe(0n);
  });
});

describe('computeComplaintTotal', () => {
  it('sums parsed amounts across rows, skipping rows without a figure', () => {
    const rows = [
      { amountLabel: '25 milliárd Ft' },
      { amountLabel: null },
      { amountLabel: '270 millió Ft' },
    ];
    expect(computeComplaintTotal(rows)).toBe(25_270_000_000n);
  });

  it('a new complaint with no amount does not change the total', () => {
    const before = computeComplaintTotal([{ amountLabel: '10 milliárd Ft' }]);
    const after = computeComplaintTotal([{ amountLabel: '10 milliárd Ft' }, { amountLabel: null }]);
    expect(after).toBe(before);
  });
});

describe('computeComplaintBarMax', () => {
  it('stays at the 1000 milliárd Ft base below the threshold', () => {
    expect(computeComplaintBarMax(999_999_999_999n)).toBe(COMPLAINT_BAR_BASE_FT);
  });

  it('jumps to 5000 milliárd Ft once the total reaches 1000 milliárd Ft', () => {
    expect(computeComplaintBarMax(COMPLAINT_BAR_BASE_FT)).toBe(COMPLAINT_BAR_JUMPED_FT);
    expect(computeComplaintBarMax(1_458_340_000_000n)).toBe(COMPLAINT_BAR_JUMPED_FT);
  });
});
