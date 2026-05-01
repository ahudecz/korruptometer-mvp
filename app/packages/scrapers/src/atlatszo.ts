import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

/**
 * Átlátszó (a WordPress site) ships a standard /feed/ RSS stream covering
 * every published article — the right primary source for an investigative
 * outlet whose listing pages are paginated WordPress archives.
 */
export const atlatszo: OutletAdapter = {
  slug: 'atlatszo',
  homepage: 'https://atlatszo.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://atlatszo.hu/feed/');
    return parseRss(xml);
  },
};

export default atlatszo;
