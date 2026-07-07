import 'server-only';

/**
 * 006-detection-pipeline-reliability (US4) — a single, channel-independent
 * seam for "a human should look at this" events from the 4 LLM detectors.
 * No channel is wired yet (Telegram bot + shared group is planned but not
 * yet provisioned) — today this is a documented no-op/log-only stub.
 *
 * FR-008: this function MUST NEVER throw and MUST NEVER fail a detector's
 * Inngest step — a notification-delivery problem is not a reason to lose or
 * retry a correctly-processed detection.
 *
 * Wiring a real channel later means adding a branch here (e.g. reading
 * TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID and calling the Bot API) — none of
 * the 4 detector functions need to change.
 */
export type ReviewNeededEvent = {
  /** 'pending' = a 0.70–0.8999 confidence detection awaiting editor review (003).
   *  'near_miss' = a 0.50–0.6999 discard worth a second human look (006). */
  type: 'pending' | 'near_miss';
  detectorType: 'resignation' | 'media_closure' | 'court_verdict' | 'asset_recovery';
  name: string;
  confidence: number;
  articleUrl: string;
};

export async function notifyReviewNeeded(event: ReviewNeededEvent): Promise<void> {
  try {
    // TODO(006 follow-up): wire a real channel once TELEGRAM_BOT_TOKEN /
    // TELEGRAM_CHAT_ID are provisioned. Until then, log only — this keeps
    // the call site stable and side-effect-free.
    console.log(
      `[notify] ${event.type} (${event.detectorType}): ${event.name} — confidence ${event.confidence.toFixed(2)} — ${event.articleUrl}`,
    );
  } catch {
    // Never let a notification-delivery problem affect the caller.
  }
}
