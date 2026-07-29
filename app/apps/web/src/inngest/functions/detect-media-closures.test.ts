import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { CLOSURE_KEYWORDS, coerceClosureEventType } from './detect-media-closures';

function matchesKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return CLOSURE_KEYWORDS.some((kw) => lower.includes(kw));
}

describe('CLOSURE_KEYWORDS pre-filter', () => {
  it('catches closure/shutdown phrasing', () => {
    expect(matchesKeywords('Megszűnt a lap')).toBe(true);
    expect(matchesKeywords('Bezár a szerkesztőség')).toBe(true);
    expect(matchesKeywords('Felszámolják a csatornát')).toBe(true);
  });

  it('catches layoff phrasing', () => {
    expect(matchesKeywords('Tömeges elbocsátás a portálnál')).toBe(true);
    expect(matchesKeywords('Leépítés a médiumnál')).toBe(true);
  });

  it('catches suspended/cancelled-event phrasing', () => {
    expect(matchesKeywords('Felfüggesztik a műsort')).toBe(true);
    expect(matchesKeywords('Elmarad a mai adás')).toBe(true);
  });

  it('does not match unrelated headlines', () => {
    expect(matchesKeywords('Megnyílt egy új étterem a belvárosban')).toBe(false);
  });
});

describe('coerceClosureEventType', () => {
  it('passes through exact valid values', () => {
    expect(coerceClosureEventType('megszűnés')).toBe('megszűnés');
    expect(coerceClosureEventType('leépítés')).toBe('leépítés');
    expect(coerceClosureEventType('elmaradt esemény')).toBe('elmaradt esemény');
  });

  it('repairs a truncated streamed value by prefix match', () => {
    expect(coerceClosureEventType('megszűné')).toBe('megszűnés');
  });

  it('falls back to egyéb for an unrecognizable value instead of throwing', () => {
    expect(coerceClosureEventType('teljesen ismeretlen érték')).toBe('egyéb');
  });
});
