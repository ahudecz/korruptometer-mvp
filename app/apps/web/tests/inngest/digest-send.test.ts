import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * 012-reader-subscriptions — C5, C6, C7, C8 és FR-066.
 *
 * A tesztek az EXPORTÁLT MAGOT hívják közvetlenül. Az Inngest-függvényt soha
 * nem futtatjuk: a `runDigestSendCore` az, ami az állításokat viseli, és a
 * függvény burkolója csak a bypass-kaput adja hozzá.
 */
type Captured = { table: string; values: Record<string, unknown>; where?: unknown };

const updates: Captured[] = [];
let digestRow: Record<string, unknown> | null = null;
let recipientRows: Array<Record<string, unknown>> = [];
let alertRows: Array<Record<string, unknown>> = [];
let expiredRows: Array<{ id: string }> = [];
let recipientWhereText = '';

/** A drizzle `sql` sablon szöveggé bontása, hogy a WHERE-re állíthassunk. */
function sqlText(node: unknown, depth = 0): string {
  if (node == null || depth > 12) return '';
  if (typeof node === 'string') return node;
  const chunks = (node as { queryChunks?: unknown[] }).queryChunks;
  if (Array.isArray(chunks)) return chunks.map((c) => sqlText(c, depth + 1)).join('');
  const value = (node as { value?: unknown }).value;
  if (Array.isArray(value)) return value.map((v) => sqlText(v, depth + 1)).join('');
  const name = (node as { name?: string }).name;
  if (typeof name === 'string') return name;
  if (Array.isArray(node)) return node.map((c) => sqlText(c, depth + 1)).join('');
  const queryChunks = (node as { queryChunks?: unknown }).queryChunks;
  if (queryChunks) return sqlText(queryChunks, depth + 1);
  return '';
}

let selectStage: 'digest' | 'alerts' | 'recipients' = 'digest';

const dbStub = {
  execute: vi.fn(async () => []),
  select: vi.fn((cols?: Record<string, unknown>) => {
    // A kiválasztott oszlopok alapján tudjuk, melyik lekérdezés jön.
    const keys = Object.keys(cols ?? {});
    if (keys.includes('emailEnc')) selectStage = 'recipients';
    else if (keys.includes('occurredAt')) selectStage = 'alerts';
    else selectStage = 'digest';

    const stage = selectStage;
    const chain = {
      from: () => chain,
      where: (w: unknown) => {
        if (stage === 'recipients') recipientWhereText = sqlText(w);
        return chain;
      },
      orderBy: () => chain,
      limit: async () => (stage === 'digest' ? (digestRow ? [digestRow] : []) : recipientRows),
      then: (resolve: (v: unknown) => unknown) =>
        resolve(stage === 'alerts' ? alertRows : recipientRows),
    };
    return chain;
  }),
  update: vi.fn((table: unknown) => ({
    set: (values: Record<string, unknown>) => {
      const name = (table as { _?: { name?: string } })._?.name ?? 'unknown';
      const captured: Captured = { table: name, values };
      const settle = () => {
        if (!updates.includes(captured)) updates.push(captured);
        return expiredRows;
      };
      const afterWhere = {
        returning: async () => settle(),
        then: (resolve: (v: unknown) => unknown) => resolve(settle()),
      };
      return {
        where: (w: unknown) => {
          captured.where = sqlText(w);
          return afterWhere;
        },
        returning: async () => settle(),
      };
    },
  })),
};

vi.mock('@/lib/db', () => ({
  getDb: () => dbStub,
  schema: new Proxy(
    {},
    {
      get: (_t, table: string) =>
        new Proxy(
          { _: { name: table } } as Record<string, unknown>,
          { get: (o, col: string) => (col === '_' ? o._ : col) },
        ),
    },
  ),
}));

const sendBatch = vi.fn(async (msgs: unknown[]) => ({ sent: msgs.length, failed: 0 }));
vi.mock('@korr/shared/email', () => ({
  RESEND_BATCH_MAX: 100,
  sendBatch,
  unsubscribeHeaders: () => ({ 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }),
}));

vi.mock('@korr/shared/encryption', () => ({ decryptPii: (v: string) => `plain:${v}` }));

