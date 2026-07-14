import 'server-only';

/**
 * 008-telegram-review-bot — vékony wrapperek a Telegram Bot API felett.
 * Natív `fetch`, nincs SDK-függőség (l. plan.md Phase 0: polling-központú
 * SDK-k feleslegesen nagy súlyt adnának egy pár endpoint-híváshoz).
 */

export type InlineKeyboardButton =
  | { text: string; url: string }
  | { text: string; callback_data: string };

export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

function apiBase(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return token ? `https://api.telegram.org/bot${token}` : null;
}

export async function sendTelegramMessage(
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<number | null> {
  const base = apiBase();
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!base || !chatId) return null; // not provisioned — silent no-op
  const res = await fetch(`${base}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
  });
  const data = (await res.json().catch(() => null)) as { result?: { message_id?: number } } | null;
  return data?.result?.message_id ?? null;
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const base = apiBase();
  if (!base) return;
  await fetch(`${base}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
  });
}

export async function pinChatMessage(messageId: number): Promise<void> {
  const base = apiBase();
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!base || !chatId) return;
  await fetch(`${base}/pinChatMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, disable_notification: true }),
  });
}

export async function editMessageReplyMarkup(
  chatId: string | number,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  const base = apiBase();
  if (!base) return;
  await fetch(`${base}/editMessageText`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: replyMarkup ?? { inline_keyboard: [] },
    }),
  });
}
