import 'server-only';
import { and, desc, eq, gt, inArray, isNotNull, lte, or } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { postPhotoViaMake } from '@/lib/make-facebook';
import { postPhotoToPage } from '@/lib/facebook';
import { formatSlot, scheduleBatch } from '@/lib/social-schedule';

/**
 * A SocialPostOutbox jóváhagyás → ÜTEMEZÉS → kiposztolás útja egy helyen.
 *
 * 2026-09-11 előtt a Telegram-webhook "✅ Közzététel" gombja maga hívta a
 * Facebook/Make API-t, soronként. A user kérése ("egyben jönnek telegramra …
 * de pár óra csúsztatással küldöd ki akkor is, ha egyben hagyom jóvá") miatt
 * a jóváhagyás mostantól csak IDŐPONTOT ad (`scheduledFor`), és a tényleges
 * posztolást a /api/cron/publish-scheduled-social cron végzi ezen a
 * `publishOutboxRow()`-n keresztül. Így pontosan egy posztoló kódút van —
 * a webhook, a cron és az admin-felület ugyanazt hívja.
 */

export type PublishResult =
  | { ok: true; text: string; externalPostId?: string }
  | { ok: false; text: string; retryable: boolean };

type OutboxRow = typeof schema.socialPostOutbox.$inferSelect;

/** Ténylegesen kiposztol egy sort, és a végállapotot beírja a DB-be. */
export async function publishOutboxRow(row: OutboxRow): Promise<PublishResult> {
  const db = getDb();
  const imageBuffer = Buffer.from(row.imagePng, 'base64');

  // Elsődleges út a Make.com (Advanced Access-es FB Pages app), visszaesés a
  // közvetlen Graph API-ra — l. make-facebook.ts fejléc, miért ez a sorrend.
  const viaMake = await postPhotoViaMake(imageBuffer, row.caption);
  if (viaMake.ok) {
    await db.update(schema.socialPostOutbox)
      .set({ status: 'posted', postedAt: new Date() })
      .where(eq(schema.socialPostOutbox.id, row.id));
    const pagePublicId = process.env.FACEBOOK_PAGE_PUBLIC_ID;
    const pageLink = pagePublicId ? `\nhttps://www.facebook.com/profile.php?id=${pagePublicId}` : '';
    return { ok: true, text: `✅ Kiküldve a Facebookra (Make.com) — pár másodpercen belül megjelenik.${pageLink}` };
  }

  if (!viaMake.notConfigured) {
    await db.update(schema.socialPostOutbox)
      .set({ status: 'failed', failureReason: viaMake.error })
      .where(eq(schema.socialPostOutbox.id, row.id));
    return { ok: false, text: `❌ Hiba a Facebook-posztolásnál (Make.com): ${viaMake.error}`, retryable: false };
  }

  const posted = await postPhotoToPage(imageBuffer, row.caption);
  if (posted.ok) {
    await db.update(schema.socialPostOutbox)
      .set({ status: 'posted', externalPostId: posted.postId, postedAt: new Date() })
      .where(eq(schema.socialPostOutbox.id, row.id));
    return { ok: true, text: `✅ Kiposztolva a Facebookra.\n${posted.postUrl}`, externalPostId: posted.postId };
  }

  if (posted.notConfigured) {
    // Se Make, se közvetlen FB — a sor 'approved' marad, de scheduledFor=null,
    // hogy a cron ne pörögjön rajta újra és újra. Kézzel újraküldhető.
    await db.update(schema.socialPostOutbox)
      .set({ status: 'approved', scheduledFor: null, failureReason: 'Sem a Make.com, sem a Facebook-fiók nincs bekötve.' })
      .where(eq(schema.socialPostOutbox.id, row.id));
    return { ok: false, text: '⚠️ Jóváhagyva, de sem a Make.com, sem a Facebook-fiók nincs bekötve — amint megvan, kézzel újraküldhető.', retryable: true };
  }

  await db.update(schema.socialPostOutbox)
    .set({ status: 'failed', failureReason: posted.error })
    .where(eq(schema.socialPostOutbox.id, row.id));
  return { ok: false, text: `❌ Hiba a Facebook-posztolásnál: ${posted.error}`, retryable: false };
}

