import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { StaleRowError, withOptimisticUpdate } from '@/lib/investigation/concurrency';

const bodySchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('dismissed') }),
  z.object({
    status: z.literal('merged'),
    mergedIntoId: z.string().uuid(),
  }),
]);

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
  const expectedUpdatedAt = new Date(ifMatch);
  if (Number.isNaN(expectedUpdatedAt.getTime())) {
    return NextResponse.json({ error: 'invalid_if_match' }, { status: 400 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const db = getDb();
  if (parsed.data.status === 'merged') {
    if (parsed.data.mergedIntoId === id) {
      return NextResponse.json({ error: 'invalid_transition' }, { status: 422 });
    }
    const survivor = await db
      .select({ id: schema.investigations.id })
      .from(schema.investigations)
      .where(eq(schema.investigations.id, parsed.data.mergedIntoId))
      .limit(1);
    if (!survivor[0]) {
      return NextResponse.json({ error: 'invalid_transition' }, { status: 422 });
    }
  }

  try {
    const newUpdatedAt = await withOptimisticUpdate(
      db,
      schema.investigations,
      id,
      expectedUpdatedAt,
      parsed.data.status === 'merged'
        ? { status: 'merged', mergedIntoId: parsed.data.mergedIntoId }
        : { status: 'dismissed' },
    );
    await db.insert(schema.auditLogs).values({
      actorEditorId: session.editor.id,
      action: parsed.data.status === 'merged' ? 'investigation.merged' : 'investigation.status.changed',
      entityType: 'Investigation',
      entityId: id,
      detail:
        parsed.data.status === 'merged'
          ? { mergedIntoId: parsed.data.mergedIntoId }
          : { status: 'dismissed' },
    });
    return NextResponse.json({ ok: true, updatedAt: newUpdatedAt.toISOString() });
  } catch (err) {
    if (err instanceof StaleRowError) {
      const current = await db
        .select({ updatedAt: schema.investigations.updatedAt })
        .from(schema.investigations)
        .where(eq(schema.investigations.id, id))
        .limit(1);
      return NextResponse.json(
        {
          error: 'stale',
          currentUpdatedAt: current[0]?.updatedAt.toISOString() ?? null,
        },
        { status: 409 },
      );
    }
    throw err;
  }
}
