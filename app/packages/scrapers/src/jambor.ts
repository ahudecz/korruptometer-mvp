import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

export const jambor: OutletAdapter = {
  slug: 'jambor',
  homepage: 'https://jamborandras.substack.com',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://jamborandras.substack.com/feed');
    return parseRss(xml);
  },
};

export default jambor;
