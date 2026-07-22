import { NextResponse } from 'next/server';

import { bypassLogger, isBypassActive, makeBypassStep, verifyCronRequest } from '@/lib/cron-bypass';
import { runFacebookSyncCore } from '@/inngest/functions/sync-facebook-posts';

/**
 * 2026-07-22 — Inngest-bypass, l. cron-bypass.ts fejléce. Vercel natív
 * Cron hívja naponta (vercel.json, 05:00 UTC = 07:00 Budapest nyári idő,
 * ugyanaz az időpont, mint az eredeti Inngest-cron), amíg
 * PIPELINE_BYPASS_INNGEST=1 él.
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
    const result = await runFacebookSyncCore({ step: makeBypassStep('sync-facebook-posts'), logger: bypassLogger });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    bypassLogger.error?.('cron/facebook-sync failed', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
