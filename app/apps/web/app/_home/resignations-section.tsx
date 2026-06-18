import Link from 'next/link';
import type { PoliticalResignation } from '@korr/db';
import { WatchlistGrid } from './watchlist-grid';

interface Props {
  resignations: PoliticalResignation[];
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

function ResignationRow({ r }: { r: PoliticalResignation }) {
  const color = TYPE_COLOR[r.resignationType] ?? '#666';
  return (
    <tr key={r.id}>
      <td style={{ fontWeight: 500 }}>{r.name}</td>
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
    </tr>
  );
}

export function ResignationsSection({ resignations }: Props) {
  const rest = resignations.filter(r => !r.pinned);

  return (
    <div className="lemondott-section-wrap">
    <section className="section elszamoltatas-section">
      <div className="section-head">
        <div className="section-num">05 / Elszámoltatás</div>
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
          <div className="res-table-wrap">
            <table className="elszamoltatas-table">
              <thead>
                <tr>
                  <th>Név</th>
                  <th>Pozíció</th>
                  <th>Intézmény</th>
                  <th>Státusz</th>
                  <th>Dátum</th>
                </tr>
              </thead>
              <tbody>
                {rest.map(r => <ResignationRow key={r.id} r={r} />)}
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
