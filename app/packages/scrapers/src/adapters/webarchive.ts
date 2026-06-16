import type { Adapter, AdapterQuery, RawExternalRecord } from './types';
// last-verified: 2026-05-15

const USER_AGENT = 'Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)';
const ENDPOINT = 'https://archive.org/wayback/available';

type WaybackResponse = {
  url?: string;
  archived_snapshots?: {
    closest?: {
      available?: boolean;
      url?: string;
      timestamp?: string;
      status?: string;
    };
  };
};

export const webarchiveAdapter: Adapter = {
  sourceSystem: 'webarchive',
  freshnessDays: 365,
  perHostGateMs: 2000,
  async fetch(query: AdapterQuery): Promise<RawExternalRecord[]> {
    try {
      // Build a list of candidate URLs to look up: an explicit extra.url, plus
      // common public-record domains relevant to a Hungarian investigation.
      const target = (query.extra?.url as string | undefined) ?? '';
      const term = (query.primaryEntityName ?? query.primaryPersonName ?? '').trim();
      const candidates = new Set<string>();
      if (target) candidates.add(target);
      if (term) {
        candidates.add(`palyazat.gov.hu/nyertes_palyazatok?kedvezmenyezett=${encodeURIComponent(term)}`);
        candidates.add(`kozbeszerzes.hu/hirdetmeny/?cegnev=${encodeURIComponent(term)}`);
      }
      if (candidates.size === 0) return [];

      const out: RawExternalRecord[] = [];
      for (const url of candidates) {
        const closest = await lookupSnapshot(url, query.toDate);
        if (!closest) continue;
        out.push({
          sourceSystem: 'webarchive',
          externalId: `${url}@${closest.timestamp ?? ''}`,
          canonicalUrl: closest.url!,
          recordType: 'archive_snapshot',
          rawPayload: { sourceUrl: url, closest },
          evidenceGrade: 'investigative_journalism',
          relevance: 'context',
        });
      }
      return out;
    } catch {
      return [];
    }
  },
};

async function lookupSnapshot(
  url: string,
  toDate?: string,
): Promise<NonNullable<WaybackResponse['archived_snapshots']>['closest'] | null> {
  const params = new URLSearchParams({ url });
  if (toDate) params.set('timestamp', toDate.replace(/-/g, ''));
  const fullUrl = `${ENDPOINT}?${params.toString()}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(fullUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') ?? '5');
      await new Promise((r) => setTimeout(r, Math.min(30, Math.max(2, retryAfter)) * 1000));
      continue;
    }
    if (!res.ok) return null;
    const json = (await res.json()) as WaybackResponse;
    const closest = json.archived_snapshots?.closest;
    if (closest?.available && closest.url) return closest;
    return null;
  }
  return null;
}

export default webarchiveAdapter;
