import type { Adapter, AdapterQuery, RawExternalRecord } from './types';
import * as cheerio from 'cheerio';
// last-verified: 2026-05-20 (anti-fraud.ec.europa.eu/media-corner/news_en)

const USER_AGENT = 'Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)';
const BASE = 'https://anti-fraud.ec.europa.eu';
const LISTING = `${BASE}/media-corner/news_en`;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

export const olafAdapter: Adapter = {
  sourceSystem: 'olaf',
  freshnessDays: 60,
  perHostGateMs: 2000,
  async fetch(query: AdapterQuery): Promise<RawExternalRecord[]> {
    try {
      const term = (
        query.primaryEntityName ?? query.primaryPersonName ?? ''
      ).trim();
      if (!term) return [];

      const res = await fetch(LISTING, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      });
      if (!res.ok) return [];
      const html = await res.text();
      const $ = cheerio.load(html);

      const needles = [normalize(term)];
      // Also try first-name-only and last-name-only matches if multi-word.
      const parts = term.split(/\s+/);
      if (parts.length > 1) {
        needles.push(normalize(parts[0]!));
        needles.push(normalize(parts[parts.length - 1]!));
      }
      // Hungary-related fallback so a Hungarian investigation always
      // sees OLAF context records even when no exact entity match.
      needles.push('hungar', 'magyar');

      const out: RawExternalRecord[] = [];
      const seen = new Set<string>();
      $('a[href*="/media-corner/news/"]').each((_i, el) => {
        const href = $(el).attr('href') ?? '';
        if (!href || seen.has(href)) return;
        const slug = normalize(href);
        const text = normalize($(el).text());
        if (!needles.some((n) => slug.includes(n) || text.includes(n))) return;
        seen.add(href);
        const canonicalUrl = href.startsWith('http') ? href : `${BASE}${href}`;
        out.push({
          sourceSystem: 'olaf',
          externalId: href,
          canonicalUrl,
          recordType: 'press_release',
          rawPayload: { href, title: $(el).text().trim().slice(0, 240) },
          evidenceGrade: 'audit_report',
          relevance: 'corroborates',
        });
      });
      return out.slice(0, 10);
    } catch {
      return [];
    }
  },
};

export default olafAdapter;
