import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/** 012-reader-subscriptions — C1, C9, C10, C11 és FR-076…FR-078. */
const statements: string[] = [];
let rowsFor: (text: string) => Array<Record<string, unknown>> = () => [];

function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
  let text = '';
  for (const chunk of chunks) {
    const value = (chunk as { value?: unknown } | undefined)?.value;
    if (Array.isArray(value)) text += value.join('');
    else if (typeof chunk === 'string') text += chunk;
  }
  return text;
}

const dbStub = {
  execute: vi.fn(async (query: unknown): Promise<unknown[]> => {
    const text = sqlText(query);
    statements.push(text);
    return rowsFor(text);
  }),
};

vi.mock('@/lib/db', () => ({ getDb: () => dbStub, schema: {} }));

const maybeSendHealthAlert = vi.fn(async () => true);
const recordHealthRun = vi.fn(async () => previousRun);
let previousRun: Date | null = null;

vi.mock('@korr/db/subscription-health-alert', () => ({
  maybeSendHealthAlert,
  recordHealthRun,
}));

const CRON_SECRET = 'test-cron-secret';

async function call(auth = true): Promise<Response> {
  const mod = await import('../../app/api/cron/subscription-health/route');
  return mod.GET(
    new Request('http://localhost/api/cron/subscription-health', {
      headers: auth ? { authorization: `Bearer ${CRON_SECRET}` } : {},
    }),
  );
}

beforeEach(() => {
  statements.length = 0;
  previousRun = new Date();
  rowsFor = () => [];
  maybeSendHealthAlert.mockClear();
  recordHealthRun.mockClear();
  recordHealthRun.mockImplementation(async () => previousRun);
  process.env.CRON_SECRET = CRON_SECRET;
  delete process.env.TELEGRAM_PUBLIC_CHANNEL_ID;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.TELEGRAM_PUBLIC_CHANNEL_ID;
});

describe('authorisation (C1)', () => {
  it('returns 401 without the cron header', async () => {
    const res = await call(false);
    expect(res.status).toBe(401);
    expect(recordHealthRun).not.toHaveBeenCalled();
  });
});

describe('the heartbeat (C9, FR-078)', () => {
  it('writes lastRunAt on a run where nothing fires', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(recordHealthRun).toHaveBeenCalled();
    const body = (await res.json()) as { reasons: string[]; alerted: boolean };
    expect(body.reasons).toEqual([]);
    expect(body.alerted).toBe(false);
  });

  it('reports the gap when the check itself has not run for over 26 hours', async () => {
    previousRun = new Date(Date.now() - 27 * 60 * 60_000);
    const res = await call();
    const body = (await res.json()) as { reasons: string[] };
    expect(body.reasons.join(' ')).toContain('nem futott');
  });

  it('does NOT report a gap at 25 hours — the threshold deliberately spans a day boundary', async () => {
    previousRun = new Date(Date.now() - 25 * 60 * 60_000);
    const res = await call();
    const body = (await res.json()) as { reasons: string[] };
    expect(body.reasons).toEqual([]);
  });

  it('reads the heartbeat before writing it, or the gap would never be visible', async () => {
    // A `recordHealthRun` az, ami az előző értéket visszaadja; a route erre
    // épít. Ha a route a saját írása UTÁN olvasna, a rés mindig nulla lenne.
    previousRun = new Date(Date.now() - 30 * 60 * 60_000);
    await call();
    expect(recordHealthRun).toHaveBeenCalledTimes(1);
  });
});

describe('the stale-alert condition is suppressed by the kill switch (C11, FR-077)', () => {
  it('does not even query for stale alerts while TELEGRAM_PUBLIC_CHANNEL_ID is unset', async () => {
    rowsFor = (text) => (text.includes('SubscriberAlert') ? [{ n: 99 }] : []);
    const res = await call();
    const body = (await res.json()) as { reasons: string[] };
    expect(body.reasons.join(' ')).not.toContain('kiposztolásra');
    expect(statements.some((s) => s.includes('SubscriberAlert'))).toBe(false);
  });

  it('DOES fire once the channel is configured and rows are stale', async () => {
    process.env.TELEGRAM_PUBLIC_CHANNEL_ID = '-1009999';
    rowsFor = (text) => (text.includes('SubscriberAlert') ? [{ n: 5 }] : []);
    const res = await call();
    const body = (await res.json()) as { reasons: string[] };
    expect(body.reasons.join(' ')).toContain('kiposztolásra');
  });
});

describe('two firing conditions produce exactly one Telegram send (C10, FR-075)', () => {
  it('joins every reason into one call to the daily-marker helper', async () => {
    process.env.TELEGRAM_PUBLIC_CHANNEL_ID = '-1009999';
    previousRun = new Date(Date.now() - 40 * 60 * 60_000);
    rowsFor = (text) => {
      if (text.includes('SubscriberAlert')) return [{ n: 3 }];
      if (text.includes('"Digest"') && text.includes('awaiting_approval')) return [{ n: 1 }];
      return [];
    };
    const res = await call();
    const body = (await res.json()) as { reasons: string[] };
    expect(body.reasons.length).toBeGreaterThan(1);
    expect(maybeSendHealthAlert).toHaveBeenCalledTimes(1);
  });
});

describe('the ledger reconcile compares the ledger against ITSELF (FR-076)', () => {
  it('fires when today reserved more than ten over what it actually sent', async () => {
    rowsFor = (text) =>
      text.includes('EmailSendLedger') ? [{ reservedCount: 40, sentCount: 20 }] : [];
    const res = await call();
    const body = (await res.json()) as { reasons: string[] };
    expect(body.reasons.join(' ')).toContain('meghaladja a tényleges küldést');
  });

  it('stays quiet at a gap of exactly ten', async () => {
    rowsFor = (text) =>
      text.includes('EmailSendLedger') ? [{ reservedCount: 30, sentCount: 20 }] : [];
    const res = await call();
    const body = (await res.json()) as { reasons: string[] };
    expect(body.reasons).toEqual([]);
  });

  it('never reads Digest.sentCount for this comparison', async () => {
    rowsFor = (text) =>
      text.includes('EmailSendLedger') ? [{ reservedCount: 40, sentCount: 20 }] : [];
    await call();
    const reconcile = statements.find((s) => s.includes('EmailSendLedger'))!;
    expect(reconcile).not.toContain('Digest');
  });
});

describe('the stranded-pending condition (beyond FR-076\'s five)', () => {
  it('fires when a pending subscriber never received their confirmation', async () => {
    rowsFor = (text) =>
      text.includes('"Subscriber"') && text.includes('confirmSentCount') ? [{ n: 2 }] : [];
    const res = await call();
    const body = (await res.json()) as { reasons: string[] };
    expect(body.reasons.join(' ')).toContain('soha nem kapta meg');
  });
});
