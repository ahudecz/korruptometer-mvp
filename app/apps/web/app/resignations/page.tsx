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

const cellStyle = { padding: '12px', color: '#666' } as const;

function Row({ r }: { r: Awaited<ReturnType<typeof fetchRows>>[number] }) {
  const color = typeColor(r.resignationType);
  return (
    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
      <td style={{ ...cellStyle, whiteSpace: 'nowrap' as const }}>
        {r.pinned ? '—' : new Date(r.resignationDate).toLocaleDateString('hu-HU')}
      </td>
      <td style={cellStyle}>
        <span style={{
          display: 'inline-block',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: `${color}20`,
          color,
          fontSize: '12px',
          fontWeight: 600,
        }}>
          {typeLabel(r.resignationType)}
        </span>
      </td>
      <td style={{ ...cellStyle, fontWeight: 500, color: 'var(--ink)' }}>{r.name}</td>
      <td style={cellStyle}>{r.position}</td>
      <td style={cellStyle}>{r.institution}</td>
      <td style={{ ...cellStyle, maxWidth: 320, fontSize: 13 }}>{r.description ?? '—'}</td>
    </tr>
  );
}

async function fetchRows() {
  const db = getDb();
  return db
    .select()
    .from(schema.politicalResignations)
    .orderBy(desc(schema.politicalResignations.pinned), desc(schema.politicalResignations.resignationDate))
    .limit(100);
}

const tableHead = (
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
);

export default async function ResignationsPage() {
  const rows = await fetchRows();
  const pinned = rows.filter(r => r.pinned);
  const rest = rows.filter(r => !r.pinned);

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
          <div className="empty-state" style={{ marginTop: 32 }}>Nincs adat.</div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div style={{ overflowX: 'auto', marginTop: 32 }}>
                <table style={{ width: '100%', fontSize: '14px', lineHeight: '1.6' }}>
                  {tableHead}
                  <tbody>
                    {pinned.map(r => <Row key={r.id} r={r} />)}
                  </tbody>
                </table>
              </div>
            )}

            {rest.length > 0 && (
              <>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  marginTop: '48px',
                  marginBottom: '16px',
                  paddingTop: '24px',
                  borderTop: '1px solid #e5e5e5',
                  color: 'var(--ink)',
                }}>
                  Legfrissebb lemondások, kirúgások és felmentések
                </h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '14px', lineHeight: '1.6' }}>
                    {tableHead}
                    <tbody>
                      {rest.map(r => <Row key={r.id} r={r} />)}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
