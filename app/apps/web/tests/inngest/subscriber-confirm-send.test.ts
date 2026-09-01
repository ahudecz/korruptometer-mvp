import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * 012-reader-subscriptions FR-037, FR-038, FR-052, FR-080.
 *
 * Az EXPORTÁLT MAGOT hívjuk közvetlenül; az Inngest-függvényt soha nem
 * futtatjuk.
 */
let dailyConfirmCount = 0;
let claimedRows: Array<Record<string, unknown>> = [];
let claimWhereText = '';

function sqlText(node: unknown, depth = 0): string {
  if (node == null || depth > 12) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map((c) => sqlText(c, depth + 1)).join('');
  const chunks = (node as { queryChunks?: unknown }).queryChunks;
  if (chunks) return sqlText(chunks, depth + 1);
  const value = (node as { value?: unknown }).value;
  if (Array.isArray(value)) return value.join('');
  const name = (node as { name?: string }).name;
  if (typeof name === 'string') return name;
  return '';
}

const auditRows: Array<Record<string, unknown>> = [];

const dbStub = {
  execute: vi.fn(async () => [{ n: dailyConfirmCount }]),
  update: vi.fn(() => ({
    set: (values: Record<string, unknown>) => ({
      where: (w: unknown) => ({
        returning: async () => {
          claimWhereText = sqlText(w);
          lastSetValues = values;
          return claimedRows;
        },
      }),
    }),
  })),
  insert: vi.fn(() => ({
    values: async (v: Record<string, unknown>) => {
      auditRows.push(v);
    },
  })),
};

let lastSetValues: Record<string, unknown> = {};

vi.mock('@/lib/db', () => ({
  getDb: () => dbStub,
  schema: new Proxy({}, { get: () => new Proxy({}, { get: (_o, c: string) => c }) }),
}));

type OutgoingMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
};

const sendBatch = vi.fn(async (_messages: OutgoingMessage[]) => ({ sent: 1, failed: 0 }));
vi.mock('@korr/shared/email', () => ({
  sendBatch,
  unsubscribeHeaders: () => ({ 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }),
}));

vi.mock('@korr/shared/encryption', () => ({ decryptPii: (v: string) => `olvaso@example.hu#${v}` }));

const reserveSendBudget = vi.fn(async (_db: unknown, n: number) => n);
const releaseSendBudget = vi.fn(async () => undefined);
vi.mock('@korr/db/email-send-ledger', () => ({
  recordSent: async () => undefined,
  releaseSendBudget,
  reserveSendBudget,
}));

vi.mock('@/inngest/client', () => ({ inngest: { createFunction: () => ({}) } }));

beforeEach(() => {
  dailyConfirmCount = 0;
  claimedRows = [{ id: 'sub-1', emailEnc: 'enc' }];
  claimWhereText = '';
  auditRows.length = 0;
  lastSetValues = {};
  sendBatch.mockClear();
  reserveSendBudget.mockClear();
  releaseSendBudget.mockClear();
  process.env.RESEND_API_KEY = 're_test';
  process.env.SUBSCRIBER_LINK_SECRET = 'k1:titok-2026';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://www.kegyencjarat.hu';
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.SUBSCRIBER_LINK_SECRET;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SUBSCRIBE_CONFIRM_DAILY_CAP;
  vi.resetModules();
});