const releaseSendBudget = vi.fn(async () => undefined);
vi.mock('@korr/db/email-send-ledger', () => ({
  monthlyRemaining: async () => 3000,
  recordSent: async () => undefined,
  releaseSendBudget,
  remainingDigestCapacity: async () => 90,
  reserveSendBudget: async (_db: unknown, n: number) => n,
}));

vi.mock('@korr/db/locks', () => ({ SUBSCRIPTION_DIGEST_LOCK_INT: 8423502 }));
vi.mock('@/inngest/client', () => ({ inngest: { createFunction: () => ({}), send: vi.fn() } }));
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: vi.fn(async () => 1) }));

beforeEach(() => {
  updates.length = 0;
  digestRow = null;
  recipientRows = [];
  alertRows = [];
  expiredRows = [];
  recipientWhereText = '';
  sendBatch.mockClear();
  releaseSendBudget.mockClear();
  process.env.RESEND_API_KEY = 're_test';
  process.env.SUBSCRIBER_LINK_SECRET = 'k1:titok-2026';
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.SUBSCRIBER_LINK_SECRET;
});

describe('expiry runs before anything else (C5, FR-066)', () => {
  it('marks a 49-hour-old awaiting_approval draft expired', async () => {
    expiredRows = [{ id: 'd-old' }];
    const { runDigestSendCore } = await import('@/inngest/functions/digest-send');
    const result = await runDigestSendCore({});
    expect(result.expired).toBe(1);
    expect(updates[0]!.values).toEqual({ status: 'expired' });
  });

  it('the expiry statement only ever touches awaiting_approval, NEVER sending', async () => {
    expiredRows = [{ id: 'd-old' }];
    const { runDigestSendCore } = await import('@/inngest/functions/digest-send');
    await runDigestSendCore({});
    const expiry = updates.find((u) => u.values.status === 'expired')!;
    expect(String(expiry.where)).toContain('awaiting_approval');
    expect(String(expiry.where)).not.toContain('sending');
  });

  it('runs the expiry even when email is paused, then stops', async () => {
    delete process.env.RESEND_API_KEY;
    expiredRows = [{ id: 'd-old' }];
    const { runDigestSendCore } = await import('@/inngest/functions/digest-send');
    const result = await runDigestSendCore({});
    expect(result.expired).toBe(1);
    expect(result.skipped).toBe('email_paused');
    expect(sendBatch).not.toHaveBeenCalled();
  });
});

