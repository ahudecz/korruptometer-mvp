import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

const bodySchema = z.object({
  lookupKind: z.string().min(1),
  note: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const ifMatch = req.headers.get('If-Match');
  if (!ifMatch) {
    return NextResponse.json({ error: 'precondition_required' }, { status: 428 });
  }
  const expected = new Date(ifMatch);
  if (Number.isNaN(expected.getTime())) {
    return NextResponse.json({ error: 'invalid_if_match' }, { status: 400 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const db = getDb();
  const rows = await db
    .select({ updatedAt: schema.investigations.updatedAt })
    .from(schema.investigations)
    .where(eq(schema.investigations.id, id))
    .limit(1);
  if (!rows[0]) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (rows[0].updatedAt.getTime() !== expected.getTime()) {
    return NextResponse.json(
      { error: 'stale', currentUpdatedAt: rows[0].updatedAt.toISOString() },
      { status: 409 },
    );
  }
  const inserted = await db
    .insert(schema.investigationLeads)
    .values({
      investigationId: id,
      kind: 'escalation',
      status: 'open',
      question: parsed.data.note,
      createdBy: 'reviewer',
      actorEditorId: session.editor.id,
      testedAgainst: { lookupKind: parsed.data.lookupKind },
    })
    .returning({ id: schema.investigationLeads.id });
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'investigation.escalation.requested',
    entityType: 'Investigation',
    entityId: id,
    detail: {
      leadId: inserted[0]?.id ?? null,
      lookupKind: parsed.data.lookupKind,
    },
  });
  return NextResponse.json({ id: inserted[0]?.id }, { status: 201 });
}
