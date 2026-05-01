import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * T160 — aggregate.kpi-rollup unit-style coverage.
 *
 * The full integration test (cron-fire + admin-mutation-enqueue path with
 * a real Inngest test runner against live Postgres) is out of scope for
 * this in-process spec — the harness does not provision Postgres in CI
 * yet (FOLLOW-UP: wire `pnpm --filter @korr/web test:integration`).
 *
 * Until then this test exercises the function configuration contract
 * (cron schedule, event trigger, debounce key, concurrency cap) so a
 * regression in those declarations is caught immediately.
 */

const captured: { config?: Record<string, unknown>; trig?: unknown } = {};

vi.mock('../client', () => ({
  inngest: {
    createFunction: (config: Record<string, unknown>, trig: unknown, handler: unknown) => {
      captured.config = config;
      captured.trig = trig;
      return { config, trig, handler };
    },
  },
}));

vi.mock('@/lib/db', () => ({
  getDb: () => ({}),
  schema: { kpiSnapshots: { id: 'id' } },
}));

vi.mock('drizzle-orm', () => ({
  sql: (s: TemplateStringsArray, ..._v: unknown[]) => ({ strings: s }),
}));

vi.mock('next/cache', () => ({ revalidateTag: () => {} }));

vi.mock('@korr/db/locks', () => ({ KPI_ROLLUP_LOCK_INT: 8423501 }));

beforeEach(() => {
  vi.resetModules();
  captured.config = undefined;
  captured.trig = undefined;
});

describe('aggregate.kpi-rollup configuration', () => {
  it('declares concurrency=1 and 10s debounce on `kpi-recompute`', async () => {
    await import('./aggregate-kpi-rollup');
    expect(captured.config).toMatchObject({
      id: 'aggregate-kpi-rollup',
      concurrency: { limit: 1 },
      debounce: { period: '10s', key: 'kpi-recompute' },
    });
  });

  it('listens on hourly cron AND kpi.recompute event', async () => {
    await import('./aggregate-kpi-rollup');
    const triggers = captured.trig as Array<Record<string, string>>;
    expect(Array.isArray(triggers)).toBe(true);
    expect(triggers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cron: '0 * * * *' }),
        expect.objectContaining({ event: 'kpi.recompute' }),
      ]),
    );
  });
});
