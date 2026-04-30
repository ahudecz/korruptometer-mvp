import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

const inviteSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(1).max(120).nullable().optional(),
  role: z.enum(['editor', 'admin']).default('editor'),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'csak admin' }, { status: 403 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = inviteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'érvénytelen mezők' }, { status: 400 });
  }
  const { email, displayName, role } = parsed.data;

  const db = getDb();
  await db
    .insert(schema.editors)
    .values({
      email,
      displayName: displayName ?? null,
      role,
      active: true,
    })
    .onConflictDoUpdate({
      target: schema.editors.email,
      set: { displayName: displayName ?? null, role, active: true },
    });

  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'editor.upsert',
    entityType: 'Editor',
    entityId: email,
    detail: { role, displayName },
  });

  return NextResponse.json({ ok: true });
}
