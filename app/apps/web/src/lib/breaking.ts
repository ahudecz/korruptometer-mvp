import 'server-only';
import { and, desc, gte, or, eq } from 'drizzle-orm';
import { getDb, schema } from './db';

export type BreakingArticle = {
  id: string;
  headline: string;
  excerpt: string;
  sourceUrl: string;
  publishedAt: Date;
  relatedCaseId: string | null;
  tag: string | null;
};

export async function getActiveBreaking(): Promise<BreakingArticle[]> {
  try {
    const db = getDb();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return await db
      .select({
        id: schema.newsArticles.id,
        headline: schema.newsArticles.headline,
        excerpt: schema.newsArticles.excerpt,
        sourceUrl: schema.newsArticles.sourceUrl,
        publishedAt: schema.newsArticles.publishedAt,
        relatedCaseId: schema.newsArticles.relatedCaseId,
        tag: schema.newsArticles.tag,
      })
      .from(schema.newsArticles)
      .where(
        and(
          or(
            eq(schema.newsArticles.breakingOverride, true),
            eq(schema.newsArticles.isBreakingCandidate, true),
          ),
          gte(schema.newsArticles.publishedAt, sevenDaysAgo),
        ),
      )
      .orderBy(desc(schema.newsArticles.publishedAt))
      .limit(10);
  } catch {
    return [];
  }
}

export function findBreakingForName(name: string, breaking: BreakingArticle[]): BreakingArticle | null {
  const parts = name.toLowerCase().split(' ').filter(p => p.length > 2);
  return breaking.find(b => {
    const text = `${b.headline} ${b.excerpt ?? ''}`.toLowerCase();
    return parts.some(part => text.includes(part));
  }) ?? null;
}
