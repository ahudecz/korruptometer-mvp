import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

const intakeSchema = z.object({
  subjectEmail: z.string().email(),
  kind: z.enum(['access', 'deletion']),
  notes: z.string().trim().max(2000).nullable().optional(),
});

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
