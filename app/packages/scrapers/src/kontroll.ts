import { httpGet } from './http';
import { loadHtml, parseDateFromUrl } from './parse';
import type { OutletAdapter, ScrapedArticle } from './types';

/**
 * 2026-08-11 — kontroll.hu migrált egy WordPress-alapú CMS-ről Next.js-re,
 * a régi `/feed/` RSS-út HTTP 404-et ad (ellenőrizve). Nincs
 * <link rel="alternate" rss>, nincs wp-json. A cikklinkek viszont
 * közvetlenül a szerveroldalon renderelt kezdőlap HTML-jében vannak
 * (`/cikk/{rovat}/{yyyy}/{mm}/{dd}/{slug}`), fejnélküli böngésző nélkül is
 * kinyerhetők. Minden linkelt cikkhez KÉT <a> tartozik ugyanarra a hrefre:
 * a cím (rövid) és egy `*maxFourRow` CSS-osztályú lead-szöveg (a hosszabb,
 * "max 4 sor" kivonat) — a CSS-modul hash-előtag build-enként változhat,
 * ezért csak a "maxFourRow" alstringre illesztünk, nem a teljes osztályra.
 */
export const kontroll: OutletAdapter = {
  slug: 'kontroll',
  homepage: 'https://kontroll.hu',
  queryAllowlist: [],
  relevantByDefault: true,
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const html = await httpGet('https://kontroll.hu');
    return parseKontrollHomepage(html);
  },
};

export default kontroll;

export function parseKontrollHomepage(html: string): ScrapedArticle[] {
  const $ = loadHtml(html);
  const headlines = new Map<string, string>();
  const excerpts = new Map<string, string>();

  $('a[href^="/cikk/"]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (!text) return;
    const isExcerpt = ($(el).attr('class') ?? '').includes('maxFourRow');
    const bucket = isExcerpt ? excerpts : headlines;
    const current = bucket.get(href);
    if (!current || text.length > current.length) bucket.set(href, text);
  });

  const out: ScrapedArticle[] = [];
  for (const [href, headline] of headlines) {
    const publishedAt = parseDateFromUrl(href);
    if (!publishedAt) continue;
    out.push({
      headline,
      excerpt: excerpts.get(href) ?? '',
      sourceUrl: `https://kontroll.hu${href}`,
      publishedAt,
    });
  }
  return out;
}
