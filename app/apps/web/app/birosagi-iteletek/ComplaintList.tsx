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
  if (s === 'feljelentés') return 'FELJELENTÉS MEGTÖRTÉNT';
  if (s === 'nyomozás') return 'NYOMOZÁS ALATT';
  if (s === 'vádemelés') return 'VÁDEMELVE';
  if (s === 'ítélet') return 'ÍTÉLET SZÜLETETT';
  return 'ELUTASÍTVA';
}

function statusModifier(s: SerializedComplaint['status']): string {
  if (s === 'feljelentés') return 'vrow-badge--complaint-filed';
  if (s === 'nyomozás') return 'vrow-badge--complaint-investigation';
  if (s === 'vádemelés') return 'vrow-badge--complaint-indictment';
  if (s === 'ítélet') return 'vrow-badge--complaint-verdict';
  return 'vrow-badge--complaint-rejected';
}

function ComplaintDetail({ c }: { c: SerializedComplaint }) {
  return (
    <div className="vrow-detail">
      {c.description && <p className="verdict-summary">{c.description}</p>}

      {c.sourceUrls.length > 0 && (
        <div className="verdict-sources-section">
          <div className="verdict-sources-heading">Sajtóforrások</div>
          <div className="verdict-source-cards">
            {c.sourceUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="person-news-item verdict-source-card">
                <span className="person-news-source">{c.sourceNames[i] ?? 'Forrás'}</span>
                {c.sourceDates[i] && <span className="person-news-date">{c.sourceDates[i]}</span>}
                <span className="person-news-headline">{c.sourceHeadlines[i] ?? url}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComplaintRow({ c }: { c: SerializedComplaint }) {
  const [open, setOpen] = useState(false);
  const initials = c.targetName.split(' ').slice(0, 2).map((w) => w[0]).join('');

  return (
    <div className={`vrow-card${open ? ' vrow-card--open' : ''}`}>
      <button type="button" className="vrow-header" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="vrow-chevron" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>

        <div className="vrow-avatar">
          <div className="vrow-avatar-placeholder">{initials}</div>
        </div>

        <div className="vrow-identity">
          <div className="vrow-name">{c.targetName}</div>
          <div className="vrow-position">Feljelentő: {c.filerName}</div>
        </div>

        <div className="vrow-court">{c.eventDateFormatted}</div>

        <div className={`vrow-badge ${statusModifier(c.status)}`}>
          <span>{statusLabel(c.status)}</span>
        </div>
      </button>

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
