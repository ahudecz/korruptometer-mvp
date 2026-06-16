import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

export const kmonitorNews: OutletAdapter = {
  slug: 'kmonitor-news',
  homepage: 'https://www.k-monitor.hu',
  queryAllowlist: [],
  relevantByDefault: true,
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://www.k-monitor.hu/feed');
    return parseRss(xml);
  },
};

export default kmonitorNews;
