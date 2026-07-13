import { and, desc, gte, or, eq } from 'drizzle-orm';
import { isBreaking } from '@korr/scrapers';
import { getDb, schema } from './db';
import { getMonitoredNames } from './breaking-monitored';

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
    // isBreakingCandidate = automatikus jelölés → a legtöbb esetben
    // újraellenőrizzük a jelenlegi logikával, hogy kiszűrjük a régi, hibás
    // DB-bejegyzéseket (pl. Newscast körkép, ahol az excerpt más hírekből
    // véletlenül tartalmaz trigger-szót + figyelt nevet, de a CÍMBEN nem
    // szerepel a figyelt entitás). DE az isBreaking() (relevance.ts,
    // BREAKING_TRIGGERS) kifejezetten a 007-es (letartóztatás/vádemelés)
    // detektorra lett hangolva — egy "lemond" szót SOSEM ismer fel
    // trigger-ként. Emiatt egy magas megbízhatósággal jóváhagyott
    // lemondás/megszűnés/ítélet/vagyonvisszaszerzés (a 4 saját LLM-
    // detektorunk, amik CSAK 'approved' vagy manuálisan jóváhagyott
    // near_miss esetén teszik rá a tag-et és az isBreakingCandidate-et —
    // l. detect-*.ts és a notify.ts "Csak hírbe" gombja) sosem jutott át
    // ezen az újraellenőrzésen, pedig önmagában is megbízható forrásból,
    // LLM-jóváhagyással jött (2026-07-13, user report: Gulyás Gergely
    // lemondása nem jelent meg a breaking csíkban). Ezekre a saját
    // tag-jeinkre bízunk, nem futtatjuk újra az arrest-fókuszú ellenőrzést.
    const TRUSTED_DETECTOR_TAGS = new Set(['Lemondás', 'Megszűnés', 'Ítélet', 'Vagyonvisszaszerzés']);
    const monitoredNames = await getMonitoredNames();
    return rows
      .filter(r =>
        r.breakingOverride === true ||
        (r.tag && TRUSTED_DETECTOR_TAGS.has(r.tag)) ||
        isBreaking(r.headline, r.excerpt ?? '', monitoredNames),
      )
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
