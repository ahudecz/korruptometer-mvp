import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { confirmIpLimiter, confirmTokenLimiter, subscribePageLimiter } from '@korr/shared/ratelimit';

import { getDb, schema } from '@/lib/db';
import { hashConfirmToken, PURGE_DAYS, verifyUnsubToken } from '@/lib/subscriber-crypto';

/**
 * 012-reader-subscriptions — leiratkozás (FR-034, FR-035, FR-039, FR-085).
 *
 * A GET SEMMIT nem módosít. Soha.
 *
 * Az RFC 8058 EZT AZ ÚTVONALAT NEM VÉDI: a 8058 kizárólag a
 * `List-Unsubscribe-Post` fejléc URL-jére vonatkozik, sosem a levéltörzsben
 * lévő linkre, amire egy ember kattint. Egy levélszűrő ugyanúgy lekéri.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}

function tokenKey(token: string): string {
  return hashConfirmToken(token).slice(0, 32);
}

const UNSUBSCRIBED = {
  state: 'unsubscribed',
  message: 'Leiratkoztál. Bármikor visszatérhetsz.',
} as const;

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const page = await subscribePageLimiter.limit(`subpg:${ip}`);
  if (!page.success) {
    return NextResponse.json({ error: 'Túl sok kérés. Próbáld újra később.' }, { status: 429 });
  }
  // Érvényes, lejárt és kitalált token esetén AZONOS válasz (FR-035).
  return NextResponse.json(
    { state: 'form', message: 'Biztosan leiratkozol?' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Két hívó, egy kezelő:
 *
 * 1. az OLVASÓ, az oldal űrlapjáról: `{ "t": "<token>" }`;
 * 2. a LEVELEZŐ, egy kattintással, a `List-Unsubscribe-Post` fejléc URL-jéről —
 *    ott a token a lekérdezési sztringben van, a törzs pedig
 *    `List-Unsubscribe=One-Click`.
 *
 * Mindkét alakot elfogadjuk.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const url = new URL(req.url);
  let token = url.searchParams.get('t');

  if (!token) {
    const raw = await req.text().catch(() => '');
    if (raw.trim().startsWith('{')) {
      try {
        const body = JSON.parse(raw) as Record<string, unknown>;
        if (typeof body.t === 'string') token = body.t;
      } catch {
        token = null;
      }
    } else if (raw) {
      token = new URLSearchParams(raw).get('t');
    }
  }

  if (token) {
    const perToken = await confirmTokenLimiter().limit(`cfmt:${tokenKey(token)}`);
    if (!perToken.success) {
      return NextResponse.json({ error: 'Túl sok kísérlet. Próbáld újra később.' }, { status: 429 });
    }
  }
  const perIp = await confirmIpLimiter().limit(`cfmi:${ip}`);
  if (!perIp.success) {
    return NextResponse.json({ error: 'Túl sok kísérlet. Próbáld újra később.' }, { status: 429 });
  }

  // Ismeretlen kid ELUTASÍT — a verify sosem próbálja sorra a kulcsokat.
  const subscriberId = verifyUnsubToken(token);
  // A válasz akkor is ugyanez, ha a token érvénytelen: egy leiratkozó felület
  // nem árulhatja el, létezik-e az a feliratkozó.
  if (!subscriberId) return NextResponse.json(UNSUBSCRIBED);

  try {
    const db = getDb();
    const [row] = await db
      .select({ id: schema.subscribers.id, status: schema.subscribers.status })
      .from(schema.subscribers)
      .where(eq(schema.subscribers.id, subscriberId))
      .limit(1);

    // Idempotens: a második kattintás semmit nem változtat, és ugyanezt adja
    // vissza (SC-006).
    if (!row || row.status === 'unsubscribed') return NextResponse.json(UNSUBSCRIBED);

    const now = new Date();
    await db
      .update(schema.subscribers)
      .set({
        status: 'unsubscribed',
        unsubscribedAt: now,
        // FR-085 — a személyes adat törlése ennyi nappal későbbre ütemeződik.
        purgePiiAt: new Date(now.getTime() + PURGE_DAYS * 24 * 60 * 60_000),
      })
      .where(eq(schema.subscribers.id, row.id));

    await db.insert(schema.auditLogs).values({
      action: 'subscriber.unsubscribe',
      entityType: 'Subscriber',
      entityId: row.id,
      detail: { purgeInDays: PURGE_DAYS },
    });

    return NextResponse.json(UNSUBSCRIBED);
  } catch (err) {
    console.error('[hirlevel/leiratkozas] failed:', err);
    return NextResponse.json(UNSUBSCRIBED);
  }
}
