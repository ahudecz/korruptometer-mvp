'use client';

import { useState } from 'react';
import Link from 'next/link';

import { UGYEK } from '../_home/ugyek-config';
import { GALERIA } from '../_home/galeria-config';

function imgSrc(url: string): string {
  if (url.startsWith('/') || url.includes('wikimedia.org')) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

function UgyekDetail({ entry }: { entry: typeof UGYEK[number] }) {
  const galeriaEntry = entry.responsibleGaleriaId
    ? GALERIA.find(e => e.id === entry.responsibleGaleriaId)
    : null;

  const photoUrl = galeriaEntry?.photoUrl ?? entry.photo;
  const photoCredit = galeriaEntry?.photoCredit ?? entry.photoCredit;
  const isZsoltBacsi = entry.id === 'zsolt-bacsi';
  const initials = entry.responsible?.split(' ').slice(0, 2).map((w: string) => w[0]).join('') ?? '?';
  const badgeColor = entry.eyebrow.toLowerCase().includes('aktív') ? '#e31937'
    : entry.eyebrow.toLowerCase().includes('vizsgálóbizottság') ? '#1d4ed8'
    : '#4a6a8a';

  return (
    <>
      <div className={`gal-detail-mug${photoUrl ? '' : ' no-photo'}`}>
        <div className="rogue-mug-sm">
          {photoUrl ? (
            <img
              src={imgSrc(photoUrl)}
              alt={entry.responsible ?? entry.title}
              className="gal-photo"
              style={entry.photoPosition ? { objectPosition: entry.photoPosition } : undefined}
            />
          ) : (
            <div className="person-photo-placeholder">
              <span>{isZsoltBacsi ? '?' : initials}</span>
            </div>
          )}
          <div className="status-strip" style={{ background: badgeColor, color: '#fff' }}>
            {(entry.eyebrow.split('·')[0] ?? '').trim()}
          </div>
          {photoCredit && (
            <div className="photo-credit">{photoCredit}</div>
          )}
        </div>

        <div>
          <div className="gal-detail-name">{entry.title}</div>
          {entry.responsible && (
            <div className="gal-detail-sub">{entry.responsible}</div>
          )}
        </div>
      </div>

      <div className="gal-detail-body">
        {entry.estimatedDamage && (
          <div className="gal-detail-amount">
            <div className="gal-detail-amount-lbl">Becsült kár</div>
            <div className="gal-detail-amount-val">{entry.estimatedDamage}</div>
          </div>
        )}
        {entry.crimeTypes && entry.crimeTypes.length > 0 && (
          <div className="gal-detail-tags" style={{ marginTop: 12 }}>
            {entry.crimeTypes.slice(0, 3).map(c => (
              <span key={c} className="tag tag-sm">{c}</span>
            ))}
          </div>
        )}
        <p className="gal-detail-desc">{entry.summary}</p>

        <div className="ugyek-status-rows">
          {entry.statusItems.map((s, i) => (
            <div key={i} className="ugyek-status-row">
              <span className="ugyek-status-icon">{s.icon}</span>
              <span className="ugyek-status-label">{s.label}</span>
              <span className="ugyek-status-value">{s.value}</span>
            </div>
          ))}
        </div>

        <Link href={`/ugyek/${entry.id}`} className="big-case-more-btn" style={{ marginTop: 24 }}>
          Teljes ügy: {entry.title} →
        </Link>
      </div>
    </>
  );
}

export default function UgyekClient() {
  const [selected, setSelected] = useState(0);
  const active = UGYEK[selected];

  if (!active) return null;

  return (
    <section className="rogues gal-page ugyek-page" id="ugyek">
      <div className="rogues-inner">
        <div className="section-head">
          <div className="section-num">/ Legdurvább ügyek</div>
          <h2 className="section-title">Kiemelt ügyek.</h2>
        </div>
        <p className="rogues-deck">
          Sajtójelentések és nyilvánosan hozzáférhető dokumentumok alapján. Jogerős ítélet
          hiányában az érintett személyek ártatlannak tekintendők.
        </p>

        {/* Desktop: tab layout */}
        <div className="gal-layout gal-desktop-only">
          <nav className="gal-nav">
            {UGYEK.map((entry, i) => (
              <button
                key={entry.id}
                className={`gal-nav-item${i === selected ? ' active' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className="ugyek-nav-dot" />
                <div className="gal-nav-text">
                  <div className="gal-nav-name">{entry.title}</div>
                  <div className="gal-nav-sub">{entry.responsible ?? entry.eyebrow}</div>
                </div>
              </button>
            ))}
          </nav>
          <div className="gal-detail">
            <UgyekDetail entry={active} />
          </div>
        </div>

        {/* Mobile: stacked layout */}
        <div className="gal-mobile-only">
          {UGYEK.map(entry => (
            <div key={entry.id} className="ugyek-mobile-entry">
              <UgyekDetail entry={entry} />
            </div>
          ))}
        </div>

        <p className="rogues-disclaimer">
          * Az adatok hiteles médiumok (Telex, 444, HVG, Direkt36, Átlátszó) nyilvánosan
          hozzáférhető cikkein és dokumentumain alapulnak. A státuszok jogerős ítéletet nem
          pótolnak. Jogerős ítélet hiányában az érintett személyek ártatlannak tekintendők.
        </p>
      </div>
    </section>
  );
}
