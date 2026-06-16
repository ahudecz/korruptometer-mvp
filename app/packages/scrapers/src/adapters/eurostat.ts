import type { Adapter, AdapterQuery, RawExternalRecord } from './types';
// last-verified: 2026-05-15

const USER_AGENT = 'Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)';
const BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';

export const eurostatAdapter: Adapter = {
  sourceSystem: 'eurostat',
  freshnessDays: 180,
  perHostGateMs: 2000,
  async fetch(query: AdapterQuery): Promise<RawExternalRecord[]> {
    try {
      const dataset = (query.extra?.dataset as string | undefined) ?? 'gov_10a_exp';
      const params = new URLSearchParams({
        geo: 'HU',
        format: 'JSON',
        lang: 'EN',
        unit: 'MIO_EUR',
        sector: 'S13',
      });
      if (query.fromDate) params.set('sinceTimePeriod', query.fromDate.slice(0, 4));
      const url = `${BASE}/${encodeURIComponent(dataset)}?${params.toString()}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        label?: string;
        updated?: string;
        value?: Record<string, number>;
      };
      const dataPoints = json.value ? Object.keys(json.value).length : 0;
      if (dataPoints === 0) return [];

      return [
        {
          sourceSystem: 'eurostat',
          externalId: `${dataset}-HU`,
          canonicalUrl: `https://ec.europa.eu/eurostat/databrowser/view/${dataset}/default/table?lang=en&category=geo&category=HU`,
          recordType: 'statistic',
          rawPayload: {
            dataset,
            label: json.label,
            updated: json.updated,
            dataPoints,
          },
          evidenceGrade: 'audit_report',
          relevance: 'benchmark',
        },
      ];
    } catch {
      return [];
    }
  },
};

export default eurostatAdapter;
