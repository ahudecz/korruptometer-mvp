import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

export const panyiszabolcs: OutletAdapter = {
  slug: 'panyiszabolcs',
  homepage: 'https://panyiszabolcs.substack.com',
  queryAllowlist: [],
  relevantByDefault: true,
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://panyiszabolcs.substack.com/feed');
    return parseRss(xml);
  },
};

export default panyiszabolcs;
