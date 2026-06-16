import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const db = getDb();

  const existing = await db.query.politicalResignations.findFirst({
    where: eq(schema.politicalResignations.id, id),
  });
  if (!existing) {
    return NextResponse.json({ error: 'nem található' }, { status: 404 });
  }

  await db
    .delete(schema.politicalResignations)
    .where(eq(schema.politicalResignations.id, id));

  return NextResponse.json({ ok: true });
}
