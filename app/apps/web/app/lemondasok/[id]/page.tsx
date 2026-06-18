import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, ilike, or, eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { WATCH_LIST, type WatchPerson } from '../../_home/watchlist-config';
import { WATCHLIST_DETAIL } from '../../_home/watchlist-detail-config';
import { CrossGaleria, CrossUgyek, CrossLemondosok } from '../../_home/cross-promo';

export const dynamic = 'force-dynamic';

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

function statusLabel(status: WatchPerson['status']): string {
  if (status === 'active') return 'Hivatalban van';
  if (status === 'resigned') return 'Lemondott';
  if (status === 'removed') return 'Eltávolítva';
  return status;
}

function statusColor(status: WatchPerson['status']): string {
  if (status === 'active') return '#2a8a4a';
  return '#e31937';
}

function photoSrc(url: string): string {
  if (url.startsWith('/')) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

export async function generateStaticParams() {
  return WATCH_LIST.map((p) => ({ id: p.id }));
}

export default async function WatchlistPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const person = WATCH_LIST.find((p) => p.id === id);
  if (!person) notFound();

  const detail = WATCHLIST_DETAIL.find((d) => d.id === id);

  const db = getDb();

  const conditions = [];
  if (detail?.newsKeywords) {
    for (const kw of detail.newsKeywords) {
      conditions.push(ilike(schema.newsArticles.headline, `%${kw}%`));
    }
  }

  const articles = conditions.length > 0
    ? await db
        .select({
          id: schema.newsArticles.id,
          headline: schema.newsArticles.headline,
          excerpt: schema.newsArticles.excerpt,
          sourceUrl: schema.newsArticles.sourceUrl,
          publishedAt: schema.newsArticles.publishedAt,
          sourceName: schema.sources.name,
        })
        .from(schema.newsArticles)
        .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
        .where(or(...conditions))
        .orderBy(desc(schema.newsArticles.publishedAt))
        .limit(20)
    : [];

  const others = WATCH_LIST.filter((p) => p.id !== id);

  return (
    <div className="person-page">
      {/* Hero */}
      <div className="person-hero">
        <div className="person-hero-inner">
          <div className="person-hero-photo">
            {person.photoUrl ? (
              <img
                src={photoSrc(person.photoUrl)}
                alt={person.name}
                className="person-photo-img"
                style={person.objectPosition ? { objectPosition: person.objectPosition } : undefined}
              />
            ) : (
              <div className="person-photo-placeholder">
                <span>{person.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
              </div>
            )}
            <div
              className="person-status-badge"
              style={{ background: statusColor(person.status) }}
            >
              {statusLabel(person.status)}
            </div>
            {person.photoCredit && (
              <div className="photo-credit">Fotó: {person.photoCredit}</div>
            )}
          </div>

          <div className="person-hero-text">
            <div className="person-hero-eyebrow">Lemondásra felszólított személy</div>
            <h1 className="person-hero-name">{person.name}</h1>
            <div className="person-hero-sub">{person.institution}</div>
            {detail?.nerRole && (
              <p className="person-hero-desc">{detail.nerRole}</p>
            )}
          </div>
        </div>
      </div>

      <div className="person-body">
        {/* Bio */}
        {detail?.bio && (
          <div className="person-bio">
            <p>{detail.bio}</p>
          </div>
        )}

        {/* Video */}
        {detail?.videoId ? (
          <div className="person-video-section">
            {detail.videoSummary && (
              <div className="person-video-teaser">
                <div className="person-video-teaser-channel">{detail.videoSummary.source}</div>
                <div className="person-video-teaser-title">{detail.videoSummary.title}</div>
                <p className="person-video-teaser-desc">{detail.videoSummary.description}</p>
              </div>
            )}
            <div className="person-video-wrap">
              <iframe
                src={`https://www.youtube.com/embed/${detail.videoId}`}
                title={`${person.name} – összefoglaló videó`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        ) : (
          <div className="person-video-wrap">
            <div className="person-video-placeholder">
              <div className="person-video-icon">▶</div>
              <p>Összefoglaló videó hamarosan</p>
            </div>
          </div>
        )}

        {/* Key cases */}
        {detail?.keyCases && detail.keyCases.length > 0 && (
          <div className="person-cases">
            <h2 className="person-section-title">Főbb szerepek és ügyek</h2>
            <p className="person-section-note">
              Az alábbi esetek sajtócikkeken és nyilvánosan hozzáférhető dokumentumokon alapulnak.
              Jogerős ítélet hiányában bűnösséget nem állítanak.
            </p>
            {detail.keyCases.map((c, i) => (
              <div key={i} className="person-case-card">
                <div className="person-case-num">/ {String(i + 1).padStart(2, '0')}</div>
                <div className="person-case-body">
                  <h3 className="person-case-title">{c.title}</h3>
                  <p className="person-case-desc">{c.description}</p>
                  <div className="person-case-footer">
                    <div className="person-case-crimes">
                      {c.crimeTypes.map((cr) => (
                        <span key={cr} className="tag">{cr}</span>
                      ))}
                    </div>
                    {c.sourceUrl && (
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="person-case-source"
                      >
                        Forrás: {c.sourceLabel ?? 'link'} →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* News */}
        {(articles.length > 0 || (detail?.pinnedLinks && detail.pinnedLinks.length > 0)) && (
          <div className="person-news">
            <h2 className="person-section-title">Kapcsolódó hírek</h2>
            <p className="person-section-note">
              Automatikusan szűrve a napi hírfolyamból — minden új cikk azonnal megjelenik.
            </p>
            <div className="person-news-list">
              {detail?.pinnedLinks?.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="person-news-item person-news-item--pinned"
                >
                  <span className="person-news-source">{l.source}</span>
                  <span className="person-news-headline">{l.title}</span>
                </a>
              ))}
              {articles.map((a) => (
                <a
                  key={a.id}
                  href={a.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="person-news-item"
                >
                  <span className="person-news-source">{a.sourceName}</span>
                  <span className="person-news-date">{fmtDate(a.publishedAt)}</span>
                  <span className="person-news-headline">{a.headline}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {articles.length === 0 && (!detail?.pinnedLinks || detail.pinnedLinks.length === 0) && (
          <div className="person-news-empty">
            Még nincs beindexelt hír ehhez a személyhez — a következő scrape során frissül.
          </div>
        )}
      </div>

      {/* Other watchlist persons */}
      <div className="person-more-section">
        <div className="person-more-inner">
          <div className="person-more-label">Többi felszólított személy</div>
          <div className="person-more-grid">
            {others.map((p) => (
              <Link key={p.id} href={`/lemondasok/${p.id}`} className="person-more-card">
                <div className="person-more-mug r-loose">
                  {p.photoUrl ? (
                    <img
                      src={photoSrc(p.photoUrl)}
                      alt={p.name}
                      className="person-more-img"
                    />
                  ) : (
                    <div className="person-photo-placeholder">
                      <span>{p.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
                    </div>
                  )}
                </div>
                <div className="person-more-name">{p.name}</div>
                <div className="person-more-sub">{p.institution}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Cross-promo */}
      <div className="cross-promo-below-more">
        <div className="cross-promo-below-more-inner">
          <CrossGaleria />
          <CrossUgyek />
          <CrossLemondosok />
        </div>
      </div>
    </div>
  );
}
