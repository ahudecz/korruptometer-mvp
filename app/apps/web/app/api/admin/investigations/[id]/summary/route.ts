import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { StaleRowError, withOptimisticUpdate } from '@/lib/investigation/concurrency';

const bodySchema = z.object({ summary: z.string() });

export async function PATCH(
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
  const before = await db
    .select({ summary: schema.investigations.summary })
    .from(schema.investigations)
    .where(eq(schema.investigations.id, id))
    .limit(1);
  try {
    const newUpdatedAt = await withOptimisticUpdate(
      db,
      schema.investigations,
      id,
      expectedUpdatedAt,
      { summary: parsed.data.summary },
    );
    await db.insert(schema.auditLogs).values({
      actorEditorId: session.editor.id,
      action: 'investigation.summary.updated',
      entityType: 'Investigation',
      entityId: id,
      detail: {
        before: { summary: before[0]?.summary ?? null },
        after: { summary: parsed.data.summary },
      },
    });
    return NextResponse.json({ ok: true, updatedAt: newUpdatedAt.toISOString() });
  } catch (err) {
    if (err instanceof StaleRowError) {
      return NextResponse.json({ error: 'stale' }, { status: 409 });
    }
    throw err;
  }
}
