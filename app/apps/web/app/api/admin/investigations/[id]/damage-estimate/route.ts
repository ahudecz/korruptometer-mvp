import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import type { DamageComponentDto, DamageEstimateDto } from '@korr/shared';

/**
 * GET /api/admin/investigations/:id/damage-estimate
 *
 * Returns the most recent `DamageEstimate` row for the investigation. The
 * underlying recompute is event-driven (`investigation.damage-recompute`,
 * T111) — this endpoint is read-only and exempt from the `If-Match`
 * concurrency rule (per Addendum notes in tasks.md).
 *
 * Response carries `Last-Modified: <computedAt>` so the UI can cache the
 * panel between renders. 404 when no estimate has been computed yet.
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

  const rows = await db
    .select()
    .from(schema.damageEstimates)
    .where(eq(schema.damageEstimates.investigationId, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const dto: DamageEstimateDto = {
    investigationId: row.investigationId,
    totalLowHuf: row.totalLowHuf.toString(),
    totalHighHuf: row.totalHighHuf.toString(),
    confidence: row.confidence,
    components: (row.components as DamageComponentDto[]) ?? [],
    inputsHash: row.inputsHash,
    computedAt: row.computedAt.toISOString(),
  };

  return new NextResponse(JSON.stringify(dto), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'last-modified': row.computedAt.toUTCString(),
      'cache-control': 'private, no-cache',
    },
  });
}
