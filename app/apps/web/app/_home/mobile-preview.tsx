import * as React from 'react';
import type { PieSlice } from '@korr/ui/pie3d';

type MiniDonutProps = {
  slices: PieSlice[];
  palette: string[];
};

function MiniDonut({ slices, palette }: MiniDonutProps) {
  const total = slices.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (total === 0) return null;
  const cx = 30;
  const cy = 30;
  const rO = 28;
  const rI = 18;
  let angle = 0;
  return (
    <svg className="phone-mini-donut" viewBox="0 0 60 60">
      {slices.map((d, i) => {
        const span = (d.value / total) * 360;
        const a1 = angle;
        const a2 = angle + span;
        angle = a2;
        const r1 = ((a1 - 90) * Math.PI) / 180;
        const r2 = ((a2 - 90) * Math.PI) / 180;
        const sx = cx + rO * Math.cos(r2);
        const sy = cy + rO * Math.sin(r2);
        const ex = cx + rO * Math.cos(r1);
        const ey = cy + rO * Math.sin(r1);
        const sIx = cx + rI * Math.cos(r1);
        const sIy = cy + rI * Math.sin(r1);
        const eIx = cx + rI * Math.cos(r2);
        const eIy = cy + rI * Math.sin(r2);
        const large = a2 - a1 <= 180 ? 0 : 1;
        const dPath = `M ${sx} ${sy} A ${rO} ${rO} 0 ${large} 0 ${ex} ${ey} L ${sIx} ${sIy} A ${rI} ${rI} 0 ${large} 1 ${eIx} ${eIy} Z`;
        return <path key={i} d={dPath} fill={palette[i % palette.length] ?? '#ccc'} />;
      })}
    </svg>
  );
}

type CaseRow = {
  id: string;
  name: string;
  position: string;
  region: string;
  caseYear: number;
  amount: string;
};

type NewsRow = {
  id: string;
  headline: string;
  tag: string;
  time: string;
};

type Props = {
  topCases: CaseRow[];
  topNews: NewsRow[];
  kpiMoney: string;
  kpiYears: string;
  moneySlices: PieSlice[];
  prisonSlices: PieSlice[];
  moneyPalette: string[];
  prisonPalette: string[];
};

export function HomeMobilePreview({
  topCases,
  topNews,
  kpiMoney,
  kpiYears,
  moneySlices,
  prisonSlices,
  moneyPalette,
  prisonPalette,
}: Props) {
  return (
    <section className="mobile-section">
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div className="section-head">
          <div className="section-num">06 / Mobil</div>
          <h2 className="section-title">
            Zsebben hordható.
            <br />
            Bárhol elérhető.
          </h2>
        </div>

        <div className="mobile-stage">
          {/* Phone 1: Dashboard */}
          <div>
            <div className="phone">
              <div className="phone-screen">
                <div className="phone-screen-content">
                  <div className="phone-eyebrow">— Áttekintés —</div>
                  <div className="phone-title">
                    Számon
                    <br />
                    tartjuk őket.
                  </div>
                  <div className="phone-stat-row">
                    <div className="phone-stat">
                      <MiniDonut slices={moneySlices} palette={moneyPalette} />
                      <div className="v">{kpiMoney}</div>
                      <div className="l">Közpénz</div>
                    </div>
                    <div className="phone-stat">
                      <MiniDonut slices={prisonSlices} palette={prisonPalette} />
                      <div className="v">
                        {kpiYears} <small>év</small>
                      </div>
                      <div className="l">Börtön</div>
                    </div>
                  </div>
                  <div className="phone-search">Keresés…</div>
                  {topCases.map((c) => (
                    <div className="phone-list-item" key={c.id}>
                      <div>
                        <div className="ln">{c.name}</div>
                        <div className="lp">{c.position}</div>
                      </div>
                      <div className="lv">{c.amount}</div>
                    </div>
                  ))}
                </div>
                <div className="phone-tabbar">
                  <span className="active">Áttekintés</span>
                  <span>Adatbázis</span>
                  <span>Hírek</span>
                  <span>Profil</span>
                </div>
              </div>
            </div>
            <div className="phone-caption">01 / Áttekintés</div>
          </div>

          {/* Phone 2: Database */}
          <div>
            <div className="phone">
              <div className="phone-screen">
                <div className="phone-screen-content">
                  <div className="phone-eyebrow">— Adatbázis —</div>
                  <div className="phone-title">{topCases.length} ügy</div>
                  <div className="phone-search">Név, pozíció…</div>
                  <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 8,
                        padding: '4px 8px',
                        background: 'var(--ink)',
                        color: '#fff',
                        borderRadius: 999,
                        fontWeight: 600,
                      }}
                    >
                      Vádemelés
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        padding: '4px 8px',
                        background: '#f0f0f0',
                        color: 'var(--ink)',
                        borderRadius: 999,
                        fontWeight: 600,
                      }}
                    >
                      Budapest
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        padding: '4px 8px',
                        background: '#f0f0f0',
                        color: 'var(--ink)',
                        borderRadius: 999,
                        fontWeight: 600,
                      }}
                    >
                      ≥1 Mrd
                    </span>
                  </div>
                  {topCases.map((c) => (
                    <div className="phone-list-item" key={c.id}>
                      <div>
                        <div className="ln">{c.name}</div>
                        <div className="lp">
                          {c.caseYear} · {c.region}
                        </div>
                      </div>
                      <div className="lv">{c.amount}</div>
                    </div>
                  ))}
                </div>
                <div className="phone-tabbar">
                  <span>Áttekintés</span>
                  <span className="active">Adatbázis</span>
                  <span>Hírek</span>
                  <span>Profil</span>
                </div>
              </div>
            </div>
            <div className="phone-caption">02 / Adatbázis</div>
          </div>

          {/* Phone 3: News */}
          <div>
            <div className="phone">
              <div className="phone-screen">
                <div className="phone-screen-content">
                  <div className="phone-eyebrow">— Hírfolyam —</div>
                  <div className="phone-title">Mai friss.</div>
                  {topNews.map((n) => (
                    <div className="phone-news-card" key={n.id}>
                      <div className="ph-time">
                        {n.tag} · {n.time}
                      </div>
                      <div className="ph-h">{n.headline}</div>
                    </div>
                  ))}
                </div>
                <div className="phone-tabbar">
                  <span>Áttekintés</span>
                  <span>Adatbázis</span>
                  <span className="active">Hírek</span>
                  <span>Profil</span>
                </div>
              </div>
            </div>
            <div className="phone-caption">03 / Hírek</div>
          </div>
        </div>
      </div>
    </section>
  );
}
