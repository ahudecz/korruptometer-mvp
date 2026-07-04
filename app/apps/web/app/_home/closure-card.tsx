'use client';

import React from 'react';
import { findOutletLogo, outletLogoSrc } from './media-config';

const HU_MONTHS_SHORT = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtShortDate(d: Date): string {
  return `${HU_MONTHS_SHORT[d.getMonth()]} ${d.getDate()}.`;
}

const CLOSURE_STATUS_CLASS: Record<string, string> = {
  'megszűnés': 'closure-card--closed',
  'leépítés': 'closure-card--fired',
  'elmaradt esemény': 'closure-card--pending',
};

const CLOSURE_STAMP: Record<string, string> = {
  'megszűnés': 'MEGSZŰNT',
  'leépítés': 'LEÉPÍTÉS',
  'elmaradt esemény': 'ELMARADT',
};

// Az esemény típusa dönti el, minek a dátumát mutatjuk a lábléc-blokkban —
// leépítésnél nem "megszűnés dátuma", hanem "leépítés dátuma".
const CLOSURE_DATE_LABEL: Record<string, string> = {
  'megszűnés': 'Megszűnés dátuma',
  'leépítés': 'Leépítés dátuma',
  'elmaradt esemény': 'Esemény dátuma',
};

export type ClosureCardData = { name: string; eventType: string; eventDate: Date; sourceUrl: string | null; sourceName: string | null };

export function MiniClosureCard({ name, eventType, eventDate, sourceUrl, sourceName }: ClosureCardData) {
  const statusClass = CLOSURE_STATUS_CLASS[eventType] ?? 'closure-card--closed';
  const outlet = findOutletLogo(name);
  const logo = outlet ? outletLogoSrc(outlet) : null;
  const imgStyle: React.CSSProperties = outlet?.logoScale
    ? { transform: `scale(${outlet.logoScale})`, objectFit: 'cover', padding: 0 }
    : {};
  const inner = (
    <>
      <div className={`closure-card-visual${outlet?.logoBgWhite ? ' bg-white' : ''}`}>
        {logo ? (
          <img
            src={logo}
            alt={name}
            loading="lazy"
            style={imgStyle}
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = 'none';
              const sib = el.nextElementSibling as HTMLElement | null;
              if (sib?.classList.contains('closure-card-mono-fallback')) sib.style.display = '';
            }}
          />
        ) : null}
        <span className={`closure-card-mono${logo ? ' closure-card-mono-fallback' : ''}`} style={logo ? { display: 'none' } : undefined}>
          {name.slice(0, 2).toUpperCase()}
        </span>
        <div className="closure-card-stamp">{CLOSURE_STAMP[eventType] ?? 'VÁLTOZÁS'}</div>
      </div>
      <div className="closure-card-name">{name}</div>
      <div className="closure-card-type">{eventType}</div>
      <div className="closure-card-foot">
        <span className="lbl">{CLOSURE_DATE_LABEL[eventType] ?? 'Dátum'}</span>
        <span className="val">{fmtShortDate(eventDate)}</span>
      </div>
      {sourceUrl && <span className="closure-card-link">{sourceName ?? 'Forrás'} →</span>}
    </>
  );
  return sourceUrl ? (
    <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className={`closure-card ${statusClass}`}>
      {inner}
    </a>
  ) : (
    <div className={`closure-card ${statusClass}`}>{inner}</div>
  );
}
