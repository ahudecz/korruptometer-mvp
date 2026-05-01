import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

/**
 * T180 — DSR queue API. Editor-role-gated. Every state transition writes
 * an AuditLog entry (FR-075). The SLA countdown is rendered by the UI from
 * `slaDeadline` on each row.
 */

const intakeSchema = z.object({
  subjectEmail: z.string().email(),
  kind: z.enum(['access', 'deletion']),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const transitionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['received', 'verified', 'fulfilled', 'closed']),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function GET() {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.dsrRequests)
    .orderBy(desc(schema.dsrRequests.createdAt));
  return NextResponse.json({ items: rows }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = intakeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'érvénytelen mezők' }, { status: 400 });
  }
  const { subjectEmail, kind, notes } = parsed.data;
  const subjectEmailHash = createHash('sha256').update(subjectEmail).digest('hex');
  const slaDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const db = getDb();
  const [row] = await db
    .insert(schema.dsrRequests)
    .values({
      subjectEmailHash,
      kind,
      slaDeadline,
      notes: notes ?? null,
      assignedEditorId: session.editor.id,
    })
    .returning({ id: schema.dsrRequests.id });

  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'dsr.received',
    entityType: 'DsrRequest',
    entityId: row!.id,
    detail: { kind, slaDeadline: slaDeadline.toISOString() },
  });

  return NextResponse.json({ ok: true, id: row!.id });
}

export async function PATCH(req: Request) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = transitionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'érvénytelen művelet' }, { status: 400 });
  }
  const { id, status, notes } = parsed.data;

  const db = getDb();
  const existing = await db.query.dsrRequests.findFirst({
    where: eq(schema.dsrRequests.id, id),
  });
  if (!existing) {
    return NextResponse.json({ error: 'nem található' }, { status: 404 });
  }

  await db
    .update(schema.dsrRequests)
    .set({
      status,
      notes: notes ?? existing.notes,
      assignedEditorId: session.editor.id,
    })
    .where(eq(schema.dsrRequests.id, id));

  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: `dsr.${status}`,
    entityType: 'DsrRequest',
    entityId: id,
    detail: { from: existing.status, to: status },
  });

  return NextResponse.json({ ok: true });
}
