import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { inngest } from '@/inngest/client';

const createSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(1),
  position: z.string().min(1),
  amount: z.string().regex(/^\d+$/),
  sentenceYears: z.number().int().nonnegative(),
  caseYear: z.number().int().min(1990).max(2100),
  status: z.enum(['Lezárva', 'Vádemelés', 'Folyamatban']),
  region: z.string().min(1),
  sector: z.enum([
    'Közbeszerzés',
    'Önkormányzat',
    'Állami vállalat',
    'EU pályázat',
    'Egészségügy',
    'Egyéb',
  ]),
  summary: z.string().nullable().optional(),
});

const patchSchema = createSchema.partial().extend({ id: z.string().min(2) });

async function enqueueRecompute(reason: string) {
  await inngest.send({ name: 'kpi.recompute', data: { reason } });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid case' }, { status: 400 });
  }
  const db = getDb();
  await db.insert(schema.cases).values({
    ...parsed.data,
    amount: BigInt(parsed.data.amount),
    summary: parsed.data.summary ?? null,
  });
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'case.create',
    entityType: 'Case',
    entityId: parsed.data.id,
  });
  await enqueueRecompute('case.create');
  return NextResponse.json({ ok: true, id: parsed.data.id });
}

export async function PATCH(req: Request) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid patch' }, { status: 400 });
  }
  const { id, amount, summary, ...rest } = parsed.data;
  const db = getDb();
  const patch: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (amount != null) patch.amount = BigInt(amount);
  if (summary !== undefined) patch.summary = summary;
  await db.update(schema.cases).set(patch).where(eq(schema.cases.id, id));
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'case.patch',
    entityType: 'Case',
    entityId: id,
  });
  await enqueueRecompute('case.patch');
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const db = getDb();
  await db.delete(schema.cases).where(eq(schema.cases.id, id));
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'case.delete',
    entityType: 'Case',
    entityId: id,
  });
  await enqueueRecompute('case.delete');
  return NextResponse.json({ ok: true });
}
