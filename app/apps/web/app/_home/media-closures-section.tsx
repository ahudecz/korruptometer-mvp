'use client';

import React from 'react';
import Link from 'next/link';
import { MEDIA_OUTLETS, MEDIA_GROUPS, outletLogoSrc, type MediaOutletEntry } from './media-config';

function MediaCard({ entry, subgrid = false }: { entry: MediaOutletEntry; subgrid?: boolean }) {
  const src = outletLogoSrc(entry);
  const isClosed = entry.status === 'closed';
  const isPendingClosed = entry.status === 'pending-closed';
  const isFired = entry.status === 'fired-staff';

  const statusColor = isClosed ? '#e31937' : isPendingClosed ? '#e86000' : isFired ? '#e8a000' : '#5c5e62';

  const imgStyle: React.CSSProperties = entry.logoScale
    ? { transform: `scale(${entry.logoScale})`, objectFit: 'cover' }
    : {};
  const logoStyle: React.CSSProperties | undefined = entry.logoBgColor
    ? { backgroundColor: entry.logoBgColor }
    : undefined;

  return (
    <div className={`media-card mc-${entry.status}${subgrid ? ' mc-subgrid' : ''}`}>
      <div className={`media-card-logo${entry.logoBgWhite ? ' bg-white' : ''}`} style={logoStyle}>
        {src ? (
          <img
            src={src}
            alt={entry.name}
            loading="lazy"
            style={imgStyle}
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = 'none';
              const parent = el.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="media-logo-fallback">${entry.name.slice(0, 2).toUpperCase()}</span>`;
              }
            }}
          />
        ) : (
          <span className="media-logo-fallback">{entry.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="media-card-name">{entry.name}</div>
      <div className="media-card-editor">{entry.editorInChief ?? ''}</div>
      <p className="media-card-desc">{entry.description}</p>
      <div className="media-card-status" style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}55`, marginTop: 'auto' }}>
        {entry.statusLabel}
      </div>
      <div className="media-card-owner-row">
        <div className="media-card-owner">{entry.owner}</div>
        {isPendingClosed && entry.sourceUrl && (
          <div className="media-card-source">
            * <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#e86000', textDecoration: 'underline' }}>{entry.sourceName ?? 'forrás'}</a> híre alapján
          </div>
        )}
      </div>
      {(isClosed || isPendingClosed || isFired) && (
        <div className="mc-stamp" aria-hidden="true">
          {isClosed ? 'MEGSZŰNT' : isPendingClosed ? 'MEGSZŰNT*' : (
            <>
              <span style={{ fontSize: '0.55em', display: 'block', letterSpacing: '0.12em', lineHeight: 1.2, marginBottom: 2 }}>SZERKESZTŐSÉG</span>
              KIRÚGVA
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MediaClosuresSection() {
  return (
    <div className="megszunt-section-wrap">
      <section className="section elszamoltatas-section">
        <div className="section-head">
          <div className="section-num">07 / Médiaváltozások</div>
          <h2 className="section-title">Megszűnt-e már?</h2>
        </div>
        <p className="elszamoltatas-deck">
          A NER teljes sajtóbirodalma — KESMA napilapok, hetilapok, magazinok, online portálok, rádiók és TV-műsorok.
          A Mediaworks a KESMA leányvállalata. Ami megszűnt, azt jelöltük. Ami kirúgta az összes újságíróját, azt narancssárgával jelöltük.
        </p>

        {/* Kiemelt breaking — intézmény megszűnése, az ügyek-oldali cikkajánló formátumban */}
        <a
          href="https://telex.hu/velemeny/2026/06/30/szuverenitasvedelmi-hivatal-lanczi-tamas-nemzeti-erdek-borton"
          target="_blank"
          rel="noopener noreferrer"
          className="ugy-block-article-card ugy-block-article-card--breaking"
          style={{ margin: '8px 0 28px' }}
        >
          <div className="ugy-block-article-breaking-badge">
            <span className="ugy-block-article-breaking-dot" />
            BREAKING
          </div>
          <div className="ugy-block-article-meta">
            <span className="ugy-block-article-source">Telex</span>
            <span className="ugy-block-article-date">2026. június 30.</span>
          </div>
          <div className="ugy-block-article-headline">Megszűnt a Szuverenitásvédelmi Hivatal</div>
          <p className="ugy-block-article-lead">
            Az Országgyűlés 2026. június 30-án megszüntette a Lánczi Tamás vezette Szuverenitásvédelmi Hivatalt.
          </p>
          <span className="ugy-block-article-arrow">Cikk olvasása →</span>
        </a>

        {MEDIA_GROUPS.map(group => {
          const STATUS_ORDER: Record<string, number> = { closed: 0, 'pending-closed': 1, 'fired-staff': 2, active: 3 };
          const entries = MEDIA_OUTLETS
            .filter(e => e.group === group.key)
            .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
          if (entries.length === 0) return null;
          return (
            <div key={group.key} className="media-group">
              <div className="media-group-label">{group.label}</div>
              <div className="media-grid">
                {entries.map(entry => (
                  <MediaCard key={entry.id} entry={entry} subgrid={group.key === 'tv-youtube'} />
                ))}
              </div>
            </div>
          );
        })}

        <div className="elszamoltatas-more">
          <Link href="/megszunt" className="btn-red">Összes megszűnt médium →</Link>
        </div>
      </section>
    </div>
  );
}
