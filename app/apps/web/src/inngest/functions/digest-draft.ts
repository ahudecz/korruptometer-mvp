import 'server-only';

import { and, asc, desc, eq, gt, isNull, lte } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { createBypassGuardedFunction } from '@/inngest/lib/detector-runner';
import type { BypassLogger, BypassStep } from '@/lib/cron-bypass';
import { approvalKeyboard, buildDigestDraft, type DigestItem } from '@/lib/digest-build';
import { sendTelegramMessage } from '@/lib/telegram';

/**
 * 012-reader-subscriptions — a heti összefoglaló piszkozata (FR-056…FR-059).
 *
 * KIZÁRÓLAG cron-trigger, ezért a ház bevett `createBypassGuardedFunction`
 * helperjével készül. A helper már elvégzi a `concurrency: 1`-et, az
 * `isBypassActive()` ellenőrzést, a naplózást és a `step` átalakítását — ezeket
 * a mag NEM ismétli meg.
 */

const DIGEST_CRON = 'TZ=Europe/Budapest 5 7 * * 1';
const DEFAULT_WINDOW_DAYS = 7;

export async function runDigestDraftCore({
  logger,
}: {
  step: BypassStep;
  logger?: BypassLogger;
}): Promise<{ drafted: boolean; reason?: string; digestId?: string }> {
  const db = getDb();
  const now = new Date();

  // Egyszerre csak egy piszkozat várhat jóváhagyásra.
  const [waiting] = await db
    .select({ id: schema.digests.id })
    .from(schema.digests)
    .where(eq(schema.digests.status, 'awaiting_approval'))
    .limit(1);
  if (waiting) {
    logger?.info?.('digest-draft: a draft is already awaiting approval');
    return { drafted: false, reason: 'already_awaiting' };
  }

  // Az ablak kezdete az ELŐZŐ összefoglaló periodEnd-je. Ha nincs ilyen, egy hét.
  const [previous] = await db
    .select({ periodEnd: schema.digests.periodEnd, sentAt: schema.digests.sentAt })
    .from(schema.digests)
    .where(eq(schema.digests.status, 'sent'))
    .orderBy(desc(schema.digests.periodEnd))
    .limit(1);

  const periodStart =
    previous?.periodEnd ?? new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60_000);
  const periodEnd = now;

  // Egy select a postaládán, `revokedAt IS NULL`-lal. A lista a piszkozatban
  // FAGY, és a küldés újra szűri (FR-061).
  const rows = await db
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
        gt(schema.subscriberAlerts.occurredAt, periodStart),
        lte(schema.subscriberAlerts.occurredAt, periodEnd),
        isNull(schema.subscriberAlerts.revokedAt),
      ),
    )
    .orderBy(asc(schema.subscriberAlerts.occurredAt));

  const items: DigestItem[] = rows.map((r) => ({ ...r }));

  const draft = await buildDigestDraft({
    items,
    periodStart,
    periodEnd,
    lastSentAt: previous?.sentAt ?? null,
    now,
    // A költségkapu ma nincs bekötve: a törzs sablonos, és pontosan ez a
    // viselkedés, amit egy elutasított kapunál is elvárunk (FR-058). Amikor
    // egy nyelvi modell bekerül, ITT kap egy `spendGate` és egy
    // `writeSummary` argumentumot — a `buildDigestDraft` tiszta marad.
  });

  if (!draft) {
    logger?.info?.(`digest-draft: floor not met (${items.length} items)`);
    return { drafted: false, reason: 'below_floor' };
  }

  const [inserted] = await db
    .insert(schema.digests)
    .values({
      code: draft.code,
      cadence: draft.cadence,
      status: 'awaiting_approval',
      periodStart: draft.periodStart,
      // A periodEnd az az érték, ami később MINDEN címzett
      // `lastDigestCursorAt`-jába íródik: egy hibás érték itt csendben
      // átírná, mit lát mindenki jövő héten.
      periodEnd: draft.periodEnd,
      alertIds: draft.alertIds,
      draftedAt: now,
      subjectHu: draft.subjectHu,
      bodyHtml: draft.bodyHtml,
      bodyText: draft.bodyText,
    })
    .returning({ id: schema.digests.id });

  const digestId = inserted?.id;
  if (!digestId) return { drafted: false, reason: 'insert_failed' };

  const message = [
    '📬 Heti hírlevél — jóváhagyásra vár',
    '',
    draft.subjectHu,
    '',
    draft.bodyText.slice(0, 3000),
    '',
    'Válaszolhatsz erre az üzenetre javított szöveggel is — az lesz a levél törzse.',
  ].join('\n');

  const messageId = await sendTelegramMessage(message, approvalKeyboard(draft.code));
  if (messageId) {
    // A válasz-ág EZZEL párosít (FR-068). Újrageneráláskor felülíródik.
    await db
      .update(schema.digests)
      .set({ telegramMessageId: messageId })
      .where(eq(schema.digests.id, digestId));
  }

  return { drafted: true, digestId };
}

export const digestDraft = createBypassGuardedFunction(
  { id: 'digest-draft', name: 'Digest draft', cron: DIGEST_CRON },
  runDigestDraftCore,
);
