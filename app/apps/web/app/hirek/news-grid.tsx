'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';

import { NewsCardImage } from './news-card-image';

type Article = {
  id: string;
  headline: string;
  excerpt: string;
  sourceUrl: string;
  publishedAt: string;
  tag: string | null;
  imageUrl: string | null;
  featured: boolean;
  relatedCaseId: string | null;
  sourceSlug: string | null;
  sourceName: string | null;
};

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtRelative(d: string): string {
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'most';
  if (h < 24) return `${h} órája`;
  if (h < 48) return 'tegnap';
  if (h < 120) return `${Math.floor(h / 24)} napja`;
  const month = HU_MONTHS[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const thisYear = new Date().getFullYear();
  return year === thisYear ? `${month} ${day}.` : `${year}. ${month} ${day}.`;
}

function headlineKey(headline: string): string {
  return headline
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 7)
    .join(' ');
}

function ArticleCard({ a, feature }: { a: Article; feature?: boolean }) {
  return (
    <a
      href={a.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`news-card${feature ? ' feature' : ''}`}
    >
      {a.imageUrl && <NewsCardImage src={a.imageUrl} />}
      <div className="news-meta">
        <span className="news-tag">{feature ? '★ Kiemelt' : (a.tag ?? 'Hír')}</span>
        <span className="news-time">{fmtRelative(a.publishedAt)}</span>
      </div>
      <h3 className="news-headline">{a.headline}</h3>
      <p className="news-excerpt">{a.excerpt}</p>
      {a.relatedCaseId ? (
        <Link
          href={`/adatbazis/${a.relatedCaseId}`}
          className="news-source"
          style={{ color: 'var(--accent)' }}
          onClick={(e) => e.stopPropagation()}
        >
          Kapcsolódó ügy: {a.relatedCaseId}
        </Link>
      ) : (
        <span className="news-source">{a.sourceName ?? a.sourceSlug ?? 'Forrás'}</span>
      )}
    </a>
  );
}

const BATCH = 60;

export function NewsGrid({
  initialArticles,
  initialHasMore,
  filters,
}: {
  initialArticles: Article[];
  initialHasMore: boolean;
  filters: { tag?: string; outlet?: string; featured?: string };
}) {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [offset, setOffset] = useState(BATCH);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();
  const seenKeys = useState(() => new Set(initialArticles.map((a) => headlineKey(a.headline))))[0];

  function loadMore() {
    startTransition(async () => {
      const params = new URLSearchParams({ offset: String(offset), limit: String(BATCH) });
      if (filters.tag) params.set('tag', filters.tag);
      if (filters.outlet) params.set('outlet', filters.outlet);
      if (filters.featured) params.set('featured', filters.featured);

      const res = await fetch(`/api/news?${params}`);
      const data: { items: Article[]; hasMore: boolean } = await res.json();

      const fresh = data.items.filter((a) => {
        const k = headlineKey(a.headline);
        if (seenKeys.has(k)) return false;
        seenKeys.add(k);
        return true;
      });

      setArticles((prev) => [...prev, ...fresh]);
      setOffset((prev) => prev + BATCH);
      setHasMore(data.hasMore);
    });
  }

  const featured = articles.find((a) => a.featured) ?? null;
  const rest = articles.filter((a) => a.id !== featured?.id);

  if (articles.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 32 }}>
        Nincs találat a megadott szűrőkre.
      </div>
    );
  }

  return (
    <>
      <div className="news-grid" style={{ marginTop: 32 }}>
        {featured && <ArticleCard a={featured} feature />}
        {rest.map((a) => <ArticleCard key={a.id} a={a} />)}
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button
            type="button"
            onClick={loadMore}
            disabled={isPending}
            style={{
              background: 'none',
              border: '1px solid var(--line)',
              borderRadius: 6,
              color: 'var(--ink)',
              cursor: isPending ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.06em',
              padding: '12px 32px',
              opacity: isPending ? 0.6 : 1,
              transition: 'opacity 0.15s, border-color 0.15s',
            }}
          >
            {isPending ? 'Betöltés…' : 'Továbbiak betöltése'}
          </button>
        </div>
      )}
    </>
  );
}
