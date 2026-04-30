import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { getDb, schema } from '@/lib/db';

const querySchema = z.object({
  featured: z.coerce.boolean().optional(),
  tag: z.string().trim().max(80).optional(),
  caseId: z.string().trim().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const revalidate = 120;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'érvénytelen lekérdezés' }, { status: 400 });
  }
  const { featured, tag, caseId, limit } = parsed.data;
  const db = getDb();
  const conditions = [];
  if (featured) conditions.push(eq(schema.newsArticles.featured, true));
  if (tag) conditions.push(eq(schema.newsArticles.tag, tag));
  if (caseId) conditions.push(eq(schema.newsArticles.relatedCaseId, caseId));

  const where = conditions.length ? sql.join(conditions, sql` AND `) : undefined;

  const rows = await db
    .select({
      id: schema.newsArticles.id,
      headline: schema.newsArticles.headline,
      excerpt: schema.newsArticles.excerpt,
      sourceUrl: schema.newsArticles.sourceUrl,
      publishedAt: schema.newsArticles.publishedAt,
      tag: schema.newsArticles.tag,
      featured: schema.newsArticles.featured,
      relatedCaseId: schema.newsArticles.relatedCaseId,
      sourceSlug: schema.sources.slug,
      sourceName: schema.sources.name,
    })
    .from(schema.newsArticles)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
    .where(where)
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(limit);

  return NextResponse.json(
    { items: rows },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
      },
    },
  );
}
