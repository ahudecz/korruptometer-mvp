import { describe, expect, it } from 'vitest';

import { fmtDate, fmtFt, fmtNumber, initials } from './format';

describe('fmtFt magnitude buckets', () => {
  it('renders sub-thousand amounts in plain Ft', () => {
    expect(fmtFt(0)).toBe('0 Ft');
    expect(fmtFt(999)).toBe('999 Ft');
  });

  it('switches to e Ft at 1 000', () => {
    expect(fmtFt(1_000)).toBe('1 e Ft');
    expect(fmtFt(999_999)).toBe('999 e Ft');
  });

  it('switches to M Ft at 1 000 000', () => {
    expect(fmtFt(1_000_000)).toBe('1 M Ft');
    expect(fmtFt(850_000_000)).toBe('850 M Ft');
    expect(fmtFt(999_999_999)).toBe('999 M Ft');
  });

  it('switches to Mrd Ft at 1 000 000 000 with one Hungarian decimal', () => {
    expect(fmtFt(1_000_000_000)).toBe('1 Mrd Ft');
    expect(fmtFt(4_200_000_000)).toBe('4,2 Mrd Ft');
    expect(fmtFt(12_500_000_000)).toBe('12,5 Mrd Ft');
  });

  it('accepts bigint inputs', () => {
    expect(fmtFt(4_200_000_000n)).toBe('4,2 Mrd Ft');
  });
});

describe('fmtNumber', () => {
  it('uses Hungarian thousand separators', () => {
    expect(fmtNumber(1234567)).toMatch(/1.234.567/);
  });
});

describe('fmtDate', () => {
  it('formats a date with the hu-HU locale (year-month-day)', () => {
    const out = fmtDate(new Date(Date.UTC(2024, 0, 15)));
    expect(out).toMatch(/2024/);
    expect(out).toMatch(/01/);
    expect(out).toMatch(/15/);
  });
});

describe('initials', () => {
  it('takes first + last initial', () => {
    expect(initials('K. Zoltán')).toBe('KZ');
    expect(initials('S. Péter')).toBe('SP');
  });

  it('falls back to first two characters for single-token names', () => {
    expect(initials('Madonna')).toBe('MA');
  });

  it('handles empty input', () => {
    expect(initials('')).toBe('');
  });
});
