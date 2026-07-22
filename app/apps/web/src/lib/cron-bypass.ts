import 'server-only';

/**
 * 2026-07-22 — Inngest bypass (user report: az Inngest-fiók kvótája miatt
 * "nem fog működni augusztus 1-ig", élő tünet: tömeges "Invalid signature"
 * 401 a /api/inngest végponton, l. [[project-facebook-sync]] a memóriában —
 * ez a 3. alkalom ugyanabból az okból, korábban is kvóta volt, nem
 * kulcshiba).
 *
 * Cél: a legfontosabb óránkénti/napi munkát (scrape-news + 5 detektor +
 * facebook-sync) átmenetileg Vercel natív Cron-jaira tenni, MEGKERÜLVE az
 * Inngest event-buszt teljesen — nem az Inngest webhookján, nem az ő
 * signing/quota rendszerén megy át semmi.
 *
 * Kulcs-biztonsági szabály: a PIPELINE_BYPASS_INNGEST=1 env var egyszerre
 * KAPCSOLJA BE az új Vercel Cron route-okat ÉS KAPCSOLJA KI (no-op-ra
 * állítja) a megfelelő Inngest-function handlereket — így akkor is csak
 * EGYSZER fut le a munka óránként, ha az Inngest időnként mégis sikeresen
 * kézbesít egy cron-triggert (ne fusson duplán, ne duplázza a napi LLM-
 * költést).
 */

export type BypassStep = {
  run<T>(name: string, fn: () => Promise<T>): Promise<T>;
  sendEvent(name: string, payload: unknown): Promise<unknown>;
};

export type BypassLogger = {
  info?: (...a: unknown[]) => void;
  warn?: (...a: unknown[]) => void;
  error?: (...a: unknown[]) => void;
};

export function makeBypassStep(logPrefix: string): BypassStep {
  return {
    async run<T>(_name: string, fn: () => Promise<T>): Promise<T> {
      // Nincs Inngest-féle memoizáció/retry itt — elfogadható, mert minden
      // érintett writer idempotens (onConflictDoNothing / markChecked /
      // DetectionCheck, l. CLAUDE.md), egy sima újrafutás nem duplikál.
      return fn();
    },
    async sendEvent(name: string, payload: unknown): Promise<unknown> {
      // A downstream Inngest-eseményláncok (aggregate.link-articles,
      // investigation.article.ingested, breaking.recompute) a bypass alatt
      // NEM tüzelnek — ezek amúgy is Inngesten mennének, ami épp nem
      // megbízható. Ez azt jelenti, hogy az új cikkek automatikus
      // Investigation-klaszterezése és a breaking-csík AI-frissítése
      // szünetel a bypass ideje alatt (a régi memória szerint ez a lánc
      // amúgy is dormant volt kvóta miatt hetek óta).
      console.log(`[cron-bypass:${logPrefix}] sendEvent skipped (Inngest bypass active): ${name}`, payload);
      return { ids: [] };
    },
  };
}

export const bypassLogger: BypassLogger = {
  info: (...a: unknown[]) => console.log('[cron-bypass]', ...a),
  warn: (...a: unknown[]) => console.warn('[cron-bypass]', ...a),
  error: (...a: unknown[]) => console.error('[cron-bypass]', ...a),
};

export function isBypassActive(): boolean {
  return process.env.PIPELINE_BYPASS_INNGEST === '1';
}

/** Vercel natív cron-hitelesítés — l. Vercel docs "Securing Cron Jobs". */
export function verifyCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  return Boolean(secret) && authHeader === `Bearer ${secret}`;
}
