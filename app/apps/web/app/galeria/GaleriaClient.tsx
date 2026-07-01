'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mugshot } from '@korr/ui/mugshot';

import { GALERIA, type GaleriaDetention, type GaleriaHair } from '../_home/galeria-config';

function photoSrc(url: string) {
  if (url.startsWith('/') || url.includes('wikimedia.org')) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

function GaleriaDetail({ entry }: { entry: typeof GALERIA[number] }) {
  return (
    <>
      <div className="gal-detail-mug">
        <div className={`rogue-mug-sm r-${entry.detention}`}>
          {entry.photoUrl ? (
            <img src={photoSrc(entry.photoUrl)} alt={entry.name} className="gal-photo" />
          ) : (
            <Mugshot
              caseId={entry.id}
              name={entry.name}
              variant={entry.variant ?? 0}
              glasses={entry.glasses ?? false}
              hair={(entry.hair as GaleriaHair) ?? 'short'}
              detention={entry.detention as GaleriaDetention}
            />
          )}
          <div className={`status-strip ${entry.detention}`}>{entry.detentionLabel}</div>
          {entry.photoCredit && (
            <div className="photo-credit">{entry.photoCredit}</div>
          )}
        </div>

        <div className="gal-detail-meta">
          <div className="gal-detail-name">{entry.name}</div>
          <div className="gal-detail-sub">{entry.subtitle}</div>
        </div>
      </div>

      <div className="gal-detail-body">
        <p className="gal-detail-desc">{entry.description}</p>
        <div className="gal-detail-tags">
          {entry.crimes.slice(0, 3).map(c => (
            <span key={c} className="tag">{c}</span>
          ))}
        </div>
        <div className="gal-detail-amount">
          <div className="gal-detail-amount-lbl">{entry.amountLabel}</div>
          <div className="gal-detail-amount-val">{entry.amount}</div>
        </div>
      </div>

      {entry.personCases && entry.personCases.length > 0 && (
        <div className="gal-cases">
          <div className="gal-cases-label">Feltárt ügyek és gyanúsítások</div>
          {entry.personCases.map((c, i) => (
            <div key={i} className="gal-case-row">
              <div className="gal-case-title">{c.title}</div>
              <p className="gal-case-desc">{c.description}</p>
              <div className="gal-case-footer">
                {c.estimatedDamage && (
                  <span className="gal-case-dmg">💰 {c.estimatedDamage}</span>
                )}
                <div className="gal-case-crimes">
                  {c.crimeTypes.map(cr => (
                    <span key={cr} className="tag tag-sm">{cr}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href={`/galeria/${entry.id}`} className="big-case-more-btn" style={{ marginTop: 24 }}>
        Részletek és tények: {entry.name} →
      </Link>
    </>
  );
}

export default function GaleriaClient() {
  const [selected, setSelected] = useState(0);
  const active = GALERIA[selected];

  if (!active) return null;

  return (
    <section className="rogues gal-page" id="galeria">
      <div className="rogues-inner">
        <div className="section-head">
          <div className="section-num">/ Galéria</div>
          <h2 className="section-title">10 kiemelt személy.</h2>
        </div>
        <p className="rogues-deck">
          Sajtójelentések és nyilvánosan hozzáférhető dokumentumok alapján. A státuszok
          a hiteles médiumok cikkei szerint frissülnek. Jogerős ítélet hiányában az
          érintett személyek ártatlannak tekintendők.
        </p>

        {/* Desktop: tab layout */}
        <div className="gal-layout gal-desktop-only">
          <nav className="gal-nav">
            {GALERIA.map((entry, i) => (
              <button
                key={entry.id}
                className={`gal-nav-item${i === selected ? ' active' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className={`dot ${entry.detention}`} style={{ marginRight: 8, flexShrink: 0 }} />
                <div className="gal-nav-text">
                  <div className="gal-nav-name">{entry.name}</div>
                  <div className="gal-nav-sub">{(entry.subtitle.split('·')[0] ?? '').trim()}</div>
                </div>
              </button>
            ))}
          </nav>
          <div className="gal-detail">
            <GaleriaDetail entry={active} />
          </div>
        </div>

        {/* Mobile: stacked layout */}
        <div className="gal-mobile-only">
          {GALERIA.map(entry => (
            <div key={entry.id} className="gal-mobile-entry">
              <GaleriaDetail entry={entry} />
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
