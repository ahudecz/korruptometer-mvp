import 'server-only';

import { and, eq, sql } from 'drizzle-orm';

import { decryptPii } from '@korr/shared/encryption';
import { sendBatch, unsubscribeHeaders } from '@korr/shared/email';
import {
  recordSent,
  releaseSendBudget,
  reserveSendBudget,
} from '@korr/db/email-send-ledger';

import { inngest } from '@/inngest/client';
import { getDb, schema } from '@/lib/db';
import { isBypassActive, type BypassLogger, type BypassStep } from '@/lib/cron-bypass';
import {
  CONFIRM_EXPIRY_HOURS,
  CONFIRM_MAX_SENDS,
  hashConfirmToken,
  newConfirmToken,
  unsubUrl,
} from '@/lib/subscriber-crypto';

/**
 * 012-reader-subscriptions — a megerősítő levél küldője (FR-037, FR-038,
 * FR-052, FR-080, FR-094).
 *
 * Esemény-vezérelt, ezért NEM a `createBypassGuardedFunction` helperrel készül:
 * az csak egyetlen cron-triggert tud. A kapu kézzel írt, a
 * `sync-facebook-posts.ts` alakjában.
 */

/**
 * ⛔ EZ BIZTONSÁGI KORLÁT, NEM ÁTBOCSÁTÁSI BEÁLLÍTÁS. ⛔
 *
 * Ez a szám egy sikeres bot-futás KÁRHATÁRA a feliratkozó űrlapon. Egy bot,
 * ami átjut a csali-mezőn és a hálózati küszöbökön, legfeljebb ennyi kéretlen
 * megerősítő levelet tud kifizettetni velünk egy nap alatt — egy olyan
 * domainről, aminek nincs küldési reputációja —, mielőtt a korlát megállítja
 * és a feliratkozás-hullám jelzés emberhez ér.
 *
 * A MEGEMELÉSE UGYANENNYIVEL EMELI A KÁRHATÁRT. Kapacitási gondot a
 * `DIGEST_DAILY_SEND_CAP` vagy a szolgáltatói csomag old meg, EZ SOHA.
 */
const SUBSCRIBE_CONFIRM_DAILY_CAP = Number(process.env.SUBSCRIBE_CONFIRM_DAILY_CAP ?? 50);

const CONFIRM_SUBJECT = 'Erősítsd meg a feliratkozásod — Kegyencjárat';

/**
 * A megerősítő levél. NINCS BENNE OLVASÓTÓL SZÁRMAZÓ SZÖVEG (FR-080).
 *
 * Az űrlap nem kér nevet és semmilyen más szabad szöveget, és pontosan ez
 * akadályozza meg, hogy ez a levél egy támadó szavait vigye egy harmadik
 * félnek. Ez elsődleges védelem (FR-096), nem egyszerűsítés.
 */
function confirmBody(confirmLink: string): { text: string; html: string } {
  const text = [
    'Valaki — remélhetőleg te — feliratkozott a Kegyencjárat hírlevelére ezzel a címmel.',
    '',
    'Ha te voltál, erősítsd meg itt:',
    confirmLink,
    '',
    'A link 24 óráig él. Ha nem te voltál, ne csinálj semmit: megerősítés nélkül',
    'nem küldünk erre a címre több levelet.',
    '',
    '—',
    'Kegyencjárat · hello@kegyencjarat.hu',
  ].join('\n');

  const html = [
    '<p>Valaki — remélhetőleg te — feliratkozott a Kegyencjárat hírlevelére ezzel a címmel.</p>',
    `<p><a href="${confirmLink}">Megerősítem a feliratkozást</a></p>`,
    '<p>A link 24 óráig él. Ha nem te voltál, ne csinálj semmit: megerősítés nélkül nem '
      + 'küldünk erre a címre több levelet.</p>',
    '<hr />',
    '<p style="color:#5c5e62;font-size:13px">Kegyencjárat · '
      + '<a href="mailto:hello@kegyencjarat.hu">hello@kegyencjarat.hu</a></p>',
  ].join('\n');

  return { text, html };
}

export type ConfirmSendResult =
  | { sent: 0; skipped: string }
  | { sent: 1 };

/**
 * A küldő magja.
 *
 * A DARABSZÁM-KORLÁT ÉS A KERETFOGLALÁS EGY TRANZAKCIÓBAN történik (FR-038).
 * Külön kérésben a három darabos korlát versenyfüggő lenne: két egyszerre
 * futó küldő mindkettő "2 < 3"-at olvasna, és mindkettő küldene.
 */
