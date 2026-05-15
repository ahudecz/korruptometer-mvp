import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  parseKMonitorTagIndex,
  parseKMonitorTagPage,
} from './kmonitor-discovery';
import { routeOutletByUrl } from './adapters';
import { parseDate } from './parse';

const FIXTURES = join(__dirname, '..', '__fixtures__', 'kmonitor');

async function fixture(name: string) {
  return readFile(join(FIXTURES, name), 'utf-8');
}

describe('parseKMonitorTagIndex (FR-076)', () => {
  it('enumerates tag slugs from /hirek without one-segment-or-deeper false positives', async () => {
    const html = await fixture('hirek-index.html');
    const { tagSlugs } = parseKMonitorTagIndex(html);

    expect(tagSlugs.length).toBeGreaterThan(50);
    for (const slug of tagSlugs) {
      expect(slug).not.toContain('/');
      expect(slug).not.toContain('?');
      expect(slug).not.toContain('#');
      expect(slug.length).toBeGreaterThan(0);
    }
    expect(tagSlugs).toContain('fidesz');
    expect(tagSlugs).toContain('lounge-design-kft');
    expect(tagSlugs).toContain('nav-vizsgalat');
  });
});

describe('parseKMonitorTagPage (FR-078, FR-079)', () => {
  const tags = [
    { slug: 'nav-vizsgalat', fixture: 'tag-nav-vizsgalat.html', hasNext: false },
    { slug: 'lounge-design-kft', fixture: 'tag-lounge-design-kft.html', hasNext: false },
    { slug: 'fidesz', fixture: 'tag-fidesz.html', hasNext: true },
  ];

  for (const t of tags) {
    it(`${t.slug}: extracts only sourceUrl + archiveUrl + dateText + outletHint per card`, async () => {
      const html = await fixture(t.fixture);
      const { tagSlug, articles, nextPages } = parseKMonitorTagPage(html, t.slug);

      expect(tagSlug).toBe(t.slug);
      expect(articles.length).toBeGreaterThan(0);

      for (const a of articles) {
        expect(a.tagSlug).toBe(t.slug);
        expect(a.sourceUrl).toMatch(/^https?:\/\/[^ ]+/);
        if (a.archiveUrl) {
          expect(a.archiveUrl).toMatch(/^https?:\/\/web\.archive\.org\//);
        }
        if (a.dateText) {
          expect(parseDate(a.dateText)).toBeInstanceOf(Date);
        }
        if (a.outletHint !== null) {
          expect(a.outletHint).not.toContain('/');
        }
      }

      if (t.hasNext) {
        expect(nextPages.length).toBeGreaterThan(0);
        for (const p of nextPages) expect(p).toMatch(/[?&]page=\d+/);
      }
    });
  }

  it("never extracts K-Monitor's editorial excerpt (.card__content) — FR-079 contract", async () => {
    const html = await fixture('tag-nav-vizsgalat.html');
    const { articles } = parseKMonitorTagPage(html, 'nav-vizsgalat');
    const serialised = JSON.stringify(articles);
    // The known sample excerpt from the fixture's first card.
    expect(serialised).not.toContain('Nem mindennapi dizájn');
    // No DiscoveredArticleRef field is named excerpt/headline/title/summary.
    for (const a of articles) {
      expect(Object.keys(a).sort()).toEqual(
        ['archiveUrl', 'dateText', 'outletHint', 'sourceUrl', 'tagSlug'].sort(),
      );
    }
  });

  it('discovered URLs route to a real OutletSlug for the supported subset', async () => {
    const html = await fixture('tag-nav-vizsgalat.html');
    const { articles } = parseKMonitorTagPage(html, 'nav-vizsgalat');
    const routed = articles.map((a) => routeOutletByUrl(a.sourceUrl));
    const supported = routed.filter((s) => s !== null);
    // At least some articles must route — proves the discovery layer can
    // actually feed the existing OutletAdapters (FR-079).
    expect(supported.length).toBeGreaterThan(0);
  });
});

describe('routeOutletByUrl', () => {
  it.each([
    ['https://444.hu/2026/05/09/foo', '444'],
    ['https://www.444.hu/2026/05/09/foo', '444'],
    ['https://hvg.hu/360/20260508_foo', 'hvg'],
    ['https://telex.hu/foo', 'telex'],
    ['https://www.telex.hu/foo', 'telex'],
    ['https://atlatszo.hu/foo', 'atlatszo'],
    ['https://hang.hu/foo', 'magyar-hang'],
  ])('routes %s to %s', (url, expected) => {
    expect(routeOutletByUrl(url)).toBe(expected);
  });

  it.each([
    'https://mfor.hu/foo',
    'https://24.hu/foo',
    'https://forbes.hu/foo',
    'https://pecsma.hu/foo',
    'https://web.archive.org/web/20260509/https://444.hu/foo',
    'not-a-url',
  ])('returns null for unsupported / invalid URL %s', (url) => {
    expect(routeOutletByUrl(url)).toBeNull();
  });
});

describe('parseDate Hungarian month names', () => {
  it.each([
    ['2026. május 9.', Date.UTC(2026, 4, 9)],
    ['2026. január 1.', Date.UTC(2026, 0, 1)],
    ['2025. december 31.', Date.UTC(2025, 11, 31)],
    ['2026. március 15', Date.UTC(2026, 2, 15)],
  ])('parses %s', (input, expected) => {
    const d = parseDate(input);
    expect(d).toBeInstanceOf(Date);
    expect(d?.getTime()).toBe(expected);
  });

  it('still parses the legacy YYYY. MM. DD. numeric form', () => {
    const d = parseDate('2026. 05. 09.');
    expect(d?.getTime()).toBe(Date.UTC(2026, 4, 9));
  });

  it('returns null for unrecognised strings', () => {
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate('2026. xyzember 9.')).toBeNull();
  });
});
