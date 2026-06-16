import Link from 'next/link';
import { and, desc, eq, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

import { NewsFilters } from './news-filters';

export const revalidate = 120;

function fmtRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'most';
  if (h < 24) return `${h} órája`;
  if (h < 48) return 'tegnap';
  const days = Math.floor(h / 24);
  return `${days} napja`;
}

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

  const tagRows = await db
    .selectDistinct({ tag: schema.newsArticles.tag })
    .from(schema.newsArticles)
    .where(sql`${schema.newsArticles.tag} IS NOT NULL`);
  const tags = tagRows.map((r) => r.tag).filter((t): t is string => !!t);

  const outletRows = await db
    .select({ slug: schema.sources.slug, name: schema.sources.name })
    .from(schema.sources)
    .where(eq(schema.sources.enabled, true));

  const featured = rows.find((a) => a.featured) ?? rows[0];
  const rest = rows.filter((a) => a.id !== featured?.id);

  return (
    <div className="news-section-wrap">
      <section className="section" id="news">
        <div className="section-head">
          <div className="section-num">04 / Hírfolyam</div>
          <h2 className="section-title">Élő riportok az ügyekről.</h2>
        </div>

        <NewsFilters tags={tags} outlets={outletRows} />

        {rows.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 32 }}>
            Nincs találat a megadott szűrőkre.
          </div>
        ) : (
          <div className="news-grid" style={{ marginTop: 32 }}>
            {featured && (
              <a
                href={featured.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="news-card feature"
              >
                <div className="news-meta">
                  <span className="news-tag">★ Kiemelt</span>
                  <span className="news-time">{fmtRelative(featured.publishedAt)}</span>
                </div>
                <h3 className="news-headline">{featured.headline}</h3>
                <p className="news-excerpt">{featured.excerpt}</p>
                <span className="news-source">{featured.sourceName ?? featured.sourceSlug ?? 'Forrás'}</span>
              </a>
            )}
            {rest.map((a) => (
              <div key={a.id} className="news-card">
                <a
                  href={a.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'inherit',
                    textDecoration: 'none',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div className="news-meta">
                    <span className="news-tag">{a.tag ?? 'Hír'}</span>
                    <span className="news-time">{fmtRelative(a.publishedAt)}</span>
                  </div>
                  <h3 className="news-headline">{a.headline}</h3>
                  <p className="news-excerpt">{a.excerpt}</p>
                </a>
                {a.relatedCaseId ? (
                  <Link
                    href={`/adatbazis/${a.relatedCaseId}`}
                    className="news-source"
                    style={{ color: 'var(--accent)' }}
                  >
                    Kapcsolódó ügy: {a.relatedCaseId}
                  </Link>
                ) : (
                  <span className="news-source">{a.sourceName ?? a.sourceSlug ?? 'Forrás'}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
