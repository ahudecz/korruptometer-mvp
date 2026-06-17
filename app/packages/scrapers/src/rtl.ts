import { httpGet } from './http';
import { parseRss } from './rss';
import type { OutletAdapter, ScrapedArticle } from './types';

// Csak ezekből a szekciókból fogadunk RTL-cikket — a reggeli/sport/story/horoscope
// kizárva, mert azok szórakoztató tartalmak, amelyek politikus-neveket véletlenül
// érinthetnek és átcsúsznak az isRelevant() filteren.
const RTL_ALLOWED_PATH_PREFIXES = [
  '/belfold',
  '/kulfold',
  '/gazdasag',
  '/hirek',
  '/politika',
];

function isNewsPath(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return RTL_ALLOWED_PATH_PREFIXES.some(p => path.startsWith(p));
  } catch {
    return false;
  }
}

export const rtl: OutletAdapter = {
  slug: 'rtl',
  homepage: 'https://rtl.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const xml = await httpGet('https://rss.rtl.hu/');
    const all = await parseRss(xml);
    return all.filter(a => isNewsPath(a.sourceUrl));
  },
};

export default rtl;
