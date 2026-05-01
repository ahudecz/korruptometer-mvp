import { describe, expect, it } from 'vitest';

import { canonicalUrl, dedupHash } from './canonicalize';

describe('canonicalUrl', () => {
  it('upgrades scheme to https', () => {
    expect(canonicalUrl('http://telex.hu/foo')).toBe('https://telex.hu/foo');
  });

  it('lowercases the host and strips leading www', () => {
    expect(canonicalUrl('https://WWW.Telex.hu/Foo')).toBe('https://telex.hu/Foo');
  });

  it('drops the fragment', () => {
    expect(canonicalUrl('https://telex.hu/foo#bar')).toBe('https://telex.hu/foo');
  });

  it('strips trailing slash on non-root paths', () => {
    expect(canonicalUrl('https://telex.hu/foo/')).toBe('https://telex.hu/foo');
    expect(canonicalUrl('https://telex.hu/')).toBe('https://telex.hu/');
  });

  it('strips share-tracking params by default', () => {
    expect(
      canonicalUrl('https://hvg.hu/itthon/cikk?utm_source=fb&utm_medium=share'),
    ).toBe('https://hvg.hu/itthon/cikk');
  });

  it('keeps allowlisted params and sorts them for stable hashing', () => {
    const a = canonicalUrl(
      'https://atlatszo.hu/cikk?page=2&utm_source=x&id=42',
      ['page', 'id'],
    );
    const b = canonicalUrl(
      'https://atlatszo.hu/cikk?id=42&page=2',
      ['page', 'id'],
    );
    expect(a).toBe(b);
    expect(a).toBe('https://atlatszo.hu/cikk?id=42&page=2');
  });

  it('throws on invalid input', () => {
    expect(() => canonicalUrl('not a url')).toThrow();
  });
});

describe('dedupHash', () => {
  it('is stable for the same canonical input', () => {
    const a = canonicalUrl('https://telex.hu/foo?utm_source=tw#x');
    const b = canonicalUrl('http://www.telex.hu/foo/');
    expect(dedupHash(a)).toBe(dedupHash(b));
  });

  it('is sha256 hex (64 chars)', () => {
    const h = dedupHash('https://telex.hu/foo');
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});
