import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/** 012-reader-subscriptions — E4, E5, E6 a contracts/resend-webhook.md szerint. */
type Update = Record<string, unknown>;

const updates: Update[] = [];
let selectResult: Array<Record<string, unknown>> = [];

const dbStub = {
  select: vi.fn(() => ({
    from: () => ({ where: () => ({ limit: async () => selectResult }) }),
  })),
  update: vi.fn(() => ({
    set: (values: Update) => ({
      where: async () => {
        updates.push(values);
      },
    }),
  })),
};

vi.mock('@/lib/db', () => ({
  getDb: () => dbStub,
  schema: new Proxy({}, { get: () => new Proxy({}, { get: () => 'col' }) }),
}));

const SECRET_B64 = Buffer.from('a-webhook-secret-for-tests').toString('base64');

function sign(id: string, timestamp: string, body: string): string {
  const mac = createHmac('sha256', Buffer.from(SECRET_B64, 'base64'))
    .update(`${id}.${timestamp}.${body}`, 'utf8')
    .digest('base64');
  return `v1,${mac}`;
}

async function post(
  body: string,
  overrides: { id?: string; timestamp?: string; signature?: string } = {},
): Promise<Response> {
  const id = overrides.id ?? 'msg_1';
  const timestamp = overrides.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = overrides.signature ?? sign(id, timestamp, body);
  const mod = await import('../../app/api/webhooks/resend/route');
  return mod.POST(
    new Request('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'svix-id': id,
        'svix-timestamp': timestamp,
        'svix-signature': signature,
      },
      body,
    }),
  );
}

beforeEach(() => {
  updates.length = 0;
  selectResult = [{ id: 'sub-1', status: 'active', bounceCount: 0 }];
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${SECRET_B64}`;
});

afterEach(() => {
  delete process.env.RESEND_WEBHOOK_SECRET;
});

describe('Svix verification (E4, FR-055)', () => {
  const body = JSON.stringify({ type: 'email.delivered', data: { to: 'a@b.hu' } });

  it('passes on a known-good fixture', async () => {
    const res = await post(body);
    expect(res.status).toBe(200);
  });

  it('fails on a tampered body', async () => {
    const id = 'msg_1';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(id, timestamp, body);
    const res = await post(body.replace('a@b.hu', 'evil@b.hu'), { id, timestamp, signature });
    expect(res.status).toBe(400);
  });

  it('fails on a tampered signature', async () => {
    const res = await post(body, { signature: `v1,${Buffer.alloc(32, 9).toString('base64')}` });
    expect(res.status).toBe(400);
  });

  it('fails on a timestamp outside the ±5-minute window', async () => {
    const stale = String(Math.floor(Date.now() / 1000) - 6 * 60);
    const res = await post(body, { timestamp: stale, signature: sign('msg_1', stale, body) });
    expect(res.status).toBe(400);
  });

  it('fails on a missing header', async () => {
    const mod = await import('../../app/api/webhooks/resend/route');
    const res = await mod.POST(
      new Request('http://localhost/api/webhooks/resend', { method: 'POST', body }),
    );
    expect(res.status).toBe(400);
  });

  it('REFUSES everything when RESEND_WEBHOOK_SECRET is unset — never accepts unverified', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(updates).toEqual([]);
  });

  it('guards a signature of the wrong length instead of throwing', async () => {
    const res = await post(body, { signature: `v1,${Buffer.alloc(8, 1).toString('base64')}` });
    expect(res.status).toBe(400);
  });
});

describe('E5 — the raw body is read before parsing', () => {
  it('verifies a fixture whose JSON re-serialises differently than it arrived', async () => {
    // Ez a törzs szóközökkel és MÁS kulcssorrenddel érkezik, mint amit a
    // JSON.stringify kiadna. Ha a route parse-olna, majd újraszerializálna,
    // az aláírás elbukna.
    const odd = '{\n  "data": { "to": "a@b.hu" },\n  "type": "email.delivered"\n}';
    expect(JSON.stringify(JSON.parse(odd))).not.toBe(odd);
    const res = await post(odd);
    expect(res.status).toBe(200);
  });
});

describe('the bounce state machine (E6, FR-055)', () => {
  it('a hard bounce sets bounced', async () => {
    const body = JSON.stringify({
      type: 'email.bounced',
      data: { to: 'a@b.hu', bounce: { type: 'Permanent hard bounce' } },
    });
    await post(body);
    expect(updates[0]).toMatchObject({ status: 'bounced' });
  });

  it('a first soft bounce only counts — it does not suppress', async () => {
    selectResult = [{ id: 'sub-1', status: 'active', bounceCount: 0 }];
    const body = JSON.stringify({
      type: 'email.bounced',
      data: { to: 'a@b.hu', bounce: { type: 'Transient soft bounce' } },
    });
    await post(body);
    expect(updates[0]).not.toHaveProperty('status');
  });

  it('the THIRD soft bounce suppresses', async () => {
    selectResult = [{ id: 'sub-1', status: 'active', bounceCount: 2 }];
    const body = JSON.stringify({
      type: 'email.bounced',
      data: { to: 'a@b.hu', bounce: { type: 'Transient soft bounce' } },
    });
    await post(body);
    expect(updates[0]).toMatchObject({ status: 'bounced' });
  });

  it('E6 — a complaint sets complained, and a later delivered event does NOT clear it', async () => {
    await post(JSON.stringify({ type: 'email.complained', data: { to: 'a@b.hu' } }));
    expect(updates[0]).toEqual({ status: 'complained' });

    selectResult = [{ id: 'sub-1', status: 'complained', bounceCount: 0 }];
    updates.length = 0;
    await post(JSON.stringify({ type: 'email.delivered', data: { to: 'a@b.hu' } }));
    expect(updates).toEqual([]);
  });

  it('a bounce after a complaint does not overwrite the terminal state', async () => {
    selectResult = [{ id: 'sub-1', status: 'complained', bounceCount: 0 }];
    await post(
      JSON.stringify({
        type: 'email.bounced',
        data: { to: 'a@b.hu', bounce: { type: 'hard' } },
      }),
    );
    expect(updates).toEqual([]);
  });

  it('an unknown address is a no-op with 200 — it reveals nothing about the list', async () => {
    selectResult = [];
    const res = await post(
      JSON.stringify({ type: 'email.bounced', data: { to: 'nincs@ilyen.hu', bounce: { type: 'hard' } } }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(updates).toEqual([]);
  });

  it('looks the row up by the address hash and never persists the raw address', async () => {
    const body = JSON.stringify({ type: 'email.complained', data: { to: '  A@B.HU ' } });
    await post(body);
    for (const update of updates) {
      expect(JSON.stringify(update)).not.toContain('@');
    }
  });
});