export async function runSubscriberConfirmSendCore({
  subscriberId,
  logger,
}: {
  subscriberId: string;
  step?: BypassStep;
  logger?: BypassLogger;
}): Promise<ConfirmSendResult> {
  if (!process.env.RESEND_API_KEY) return { sent: 0, skipped: 'email_paused' };

  const db = getDb();

  // A NAPI GLOBÁLIS korlát, minden címre összesítve (FR-052).
  const todayConfirms = (await db.execute(sql`
    SELECT count(*)::int AS n FROM "AuditLog"
     WHERE action = 'subscriber.confirm-sent'
       AND at >= current_date
  `)) as unknown as Array<{ n: number }>;
  if ((todayConfirms[0]?.n ?? 0) >= SUBSCRIBE_CONFIRM_DAILY_CAP) {
    logger?.warn?.('subscriber-confirm-send: daily confirmation cap reached');
    return { sent: 0, skipped: 'daily_cap' };
  }

  const token = newConfirmToken();
  const expiresAt = new Date(Date.now() + CONFIRM_EXPIRY_HOURS * 60 * 60_000);

  // A per-címes korlát ellenőrzése ÉS a számláló növelése EGY feltételes
  // UPDATE-ben. Ha a WHERE nem talál, a korlát már betelt — nincs második,
  // versenyfüggő olvasás.
  const claimed = await db
    .update(schema.subscribers)
    .set({
      confirmTokenHash: hashConfirmToken(token),
      confirmTokenExpiresAt: expiresAt,
      confirmSentCount: sql`${schema.subscribers.confirmSentCount} + 1`,
      confirmLastSentAt: new Date(),
    })
    .where(
      and(
        eq(schema.subscribers.id, subscriberId),
        eq(schema.subscribers.status, 'pending'),
        sql`${schema.subscribers.confirmSentCount} < ${CONFIRM_MAX_SENDS}`,
      ),
    )
    .returning({ id: schema.subscribers.id, emailEnc: schema.subscribers.emailEnc });

  const row = claimed[0];
  if (!row) return { sent: 0, skipped: 'cap_or_not_pending' };
  if (!row.emailEnc) return { sent: 0, skipped: 'no_address' };

  // A keret lefoglalása a küldés ELŐTT.
  const reserved = await reserveSendBudget(db, 1);
  if (reserved < 1) {
    logger?.warn?.('subscriber-confirm-send: no send budget left today');
    return { sent: 0, skipped: 'no_budget' };
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.kegyencjarat.hu').replace(/\/+$/, '');
  const confirmLink = `${base}/hirlevel/megerosites?t=${encodeURIComponent(token)}`;
  const { text, html } = confirmBody(confirmLink);

  // A cím CSAK ITT, a megcímzés pillanatában van visszafejtve (FR-081). Naplóba
  // és auditba soha nem kerül.
  const to = decryptPii(row.emailEnc);
  const unsub = unsubUrl(row.id);

  const result = await sendBatch([
    {
      to,
      subject: CONFIRM_SUBJECT,
      text,
      html,
      headers: unsub ? unsubscribeHeaders(unsub) : {},
    },
  ]);

  if (result.sent < 1) {
    // A foglalás visszaadása, különben egy elbukott küldés véglegesen
    // csökkentené a nap kapacitását.
    await releaseSendBudget(db, reserved);
    logger?.error?.('subscriber-confirm-send: send failed', result.error);
    return { sent: 0, skipped: 'send_failed' };
  }

  await recordSent(db, result.sent);
  await db.insert(schema.auditLogs).values({
    action: 'subscriber.confirm-sent',
    entityType: 'Subscriber',
    entityId: row.id,
    detail: { expiresAt: expiresAt.toISOString() },
  });

  return { sent: 1 };
}

export const subscriberConfirmSend = inngest.createFunction(
  { id: 'subscriber-confirm-send', name: 'Subscriber confirmation send', concurrency: 1 },
  { event: 'subscriber.confirm-send' },
  async ({ event, logger }) => {
    if (isBypassActive()) {
      logger?.info?.(
        'subscriber-confirm-send: skipped — PIPELINE_BYPASS_INNGEST active, Vercel cron owns this run',
      );
      return { skipped: 'inngest_bypass_active' };
    }
    return runSubscriberConfirmSendCore({ subscriberId: event.data.subscriberId, logger });
  },
);
