'use client';

import { useState } from 'react';
import Link from 'next/link';

import { UGYEK } from '../_home/ugyek-config';
import { GALERIA } from '../_home/galeria-config';

function imgSrc(url: string): string {
  if (url.startsWith('/') || url.includes('wikimedia.org')) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

export default function UgyekPage() {
  const [selected, setSelected] = useState(0);
  const active = UGYEK[selected];

  if (!active) return null;

  const galeriaEntry = active.responsibleGaleriaId
    ? GALERIA.find(e => e.id === active.responsibleGaleriaId)
    : null;

  const photoUrl = galeriaEntry?.photoUrl ?? active.photo;
  const photoCredit = galeriaEntry?.photoCredit ?? active.photoCredit;
  const photoPosition = active.photoPosition;
  const isZsoltBacsi = active.id === 'zsolt-bacsi';
  const initials = active.responsible?.split(' ').slice(0, 2).map((w: string) => w[0]).join('') ?? '?';
  const badgeColor = active.eyebrow.toLowerCase().includes('aktív') ? '#e31937'
    : active.eyebrow.toLowerCase().includes('vizsgálóbizottság') ? '#1d4ed8'
    : '#4a6a8a';

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

        <div className="gal-layout">
          {/* Left nav */}
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

          {/* Right detail */}
          <div className="gal-detail">
            <div className="gal-detail-mug">
              <div className="rogue-mug-sm">
                {photoUrl ? (
                  <img
                    src={imgSrc(photoUrl)}
                    alt={active.responsible ?? active.title}
                    className="gal-photo"
                    style={photoPosition ? { objectPosition: photoPosition } : undefined}
                  />
                ) : (
                  <div className="person-photo-placeholder">
                    <span>{isZsoltBacsi ? '?' : initials}</span>
                  </div>
                )}
                <div className="status-strip" style={{ background: badgeColor, color: '#fff' }}>
                  {active.eyebrow.split('·')[0].trim()}
                </div>
                {photoCredit && (
                  <div className="photo-credit">Fotó: {photoCredit}</div>
                )}
              </div>

              <div>
                <div className="gal-detail-name">{active.title}</div>
                {active.responsible && (
                  <div className="gal-detail-sub">{active.responsible}</div>
                )}
                {active.estimatedDamage && (
                  <div className="gal-detail-amount">
                    <div className="gal-detail-amount-lbl">Becsült kár</div>
                    <div className="gal-detail-amount-val">{active.estimatedDamage}</div>
                  </div>
                )}
                {active.crimeTypes && active.crimeTypes.length > 0 && (
                  <div className="gal-detail-tags" style={{ marginTop: 12 }}>
                    {active.crimeTypes.slice(0, 3).map(c => (
                      <span key={c} className="tag tag-sm">{c}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p className="gal-detail-desc" style={{ marginTop: 20 }}>{active.summary}</p>

            <div className="ugyek-status-rows">
              {active.statusItems.map((s, i) => (
                <div key={i} className="ugyek-status-row">
                  <span className="ugyek-status-icon">{s.icon}</span>
                  <span className="ugyek-status-label">{s.label}</span>
                  <span className="ugyek-status-value">{s.value}</span>
                </div>
              ))}
            </div>

            <Link href={`/ugyek/${active.id}`} className="big-case-more-btn" style={{ marginTop: 24 }}>
              Teljes ügy: {active.title} →
            </Link>
          </div>
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
