import type { Adapter, AdapterQuery, RawExternalRecord } from './types';
import * as cheerio from 'cheerio';
// last-verified: 2026-05-20 (integritashatosag.hu/jelentesek/)

const USER_AGENT = 'Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)';
const BASE = 'https://integritashatosag.hu';
const LISTING = `${BASE}/jelentesek/`;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

export const integritasAdapter: Adapter = {
  sourceSystem: 'integritas',
  freshnessDays: 60,
  perHostGateMs: 2000,
  async fetch(query: AdapterQuery): Promise<RawExternalRecord[]> {
    try {
      const res = await fetch(LISTING, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      });
      if (!res.ok) return [];
      const html = await res.text();
      const $ = cheerio.load(html);

      const term = (
        query.primaryEntityName ?? query.primaryPersonName ?? ''
      ).trim();
      const needles: string[] = [];
      if (term) {
        needles.push(normalize(term));
        const parts = term.split(/\s+/);
        if (parts.length > 1) {
          needles.push(normalize(parts[0]!));
          needles.push(normalize(parts[parts.length - 1]!));
        }
      }
      // Always include the procurement-risk benchmark report (every
      // Hungarian investigation can reasonably cite the system-wide
      // integrity-risk assessment as audit context).
      const alwaysInclude = [
        'integritaskockazat',
        'eves-elemzo',
        'kozbeszerzesi-rendszer',
      ];

      const out: RawExternalRecord[] = [];
      const seen = new Set<string>();
      $('a[href$=".pdf"]').each((_i, el) => {
        const href = $(el).attr('href') ?? '';
        if (!href || seen.has(href)) return;
        const slug = normalize(href);
        const text = normalize($(el).text() || $(el).closest('article, div, li').find('h1,h2,h3').first().text());
        const matched =
          alwaysInclude.some((a) => slug.includes(a)) ||
          needles.some((n) => n && (slug.includes(n) || text.includes(n)));
        if (!matched) return;
        seen.add(href);
        const canonicalUrl = href.startsWith('http') ? href : `${BASE}${href}`;
        out.push({
          sourceSystem: 'integritas',
          externalId: href,
          canonicalUrl,
          recordType: 'audit_report_pdf',
          rawPayload: {
            href: canonicalUrl,
            title: $(el).closest('article, div').find('h1,h2,h3').first().text().trim().slice(0, 240) || $(el).text().trim().slice(0, 240),
          },
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

export default integritasAdapter;