/**
 * A legutóbb KIOSZTOTT vagy már kiposztolt időpont — ehhez képest tartja a
 * `scheduleBatch()` a 3 órás szünetet. Csak a friss (48 órán belüli) sorokat
 * nézi: egy hetekkel ezelőtti poszt ne tolja el a mait.
 */
export async function lastScheduledSlot(): Promise<Date | null> {
  const db = getDb();
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  // SZÁNDÉKOSAN nincs itt nyers sql-töredék Date-tel — 2026-09-11-én pont az
  // tette tönkre az ÖSSZES jóváhagyó gombot. Egy nyers sql-töredékbe
  // interpolált Date típus-hozzárendelés nélkül megy a postgres-js felé, és
  // futásidőben dob: "The string argument must be of type string or an
  // instance of Buffer or ArrayBuffer. Received an instance of Date".
  // A kivételt a webhook catch-e elnyelte, a Telegram 200-at kapott, a sor
  // nem változott — kívülről pontosan úgy nézett ki, mint egy néma, halott
  // gomb. A tipizált gt() a helyes forma; a maximumot JS-ben számoljuk, így
  // GREATEST/COALESCE sem kell.
  const rows = await db
    .select({ scheduledFor: schema.socialPostOutbox.scheduledFor, postedAt: schema.socialPostOutbox.postedAt })
    .from(schema.socialPostOutbox)
    .where(and(
      inArray(schema.socialPostOutbox.status, ['approved', 'posted']),
      or(
        gt(schema.socialPostOutbox.scheduledFor, since),
        gt(schema.socialPostOutbox.postedAt, since),
      ),
    ))
    .orderBy(desc(schema.socialPostOutbox.createdAt))
    .limit(50);

  const times = rows
    .flatMap((r) => [r.scheduledFor, r.postedAt])
    .filter((d): d is Date => d instanceof Date && d.getTime() > since.getTime());
  return times.length > 0 ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
}

export type ScheduledItem = { id: string; headline: string; slot: Date; slotLabel: string };

/**
 * Jóváhagy egy vagy több jelöltet, és mindegyiknek kiosztja a saját idejét.
 * A sorrend a `ids` sorrendje — a hívó adja meg (a webhook a legrégebbi
 * jelölttel kezd, hogy ne álljon be a sor).
 */
export async function approveAndSchedule(ids: string[]): Promise<ScheduledItem[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select({ id: schema.socialPostOutbox.id, headline: schema.socialPostOutbox.headline })
    .from(schema.socialPostOutbox)
    .where(and(
      inArray(schema.socialPostOutbox.id, ids),
      eq(schema.socialPostOutbox.status, 'pending_approval'),
    ));
  // Az `ids` sorrendjét tartjuk, a DB nem garantál sorrendet.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter((r): r is { id: string; headline: string } => r !== undefined);
  if (ordered.length === 0) return [];

  const slots = scheduleBatch(new Date(), await lastScheduledSlot(), ordered.length);
  const out: ScheduledItem[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const row = ordered[i]!;
    const slot = slots[i]!;
    await db.update(schema.socialPostOutbox)
      .set({ status: 'approved', scheduledFor: slot, failureReason: null })
      .where(eq(schema.socialPostOutbox.id, row.id));
    out.push({ id: row.id, headline: row.headline, slot, slotLabel: formatSlot(slot) });
  }
  return out;
}

/** A most esedékes (scheduledFor <= now), még ki nem posztolt sorok. */
export async function dueOutboxRows(now: Date = new Date()): Promise<OutboxRow[]> {
  const db = getDb();
  return db
    .select()
    .from(schema.socialPostOutbox)
    .where(and(
      eq(schema.socialPostOutbox.status, 'approved'),
      isNotNull(schema.socialPostOutbox.scheduledFor),
      lte(schema.socialPostOutbox.scheduledFor, now),
    ))
    .orderBy(schema.socialPostOutbox.scheduledFor);
}
