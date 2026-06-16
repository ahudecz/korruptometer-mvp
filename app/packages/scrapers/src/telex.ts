import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

export const telex: OutletAdapter = {
  slug: 'telex',
  homepage: 'https://telex.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const [belfold, gazdasag] = await Promise.allSettled([
      httpGet('https://telex.hu/rss/belfold').then(parseRss),
      httpGet('https://telex.hu/rss/gazdasag').then(parseRss),
    ]);
    const articles: ScrapedArticle[] = [];
    if (belfold.status === 'fulfilled') articles.push(...belfold.value);
    if (gazdasag.status === 'fulfilled') articles.push(...gazdasag.value);
    return articles;
  },
};

export default telex;
