import { and, desc, eq, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

import { NewsFilters } from './news-filters';
import { NewsGrid } from './news-grid';

export const revalidate = 120;

function headlineKey(headline: string): string {
  const words = headline
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 4);
  return words.sort().slice(0, 7).join(' ');
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

  // Initial SSR batch — fetch 120, dedup to 40
  const rawRows = await db
    .select({
      id: schema.newsArticles.id,
      headline: schema.newsArticles.headline,
      excerpt: schema.newsArticles.excerpt,
      sourceUrl: schema.newsArticles.sourceUrl,
      publishedAt: schema.newsArticles.publishedAt,
      tag: schema.newsArticles.tag,
      imageUrl: schema.newsArticles.imageUrl,
      featured: schema.newsArticles.featured,
      relatedCaseId: schema.newsArticles.relatedCaseId,
      sourceSlug: schema.sources.slug,
      sourceName: schema.sources.name,
    })
    .from(schema.newsArticles)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
    .where(where)
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(120);

  const seen = new Set<string>();
  const initialArticles = rawRows
    .filter((a) => {
      const key = headlineKey(a.headline);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40)
    .map((a) => ({ ...a, publishedAt: a.publishedAt.toISOString() }));

  // Ha pontosan 120 sort kaptunk vissza, valószínűleg van még több
  const initialHasMore = rawRows.length >= 120;

  const tagRows = await db
    .select({ tag: schema.newsArticles.tag, count: sql<number>`count(*)::int` })
    .from(schema.newsArticles)
    .where(sql`${schema.newsArticles.tag} IS NOT NULL`)
    .groupBy(schema.newsArticles.tag)
    .orderBy(sql`count(*) desc`)
    .limit(30);
  const EXCLUDED_TAGS = new Set([
    'john healey', 'direkt36', 'magyar hang plusz', 'podcast',
    'hvg360', 'híradó', 'házon kívül', 'gyorshír',
    'vadhajtások', 'kriptovaluta', 'foci vb 2026',
  ]);
  const tags = tagRows
    .map((r) => r.tag)
    .filter((t): t is string => !!t && !EXCLUDED_TAGS.has(t.toLowerCase()));

  const outletRows = await db
    .select({ slug: schema.sources.slug, name: schema.sources.name })
    .from(schema.sources)
    .where(eq(schema.sources.enabled, true));

  const activeFilters = {
    tag: sp.tag,
    outlet: sp.outlet,
    featured: sp.featured,
  };

  return (
    <div className="news-section-wrap">
      <section className="section" id="news">
        <div className="section-head">
          <div className="section-num">04 / Hírfolyam</div>
          <h2 className="section-title">Élő riportok az ügyekről.</h2>
        </div>

        <NewsFilters tags={tags} outlets={outletRows} />

        <NewsGrid
          key={`${sp.tag ?? ''}-${sp.outlet ?? ''}-${sp.featured ?? ''}`}
          initialArticles={initialArticles}
          initialHasMore={initialHasMore}
          filters={activeFilters}
        />
      </section>
    </div>
  );
}
