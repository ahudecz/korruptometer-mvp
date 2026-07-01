import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { normalizeName, namesOverlap } from '../../src/lib/investigation/normalize-name';

describe('normalize-name (T014 prereq, research.md §4)', () => {
  it('strips accents and lowercases', () => {
    expect(normalizeName('Kovács László')).toBe('kovacs laszlo');
    expect(normalizeName('Bíró Áron')).toBe('biro aron');
  });

  it('strips Hungarian honorifics: dr., id., ifj.', () => {
    expect(normalizeName('dr. Kovács László')).toBe('kovacs laszlo');
    expect(normalizeName('Id. Nagy János')).toBe('nagy janos');
    expect(normalizeName('ifj. Tóth Pál')).toBe('toth pal');
  });

  it('strips multiple stacked honorifics', () => {
    expect(normalizeName('dr. id. Nagy János')).toBe('nagy janos');
  });

  it('does not strip a word that merely starts with the honorific letters', () => {
    expect(normalizeName('Drágh László')).toBe('dragh laszlo');
  });

  it('handles empty and null input safely', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('namesOverlap (research.md §4)', () => {
  it('returns the count of names present in both arrays', () => {
    expect(namesOverlap(['a', 'b'], ['b', 'c'])).toBe(1);
    expect(namesOverlap(['a', 'b', 'c'], ['b', 'c', 'd'])).toBe(2);
    expect(namesOverlap([], ['x'])).toBe(0);
  });
});

/**
 * The orphan-cleanup Inngest function is exercised end-to-end against a
 * real Postgres instance (see quickstart.md §1). The unit tests above
 * cover the deterministic helpers that feed into the cleanup SQL; the
 * janitor's SQL itself is one statement and is best validated by an
 * integration run.
 */
