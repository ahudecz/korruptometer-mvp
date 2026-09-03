import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * 012-reader-subscriptions — a feliratkozó végpont ellenőrzési SORRENDJE
 * (FR-043, FR-044, FR-089, FR-093, FR-095).
 *
 * A legfontosabb állítás: egy kitöltött csali-mező NULLA adatbázis-hívást
 * végez. Ezért van a `getDb()` úgy kikötve, hogy dobjon — ha bármi megérinti,
 * a teszt látványosan elbukik, nem csendben átcsúszik.
 */
let dbTouched = 0;

const dbStub = {
  select: vi.fn(() => {
    dbTouched += 1;
    return { from: () => ({ where: () => ({ limit: async () => selectResult }) }) };
  }),
  insert: vi.fn(() => {
    dbTouched += 1;
    return {
      values: () => ({ returning: async () => [{ id: 'sub-new' }] }),
    };
  }),
  update: vi.fn(() => {
    dbTouched += 1;
    return { set: () => ({ where: async () => undefined }) };
  }),
  execute: vi.fn(async () => {
    dbTouched += 1;
    return [];
  }),
};

let selectResult: Array<Record<string, unknown>> = [];

vi.mock('@/lib/db', () => ({
  getDb: () => dbStub,
  schema: new Proxy({}, { get: () => new Proxy({}, { get: () => 'col' }) }),
}));

let hourAllowed = true;
let dayAllowed = true;

vi.mock('@korr/shared/ratelimit', () => ({
  subscribeIpHourLimiter: () => ({
    limit: async () => ({ success: hourAllowed, remaining: 0, reset: 0 }),
  }),
  subscribeIpLimiter: () => ({
    limit: async () => ({ success: dayAllowed, remaining: 0, reset: 0 }),
  }),
}));

const inngestSend = vi.fn(async () => ({ ids: [] }));
vi.mock('@/inngest/client', () => ({ inngest: { send: inngestSend } }));

const sendTelegramMessage = vi.fn(async () => 1);
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage }));

vi.mock('@korr/shared/encryption', () => ({ encryptPii: (v: string) => `enc(${v})` }));

async function post(body: Record<string, unknown>, ip = '203.0.113.9'): Promise<Response> {
  const mod = await import('../../app/api/hirlevel/feliratkozas/route');
  return mod.POST(
    new Request('http://localhost/api/hirlevel/feliratkozas', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  );
}

const VALID = { email: 'olvaso@example.hu', sections: ['resignation'], website: '' };

beforeEach(() => {
  dbTouched = 0;
  selectResult = [];
  hourAllowed = true;
  dayAllowed = true;
  inngestSend.mockClear();
  sendTelegramMessage.mockClear();
  process.env.RESEND_API_KEY = 're_test';
  process.env.PII_ENC_KEY = 'test-key';
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.PII_ENC_KEY;
});

describe('POST /api/hirlevel/feliratkozas — check order (FR-095)', () => {
  it('a filled honeypot performs ZERO database calls and returns the generic Hungarian text', async () => {
    const res = await post({ ...VALID, website: 'http://spam.example' });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'A beküldés nem sikerült.' });
    expect(dbTouched).toBe(0);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it('the honeypot runs BEFORE the rate limiters — a filled field is refused even when the limits are exhausted', async () => {
    hourAllowed = false;
    const res = await post({ ...VALID, website: 'bot' });
    expect(res.status).toBe(400); // 400, nem 429 — a csali van elöl
    expect(dbTouched).toBe(0);
  });

  it('an exhausted hourly threshold returns 429 with no database work', async () => {
    hourAllowed = false;
    const res = await post(VALID);
    expect(res.status).toBe(429);
    expect(dbTouched).toBe(0);
  });

  it('an exhausted daily threshold returns 429 with no database work', async () => {
    dayAllowed = false;
    const res = await post(VALID);
    expect(res.status).toBe(429);
    expect(dbTouched).toBe(0);
  });

  it('a malformed address is refused with the SAME generic text, before any database work', async () => {
    const res = await post({ ...VALID, email: 'nincs-kukac' });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'A beküldés nem sikerült.' });
    expect(dbTouched).toBe(0);
  });

  it('an empty section list is refused', async () => {
    const res = await post({ ...VALID, sections: [] });
    expect(res.status).toBe(400);
    expect(dbTouched).toBe(0);
  });

  it('an unknown section name is refused — the enum is the only vocabulary (FR-007)', async () => {
    const res = await post({ ...VALID, sections: ['podcast'] });
    expect(res.status).toBe(400);
    expect(dbTouched).toBe(0);
  });

  it('a role address is refused before any database work (FR-045)', async () => {
    const res = await post({ ...VALID, email: 'info@ceg.hu' });
    expect(res.status).toBe(400);
    expect(dbTouched).toBe(0);
  });

  it('a disposable domain is refused before any database work (FR-045)', async () => {
    const res = await post({ ...VALID, email: 'valaki@mailinator.com' });
    expect(res.status).toBe(400);
    expect(dbTouched).toBe(0);
  });
});

