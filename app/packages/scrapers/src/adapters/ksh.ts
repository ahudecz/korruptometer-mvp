import type { Adapter, AdapterQuery, RawExternalRecord } from './types';
// last-verified: 2026-05-15

// Re-probed 2026-05-20: every public KSH host (www.ksh.hu, statinfo.ksh.hu)
// now serves a WAF-driven "Request Rejected" page to plain User-Agents and
// blocks JSON/OData requests outright. There is no free REST endpoint and
// the STADAT XLSX directory walk is no longer reachable without a
// JS-capable session that solves the bot challenge.
// TODO: either subscribe to the KSH dissemination API (paid) or run a
// Playwright-driven scraper that completes the WAF interstitial; until
// then this adapter returns no records.

export const kshAdapter: Adapter = {
  sourceSystem: 'ksh',
  freshnessDays: 180,
  perHostGateMs: 2000,
  async fetch(_query: AdapterQuery): Promise<RawExternalRecord[]> {
    return [];
  },
};

export default kshAdapter;
