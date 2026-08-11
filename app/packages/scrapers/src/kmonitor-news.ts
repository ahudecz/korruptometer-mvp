import { httpGet } from './http';
import { loadHtml } from './parse';
import type { OutletAdapter, ScrapedArticle } from './types';

const ARTICLE_SLUG_RE = /\/cikkek\/(\d{4})(\d{2})(\d{2})-([a-z0-9-]+)$/;

/**
 * 2026-08-11 — a régi `/feed` RSS-út HTTP 404-et ad (ellenőrizve), nincs
 * <link rel="alternate" rss> sem. A kezdőlap viszont saját (k-monitor.hu
 * domainű) cikkekre mutató linkeket tartalmaz `/cikkek/{yyyymmdd}-{slug}`
 * alakban, dátummal a slug elején — ezekből építjük a listát. A K-Monitor
 * kezdőlapja emellett MÁS lapok (rtl.hu, kontroll.hu, index.hu stb.)
 * korrupciós témájú cikkeire is linkel sajtószemle-jelleggel — ezeket
 * szándékosan kihagyjuk (host-szűrés), mert azokat a saját adapterük már
 * úgyis lefedi, itt csak a K-Monitor SAJÁT tartalma kell.
 */
export const kmonitorNews: OutletAdapter = {
  slug: 'kmonitor-news',
  homepage: 'https://www.k-monitor.hu',
  queryAllowlist: [],
  relevantByDefault: true,
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const html = await httpGet('https://www.k-monitor.hu');
    return parseKmonitorHomepage(html);
  },
};

export default kmonitorNews;

export function parseKmonitorHomepage(html: string): ScrapedArticle[] {
  const $ = loadHtml(html);
  const best = new Map<string, string>();

  $('a[href*="k-monitor.hu/cikkek/"]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (!text) return;
    const current = best.get(href);
    if (!current || text.length > current.length) best.set(href, text);
  });

  const out: ScrapedArticle[] = [];
  for (const [href, text] of best) {
    const m = ARTICLE_SLUG_RE.exec(href);
    if (!m) continue;
    const [, y, mo, d] = m;
    const publishedAt = new Date(`${y}-${mo}-${d}T00:00:00Z`);
    if (Number.isNaN(publishedAt.getTime())) continue;
    // The link text is the full lead paragraph appended to the headline
    // (no separate markup boundary on this layout) — the headline is
    // everything up to the first sentence-ending date stamp ("2026. július
    // 30." pattern) if present, else the whole text capped as a headline.
    const dateStampMatch = /^(.*?\S)\s+\d{4}\.\s*[a-záéíóöőúüű]+\s+\d{1,2}\./i.exec(text);
    const headline = (dateStampMatch?.[1] ?? text).slice(0, 300);
    const excerpt = dateStampMatch ? text.slice(dateStampMatch[0].length).trim() : '';
    out.push({
      headline,
      excerpt,
      sourceUrl: href.startsWith('http') ? href : `https://www.k-monitor.hu${href}`,
      publishedAt,
    });
  }
  return out;
}
