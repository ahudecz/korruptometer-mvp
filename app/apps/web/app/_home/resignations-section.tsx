import Link from 'next/link';
import type { PoliticalResignation } from '@korr/db';

interface Props {
  resignations: PoliticalResignation[];
}

const TYPE_COLOR: Record<string, string> = {
  'lemondás': '#4B7AFF',
  'kirúgás': '#E31937',
  'felmentés': '#FF9D00',
  'Hivatalban van': '#888',
};

const TYPE_LABEL: Record<string, string> = {
  'lemondás': '↓ Lemondás',
  'kirúgás': '✕ Kirúgás',
  'felmentés': '⟲ Felmentés',
  'Hivatalban van': '● Hivatalban van',
};

export function ResignationsSection({ resignations }: Props) {
  return (
    <div className="lemondott-section-wrap">
    <section className="section elszamoltatas-section">
      <div className="section-head">
        <div className="section-num">05 / Elszámoltatás</div>
        <h2 className="section-title">Lemondott-e már?</h2>
      </div>
      <p className="elszamoltatas-deck">
        Április 12 óta történt lemondások és kirúgások politikai személyeknél.
        Intézmények, alapítványok és közszervezetek vezetői.
      </p>

      {resignations.length === 0 ? (
        <div className="empty-state">Még nincs adat ebben a kategóriában.</div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '32px' }}>
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
              {resignations.map((r) => (
                <tr key={r.id} style={{ backgroundColor: r.pinned ? '#fafafa' : undefined }}>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td style={{ color: '#666' }}>{r.position}</td>
                  <td style={{ color: '#666' }}>{r.institution}</td>
                  <td>
                    <span className="elszamoltatas-badge" style={{
                      backgroundColor: `${TYPE_COLOR[r.resignationType] ?? '#666'}18`,
                      color: TYPE_COLOR[r.resignationType] ?? '#666',
                    }}>
                      {TYPE_LABEL[r.resignationType] ?? r.resignationType}
                    </span>
                  </td>
                  <td style={{ color: '#666' }}>
                    {r.pinned ? '—' : new Date(r.resignationDate).toLocaleDateString('hu-HU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="elszamoltatas-more">
        <Link href="/resignations">Tovább a teljes listához →</Link>
      </div>
    </section>
    </div>
  );
}
