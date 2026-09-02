import 'server-only';

import { pinChatMessage, sendTelegramMessage, type InlineKeyboardMarkup } from './telegram';

/**
 * 2026-07-14 — a companion to notify.ts's notifyReviewNeeded(), for the
 * OPPOSITE situation: a detector already auto-published something (no human
 * saw it first) and the user wants a chance to revert it after the fact.
 *
 * Scoped to CourtVerdict / AssetRecovery / WatchlistRemoval / a CALLED_TO_
 * RESIGN resignation — NOT the broader WATCHLIST_PERSONS set (gallery/
 * minister persons still go through the pending-review gate; a small-town
 * official is still noise this function was never meant to cover).
 *
 * 2026-09-01 user report (Polt Péter): the original design here (see git
 * history) had PoliticalResignation ALWAYS pending-gated for every watchlist
 * person, on the theory that a human reviewing the "✅/❌" Telegram buttons
 * was a real safety check. In practice that queue sat unattended all day
 * ("azt a jóváhagyást nem nézi senki", user szó szerint) while the SAME
 * fact was already auto-publishing fine on the stricter, 2-source
 * detect-watchlist-removals.ts path. Fix: the narrower CALLED_TO_RESIGN set
 * (isCalledToResignPerson(), watchlist.ts) now uses this auto-publish+notify
 * pattern too, instead of a silent 'pending' row nobody watches — see
 * detect-resignations.ts.
 */
export type AutoPublishTarget = 'court_verdict' | 'asset_recovery' | 'watchlist_removal' | 'resignation';

export type NotifyAutoPublishedEvent = {
  target: AutoPublishTarget;
  /** The row's own id in its table — what "Visszavonás" deletes. */
  recordId: string;
  name: string;
  /** One-line human-readable summary of what got published. */
  detail: string;
  articleUrl: string;
};

const TARGET_LABELS_HU: Record<AutoPublishTarget, string> = {
  court_verdict: 'Bírósági ítélet',
  asset_recovery: 'Vagyonvisszaszerzés',
  watchlist_removal: 'Lemondásra felszólított — mandátum megszűnt',
  resignation: 'Lemondás/kirúgás — kiemelt tisztségviselő',
};

// callback_data codes — see AUTO_PUBLISH_CODE_TABLE in the webhook route.
const TARGET_CODES: Record<AutoPublishTarget, string> = {
  court_verdict: 'c',
  asset_recovery: 'x',
  watchlist_removal: 'w',
  resignation: 'r',
};

export async function notifyAutoPublished(event: NotifyAutoPublishedEvent): Promise<void> {
  try {
    const message = [
      `🟢 AUTOMATIKUSAN PUBLIKÁLVA — ${TARGET_LABELS_HU[event.target]}`,
      event.name,
      event.detail,
    ].filter(Boolean).join('\n');

    const code = TARGET_CODES[event.target];
    const replyMarkup: InlineKeyboardMarkup = {
      inline_keyboard: [
        ...(event.articleUrl ? [[{ text: '📄 Forráscikk megnyitása', url: event.articleUrl }]] : []),
        [
          { text: '↩️ Visszavonás', callback_data: `v:${code}:${event.recordId}` },
          { text: '✅ OK, marad', callback_data: `k:${code}:${event.recordId}` },
        ],
      ],
    };

    const messageId = await sendTelegramMessage(message, replyMarkup);
    // 2026-07-19 — user kérés: a watchlist_removal (WATCH_LIST-es
    // tisztségviselő tényleges távozása — a legritkább, legnagyobb súlyú
    // eset ebből a 3-ból) mostantól kitűzve is marad a csoportban, nem csak
    // egy üzenet a folyamban. CourtVerdict/AssetRecovery szándékosan NEM
    // pinnelt — azok elég gyakoriak ahhoz, hogy a pin folyton lecserélődne,
    // ami zajosabb lenne, mint amennyit segít. 2026-09-01: a CALLED_TO_RESIGN
    // 'resignation' ugyanolyan ritka/nagy súlyú, mint a watchlist_removal —
    // ugyanaz a pin-szabály vonatkozik rá.
    if (messageId && (event.target === 'watchlist_removal' || event.target === 'resignation')) {
      await pinChatMessage(messageId);
    }
  } catch {
    // Never let a notification-delivery problem affect the caller.
  }
}
