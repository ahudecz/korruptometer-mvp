'use client';
/* eslint-disable react/no-unescaped-entities -- Hungarian typographic quotes („ ") in display text */

import { useState } from 'react';

export type SerializedComplaint = {
  id: string;
  targetName: string;
  filerName: string;
  description: string | null;
  amountLabel: string | null;
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
  return (
    <div className="vrow-detail">
      {/* Mobilon a fejlécből elrejtett dátum itt jelenik meg — l.
          .complaint-meta-item--date mobil display:none szabálya. */}
      <p className="complaint-detail-date">{c.eventDateFormatted}</p>
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

  return (
    <div className={`complaint-card${open ? ' complaint-card--open' : ''}`}>
      <button type="button" className="complaint-card-header" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="complaint-chevron" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>

        <div className="complaint-identity">
          <div className="complaint-title">{c.targetName}</div>
          <div className="complaint-filer">Feljelentő: {c.filerName}</div>
        </div>

        <div className="complaint-meta">
          <div className="complaint-meta-item complaint-meta-item--amount">
            <span className="complaint-meta-label">Összeg</span>
            <span className="complaint-meta-value complaint-meta-value--amount">{c.amountLabel ?? '–'}</span>
          </div>
          <div className="complaint-meta-item complaint-meta-item--date">
            <span className="complaint-meta-label">Dátum</span>
            <span className="complaint-meta-value">{c.eventDateFormatted}</span>
          </div>
          <span className={`complaint-status-pill complaint-status-pill--meta ${statusModifier(c.status)}`}>{statusLabel(c.status)}</span>
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
