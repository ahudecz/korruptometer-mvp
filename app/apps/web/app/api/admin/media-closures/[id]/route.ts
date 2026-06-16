import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  await requireAdmin();
  const db = getDb();
  await db
    .delete(schema.mediaClosures)
    .where(eq(schema.mediaClosures.id, params.id));
  return NextResponse.json({ ok: true });
}
