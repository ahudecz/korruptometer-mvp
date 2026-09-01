import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * 012-reader-subscriptions V6 / V8 / V9 / C2 — a postaláda egységtesztjei.
 *
 * A `getDb()` beinjektált: az `execute` MINDEN hívást rögzít, hogy a
 * "kikapcsolt csatorna → NULLA utasítás" állítás bizonyítható legyen.
 */
const executed: string[] = [];
let insertShouldReject = false;

const dbStub = {
  execute: vi.fn(async (query: unknown): Promise<unknown[]> => {
    const text = JSON.stringify(query);
    executed.push(text);
    if (text.includes('count(*)')) return [{ n: 0 }];
    return [];
  }),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoNothing: vi.fn(async () => {
        if (insertShouldReject) throw new Error('injected database failure');
        executed.push('INSERT');
      }),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => {
        executed.push('UPDATE');
      }),
    })),
  })),
};

vi.mock('@/lib/db', () => ({
  getDb: () => dbStub,
  schema: {
    subscriberAlerts: { dedupeKey: 'dedupeKey' },
  },
}));

const sendPublicChannelMessage = vi.fn(async () => 1);

vi.mock('@/lib/telegram-public', async () => {
  class TelegramRateLimitError extends Error {}
  return {
    sendPublicChannelMessage,
    isPublicChannelConfigured: () => Boolean(process.env.TELEGRAM_PUBLIC_CHANNEL_ID),
    TELEGRAM_CHANNEL_MIN_GAP_MS: 0,
    TELEGRAM_CHANNEL_RATE: 20,
    TelegramRateLimitError,
  };
});

beforeEach(() => {
  executed.length = 0;
  insertShouldReject = false;
  sendPublicChannelMessage.mockClear();
  process.env.NEXT_PUBLIC_SITE_URL = 'https://www.kegyencjarat.hu';
  delete process.env.TELEGRAM_PUBLIC_CHANNEL_ID;
});

afterEach(() => {
  delete process.env.TELEGRAM_PUBLIC_CHANNEL_ID;
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe('buildAlertDedupeKey (FR-015, V6)', () => {
  it('keys watchlist_removal on the person, and everything else on the record', async () => {
    const { buildAlertDedupeKey } = await import('@/lib/notify-subscribers');
    expect(buildAlertDedupeKey('watchlist_removal', 'person-42')).toContain('person-42');
    expect(buildAlertDedupeKey('watchlist_removal', 'person-42')).not.toBe('watchlist_removal:person-42');
    expect(buildAlertDedupeKey('resignation', 'rec-1')).toBe('resignation:rec-1');
    expect(buildAlertDedupeKey('court_verdict', 'rec-1')).toBe('court_verdict:rec-1');
  });

  it('is stable — the same input always rebuilds the same key, so a revert can find the row', async () => {
    const { buildAlertDedupeKey } = await import('@/lib/notify-subscribers');
    expect(buildAlertDedupeKey('watchlist_removal', 'p1')).toBe(buildAlertDedupeKey('watchlist_removal', 'p1'));
  });
});

describe('recordSubscriberAlert (FR-013, FR-014, V8)', () => {
  it('returns normally when the injected database rejects the insert, and never throws', async () => {
    insertShouldReject = true;
    const { recordSubscriberAlert } = await import('@/lib/notify-subscribers');
    await expect(
      recordSubscriberAlert({ section: 'resignation', entityId: 'r1', title: 'Cím', url: '/lemondasok' }),
    ).resolves.toBeUndefined();
  });

  it('performs no Telegram network call on the caller path', async () => {
    const { recordSubscriberAlert } = await import('@/lib/notify-subscribers');
    await recordSubscriberAlert({ section: 'resignation', entityId: 'r1', title: 'Cím', url: '/lemondasok' });
    expect(sendPublicChannelMessage).not.toHaveBeenCalled();
  });
});

describe('flushSubscriberAlerts (FR-022, V9, C2)', () => {
  it('with the channel id unset returns { sent: 0 } and issues NO statement at all', async () => {
    const { flushSubscriberAlerts } = await import('@/lib/notify-subscribers');
    const result = await flushSubscriberAlerts();
    expect(result.sent).toBe(0);
    expect(result.paused).toBe(true);
    expect(executed).toEqual([]); // egyetlen channelSentAt sem íródott
    expect(sendPublicChannelMessage).not.toHaveBeenCalled();
  });

  it('claims one row at a time — never the whole batch before posting (FR-024)', async () => {
    process.env.TELEGRAM_PUBLIC_CHANNEL_ID = '-1009999';
    const claimed = [
      { id: 'a1', section: 'resignation', title: 'Egy', detail: null, url: 'https://x/1' },
      { id: 'a2', section: 'court_verdict', title: 'Kettő', detail: null, url: 'https://x/2' },
    ];
    dbStub.execute.mockImplementation(async (query: unknown): Promise<unknown[]> => {
      const text = JSON.stringify(query);
      executed.push(text);
      if (text.includes('count(*)')) return [{ n: 0 }];
      const next = claimed.shift();
      return next ? [next] : [];
    });

    const { flushSubscriberAlerts } = await import('@/lib/notify-subscribers');
    const result = await flushSubscriberAlerts({ max: 5 });
    expect(result.sent).toBe(2);
    expect(sendPublicChannelMessage).toHaveBeenCalledTimes(2);
    // Minden foglaló mondat LIMIT 1 — soha nem a teljes köteg.
    const claims = executed.filter((s) => s.includes('FOR UPDATE SKIP LOCKED'));
    expect(claims.length).toBeGreaterThan(0);
    for (const claim of claims) expect(claim).toContain('LIMIT 1');
  });
});

describe('formatAlertMessageHu (FR-030, FR-031)', () => {
  it('names verdict and complaint distinctly, because both link to the same page', async () => {
    const { formatAlertMessageHu } = await import('@/lib/notify-subscribers');
    const verdict = formatAlertMessageHu({ section: 'court_verdict', title: 'X', url: '' });
    const complaint = formatAlertMessageHu({ section: 'criminal_complaint', title: 'X', url: '' });
    expect(verdict).not.toBe(complaint);
    expect(verdict).toContain('Bírósági ítéletek');
    expect(complaint).toContain('Feljelentések');
  });

  it('emits the right absolute URL per section', async () => {
    const { formatAlertMessageHu } = await import('@/lib/notify-subscribers');
    expect(formatAlertMessageHu({ section: 'resignation', title: 'X', url: '' }))
      .toContain('https://www.kegyencjarat.hu/lemondasok');
    expect(formatAlertMessageHu({ section: 'court_verdict', title: 'X', url: '' }))
      .toContain('https://www.kegyencjarat.hu/birosagi-iteletek#birosagi-iteletek');
    expect(formatAlertMessageHu({ section: 'media_closure', title: 'X', url: '' }))
      .toContain('https://www.kegyencjarat.hu/megszunt');
    expect(formatAlertMessageHu({ section: 'asset_recovery', title: 'X', url: '' }))
      .toContain('https://www.kegyencjarat.hu/visszaszerzett-vagyon');
    expect(formatAlertMessageHu({ section: 'watchlist_removal', title: 'X', url: '' }))
      .toContain('https://www.kegyencjarat.hu/lemondosok');
  });

  it('includes the title and the detail line when there is one', async () => {
    const { formatAlertMessageHu } = await import('@/lib/notify-subscribers');
    const msg = formatAlertMessageHu({ section: 'resignation', title: 'Kovács Béla', detail: 'Államtitkár', url: '' });
    expect(msg).toContain('Kovács Béla');
    expect(msg).toContain('Államtitkár');
  });
});
