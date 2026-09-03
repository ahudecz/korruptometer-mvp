import { NextResponse } from 'next/server';

import { bypassLogger, isBypassActive, makeBypassStep, verifyCronRequest } from '@/lib/cron-bypass';
import { runDigestDraftCore } from '@/inngest/functions/digest-draft';
import { runDigestSendCore } from '@/inngest/functions/digest-send';

/**
 * 012-reader-subscriptions — a heti összefoglaló Vercel-cron oldali fele.
 *
 * A KÉT KAPU EGYÜTT tartja a munkát PONTOSAN egyszer futóban, amikor mindkét
 * hívó él: az Inngest-oldali függvény kilép, ha a bypass aktív; ez a route
 * kilép, ha NEM aktív. Ugyanaz a szabály, amit a `cron-bypass.ts` fejléce a
 * meglévő hét lépésre kimond.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isBypassActive()) {
    return NextResponse.json({ skipped: 'bypass_not_active' });
  }

  try {
    const draft = await runDigestDraftCore({
      step: makeBypassStep('digest-draft'),
      logger: bypassLogger,
    });
    const send = await runDigestSendCore({
      step: makeBypassStep('digest-send'),
      logger: bypassLogger,
    });
    return NextResponse.json({ draft, send }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    bypassLogger.error?.('cron/digest failed', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
