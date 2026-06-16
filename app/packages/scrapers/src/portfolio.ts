import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

export const portfolio: OutletAdapter = {
  slug: 'portfolio',
  homepage: 'https://www.portfolio.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://www.portfolio.hu/rss/all.xml');
    return parseRss(xml);
  },
};

export default portfolio;
