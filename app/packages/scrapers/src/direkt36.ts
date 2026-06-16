import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

export const direkt36: OutletAdapter = {
  slug: 'direkt36',
  homepage: 'https://direkt36.hu',
  queryAllowlist: [],
  relevantByDefault: true,
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://direkt36.hu/feed/');
    return parseRss(xml);
  },
};

export default direkt36;
