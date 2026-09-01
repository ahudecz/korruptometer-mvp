import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** 012-reader-subscriptions — E7 és E8 a contracts/resend-webhook.md szerint. */
type Row = Record<string, number>;

const statements: string[] = [];
let reserved = 0;
let sent = 0;

/**
 * A drizzle `sql` sablon szöveggé és paraméterekké bontása. Így a teszt a
 * TÉNYLEGESEN kiadott utasításra állít, nem egy stringgé szerializált objektum
 * véletlen alakjára.
 */
function readQuery(query: unknown): { text: string; params: number[] } {
  const chunks = (query as { queryChunks: unknown[] }).queryChunks ?? [];
  let text = '';
  const params: number[] = [];
  for (const chunk of chunks) {
    if (chunk && typeof chunk === 'object' && Array.isArray((chunk as { value?: unknown }).value)) {
      text += ((chunk as { value: string[] }).value).join('');
    } else if (typeof chunk === 'number') {
      params.push(chunk);
      text += '?';
    }
  }
  return { text, params };
}

const db = {
  execute: vi.fn(async (query: unknown): Promise<Row[]> => {
    const { text, params } = readQuery(query);
    statements.push(text);
    if (text.includes('INSERT INTO')) {
      reserved += params[0] ?? 0;
      return [{ reservedCount: reserved }];
    }
    if (text.includes('GREATEST(0, "reservedCount"')) {
      reserved = Math.max(0, reserved - (params[0] ?? 0));
      return [];
    }
    if (text.includes('"sentCount" = "sentCount"')) {
      sent += params[0] ?? 0;
      return [];
    }
    if (text.includes("date_trunc('month'")) return [{ n: sent }];
    return [{ reservedCount: reserved, sentCount: sent }];
  }),
};

beforeEach(() => {
  statements.length = 0;
  reserved = 0;
  sent = 0;
  db.execute.mockClear();
});

afterEach(() => {
  vi.resetModules();
});

describe('the capacity expression (E7, FR-048, FR-051)', () => {
  it('with reservedCount = 20, remaining is min(90, 100 − 20 − 10) = 70', async () => {
    const { remainingDigestCapacity } = await import('./email-send-ledger');
    reserved = 20;
    await expect(remainingDigestCapacity(db)).resolves.toBe(70);
  });

  it('the DIGEST_DAILY_SEND_CAP binds when the day is still empty: min(90, 100 − 0 − 10) = 90', async () => {
    const { remainingDigestCapacity } = await import('./email-send-ledger');
    reserved = 0;
    await expect(remainingDigestCapacity(db)).resolves.toBe(90);
  });

  it('never returns a negative capacity', async () => {
    const { remainingDigestCapacity } = await import('./email-send-ledger');
    reserved = 999;
    await expect(remainingDigestCapacity(db)).resolves.toBe(0);
  });

  it('reads reservedCount and NEVER sentCount — only reservations bound concurrent senders', async () => {
    const { remainingDigestCapacity } = await import('./email-send-ledger');
    reserved = 20;
    sent = 0;
    await remainingDigestCapacity(db);
    const read = statements.find((s) => s.includes('EmailSendLedger'))!;
    expect(read).toContain('reservedCount');
    expect(read).not.toContain('sentCount');
  });

  it('every date comes from the database current_date, never from the process clock (FR-050)', async () => {
    const { remainingDigestCapacity, reserveSendBudget, releaseSendBudget, recordSent } =
      await import('./email-send-ledger');
    await remainingDigestCapacity(db);
    await reserveSendBudget(db, 5);
    await releaseSendBudget(db, 5);
    await recordSent(db, 5);
    for (const stmt of statements) expect(stmt).toContain('current_date');
  });
});

describe('reserve and release (E8)', () => {
  it('a failed batch releases exactly what it reserved — reservedCount returns to its prior value', async () => {
    const { reserveSendBudget, releaseSendBudget } = await import('./email-send-ledger');
    reserved = 12;
    const got = await reserveSendBudget(db, 8);
    expect(got).toBe(8);
    expect(reserved).toBe(20);
    await releaseSendBudget(db, got);
    expect(reserved).toBe(12);
  });

  it('gives back the over-cap remainder in the same request', async () => {
    const { reserveSendBudget } = await import('./email-send-ledger');
    reserved = 95;
    const got = await reserveSendBudget(db, 20);
    // A mennyezet min(90 + 10, 100) = 100; a 95-ből csak 5 fér bele.
    expect(got).toBe(5);
    expect(reserved).toBe(100);
  });

  it('releasing never drives the counter below zero', async () => {
    const { releaseSendBudget } = await import('./email-send-ledger');
    reserved = 2;
    await releaseSendBudget(db, 50);
    expect(reserved).toBe(0);
  });

  it('reserving nothing touches no statement', async () => {
    const { reserveSendBudget } = await import('./email-send-ledger');
    await expect(reserveSendBudget(db, 0)).resolves.toBe(0);
    expect(statements).toEqual([]);
  });
});

describe('the monthly ceiling (FR-053)', () => {
  it('is evaluated from the running month total, per batch', async () => {
    const { monthlyRemaining } = await import('./email-send-ledger');
    sent = 2790;
    await expect(monthlyRemaining(db)).resolves.toBe(210);
  });

  it('does not bind at 90 a day: 90 × 31 = 2790, under 3000', async () => {
    const { monthlyRemaining } = await import('./email-send-ledger');
    sent = 90 * 31;
    await expect(monthlyRemaining(db)).resolves.toBeGreaterThan(0);
  });
});
