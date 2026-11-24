import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { verifyCronRequest } from '@/lib/cron-bypass';
import { getDb, schema } from '@/lib/db';

/**
 * 2026-11-24 — a napi Facebook-szinkron (scripts/fb-feed-sync.mjs, GitHub
 * Actions: daily-fb-feed-sync.yml) adatbázis-kapuja.
 *
 * Miért kell: a script eredetileg a Supabase REST API-n írt, ami 09-17 óta
 * 402-t ad (elfogyott ingyenes adatforgalom) — a job 10-26 óta minden nap
 * elhasalt, új Facebook-poszt nem került be. A Postgres-kapcsolat (amit a
 * weboldal is használ) működik, ezért a script mostantól ezen a végponton át
 * olvas és ír. A Facebook-letöltés továbbra is CI-ben marad (l. a script
 * fejlécét) — ez a végpont soha nem hívja a Facebookot.
 *
 * Biztonság: CRON_SECRET bearer (ugyanaz, mint a többi GitHub-os cronnál).
 * Csak a SocialPost táblába szúr be / pótol postedAt-et; törlés nincs.
 *
 *  GET  → { pages, existing, missingPostedAt }
 *  POST { inserts: [...], backfills: [{postUrl, postedAt}] } → { inserted, backfilled }
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const fbUrl = z.string().url().max(1000).startsWith('https://www.facebook.com/');
const isoTs = z.string().datetime({ offset: true }).nullable();

const body = z.object({
  inserts: z
    .array(
      z.object({
        authorName: z.string().trim().min(1).max(300),
        authorHandle: z.string().max(300).nullable(),
        postUrl: fbUrl,
        content: z.string().trim().min(1).max(20_000),
        imageUrl: z.string().url().max(2000).nullable(),
        postedAt: isoTs,
      }),
    )
    .max(500)
    .default([]),
  backfills: z
    .array(z.object({ postUrl: fbUrl, postedAt: z.string().datetime({ offset: true }) }))
    .max(2000)
    .default([]),
});

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = getDb();
  const pages = await db
    .select({
      pageId: schema.facebookPages.pageId,
      pageHandle: schema.facebookPages.pageHandle,
      pageName: schema.facebookPages.pageName,
    })
    .from(schema.facebookPages);
  const existing = await db.select({ postUrl: schema.socialPosts.postUrl }).from(schema.socialPosts);
  const missing = await db
    .select({ postUrl: schema.socialPosts.postUrl })
    .from(schema.socialPosts)
    .where(isNull(schema.socialPosts.postedAt));
  return NextResponse.json({
    pages,
    existing: existing.map((r) => r.postUrl),
    missingPostedAt: missing.map((r) => r.postUrl),
  });
}

export async function POST(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', issues: parsed.error.issues.slice(0, 20) }, { status: 400 });
  }
  const { inserts, backfills } = parsed.data;
  const db = getDb();

  let inserted = 0;
  if (inserts.length > 0) {
    const rows = await db
      .insert(schema.socialPosts)
      .values(
        inserts.map((r) => ({
          ...r,
          platform: 'facebook',
          hidden: false,
          postedAt: r.postedAt ? new Date(r.postedAt) : null,
        })),
      )
      .onConflictDoNothing({ target: schema.socialPosts.postUrl })
      .returning({ id: schema.socialPosts.id });
    inserted = rows.length;
  }

  let backfilled = 0;
  for (const b of backfills) {
    const rows = await db
      .update(schema.socialPosts)
      .set({ postedAt: new Date(b.postedAt) })
      .where(and(eq(schema.socialPosts.postUrl, b.postUrl), isNull(schema.socialPosts.postedAt)))
      .returning({ id: schema.socialPosts.id });
    backfilled += rows.length;
  }

  if (inserted > 0 || backfilled > 0) {
    revalidatePath('/');
    revalidatePath('/legfontosabb-hangok');
  }
  return NextResponse.json({ inserted, backfilled });
}

