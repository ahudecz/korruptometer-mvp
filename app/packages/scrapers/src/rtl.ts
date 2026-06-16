import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

export const rtl: OutletAdapter = {
  slug: 'rtl',
  homepage: 'https://rtl.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://rss.rtl.hu/');
    return parseRss(xml);
  },
};

export default rtl;
