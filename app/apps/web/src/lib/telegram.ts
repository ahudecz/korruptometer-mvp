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

/**
 * 012-reader-subscriptions T014 — a cím szerint paraméterezhető küldő.
 *
 * A chat azonosítója az ELSŐ argumentum, nem a harmadik: a `replyMarkup` a
 * meglévő `sendTelegramMessage()`-ben a második paraméter, és nagyjából
 * negyven hívási hely támaszkodik erre. Egy harmadik paraméter csapda lenne.
 */
export async function sendTelegramMessageTo(
  chatId: string,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<number | null> {
  const base = apiBase();
  if (!base || !chatId) return null; // not provisioned — silent no-op
  const res = await fetch(`${base}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
  });
  const data = (await res.json().catch(() => null)) as { result?: { message_id?: number } } | null;
  return data?.result?.message_id ?? null;
}

export async function sendTelegramMessage(
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<number | null> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return null; // not provisioned — silent no-op
  // A visszatérő message_id-t a 012 összefoglaló-válasz ága használja, ezért a
  // delegálás NEM nyelheti el.
  return sendTelegramMessageTo(chatId, text, replyMarkup);
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

// 2026-08-30 — a check-social-triggers.ts KÉPPEL küldi a jóváhagyásra váró
// posztot (nem sima szöveggel, mint a review-bot többi üzenete), hogy a user
// egy pillantással lássa, mit posztolnánk ki. Egy fotó-üzenet caption-jét
// editMessageText NEM tudja szerkeszteni (Telegram API-limit) — ahhoz
// editMessageCaption kell, külön végpont.
export async function sendTelegramPhoto(
  photo: Buffer,
  caption: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<number | null> {
  const base = apiBase();
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!base || !chatId) return null;
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption);
  if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
  form.append('photo', new Blob([new Uint8Array(photo)], { type: 'image/png' }), 'post.png');
  const res = await fetch(`${base}/sendPhoto`, { method: 'POST', body: form });
  const data = (await res.json().catch(() => null)) as { result?: { message_id?: number } } | null;
  return data?.result?.message_id ?? null;
}

export async function editMessageCaption(
  chatId: string | number,
  messageId: number,
  caption: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  const base = apiBase();
  if (!base) return;
  await fetch(`${base}/editMessageCaption`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      caption,
      reply_markup: replyMarkup ?? { inline_keyboard: [] },
    }),
  });
}
