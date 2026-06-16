import Link from 'next/link';
import type { MediaClosure } from '@korr/db';

interface Props {
  closures: MediaClosure[];
}

const TYPE_COLOR: Record<string, string> = {
  'megszűnés': '#E31937',
  'leépítés': '#FF9D00',
  'elmaradt esemény': '#4B7AFF',
};

const TYPE_LABEL: Record<string, string> = {
  'megszűnés': '✕ Megszűnés',
  'leépítés': '↓ Leépítés',
  'elmaradt esemény': '⊘ Elmaradt',
};

export function MediaClosuresSection({ closures }: Props) {
  return (
    <div className="megszunt-section-wrap">
      <section className="section elszamoltatas-section">
        <div className="section-head">
          <div className="section-num">06 / Elszámoltatás</div>
          <h2 className="section-title">Megszűnt-e már?</h2>
        </div>
        <p className="elszamoltatas-deck">
          NER-közeli médiumok, műsorok és rendezvények, amelyek 2026. április 12.
          óta megszűntek, leépültek, vagy elmaradtak.
        </p>

        {closures.length === 0 ? (
          <div className="empty-state">Még nincs adat ebben a kategóriában.</div>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '32px' }}>
            <table className="elszamoltatas-table">
              <thead>
                <tr>
                  <th>Médium / Esemény</th>
                  <th>Típus</th>
                  <th>Dátum</th>
                </tr>
              </thead>
              <tbody>
                {closures.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.name}</td>
                    <td>
                      <span className="elszamoltatas-badge" style={{
                        backgroundColor: `${TYPE_COLOR[r.eventType] ?? '#666'}18`,
                        color: TYPE_COLOR[r.eventType] ?? '#666',
                      }}>
                        {TYPE_LABEL[r.eventType] ?? r.eventType}
                      </span>
                    </td>
                    <td style={{ color: '#666' }}>
                      {new Date(r.eventDate).toLocaleDateString('hu-HU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="elszamoltatas-more">
          <Link href="/megszunt">Tovább a teljes listához →</Link>
        </div>
      </section>
    </div>
  );
}