describe('the global daily confirmation cap (FR-052)', () => {
  it('stops at SUBSCRIBE_CONFIRM_DAILY_CAP, counted across every address', async () => {
    dailyConfirmCount = 50;
    const { runSubscriberConfirmSendCore } = await import('@/inngest/functions/subscriber-confirm-send');
    const result = await runSubscriberConfirmSendCore({ subscriberId: 'sub-1' });
    expect(result).toEqual({ sent: 0, skipped: 'daily_cap' });
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('sends while the day is still under the cap', async () => {
    dailyConfirmCount = 49;
    const { runSubscriberConfirmSendCore } = await import('@/inngest/functions/subscriber-confirm-send');
    await expect(runSubscriberConfirmSendCore({ subscriberId: 'sub-1' })).resolves.toEqual({ sent: 1 });
  });

  it('the cap is 50 by default — the blast radius of a successful bot run', async () => {
    const mod = await import('@/inngest/functions/subscriber-confirm-send');
    dailyConfirmCount = 50;
    await expect(mod.runSubscriberConfirmSendCore({ subscriberId: 'sub-1' })).resolves.toMatchObject({
      skipped: 'daily_cap',
    });
  });
});

describe('the per-address cap and the counter increment are one statement (FR-038)', () => {
  it('checks confirmSentCount INSIDE the claiming update, not in a separate read', async () => {
    const { runSubscriberConfirmSendCore } = await import('@/inngest/functions/subscriber-confirm-send');
    await runSubscriberConfirmSendCore({ subscriberId: 'sub-1' });
    expect(claimWhereText).toContain('confirmSentCount');
    expect(lastSetValues).toHaveProperty('confirmSentCount');
    expect(lastSetValues).toHaveProperty('confirmLastSentAt');
    expect(lastSetValues).toHaveProperty('confirmTokenHash');
  });

  it('sends nothing when the claiming update matches no row — the cap is already full', async () => {
    claimedRows = [];
    const { runSubscriberConfirmSendCore } = await import('@/inngest/functions/subscriber-confirm-send');
    const result = await runSubscriberConfirmSendCore({ subscriberId: 'sub-1' });
    expect(result).toEqual({ sent: 0, skipped: 'cap_or_not_pending' });
    expect(sendBatch).not.toHaveBeenCalled();
    expect(reserveSendBudget).not.toHaveBeenCalled();
  });

  it('only ever claims a PENDING row — an active subscriber gets no second confirmation', async () => {
    const { runSubscriberConfirmSendCore } = await import('@/inngest/functions/subscriber-confirm-send');
    await runSubscriberConfirmSendCore({ subscriberId: 'sub-1' });
    expect(claimWhereText).toContain('pending');
  });
});

describe('budget handling', () => {
  it('reserves before sending and releases when the send fails', async () => {
    sendBatch.mockResolvedValueOnce({ sent: 0, failed: 1 });
    const { runSubscriberConfirmSendCore } = await import('@/inngest/functions/subscriber-confirm-send');
    const result = await runSubscriberConfirmSendCore({ subscriberId: 'sub-1' });
    expect(result).toEqual({ sent: 0, skipped: 'send_failed' });
    expect(reserveSendBudget).toHaveBeenCalled();
    expect(releaseSendBudget).toHaveBeenCalledWith(expect.anything(), 1);
  });

  it('sends nothing at all when RESEND_API_KEY is unset', async () => {
    delete process.env.RESEND_API_KEY;
    const { runSubscriberConfirmSendCore } = await import('@/inngest/functions/subscriber-confirm-send');
    await expect(runSubscriberConfirmSendCore({ subscriberId: 'sub-1' })).resolves.toEqual({
      sent: 0,
      skipped: 'email_paused',
    });
    expect(sendBatch).not.toHaveBeenCalled();
  });
});

describe('the message itself (FR-080, FR-081, FR-042)', () => {
  it('contains NO reader-supplied text — that is what stops it carrying an attacker\'s words', async () => {
    const { runSubscriberConfirmSendCore } = await import('@/inngest/functions/subscriber-confirm-send');
    await runSubscriberConfirmSendCore({ subscriberId: 'sub-1' });
    const [message] = sendBatch.mock.calls[0]![0];
    // Az űrlap nevet és szabad szöveget nem gyűjt, tehát a levélben semmi sem
    // származhat egy beküldőtől. Csak a saját sablonunk és a token linkje.
    for (const body of [message!.text, message!.html, message!.subject]) {
      expect(body).not.toContain('<script');
    }
    expect(message!.text).toContain('/hirlevel/megerosites?t=');
  });

  it('carries the RFC 8058 one-click header', async () => {
    const { runSubscriberConfirmSendCore } = await import('@/inngest/functions/subscriber-confirm-send');
    await runSubscriberConfirmSendCore({ subscriberId: 'sub-1' });
    const [message] = sendBatch.mock.calls[0]![0];
    expect(message!.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('writes an audit row that carries no address in readable form (FR-091)', async () => {
    const { runSubscriberConfirmSendCore } = await import('@/inngest/functions/subscriber-confirm-send');
    await runSubscriberConfirmSendCore({ subscriberId: 'sub-1' });
    expect(JSON.stringify(auditRows)).not.toContain('@');
  });
});
