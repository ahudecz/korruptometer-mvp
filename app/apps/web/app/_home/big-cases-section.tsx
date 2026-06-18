'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface BigCaseArticle {
  id: string;
  headline: string;
  sourceUrl: string;
  sourceName: string | null;
  publishedAt: string;
}

interface StatusItem {
  icon: string;
  label: string;
  value: string;
}

export interface BigCaseConfig {
  id: string;
  eyebrow: string;
  title: string;
  responsible?: string;
  summary: string;
  videoId?: string;
  statusItems?: StatusItem[];
  articleTag?: string;
  moreUrl?: string;
  articles?: BigCaseArticle[];
  placeholder?: boolean;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
}

function CaseDetail({ c }: { c: BigCaseConfig }) {
  if (c.placeholder) {
    return (
      <div className="big-case-coming-soon">
        <div className="big-case-coming-icon">⏳</div>
        <p className="big-case-coming-text">Ez az ügy hamarosan kerül fel a Kegyencjáratra.</p>
      </div>
    );
  }

  return (
    <div className="big-case-detail-inner">
      {c.videoId && (
        <div className="big-case-video-wrap">
          <iframe
            src={`https://www.youtube.com/embed/${c.videoId}`}
            title={c.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {c.statusItems && c.statusItems.length > 0 && (
        <div className="big-case-status">
          {c.statusItems.map((s, i) => (
            <div key={i} className="big-case-status-row">
              <span className="big-case-status-icon">{s.icon}</span>
              <div>
                <div className="big-case-status-label">{s.label}</div>
                <div className="big-case-status-value">{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {c.articles && c.articles.length > 0 && (
        <div className="big-case-news">
          <div className="big-case-news-label">Legfrissebb hírek</div>
          {c.articles.map(a => (
            <a
              key={a.id}
              href={a.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="big-case-news-item"
            >
              <span className="big-case-news-source">{a.sourceName}</span>
              <span className="big-case-news-date">{fmtDate(a.publishedAt)}</span>
              <span className="big-case-news-headline">{a.headline}</span>
            </a>
          ))}
        </div>
      )}

      {c.moreUrl && (
        <Link href={c.moreUrl} className="big-case-more-btn">
          A teljes ügy →
        </Link>
      )}
    </div>
  );
}

export function BigCasesSection({ cases }: { cases: BigCaseConfig[] }) {
  const [selected, setSelected] = useState(0);
  const active = cases[selected];

  if (cases.length === 0 || !active) return null;

  return (
    <section className="section big-cases-section" id="legdurvabb-ugyek">
      <div className="section-head">
        <div className="section-num">03 / Legdurvább ügyek</div>
        <h2 className="section-title">Legdurvább ügyek.</h2>
      </div>

      {/* Desktop: tab-alapú layout */}
      <div className="big-cases-layout big-cases-desktop-only">
        <nav className="big-cases-nav">
          {cases.map((c, i) => (
            <button
              key={c.id}
              className={`big-case-nav-item${i === selected ? ' active' : ''}${c.placeholder ? ' placeholder' : ''}`}
              onClick={() => setSelected(i)}
            >
              <div className="big-case-nav-eyebrow">{c.eyebrow}</div>
              <div className="big-case-nav-title">{c.title}</div>
              {c.responsible && <div className="big-case-nav-resp">/ {c.responsible}</div>}
            </button>
          ))}
        </nav>

        <div className="big-cases-detail">
          <div className="big-case-detail-header">
            <div className="big-case-eyebrow">{active.eyebrow}</div>
            <h3 className="big-case-title">
              {active.title}
              {active.responsible && (
                <span className="big-case-title-resp"> / {active.responsible}</span>
              )}
            </h3>
            <p className="big-case-summary">{active.summary}</p>
          </div>
          <CaseDetail c={active} />
        </div>
      </div>

      {/* Mobil: kártyás lista, az összes ügy egymás alatt */}
      <div className="big-cases-mobile-list">
        {cases.map((c, i) => (
          <div key={c.id} className={`big-case-mobile-card${c.placeholder ? ' placeholder' : ''}`}>
            <div className="big-case-mobile-num">/ {String(i + 1).padStart(2, '0')}</div>
            <div className="big-case-mobile-eyebrow">{c.eyebrow}</div>
            <h3 className="big-case-mobile-title">{c.title}</h3>
            {c.responsible && (
              <div className="big-case-mobile-resp">/ {c.responsible}</div>
            )}
            <p className="big-case-mobile-summary">{c.summary}</p>
            {c.statusItems && c.statusItems.map((s, j) => (
              <div key={j} className="big-case-mobile-status-row">
                <span>{s.icon}</span>
                <span className="big-case-mobile-status-label">{s.label}:</span>
                <span className="big-case-mobile-status-value">{s.value}</span>
              </div>
            ))}
            {c.moreUrl && (
              <Link href={c.moreUrl} className="big-case-mobile-more">
                A teljes ügy →
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
