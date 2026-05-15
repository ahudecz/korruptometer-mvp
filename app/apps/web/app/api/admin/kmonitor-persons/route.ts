import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

const decisionSchema = z.object({
  id: z.string().uuid(),
  approvalState: z.enum(['pending', 'approved', 'rejected']),
  caseId: z.string().trim().min(1).max(64).nullable().optional(),
  /** When approving + linking, overwrite Case.amount even if already non-zero. */
  forceAmountOverwrite: z.boolean().optional(),
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
  const { id, approvalState, caseId, forceAmountOverwrite } = parsed.data;

  const db = getDb();

  // Validate the caseId exists before linking (avoid stale FK on undo).
  if (approvalState === 'approved' && caseId) {
    const existing = await db
      .select({ id: schema.cases.id, amount: schema.cases.amount })
      .from(schema.cases)
      .where(eq(schema.cases.id, caseId))
      .limit(1);
    if (!existing[0]) {
      return NextResponse.json(
        { error: `nincs ilyen ügy: ${caseId}` },
        { status: 400 },
      );
    }
  }

  const now = new Date();
  const isDecided = approvalState === 'approved' || approvalState === 'rejected';
  const updated = await db
    .update(schema.kMonitorPersonCandidates)
    .set({
      approvalState,
      caseId: approvalState === 'approved' ? caseId ?? null : null,
      decidedAt: isDecided ? now : null,
      decidedBy: isDecided ? session.editor.id : null,
      updatedAt: now,
    })
    .where(eq(schema.kMonitorPersonCandidates.id, id))
    .returning({
      displayName: schema.kMonitorPersonCandidates.displayName,
      medianAmountHuf: schema.kMonitorPersonCandidates.medianAmountHuf,
      llmAmountHuf: schema.kMonitorPersonCandidates.llmAmountHuf,
    });

  if (!updated[0]) {
    return NextResponse.json({ error: 'nincs ilyen személy' }, { status: 404 });
  }

  // Slice 9: auto-populate Case.amount when the linked case has none yet
  // (or when the editor opted into force-overwrite). Prefers the
  // LLM-refined figure (Slice 10) over the regex median when available.
  let caseAmountUpdated: { caseId: string; previous: string; next: string; source: 'llm' | 'regex' } | null = null;
  const preferredAmount: bigint | null =
    (updated[0].llmAmountHuf as bigint | null) ?? (updated[0].medianAmountHuf as bigint | null);
  const amountSource: 'llm' | 'regex' = updated[0].llmAmountHuf != null ? 'llm' : 'regex';
  if (
    approvalState === 'approved' &&
    caseId &&
    preferredAmount != null
  ) {
    const current = await db
      .select({ id: schema.cases.id, amount: schema.cases.amount })
      .from(schema.cases)
      .where(eq(schema.cases.id, caseId))
      .limit(1);
    const existingAmount = current[0]?.amount ?? 0n;
    const shouldWrite =
      forceAmountOverwrite === true || existingAmount === 0n || existingAmount === null;
    if (shouldWrite && existingAmount !== preferredAmount) {
      await db
        .update(schema.cases)
        .set({ amount: preferredAmount, updatedAt: new Date() })
        .where(eq(schema.cases.id, caseId));
      caseAmountUpdated = {
        caseId,
        previous: existingAmount.toString(),
        next: preferredAmount.toString(),
        source: amountSource,
      };
    }
  }

  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: `kmonitor.person.${approvalState}`,
    entityType: 'KMonitorPersonCandidate',
    entityId: id,
    detail: {
      displayName: updated[0].displayName,
      caseId: caseId ?? null,
      caseAmountUpdated,
    },
  });

  return NextResponse.json({ ok: true, caseAmountUpdated });
}
