import { and, desc, gte, or, eq } from 'drizzle-orm';
import { isBreaking } from '@korr/scrapers';
import { getDb, schema } from './db';
import { getMonitoredBreakingNames } from './breaking-monitored';

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
    const rows = await db
      .select({
        id: schema.newsArticles.id,
        headline: schema.newsArticles.headline,
        excerpt: schema.newsArticles.excerpt,
        sourceUrl: schema.newsArticles.sourceUrl,
        publishedAt: schema.newsArticles.publishedAt,
        relatedCaseId: schema.newsArticles.relatedCaseId,
        tag: schema.newsArticles.tag,
        breakingOverride: schema.newsArticles.breakingOverride,
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
      .limit(50);

    // breakingOverride = szerkesztői döntés → mindig megjelenik.
    // isBreakingCandidate = automatikus jelölés → újraellenőrizzük a jelenlegi
    // logikával, hogy kiszűrjük a régi, hibás DB-bejegyzéseket (pl. Newscast
    // körkép, ahol az excerpt más hírekből véletlenül tartalmaz trigger-szót
    // + figyelt nevet, de a CÍMBEN nem szerepel a figyelt entitás).
    const monitoredNames = getMonitoredBreakingNames();
    return rows
      .filter(r => r.breakingOverride === true || isBreaking(r.headline, r.excerpt ?? '', monitoredNames))
      .map(({ breakingOverride: _, ...rest }) => rest);
  } catch {
    return [];
  }
}

export function findBreakingForName(name: string, breaking: BreakingArticle[]): BreakingArticle | null {
  const parts = name.toLowerCase().split(' ').filter(p => p.length > 2);
  return breaking.find(b => {
    const text = `${b.headline} ${b.excerpt ?? ''}`.toLowerCase();
    return parts.every(part => text.includes(part));
  }) ?? null;
}
