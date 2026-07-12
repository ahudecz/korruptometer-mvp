import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, ilike, like, or, and, eq, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { getDb, schema } from '@/lib/db';
import { UGYEK, type DescriptionBlock, type BreakingGroupArticle } from '../../_home/ugyek-config';
import { GALERIA } from '../../_home/galeria-config';
import { WATCH_LIST } from '../../_home/watchlist-config';
import { CrossLemondosok, CrossMegszunt, CrossGaleria, CrossFelszolitottak } from '../../_home/cross-promo';
import { truncate } from '../../_home/seo';

export const dynamic = 'force-dynamic';

// Egy csupa-nagybetűs kulcsszó (pl. "NKA", "MNB") kis- és nagybetűre
// nem érzékeny (ILIKE) substring-illesztéssel véletlen egyezéseket ad —
// "NKA" pl. beletalál a "munka" vagy "utazásunkat" szavakba, mert a magyar
// -unk/-ünk birtokos+tárgyeset toldalék-kombináció épp "nka"/"nke"-re végződik
// (ugyanaz a hibaosztály, mint a korábbi 'ász'→Hamász eset). Egy valódi
// magyar cikkcím a rövidítést szinte mindig nagybetűvel írja ki
// ("NKA-botrány", "NKA-pénzekről") — ezért a csupa nagybetűs kulcsszavaknál
// kis-nagybetű ÉRZÉKENY (LIKE) illesztésre váltunk, ami a véletlen
// kisbetűs egyezéseket kizárja, a valódi rövidítés-előfordulásokat nem.
function matchKeyword(column: AnyPgColumn, kw: string): SQL {
  const isBareAcronym = /^[A-ZÁÉÍÓÖŐÚÜŰ]+$/.test(kw);
  return isBareAcronym ? like(column, `%${kw}%`) : ilike(column, `%${kw}%`);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = UGYEK.find((u) => u.id === id);
  if (!entry) return {};
  return {
    title: truncate(entry.title, 40),
    description: truncate(entry.summary, 150),
  };
}

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

