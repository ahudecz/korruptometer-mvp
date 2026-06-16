import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

export const hu24: OutletAdapter = {
  slug: '24hu',
  homepage: 'https://24.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://24.hu/feed/');
    return parseRss(xml);
  },
};

export default hu24;
