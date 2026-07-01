import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { inngest } from '@/inngest/client';

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
    .select({ updatedAt: schema.investigations.updatedAt })
    .from(schema.investigations)
    .where(eq(schema.investigations.id, id))
    .limit(1);
  if (!rows[0]) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (rows[0].updatedAt.getTime() !== expected.getTime()) {
    return NextResponse.json(
      { error: 'stale', currentUpdatedAt: rows[0].updatedAt.toISOString() },
      { status: 409 },
    );
  }

  const runId = randomUUID();
  try {
    await inngest.send({
      name: 'investigation.hypothesis.requested',
      data: {
        investigationId: id,
        requestedByEditorId: session.editor.id,
        runId,
      },
    });
  } catch (err) {
    // Inngest concurrency rejection surfaces as a non-200 send response.
    // The 409 loop_in_flight is also enforced by the Inngest concurrency
    // key; if the SDK throws, treat it as in-flight.
    const message = err instanceof Error ? err.message : String(err);
    if (/concurrency|in[_-]flight/i.test(message)) {
      return NextResponse.json({ error: 'loop_in_flight' }, { status: 409 });
    }
    throw err;
  }
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'investigation.hypothesis.requested',
    entityType: 'Investigation',
    entityId: id,
    detail: { runId },
  });
  return NextResponse.json({ runId }, { status: 202 });
}
