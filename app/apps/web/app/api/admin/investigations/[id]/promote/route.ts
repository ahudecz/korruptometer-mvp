import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { inngest } from '@/inngest/client';
import { EVIDENCE_GRADE_ORDER } from '@korr/shared';
import { StaleRowError, withOptimisticUpdate } from '@/lib/investigation/concurrency';
import type { EvidenceGrade } from '@korr/shared';

const bodySchema = z.object({
  tier: z.enum(['journalist', 'prosecutor', 'public']),
});

function passesJournalistGate(
  qty: number,
  qual: EvidenceGrade | null,
): boolean {
  return (
    qty >= 2
    && qual !== null
    && EVIDENCE_GRADE_ORDER.indexOf(qual)
      >= EVIDENCE_GRADE_ORDER.indexOf('investigative_journalism')
  );
}

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
    .select()
    .from(schema.investigations)
    .where(eq(schema.investigations.id, id))
    .limit(1);
  const inv = rows[0];
  if (!inv) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (inv.updatedAt.getTime() !== expected.getTime()) {
    return NextResponse.json(
      { error: 'stale', currentUpdatedAt: inv.updatedAt.toISOString() },
      { status: 409 },
    );
  }
  // FR-029 second-public-promotion attempt.
  if (parsed.data.tier === 'public' && inv.publicCaseId) {
    return NextResponse.json(
      { error: 'already_promoted', publicCaseId: inv.publicCaseId },
      { status: 409 },
    );
  }
  // FR-026 server re-evaluation.
  const qty = Number(inv.quantityScore);
  const qual = inv.qualityScore as EvidenceGrade | null;
  if (!passesJournalistGate(qty, qual)) {
    return NextResponse.json(
      {
        error: 'predicate_failed',
        detail: {
          quantityScore: inv.quantityScore,
          qualityScore: qual,
          required: {
            quantityScore: 2,
            qualityScore: 'investigative_journalism',
          },
        },
      },
      { status: 422 },
    );
  }

  if (parsed.data.tier === 'public') {
    // Asynchronous five-write atomic txn in the Inngest function.
    await inngest.send({
      name: 'investigation.promote.public.requested',
      data: {
        investigationId: id,
        requestedByEditorId: session.editor.id,
        expectedUpdatedAt: expected.toISOString(),
      },
    });
    return NextResponse.json({ accepted: true, tier: 'public' }, { status: 202 });
  }

  // Synchronous journalist / prosecutor: flip the tier + audit log.
  try {
    const newUpdatedAt = await withOptimisticUpdate(
      db,
      schema.investigations,
      id,
      expected,
      { disclosureTier: parsed.data.tier },
    );
    await db.insert(schema.auditLogs).values({
      actorEditorId: session.editor.id,
      action:
        parsed.data.tier === 'journalist'
          ? 'investigation.tier.promoted.journalist'
          : 'investigation.tier.promoted.prosecutor',
      entityType: 'Investigation',
      entityId: id,
      detail: { tier: parsed.data.tier },
    });
    return NextResponse.json({ ok: true, updatedAt: newUpdatedAt.toISOString() });
  } catch (err) {
    if (err instanceof StaleRowError) {
      return NextResponse.json({ error: 'stale' }, { status: 409 });
    }
    throw err;
  }
  void sql;
}
