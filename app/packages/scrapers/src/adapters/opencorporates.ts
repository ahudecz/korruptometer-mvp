import type { Adapter, AdapterQuery, RawExternalRecord } from './types';
// last-verified: 2026-05-15

const USER_AGENT = 'Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)';
const ENDPOINT = 'https://api.opencorporates.com/companies/search';

type OcCompany = {
  company: {
    name: string;
    jurisdiction_code?: string;
    company_number?: string;
    opencorporates_url?: string;
  };
};

export const opencorporatesAdapter: Adapter = {
  sourceSystem: 'opencorporates',
  freshnessDays: 90,
  perHostGateMs: 2000,
  async fetch(query: AdapterQuery): Promise<RawExternalRecord[]> {
    try {
      const term = query.primaryEntityName ?? '';
      if (!term) return [];
      const url = `${ENDPOINT}?q=${encodeURIComponent(term)}&jurisdiction_code=hu&format=json`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        results?: { companies?: OcCompany[] };
      };
      const companies = json.results?.companies ?? [];

      return companies
        .map((c) => {
          const co = c.company;
          const externalId = `${co.jurisdiction_code ?? 'hu'}/${co.company_number ?? co.name}`;
          return {
            sourceSystem: 'opencorporates' as const,
            externalId,
            canonicalUrl: co.opencorporates_url ?? `https://opencorporates.com/companies/${externalId}`,
            recordType: 'company',
            rawPayload: co,
            evidenceGrade: 'investigative_journalism',
            relevance: 'context',
          } satisfies RawExternalRecord;
        })
        .slice(0, 25);
    } catch {
      return [];
    }
  },
};

export default opencorporatesAdapter;
