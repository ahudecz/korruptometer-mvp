import 'server-only';

import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm';

import { runSubscriberConfirmSendCore } from '@/inngest/functions/subscriber-confirm-send';
import { getDb, schema } from '@/lib/db';
import type { BypassLogger } from '@/lib/cron-bypass';
import { CONFIRM_COOLDOWN_MINUTES, CONFIRM_MAX_SENDS } from '@/lib/subscriber-crypto';

/**
 * 012-reader-subscriptions — a megerősítő levelek ÜRÍTÉSE, cron-ról.
 *
 * MIÉRT LÉTEZIK. A megerősítő levél volt az EGYETLEN pont ebben a feature-ben,
 * ami az Inngest esemény-buszon ment. Minden más — a riasztás-ürítés, a heti
 * összefoglaló, az egészség-ellenőrzés — GitHub Actions cron, ami a
 * `/api/cron/*` végpontokat hívja, és ez SZÁNDÉKOS: a repó a buszt nem tekinti
 * megbízhatónak (l. `PIPELINE_BYPASS_INNGEST`).
 *
 * 2026-09-03-án élesben ez pontosan úgy bukott el, ahogy a spec az FR-029-ben
 * leírja a feature signature hibaosztályát: NÉMÁN. Az űrlap azt mondta,
 * "Elküldtük a megerősítő levelet", a sor bekerült `pending` állapotban, az
 * esemény elment — és soha semmi nem fogyasztotta el. Nulla küldés, üres
 * keret-főkönyv, nulla hibaüzenet. Egy tesztelő így három órán át várt egy
 * levélre, ami sosem indult el.
 *
 * Ez a modul a HIÁNYZÓ FOGYASZTÓ. Nem váltja ki az Inngest-függvényt: az
 * megmarad, és ha a busz működik, ott fut le. A duplikálás ellen nem itt
 * védekezünk, hanem ott, ahol kell — a mag egyetlen feltételes UPDATE-tel
 * FOGLALJA a sort (`status = 'pending' AND confirmSentCount < MAX`), így
 * akárhány indító útvonal van, egy sorra egy küldés jut.
 */

/** Egy futásban ennyi címet szolgálunk ki. */
export const CONFIRM_DRAIN_BATCH = 20;

export type ConfirmDrainResult = {
  candidates: number;
  sent: number;
  skipped: number;
};

export async function drainPendingConfirmations({
  max = CONFIRM_DRAIN_BATCH,
  logger,
}: { max?: number; logger?: BypassLogger } = {}): Promise<ConfirmDrainResult> {
  const db = getDb();

  const cooldownCutoff = new Date(Date.now() - CONFIRM_COOLDOWN_MINUTES * 60_000);

  // Csak az a sor jön szóba, ami tényleg VÁR egy levélre:
  //   - `pending` (egy megerősített vagy leiratkozott sornak nincs mit küldeni),
  //   - a per-címes küldési korlát alatt van (FR-037),
  //   - és vagy még soha nem kapott levelet, vagy letelt a várakozási idő.
  // A legrégebben kiszolgált megy előre, hogy egy hosszú sor vége se éhezzen.
  const candidates = await db
    .select({ id: schema.subscribers.id })
    .from(schema.subscribers)
    .where(
      and(
        eq(schema.subscribers.status, 'pending'),
        sql`${schema.subscribers.confirmSentCount} < ${CONFIRM_MAX_SENDS}`,
        or(
          isNull(schema.subscribers.confirmLastSentAt),
          // `lte()`, NEM nyers `sql` interpoláció: egy JS Date a raw
          // template-ben szövegként próbálna kódolódni, és a route
          // 500-zal állt meg ("Received an instance of Date"). Az operátor
          // ismeri az oszlop típusát, és helyesen paraméterez.
          lte(schema.subscribers.confirmLastSentAt, cooldownCutoff),
        ),
      ),
    )
    .orderBy(asc(schema.subscribers.createdAt))
    .limit(max);

  let sent = 0;
  let skipped = 0;

  for (const { id } of candidates) {
    // Egy cím hibája nem állíthatja meg a köteget: a következő olvasó levele
    // nem függhet attól, hogy az előző címe visszapattant-e.
    try {
      const result = await runSubscriberConfirmSendCore({ subscriberId: id, logger });
      if (result.sent > 0) sent += 1;
      else skipped += 1;
    } catch (err) {
      skipped += 1;
      logger?.error?.('confirm-drain: one subscriber failed', err);
    }
  }

  return { candidates: candidates.length, sent, skipped };
}
