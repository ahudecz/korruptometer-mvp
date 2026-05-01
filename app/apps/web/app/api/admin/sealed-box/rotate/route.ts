import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { inngest } from '@/inngest/client';

/**
 * T210 — POST /api/admin/sealed-box/rotate
 *
 * Admin-role + WebAuthn-gated, audit-logged. Fires the
 * `submissions.rotate-seal` Inngest event (FR-081). The actual re-sealing
 * runs in the editor's browser via /admin/sealed-box/rotate (T211) which
 * polls the function's progress.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'csak admin' }, { status: 403 });
  }
  const db = getDb();
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'sealed-box.rotate-trigger',
    entityType: 'System',
    entityId: 'submissions.rotate-seal',
  });
  await inngest.send({
    name: 'submissions.rotate-seal',
    data: { triggeredBy: session.editor.email ?? session.editor.id },
  });
  return NextResponse.json({ ok: true });
}