describe('POST /api/hirlevel/feliratkozas — paused and uniform responses', () => {
  it('with RESEND_API_KEY unset returns the distinct paused response, NOT a false 201 (FR-044)', async () => {
    delete process.env.RESEND_API_KEY;
    const res = await post(VALID);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      paused: true,
      message: 'A feliratkozás átmenetileg szünetel.',
    });
    expect(dbTouched).toBe(0);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it('a new address gets the uniform 201 and enqueues one confirmation job', async () => {
    const res = await post(VALID);
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      message: 'Elküldtük a megerősítő levelet. Nézd meg a postaládád.',
    });
    expect(inngestSend).toHaveBeenCalledWith({
      name: 'subscriber.confirm-send',
      data: { subscriberId: 'sub-new' },
    });
  });

  it('an ALREADY ACTIVE address gets the SAME 201 and NO confirmation message (FR-043, FR-090)', async () => {
    selectResult = [
      { id: 'sub-1', status: 'active', emailEnc: 'enc', purgePiiAt: null, confirmLastSentAt: null },
    ];
    const res = await post(VALID);
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      message: 'Elküldtük a megerősítő levelet. Nézd meg a postaládád.',
    });
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it('an ERASED address gets the SAME 201 and no second confirmation message (FR-043, FR-045)', async () => {
    selectResult = [
      {
        id: 'sub-2',
        status: 'unsubscribed',
        emailEnc: null,
        purgePiiAt: new Date('2026-01-01'),
        confirmLastSentAt: null,
      },
    ];
    const res = await post(VALID);
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      message: 'Elküldtük a megerősítő levelet. Nézd meg a postaládád.',
    });
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it('a pending address INSIDE the cooldown sends nothing but returns the same 201 (FR-090)', async () => {
    selectResult = [
      {
        id: 'sub-3',
        status: 'pending',
        emailEnc: 'enc',
        purgePiiAt: null,
        confirmLastSentAt: new Date(Date.now() - 60_000), // 1 perce
      },
    ];
    const res = await post(VALID);
    expect(res.status).toBe(201);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it('a pending address PAST the cooldown does get a new confirmation job', async () => {
    selectResult = [
      {
        id: 'sub-4',
        status: 'pending',
        emailEnc: 'enc',
        purgePiiAt: null,
        confirmLastSentAt: new Date(Date.now() - 30 * 60_000), // 30 perce
      },
    ];
    const res = await post(VALID);
    expect(res.status).toBe(201);
    expect(inngestSend).toHaveBeenCalledWith({
      name: 'subscriber.confirm-send',
      data: { subscriberId: 'sub-4' },
    });
  });

  it('a complained address is terminal — the same 201, nothing sent (FR-055)', async () => {
    selectResult = [
      { id: 'sub-5', status: 'complained', emailEnc: 'enc', purgePiiAt: null, confirmLastSentAt: null },
    ];
    const res = await post(VALID);
    expect(res.status).toBe(201);
    expect(inngestSend).not.toHaveBeenCalled();
  });
});
