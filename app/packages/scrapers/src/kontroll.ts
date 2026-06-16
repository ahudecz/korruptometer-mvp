import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

export const kontroll: OutletAdapter = {
  slug: 'kontroll',
  homepage: 'https://kontroll.hu',
  queryAllowlist: [],
  relevantByDefault: true,
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://kontroll.hu/feed/');
    return parseRss(xml);
  },
};

export default kontroll;
