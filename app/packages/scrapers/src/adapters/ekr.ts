import type { Adapter, AdapterQuery, RawExternalRecord } from './types';
// last-verified: 2026-05-15

// EKR (ekr.gov.hu) exposes no public REST API; the portal is session-gated
// and CAPTCHA-protected. A real integration requires either an authenticated
// scraper or a partnership feed.
// TODO: integration — build a headless-browser session crawler or wait for
// the planned EKR Open Data export, then re-implement this adapter.

export const ekrAdapter: Adapter = {
  sourceSystem: 'EKR',
  freshnessDays: 30,
  perHostGateMs: 2000,
  async fetch(_query: AdapterQuery): Promise<RawExternalRecord[]> {
    return [];
  },
};

export default ekrAdapter;
