import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { maybeSendHealthAlert, recordHealthRun } from '@korr/db/subscription-health-alert';

import { getDb } from '@/lib/db';
import { bypassLogger, verifyCronRequest } from '@/lib/cron-bypass';
import { CONFIRM_EXPIRY_HOURS } from '@/lib/subscriber-crypto';

/**
 * 012-reader-subscriptions — az őrkutya (FR-074…FR-078).
 *
 * MIÉRT LÉTEZIK: egy ki nem posztolt sor `channelSentAt IS NULL` marad, és az
 * olvasó sosem tudja meg, hogy az oldal publikált. A Sentry és a Better Stack
 * a DOBOTT hibákat látja; azt, hogy "nem történt semmi", EGYIK SEM. A repó ezt
 * egyszer már megtanulta: a `llm-api-failure-alert.ts` azért létezik, mert az
 * Anthropic API-hibák 2026-07-12-től 2026-08-23-ig — hat hétig — csendben
 * futottak, és kézzel derültek ki.
 *
 * SAJÁT cron-route, a `subscriptions.yml`-ből hívva. SZÁNDÉKOSAN nem a
 * `gdpr-retention-sweep.ts`-en ül: az egy csupasz Inngest-függvény, Actions és
 * Vercel hívó nélkül, azon az ütemezőn, amiről a `cron-bypass.ts` fejléce
 * rögzíti, hogy háromszor lépte túl a kvótáját. Egy néma hibaosztály őrkutyája
 * nem ülhet a repó legmegbízhatatlanabb futtatóján.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/** Ennyi óránál régebbi, ki nem posztolt riasztás elakadást jelent. */
const HEALTH_FLUSH_HOURS = 2;
/** Ennyi óra után egy jóváhagyásra váró összefoglaló elakadtnak számít. */
const HEALTH_APPROVAL_HOURS = 24;
/** Ennyi óra után maga az őrkutya számít leállottnak. */
const HEALTH_HEARTBEAT_HOURS = 26;
/** A foglalás és a tényleges küldés közti tűrt eltérés egy napon belül. */
const LEDGER_RECONCILE_GAP = 10;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    // (1) A SZÍVVERÉS ELŐSZÖR. Az előző futás idejét MÉG a mostani beírása
    //     előtt olvassuk ki, különben a rés sosem látszana.
    const previousRun = await recordHealthRun(db);

    const reasons: string[] = [];

    // (2) A szívverés-rés. EZ AZ EGYETLEN feltétel, ami magát az őrkutyát
    //     elkapja, ezért nem függhet attól az ütemezőtől, ami a többit futtatja
    //     (FR-078). A GitHub 60 nap repó-tétlenség után letiltja az ütemezett
    //     workflow-kat — ez nem elméleti kockázat.
    if (previousRun) {
      const gapHours = (Date.now() - previousRun.getTime()) / (60 * 60_000);
      if (gapHours > HEALTH_HEARTBEAT_HOURS) {
        reasons.push(
          `az egészség-ellenőrzés ${Math.round(gapHours)} órája nem futott (küszöb: ${HEALTH_HEARTBEAT_HOURS} óra)`,
        );
      }
    }

    // (3) Beragadt riasztások. TELJESEN ELHALLGATVA, amíg a csatorna
    //     azonosítója nincs beállítva (FR-077): különben a kikapcsoló minden
    //     nap küldene egy üzenetet, ameddig be van kapcsolva.
    if (process.env.TELEGRAM_PUBLIC_CHANNEL_ID) {
      const stale = (await db.execute(sql`
        SELECT count(*)::int AS n FROM "SubscriberAlert"
         WHERE "channelSentAt" IS NULL
           AND "revokedAt" IS NULL
           AND "occurredAt" < now() - interval '${sql.raw(String(HEALTH_FLUSH_HOURS))} hours'
      `)) as unknown as Array<{ n: number }>;
      const n = stale[0]?.n ?? 0;
      if (n > 0) reasons.push(`${n} olvasói riasztás ${HEALTH_FLUSH_HOURS} óránál régebben vár kiposztolásra`);
    }

    // (4) Jóváhagyásra váró összefoglaló.
    const waiting = (await db.execute(sql`
      SELECT count(*)::int AS n FROM "Digest"
       WHERE status = 'awaiting_approval'
         AND "draftedAt" < now() - interval '${sql.raw(String(HEALTH_APPROVAL_HOURS))} hours'
    `)) as unknown as Array<{ n: number }>;
    if ((waiting[0]?.n ?? 0) > 0) {
      reasons.push(`egy hírlevél ${HEALTH_APPROVAL_HOURS} órája vár jóváhagyásra`);
    }

    // (5) Az utolsó kiküldött összefoglaló a ritmusnál + két napnál régebbi.
    const lastSent = (await db.execute(sql`
      SELECT MAX("sentAt") AS "sentAt" FROM "Digest" WHERE status = 'sent'
    `)) as unknown as Array<{ sentAt: Date | string | null }>;
    const lastSentRaw = lastSent[0]?.sentAt ?? null;
    if (lastSentRaw) {
      const lastSentAt = lastSentRaw instanceof Date ? lastSentRaw : new Date(lastSentRaw);
      const days = (Date.now() - lastSentAt.getTime()) / (24 * 60 * 60_000);
      if (days > 7 + 2) reasons.push(`az utolsó hírlevél ${Math.round(days)} napja ment ki`);
    }

    // (6) A foglalás-szivárgás egyeztetése. MINDKÉT OLDAL a fő-könyvből jön,
    //     soha nem a `Digest.sentCount`-ból: a fő-könyv foglalásai a megerősítő
    //     leveleket is tartalmazzák, amiket egyetlen `Digest` sor sem számol —
    //     egy tábla-közi összehasonlítás minden olyan napon tüzelne, amikor
    //     egyáltalán érkezik feliratkozás.
    const ledger = (await db.execute(sql`
      SELECT "reservedCount", "sentCount" FROM "EmailSendLedger" WHERE day = current_date
    `)) as unknown as Array<{ reservedCount: number; sentCount: number }>;
    const row = ledger[0];
    if (row && row.reservedCount - row.sentCount > LEDGER_RECONCILE_GAP) {
      reasons.push(
        `a mai foglalás (${row.reservedCount}) ${row.reservedCount - row.sentCount}-tel meghaladja a tényleges küldést (${row.sentCount})`,
      );
    }

    // (7) Az FR-076 ötjén TÚL: egy `pending` feliratkozó, akinek soha nem ment
    //     ki a megerősítő levele. Egy leállt megerősítő-küldő a fenti öt
    //     feltétel MINDEGYIKE számára láthatatlan, és ez az a néma hiba, ami a
    //     legközelebb van az olvasóhoz.
    const strandedPending = (await db.execute(sql`
      SELECT count(*)::int AS n FROM "Subscriber"
       WHERE status = 'pending'
         AND "confirmSentCount" = 0
         AND "createdAt" < now() - interval '${sql.raw(String(CONFIRM_EXPIRY_HOURS))} hours'
    `)) as unknown as Array<{ n: number }>;
    const stranded = strandedPending[0]?.n ?? 0;
    if (stranded > 0) {
      reasons.push(`${stranded} feliratkozó soha nem kapta meg a megerősítő levelét`);
    }

    // (8) Legfeljebb EGY üzenet naponta, akárhány feltétel tüzelt (FR-075).
    let alerted = false;
    if (reasons.length > 0) {
      alerted = await maybeSendHealthAlert(db, reasons.join('; '));
    }

    return NextResponse.json(
      { checked: true, reasons, alerted },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    bypassLogger.error?.('cron/subscription-health failed', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
