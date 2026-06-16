import type { Adapter, AdapterQuery, RawExternalRecord } from './types';
// last-verified: 2026-05-15

// e-cegjegyzek.hu (the Hungarian public company registry) requires a paid
// per-query fee and a court-issued certificate to retrieve company snapshots
// programmatically. There is no free REST endpoint. A real integration
// requires either subscription credentials or scraping the Céginformációs
// Szolgálat (CISZ) bulk export.
// TODO: integration — wire up authenticated CISZ access or buy registry seats.

export const ecegjegyzekAdapter: Adapter = {
  sourceSystem: 'ecegjegyzek',
  freshnessDays: 90,
  perHostGateMs: 2000,
  async fetch(_query: AdapterQuery): Promise<RawExternalRecord[]> {
    return [];
  },
};

export default ecegjegyzekAdapter;
