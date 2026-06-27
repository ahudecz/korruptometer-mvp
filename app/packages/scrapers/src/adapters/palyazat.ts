import type { Adapter, AdapterQuery, RawExternalRecord } from './types';
// last-verified: 2026-05-20 (palyazat.gov.hu Next.js _next/data route)

const USER_AGENT = 'Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)';
const BASE = 'https://palyazat.gov.hu';
const LANDING = `${BASE}/`;

type SupportedProject = {
  fejlesztesi_program_nev?: string;
  forras?: string;
  kiiras_eve?: string;
  op_kod?: string;
  konstrukcio_nev?: string;
  konstrukcio_kod?: string;
  palyazo_neve?: string;
  projekt_cime?: string;
  megval_regio_nev?: string;
  megval_megye_nev?: string;
  tam_dont_datum?: string;
  megitelt_tamogatas?: number | string;
  id_palyazat?: string | number;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

async function discoverBuildId(): Promise<string | null> {
  try {
    const res = await fetch(LANDING, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = /"buildId":"([^"]+)"/.exec(html);
    return m ? m[1]! : null;
  } catch {
    return null;
  }
}

export const palyazatAdapter: Adapter = {
  sourceSystem: 'palyazat',
  freshnessDays: 30,
  perHostGateMs: 2000,
  async fetch(query: AdapterQuery): Promise<RawExternalRecord[]> {
    try {
      const term = (
        query.primaryEntityName ?? query.primaryPersonName ?? ''
      ).trim();
      if (!term) return [];

      const buildId = await discoverBuildId();
      if (!buildId) return [];

      const url = `${BASE}/_next/data/${buildId}/eredmenyek/tamogatott-projektek.json`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        pageProps?: { supportedProjects?: { data?: SupportedProject[] } };
      };
      const data = json.pageProps?.supportedProjects?.data ?? [];

      const needle = normalize(term);
      const out: RawExternalRecord[] = [];
      for (const p of data) {
        const haystack = normalize(
          [p.palyazo_neve, p.projekt_cime, p.konstrukcio_nev]
            .filter(Boolean)
            .join(' '),
        );
        if (!haystack.includes(needle)) continue;
        const externalId = String(p.id_palyazat ?? `${p.op_kod ?? ''}-${p.konstrukcio_kod ?? ''}`);
        out.push({
          sourceSystem: 'palyazat',
          externalId,
          canonicalUrl: `${BASE}/eredmenyek/tamogatott-projektek`,
          recordType: 'beneficiary',
          rawPayload: p,
          evidenceGrade: 'audit_report',
          relevance: 'corroborates',
        });
      }
      return out.slice(0, 10);
    } catch {
      return [];
    }
  },
};

export default palyazatAdapter;
