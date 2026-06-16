import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

export const vastagbor: OutletAdapter = {
  slug: 'vastagbor',
  homepage: 'https://vastagbor.atlatszo.hu',
  queryAllowlist: [],
  relevantByDefault: true,
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://vastagbor.atlatszo.hu/feed/');
    return parseRss(xml);
  },
};

export default vastagbor;
