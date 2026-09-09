import { describe, expect, it } from 'vitest';
import {
  complaintHeadline,
  hookFor,
  looksLikeCrimeDescription,
  pickBySeed,
  resignationHeadline,
  truncateAtWordBoundary,
} from './social-copy-variety';

describe('pickBySeed', () => {
  it('is deterministic for the same seed', () => {
    const options = ['a', 'b', 'c', 'd'];
    const first = pickBySeed('same-seed', options);
    const second = pickBySeed('same-seed', options);
    expect(first).toBe(second);
  });

  it('always returns one of the given options', () => {
    const options = ['a', 'b', 'c'];
    for (const seed of ['x', 'y', 'z', 'abc-123', '']) {
      expect(options).toContain(pickBySeed(seed, options));
    }
  });
});

describe('hookFor', () => {
  it('returns a deterministic hook for a known trigger type', () => {
    const a = hookFor('resignation', 'record-1');
    const b = hookFor('resignation', 'record-1');
    expect(a).toBe(b);
    expect(typeof a).toBe('string');
  });

  it('returns undefined for a trigger type with no hook pool (e.g. summary_stats)', () => {
    expect(hookFor('summary_stats', 'record-1')).toBeUndefined();
    expect(hookFor('complaint_milestone', 'record-1')).toBeUndefined();
  });
});

describe('resignationHeadline', () => {
  it('maps known resignation types to their verb', () => {
    expect(resignationHeadline('Kovács János', 'lemondás')).toBe('Kovács János: lemondott!');
    expect(resignationHeadline('Kovács János', 'kirúgás')).toBe('Kovács János: kirúgták!');
    expect(resignationHeadline('Kovács János', 'felmentés')).toBe('Kovács János: felmentették!');
    expect(resignationHeadline('Kovács János', 'visszahívás')).toBe('Kovács János: visszahívták!');
  });

  it('falls back to "távozott!" for an unknown resignation type', () => {
    expect(resignationHeadline('Kovács János', 'egyéb')).toBe('Kovács János: távozott!');
  });
});

describe('looksLikeCrimeDescription', () => {
  it('flags crime/procedure descriptions, not entity names', () => {
    expect(looksLikeCrimeDescription('hűtlen kezelés gyanúja')).toBe(true);
    expect(looksLikeCrimeDescription('költségvetési csalás gyanúja miatt')).toBe(true);
    expect(looksLikeCrimeDescription('sikkasztás ügyében')).toBe(true);
  });

  it('does not flag a real institution/person name', () => {
    expect(looksLikeCrimeDescription("Waberer's")).toBe(false);
    expect(looksLikeCrimeDescription('Magyar Nemzeti Bank')).toBe(false);
    expect(looksLikeCrimeDescription('Tiborcz István')).toBe(false);
  });
});

describe('complaintHeadline', () => {
  it('uses the "ellen" form when targetEntity is a real name', () => {
    expect(complaintHeadline('Hadházy Ákos', "Waberer's", 'MFB 77 milliárdos kötvényvásárlása a Waberer\'s-től'))
      .toBe("Hadházy Ákos feljelentést tett Waberer's ellen");
  });

  it('falls back to the colon form when targetEntity is a crime description, not a name', () => {
    // 2026-09-08 user report — this exact case shipped ungrammatically.
    expect(complaintHeadline('X.Y.', 'hűtlen kezelés gyanúja', 'Az önkormányzat vezetése elleni feljelentés'))
      .toBe('X.Y. feljelentést tett: Az önkormányzat vezetése elleni feljelentés');
  });

  it('falls back to the colon form when targetEntity is missing', () => {
    expect(complaintHeadline('X.Y.', null, 'Ismeretlen tettes elleni feljelentés'))
      .toBe('X.Y. feljelentést tett: Ismeretlen tettes elleni feljelentés');
    expect(complaintHeadline('X.Y.', undefined, 'Ismeretlen tettes elleni feljelentés'))
      .toBe('X.Y. feljelentést tett: Ismeretlen tettes elleni feljelentés');
    expect(complaintHeadline('X.Y.', '', 'Ismeretlen tettes elleni feljelentés'))
      .toBe('X.Y. feljelentést tett: Ismeretlen tettes elleni feljelentés');
  });
});

describe('truncateAtWordBoundary', () => {
  it('returns the original text unchanged when it already fits', () => {
    expect(truncateAtWordBoundary('Rövid mondat.', 200)).toBe('Rövid mondat.');
  });

  it('never cuts in the middle of a word — 2026-09-08 live bug ("...rejtélyes befekte…")', () => {
    const intro =
      'Nézzük, mennyit tudsz az MNB-alapítványi botrányról — a Matolcsy-kör körüli ügyről, amiben eddig kiderült sztorik szerint milliárdok tűntek el nyomtalanul, rejtélyes befektetésekben és külföldi kitérőkön. 10 kérdés — nagy meglepetések, kezdjük!';
    const result = truncateAtWordBoundary(intro, 197)!;
    // The old `.slice(0, 197) + '…'` produced "...rejtélyes befekte…" — a
    // word cut in half. The fix must always end on a whole word.
    expect(result.endsWith('…')).toBe(true);
    const withoutEllipsis = result.slice(0, -1);
    const lastWord = withoutEllipsis.trim().split(/\s+/).pop()!;
    expect(intro).toContain(lastWord);
    expect(result).not.toContain('befekte…');
  });

  it('returns undefined for empty/whitespace/missing input', () => {
    expect(truncateAtWordBoundary('', 50)).toBeUndefined();
    expect(truncateAtWordBoundary('   ', 50)).toBeUndefined();
    expect(truncateAtWordBoundary(null, 50)).toBeUndefined();
    expect(truncateAtWordBoundary(undefined, 50)).toBeUndefined();
  });

  it('never exceeds maxChars (plus the ellipsis)', () => {
    const long = 'a'.repeat(50) + ' ' + 'b'.repeat(50) + ' ' + 'c'.repeat(50);
    const result = truncateAtWordBoundary(long, 60)!;
    expect(result.length).toBeLessThanOrEqual(61);
  });
});
