import { NextResponse } from 'next/server';

import { bypassLogger, verifyCronRequest } from '@/lib/cron-bypass';
import { dueOutboxRows, publishOutboxRow } from '@/lib/social-publish';
import { sendTelegramMessage } from '@/lib/telegram';
import { formatSlot } from '@/lib/social-schedule';

/**
 * 2026-09-11 — user kérés: „olyat tudsz, hogy egyben jönnek telegramra, hogy
 * ne kelljen velük baszakodnom külön, de pár óra csúsztatással küldöd ki
 * akkor is, ha egyben hagyom jóvá?"
 *
 * A Telegram-jóváhagyás óta nem posztol azonnal: a sor `status='approved'` +
 * `scheduledFor` időpontot kap (l. social-schedule.ts — 3 órás szünet,
 * 22:00–08:00 között semmi). Ez a route viszi ki azt, ami esedékessé vált.
 *
 * FONTOS: egy futásban CSAK EGY posztot küld ki, akkor is, ha több esedékes.
 * A GitHub Actions cron köztudottan kimarad (l. social-post-policy.ts
 * EVENT_LOOKBACK_HOURS komment: 09-10-én egyetlen futás volt egész nap) — ha
 * egy kimaradás után három slot egyszerre válna esedékessé, a „mindet most"
 * viselkedés pontosan azt a hibát hozná vissza, ami ellen az egész ütemezés
 * készült („nem egy perc alatt akarok hármat posztolni"). Egyesével kiküldve
 * a lemaradás a következő futásokon dolgozódik le.
 *
 * Nincs LLM-hívás — a kép és a caption már a jelölt létrehozásakor elkészült.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const due = await dueOutboxRows();
    if (due.length === 0) {
      return NextResponse.json({ due: 0, published: 0 }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const row = due[0]!;
    const result = await publishOutboxRow(row);
    bypassLogger.info?.(`publish-scheduled-social: ${row.id} (${row.triggerType}) — ${result.ok ? 'kiküldve' : 'hiba'}`);

    // A user a Telegramon látta jóváhagyni — ott is lássa, hogy megtörtént.
    const slotLabel = row.scheduledFor ? formatSlot(row.scheduledFor) : 'ismeretlen időpont';
    const remaining = due.length - 1;
    const tail = remaining > 0 ? `\n\nMég ${remaining} ütemezett poszt vár sorára.` : '';
    await sendTelegramMessage(`${result.text}\n\n„${row.headline}" (ütemezve: ${slotLabel})${tail}`);

    return NextResponse.json(
      { due: due.length, published: result.ok ? 1 : 0, id: row.id, ok: result.ok },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    bypassLogger.error?.('cron/publish-scheduled-social failed', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
