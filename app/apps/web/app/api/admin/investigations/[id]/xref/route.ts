import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { inngest } from '@/inngest/client';

const EXPECTED_SOURCES = [
  'TED',
  'EKR',
  'KE',
  'palyazat',
  'ecegjegyzek',
  'opencorporates',
  'integritas',
  'olaf',
  'ksh',
  'eurostat',
  'kmonitor',
  'atlatszo',
  'webarchive',
] as const;

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
  if (!rows[0]) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (rows[0].updatedAt.getTime() !== expected.getTime()) {
    return NextResponse.json(
      { error: 'stale', currentUpdatedAt: rows[0].updatedAt.toISOString() },
      { status: 409 },
    );
  }
  const runId = randomUUID();
  await inngest.send({
    name: 'investigation.xref.requested',
    data: {
      investigationId: id,
      requestedByEditorId: session.editor.id,
      runId,
    },
  });
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'investigation.xref.requested',
    entityType: 'Investigation',
    entityId: id,
    detail: { runId },
  });
  return NextResponse.json(
    { runId, expectedSources: EXPECTED_SOURCES },
    { status: 202 },
  );
}
