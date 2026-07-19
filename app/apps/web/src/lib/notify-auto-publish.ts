import 'server-only';

import { pinChatMessage, sendTelegramMessage, type InlineKeyboardMarkup } from './telegram';

/**
 * 2026-07-14 — a companion to notify.ts's notifyReviewNeeded(), for the
 * OPPOSITE situation: a detector already auto-published something (no human
 * saw it first) and the user wants a chance to revert it after the fact.
 *
 * Scoped to CourtVerdict / AssetRecovery / WatchlistRemoval only —
 * PoliticalResignation doesn't need this: watchlist people now always go
 * through the existing pending-review flow (decideStatus's isWatchlist
 * fix), and the user explicitly does NOT want a ping for every
 * non-watchlist resignation (a small-town official is noise; Sulyok Tamás
 * is not). If CourtVerdict/AssetRecovery volume grows enough that this
 * becomes noisy too, add a similar isWatchlistPerson() gate at the call
 * site — this function itself doesn't need to change.
 */
export type AutoPublishTarget = 'court_verdict' | 'asset_recovery' | 'watchlist_removal';

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
};

// callback_data codes — see AUTO_PUBLISH_CODE_TABLE in the webhook route.
const TARGET_CODES: Record<AutoPublishTarget, string> = {
  court_verdict: 'c',
  asset_recovery: 'x',
  watchlist_removal: 'w',
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
    // ami zajosabb lenne, mint amennyit segít.
    if (messageId && event.target === 'watchlist_removal') {
      await pinChatMessage(messageId);
    }
  } catch {
    // Never let a notification-delivery problem affect the caller.
  }
}
