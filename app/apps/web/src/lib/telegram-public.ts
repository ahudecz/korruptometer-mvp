import 'server-only';

/**
 * 012-reader-subscriptions — a NYILVÁNOS Telegram-csatorna küldője (FR-020…FR-022).
 *
 * Ez a modul SZÁNDÉKOSAN nem vesz át `replyMarkup` paramétert. Nem mulasztás:
 * a szerkesztői "Jóváhagy / Elutasít" billentyűzet így szerkezetileg képtelen
 * nyilvános közönség elé kerülni (FR-021). Ha valaki egyszer gombot akar tenni
 * a csatornába, azt itt kell megnyitnia — és akkor legalább látja, mit nyit meg.
 *
 * Sima szöveg, `parse_mode` nélkül: a bejegyzések címei tartalmazhatnak
 * aláhúzást, csillagot és szögletes zárójelet, amit a Markdown- vagy
 * HTML-értelmezés elrontana vagy elutasítana.
 */

/** A csatorna üzenet-küldési sebességkorlátja (FR-026). Nem betűszerinti szám sehol máshol. */
export const TELEGRAM_CHANNEL_RATE = 20; // üzenet / perc

/** Két üzenet közti minimális szünet ezredmásodpercben, a fenti korlátból. */
export const TELEGRAM_CHANNEL_MIN_GAP_MS = Math.ceil(60_000 / TELEGRAM_CHANNEL_RATE);

/** A Telegram sebesség-visszautasításának státuszkódja. */
export const TELEGRAM_RATE_LIMIT_STATUS = 429;

export class TelegramRateLimitError extends Error {
  constructor() {
    super('telegram_rate_limited');
    this.name = 'TelegramRateLimitError';
  }
}

/**
 * Kiposztol egy sima szöveges üzenetet a nyilvános csatornára.
 *
 * `TELEGRAM_PUBLIC_CHANNEL_ID` nélkül `null`-lal tér vissza, HÁLÓZATI HÍVÁS
 * NÉLKÜL — ez a működő kikapcsoló (FR-022).
 *
 * 429 esetén `TelegramRateLimitError`-t dob, hogy a hívó flush megállhasson és
 * a következő ütemezett futás folytathassa a még nem foglalt sorokról (FR-027).
 */
export async function sendPublicChannelMessage(text: string): Promise<number | null> {
  const channelId = process.env.TELEGRAM_PUBLIC_CHANNEL_ID;
  if (!channelId) return null;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: channelId, text, disable_web_page_preview: false }),
  });
  if (res.status === TELEGRAM_RATE_LIMIT_STATUS) throw new TelegramRateLimitError();
  const data = (await res.json().catch(() => null)) as { result?: { message_id?: number } } | null;
  return data?.result?.message_id ?? null;
}

/** A csatorna be van-e kapcsolva. A flush ezt olvassa el, mielőtt bármit foglalna. */
export function isPublicChannelConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_PUBLIC_CHANNEL_ID);
}
