import Link from 'next/link';
import { and, desc, eq, sql } from 'drizzle-orm';

import { fmtDate } from '@korr/shared/format';

import { getDb, schema } from '@/lib/db';

import { NewsFilters } from './news-filters';

export const revalidate = 120;

export default async function HirekPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const db = getDb();

  const filters = [] as ReturnType<typeof eq>[];
  if (sp.tag) filters.push(eq(schema.newsArticles.tag, sp.tag));
  if (sp.featured === '1') filters.push(eq(schema.newsArticles.featured, true));
  if (sp.outlet) filters.push(eq(schema.sources.slug, sp.outlet));

  const where =
    filters.length === 0
      ? undefined
      : filters.length === 1
        ? filters[0]
        : and(...filters);

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
    .limit(40);

  // Distinct tags + outlet list for the filter dropdowns. Both are reads of
  // small tables so the s-maxage=120 cache absorbs them.
  const tagRows = await db
    .selectDistinct({ tag: schema.newsArticles.tag })
    .from(schema.newsArticles)
    .where(sql`${schema.newsArticles.tag} IS NOT NULL`);
  const tags = tagRows.map((r) => r.tag).filter((t): t is string => !!t);

  const outletRows = await db
    .select({ slug: schema.sources.slug, name: schema.sources.name })
    .from(schema.sources)
    .where(eq(schema.sources.enabled, true));

  return (
    <section className="section">
      <div className="section-eyebrow">Hírek</div>
      <h2>Magyar korrupciós hírfolyam.</h2>
      <p className="lede">
        A Telex, 444, HVG, Magyar Hang és Átlátszó kiadványaiból válogatott
        korrupciós cikkek. A scraper minden 30 percben frissít.
      </p>

      <NewsFilters tags={tags} outlets={outletRows} />

      {rows.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 16 }}>
          Nincs találat a megadott szűrőkre.
        </div>
      ) : (
        <div className="news-list" style={{ marginTop: 16 }}>
          {rows.map((a) => (
            <a
              className="news-card"
              key={a.id}
              href={a.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="news-meta">
                <span>{a.sourceName ?? a.sourceSlug}</span>
                <span>{fmtDate(a.publishedAt)}</span>
              </div>
              <strong>{a.headline}</strong>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>{a.excerpt}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {a.tag && <span className="pill">{a.tag}</span>}
                {a.relatedCaseId && (
                  <Link
                    href={`/adatbazis/${a.relatedCaseId}`}
                    style={{ fontSize: 12, color: 'var(--accent)' }}
                  >
                    Kapcsolódó ügy: {a.relatedCaseId}
                  </Link>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
