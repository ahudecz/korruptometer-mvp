import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * 012-reader-subscriptions FR-068…FR-072.
 *
 * A tét a SORREND. A javított hírlevél-törzs LINKEKET tartalmaz az oldalra, és
 * a bot két másik ága is ráharapna:
 *
 * - a `firstUrl` ág hírbejelentésként nyelné le, és ötgombos
 *   review-billentyűzettel válaszolna a szerkesztőnek;
 * - a SocialPostOutbox `pendingEdit` ág — ami a legfrissebb, szerkesztésre
 *   váró sorra illeszt, és NEM nézi a `reply_to_message`-t — Facebook-
 *   képaláírásként mentené el.
 *
 * A hírlevél-ág PONTOSAN párosít, ezért fut mindkettő előtt.
 */
const socialOutboxQueried = vi.fn();
const digestUpdates: Array<Record<string, unknown>> = [];
let digestRow: Record<string, unknown> | null = null;

const dbStub = {
  select: vi.fn((cols?: Record<string, unknown>) => {
    const keys = Object.keys(cols ?? {});
    const isDigest = keys.includes('regenCount');
    const chain = {
      from: (table: unknown) => {
        const name = (table as { _?: { name?: string } })._?.name ?? '';
        if (name === 'socialPostOutbox') socialOutboxQueried();
        return chain;
      },
      where: () => chain,
      orderBy: () => chain,
      limit: async () => (isDigest ? (digestRow ? [digestRow] : []) : []),
    };
    return chain;
  }),
  update: vi.fn(() => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        digestUpdates.push(values);
      },
    }),
  })),
  insert: vi.fn(() => {
    const chain: Record<string, unknown> = {};
    chain.values = () => chain;
    chain.onConflictDoNothing = () => chain;
    chain.returning = async () => [];
    chain.then = (resolve: (v: unknown) => unknown) => resolve([]);
    return chain;
  }),
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

const sendTelegramMessage = vi.fn(async () => 999);
vi.mock('@/lib/telegram', () => ({
  answerCallbackQuery: vi.fn(async () => undefined),
  editMessageCaption: vi.fn(async () => undefined),
  editMessageReplyMarkup: vi.fn(async () => undefined),
  sendTelegramMessage,
  sendTelegramPhoto: vi.fn(async () => 1),
}));

const firstUrlSeen = vi.fn();
vi.mock('@korr/scrapers', () => ({
  canonicalUrl: (u: string) => u,
  clipExcerpt: (s: string) => s,
  dedupHash: () => 'hash',
  fetchArticleBodyTransient: vi.fn(),
  fetchPrimaryArticle: vi.fn(() => {
    firstUrlSeen();
    return null;
  }),
  getAdapter: vi.fn(),
  routeOutletByUrl: vi.fn(() => {
    firstUrlSeen();
    return null;
  }),
}));

vi.mock('@/lib/facebook', () => ({ postPhotoToPage: vi.fn() }));
vi.mock('@/lib/make-facebook', () => ({ postPhotoViaMake: vi.fn() }));
vi.mock('@/lib/social-image', () => ({ regenerateOutboxImage: vi.fn() }));
vi.mock('@/inngest/functions/check-social-triggers', () => ({
  approvalKeyboard: vi.fn(() => ({ inline_keyboard: [] })),
}));
vi.mock('@/lib/telegram-review-actions', () => ({
  applyWatchlistRemoval: vi.fn(),
  checkWatchlistRemovalForArticle: vi.fn(),
  DETECTOR_PROCESSORS: {},
  findWatchlistCandidates: vi.fn(() => []),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/inngest/client', () => ({ inngest: { send: vi.fn(async () => ({ ids: [] })) } }));

const WEBHOOK_SECRET = 'test-webhook-secret';
const EDITOR_CHAT_ID = '-1001234567890';
const APPROVAL_MESSAGE_ID = 4242;

async function reply(text: string, replyToId: number | null = APPROVAL_MESSAGE_ID) {
  const mod = await import('../../app/api/telegram/webhook/route');
  return mod.POST(
    new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        message: {
          chat: { id: Number(EDITOR_CHAT_ID) },
          message_id: 5555,
          ...(replyToId ? { reply_to_message: { message_id: replyToId } } : {}),
          text,
        },
      }),
    }),
  );
}