describe('the recipient query (C6, C7, FR-063, FR-094)', () => {
  const APPROVED = {
    id: 'd-1',
    code: 'abcd1234',
    cadence: 'weekly',
    status: 'approved',
    subjectHu: 'Tárgy',
    alertIds: [],
    periodStart: new Date('2026-08-25T00:00:00Z'),
    periodEnd: new Date('2026-09-01T00:00:00Z'),
    draftedAt: new Date('2026-09-01T00:00:00Z'),
    approvedAt: new Date(),
    sentCount: 0,
  };

  it('C6 — selects only active rows; never pending, unsubscribed, bounced or complained', async () => {
    digestRow = { ...APPROVED };
    const { runDigestSendCore } = await import('@/inngest/functions/digest-send');
    await runDigestSendCore({});
    expect(recipientWhereText).toContain('active');
    for (const forbidden of ['pending', 'unsubscribed', 'bounced', 'complained']) {
      expect(recipientWhereText).not.toContain(forbidden);
    }
  });

  it('C7 — excludes a subscriber whose confirmedAt is later than draftedAt (FR-060)', async () => {
    digestRow = { ...APPROVED };
    const { runDigestSendCore } = await import('@/inngest/functions/digest-send');
    await runDigestSendCore({});
    expect(recipientWhereText).toContain('confirmedAt');
  });

  it('FR-063 — orders the least recently served first, so the same tail is not last every week', async () => {
    digestRow = { ...APPROVED };
    const { runDigestSendCore } = await import('@/inngest/functions/digest-send');
    await runDigestSendCore({});
    // Az ORDER BY a lekérdezés-építőben van; a NULLS FIRST kikötést a
    // forráskód rögzíti, ezt a szerződéses állítást itt pinneljük.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(
        new URL('../../src/inngest/functions/digest-send.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(src).toContain('NULLS FIRST');
  });

  it('with no recipient left the digest completes: status sent and sentAt written', async () => {
    digestRow = { ...APPROVED };
    recipientRows = [];
    const { runDigestSendCore } = await import('@/inngest/functions/digest-send');
    const result = await runDigestSendCore({});
    expect(result.status).toBe('sent');
    const completion = updates.find((u) => u.values.status === 'sent')!;
    expect(completion.values).toHaveProperty('sentAt');
  });
});

describe('per-recipient cursor writes (FR-064, FR-065)', () => {
  const APPROVED = {
    id: 'd-1',
    code: 'abcd1234',
    cadence: 'weekly',
    status: 'approved',
    subjectHu: 'Tárgy',
    alertIds: ['a1'],
    periodStart: new Date('2026-08-25T00:00:00Z'),
    periodEnd: new Date('2026-09-01T00:00:00Z'),
    draftedAt: new Date('2026-09-01T00:00:00Z'),
    approvedAt: new Date(),
    sentCount: 0,
  };

  it('writes lastDigestSentAt and lastDigestCursorAt per successful recipient, not per batch', async () => {
    digestRow = { ...APPROVED };
    alertRows = [
      {
        id: 'a1',
        section: 'resignation',
        title: 'Kovács Béla',
        detail: null,
        url: 'https://x/1',
        occurredAt: new Date('2026-08-30T00:00:00Z'),
      },
    ];
    recipientRows = [
      { id: 's1', emailEnc: 'enc1', sections: ['resignation'], lastDigestCursorAt: null },
      { id: 's2', emailEnc: 'enc2', sections: ['resignation'], lastDigestCursorAt: null },
    ];

    const { runDigestSendCore } = await import('@/inngest/functions/digest-send');
    const result = await runDigestSendCore({});
    expect(result.sent).toBe(2);

    const cursorWrites = updates.filter((u) => 'lastDigestSentAt' in u.values);
    expect(cursorWrites).toHaveLength(2); // címzettenként egy, nem kötegenként egy
    for (const write of cursorWrites) {
      expect(write.values.lastDigestCursorAt).toEqual(APPROVED.periodEnd);
    }
  });

  it('a recipient with no matching item is skipped but their cursor still advances', async () => {
    digestRow = { ...APPROVED };
    alertRows = [
      {
        id: 'a1',
        section: 'court_verdict',
        title: 'X',
        detail: null,
        url: 'https://x/1',
        occurredAt: new Date('2026-08-30T00:00:00Z'),
      },
    ];
    recipientRows = [
      // csak lemondásra iratkozott fel; ítélet nem érdekli
      { id: 's1', emailEnc: 'enc1', sections: ['resignation'], lastDigestCursorAt: null },
    ];

    const { runDigestSendCore } = await import('@/inngest/functions/digest-send');
    const result = await runDigestSendCore({});
    expect(result.sent).toBe(0);
    expect(sendBatch).not.toHaveBeenCalled();
    const advanced = updates.find(
      (u) => 'lastDigestCursorAt' in u.values && !('lastDigestSentAt' in u.values),
    );
    expect(advanced?.values.lastDigestCursorAt).toEqual(APPROVED.periodEnd);
  });

  it('re-filters the frozen list for revocations at send time (FR-061)', async () => {
    digestRow = { ...APPROVED, alertIds: ['a1', 'a2'] };
    // Csak a1 jön vissza: az a2 vissza lett vonva a piszkozat óta.
    alertRows = [
      {
        id: 'a1',
        section: 'resignation',
        title: 'Marad',
        detail: null,
        url: 'https://x/1',
        occurredAt: new Date('2026-08-30T00:00:00Z'),
      },
    ];
    recipientRows = [
      { id: 's1', emailEnc: 'enc1', sections: ['resignation'], lastDigestCursorAt: null },
    ];

    const { runDigestSendCore } = await import('@/inngest/functions/digest-send');
    await runDigestSendCore({});
    const body = sendBatch.mock.calls[0]![0] as Array<{ text: string }>;
    expect(body[0]!.text).toContain('Marad');
    expect(body[0]!.text).not.toContain('a2');
  });
});
