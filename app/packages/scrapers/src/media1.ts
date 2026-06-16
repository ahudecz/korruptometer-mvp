import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

export const media1: OutletAdapter = {
  slug: 'media1',
  homepage: 'https://media1.hu',
  queryAllowlist: [],
  relevantByDefault: false,
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://media1.hu/feed/');
    return parseRss(xml);
  },
};

export default media1;
