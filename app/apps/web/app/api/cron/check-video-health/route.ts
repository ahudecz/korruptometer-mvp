import { NextResponse } from 'next/server';

import { bypassLogger, verifyCronRequest } from '@/lib/cron-bypass';
import { runVideoHealthCheckCore } from '@/inngest/functions/check-video-health';

/**
 * 2026-08-24 — user kérés: naponta egyszer ellenőrizze, hogy az oldalon
 * beágyazott/hivatkozott YouTube videók még lejátszhatók-e (nincs törölve/
 * private-re állítva/beágyazás-tiltva), és Telegramra riasszon, ha nem.
 *
 * Nincs Inngest-megfelelője, nem érinti a PIPELINE_BYPASS_INNGEST-kört (l.
 * cron-bypass.ts) — csak verifyCronRequest()-tel osztozik a többi cron
 * route-tal, a GitHub Actions ütemezi (l. .github/workflows/
 * daily-video-health-check.yml), ugyanazzal a CRON_SECRET-tel.
 *
 * Nincs benne LLM-hívás (YouTube Data API, ingyenes kulcs-alapú lekérdezés)
 * — a napi Anthropic-keretre nulla hatással van.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runVideoHealthCheckCore({
      step: { run: (_name, fn) => fn(), sendEvent: async () => null },
      logger: bypassLogger,
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    bypassLogger.error?.('cron/check-video-health failed', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
