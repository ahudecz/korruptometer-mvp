import { NextResponse } from 'next/server';

import { bypassLogger, isBypassActive, makeBypassStep, verifyCronRequest } from '@/lib/cron-bypass';
import { runYoutubeScrapeCore } from '@/inngest/functions/scrape-youtube';

/**
 * 2026-07-23 — Inngest-bypass, l. cron-bypass.ts fejléce. Vercel natív
 * Cron hívja naponta (vercel.json, 08:10 UTC, ugyanaz az időpont, mint az
 * eredeti Inngest-cron), amíg PIPELINE_BYPASS_INNGEST=1 él. Ez a 8.
 * (utólag pótolt) LLM-hívó, ami korábban kimaradt a bypass-körből — l.
 * detect-watchlist-removals mellett a b01aa11 commit üzenetét.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isBypassActive()) {
    return NextResponse.json({ skipped: 'bypass_not_active' });
  }

  try {
    const result = await runYoutubeScrapeCore({ step: makeBypassStep('scrape-youtube'), logger: bypassLogger });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    bypassLogger.error?.('cron/youtube-sync failed', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
