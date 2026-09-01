import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { hashSubscriberEmail } from '@/lib/subscriber-crypto';

/**
 * 012-reader-subscriptions FR-087, FR-091 — kézi törlési kérés teljesítése.
 *
 * A törlést AZONNALI söprésre ütemezi (`purgePiiAt = now()`), és auditsort ír
 * a címet KITAKARVA. A következő megőrzési söprés nullázza az `emailEnc`-et,
 * a `signupIpHash`-t, a `confirmedIpHash`-t és a `confirmTokenHash`-t, és
 * MEGTARTJA az `emailHash`-t, a `status`-t és a `consentTextVersion`-t.
 *
 * Ugyanaz a kanonizálás, mint a feliratkozó route-é és a szolgáltatói
 * webhooké (FR-082). A meglévő `/api/admin/dsr` NEM normalizál, ezért annak
 * hash-tere szándékosan külön marad — a specifikáció annak javítását kizárja.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({ email: z.string().trim().email() });

/** Ugyanaz a válasz akkor is, ha a cím nem szerepel a listán. */
const UNIFORM = { ok: true, scheduled: true };

export async function POST(req: Request) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Érvénytelen kérés.' }, { status: 400 });
  }

  const emailHash = hashSubscriberEmail(parsed.data.email);
  const db = getDb();

  const updated = await db
    .update(schema.subscribers)
    .set({ purgePiiAt: new Date() })
    .where(eq(schema.subscribers.emailHash, emailHash))
    .returning({ id: schema.subscribers.id });

  const row = updated[0];
  await db.insert(schema.auditLogs).values({
    action: 'subscriber.erase',
    entityType: 'Subscriber',
    // Ha nincs ilyen sor, a hash az entitás azonosítója. A CÍM egyik ágon sem
    // kerül olvasható alakban az auditba.
    entityId: row?.id ?? emailHash,
    detail: { emailHashPrefix: emailHash.slice(0, 12), found: Boolean(row) },
  });

  return NextResponse.json(UNIFORM);
}
