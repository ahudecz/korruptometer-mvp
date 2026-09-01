import { NextResponse } from 'next/server';
import { and, eq, isNotNull, lt } from 'drizzle-orm';

import { confirmIpLimiter } from '@korr/shared/ratelimit';

import { getDb, schema } from '@/lib/db';
import { inngest } from '@/inngest/client';
import { hashConfirmToken } from '@/lib/subscriber-crypto';

/**
 * 012-reader-subscriptions — "Küldj újat" (FR-037).
 *
 * Csak a lejárt állapotból érhető el, és a `confirmIpLimiter` keretén osztozik
 * a megerősítő beküldéssel.
 *
 * A SZÁMLÁLÓ NULLÁZÁSA a lényeg: e nélkül a három darabos korlát ütközne a 24
 * órás lejárattal, és VÉGLEG kizárná azt, aki csak másnap este olvassa el a
 * levelét. A nullázás CSAK akkor történik meg, ha az előző token tényleg
 * lejárt és használatlan maradt.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}

/** Ugyanaz a válasz minden ágon — egy ismeretlen token semmit nem árul el. */
const UNIFORM = {
  ok: true,
  message: 'Ha ehhez a címhez tartozik függőben lévő feliratkozás, elküldtük az új linket.',
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const perIp = await confirmIpLimiter().limit(`cfmi:${ip}`);
  if (!perIp.success) {
    return NextResponse.json({ error: 'Túl sok kísérlet. Próbáld újra később.' }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const token = typeof body?.t === 'string' ? body.t : null;
  if (!token) return NextResponse.json(UNIFORM);

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { paused: true, message: 'A feliratkozás átmenetileg szünetel.' },
      { status: 503 },
    );
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({ id: schema.subscribers.id, status: schema.subscribers.status })
      .from(schema.subscribers)
      .where(eq(schema.subscribers.confirmTokenHash, hashConfirmToken(token)))
      .limit(1);

    if (!row || row.status !== 'pending') return NextResponse.json(UNIFORM);

    // A nullázás feltételes: csak LEJÁRT, használatlan tokenre. A `lt(…, now)`
    // az, ami megakadályozza, hogy valaki egy még élő linkkel nullázza a
    // számlálót, és ezzel korlátlan levelet kérjen egy idegen címre.
    const reset = await db
      .update(schema.subscribers)
      .set({ confirmSentCount: 0 })
      .where(
        and(
          eq(schema.subscribers.id, row.id),
          isNotNull(schema.subscribers.confirmTokenExpiresAt),
          lt(schema.subscribers.confirmTokenExpiresAt, new Date()),
        ),
      )
      .returning({ id: schema.subscribers.id });

    if (reset.length === 0) return NextResponse.json(UNIFORM);

    await inngest.send({ name: 'subscriber.confirm-send', data: { subscriberId: row.id } });
    return NextResponse.json(UNIFORM);
  } catch (err) {
    console.error('[hirlevel/megerosites/ujra] failed:', err);
    return NextResponse.json(UNIFORM);
  }
}
