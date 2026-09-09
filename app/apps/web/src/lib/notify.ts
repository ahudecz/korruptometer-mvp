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
  detectorType: 'resignation' | 'media_closure' | 'court_verdict' | 'asset_recovery' | 'criminal_complaint';
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
  /** 2026-09-07 user kérés — ha a pending oka egy TÖREDÉK névegyezés
   *  (l. findFragmentNameMatch, review.ts), a Telegram-üzenet mutassa meg
   *  MELYIK már meglévő névvel/cikkel ütközik, hogy a user egy pillantással
   *  össze tudja hasonlítani a kettőt "ugyanaz-e" eldöntéséhez — ne kelljen
   *  külön rákeresnie.
   *  2026-09-09 — `reason` megkülönbözteti a névalapú (findFragmentNameMatch)
   *  és a tartalomalapú (findSimilarVerdictByContent, review.ts) egyezést,
   *  mert a kettő üzenete mást állít ("ez a NÉV már szerepel" vs. "ez a
   *  CIKK ugyanarról az esetről szólhat, más néven") — l. Szabó Sándor/
   *  "Ismeretlen két személy" NKA-eset, ahol a névalapú üzenet félrevezető
   *  lett volna (a két név semmiben nem egyezett). Alapértelmezett 'name',
   *  hogy a régi hívók (resignation/complaint fragmentMatch) módosítás
   *  nélkül működjenek tovább. */
  conflictingMatch?: { name: string; sourceUrl: string | null; reason?: 'name' | 'content' };
};

const DETECTOR_LABELS_HU: Record<ReviewNeededEvent['detectorType'], string> = {
  resignation: 'Lemondás/kirúgás',
  media_closure: 'Médium megszűnés',
  court_verdict: 'Bírósági ítélet',
  asset_recovery: 'Vagyonvisszaszerzés',
  criminal_complaint: 'Feljelentés',
};

// callback_data detector shorthand — keeps "{action}:{code}:{id}" well
// under Telegram's 64-byte callback_data limit.
const DETECTOR_CODES: Record<ReviewNeededEvent['detectorType'], string> = {
  resignation: 'r',
  media_closure: 'm',
  court_verdict: 'c',
  asset_recovery: 'x',
  criminal_complaint: 'f',
};

export async function notifyReviewNeeded(event: ReviewNeededEvent): Promise<void> {
  try {
    const typeLabel = event.type === 'pending' ? 'ÁTNÉZENDŐ' : 'MAJDNEM KIMARADT';
    const message = [
      `🔔 ${typeLabel} — ${DETECTOR_LABELS_HU[event.detectorType]}`,
      `${event.name} (bizonyosság: ${(event.confidence * 100).toFixed(0)}%)`,
      ...(event.conflictingMatch
        ? [event.conflictingMatch.reason === 'content'
          ? `⚠️ A cikk tartalma egy már meglévő sorral egyezhet: "${event.conflictingMatch.name}" — más néven, de valószínűleg ugyanaz az eset. Nézd meg, nem duplikátum-e!`
          : `⚠️ Töredékesen egyezik egy már meglévő névvel: "${event.conflictingMatch.name}" — nézd meg, nem ugyanarról van-e szó!`]
        : []),
    ].join('\n');
    console.log(`[notify] ${event.type} (${event.detectorType}): ${event.name} — confidence ${event.confidence.toFixed(2)} — ${event.articleUrl}`);

    const code = DETECTOR_CODES[event.detectorType];
    const actionId = event.recordId ?? event.articleId;
    const replyMarkup: InlineKeyboardMarkup = {
      inline_keyboard: [
        ...(event.articleUrl ? [[{ text: event.conflictingMatch ? '📄 Új cikk megnyitása' : '📄 Cikk megnyitása', url: event.articleUrl }]] : []),
        ...(event.conflictingMatch?.sourceUrl ? [[{ text: '📄 Meglévő cikk megnyitása (ütköző)', url: event.conflictingMatch.sourceUrl }]] : []),
        [
          { text: '✅ Jóváhagyom', callback_data: `a:${code}:${actionId}` },
          { text: '❌ Elutasítom', callback_data: `r:${code}:${actionId}` },
        ],
        // 2026-07-13: a strukturált beszúrás elutasítása (vagy egy near_miss
        // sosem-jóváhagyása) eddig azt is jelentette, hogy a cikk a
        // /hirek-en is jelöletlen/kiemeletlen maradt, pedig maga a hír
        // gyakran önmagában is közlésre érdemes — l. Tarr Zoltán-eset,
        // user report. Ez a gomb NEM nyúl a strukturált táblákhoz, csak a
        // NewsArticle címkéjét/breaking-jelzését állítja be.
        [{ text: '📰 Csak hírbe', callback_data: `n:${code}:${event.articleId}` }],
      ],
    };

    await sendTelegramMessage(message, replyMarkup);
  } catch {
    // Never let a notification-delivery problem affect the caller.
  }
}

