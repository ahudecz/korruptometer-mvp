import { describe, expect, it } from 'vitest';
import { parseKormanyHirek } from './kormanyhu';

/**
 * 2026-08-11 — kormany.hu has no RSS/sitemap, and its /hirek listing is
 * client-side hydrated from a `/publicapi` endpoint the site's own
 * robots.txt disallows. This adapter instead reads the Angular Universal
 * `ng-state` state-transfer JSON blob already embedded in the (allowed)
 * /hirek page's server-rendered HTML — see kormanyhu.ts's header comment.
 * These tests exercise that extraction against a minimal synthetic fixture
 * shaped like the real state tree (opaque numeric cache key, nested under
 * an unrelated sibling array first, to prove the structural-fingerprint
 * search doesn't just grab the first array it sees).
 */
function fixtureHtml(newsItems: unknown[]): string {
  const state = {
    '1234567890': {
      b: {
        // An unrelated array with a DIFFERENT shape (menu tree) that a
        // naive "first array found" search could wrongly pick.
        data: [
          { name: 'Miniszterelnök', slug: '', target: false, childrens: [] },
        ],
      },
    },
    '9876543210': {
      b: {
        data: newsItems,
      },
    },
  };
  return `<html><head></head><body>
    <script id="ng-state" type="application/json">${JSON.stringify(state)}</script>
  </body></html>`;
}

const sampleItem = {
  name: 'Elindult a nyomozás a kormány feljelentése alapján a veglegestorles.hu ügyében',
  slug: 'elindult-a-nyomozas-a-kormany-feljelentese-alapjan-a-veglegestorleshu-ugyeben',
  date: '2026-08-10',
  description: 'A Miniszterelnökség korábbi szerződéseinek átvizsgálásakor derült ki...',
  ministry: null,
  seoMeta: { imageUrl: 'https://cdn.kormany.hu/uploads/meta/example.jpg' },
  images: { dskImage: { path: 'https://cdn.kormany.hu/uploads/media/example.png' } },
};

describe('parseKormanyHirek', () => {
  it('finds and parses the news array by structural fingerprint, ignoring an unrelated sibling array', () => {
    const html = fixtureHtml([sampleItem]);
    const articles = parseKormanyHirek(html);
    expect(articles).toHaveLength(1);
    expect(articles[0]!.headline).toBe(sampleItem.name);
    expect(articles[0]!.sourceUrl).toBe(
      'https://kormany.hu/hirek/elindult-a-nyomozas-a-kormany-feljelentese-alapjan-a-veglegestorleshu-ugyeben',
    );
    expect(articles[0]!.excerpt).toContain('Miniszterelnökség');
    expect(articles[0]!.imageUrl).toBe('https://cdn.kormany.hu/uploads/media/example.png');
    expect(articles[0]!.publishedAt.toISOString()).toBe('2026-08-10T00:00:00.000Z');
  });

  it('falls back to seoMeta.imageUrl when images.dskImage is absent', () => {
    const item = { ...sampleItem, images: null };
    const html = fixtureHtml([item]);
    const articles = parseKormanyHirek(html);
    expect(articles[0]!.imageUrl).toBe(sampleItem.seoMeta.imageUrl);
  });

  it('skips an item missing a required field instead of throwing', () => {
    const broken = { ...sampleItem, slug: '' };
    const html = fixtureHtml([broken, sampleItem]);
    const articles = parseKormanyHirek(html);
    expect(articles).toHaveLength(1);
    expect(articles[0]!.sourceUrl).toContain(sampleItem.slug);
  });

  it('returns an empty array when the page has no ng-state script (layout changed)', () => {
    expect(parseKormanyHirek('<html><body>no state here</body></html>')).toEqual([]);
  });

  it('returns an empty array when the ng-state blob is not valid JSON', () => {
    const html = `<script id="ng-state" type="application/json">{not json</script>`;
    expect(parseKormanyHirek(html)).toEqual([]);
  });

  it('returns an empty array when no array in the state matches the news-item shape', () => {
    const html = fixtureHtml([]);
    // newsItems empty means the '9876543210' array has length 0, so its
    // first-element shape check can't match — falls through to the menu
    // array too (also shape-mismatched) — net result: nothing found.
    expect(parseKormanyHirek(html)).toEqual([]);
  });
});
