'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mugshot } from '@korr/ui/mugshot';

import { GALERIA, type GaleriaDetention, type GaleriaHair } from '../_home/galeria-config';

const DETENTION_LABELS: Record<string, string> = {
  busted: 'Jogerősen elítélve',
  pretrial: 'Előzetes letartóztatásban',
  investig: 'Feljelentés / nyomozás',
  loose: 'Nincs ismert eljárás',
  wanted: 'Körözési parancs kiadva',
};

export default function GaleriaPage() {
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

        <div className="gal-layout">
          {/* Left nav */}
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

          {/* Right detail */}
          <div className="gal-detail">
            <div className="gal-detail-mug">
              <div className={`rogue-mug-sm r-${active.detention}`}>
                {active.photoUrl ? (
                  <img src={active.photoUrl.startsWith('/') || active.photoUrl.includes('wikimedia.org') ? active.photoUrl : `/api/img-proxy?url=${encodeURIComponent(active.photoUrl)}`} alt={active.name} className="gal-photo" />
                ) : (
                  <Mugshot
                    caseId={active.id}
                    name={active.name}
                    variant={active.variant ?? 0}
                    glasses={active.glasses ?? false}
                    hair={(active.hair as GaleriaHair) ?? 'short'}
                    detention={active.detention as GaleriaDetention}
                  />
                )}
                <div className={`status-strip ${active.detention}`}>{active.detentionLabel}</div>
                {active.photoCredit && (
                  <div className="photo-credit">Fotó: {active.photoCredit}</div>
                )}
              </div>

              <div className="gal-detail-meta">
                <div className="gal-detail-name">{active.name}</div>
                <div className="gal-detail-sub">{active.subtitle}</div>
                <p className="gal-detail-desc">{active.description}</p>

                <div className="gal-detail-tags">
                  {active.crimes.slice(0, 3).map(c => (
                    <span key={c} className="tag">{c}</span>
                  ))}
                </div>

                <div className="gal-detail-amount">
                  <div className="gal-detail-amount-lbl">{active.amountLabel}</div>
                  <div className="gal-detail-amount-val">{active.amount}</div>
                </div>
              </div>
            </div>

            {active.personCases && active.personCases.length > 0 && (
              <div className="gal-cases">
                <div className="gal-cases-label">Feltárt ügyek és gyanúsítások</div>
                {active.personCases.map((c, i) => (
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

            <Link href={`/galeria/${active.id}`} className="big-case-more-btn" style={{ marginTop: 24 }}>
              Részletek és tények: {active.name} →
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
