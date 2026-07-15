import { NextResponse } from 'next/server';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { getDb, schema } from '@/lib/db';

const querySchema = z.object({
  featured: z.coerce.boolean().optional(),
  tag: z.string().trim().max(80).optional(),
  outlet: z.string().trim().max(40).optional(),
  caseId: z.string().trim().max(20).optional(),
  q: z.string().trim().max(120).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(60).default(60),
});

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'érvénytelen lekérdezés' }, { status: 400 });
  }
  const { featured, tag, outlet, caseId, q, offset, limit } = parsed.data;
  const db = getDb();

  const conditions = [];
  if (featured) conditions.push(eq(schema.newsArticles.featured, true));
  if (tag) conditions.push(eq(schema.newsArticles.tag, tag));
  if (caseId) conditions.push(eq(schema.newsArticles.relatedCaseId, caseId));
  if (outlet) conditions.push(eq(schema.sources.slug, outlet));
  if (q) {
    const needle = `%${q}%`;
    conditions.push(
      or(
        sql`unaccent(${schema.newsArticles.headline}) ILIKE unaccent(${needle})`,
        sql`unaccent(${schema.newsArticles.excerpt}) ILIKE unaccent(${needle})`,
      ),
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: schema.newsArticles.id,
      headline: schema.newsArticles.headline,
      excerpt: schema.newsArticles.excerpt,
      sourceUrl: schema.newsArticles.sourceUrl,
      publishedAt: schema.newsArticles.publishedAt,
      tag: schema.newsArticles.tag,
      imageUrl: schema.newsArticles.imageUrl,
      featured: schema.newsArticles.featured,
      relatedCaseId: schema.newsArticles.relatedCaseId,
      isBreakingCandidate: schema.newsArticles.isBreakingCandidate,
      breakingOverride: schema.newsArticles.breakingOverride,
      sourceSlug: schema.sources.slug,
      sourceName: schema.sources.name,
    })
    .from(schema.newsArticles)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
    .where(where)
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(limit)
    .offset(offset);

  const items = rows.map((r) => {
    const breakingOverride = r.breakingOverride === true;
    const isBreaking = (r.breakingOverride ?? r.isBreakingCandidate) === true;
    return { ...r, isBreaking, breakingOverride, featured: isBreaking ? true : r.featured };
  });

  return NextResponse.json(
    { items, hasMore: rows.length === limit },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
      },
    },
  );
}
