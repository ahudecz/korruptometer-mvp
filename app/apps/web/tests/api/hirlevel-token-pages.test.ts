import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * 012-reader-subscriptions FR-034 / FR-035 / SC-008 / SC-009.
 *
 * Két állítás, és mindkettő olvasót véd egy vállalati levélszűrőtől:
 *
 * 1. Egy GET SEMMIT nem ír. Ha írna, egy SafeLinks-előnézet elégetné az
 *    egyszer használatos tokent, mielőtt az olvasó rákattint — és a három
 *    darabos küldési korlát ezután véglegesen kizárná azt a címet.
 * 2. Egy érvényes, egy lejárt és egy kitalált token válasza AZONOS.
 */
const writes: string[] = [];

const dbStub = {
  select: vi.fn(() => ({
    from: () => ({ where: () => ({ limit: async () => selectResult }) }),
  })),
  insert: vi.fn(() => {
    writes.push('INSERT');
    return { values: async () => undefined };
  }),
  update: vi.fn(() => {
    writes.push('UPDATE');
    return { set: () => ({ where: async () => undefined, returning: async () => [] }) };
  }),
};

let selectResult: Array<Record<string, unknown>> = [];

vi.mock('@/lib/db', () => ({
  getDb: () => dbStub,
  schema: new Proxy({}, { get: () => new Proxy({}, { get: () => 'col' }) }),
}));

vi.mock('@korr/shared/ratelimit', () => {
  const ok = { limit: async () => ({ success: true, remaining: 10, reset: 0 }) };
  return {
    confirmIpLimiter: () => ok,
    confirmTokenLimiter: () => ok,
    subscribePageLimiter: ok,
  };
});

vi.mock('@/inngest/client', () => ({ inngest: { send: vi.fn(async () => ({ ids: [] })) } }));

function get(path: string): Request {
  return new Request(`http://localhost${path}`, { headers: { 'x-forwarded-for': '203.0.113.9' } });
}

beforeEach(() => {
  writes.length = 0;
  selectResult = [];
  process.env.SUBSCRIBER_LINK_SECRET = 'k1:titok-2026-eleg-hosszu';
});

afterEach(() => {
  delete process.env.SUBSCRIBER_LINK_SECRET;
});

describe('GET on the token routes mutates nothing, ever (FR-034)', () => {
  it('megerosites GET issues ZERO write statements', async () => {
    const mod = await import('../../app/api/hirlevel/megerosites/route');
    const res = await mod.GET(get('/api/hirlevel/megerosites?t=barmi'));
    expect(res.status).toBe(200);
    expect(writes).toEqual([]);
  });

  it('leiratkozas GET issues ZERO write statements', async () => {
    const mod = await import('../../app/api/hirlevel/leiratkozas/route');
    const res = await mod.GET(get('/api/hirlevel/leiratkozas?t=barmi'));
    expect(res.status).toBe(200);
    expect(writes).toEqual([]);
  });

  it('a GET returns the same body whatever the token — valid, expired or invented (FR-035)', async () => {
    const mod = await import('../../app/api/hirlevel/megerosites/route');
    const bodies: string[] = [];
    for (const t of ['ervenyes-token', 'lejart-token', 'kitalalt-token', '']) {
      const res = await mod.GET(get(`/api/hirlevel/megerosites?t=${t}`));
      bodies.push(await res.text());
    }
    expect(new Set(bodies).size).toBe(1);
    expect(bodies[0]).toContain('Erősítsd meg a feliratkozásod.');
  });

  it('the unsubscribe GET is likewise identical across tokens', async () => {
    const mod = await import('../../app/api/hirlevel/leiratkozas/route');
    const bodies: string[] = [];
    for (const t of ['a', 'b', '']) {
      const res = await mod.GET(get(`/api/hirlevel/leiratkozas?t=${t}`));
      bodies.push(await res.text());
    }
    expect(new Set(bodies).size).toBe(1);
    expect(bodies[0]).toContain('Biztosan leiratkozol?');
  });
});

