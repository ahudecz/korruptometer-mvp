import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * T161 — proves the rollup wraps its work in a transaction that acquires
 * `pg_advisory_xact_lock(KPI_ROLLUP_LOCK)` before doing any aggregation.
 *
 * The handler runs inside a `step.run` block; we capture the SQL the
 * transaction calls and assert the first call is the advisory-lock
 * acquisition with the documented lock key. A second concurrent
 * invocation that observes the lock would then serialise — that's a
 * Postgres guarantee, not something we can prove in a unit test, so the
 * spec gate stays the integration suite. What this test catches is the
 * regression where the lock acquisition is removed or its key drifts.
 */

type SqlFragment = { strings: readonly string[]; values: readonly unknown[] };

const txCalls: SqlFragment[] = [];

vi.mock('../client', () => ({
  inngest: {
    createFunction: (_c: unknown, _t: unknown, handler: unknown) => ({ handler }),
  },
}));

vi.mock('next/cache', () => ({ revalidateTag: () => {} }));

vi.mock('@korr/db/locks', () => ({ KPI_ROLLUP_LOCK_INT: 8423501 }));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

vi.mock('@/lib/db', () => {
  const tx = {
    execute: async (frag: SqlFragment) => {
      txCalls.push(frag);
      // Return a one-row results array so the aggregator can read totals.
      return [
        {
          total_damage: '0',
          total_prison: 0,
          active: 0,
          indictments: 0,
          partner_count: 0,
        },
      ];
    },
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => Promise.resolve(),
      }),
    }),
  };
  return {
    getDb: () => ({
      transaction: async (cb: (tx: unknown) => Promise<void>) => {
        await cb(tx);
      },
    }),
    schema: { kpiSnapshots: { id: 'id' } },
  };
});

beforeEach(() => {
  vi.resetModules();
  txCalls.length = 0;
});

describe('aggregate.kpi-rollup advisory lock', () => {
  it('first SQL call inside the tx is pg_advisory_xact_lock(KPI_ROLLUP_LOCK)', async () => {
    const mod = await import('./aggregate-kpi-rollup');
    const fn = mod.aggregateKpiRollup as unknown as {
      handler: (ctx: { step: { run: (n: string, f: () => Promise<void>) => Promise<void> } }) => Promise<unknown>;
    };
    await fn.handler({ step: { run: async (_n, f) => f() } });
    expect(txCalls.length).toBeGreaterThan(0);
    const first = txCalls[0]!;
    const flat = first.strings.join('?').toLowerCase();
    expect(flat).toContain('pg_advisory_xact_lock');
    expect(first.values).toContain(8423501);
  });
});
