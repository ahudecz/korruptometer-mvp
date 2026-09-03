import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const runCore = vi.fn();
vi.mock('@/inngest/functions/subscriber-confirm-send', () => ({
  runSubscriberConfirmSendCore: (args: unknown) => runCore(args),
}));

const rows: Array<{ id: string }> = [];
vi.mock('@/lib/db', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ orderBy: () => ({ limit: async () => rows }) }),
      }),
    }),
  }),
  schema: {
    subscribers: {
      id: 'id',
      status: 'status',
      confirmSentCount: 'confirmSentCount',
      confirmLastSentAt: 'confirmLastSentAt',
      createdAt: 'createdAt',
    },
  },
}));

beforeEach(() => {
  runCore.mockReset();
  rows.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * 2026-09-03 — a megerősítő levél némán elmaradt, mert az Inngest eseményt
 * semmi nem fogyasztotta el. Ez az ürítő a hiányzó fogyasztó; ezek a tesztek
 * azt kötik ki, hogy egyetlen cím hibája se állítsa meg a köteget.
 */
describe('drainPendingConfirmations', () => {
  it('üres listán nem hív semmit', async () => {
    const { drainPendingConfirmations } = await import('@/lib/confirm-drain');
    await expect(drainPendingConfirmations()).resolves.toEqual({
      candidates: 0,
      sent: 0,
      skipped: 0,
    });
    expect(runCore).not.toHaveBeenCalled();
  });

  it('minden jelöltet kiszolgál, és számolja a küldést', async () => {
    rows.push({ id: 'a' }, { id: 'b' });
    runCore.mockResolvedValue({ sent: 1 });
    const { drainPendingConfirmations } = await import('@/lib/confirm-drain');
    const r = await drainPendingConfirmations();
    expect(r).toEqual({ candidates: 2, sent: 2, skipped: 0 });
    expect(runCore).toHaveBeenCalledTimes(2);
  });

  it('egy cím DOBOTT hibája nem állítja meg a köteget', async () => {
    rows.push({ id: 'a' }, { id: 'b' }, { id: 'c' });
    runCore
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ sent: 1 })
      .mockResolvedValueOnce({ sent: 0, skipped: 'daily_cap' });
    const { drainPendingConfirmations } = await import('@/lib/confirm-drain');
    const r = await drainPendingConfirmations();
    expect(r).toEqual({ candidates: 3, sent: 1, skipped: 2 });
    expect(runCore).toHaveBeenCalledTimes(3);
  });
});
