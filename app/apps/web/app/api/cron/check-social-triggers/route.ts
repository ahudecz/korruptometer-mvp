import { NextResponse } from 'next/server';

import { bypassLogger, verifyCronRequest } from '@/lib/cron-bypass';
import { runSocialTriggersCore } from '@/inngest/functions/check-social-triggers';

/**
 * 2026-08-30 — user kérés: óránként nézze meg, van-e új közösségimédia-poszt
 * jelölt (feljelentési összeg +1000 Mrd mérföldkő, vagy WATCH_LIST-es
 * személy breaking lemondása) — l. check-social-triggers.ts fejléce a
 * teljes logikáért. Mindig csak Telegram-jóváhagyásra vár, sose posztol
 * automatikusan (l. telegram/webhook route.ts 's' ág a tényleges
 * közzétételhez).
 *
 * Nincs Inngest-megfelelője, nem érinti a PIPELINE_BYPASS_INNGEST-kört (l.
 * cron-bypass.ts) — csak verifyCronRequest()-tel osztozik a többi cron
 * route-tal, a GitHub Actions ütemezi (l. .github/workflows/
 * hourly-social-triggers.yml), ugyanazzal a CRON_SECRET-tel.
 *
 * Nincs LLM-hívás — sablon-alapú caption (l. social-caption.ts), a napi
 * Anthropic-keretre nulla hatással van.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSocialTriggersCore({
      step: { run: (_name, fn) => fn(), sendEvent: async () => null },
      logger: bypassLogger,
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    bypassLogger.error?.('cron/check-social-triggers failed', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
