import 'server-only';

import { sendTelegramMessage, type InlineKeyboardMarkup } from './telegram';

/**
 * 006-detection-pipeline-reliability (US4) — a single, channel-independent
 * seam for "a human should look at this" events from the 4 LLM detectors.
 * 2026-07-12 (008-telegram-review-bot): wired to the Kegyencjárat Alert
 * Telegram bot with interactive Approve/Reject inline buttons — no-op/
 * log-only if TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID are unset (local dev).
 *
 * FR-008: this function MUST NEVER throw and MUST NEVER fail a detector's
 * Inngest step — a notification-delivery problem is not a reason to lose or
 * retry a correctly-processed detection.
 */
export type ReviewNeededEvent = {
  /** 'pending' = a 0.70–0.8999 confidence detection awaiting editor review (003).
   *  'near_miss' = a 0.50–0.6999 discard worth a second human look (006). */
  type: 'pending' | 'near_miss';
  detectorType: 'resignation' | 'media_closure' | 'court_verdict' | 'asset_recovery';
  name: string;
  confidence: number;
  articleUrl: string;
  /** NewsArticle.id — always set. Needed by the webhook (008) to re-run
   *  extraction for a 'near_miss' approval, since nothing beyond
   *  name/confidence survives past the in-memory detector result. */
  articleId: string;
  /** The already-inserted row's id — only set for 'pending' events (the
   *  three reviewStatus-bearing tables). Lets the webhook flip
   *  reviewStatus directly instead of re-extracting. */
  recordId?: string;
};

const DETECTOR_LABELS_HU: Record<ReviewNeededEvent['detectorType'], string> = {
  resignation: 'Lemondás/kirúgás',
  media_closure: 'Médium megszűnés',
  court_verdict: 'Bírósági ítélet',
  asset_recovery: 'Vagyonvisszaszerzés',
};

// callback_data detector shorthand — keeps "{action}:{code}:{id}" well
// under Telegram's 64-byte callback_data limit.
const DETECTOR_CODES: Record<ReviewNeededEvent['detectorType'], string> = {
  resignation: 'r',
  media_closure: 'm',
  court_verdict: 'c',
  asset_recovery: 'x',
};

export async function notifyReviewNeeded(event: ReviewNeededEvent): Promise<void> {
  try {
    const typeLabel = event.type === 'pending' ? 'ÁTNÉZENDŐ' : 'MAJDNEM KIMARADT';
    const message = [
      `🔔 ${typeLabel} — ${DETECTOR_LABELS_HU[event.detectorType]}`,
      `${event.name} (bizonyosság: ${(event.confidence * 100).toFixed(0)}%)`,
    ].join('\n');
    console.log(`[notify] ${event.type} (${event.detectorType}): ${event.name} — confidence ${event.confidence.toFixed(2)} — ${event.articleUrl}`);

    const code = DETECTOR_CODES[event.detectorType];
    const actionId = event.recordId ?? event.articleId;
    const replyMarkup: InlineKeyboardMarkup = {
      inline_keyboard: [
        ...(event.articleUrl ? [[{ text: '📄 Cikk megnyitása', url: event.articleUrl }]] : []),
        [
          { text: '✅ Jóváhagyom', callback_data: `a:${code}:${actionId}` },
          { text: '❌ Elutasítom', callback_data: `r:${code}:${actionId}` },
        ],
      ],
    };

    await sendTelegramMessage(message, replyMarkup);
  } catch {
    // Never let a notification-delivery problem affect the caller.
  }
}
