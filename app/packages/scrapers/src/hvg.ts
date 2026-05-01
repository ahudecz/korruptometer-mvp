import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

/**
 * HVG ships per-rovat RSS feeds at /rss/<rovat>; we follow the "Itthon"
 * (domestic news) feed which is the relevant section for this project.
 */
export const hvg: OutletAdapter = {
  slug: 'hvg',
  homepage: 'https://hvg.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://hvg.hu/rss/itthon');
    return parseRss(xml);
  },
};

export default hvg;
