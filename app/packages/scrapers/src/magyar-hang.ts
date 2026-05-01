import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

/**
 * Magyar Hang publishes a sitewide RSS feed at /feed (the "belfold"
 * section is part of the same stream).
 */
export const magyarHang: OutletAdapter = {
  slug: 'magyar-hang',
  homepage: 'https://hang.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://hang.hu/feed');
    return parseRss(xml);
  },
};

export default magyarHang;
