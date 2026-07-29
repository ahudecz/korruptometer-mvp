import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { coerceResignationType, coerceSector, RESIGNATION_KEYWORDS } from './detect-resignations';

function matchesKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return RESIGNATION_KEYWORDS.some((kw) => lower.includes(kw));
}

describe('RESIGNATION_KEYWORDS pre-filter', () => {
  // 2026-07-16 — the exact real-world miss that prompted the current
  // keyword list (see the file header comment): this headline reached
  // neither the old nor a naive keyword list because none of the obvious
  // "lemond"/"kirúg"/"felment" stems appear in it.
  it('catches the Pósfai Gábor "cserélt le" miss (2026-07-16 user report)', () => {
    expect(matchesKeywords('Rendészeti vezetőket cserélt le Pósfai Gábor belügyminiszter')).toBe(true);
  });

  it('catches plain lemondás/kirúgás/felmentés headlines', () => {
    expect(matchesKeywords('Lemondott a polgármester')).toBe(true);
    expect(matchesKeywords('Kirúgták az igazgatót')).toBe(true);
    expect(matchesKeywords('Felmentették a rendőrkapitányt')).toBe(true);
  });

  it('catches every kirúgás-szinonima the user supplied on 2026-07-16', () => {
    expect(matchesKeywords('Elbocsátották a vezérigazgatót')).toBe(true);
    expect(matchesKeywords('Felmondtak neki a cégnél')).toBe(true);
    expect(matchesKeywords('Megválás a klub vezetőjétől')).toBe(true);
    expect(matchesKeywords('Megszüntették a munkaviszonyát')).toBe(true);
    expect(matchesKeywords('Állásvesztéssel járt az ügy')).toBe(true);
    expect(matchesKeywords('Eltanácsolták a posztról')).toBe(true);
    expect(matchesKeywords('Hivatalvesztésre ítélték')).toBe(true);
    expect(matchesKeywords('Eltávolították a testületből')).toBe(true);
  });

  it('does not match unrelated headlines', () => {
    expect(matchesKeywords('Megnyílt egy új étterem a belvárosban')).toBe(false);
  });
});

describe('coerceResignationType', () => {
  it('passes through exact valid values', () => {
    expect(coerceResignationType('lemondás')).toBe('lemondás');
    expect(coerceResignationType('kirúgás')).toBe('kirúgás');
    expect(coerceResignationType('felmentés')).toBe('felmentés');
    expect(coerceResignationType('egyéb')).toBe('egyéb');
  });

  it('repairs a truncated streamed value by prefix match', () => {
    expect(coerceResignationType('lemond')).toBe('lemondás');
  });

  it('falls back to egyéb for an unrecognizable value instead of throwing', () => {
    expect(coerceResignationType('teljesen ismeretlen érték')).toBe('egyéb');
  });
});

describe('coerceSector', () => {
  it('passes through an exact valid sector', () => {
    expect(coerceSector('média')).toBe('média');
    expect(coerceSector('közigazgatás')).toBe('közigazgatás');
  });

  it('falls back to egyéb for an unrecognizable value instead of throwing', () => {
    expect(coerceSector('nem létező szektor')).toBe('egyéb');
  });
});