/**
 * 2026-07-15 — a videó topikailag MÁR jóváhagyott (reviewStatus='approved'),
 * csak a csatorna nézettségi küszöbét nem érte még el, DE a rendszer
 * "breaking"-nek ítéli (l. scrape-youtube.ts isBreaking-ellenőrzés). Ugyanazt
 * az 'y' kódot/gombkészletet használja, mint notifyPodcastReviewNeeded, de a
 * webhook "Elutasítom" gombja itt csak nyugtáz (nem töröl/utasít el egy már
 * legitim jóváhagyást) — l. telegram/webhook/route.ts 'y' ág komment.
 */
export async function notifyPodcastBreakingBelowThreshold(video: {
  id: string;
  videoId: string;
  title: string;
  channelName: string;
}): Promise<void> {
  try {
    const url = `https://www.youtube.com/watch?v=${video.videoId}`;
    const message = [
      `⚡ BREAKING, DE KÜSZÖB ALATT — Podcast/videó`,
      `${video.channelName}: ${video.title}`,
      `Nem érte el a csatorna nézettségi küszöbét, de fontosnak tűnik — kézzel korábban is publikálható.`,
    ].join('\n');
    const replyMarkup: InlineKeyboardMarkup = {
      inline_keyboard: [
        [{ text: '▶️ Megnézem', url }],
        [
          { text: '✅ Publikálom most', callback_data: `a:y:${video.id}` },
          { text: '👍 Várunk a küszöbre', callback_data: `r:y:${video.id}` },
        ],
      ],
    };
    await sendTelegramMessage(message, replyMarkup);
  } catch {
    // Never let a notification-delivery problem affect the caller.
  }
}

/**
 * "legfrissebb podcastok" (YouTube-videó) review — külön, egyszerűbb ág a
 * fenti notifyReviewNeeded-től: a PodcastVideo sor mindig már véglegesen be
 * van szúrva reviewStatus='pending'-ként (nincs "near_miss": nem NewsArticle-
 * ből származtatott struktúra, nincs mit újra-extraktálni), ezért csak egy
 * approve/reject gomb kell, 'y' kód-betűvel (l. telegram/webhook/route.ts).
 */
export async function notifyPodcastReviewNeeded(video: {
  id: string;
  videoId: string;
  title: string;
  channelName: string;
}): Promise<void> {
  try {
    const url = `https://www.youtube.com/watch?v=${video.videoId}`;
    const message = [`🔔 ÁTNÉZENDŐ — Podcast/videó`, `${video.channelName}: ${video.title}`].join('\n');
    const replyMarkup: InlineKeyboardMarkup = {
      inline_keyboard: [
        [{ text: '▶️ Megnézem', url }],
        [
          { text: '✅ Jóváhagyom', callback_data: `a:y:${video.id}` },
          { text: '❌ Elutasítom', callback_data: `r:y:${video.id}` },
        ],
      ],
    };
    await sendTelegramMessage(message, replyMarkup);
  } catch {
    // Never let a notification-delivery problem affect the caller.
  }
}
