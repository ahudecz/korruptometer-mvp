import { desc, eq } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

import { FeaturedToggle } from './featured-toggle';

export const revalidate = 0;

export default async function AdminNewsPage() {
  await requireAdmin();
  const db = getDb();

  const articles = await db
    .select({
      id: schema.newsArticles.id,
      headline: schema.newsArticles.headline,
      sourceUrl: schema.newsArticles.sourceUrl,
      publishedAt: schema.newsArticles.publishedAt,
      featured: schema.newsArticles.featured,
      sourceName: schema.sources.name,
    })
    .from(schema.newsArticles)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
    .orderBy(desc(schema.newsArticles.featured), desc(schema.newsArticles.publishedAt))
    .limit(100);

  const featuredCount = articles.filter((a) => a.featured).length;

  return (
    <section className="section">
      <h2 style={{ marginBottom: 4 }}>Hírek kezelése</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
        Legutóbbi 100 cikk · <strong>{featuredCount}</strong> kiemelt
      </p>

      <table className="admin-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Cím</th>
            <th>Forrás</th>
            <th>Dátum</th>
            <th>Kiemelt</th>
          </tr>
        </thead>
        <tbody>
          {articles.map((a) => (
            <tr key={a.id} style={{ background: a.featured ? '#fff8f8' : undefined }}>
              <td>
                <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--ink)', fontSize: 13 }}>
                  {a.headline}
                </a>
              </td>
              <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {a.sourceName ?? '—'}
              </td>
              <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {a.publishedAt.toLocaleDateString('hu-HU')}
              </td>
              <td>
                <FeaturedToggle id={a.id} featured={a.featured} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
