import 'server-only';
import { notFound } from 'next/navigation';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { getExtractorVersion } from '@/lib/investigation/extractor-version';
import type {
  ArticleClaimDto,
  ExtractionRunDto,
  Party,
} from '@korr/shared';
import { ClaimsPanel } from './claims-panel';

export const dynamic = 'force-dynamic';

export default async function ArticleAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireEditor();
  const { id } = await params;
  const db = getDb();

  const article = await db
    .select({
      id: schema.newsArticles.id,
      headline: schema.newsArticles.headline,
      excerpt: schema.newsArticles.excerpt,
      sourceUrl: schema.newsArticles.sourceUrl,
      publishedAt: schema.newsArticles.publishedAt,
    })
    .from(schema.newsArticles)
    .where(eq(schema.newsArticles.id, id))
    .limit(1);
  if (!article[0]) notFound();
  const a = article[0];

  const runs = await db
    .select()
    .from(schema.articleExtractionRuns)
    .where(
      and(
        eq(schema.articleExtractionRuns.articleSource, 'news'),
        eq(schema.articleExtractionRuns.articleId, id),
      ),
    )
    .orderBy(desc(schema.articleExtractionRuns.extractedAt));

  const latest = await db
    .select({ v: schema.articleExtractionRuns.extractorVersion })
    .from(schema.articleExtractionRuns)
    .orderBy(desc(schema.articleExtractionRuns.extractedAt))
    .limit(1);
  const currentVersion = latest[0]?.v ?? getExtractorVersion();

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
          eq(schema.articleClaims.articleSource, 'news'),
          eq(schema.articleClaims.articleId, id),
          inArray(
            schema.articleClaims.extractorVersion,
            versionsOnThisArticle,
          ),
        ),
      )
      .orderBy(asc(schema.articleClaims.claimOrdinal));
    claimsByVersion = new Map(
      versionsOnThisArticle.map((v) => [v, [] as ArticleClaimDto[]]),
    );
    for (const c of claimRows) {
      const list = claimsByVersion.get(c.extractorVersion) ?? [];
      list.push({
        id: c.id,
        articleSource: 'news',
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

  return (
    <main className="admin-article">
      <header className="admin-article-head">
        <h1>{a.headline}</h1>
        <p>
          <a href={a.sourceUrl} target="_blank" rel="noreferrer noopener">
            {a.sourceUrl}
          </a>
        </p>
        <p className="admin-article-meta">
          Megjelent: {a.publishedAt ? new Date(a.publishedAt).toLocaleString('hu-HU') : '—'}
        </p>
      </header>
      <section className="admin-article-excerpt">
        <h2>Részlet</h2>
        <p>{a.excerpt}</p>
      </section>
      <ClaimsPanel runs={extractionRuns} />
    </main>
  );
}
