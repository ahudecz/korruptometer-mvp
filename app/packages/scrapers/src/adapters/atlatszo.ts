import type { Adapter, AdapterQuery, RawExternalRecord } from './types';
// last-verified: 2026-05-15

// atlatszo.hu is a WordPress-driven investigative outlet. The site exposes
// a search results HTML page but no stable JSON feed at the free tier
// (the WP REST API is rate-limited and intermittently disabled).
// TODO: URL drift — re-verify against the registry's public sandbox; the
// search endpoint and DOM selectors below are best-effort.

import * as cheerio from 'cheerio';

const USER_AGENT = 'Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)';
const BASE = 'https://atlatszo.hu';

export const atlatszoAdapter: Adapter = {
  sourceSystem: 'atlatszo',
  freshnessDays: 60,
  perHostGateMs: 2000,
  async fetch(query: AdapterQuery): Promise<RawExternalRecord[]> {
    try {
      const term = query.primaryEntityName ?? query.primaryPersonName ?? '';
      if (!term) return [];
      const url = `${BASE}/?s=${encodeURIComponent(term)}`;
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) return [];
      const html = await res.text();
      const $ = cheerio.load(html);

      const out: RawExternalRecord[] = [];
      const seen = new Set<string>();
      $('article.post a.post_link, article.post h3.post_title a, a.post_link').each(
        (_i, el) => {
          const href = $(el).attr('href');
          if (!href || seen.has(href)) return;
          if (!/^https?:\/\/atlatszo\.hu\/[^/]+\/\d{4}\/\d{2}\/\d{2}\//.test(href)) return;
          seen.add(href);
          const title = $(el).text().trim() || $(el).closest('article').find('h3').first().text().trim();
          out.push({
            sourceSystem: 'atlatszo',
            externalId: href,
            canonicalUrl: href,
            recordType: 'press_release',
            rawPayload: { title: title.slice(0, 240), href },
            evidenceGrade: 'investigative_journalism',
            relevance: 'context',
          });
        },
      );
      return out.slice(0, 10);
    } catch {
      return [];
    }
  },
};

export default atlatszoAdapter;
