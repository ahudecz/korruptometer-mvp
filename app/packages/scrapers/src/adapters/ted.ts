import type { Adapter, AdapterQuery, RawExternalRecord } from './types';
// last-verified: 2026-05-20 (TED v3 API: api.ted.europa.eu/v3/notices/search)

const USER_AGENT = 'Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)';
const ENDPOINT = 'https://api.ted.europa.eu/v3/notices/search';

type TedNotice = {
  'publication-number'?: string;
  'buyer-name'?: Record<string, string[]> | string;
  'winner-name'?: Record<string, string[]> | string;
  'title-proc'?: Record<string, string[]> | string;
  'publication-date'?: string;
  links?: unknown;
};

function quoteForTed(term: string): string {
  return term.replace(/["\\]/g, '').trim();
}

export const tedAdapter: Adapter = {
  sourceSystem: 'TED',
  freshnessDays: 30,
  perHostGateMs: 2000,
  async fetch(query: AdapterQuery): Promise<RawExternalRecord[]> {
    try {
      const term = quoteForTed(query.primaryEntityName ?? '');
      const clauses: string[] = ['buyer-country="HUN"'];
      if (term) {
        const pattern = term.split(/\s+/).slice(0, 4).join('*') + '*';
        clauses.push(`(buyer-name="${pattern}" OR winner-name="${pattern}")`);
      }
      if (query.fromDate) {
        clauses.push(`publication-date>=${query.fromDate.replace(/-/g, '')}`);
      }
      if (query.toDate) {
        clauses.push(`publication-date<=${query.toDate.replace(/-/g, '')}`);
      }

      const body = JSON.stringify({
        query: clauses.join(' AND '),
        fields: ['publication-number', 'buyer-name', 'winner-name', 'title-proc', 'publication-date'],
        limit: 25,
      });

      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { notices?: TedNotice[] };
      const notices = json.notices ?? [];

      const records: RawExternalRecord[] = [];
      for (const n of notices) {
        const pubNum = n['publication-number'];
        if (!pubNum) continue;
        records.push({
          sourceSystem: 'TED',
          externalId: pubNum,
          canonicalUrl: `https://ted.europa.eu/en/notice/-/detail/${pubNum}`,
          recordType: 'contract_notice',
          rawPayload: n,
          evidenceGrade: 'audit_report',
          relevance: 'corroborates',
        });
      }
      return records;
    } catch {
      return [];
    }
  },
};

export default tedAdapter;
