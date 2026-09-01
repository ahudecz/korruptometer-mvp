import { describe, expect, it } from 'vitest';
import { amountFontSize, computeNextMilestone, formatMilliardLabel, formatMilliardLabelShort, MILESTONE_STEP_FT } from './social-milestone';

describe('computeNextMilestone', () => {
  it('returns null below the first threshold', () => {
    expect(computeNextMilestone(999_999_999_999n, 0n)).toBeNull();
  });

  it('returns the crossed threshold when reaching exactly 1000 Mrd', () => {
    expect(computeNextMilestone(MILESTONE_STEP_FT, 0n)).toBe(MILESTONE_STEP_FT);
  });

  it('floors to the nearest 1000 Mrd, not the exact total', () => {
    expect(computeNextMilestone(2_593_200_000_000n, 0n)).toBe(2_000_000_000_000n);
  });

  it('returns null if the threshold was already posted/queued', () => {
    expect(computeNextMilestone(2_593_200_000_000n, 2_000_000_000_000n)).toBeNull();
  });

  it('returns the new threshold once the total crosses into the next 1000 Mrd band', () => {
    expect(computeNextMilestone(3_021_000_000_000n, 2_000_000_000_000n)).toBe(3_000_000_000_000n);
  });

  it('returns null for zero/negative totals', () => {
    expect(computeNextMilestone(0n, 0n)).toBeNull();
  });
});

describe('formatMilliardLabel', () => {
  it('formats a round milliárd amount', () => {
    expect(formatMilliardLabel(3_000_000_000_000n)).toBe('3000 milliárd Ft');
  });
});

describe('formatMilliardLabelShort', () => {
  it('formats a round milliárd amount with the compact "Mrd" unit', () => {
    expect(formatMilliardLabelShort(2_000_000_000_000n)).toBe('2000 Mrd Ft');
  });
});

describe('amountFontSize', () => {
  it('gives a shorter label a bigger font than a longer one', () => {
    const shortSize = amountFontSize('500 milliárd Ft');
    const longSize = amountFontSize('10000 milliárd Ft');
    expect(shortSize).toBeGreaterThan(longSize);
  });

  it('stays within the sane min/max clamp', () => {
    expect(amountFontSize('1 Ft')).toBeLessThanOrEqual(140);
    expect(amountFontSize('123456789012345678901234567890 milliárd Ft')).toBeGreaterThanOrEqual(70);
  });
});
