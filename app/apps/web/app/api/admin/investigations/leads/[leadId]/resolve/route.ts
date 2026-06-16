import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

const bodySchema = z.object({
  status: z.enum(['resolved', 'rejected']),
  finding: z.string(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { leadId } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const db = getDb();
  const existing = await db
    .select({ investigationId: schema.investigationLeads.investigationId })
    .from(schema.investigationLeads)
    .where(eq(schema.investigationLeads.id, leadId))
    .limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  await db
    .update(schema.investigationLeads)
    .set({
      status: parsed.data.status,
      finding: parsed.data.finding,
      resolvedAt: new Date(),
    })
    .where(eq(schema.investigationLeads.id, leadId));
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'investigation.lead.resolved',
    entityType: 'InvestigationLead',
    entityId: leadId,
    detail: {
      investigationId: existing[0].investigationId,
      status: parsed.data.status,
    },
  });
  return NextResponse.json({ ok: true });
}