const CORRECTED = 'Javított törzs, benne egy link: https://www.kegyencjarat.hu/lemondasok';

beforeEach(() => {
  digestUpdates.length = 0;
  socialOutboxQueried.mockClear();
  firstUrlSeen.mockClear();
  sendTelegramMessage.mockClear();
  digestRow = { id: 'd-1', code: 'abcd1234', status: 'awaiting_approval', regenCount: 0 };
  process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.TELEGRAM_CHAT_ID = EDITOR_CHAT_ID;
});

afterEach(() => {
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.TELEGRAM_CHAT_ID;
});

describe('the corrected-text reply branch runs first (FR-069, FR-070)', () => {
  it('runs BEFORE the SocialPostOutbox pendingEdit lookup', async () => {
    await reply(CORRECTED);
    expect(socialOutboxQueried).not.toHaveBeenCalled();
  });

  it('runs BEFORE the URL detection, so a corrected body is not ingested as a news tip', async () => {
    await reply(CORRECTED);
    expect(firstUrlSeen).not.toHaveBeenCalled();
  });

  it('the corrected text becomes the digest body and consumes the regeneration budget (FR-072)', async () => {
    await reply(CORRECTED);
    const write = digestUpdates.find((u) => 'bodyText' in u)!;
    expect(write.bodyText).toBe(CORRECTED);
    expect(write.regenCount).toBe(1);
    // FR-059 — a piszkozat ideje is újraíródik, mert az dönti el, ki túl új.
    expect(write).toHaveProperty('draftedAt');
  });

  it('overwrites telegramMessageId, so a reply to the superseded message no longer matches (FR-068)', async () => {
    await reply(CORRECTED);
    const write = digestUpdates.find((u) => 'telegramMessageId' in u)!;
    expect(write.telegramMessageId).toBe(999);
  });

  it('escapes the corrected text into the HTML twin rather than embedding it raw', async () => {
    await reply('Szöveg <script>alert(1)</script> & társai');
    const write = digestUpdates.find((u) => 'bodyHtml' in u)!;
    expect(String(write.bodyHtml)).not.toContain('<script>');
    expect(String(write.bodyHtml)).toContain('&lt;script&gt;');
  });
});

describe('misses and late replies (FR-070, FR-071)', () => {
  it('a reply matching NO digest falls straight through to the existing handling', async () => {
    digestRow = null;
    await reply(CORRECTED);
    // Átesett: a régi pendingEdit-keresés lefutott, a hírlevél nem íródott.
    expect(socialOutboxQueried).toHaveBeenCalled();
    expect(digestUpdates).toEqual([]);
  });

  it('a plain message that is not a reply at all falls through too', async () => {
    await reply('Csak egy sima üzenet', null);
    expect(socialOutboxQueried).toHaveBeenCalled();
    expect(digestUpdates).toEqual([]);
  });

  it('a reply whose digest has already gone answers in Hungarian and changes nothing (FR-071)', async () => {
    digestRow = { id: 'd-1', code: 'abcd1234', status: 'sent', regenCount: 0 };
    await reply(CORRECTED);
    expect(digestUpdates).toEqual([]);
    expect(sendTelegramMessage).toHaveBeenCalledWith(
      expect.stringContaining('már elment vagy el lett vetve'),
    );
  });

  it('a second correction is refused — one rewrite, whichever mechanism (FR-072)', async () => {
    digestRow = { id: 'd-1', code: 'abcd1234', status: 'awaiting_approval', regenCount: 1 };
    await reply(CORRECTED);
    expect(digestUpdates).toEqual([]);
    expect(sendTelegramMessage).toHaveBeenCalledWith(expect.stringContaining('már volt egy átírás'));
  });
});
