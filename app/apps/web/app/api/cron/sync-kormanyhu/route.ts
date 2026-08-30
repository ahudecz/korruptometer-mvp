import { NextResponse } from 'next/server';

import { bypassLogger, verifyCronRequest } from '@/lib/cron-bypass';
import { runKormanyHuSyncCore } from '@/inngest/functions/sync-kormanyhu-complaints';

/**
 * 2026-08-30 — user kérés: naponta 09:00-kor (Budapest) egyeztesse a
 * /birosagi-iteletek kormányzati bejelentőjű feljelentéseit a
 * kormany.hu/atlathato/feljelentes hivatalos oldalával (l.
 * sync-kormanyhu-complaints.ts fejléce a teljes logikáért).
 *
 * Nincs Inngest-megfelelője, nem érinti a PIPELINE_BYPASS_INNGEST-kört (l.
 * cron-bypass.ts) — csak verifyCronRequest()-tel osztozik a többi cron
 * route-tal, a GitHub Actions ütemezi (l. .github/workflows/
 * daily-kormanyhu-sync.yml), ugyanazzal a CRON_SECRET-tel.
 *
 * Nincs LLM-hívás — HTML-attribútum-parse, a napi Anthropic-keretre nulla
 * hatással van.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runKormanyHuSyncCore({
      step: { run: (_name, fn) => fn(), sendEvent: async () => null },
      logger: bypassLogger,
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    bypassLogger.error?.('cron/sync-kormanyhu failed', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
