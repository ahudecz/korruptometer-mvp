import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';

import { fmtDate } from '@korr/shared/format';

import { getDb, schema } from '@/lib/db';

export const revalidate = 120;

export default async function HirekPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const db = getDb();
  const filters = [];
  if (sp.tag) filters.push(eq(schema.newsArticles.tag, sp.tag));
  if (sp.featured === '1') filters.push(eq(schema.newsArticles.featured, true));

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
    .where(filters.length === 0 ? undefined : filters[0])
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(40);

  return (
    <section className="section">
      <div className="section-eyebrow">Hírek</div>
      <h2>Magyar korrupciós hírfolyam.</h2>
      <p className="lede">
        A Telex, 444, HVG, Magyar Hang és Átlátszó kiadványaiból ízléssel
        válogatott korrupciós cikkek. A Phase 3 scraper minden 30 percben
        frissít — most a seed-fixture-ből adódó cikkeket látod.
      </p>

      {rows.length === 0 ? (
        <div className="empty-state">Nincs még híranyag az adatbázisban.</div>
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
