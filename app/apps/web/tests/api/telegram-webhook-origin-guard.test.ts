import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * 012-reader-subscriptions FR-005 / V1 — a `callback_query` ág eredet-ellenőrzése.
 *
 * A bizonyíték: IDEGEN chatből érkező gombnyomás ZÉRÓ `getDb()` hívást végez.
 * Nem a válasz státuszát nézzük (az mindig `{ ok: true }`, hogy a Telegram ne
 * ismételje az update-et), hanem azt, hogy az adatbázis felé egyáltalán elindult-e
 * bármi.
 */
const getDb = vi.fn(() => {
  throw new Error('getDb() must not be reached for an unauthorised callback_query');
});

vi.mock('@/lib/db', () => ({
  getDb,
  schema: new Proxy({}, { get: () => ({}) }),
}));

vi.mock('@/lib/telegram', () => ({
  answerCallbackQuery: vi.fn(async () => undefined),
  editMessageCaption: vi.fn(async () => undefined),
  editMessageReplyMarkup: vi.fn(async () => undefined),
  sendTelegramMessage: vi.fn(async () => 1),
  sendTelegramPhoto: vi.fn(async () => 1),
}));

vi.mock('@/lib/facebook', () => ({ postPhotoToPage: vi.fn() }));
vi.mock('@/lib/make-facebook', () => ({ postPhotoViaMake: vi.fn() }));
vi.mock('@/lib/social-image', () => ({ regenerateOutboxImage: vi.fn() }));
vi.mock('@/inngest/functions/check-social-triggers', () => ({ approvalKeyboard: vi.fn(() => ({ inline_keyboard: [] })) }));
vi.mock('@/lib/telegram-review-actions', () => ({
  applyWatchlistRemoval: vi.fn(),
  checkWatchlistRemovalForArticle: vi.fn(),
  DETECTOR_PROCESSORS: {},
  findWatchlistCandidates: vi.fn(() => []),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const WEBHOOK_SECRET = 'test-webhook-secret';
const EDITOR_CHAT_ID = '-1001234567890';

async function press(chatId: number, data = 'v:c:some-record-id'): Promise<Response> {
  const mod = await import('../../app/api/telegram/webhook/route');
  return mod.POST(
    new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        callback_query: {
          id: 'cb-1',
          data,
          message: { chat: { id: chatId }, message_id: 42, text: 'régi szöveg' },
        },
      }),
    }),
  );
}

beforeEach(() => {
  getDb.mockClear();
  process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.TELEGRAM_CHAT_ID = EDITOR_CHAT_ID;
});

afterEach(() => {
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.TELEGRAM_CHAT_ID;
});

describe('POST /api/telegram/webhook — callback_query origin guard (FR-005)', () => {
  it('performs zero database calls for a button press from a foreign chat', async () => {
    const res = await press(999_999_999);
    expect(res.status).toBe(200);
    expect(getDb).not.toHaveBeenCalled();
  });

  it('performs zero database calls for EVERY button press when TELEGRAM_CHAT_ID is unset', async () => {
    delete process.env.TELEGRAM_CHAT_ID;
    for (const data of ['v:c:id', 'k:x:id', 'd:r:id', 'a:r:id', 'r:r:id', 'n:g:id', 's:ap:id', 'a:wc:person']) {
      const res = await press(Number(EDITOR_CHAT_ID), data);
      expect(res.status).toBe(200);
    }
    expect(getDb).not.toHaveBeenCalled();
  });

  it('rejects an unauthorised chat for every callback prefix the bot answers', async () => {
    for (const data of ['v:c:id', 'k:x:id', 'd:r:id', 'a:r:id', 'r:r:id', 'n:g:id', 's:ap:id', 'a:wc:person']) {
      const res = await press(123, data);
      expect(res.status).toBe(200);
    }
    expect(getDb).not.toHaveBeenCalled();
  });
});
