import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const db = getDb();

  const [current] = await db
    .select({ hidden: schema.socialPosts.hidden })
    .from(schema.socialPosts)
    .where(eq(schema.socialPosts.id, id));

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db
    .update(schema.socialPosts)
    .set({ hidden: !current.hidden })
    .where(eq(schema.socialPosts.id, id));

  return NextResponse.json({ hidden: !current.hidden });
}
