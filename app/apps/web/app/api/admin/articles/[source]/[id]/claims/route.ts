import { NextResponse } from 'next/server';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { getExtractorVersion } from '@/lib/investigation/extractor-version';
import type {
  ArticleClaimDto,
  ArticleClaimsBundle,
  ArticleSource,
  ExtractionRunDto,
  Party,
} from '@korr/shared';

function unauthorized() {
  return NextResponse.json(
    { error: 'unauthorized' },
    { status: 401 },
  );
}

function notFound() {
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ source: string; id: string }> },
) {
  try {
    await requireEditor();
  } catch {
    return unauthorized();
  }
  const { source, id } = await params;
  if (source !== 'news' && source !== 'kmonitor') return notFound();
  const articleSource = source as ArticleSource;
  const db = getDb();

  // Article header.
  let articleHeader: ArticleClaimsBundle['article'] | null = null;
  if (articleSource === 'news') {
    const rows = await db
      .select({
        id: schema.newsArticles.id,
        headline: schema.newsArticles.headline,
        sourceUrl: schema.newsArticles.sourceUrl,
      })
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.id, id))
      .limit(1);
    if (rows[0]) {
      articleHeader = {
        source: 'news',
        id: rows[0].id,
        headline: rows[0].headline,
        sourceUrl: rows[0].sourceUrl,
      };
    }
  } else {
    const newsId = Number.parseInt(id, 10);
    if (Number.isFinite(newsId)) {
      const rows = await db
        .select({
          newsId: schema.kMonitorArticles.newsId,
          title: schema.kMonitorArticles.title,
          sourceUrl: schema.kMonitorArticles.sourceUrl,
        })
        .from(schema.kMonitorArticles)
        .where(eq(schema.kMonitorArticles.newsId, newsId))
        .limit(1);
      if (rows[0]) {
        articleHeader = {
          source: 'kmonitor',
          id: String(rows[0].newsId),
          headline: rows[0].title,
          sourceUrl: rows[0].sourceUrl,
        };
      }
    }
  }
  if (!articleHeader) return notFound();

  const runs = await db
    .select()
    .from(schema.articleExtractionRuns)
    .where(
      and(
        eq(schema.articleExtractionRuns.articleSource, articleSource),
        eq(schema.articleExtractionRuns.articleId, id),
      ),
    )
    .orderBy(desc(schema.articleExtractionRuns.extractedAt));

  // Latest extractor-version observed system-wide (FR-003).
  const latestVersionRow = await db
    .select({
      v: schema.articleExtractionRuns.extractorVersion,
      at: schema.articleExtractionRuns.extractedAt,
    })
    .from(schema.articleExtractionRuns)
    .orderBy(desc(schema.articleExtractionRuns.extractedAt))
    .limit(1);
  const currentVersion =
    latestVersionRow[0]?.v ?? getExtractorVersion();

  const versionsOnThisArticle = Array.from(
    new Set(runs.map((r) => r.extractorVersion)),
  );
  let claimsByVersion = new Map<string, ArticleClaimDto[]>();
  if (versionsOnThisArticle.length > 0) {
    const claimRows = await db
      .select()
      .from(schema.articleClaims)
      .where(
        and(
          eq(schema.articleClaims.articleSource, articleSource),
          eq(schema.articleClaims.articleId, id),
          inArray(
            schema.articleClaims.extractorVersion,
            versionsOnThisArticle,
          ),
        ),
      )
      .orderBy(asc(schema.articleClaims.claimOrdinal));
    claimsByVersion = new Map(versionsOnThisArticle.map((v) => [v, [] as ArticleClaimDto[]]));
    for (const c of claimRows) {
      const list = claimsByVersion.get(c.extractorVersion) ?? [];
      list.push({
        id: c.id,
        articleSource: c.articleSource as ArticleSource,
        articleId: c.articleId,
        claimOrdinal: c.claimOrdinal,
        extractorVersion: c.extractorVersion,
        mechanism: c.mechanism as ArticleClaimDto['mechanism'],
        allegedAmountHuf:
          c.allegedAmountHuf == null ? null : c.allegedAmountHuf.toString(),
        amountBasis: (c.amountBasis ?? null) as ArticleClaimDto['amountBasis'],
        parties: (c.parties as Party[]) ?? [],
        evidenceQuote: c.evidenceQuote,
        sourceUrl: c.sourceUrl,
        paragraphLocator: c.paragraphLocator,
        confidence: c.confidence,
        createdAt: c.createdAt.toISOString(),
      });
      claimsByVersion.set(c.extractorVersion, list);
    }
  }

  const extractionRuns: ExtractionRunDto[] = runs.map((r) => ({
    extractorVersion: r.extractorVersion,
    isCurrent: r.extractorVersion === currentVersion,
    extractedAt: r.extractedAt.toISOString(),
    claimCount: r.claimCount,
    model: r.model,
    claims: claimsByVersion.get(r.extractorVersion) ?? [],
  }));

  const body: ArticleClaimsBundle = {
    article: articleHeader,
    extractionRuns,
  };
  return NextResponse.json(body);
}
