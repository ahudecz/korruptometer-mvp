import type { Adapter, AdapterQuery, RawExternalRecord } from './types';
// last-verified: 2026-05-20

// kozbeszerzes.hu was a server-rendered HTML site in 2024; in 2026 the
// hirdetmény search is delivered by a JS web component (<ktsearch>) that
// loads results from an authenticated POST endpoint
// `/adatbazis/keres/hirdetmeny/api` (returns 403 without a session cookie).
// Without a headless-browser session or a published bulk export, no
// no-registration crawler can recover the data. Returning [] keeps the
// adapter honest until either:
//  - the Közbeszerzési Hatóság publishes its planned open-data export, or
//  - we wire a Playwright-driven worker that runs the JS search and parses
//    its rendered DOM.

export const keAdapter: Adapter = {
  sourceSystem: 'KE',
  freshnessDays: 30,
  perHostGateMs: 2000,
  async fetch(_query: AdapterQuery): Promise<RawExternalRecord[]> {
    return [];
  },
};

export default keAdapter;
