import Link from 'next/link';
import type { PoliticalResignation } from '@korr/db';
import { findBreakingForName, type BreakingArticle } from '@/lib/breaking';
import { WatchlistGrid } from './watchlist-grid';

interface Props {
  resignations: PoliticalResignation[];
  breaking?: BreakingArticle[];
}

const TYPE_COLOR: Record<string, string> = {
  'lemondás': '#4B7AFF',
  'kirúgás': '#E31937',
  'felmentés': '#FF9D00',
};

const TYPE_LABEL: Record<string, string> = {
  'lemondás': '↓ Lemondás',
  'kirúgás': '✕ Kirúgás',
  'felmentés': '⟲ Felmentés',
};

function ResignationRow({ r, breakingArticle }: { r: PoliticalResignation; breakingArticle?: BreakingArticle | null }) {
  const color = TYPE_COLOR[r.resignationType] ?? '#666';
  return (
    <tr key={r.id} className={breakingArticle ? 'res-row-breaking' : undefined}>
      <td style={{ fontWeight: 500 }}>
        {r.name}
        {breakingArticle && (
          <a
            href={breakingArticle.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="res-breaking-inline"
          >
            <span className="res-breaking-dot" />
            BREAKING
          </a>
        )}
      </td>
      <td style={{ color: '#666' }}>{r.position}</td>
      <td style={{ color: '#666' }}>{r.institution}</td>
      <td>
        <span className="elszamoltatas-badge" style={{
          backgroundColor: `${color}18`,
          color,
        }}>
          {TYPE_LABEL[r.resignationType] ?? r.resignationType}
        </span>
      </td>
      <td style={{ color: '#666' }}>
        {new Date(r.resignationDate).toLocaleDateString('hu-HU')}
      </td>
      <td>
        {r.sourceUrls?.[0] ? (
          <a href={r.sourceUrls[0]} target="_blank" rel="noopener noreferrer" className="res-source-link">
            {r.sourceNames?.[0] ?? 'Forrás'} →
          </a>
        ) : '—'}
      </td>
    </tr>
  );
}

export function ResignationsSection({ resignations, breaking = [] }: Props) {
  // Ugyanaz a `pinned`-szűrő volt itt is, mint a /lemondasok végoldalon
  // (fix: c6cd14b) — külön render call site, külön hely, ugyanaz a bug,
  // ugyanaz a fix (2026-07-18, user report).
  const rest = resignations;

  return (
    <div className="lemondott-section-wrap">
    <section className="section elszamoltatas-section">
      <div className="section-head">
        <div className="section-num">02 / Személyi változások</div>
        <h2 className="section-title">Lemondott-e már?</h2>
      </div>
      <p className="elszamoltatas-deck">
        Magyar Péter lemondásra szólította fel a NER kulcsintézményeinek vezetőit — ha valamelyikük
        távozik, a kártyáján megjelenik. Lemondásra szólította fel Sulyok Tamás köztársasági elnököt,
        valamint azokat, akiket ő a rendszer tartóoszlopainak nevez: a Kúria elnökét, az
        Alkotmánybíróság elnökét, a legfőbb ügyészt, az Állami Számvevőszék elnökét, a Gazdasági
        Versenyhivatal elnökét, a Médiahatóság elnökét és az Országos Bírói Hivatal elnökét.
      </p>

      <WatchlistGrid />

      {rest.length > 0 && (
        <>
          <h3 className="elszamoltatas-sub-heading">
            Legfrissebb lemondások, kirúgások és felmentések
          </h3>
          <p className="elszamoltatas-deck" style={{ marginBottom: 24 }}>
            Itt dokumentáljuk a NER összeomlásával távozó, kirúgott és felmentett embereket —
            köztisztviselőket, propagandistákat és mindenkit, aki a rendszer szekerét tolta,
            és most mennie kellett.
          </p>
          <div className="res-table-wrap">
            <table className="elszamoltatas-table">
              <thead>
                <tr>
                  <th>Név</th>
                  <th>Pozíció</th>
                  <th>Intézmény</th>
                  <th>Státusz</th>
                  <th>Dátum</th>
                  <th>Forrás</th>
                </tr>
              </thead>
              <tbody>
                {rest.map(r => <ResignationRow key={r.id} r={r} breakingArticle={findBreakingForName(r.name, breaking)} />)}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="elszamoltatas-more">
        <Link href="/lemondasok">Tovább a teljes listához →</Link>
      </div>
    </section>
    </div>
  );
}
