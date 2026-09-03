import 'server-only';

import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { decryptPii } from '@korr/shared/encryption';
import { RESEND_BATCH_MAX, sendBatch, unsubscribeHeaders } from '@korr/shared/email';
import {
  monthlyRemaining,
  recordSent,
  releaseSendBudget,
  remainingDigestCapacity,
  reserveSendBudget,
} from '@korr/db/email-send-ledger';
import { SUBSCRIPTION_DIGEST_LOCK_INT } from '@korr/db/locks';
import type { SubscriptionSection } from '@korr/shared/sections';

import { inngest } from '@/inngest/client';
import { getDb, schema } from '@/lib/db';
import { isBypassActive, type BypassLogger, type BypassStep } from '@/lib/cron-bypass';
import { renderTemplateBody, type DigestItem } from '@/lib/digest-build';
import { unsubUrl } from '@/lib/subscriber-crypto';
import { sendTelegramMessage } from '@/lib/telegram';

/**
 * 012-reader-subscriptions — az összefoglaló kiküldése (FR-049…FR-067).
 *
 * KÉT triggere van, és ez nem választás: a szerkesztő megnyomja a "Kimehet"
 * gombot, ami `approved` állapotba teszi a sort. Egy csak-cron küldő ezt a
 * KÖVETKEZŐ ütemezett futásán venné észre — egy tíz órai jóváhagyás másnap
 * reggelig várna, amit a szerkesztő nem tud megkülönböztetni egy elromlott
 * gombtól. Az egészség-ellenőrzés sem kapná el, mert annak 24 órás feltétele
 * az `awaiting_approval` állapotra néz, amit a sor már elhagyott. Néma
 * mindkét irányban — pont az a hibaosztály, ami ellen ez a feature készült.
 *
 * Esemény is van a triggerei közt, ezért a `createBypassGuardedFunction`
 * helper NEM alkalmazható rá (az egyetlen cron-triggert tud). A kapu kézzel
 * írt, a `sync-facebook-posts.ts` alakjában.
 */

const DIGEST_CRON = 'TZ=Europe/Budapest 5 7 * * 1';

/** Ennyi óra után egy megválaszolatlan piszkozat lejár (FR-066). */
export const DIGEST_APPROVAL_EXPIRY_HOURS = 48;
/** Egy jóváhagyott küldés legfeljebb ennyi napon át folytatódik (FR-054). */
export const DIGEST_RESUME_DAYS = 3;

type Recipient = {
  id: string;
  emailEnc: string | null;
  sections: SubscriptionSection[];
  lastDigestCursorAt: Date | null;
};

export type DigestSendResult = {
  expired: number;
  sent: number;
  status?: string;
  digestId?: string;
  skipped?: string;
};

/**
 * A LEJÁRATÁS. A küldő ezt végzi el MINDEN MÁS ELŐTT (FR-066).
 *
 * A lejáratás SOHA nem érint egy már `sending` állapotú összefoglalót: az
 * félbevágná egy futó küldést, aminek a foglalásai már ki vannak adva.
 */
async function expireStaleDrafts(db: ReturnType<typeof getDb>): Promise<number> {
  const cutoff = new Date(Date.now() - DIGEST_APPROVAL_EXPIRY_HOURS * 60 * 60_000);
  const rows = await db
    .update(schema.digests)
    .set({ status: 'expired' })
    .where(
      and(
        eq(schema.digests.status, 'awaiting_approval'),
        lte(schema.digests.draftedAt, cutoff),
      ),
    )
    .returning({ id: schema.digests.id });
  return rows.length;
}

