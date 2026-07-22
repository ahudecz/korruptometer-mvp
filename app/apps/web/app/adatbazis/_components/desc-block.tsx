import type { DescriptionBlock, BreakingGroupArticle } from '../../_home/ugyek-config';

function imgSrc(url: string): string {
  if (url.startsWith('/') || url.includes('wikimedia.org')) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Renders one editorial `DescriptionBlock`. Same block vocabulary as /ugyek so
 * curated content is portable between the two surfaces (FR-004).
 *
 * 2026-07-22 — user report: a NKA-ügyoldalon két "breaking-group" blokk
 * (jún. 23. és júl. 22.) egyszerre díszlett piros BREAKING kerettel, mert a
 * renderelés sose nézte meg, hogy melyik a legfrissebb — minden
 * 'breaking-group' blokk mindig a saját típusa szerint, egymástól
 * függetlenül rendereltt. `isLatestBreaking` a hívó felelőssége: csak a
 * blokk-tömb ELSŐ (konvenció szerint legfrissebb, l. ugyek-config.ts blokk-
 * sorrend komment) 'breaking-group'-ja kapja meg true-val, minden korábbi
 * automatikusan sima szürke article-card-listává degradálódik — nem kell
 * kézzel utólag átírni a régi blokkot, amikor egy új breaking bekerül.
 * Nem NKA-specifikus: minden /ugyek és /adatbazis oldalra vonatkozik, ahol
 * 'breaking-group' blokkot használnak.
 */
export function DescBlock({ block, isLatestBreaking = true }: { block: DescriptionBlock; isLatestBreaking?: boolean }) {
  if (block.type === 'breaking-group' && !isLatestBreaking) {
    return (
      <>
        {block.articles.map((a: BreakingGroupArticle, i: number) => (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="ugy-block-article-card">
            <div className="ugy-block-article-meta">
              <span className="ugy-block-article-source">{a.source}</span>
              {a.date && <span className="ugy-block-article-date">{a.date}</span>}
            </div>
            <div className="ugy-block-article-headline">{a.headline}</div>
            {a.lead && <p className="ugy-block-article-lead">{a.lead}</p>}
            <span className="ugy-block-article-arrow">Cikk olvasása →</span>
          </a>
        ))}
      </>
    );
  }
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
        <a href={block.url} target="_blank" rel="noopener noreferrer" className="ugy-block-pdf-link">
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
          <img src={imgSrc(block.src1)} alt={block.alt1 ?? ''} className="ugy-block-image-pair-img" />
          <img src={imgSrc(block.src2)} alt={block.alt2 ?? ''} className="ugy-block-image-pair-img" />
          {block.caption && <p className="ugy-block-image-pair-caption">{block.caption}</p>}
        </div>
      );
  }
}
