import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

const SOURCE_SYSTEMS = [
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
  'manual_opten',
  'manual_other',
] as const;

const bodySchema = z.object({
  sourceSystem: z.enum(SOURCE_SYSTEMS),
  externalId: z.string().min(1),
  canonicalUrl: z.string().url(),
  recordType: z.string().min(1),
  rawPayload: z.unknown(),
  relevance: z
    .enum(['corroborates', 'contradicts', 'context', 'benchmark'])
    .nullable()
    .optional(),
  evidenceGrade: z
    .enum([
      'rumor',
      'opinion_press',
      'opposition_politician',
      'investigative_journalism',
      'prosecutor_statement',
      'audit_report',
      'court_document',
    ])
    .nullable()
    .optional(),
  linkedLeadId: z.string().uuid().nullable().optional(),
});

function canonicalize(payload: unknown): string {
  const sort = (v: unknown): unknown => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const keys = Object.keys(v as Record<string, unknown>).sort();
      const out: Record<string, unknown> = {};
      for (const k of keys) out[k] = sort((v as Record<string, unknown>)[k]);
      return out;
    }
    if (Array.isArray(v)) return v.map(sort);
    return v;
  };
  return JSON.stringify(sort(payload));
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

  const hash = createHash('sha256').update(canonicalize(parsed.data.rawPayload)).digest('hex');
  const inserted = await db
    .insert(schema.externalRecords)
    .values({
      investigationId: id,
      sourceSystem: parsed.data.sourceSystem,
      externalId: parsed.data.externalId,
      canonicalUrl: parsed.data.canonicalUrl,
      fetchedAt: new Date(),
      fetchHash: hash,
      recordType: parsed.data.recordType,
      rawPayload: parsed.data.rawPayload as Record<string, unknown>,
      relevance: parsed.data.relevance ?? null,
      evidenceGrade: parsed.data.evidenceGrade ?? null,
    })
    .returning({ id: schema.externalRecords.id });

  if (parsed.data.sourceSystem.startsWith('manual_')) {
    await db.insert(schema.auditLogs).values({
      actorEditorId: session.editor.id,
      action: 'investigation.escalation.writeback',
      entityType: 'Investigation',
      entityId: id,
      detail: {
        externalRecordId: inserted[0]?.id ?? null,
        sourceSystem: parsed.data.sourceSystem,
        linkedLeadId: parsed.data.linkedLeadId ?? null,
      },
    });
  }
  return NextResponse.json({ id: inserted[0]?.id }, { status: 201 });
}
