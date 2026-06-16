import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';

export const revalidate = 120;

function typeLabel(t: string): string {
  if (t === 'lemondás') return '↓ Lemondás';
  if (t === 'kirúgás') return '✕ Kirúgás';
  if (t === 'felmentés') return '⟲ Felmentés';
  if (t === 'Hivatalban van') return '● Hivatalban van';
  return t;
}

function typeColor(t: string): string {
  if (t === 'lemondás') return '#4B7AFF';
  if (t === 'kirúgás') return '#E31937';
  if (t === 'felmentés') return '#FF9D00';
  if (t === 'Hivatalban van') return '#888';
  return '#666';
}

export default async function ResignationsPage() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.politicalResignations)
    .orderBy(desc(schema.politicalResignations.pinned), desc(schema.politicalResignations.resignationDate))
    .limit(100);

  return (
    <div className="news-section-wrap">
      <section className="section" id="resignations">
        <div className="section-head">
          <div className="section-num">/ Elszámoltatás</div>
          <h2 className="section-title">Lemondott-e már?</h2>
        </div>

        <p className="rogues-deck" style={{ marginTop: 24, marginBottom: 24, color: 'var(--ink)' }}>
          Lemondások, kirúgások és felmentések politikai személyeknél — AI által
          folyamatosan követve.
        </p>

        {rows.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 32 }}>
            Nincs adat.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 32 }}>
            <table style={{ width: '100%', fontSize: '14px', lineHeight: '1.6' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Dátum</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Státusz</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Név</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Pozíció</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Intézmény</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Leírás</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: '1px solid #f0f0f0',
                      backgroundColor: r.pinned ? '#fafafa' : undefined,
                    }}
                  >
                    <td style={{ padding: '12px', color: '#666', whiteSpace: 'nowrap' }}>
                      {r.pinned ? '—' : new Date(r.resignationDate).toLocaleDateString('hu-HU')}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: `${typeColor(r.resignationType)}20`,
                          color: typeColor(r.resignationType),
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {typeLabel(r.resignationType)}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 500 }}>{r.name}</td>
                    <td style={{ padding: '12px', color: '#666' }}>{r.position}</td>
                    <td style={{ padding: '12px', color: '#666' }}>{r.institution}</td>
                    <td style={{ padding: '12px', color: '#666', maxWidth: 320, fontSize: 13 }}>
                      {r.description ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
