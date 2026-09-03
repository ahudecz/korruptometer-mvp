import { NextResponse } from 'next/server';

import { bypassLogger, verifyCronRequest } from '@/lib/cron-bypass';
import { CONFIRM_DRAIN_BATCH, drainPendingConfirmations } from '@/lib/confirm-drain';

/**
 * 012-reader-subscriptions — a megerősítő levelek ürítése.
 *
 * Ugyanaz az alak, mint a `/api/cron/flush-alerts`-é, és ugyanazért: ebben a
 * repóban a MEGBÍZHATÓ ütemező a GitHub Actions, ami ezeket a végpontokat
 * hívja. Az Inngest esemény-buszra bízott megerősítő levél 2026-09-03-án
 * némán elmaradt — l. `src/lib/confirm-drain.ts` fejlécét.
 *
 * A `maxDuration` bőven a köteg fölött van: húsz levél, egyenként egy
 * szolgáltatói hálózati fordulóval, jóval hatvan másodperc alatt lefut, de a
 * 60 másodperces alapmennyezet egy lassú szolgáltatói válasznál a köteg
 * közepén vágná el a futást — és egy elvágott ürítés NÉMA.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await drainPendingConfirmations({
      max: CONFIRM_DRAIN_BATCH,
      logger: bypassLogger,
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    bypassLogger.error?.('cron/confirm-send failed', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
