'use client';

import React from 'react';
import Link from 'next/link';
import { MEDIA_OUTLETS, MEDIA_GROUPS, type MediaOutletEntry } from './media-config';

function logoSrc(entry: MediaOutletEntry): string | null {
  if (!entry.logoUrl) return null;
  if (entry.logoUrl.startsWith('/')) return entry.logoUrl;
  return `/api/img-proxy?url=${encodeURIComponent(entry.logoUrl)}`;
}

function MediaCard({ entry }: { entry: MediaOutletEntry }) {
  const src = logoSrc(entry);
  const isClosed = entry.status === 'closed';
  const isFired = entry.status === 'fired-staff';

  const statusColor = isClosed ? '#e31937' : isFired ? '#e8a000' : '#5c5e62';

  const imgStyle: React.CSSProperties = entry.logoScale
    ? { transform: `scale(${entry.logoScale})`, objectFit: 'cover' }
    : {};

  return (
    <div className={`media-card mc-${entry.status}`}>
      <div className={`media-card-logo${entry.logoBgWhite ? ' bg-white' : ''}`}>
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
      {entry.editorInChief && (
        <div className="media-card-editor">{entry.editorInChief}</div>
      )}
      <p className="media-card-desc">{entry.description}</p>
      <div className="media-card-status" style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}55` }}>
        {entry.statusLabel}
      </div>
      <div className="media-card-owner">{entry.owner}</div>
      {(isClosed || isFired) && (
        <div className="mc-stamp" aria-hidden="true">
          {isClosed ? 'MEGSZŰNT' : 'KIRÚGVA'}
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
          <div className="section-num">06 / Elszámoltatás</div>
          <h2 className="section-title">Megszűnt-e már?</h2>
        </div>
        <p className="elszamoltatas-deck">
          A NER teljes sajtóbirodalma — KESMA napilapok, hetilapok, magazinok, online portálok, rádiók és TV-műsorok.
          A Mediaworks a KESMA leányvállalata. Ami megszűnt, azt jelöltük. Ami kirúgta az összes újságíróját, azt narancssárgával jelöltük.
        </p>

        {MEDIA_GROUPS.map(group => {
          const entries = MEDIA_OUTLETS.filter(e => e.group === group.key);
          if (entries.length === 0) return null;
          return (
            <div key={group.key} className="media-group">
              <div className="media-group-label">{group.label}</div>
              <div className="media-grid">
                {entries.map(entry => (
                  <MediaCard key={entry.id} entry={entry} />
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
