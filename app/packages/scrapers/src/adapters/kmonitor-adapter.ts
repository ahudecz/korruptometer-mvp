import type { Adapter, AdapterQuery, RawExternalRecord } from './types';
// last-verified: 2026-05-15

// K-Monitor maintains an in-repo person/entity candidate corpus
// (the "kmonitor own-datasets" snapshot). The scaffolded adapter is a
// placeholder until the corpus loader is wired up — at which point this
// adapter will read from the local snapshot rather than over HTTP.
// TODO: integration — load the K-Monitor person candidate corpus from
// the @korr/scrapers package data directory and filter by AdapterQuery.

export const kmonitorAdapter: Adapter = {
  sourceSystem: 'kmonitor',
  freshnessDays: 60,
  perHostGateMs: 2000,
  async fetch(_query: AdapterQuery): Promise<RawExternalRecord[]> {
    return [];
  },
};

export default kmonitorAdapter;
