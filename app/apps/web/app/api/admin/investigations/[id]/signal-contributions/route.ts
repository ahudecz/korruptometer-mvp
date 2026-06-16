import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import type {
  SignalContributionDto,
  SignalContributionsView,
} from '@korr/shared';

/**
 * GET /api/admin/investigations/:id/signal-contributions
 *
 * Returns `{ quantityScore, rows }` so the client can verify the
 * FR-051 invariant `quantityScore = Σ effectiveWeight ± 0.01` locally.
 * 404 when the investigation does not exist.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const db = getDb();

  const invRow = await db
    .select({ quantityScore: schema.investigations.quantityScore })
    .from(schema.investigations)
    .where(eq(schema.investigations.id, id))
    .limit(1);
  if (!invRow[0]) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const rowsDb = await db
    .select()
    .from(schema.signalContributions)
    .where(eq(schema.signalContributions.investigationId, id));

  const rows: SignalContributionDto[] = rowsDb.map((r) => ({
    id: r.id,
    sourceKind: r.sourceKind as SignalContributionDto['sourceKind'],
    sourceId: r.sourceId,
    baseWeight: r.baseWeight,
    stalenessMultiplier: r.stalenessMultiplier,
    effectiveWeight: r.effectiveWeight ?? '0',
    addedAt: r.addedAt.toISOString(),
  }));

  const body: SignalContributionsView = {
    quantityScore: invRow[0].quantityScore.toString(),
    rows,
  };
  return NextResponse.json(body);
}
