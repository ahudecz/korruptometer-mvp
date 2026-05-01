import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

/**
 * T199 — POST /api/admin/submissions/[id]/audit-pii-read
 *
 * Phase 4 (sealed-box) moves PII decryption to the editor's browser. The
 * server still owns the forensic trail by writing an `AuditLog` row
 * whenever the editor confirms a successful client-side unseal. The signed
 * body proves the call originated from the authenticated editor's session
 * and not a CSRF.
 *
 * Body: { ts: <unix-seconds>, sig: HMAC(secret, `${editorId}:${submissionId}:${ts}`) }
 *
 * Phase 2 admins shouldn't call this — `GET /api/admin/submissions/[id]` (the
 * server decrypt path, T100) writes the audit row in the same transaction
 * as the decrypt.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: { ts?: number; sig?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const { ts, sig } = body;
  if (typeof ts !== 'number' || !sig) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (skew > 300) {
    return NextResponse.json({ error: 'timestamp out of window' }, { status: 400 });
  }
  const secret = process.env.INTERNAL_REVALIDATE_SECRET ?? process.env.PII_ENC_KEY;
  if (!secret) {
    return NextResponse.json({ error: 'server-side secret missing' }, { status: 503 });
  }
  const expected = createHmac('sha256', secret)
    .update(`${session.editor.id}:${id}:${ts}`)
    .digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sig, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 403 });
  }

  const db = getDb();
  const exists = await db.query.submissions.findFirst({
    where: eq(schema.submissions.id, id),
    columns: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'pii.read',
    entityType: 'Submission',
    entityId: id,
    detail: { mode: 'sealed-box', verifiedTs: ts },
  });

  return NextResponse.json({ ok: true });
}
