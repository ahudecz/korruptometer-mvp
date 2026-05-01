import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

/**
 * 444.hu's website is an Ember.js SPA, so an HTTP GET on /legfrissebb
 * returns a near-empty shell. The site exposes a complete RSS feed at
 * /feed which we use as the primary source instead.
 */
export const negyNegyNegy: OutletAdapter = {
  slug: '444',
  homepage: 'https://444.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://444.hu/feed');
    return parseRss(xml);
  },
};

export default negyNegyNegy;
