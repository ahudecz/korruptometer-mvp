import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { inngest } from '@/inngest/client';

/**
 * T125 — POST /api/admin/_internal/run-retention-sweep
 *
 * Admin-role + WebAuthn-gated (the WebAuthn middleware lives in
 * `apps/web/middleware.ts`; here we call requireAdmin which already covers
 * role + active checks). Audit-logged. Fires the gdpr.retention-sweep
 * Inngest event for ad-hoc sweeps.
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
    action: 'admin.retention-sweep.manual',
    entityType: 'System',
    entityId: 'gdpr.retention-sweep',
  });
  await inngest.send({ name: 'gdpr.retention-sweep', data: {} });
  return NextResponse.json({ ok: true });
}
