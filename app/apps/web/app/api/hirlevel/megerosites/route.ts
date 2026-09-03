import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { confirmIpLimiter, confirmTokenLimiter, subscribePageLimiter } from '@korr/shared/ratelimit';

import { getDb, schema } from '@/lib/db';
import { hashConfirmToken, hashIp } from '@/lib/subscriber-crypto';

/**
 * 012-reader-subscriptions — megerősítés (FR-033…FR-036, FR-046).
 *
 * A GET SEMMIT nem módosít. Soha (FR-034).
 *
 * Miért: a vállalati levélszűrők — SafeLinks, Proofpoint, Mimecast — kézbesítéskor
 * MINDEN linket lekérnek. Egy GET-en elhasznált, egyszer használatos token
 * azelőtt ég el, hogy az olvasó rákattintana, és a három darabos küldési korlát
 * ezután VÉGLEG és NÉMÁN kizárja azt a címet.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}

/** A token azonosítója a sebességkorlát kulcsához — sosem maga a token. */
function tokenKey(token: string): string {
  return hashConfirmToken(token).slice(0, 32);
}

/**
 * A GET csak azt mondja meg, hogy az oldal létezik. Az érvényesség KIZÁRÓLAG a
 * beküldés után derül ki (FR-035), ezért a válasz független a tokentől.
 */
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const page = await subscribePageLimiter.limit(`subpg:${ip}`);
  if (!page.success) {
    return NextResponse.json({ error: 'Túl sok kérés. Próbáld újra később.' }, { status: 429 });
  }
  return NextResponse.json(
    { state: 'form', message: 'Erősítsd meg a feliratkozásod.' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const token = typeof body?.t === 'string' ? body.t : null;
  const ip = getClientIp(req);

  // A token szerinti kulcs KÖTELEZŐ: egy közös vállalati kimenő IP-cím
  // hatástalanítja a cím szerinti kulcsot (FR-046).
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

  // Egy ismeretlen és egy lejárt token válasza AZONOS (FR-035).
  const expired = { state: 'expired', message: 'Ez a link lejárt.', resend: true } as const;
  if (!token) return NextResponse.json(expired);

  try {
    const db = getDb();
    const [row] = await db
      .select({
        id: schema.subscribers.id,
        status: schema.subscribers.status,
        emailEnc: schema.subscribers.emailEnc,
        purgePiiAt: schema.subscribers.purgePiiAt,
        expiresAt: schema.subscribers.confirmTokenExpiresAt,
      })
      .from(schema.subscribers)
      .where(eq(schema.subscribers.confirmTokenHash, hashConfirmToken(token)))
      .limit(1);

    if (!row) return NextResponse.json(expired);

    if (row.emailEnc === null && row.purgePiiAt !== null) {
      return NextResponse.json({
        state: 'erased',
        message: 'Ezt a címet nem tudjuk feliratkoztatni.',
      });
    }
    if (row.status === 'active') {
      return NextResponse.json({ state: 'already', message: 'Ez a feliratkozás már aktív.' });
    }
    if (!row.expiresAt || row.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(expired);
    }

    // Egyszer használatos: a token hash-e itt NULLázódik (FR-036).
    await db
      .update(schema.subscribers)
      .set({
        status: 'active',
        confirmedAt: new Date(),
        confirmedIpHash: hashIp(ip),
        confirmTokenHash: null,
        confirmTokenExpiresAt: null,
      })
      .where(eq(schema.subscribers.id, row.id));

    await db.insert(schema.auditLogs).values({
      action: 'subscriber.confirm',
      entityType: 'Subscriber',
      entityId: row.id,
      detail: { confirmed: true },
    });

    return NextResponse.json({ state: 'confirmed', message: 'Kész. Mostantól kapsz értesítést.' });
  } catch (err) {
    console.error('[hirlevel/megerosites] failed:', err);
    return NextResponse.json(expired);
  }
}
