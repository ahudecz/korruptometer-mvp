import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: () => undefined,
  captureException: () => undefined,
}));
vi.mock('@/lib/db', () => ({
  getDb: () => ({}),
  schema: { investigations: {} },
}));
vi.mock('@/inngest/client', () => ({
  inngest: {
    createFunction: () => ({}),
  },
}));
vi.mock('@/lib/investigation/source-lock', () => ({
  withSourceSystemLock: async (_s: string, _g: number, fn: () => Promise<unknown>) => fn(),
}));
vi.mock('@korr/scrapers', () => ({
  tedAdapter: {},
  ekrAdapter: {},
  keAdapter: {},
  palyazatAdapter: {},
  ecegjegyzekAdapter: {},
  opencorporatesAdapter: {},
  integritasAdapter: {},
  olafAdapter: {},
  kshAdapter: {},
  eurostatAdapter: {},
  kmonitorAdapter: {},
  atlatszoAdapter: {},
  webarchiveAdapter: {},
}));

import { fetchHashOf } from '../../src/inngest/functions/investigation-xref';

describe('xref fetchHash canonicalization (T037)', () => {
  it('is stable across key ordering', () => {
    const a = fetchHashOf({ x: 1, y: 2, z: [3, 4] });
    const b = fetchHashOf({ z: [3, 4], y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it('changes when a value changes', () => {
    const a = fetchHashOf({ x: 1 });
    const b = fetchHashOf({ x: 2 });
    expect(a).not.toBe(b);
  });

  it('returns a hex sha256 (64 chars)', () => {
    const a = fetchHashOf({ x: 1 });
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
