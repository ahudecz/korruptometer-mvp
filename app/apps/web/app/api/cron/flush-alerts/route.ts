import { NextResponse } from 'next/server';

import { bypassLogger, verifyCronRequest } from '@/lib/cron-bypass';
import { FLUSH_BATCH_SIZE, flushSubscriberAlerts } from '@/lib/notify-subscribers';

/**
 * 012-reader-subscriptions — az olvasói postaláda ürítése a nyilvános
 * Telegram-csatornára (FR-026…FR-029).
 *
 * SAJÁT ütemezésen fut, a `/api/cron/pipeline` route-tól külön (FR-028). Az a
 * route hét egymás utáni lépést futtat — egy scrapert és hat LLM-detektort —
 * `maxDuration = 300` alatt, lépésenkénti keret nélkül. Egy utolsónak
 * hozzáfűzött flush pont az a lépés, amit a keret elvág, és egy elvágott
 * flush NÉMA: nincs hiba, nincs napló, nincs újrapróbálkozás.
 *
 * A `maxDuration = 300` nem óvatosság, hanem számtan: `FLUSH_BATCH_SIZE = 20`
 * üzenet `TELEGRAM_CHANNEL_RATE = 20/perc` ütemben tizenkilenc darab 3
 * másodperces szünet ≈ 57 másodperc, MIELŐTT egyetlen hálózati fordulót
 * beszámítanánk. A 60 másodperces mennyezet a köteg közepén ölné meg a futást.
 *
 * Nincs Inngest-párja: ez csak cron-route.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await flushSubscriberAlerts({ max: FLUSH_BATCH_SIZE });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    bypassLogger.error?.('cron/flush-alerts failed', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
