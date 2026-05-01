import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const db = getDb();
  const { cases, rogueProfiles, newsArticles, sources } = schema;

  const caseRow = await db.query.cases.findFirst({
    where: eq(cases.id, id),
  });
  if (!caseRow) {
    return NextResponse.json({ error: 'Az ügy nem található.' }, { status: 404 });
  }

  const profile = await db.query.rogueProfiles.findFirst({
    where: eq(rogueProfiles.caseId, id),
  });

  const articles = await db
    .select({
      id: newsArticles.id,
      headline: newsArticles.headline,
      excerpt: newsArticles.excerpt,
      sourceUrl: newsArticles.sourceUrl,
      publishedAt: newsArticles.publishedAt,
      tag: newsArticles.tag,
      featured: newsArticles.featured,
      sourceSlug: sources.slug,
      sourceName: sources.name,
    })
    .from(newsArticles)
    .leftJoin(sources, eq(newsArticles.sourceId, sources.id))
    .where(eq(newsArticles.relatedCaseId, id))
    .orderBy(newsArticles.publishedAt);

  return NextResponse.json(
    {
      case: { ...caseRow, amount: caseRow.amount.toString() },
      rogue: profile ?? null,
      articles,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}
