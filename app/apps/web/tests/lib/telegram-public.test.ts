import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  delete process.env.TELEGRAM_PUBLIC_CHANNEL_ID;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_PUBLIC_CHANNEL_ID;
});

describe('sendPublicChannelMessage (FR-021, FR-022)', () => {
  it('is the kill switch: with TELEGRAM_PUBLIC_CHANNEL_ID unset it returns null and calls no network', async () => {
    const { sendPublicChannelMessage, isPublicChannelConfigured } = await import('@/lib/telegram-public');
    expect(isPublicChannelConfigured()).toBe(false);
    await expect(sendPublicChannelMessage('bármi')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts no replyMarkup argument, so an approve/reject keyboard cannot reach the channel', async () => {
    const { sendPublicChannelMessage } = await import('@/lib/telegram-public');
    // FR-021 — a függvény aritása egy: a billentyűzet szerkezetileg nem fér el rajta.
    expect(sendPublicChannelMessage.length).toBe(1);
  });

  it('posts plain text with no parse_mode and no reply_markup when the channel is configured', async () => {
    process.env.TELEGRAM_PUBLIC_CHANNEL_ID = '-1009999';
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ result: { message_id: 7 } }) });
    const { sendPublicChannelMessage } = await import('@/lib/telegram-public');
    await expect(sendPublicChannelMessage('szöveg')).resolves.toBe(7);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.chat_id).toBe('-1009999');
    expect(body.text).toBe('szöveg');
    expect(body).not.toHaveProperty('parse_mode');
    expect(body).not.toHaveProperty('reply_markup');
  });

  it('throws TelegramRateLimitError on a 429, so the flush can stop and resume later (FR-027)', async () => {
    process.env.TELEGRAM_PUBLIC_CHANNEL_ID = '-1009999';
    fetchMock.mockResolvedValue({ status: 429, json: async () => ({}) });
    const { sendPublicChannelMessage, TelegramRateLimitError } = await import('@/lib/telegram-public');
    await expect(sendPublicChannelMessage('szöveg')).rejects.toBeInstanceOf(TelegramRateLimitError);
  });

  it('declares TELEGRAM_CHANNEL_RATE as a named constant, never a literal (FR-026)', async () => {
    const { TELEGRAM_CHANNEL_RATE, TELEGRAM_CHANNEL_MIN_GAP_MS } = await import('@/lib/telegram-public');
    expect(TELEGRAM_CHANNEL_RATE).toBe(20);
    expect(TELEGRAM_CHANNEL_MIN_GAP_MS).toBe(3000);
  });
});
