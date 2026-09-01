import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { hashSubscriberEmail } from '@/lib/subscriber-crypto';

/**
 * 012-reader-subscriptions — a kézbesítési webhook (FR-055, FR-082).
 *
 * HITELESÍTÉS NÉLKÜLI, szándékosan: az ALÁÍRÁS a hitelesítés. Nincs `svix`
 * függőség — a séma kézzel, `node:crypto`-val van megvalósítva.
 *
 * VISSZAÁLLÍTÁSI MEGJEGYZÉS: ez a végpont a `RESEND_API_KEY` kivétele UTÁN IS
 * elfogad bejegyzéseket. A kulcs a küldést kapuzza, nem a fogadást. Ha az
 * e-mailt kivezetjük, a webhookot a SZOLGÁLTATÓNÁL is ki kell kapcsolni,
 * különben a visszapattanás-események tovább módosítják a `Subscriber` sorokat
 * egy már kikapcsolt csatorna miatt.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** A Svix időbélyeg-ablaka. Ezen kívül a kérés elutasítva. */
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

/** Ennyi puha visszapattanás után tiltjuk le a címet. */
const SOFT_BOUNCE_SUPPRESS_AT = 3;

type ResendEvent = {
  type?: string;
  data?: {
    to?: string | string[];
    bounce?: { type?: string };
  };
};

/**
 * Svix-aláírás ellenőrzése az `${id}.${timestamp}.${raw}` bájtokon.
 *
 * A NYERS TÖRZSET a hívó olvassa be ELŐSZÖR, minden feldolgozás előtt: ha
 * előbb parse-olnánk, más bájtokat írnánk alá, mint amik megérkeztek. Ez az
 * egyetlen leggyakoribb hibaforrás ebben az ellenőrzésben.
 */
function verifySvix(
  raw: string,
  id: string | null,
  timestamp: string | null,
  sigHeader: string | null,
): boolean {
  const secretRaw = process.env.RESEND_WEBHOOK_SECRET;
  if (!secretRaw || !id || !timestamp || !sigHeader) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > TIMESTAMP_TOLERANCE_SECONDS) return false;

  let secret: Buffer;
  try {
    secret = Buffer.from(secretRaw.replace(/^whsec_/, ''), 'base64');
  } catch {
    return false;
  }
  if (secret.length === 0) return false;

  const expected = createHmac('sha256', secret)
    .update(`${id}.${timestamp}.${raw}`, 'utf8')
    .digest();

  // "v1,<b64> v1,<b64> …" — bármelyik egyező bejegyzés átengedi.
  for (const entry of sigHeader.split(' ')) {
    const [version, value] = entry.split(',');
    if (version !== 'v1' || !value) continue;
    let candidate: Buffer;
    try {
      candidate = Buffer.from(value, 'base64');
    } catch {
      continue;
    }
    // A hosszellenőrzés kötelező: a timingSafeEqual dob, ha a hosszak eltérnek.
    if (candidate.length !== expected.length) continue;
    if (timingSafeEqual(candidate, expected)) return true;
  }
  return false;
}

function firstRecipient(data: ResendEvent['data']): string | null {
  const to = data?.to;
  if (typeof to === 'string') return to;
  if (Array.isArray(to) && typeof to[0] === 'string') return to[0];
  return null;
}

export async function POST(req: Request) {
  // ELŐSZÖR a nyers törzs. Minden feldolgozás előtt.
  const raw = await req.text();

  const ok = verifySvix(
    raw,
    req.headers.get('svix-id'),
    req.headers.get('svix-timestamp'),
    req.headers.get('svix-signature'),
  );
  if (!ok) return NextResponse.json({ error: 'invalid signature' }, { status: 400 });

  let event: ResendEvent;
  try {
    event = JSON.parse(raw) as ResendEvent;
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const recipient = firstRecipient(event.data);
  // Nem érdekes esemény, vagy nincs címzett — nyugtázzuk, nem történik semmi.
  if (!recipient) return NextResponse.json({ ok: true });

  try {
    const db = getDb();
    // UGYANAZ a kanonizálás, mint a feliratkozó route-é (FR-082). A NYERS
    // CÍMET soha nem tároljuk.
    const emailHash = hashSubscriberEmail(recipient);

    const [row] = await db
      .select({
        id: schema.subscribers.id,
        status: schema.subscribers.status,
        bounceCount: schema.subscribers.bounceCount,
      })
      .from(schema.subscribers)
      .where(eq(schema.subscribers.emailHash, emailHash))
      .limit(1);

    // Ismeretlen hash — nem művelet. A webhook semmit nem árul el arról, mely
    // címek szerepelnek a listán.
    if (!row) return NextResponse.json({ ok: true });

    if (event.type === 'email.complained') {
      // VÉGLEGES. Soha nem fordul vissza.
      await db
        .update(schema.subscribers)
        .set({ status: 'complained' })
        .where(eq(schema.subscribers.id, row.id));
      return NextResponse.json({ ok: true });
    }

    if (event.type === 'email.bounced') {
      // Egy panasz után semmi nem írja felül az állapotot.
      if (row.status === 'complained') return NextResponse.json({ ok: true });

      const hard = (event.data?.bounce?.type ?? '').toLowerCase().includes('hard');
      const nextCount = row.bounceCount + 1;
      await db
        .update(schema.subscribers)
        .set({
          bounceCount: sql`${schema.subscribers.bounceCount} + 1`,
          lastBounceAt: new Date(),
          ...(hard || nextCount >= SOFT_BOUNCE_SUPPRESS_AT ? { status: 'bounced' as const } : {}),
        })
        .where(eq(schema.subscribers.id, row.id));
      return NextResponse.json({ ok: true });
    }

    // `email.delivered`, `email.sent` és minden más: figyelmen kívül hagyva.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhooks/resend] failed:', err);
    return NextResponse.json({ ok: true });
  }
}