function DescBlock({ block }: { block: DescriptionBlock }) {
  switch (block.type) {
    case 'text':
      return (
        <div className="ugy-block-text">
          {block.heading && <h3 className="ugy-block-heading">{block.heading}</h3>}
          <p>{block.content}</p>
        </div>
      );
    case 'video':
      return (
        <div className="ugy-block-video">
          <div className="ugy-block-video-meta">
            {block.label && <span className="ugy-block-video-label">{block.label}</span>}
            {block.title && <span className="ugy-block-video-title">{block.title}</span>}
          </div>
          {block.summary && <p className="ugy-block-video-summary">{block.summary}</p>}
          <div className="ugy-block-video-wrap">
            <iframe
              src={`https://www.youtube.com/embed/${block.id}`}
              title={block.title ?? block.id}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      );
    case 'breaking-box':
      return (
        <div className="ugy-breaking-box">
          <div className="ugy-breaking-box-label">
            <span className="ugy-breaking-box-dot" />
            BREAKING
          </div>
          <div className="ugy-breaking-box-headline">{block.headline}</div>
          {block.lead && <p className="ugy-breaking-box-lead">{block.lead}</p>}
        </div>
      );
    case 'breaking-group':
      return (
        <div className="ugy-breaking-group">
          <div className="ugy-breaking-group-header">
            <div className="ugy-breaking-box-label">
              <span className="ugy-breaking-box-dot" />
              BREAKING
            </div>
            <div className="ugy-breaking-group-headline">{block.headline}</div>
            {block.lead && <p className="ugy-breaking-box-lead">{block.lead}</p>}
          </div>
          <div className="ugy-breaking-group-cards">
            {block.articles.map((a: BreakingGroupArticle, i: number) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="ugy-breaking-group-card">
                <div className="ugy-block-article-meta">
                  <span className="ugy-block-article-source">{a.source}</span>
                  {a.date && <span className="ugy-block-article-date">{a.date}</span>}
                </div>
                <div className="ugy-block-article-headline">{a.headline}</div>
                {a.lead && <p className="ugy-block-article-lead">{a.lead}</p>}
                <span className="ugy-block-article-arrow">Cikk olvasása →</span>
              </a>
            ))}
          </div>
        </div>
      );
    case 'article-card':
      return (
        <a
          href={block.url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`ugy-block-article-card${!block.url ? ' no-link' : ''}${block.breaking ? ' ugy-block-article-card--breaking' : ''}`}
        >
          {block.breaking && (
            <div className="ugy-block-article-breaking-badge">
              <span className="ugy-block-article-breaking-dot" />
              BREAKING
            </div>
          )}
          <div className="ugy-block-article-meta">
            <span className="ugy-block-article-source">{block.source}</span>
            {block.date && <span className="ugy-block-article-date">{block.date}</span>}
          </div>
          <div className="ugy-block-article-headline">{block.headline}</div>
          {block.lead && <p className="ugy-block-article-lead">{block.lead}</p>}
          {block.url && <span className="ugy-block-article-arrow">Cikk olvasása →</span>}
        </a>
      );
    case 'quote':
      return (
        <blockquote className="ugy-block-quote">
          <p>„{block.text}"</p>
          {block.author && <cite>{block.author}</cite>}
          {block.note && <span className="ugy-block-quote-note">{block.note}</span>}
          {block.url && (
            <a href={block.url} target="_blank" rel="noopener noreferrer" className="ugy-block-quote-source-link">
              Forrás →
            </a>
          )}
        </blockquote>
      );
    case 'pdf-link':
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ugy-block-pdf-link"
        >
          <span className="ugy-block-pdf-icon">📄</span>
          <span className="ugy-block-pdf-label">{block.label}</span>
          {block.note && <span className="ugy-block-pdf-note">{block.note}</span>}
        </a>
      );
    case 'audio-link':
      return (
        <a href={block.url} target="_blank" rel="noopener noreferrer" className="ugy-block-audio-link">
          <span className="ugy-block-audio-icon">🎙️</span>
          <div className="ugy-block-audio-content">
            <div className="ugy-block-audio-source">{block.source}</div>
            <div className="ugy-block-audio-title">{block.title}</div>
            {block.duration && <div className="ugy-block-audio-duration">{block.duration}</div>}
          </div>
          <span className="ugy-block-audio-cta">Meghallgatás →</span>
        </a>
      );
    case 'image-pair':
      return (
        <div className="ugy-block-image-pair">
          <img src={block.src1} alt={block.alt1 ?? ''} className="ugy-block-image-pair-img" />
          <img src={block.src2} alt={block.alt2 ?? ''} className="ugy-block-image-pair-img" />
          {block.caption && <p className="ugy-block-image-pair-caption">{block.caption}</p>}
        </div>
      );
  }
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
    conditions.push(matchKeyword(schema.newsArticles.tag, entry.articleTag));
  }
  if (entry.articleKeywords) {
    for (const kw of entry.articleKeywords) {
      conditions.push(matchKeyword(schema.newsArticles.headline, kw));
    }
  }
  if (entry.articleKeywordGroups) {
    for (const group of entry.articleKeywordGroups) {
      conditions.push(and(...group.map((kw) => matchKeyword(schema.newsArticles.headline, kw)))!);
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

  const descParagraphs = entry.descriptionBlocks ? [] : entry.description.split('\n\n').filter(Boolean);

  // Build related persons list: match relatedPersonIds against galeria + watchlist
  const relatedPersons = (entry.relatedPersonIds ?? []).map(pid => {
    const gal = GALERIA.find(g => g.id === pid);
    if (gal) return {
      id: gal.id,
      name: gal.name,
      subtitle: (gal.subtitle.split('·')[0] ?? '').trim(),
      photoUrl: gal.photoUrl ?? null,
      href: `/galeria/${gal.id}`,
      source: 'galeria' as const,
    };
    const watch = WATCH_LIST.find(w => w.id === pid);
    if (watch) return {
      id: watch.id,
      name: watch.name,
      subtitle: watch.institution,
      photoUrl: watch.photoUrl ?? null,
      href: `/lemondasok/${watch.id}`,
      source: 'watchlist' as const,
    };
    return null;
  }).filter(Boolean) as Array<{ id: string; name: string; subtitle: string; photoUrl: string | null; href: string; source: 'galeria' | 'watchlist' }>;

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
              <div className="photo-credit">{photoCredit}</div>
            )}
          </div>

          <div className="person-hero-text">
            <div className="person-hero-eyebrow">7 kiemelt ügy</div>
            <h1 className="person-hero-name">{entry.title}</h1>
            {entry.responsible && (
              <div className="person-hero-sub">{entry.responsible}</div>
            )}
            {entry.responsiblePersons && entry.responsiblePersons.length > 1 && (
              <div className="ugy-responsible-persons">
                {entry.responsiblePersons.map(p => (
                  <span key={p} className="ugy-responsible-person">{p}</span>
                ))}
              </div>
            )}
            {entry.estimatedDamage && (
              <div className="person-hero-amount">
                <span className="person-hero-amount-lbl">{entry.estimatedDamageLabel ?? 'Érintett közpénz'}</span>
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
            {entry.descriptionBlocks
              ? entry.descriptionBlocks.map((block, i) => <DescBlock key={i} block={block} />)
              : descParagraphs.map((para, i) => <p key={i}>{para}</p>)
            }
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

        {/* ── Kapcsolódó személyek ── */}
        {relatedPersons.length > 0 && (
          <div className="ugy-related-persons">
            <h2 className="person-section-title">Kapcsolódó személyek</h2>
            <div className="ugy-related-persons-grid">
              {relatedPersons.map(p => (
                <Link key={p.id} href={p.href} className="ugy-related-person-card">
                  <div className="ugy-related-person-photo">
                    {p.photoUrl ? (
                      <img
                        src={imgSrc(p.photoUrl)}
                        alt={p.name}
                        className="ugy-related-person-img"
                      />
                    ) : (
                      <div className="ugy-related-person-placeholder">
                        <span>{p.name.split(' ').slice(0, 2).map(w => w[0]).join('')}</span>
                      </div>
                    )}
                  </div>
                  <div className="ugy-related-person-text">
                    <div className="ugy-related-person-name">{p.name}</div>
                    <div className="ugy-related-person-sub">{p.subtitle}</div>
                    <div className="ugy-related-person-cta">
                      {p.source === 'galeria' ? 'Kiemelt személy →' : 'Felszólított →'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Kapcsolódó hírek ── */}
        {(articles.length > 0 || (entry.pinnedNews?.length ?? 0) > 0) && (
          <div className="person-news">
            <h2 className="person-section-title">Kapcsolódó hírek</h2>
            <p className="person-section-note">
              Automatikusan szűrve a napi hírfolyamból — minden új cikk azonnal megjelenik.
            </p>
            <div className="person-news-list">
              {entry.pinnedNews?.map((a, i) => (
                <a
                  key={`pinned-${i}`}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="person-news-item"
                >
                  <span className="person-news-source">{a.source}</span>
                  {a.date && <span className="person-news-date">{a.date}</span>}
                  <span className="person-news-headline">{a.headline}</span>
                </a>
              ))}
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

        {articles.length === 0 && (entry.pinnedNews?.length ?? 0) === 0 && (
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
