import { NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { StaleRowError, withOptimisticUpdate } from '@/lib/investigation/concurrency';

/**
 * POST /api/admin/investigations/:id/depromote (T090, FR-030).
 *
 * Public-tier depromotion only. Soft-deletes the linked Case row,
 * keeps publicCaseId on the investigation (audit), sets
 * disclosureTier='internal', and stamps the matching
 * InvestigationPublicCaseLink with depromotedAt.
 *
 * Note: the existing `Case` schema does not carry a soft-delete column,
 * so the "soft delete" is implemented by writing an audit row only and
 * leaving the Case row in place. A future migration that adds
 * `Case.deletedAt` will let this route flip that column too — keeping
 * the function additive for now (constitution Principle VII).
 */
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

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.investigations)
    .where(eq(schema.investigations.id, id))
    .limit(1);
  const inv = rows[0];
  if (!inv) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (inv.disclosureTier !== 'public') {
    return NextResponse.json({ error: 'invalid_transition' }, { status: 422 });
  }
  if (inv.updatedAt.getTime() !== expected.getTime()) {
    return NextResponse.json(
      { error: 'stale', currentUpdatedAt: inv.updatedAt.toISOString() },
      { status: 409 },
    );
  }

  try {
    const newUpdatedAt = await withOptimisticUpdate(
      db,
      schema.investigations,
      id,
      expected,
      { disclosureTier: 'internal' },
    );
    if (inv.publicCaseId) {
      await db
        .update(schema.investigationPublicCaseLinks)
        .set({ depromotedAt: new Date() })
        .where(
          and(
            eq(schema.investigationPublicCaseLinks.investigationId, id),
            eq(schema.investigationPublicCaseLinks.publicCaseId, inv.publicCaseId),
            isNull(schema.investigationPublicCaseLinks.depromotedAt),
          ),
        );
    }
    await db.insert(schema.auditLogs).values({
      actorEditorId: session.editor.id,
      action: 'investigation.tier.depromoted.public',
      entityType: 'Investigation',
      entityId: id,
      detail: { publicCaseId: inv.publicCaseId ?? null },
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
