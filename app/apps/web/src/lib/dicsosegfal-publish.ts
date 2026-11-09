import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, inArray, isNull } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

/**
 * Dicsőségfal-profilok napi, jóváhagyásos élesítése (user kérés, 2026-11-09).
 *
 *  1. A napi felhős futás megírja a következő profil `detail`-jét `live: false`
 *     mellett, pusholja, majd meghívja a POST /api/dicsosegfal/draft végpontot.
 *  2. Ez Telegramon elküldi a titkos előnézeti linket és a „🚀 Élesít" gombot.
 *  3. A gomb (`fal:a:<slug>`) a ProfileDraftApproval táblába ír.
 *  4. A következő futás a GET /api/dicsosegfal/approved listából átírja a
 *     configot `live: true`-ra, pusholja, majd a POST /api/dicsosegfal/published
 *     végponttal lezárja: publishedAt, IndexNow, Telegram-link.
 *
 * Az előnézeti kulcs a CRON_SECRET-ből származtatott HMAC: nem kell hozzá új
 * env-változó, és profilonként más, tehát egy kiszivárgott link csak azt az
 * egy tervezetet nyitja meg.
 */

/**
 * A felhős futás NEM ismeri a CRON_SECRET-et (élesben „sensitive", vissza nem
 * olvasható), ezért a három /api/dicsosegfal végpont egy külön, csak ezekre
 * érvényes kulcsot is elfogad. A CRON_SECRET továbbra is működik.
 */
export function verifyDicsosegfalRequest(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const cron = process.env.CRON_SECRET;
  const own = process.env.DICSOSEGFAL_API_SECRET;
  return Boolean(auth) && ((Boolean(cron) && auth === `Bearer ${cron}`) || (Boolean(own) && auth === `Bearer ${own}`));
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.kegyencjarat.hu').replace(/\/+$/, '');

/** A kulcsfájl a /public alatt van: /<INDEXNOW_KEY>.txt — a kulcs nem titok. */
export const INDEXNOW_KEY = '58717aecd38fdc5842e5bf2da1bbca20';

export function previewToken(slug: string, secret = process.env.CRON_SECRET): string | null {
  if (!secret) return null;
  return createHmac('sha256', secret).update(`dicsosegfal-preview:${slug}`).digest('hex').slice(0, 32);
}

export function verifyPreviewToken(slug: string, token: string | undefined, secret = process.env.CRON_SECRET): boolean {
  const expected = previewToken(slug, secret);
  if (!expected || !token || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function previewUrl(slug: string): string | null {
  const token = previewToken(slug);
  return token ? `${SITE_URL}/elonezet/rendszervaltas/${slug}?k=${token}` : null;
}

export function liveUrl(slug: string): string {
  return `${SITE_URL}/rendszervaltas/${slug}`;
}

/** Idempotens: másodszori gombnyomás nem írja felül az első jóváhagyás idejét. */
export async function approveDraft(slug: string): Promise<void> {
  await getDb()
    .insert(schema.profileDraftApprovals)
    .values({ slug })
    .onConflictDoNothing();
}

export async function listApprovedUnpublished(): Promise<{ slug: string; approvedAt: Date }[]> {
  return getDb()
    .select({ slug: schema.profileDraftApprovals.slug, approvedAt: schema.profileDraftApprovals.approvedAt })
    .from(schema.profileDraftApprovals)
    .where(isNull(schema.profileDraftApprovals.publishedAt));
}

export async function markPublished(slugs: string[]): Promise<void> {
  if (slugs.length === 0) return;
  await getDb()
    .update(schema.profileDraftApprovals)
    .set({ publishedAt: new Date() })
    .where(and(inArray(schema.profileDraftApprovals.slug, slugs), isNull(schema.profileDraftApprovals.publishedAt)));
}

/**
 * IndexNow (Bing, Yandex, Seznam, Naver — a Google NEM vesz részt benne).
 * A Google-nek nincs nyilvános „indexelés kérése" API-ja általános oldalakra;
 * ott a sitemap + belső link + a napi futás Search Console-ellenőrzése marad.
 */
export async function submitIndexNow(urls: string[]): Promise<{ ok: boolean; status: number | null }> {
  if (urls.length === 0) return { ok: true, status: null };
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: new URL(SITE_URL).host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });
    // 200 = elfogadva, 202 = elfogadva, a kulcs ellenőrzése folyamatban.
    return { ok: res.status === 200 || res.status === 202, status: res.status };
  } catch {
    return { ok: false, status: null };
  }
}
