import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

/**
 * Magyar Hang publishes a sitewide RSS feed at /feed (the "belfold"
 * section is part of the same stream) — there is no narrower "just
 * politics" feed to subscribe to instead.
 *
 * 2026-07-19: relevantByDefault removed (user request, after a day where
 * the AI-classify budget gate correctly kicked in and the resulting
 * fail-open dumped weather/gardening/tram-accident pieces from this
 * feed straight onto the site). This is a sitewide lifestyle/politics
 * tabloid feed, not a corruption-focused outlet like atlatszo/direkt36/
 * kmonitor — it no longer gets a free pass into the AI "maybe" tier.
 * From now on a Magyar Hang piece only gets in if it hits a real
 * keyword/monitored-name match, same as any other non-default source.
 */
export const magyarHang: OutletAdapter = {
  slug: 'magyar-hang',
  homepage: 'https://hang.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://hang.hu/feed');
    return parseRss(xml);
  },
};

export default magyarHang;
