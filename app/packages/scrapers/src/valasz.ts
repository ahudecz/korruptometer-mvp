import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

export const valasz: OutletAdapter = {
  slug: 'valasz',
  homepage: 'https://www.valaszonline.hu',
  queryAllowlist: [],
  relevantByDefault: true,
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://www.valaszonline.hu/feed/');
    return parseRss(xml);
  },
};

export default valasz;