describe('POST on megerosites — an unknown and an expired token are indistinguishable (SC-009)', () => {
  async function post(t: string | null): Promise<Record<string, unknown>> {
    const mod = await import('../../app/api/hirlevel/megerosites/route');
    const res = await mod.POST(
      new Request('http://localhost/api/hirlevel/megerosites', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
        body: JSON.stringify({ t }),
      }),
    );
    return (await res.json()) as Record<string, unknown>;
  }

  it('an unknown token reads exactly like an expired one', async () => {
    selectResult = [];
    const unknown = await post('kitalalt');
    selectResult = [
      {
        id: 's1',
        status: 'pending',
        emailEnc: 'enc',
        purgePiiAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      },
    ];
    const expired = await post('lejart');
    expect(unknown).toEqual(expired);
    expect(unknown).toEqual({ state: 'expired', message: 'Ez a link lejárt.', resend: true });
  });

  it('a missing token also reads as expired', async () => {
    expect(await post(null)).toEqual({
      state: 'expired',
      message: 'Ez a link lejárt.',
      resend: true,
    });
  });

  it('a valid token confirms and reports it in Hungarian', async () => {
    selectResult = [
      {
        id: 's1',
        status: 'pending',
        emailEnc: 'enc',
        purgePiiAt: null,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    ];
    expect(await post('ervenyes')).toEqual({
      state: 'confirmed',
      message: 'Kész. Mostantól kapsz értesítést.',
    });
  });

  it('an already active subscription says so instead of confirming twice', async () => {
    selectResult = [
      {
        id: 's1',
        status: 'active',
        emailEnc: 'enc',
        purgePiiAt: null,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    ];
    expect(await post('ervenyes')).toEqual({
      state: 'already',
      message: 'Ez a feliratkozás már aktív.',
    });
  });

  it('an erased address gets its own Hungarian message and a contact route', async () => {
    selectResult = [
      {
        id: 's1',
        status: 'unsubscribed',
        emailEnc: null,
        purgePiiAt: new Date('2026-01-01'),
        expiresAt: null,
      },
    ];
    expect(await post('barmi')).toEqual({
      state: 'erased',
      message: 'Ezt a címet nem tudjuk feliratkoztatni.',
    });
  });
});

describe('POST on leiratkozas (FR-039, SC-006)', () => {
  async function post(t: string | null): Promise<Record<string, unknown>> {
    const mod = await import('../../app/api/hirlevel/leiratkozas/route');
    const res = await mod.POST(
      new Request('http://localhost/api/hirlevel/leiratkozas', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
        body: JSON.stringify({ t }),
      }),
    );
    return (await res.json()) as Record<string, unknown>;
  }

  it('an invented token changes nothing and still reads as unsubscribed', async () => {
    const body = await post('kitalalt-token');
    expect(body).toEqual({ state: 'unsubscribed', message: 'Leiratkoztál. Bármikor visszatérhetsz.' });
    expect(writes).toEqual([]);
  });

  it('a valid token unsubscribes, and a second press changes nothing further (SC-006)', async () => {
    const { signUnsubToken } = await import('@/lib/subscriber-crypto');
    const token = signUnsubToken('sub-1')!;

    selectResult = [{ id: 'sub-1', status: 'active' }];
    const first = await post(token);
    expect(first.state).toBe('unsubscribed');
    const writesAfterFirst = writes.length;
    expect(writesAfterFirst).toBeGreaterThan(0);

    selectResult = [{ id: 'sub-1', status: 'unsubscribed' }];
    const second = await post(token);
    expect(second).toEqual(first);
    expect(writes.length).toBe(writesAfterFirst); // semmi új írás
  });

  it('accepts the one-click form body a mail client posts (RFC 8058)', async () => {
    const { signUnsubToken } = await import('@/lib/subscriber-crypto');
    const token = signUnsubToken('sub-9')!;
    selectResult = [{ id: 'sub-9', status: 'active' }];

    const mod = await import('../../app/api/hirlevel/leiratkozas/route');
    const res = await mod.POST(
      new Request(`http://localhost/api/hirlevel/leiratkozas?t=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-forwarded-for': '203.0.113.9',
        },
        body: 'List-Unsubscribe=One-Click',
      }),
    );
    await expect(res.json()).resolves.toEqual({
      state: 'unsubscribed',
      message: 'Leiratkoztál. Bármikor visszatérhetsz.',
    });
  });
});
