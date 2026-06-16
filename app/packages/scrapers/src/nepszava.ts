import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

export const nepszava: OutletAdapter = {
  slug: 'nepszava',
  homepage: 'https://nepszava.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://nepszava.hu/rss');
    return parseRss(xml);
  },
};

export default nepszava;
