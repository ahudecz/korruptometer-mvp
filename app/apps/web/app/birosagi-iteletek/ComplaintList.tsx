'use client';
/* eslint-disable react/no-unescaped-entities -- Hungarian typographic quotes („ ") in display text */

import { useState } from 'react';

export type SerializedComplaint = {
  id: string;
  targetName: string;
  filerName: string;
  description: string | null;
  status: 'feljelentés' | 'nyomozás' | 'vádemelés' | 'ítélet' | 'elutasítva';
  eventDateFormatted: string;
  sourceUrls: string[];
  sourceNames: string[];
  sourceHeadlines: string[];
  sourceDates: string[];
};

function statusLabel(s: SerializedComplaint['status']): string {
  if (s === 'feljelentés') return 'Feljelentés megtörtént';
  if (s === 'nyomozás') return 'Nyomozás alatt';
  if (s === 'vádemelés') return 'Vádemelve';
  if (s === 'ítélet') return 'Ítélet született';
  return 'Elutasítva';
}

function statusModifier(s: SerializedComplaint['status']): string {
  if (s === 'feljelentés') return 'complaint-status-pill--filed';
  if (s === 'nyomozás') return 'complaint-status-pill--investigation';
  if (s === 'vádemelés') return 'complaint-status-pill--indictment';
  if (s === 'ítélet') return 'complaint-status-pill--verdict';
  return 'complaint-status-pill--rejected';
}

function ComplaintDetail({ c }: { c: SerializedComplaint }) {
  if (c.sourceUrls.length <= 1) return null;
  return (
    <div className="vrow-detail">
      <div className="verdict-sources-section">
        <div className="verdict-sources-heading">További forrásaink ebben az ügyben</div>
        <div className="verdict-source-cards">
          {c.sourceUrls.slice(1).map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="person-news-item verdict-source-card">
              <span className="person-news-source">{c.sourceNames[i + 1] ?? 'Forrás'}</span>
              {c.sourceDates[i + 1] && <span className="person-news-date">{c.sourceDates[i + 1]}</span>}
              <span className="person-news-headline">{c.sourceHeadlines[i + 1] ?? url}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComplaintRow({ c }: { c: SerializedComplaint }) {
  const [open, setOpen] = useState(false);
  const hasExtraSources = c.sourceUrls.length > 1;

  return (
    <div className={`vrow-card${open ? ' vrow-card--open' : ''}`}>
      <div
        className="vrow-header"
        style={{ cursor: hasExtraSources ? 'pointer' : 'default' }}
        onClick={() => hasExtraSources && setOpen((v) => !v)}
        role={hasExtraSources ? 'button' : undefined}
        tabIndex={hasExtraSources ? 0 : undefined}
        aria-expanded={hasExtraSources ? open : undefined}
        onKeyDown={(e) => {
          if (hasExtraSources && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        {hasExtraSources && (
          <span className="vrow-chevron" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}

        <div className="vrow-identity">
          <div className="vrow-name">{c.targetName}</div>
          <div className="vrow-position">Feljelentő: {c.filerName}</div>
          {c.description && <p className="complaint-row-description">{c.description}</p>}
          {c.sourceUrls[0] && (
            <a
              href={c.sourceUrls[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="complaint-row-source-link"
              onClick={(e) => e.stopPropagation()}
            >
              {c.sourceNames[0] ?? 'Forrás'} →
            </a>
          )}
        </div>

        <div className="vrow-court">{c.eventDateFormatted}</div>

        <span className={`complaint-status-pill ${statusModifier(c.status)}`} style={{ flexShrink: 0 }}>
          {statusLabel(c.status)}
        </span>
      </div>

      {open && <ComplaintDetail c={c} />}
    </div>
  );
}

export function ComplaintList({ rows }: { rows: SerializedComplaint[] }) {
  return (
    <div className="vlist">
      {rows.map((c) => <ComplaintRow key={c.id} c={c} />)}
    </div>
  );
}
