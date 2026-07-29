import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { ASSET_KEYWORDS } from './detect-asset-recoveries';

function matchesKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return ASSET_KEYWORDS.some((kw) => lower.includes(kw));
}

describe('ASSET_KEYWORDS pre-filter', () => {
  it('catches repayment/recovery phrasing', () => {
    expect(matchesKeywords('Visszafizette a támogatást')).toBe(true);
    expect(matchesKeywords('Visszaszerezték a közpénzt')).toBe(true);
    expect(matchesKeywords('Vagyonelkobzást rendelt el a bíróság')).toBe(true);
  });

  it('catches fine/compensation phrasing', () => {
    expect(matchesKeywords('Kártérítést fizet az önkormányzat')).toBe(true);
    expect(matchesKeywords('Bírságot szabtak ki a cégre')).toBe(true);
    expect(matchesKeywords('Kompenzációt ígértek az érintetteknek')).toBe(true);
  });

  it('catches public-funds terminology', () => {
    expect(matchesKeywords('Közpénzből fedezték a költségeket')).toBe(true);
    expect(matchesKeywords('Vagyoni kár keletkezett az ügyben')).toBe(true);
  });

  it('does not match unrelated headlines', () => {
    expect(matchesKeywords('Megnyílt egy új étterem a belvárosban')).toBe(false);
  });
});
