import { describe, expect, it } from 'vitest';

import {
  tedAdapter,
  ekrAdapter,
  keAdapter,
  palyazatAdapter,
  ecegjegyzekAdapter,
  opencorporatesAdapter,
  integritasAdapter,
  olafAdapter,
  kshAdapter,
  eurostatAdapter,
  kmonitorAdapter,
  atlatszoAdapter,
  webarchiveAdapter,
} from '../index';

const ALL = [
  tedAdapter,
  ekrAdapter,
  keAdapter,
  palyazatAdapter,
  ecegjegyzekAdapter,
  opencorporatesAdapter,
  integritasAdapter,
  olafAdapter,
  kshAdapter,
  eurostatAdapter,
  kmonitorAdapter,
  atlatszoAdapter,
  webarchiveAdapter,
];

const EXPECTED_FRESHNESS: Record<string, number> = {
  TED: 30,
  EKR: 30,
  KE: 30,
  palyazat: 30,
  ecegjegyzek: 90,
  opencorporates: 90,
  integritas: 60,
  olaf: 60,
  ksh: 180,
  eurostat: 180,
  kmonitor: 60,
  atlatszo: 60,
  webarchive: 365,
};

describe('free-tier adapter contract (T036)', () => {
  it('every adapter declares the required fields', () => {
    for (const a of ALL) {
      expect(typeof a.sourceSystem).toBe('string');
      expect(typeof a.freshnessDays).toBe('number');
      expect(typeof a.perHostGateMs).toBe('number');
      expect(typeof a.fetch).toBe('function');
    }
  });

  it('freshness windows match research.md §3', () => {
    for (const a of ALL) {
      expect(EXPECTED_FRESHNESS[a.sourceSystem]).toBe(a.freshnessDays);
    }
  });

  it('every adapter sets a per-host gate ≥ 2000 ms (FR-016)', () => {
    for (const a of ALL) {
      expect(a.perHostGateMs).toBeGreaterThanOrEqual(2000);
    }
  });

  it('parses an empty query without throwing — returns an array', async () => {
    // We mock global fetch so the adapters don't hit the network during
    // the unit test sweep. Most adapters return [] in the scaffold; the
    // four with real-ish fetch logic should still return an array (and
    // any failure path resolves to []).
    const originalFetch = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = async () => new Response('', { status: 500 });
    try {
      for (const a of ALL) {
        const res = await a.fetch({});
        expect(Array.isArray(res)).toBe(true);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
