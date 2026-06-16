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
    .select({ featured: schema.newsArticles.featured })
    .from(schema.newsArticles)
    .where(eq(schema.newsArticles.id, id));

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db
    .update(schema.newsArticles)
    .set({ featured: !current.featured })
    .where(eq(schema.newsArticles.id, id));

  return NextResponse.json({ featured: !current.featured });
}
