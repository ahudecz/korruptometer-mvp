import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

/**
 * HVG ships per-rovat RSS feeds at /rss/<rovat>. "Itthon" (domestic news)
 * alone missed corruption-relevant stories filed under other rovats — e.g.
 * NKA repayment coverage lives under "Kultúra" and MNB-alapítvány coverage
 * under "Gazdaság" — so we follow all three and merge results.
 */
export const hvg: OutletAdapter = {
  slug: 'hvg',
  homepage: 'https://hvg.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const [itthon, kultura, gazdasag] = await Promise.allSettled([
      httpGet('https://hvg.hu/rss/itthon').then(parseRss),
      httpGet('https://hvg.hu/rss/kultura').then(parseRss),
      httpGet('https://hvg.hu/rss/gazdasag').then(parseRss),
    ]);
    const articles: ScrapedArticle[] = [];
    if (itthon.status === 'fulfilled') articles.push(...itthon.value);
    if (kultura.status === 'fulfilled') articles.push(...kultura.value);
    if (gazdasag.status === 'fulfilled') articles.push(...gazdasag.value);
    return articles;
  },
};

export default hvg;
