import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * 012-reader-subscriptions FR-019 — a visszavonás MINDKÉT törlési útvonalon.
 *
 * A `watchlist_removal` dedup-kulcsa a SZEMÉLYRE épül, nem a sor
 * azonosítójára. Ha a visszavonás a sor azonosítóját adná át, sosem találná
 * meg a riasztást, és a "visszavonva" gombnyomás után is kimenne a
 * csatorna-üzenet.
 */
const revokeSubscriberAlert = vi.fn(async () => undefined);
const recordSubscriberAlert = vi.fn(async () => undefined);
const recordAlertsForRecordIds = vi.fn(async () => undefined);

vi.mock('@/lib/notify-subscribers', () => ({
  revokeSubscriberAlert,
  recordSubscriberAlert,
  recordAlertsForRecordIds,
}));

const deleted: Array<Record<string, unknown>> = [];

const dbStub = {
  delete: vi.fn(() => ({
    where: Object.assign(
      vi.fn(() => ({
        returning: vi.fn(async () => [{ personId: 'sulyok-tamas', sourceUrl: 'https://x/1' }]),
      })),
      {},
    ),
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })),
  })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
};

vi.mock('@/lib/db', () => ({
  getDb: () => dbStub,
  schema: new Proxy({}, { get: () => new Proxy({}, { get: () => 'col' }) }),
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

async function press(data: string): Promise<Response> {
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
          message: { chat: { id: Number(EDITOR_CHAT_ID) }, message_id: 42, text: 'régi szöveg' },
        },
      }),
    }),
  );
}

beforeEach(() => {
  deleted.length = 0;
  revokeSubscriberAlert.mockClear();
  recordSubscriberAlert.mockClear();
  process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.TELEGRAM_CHAT_ID = EDITOR_CHAT_ID;
});

afterEach(() => {
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.TELEGRAM_CHAT_ID;
});

describe('alert revocation on both delete paths (FR-019)', () => {
  it('the v (Visszavonás) branch revokes a watchlist alert by the personId its delete returns', async () => {
    await press('v:w:removal-row-id');
    expect(revokeSubscriberAlert).toHaveBeenCalledWith('watchlist_removal', 'sulyok-tamas');
    // A sor azonosítója SOHA nem lehet a kulcs alapja ennél a szekciónál.
    expect(revokeSubscriberAlert).not.toHaveBeenCalledWith('watchlist_removal', 'removal-row-id');
  });

  it('the v branch revokes a court verdict alert by its record id', async () => {
    await press('v:c:verdict-row-id');
    expect(revokeSubscriberAlert).toHaveBeenCalledWith('court_verdict', 'verdict-row-id');
  });

  it('the v branch revokes an asset recovery alert by its record id', async () => {
    await press('v:x:asset-row-id');
    expect(revokeSubscriberAlert).toHaveBeenCalledWith('asset_recovery', 'asset-row-id');
  });

  it('the k ("OK, marad") press alerts only for the gated sections (FR-016)', async () => {
    await press('k:c:verdict-row-id');
    // A bírósági ítélet már a detektor beszúrásánál riasztott (A2) — itt nem.
    expect(recordSubscriberAlert).not.toHaveBeenCalled();
    expect(recordAlertsForRecordIds).not.toHaveBeenCalled();
  });

  it('the k press DOES alert for an asset recovery, which has no earlier alert point', async () => {
    recordAlertsForRecordIds.mockClear();
    await press('k:x:asset-row-id');
    expect(recordAlertsForRecordIds).toHaveBeenCalledWith('asset_recovery', ['asset-row-id']);
  });
});
