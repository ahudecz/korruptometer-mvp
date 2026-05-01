import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

/**
 * Telex publishes a clean RSS feed at /rss/archivum (the same "legfrissebb"
 * stream as the homepage). RSS is preferred over HTML scraping for every
 * outlet that ships one because it sidesteps SPA rendering and is far less
 * likely to drift than DOM selectors.
 */
export const telex: OutletAdapter = {
  slug: 'telex',
  homepage: 'https://telex.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://telex.hu/rss/archivum');
    return parseRss(xml);
  },
};

export default telex;
