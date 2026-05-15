import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

const decisionSchema = z.object({
  id: z.string().uuid(),
  approvalState: z.enum(['pending', 'approved', 'rejected']),
  caseId: z.string().trim().min(1).max(64).nullable().optional(),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'csak szerkesztő' }, { status: 403 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = decisionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'érvénytelen mezők' }, { status: 400 });
  }
  const { id, approvalState, caseId } = parsed.data;

  const db = getDb();
  const updated = await db
    .update(schema.kMonitorTagCandidates)
    .set({
      approvalState,
      caseId: approvalState === 'approved' ? caseId ?? null : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.kMonitorTagCandidates.id, id))
    .returning({ slug: schema.kMonitorTagCandidates.slug });

  if (!updated[0]) {
    return NextResponse.json({ error: 'nincs ilyen címke' }, { status: 404 });
  }

  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: `kmonitor.tag.${approvalState}`,
    entityType: 'KMonitorTagCandidate',
    entityId: id,
    detail: { slug: updated[0].slug, caseId: caseId ?? null },
  });

  return NextResponse.json({ ok: true });
}
