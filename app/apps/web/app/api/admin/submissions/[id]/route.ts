import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { inngest } from '@/inngest/client';

const bodySchema = z.object({
  action: z.enum(['in_review', 'approve', 'reject', 'duplicate']),
  duplicateOfCaseId: z.string().min(2).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'érvénytelen művelet' }, { status: 400 });
  }
  const { action, duplicateOfCaseId } = parsed.data;

  const db = getDb();
  const submission = await db.query.submissions.findFirst({
    where: eq(schema.submissions.id, id),
  });
  if (!submission) {
    return NextResponse.json({ error: 'nem található' }, { status: 404 });
  }

  const purgeIn30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  let nextStatus: typeof schema.submissions.$inferSelect.status = submission.status;
  let createdCaseId: string | null = submission.createdCaseId;

  if (action === 'in_review') {
    nextStatus = 'in_review';
  } else if (action === 'approve') {
    nextStatus = 'approved';
    // Create a Case row from the submission so the public DB picks it up.
    const caseId = `KM-${String(Math.floor(Date.now() / 1000)).slice(-6)}`;
    await db.insert(schema.cases).values({
      id: caseId,
      name: submission.suspectName,
      position: submission.suspectPosition ?? '—',
      amount: submission.estimatedAmount ?? 0n,
      sentenceYears: 0,
      caseYear: new Date().getFullYear(),
      status: 'Folyamatban',
      region: submission.suspectRegion ?? 'Budapest',
      sector: 'Egyéb',
      summary: submission.summary,
    });
    await db.insert(schema.rogueProfiles).values({
      caseId,
      variant: 0,
      glasses: false,
      hair: 'short',
      detention: 'investig',
      detentionLabel: 'VIZSGÁLAT ALATT',
      crimes: submission.crimes,
      extraStatus: 'Bejelentés alapján',
    });
    createdCaseId = caseId;
  } else if (action === 'reject') {
    nextStatus = 'rejected';
  } else if (action === 'duplicate') {
    nextStatus = 'duplicate';
    if (duplicateOfCaseId) createdCaseId = duplicateOfCaseId;
  }

  const purgeAt =
    action === 'approve' || action === 'reject' || action === 'duplicate'
      ? purgeIn30
      : submission.purgePiiAt;

  await db
    .update(schema.submissions)
    .set({
      status: nextStatus,
      purgePiiAt: purgeAt,
      createdCaseId,
      updatedAt: new Date(),
    })
    .where(eq(schema.submissions.id, id));

  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: `submission.${action}`,
    entityType: 'Submission',
    entityId: id,
    detail: { fromStatus: submission.status, toStatus: nextStatus, createdCaseId },
  });

  if (action === 'approve' || action === 'reject' || action === 'duplicate') {
    await inngest.send({
      name: 'kpi.recompute',
      data: { reason: `submission.${action}` },
    });
  }

  return NextResponse.json({ ok: true, status: nextStatus, createdCaseId });
}