export async function runDigestSendCore({
  logger,
}: {
  step?: BypassStep;
  logger?: BypassLogger;
}): Promise<DigestSendResult> {
  const db = getDb();

  // (1) MINDEN MÁS ELŐTT.
  const expired = await expireStaleDrafts(db);

  if (!process.env.RESEND_API_KEY) return { expired, sent: 0, skipped: 'email_paused' };

  // (2) Egy összefoglalóhoz egyszerre egy küldő (FR-049).
  await db.execute(sql`SELECT pg_advisory_xact_lock(${SUBSCRIPTION_DIGEST_LOCK_INT})`);

  const [digest] = await db
    .select()
    .from(schema.digests)
    .where(or(eq(schema.digests.status, 'approved'), eq(schema.digests.status, 'sending')))
    .orderBy(asc(schema.digests.approvedAt))
    .limit(1);

  if (!digest) return { expired, sent: 0, skipped: 'nothing_to_send' };

  // (10) A folytatás felső határa (FR-054). A napok az approvedAt-tól számítanak.
  const approvedAt = digest.approvedAt ?? new Date();
  const resumeDay = Math.floor((Date.now() - approvedAt.getTime()) / (24 * 60 * 60_000)) + 1;
  if (resumeDay > DIGEST_RESUME_DAYS) {
    await db
      .update(schema.digests)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(schema.digests.id, digest.id));
    await sendTelegramMessage(
      '⚠️ Korruptométer: a heti hírlevél nem ért végig.\n\n'
      + `A "${digest.subjectHu}" küldése ${DIGEST_RESUME_DAYS} nap alatt sem jutott el mindenkihez, `
      + `${digest.sentCount} címzettig jutott. A maradékot eldobtuk, nem hagyjuk tartósan félkészen menni.\n\n`
      + 'A napi keret 90 levél, tehát a heti valós befogadóképesség kb. 270 fő. E fölött csomagot kell váltani.',
    );
    return { expired, sent: 0, status: 'sent', digestId: digest.id, skipped: 'resume_window_over' };
  }

  // (3) A köteg mérete. A havi keret KÖTEGENKÉNT, nem összefoglalónként —
  // egy `sending` állapotú küldés átléphet egy hónaphatárt (FR-053).
  const dailyRemaining = await remainingDigestCapacity(db);
  const monthly = await monthlyRemaining(db);
  const capacity = Math.min(dailyRemaining, monthly);
  if (capacity <= 0) {
    await db.update(schema.digests).set({ status: 'sending' }).where(eq(schema.digests.id, digest.id));
    return { expired, sent: 0, status: 'sending', digestId: digest.id, skipped: 'no_capacity' };
  }

  // (5) A befagyasztott lista ÚJRASZŰRÉSE visszavonásra (FR-061).
  const alertRows = digest.alertIds.length
    ? await db
        .select({
          id: schema.subscriberAlerts.id,
          section: schema.subscriberAlerts.section,
          title: schema.subscriberAlerts.title,
          detail: schema.subscriberAlerts.detail,
          url: schema.subscriberAlerts.url,
          occurredAt: schema.subscriberAlerts.occurredAt,
        })
        .from(schema.subscriberAlerts)
        .where(
          and(
            inArray(schema.subscriberAlerts.id, digest.alertIds),
            isNull(schema.subscriberAlerts.revokedAt),
          ),
        )
    : [];
  const items: DigestItem[] = alertRows.map((r) => ({ ...r }));

  // (4) A címzettek. `active` KIZÁRÓLAG — soha nem `pending` (FR-094). Egy
  // frissen megerősített olvasó kimarad ebből az összefoglalóból (FR-060),
  // különben az üres kurzora miatt a teljes befagyasztott listát megkapná.
  const recipients: Recipient[] = await db
    .select({
      id: schema.subscribers.id,
      emailEnc: schema.subscribers.emailEnc,
      sections: schema.subscribers.sections,
      lastDigestCursorAt: schema.subscribers.lastDigestCursorAt,
    })
    .from(schema.subscribers)
    .where(
      and(
        eq(schema.subscribers.status, 'active'),
        eq(schema.subscribers.cadence, digest.cadence),
        lte(schema.subscribers.confirmedAt, digest.draftedAt),
        // A már kiszolgáltakat kihagyjuk: a kurzoruk már a periodEnd-en áll.
        or(
          isNull(schema.subscribers.lastDigestCursorAt),
          sql`${schema.subscribers.lastDigestCursorAt} < ${digest.periodEnd}`,
        ),
      ),
    )
    // FR-063 — a legrégebben kiszolgáltak előre, hogy ne mindig ugyanaz a
    // farok maradjon utoljára.
    .orderBy(sql`"lastDigestSentAt" ASC NULLS FIRST`, asc(schema.subscribers.id))
    .limit(capacity);

  if (recipients.length === 0) {
    // (9) NINCS TÖBB CÍMZETT → az összefoglaló KÉSZ. Ezt semmi más nem írja,
    // és az egészség-ellenőrzés ütem-feltétele ezt olvassa: egy sosem `sent`
    // állapotba érő összefoglaló a feltételt vagy örökre némává, vagy örökre
    // hangossá tenné.
    await db
      .update(schema.digests)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(schema.digests.id, digest.id));
    return { expired, sent: 0, status: 'sent', digestId: digest.id };
  }

  // (7) Foglalás a küldés ELŐTT.
  const reserved = await reserveSendBudget(db, recipients.length);
  if (reserved <= 0) {
    await db.update(schema.digests).set({ status: 'sending' }).where(eq(schema.digests.id, digest.id));
    return { expired, sent: 0, status: 'sending', digestId: digest.id, skipped: 'no_budget' };
  }

  const targets = recipients.slice(0, reserved);
  let delivered = 0;

  for (let offset = 0; offset < targets.length; offset += RESEND_BATCH_MAX) {
    const chunk = targets.slice(offset, offset + RESEND_BATCH_MAX);
    const prepared: Array<{ recipient: Recipient; message: Parameters<typeof sendBatch>[0][number] }> = [];

    for (const recipient of chunk) {
      if (!recipient.emailEnc) continue;
      // (6) Csak a saját szekciói, csak a saját kurzora utáni tételek.
      const cursor = recipient.lastDigestCursorAt;
      const own = items.filter(
        (i) =>
          recipient.sections.includes(i.section) &&
          (!cursor || i.occurredAt.getTime() > cursor.getTime()),
      );
      // Akinek nem marad tétele, azt kihagyjuk — de a kurzora ATTÓL MÉG
      // előrelép, különben jövő héten megkapná ezt az egész időszakot.
      if (own.length === 0) continue;

      const unsub = unsubUrl(recipient.id);
      const { text, html } = renderTemplateBody(own, {
        resumeDay,
        unsubscribeUrl: unsub ?? undefined,
      });
      prepared.push({
        recipient,
        message: {
          to: decryptPii(recipient.emailEnc),
          subject: digest.subjectHu,
          text,
          html,
          headers: unsub ? unsubscribeHeaders(unsub) : {},
        },
      });
    }

    if (prepared.length > 0) {
      const result = await sendBatch(prepared.map((p) => p.message));
      if (result.sent > 0) {
        delivered += result.sent;
        // (8) CÍMZETTENKÉNT, nem kötegenként.
        for (const { recipient } of prepared.slice(0, result.sent)) {
          await db
            .update(schema.subscribers)
            .set({ lastDigestSentAt: new Date(), lastDigestCursorAt: digest.periodEnd })
            .where(eq(schema.subscribers.id, recipient.id));
        }
      }
      if (result.failed > 0) {
        logger?.error?.(`digest-send: ${result.failed} failed`, result.error);
      }
    }

    // A tételt nem kapó címzettek kurzora is előrelép.
    const skipped = chunk.filter((r) => !prepared.some((p) => p.recipient.id === r.id));
    for (const recipient of skipped) {
      await db
        .update(schema.subscribers)
        .set({ lastDigestCursorAt: digest.periodEnd })
        .where(eq(schema.subscribers.id, recipient.id));
    }
  }

  // (9) A fel nem használt foglalás visszaadása, és a tényleges küldés rögzítése.
  if (delivered < reserved) await releaseSendBudget(db, reserved - delivered);
  if (delivered > 0) await recordSent(db, delivered);

  const totalSent = digest.sentCount + delivered;
  const moreLeft = recipients.length >= capacity;

  await db
    .update(schema.digests)
    .set({
      sentCount: totalSent,
      // (10) Maradék → `sending`; különben KÉSZ.
      status: moreLeft ? 'sending' : 'sent',
      ...(moreLeft ? {} : { sentAt: new Date() }),
    })
    .where(eq(schema.digests.id, digest.id));

  return {
    expired,
    sent: delivered,
    status: moreLeft ? 'sending' : 'sent',
    digestId: digest.id,
  };
}

export const digestSend = inngest.createFunction(
  { id: 'digest-send', name: 'Digest send', concurrency: 1 },
  [{ event: 'digest.send' }, { cron: DIGEST_CRON }],
  async ({ step, logger }) => {
    if (isBypassActive()) {
      logger?.info?.('digest-send: skipped — PIPELINE_BYPASS_INNGEST active, Vercel cron owns this run');
      return { skipped: 'inngest_bypass_active' };
    }
    return runDigestSendCore({ step: step as unknown as BypassStep, logger });
  },
);
