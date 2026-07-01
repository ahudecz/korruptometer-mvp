import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { inngest } from '@/inngest/client';
import type { RedFlagDto } from '@korr/shared';

export async function POST(
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
  const row = await db
    .select({ id: schema.investigations.id })
    .from(schema.investigations)
    .where(eq(schema.investigations.id, id))
    .limit(1);
  if (!row[0]) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await inngest.send({
    name: 'investigation.redflags.requested',
    data: { investigationId: id },
  });

  // The route returns the (possibly previous-run) RedFlagCheck rows
  // immediately. The Inngest function upserts new rows in the
  // background; the next page load surfaces the fresh verdicts.
  const rows = await db
    .select()
    .from(schema.redFlagChecks)
    .where(eq(schema.redFlagChecks.investigationId, id))
    .orderBy(desc(schema.redFlagChecks.evaluatedAt));
  const results: RedFlagDto[] = rows.map((r) => ({
    ruleId: r.ruleId,
    severity: r.severity as RedFlagDto['severity'],
    verdict: r.verdict as RedFlagDto['verdict'],
    observationHu: r.observationHu,
    supportingRecordIds: r.supportingRecordIds ?? [],
    evaluatedAt: r.evaluatedAt.toISOString(),
  }));
  return NextResponse.json({ results });
}
