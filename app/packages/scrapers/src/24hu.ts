import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

/**
 * The sitewide feed (/feed/) only holds the 10 most recent articles across
 * ALL of 24.hu — on a busy news day a lower-priority story (e.g. a NAV
 * personnel piece under /fn/gazdasag/) gets pushed out within a single
 * hourly scrape cycle and is never picked up. 2026-07-16 user report: a
 * NAV-vezetők-leváltása/aranykonvoj article was missed this way. Following
 * the same multi-rovat merge pattern as hvg.ts — add the gazdaság
 * section's own feed (also independently capped at 10, but not competing
 * with the rest of the site's volume) as a second source.
 */
export const hu24: OutletAdapter = {
  slug: '24hu',
  homepage: 'https://24.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const [main, gazdasag] = await Promise.allSettled([
      httpGet('https://24.hu/feed/').then(parseRss),
      httpGet('https://24.hu/fn/gazdasag/feed/').then(parseRss),
    ]);
    const articles: ScrapedArticle[] = [];
    if (main.status === 'fulfilled') articles.push(...main.value);
    if (gazdasag.status === 'fulfilled') articles.push(...gazdasag.value);
    return articles;
  },
};

export default hu24;
