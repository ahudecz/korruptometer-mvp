import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, ilike, or, eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { UGYEK } from '../../_home/ugyek-config';
import { GALERIA } from '../../_home/galeria-config';
import { CrossLemondosok, CrossMegszunt, CrossGaleria, CrossFelszolitottak } from '../../_home/cross-promo';

export const dynamic = 'force-dynamic';

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

function imgSrc(url: string): string {
  if (url.startsWith('/') || url.includes('wikimedia.org')) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

export async function generateStaticParams() {
  return UGYEK.map((e) => ({ id: e.id }));
}

export default async function UgyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = UGYEK.find((e) => e.id === id);
  if (!entry) notFound();

  const galeriaEntry = entry.responsibleGaleriaId
    ? GALERIA.find(e => e.id === entry.responsibleGaleriaId)
    : null;

  const photoUrl = galeriaEntry?.photoUrl ?? entry.photo;
  const photoCredit = galeriaEntry?.photoCredit ?? entry.photoCredit;
  const photoPosition = entry.photoPosition;
  const isZsoltBacsi = entry.id === 'zsolt-bacsi';
  const initials = entry.responsible?.split(' ').slice(0, 2).map(w => w[0]).join('') ?? '?';
  const badgeColor = entry.eyebrow.toLowerCase().includes('aktív') ? '#e31937'
    : entry.eyebrow.toLowerCase().includes('vizsgálóbizottság') ? '#1d4ed8'
    : '#4a6a8a';

  const db = getDb();

  const conditions = [];
  if (entry.articleTag) {
    conditions.push(ilike(schema.newsArticles.tag, `%${entry.articleTag}%`));
  }
  if (entry.articleKeywords) {
    for (const kw of entry.articleKeywords) {
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
        .limit(30)
    : [];

  const descParagraphs = entry.description.split('\n\n').filter(Boolean);

  return (
    <div className="person-page ugy-page">

      {/* ── Hero: galeria stílusú ── */}
      <div className="person-hero">
        <div className="person-hero-inner">

          <div className="person-hero-photo">
            {photoUrl ? (
              <img
                src={imgSrc(photoUrl)}
                alt={entry.responsible ?? entry.title}
                className="person-photo-img"
                style={photoPosition ? { objectPosition: photoPosition } : undefined}
              />
            ) : (
              <div className="person-photo-placeholder">
                <span>{isZsoltBacsi ? '?' : initials}</span>
              </div>
            )}
            <div className="person-status-badge" style={{ background: badgeColor }}>
              {(entry.eyebrow.split('·')[0] ?? '').trim()}
            </div>
            {photoCredit && (
              <div className="photo-credit">Fotó: {photoCredit}</div>
            )}
          </div>

          <div className="person-hero-text">
            <div className="person-hero-eyebrow">7 kiemelt ügy</div>
            <h1 className="person-hero-name">{entry.title}</h1>
            {entry.responsible && (
              <div className="person-hero-sub">{entry.responsible}</div>
            )}
            {entry.estimatedDamage && (
              <div className="person-hero-amount">
                <span className="person-hero-amount-lbl">Becsült kár</span>
                <span className="person-hero-amount-val">{entry.estimatedDamage}</span>
              </div>
            )}
            <p className="person-hero-desc">{entry.summary}</p>
            {entry.crimeTypes && entry.crimeTypes.length > 0 && (
              <div className="person-hero-tags">
                {entry.crimeTypes.map(c => <span key={c} className="tag">{c}</span>)}
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="person-body">

        {/* ── Main video ── */}
        {entry.videoId && (
          <div className="person-video-section">
            {(entry.videoTitle || entry.videoSummary) && (
              <div className="person-video-teaser">
                {entry.videoChannel && <div className="person-video-teaser-channel">{entry.videoChannel}</div>}
                {entry.videoTitle && <h3 className="person-video-teaser-title">{entry.videoTitle}</h3>}
                {entry.videoSummary && <p className="person-video-teaser-desc">{entry.videoSummary}</p>}
              </div>
            )}
            <div className="person-video-wrap">
              <iframe
                src={`https://www.youtube.com/embed/${entry.videoId}`}
                title={entry.videoTitle ?? `${entry.title} – összefoglaló videó`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {/* ── Additional videos ── */}
        {entry.additionalVideos && entry.additionalVideos.length > 0 && (
          <div className="ugy-extra-videos">
            <h2 className="person-section-title">Kapcsolódó videók</h2>
            <div className="ugy-extra-videos-grid">
              {entry.additionalVideos.map(v => (
                <div key={v.id} className="ugy-extra-video">
                  <div className="ugy-extra-video-meta">
                    <span className="ugy-extra-video-label">{v.label}</span>
                    <span className="ugy-extra-video-title">{v.title}</span>
                  </div>
                  <div className="ugy-extra-video-wrap">
                    <iframe
                      src={`https://www.youtube.com/embed/${v.id}`}
                      title={v.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Az ügy ismertetése ── */}
        <div className="ugy-description">
          <h2 className="person-section-title">Az ügy ismertetése</h2>
          <p className="person-section-note">
            Sajtójelentések és nyilvánosan hozzáférhető dokumentumok alapján. Jogerős ítélet
            hiányában az érintett személyek ártatlannak tekintendők.
          </p>
          <div className="ugy-description-body">
            {descParagraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {entry.statusItems && entry.statusItems.length > 0 && (
            <div className="ugy-status-summary">
              {entry.statusItems.map((s, i) => (
                <div key={i} className="ugy-status-summary-row">
                  <span className="ugy-status-summary-icon">{s.icon}</span>
                  <div className="ugy-status-summary-body">
                    <div className="ugy-status-summary-label">{s.label}</div>
                    <div className="ugy-status-summary-value">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {entry.sourceRefs && entry.sourceRefs.length > 0 && (
            <div className="ugy-sources">
              <p className="ugy-sources-disclaimer">
                A fenti összefoglaló az alábbi cikkek tartalmaiból készült — nem saját szerkesztőségi tartalom.
              </p>
              <div className="ugy-sources-label">Forrás</div>
              <ul className="ugy-sources-list">
                {entry.sourceRefs.map((ref, i) => (
                  <li key={i}>
                    <a href={ref.url} target="_blank" rel="noopener noreferrer">
                      {ref.label} →
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ── Kapcsolódó hírek ── */}
        {articles.length > 0 && (
          <div className="person-news">
            <h2 className="person-section-title">Kapcsolódó hírek</h2>
            <p className="person-section-note">
              Automatikusan szűrve a napi hírfolyamból — minden új cikk azonnal megjelenik.
            </p>
            <div className="person-news-list">
              {articles.map(a => (
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

        {articles.length === 0 && (
          <div className="person-news-empty">
            Még nincs beindexelt hír ehhez az ügyhez — a következő scrape során frissül.
          </div>
        )}
      </div>

      {/* ── Többi ügy nav ── */}
      <div className="person-more-section">
        <div className="person-more-inner">
          <div className="person-more-label">Többi kiemelt ügy</div>
          <div className="ugyek-more-grid">
            {UGYEK.filter(e => e.id !== entry.id).map(e => (
              <Link key={e.id} href={`/ugyek/${e.id}`} className="ugyek-more-card">
                <div className="ugyek-more-eyebrow">{(e.eyebrow.split('·')[0] ?? '').trim()}</div>
                <div className="ugyek-more-title">{e.title}</div>
                {e.responsible && <div className="ugyek-more-sub">{e.responsible}</div>}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="cross-promo-below-more">
        <div className="cross-promo-below-more-inner">
          <CrossLemondosok />
          <CrossGaleria />
          <CrossMegszunt />
          <CrossFelszolitottak />
        </div>
      </div>
    </div>
  );
}
