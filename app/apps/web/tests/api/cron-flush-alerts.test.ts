import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const flushSubscriberAlerts = vi.fn(async () => ({ sent: 0, remaining: 0, paused: true as const }));

vi.mock('@/lib/notify-subscribers', () => ({
  FLUSH_BATCH_SIZE: 20,
  flushSubscriberAlerts,
}));

const CRON_SECRET = 'test-cron-secret';

async function call(headers: Record<string, string> = {}): Promise<Response> {
  const mod = await import('../../app/api/cron/flush-alerts/route');
  return mod.GET(new Request('http://localhost/api/cron/flush-alerts', { headers }));
}

beforeEach(() => {
  flushSubscriberAlerts.mockClear();
  process.env.CRON_SECRET = CRON_SECRET;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('GET /api/cron/flush-alerts (C1, C2)', () => {
  it('returns 401 without the Authorization: Bearer $CRON_SECRET header (C1)', async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(flushSubscriberAlerts).not.toHaveBeenCalled();
  });

  it('returns 401 for a wrong secret', async () => {
    const res = await call({ authorization: 'Bearer nope' });
    expect(res.status).toBe(401);
    expect(flushSubscriberAlerts).not.toHaveBeenCalled();
  });

  it('returns 401 when CRON_SECRET itself is unset — an empty secret authorises nobody', async () => {
    delete process.env.CRON_SECRET;
    const res = await call({ authorization: 'Bearer ' });
    expect(res.status).toBe(401);
  });

  it('with the channel id unset reports { sent: 0, paused: true } and marks nothing (C2)', async () => {
    const res = await call({ authorization: `Bearer ${CRON_SECRET}` });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ sent: 0, remaining: 0, paused: true });
    expect(flushSubscriberAlerts).toHaveBeenCalledWith({ max: 20 });
  });

  it('gives the route a duration ceiling that a full paced batch actually fits into', async () => {
    const mod = await import('../../app/api/cron/flush-alerts/route');
    // 20 üzenet 20/perc ütemben ≈ 57 s szünet, hálózat nélkül. A 60 s
    // mennyezet a köteg közepén vágná el a futást, némán.
    expect(mod.maxDuration).toBeGreaterThanOrEqual(120);
    expect(mod.runtime).toBe('nodejs');
    expect(mod.dynamic).toBe('force-dynamic');
  });
});
