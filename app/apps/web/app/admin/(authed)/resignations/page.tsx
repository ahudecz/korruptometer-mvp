import { desc } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

import { ResignationDeleteButton } from './resignation-delete-button';

export const dynamic = 'force-dynamic';

function typeLabel(t: string): string {
  if (t === 'lemondás') return '↓ Lemondás';
  if (t === 'kirúgás') return '✕ Kirúgás';
  if (t === 'felmentés') return '⟲ Felmentés';
  return t;
}

function typeColor(t: string): string {
  if (t === 'lemondás') return '#4B7AFF';
  if (t === 'kirúgás') return '#E31937';
  if (t === 'felmentés') return '#FF9D00';
  return '#666';
}

export default async function ResignationsAdminPage() {
  await requireAdmin();
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.politicalResignations)
    .orderBy(desc(schema.politicalResignations.resignationDate));

  const counts = {
    total: rows.length,
    lemondas: rows.filter((r) => r.resignationType === 'lemondás').length,
    kirugás: rows.filter((r) => r.resignationType === 'kirúgás').length,
    felmentés: rows.filter((r) => r.resignationType === 'felmentés').length,
  };

  return (
    <>
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Adminisztráció · Elszámoltatás</div>
          <h1 className="admin-title">Politikai lemondások</h1>
          <p className="admin-sub">
            AI által automatikusan detektált lemondások, kirúgások és felmentések.
            Törlés esetén az adott sor véglegesen eltávolításra kerül.
          </p>
        </div>
      </header>

      <section className="stat-ribbon" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-cell">
          <span className="label">Összes</span>
          <span className="value">{counts.total.toLocaleString('hu-HU')}</span>
          <span className="delta">rögzített esemény</span>
        </div>
        <div className="stat-cell">
          <span className="label">Lemondás</span>
          <span className="value">{counts.lemondas.toLocaleString('hu-HU')}</span>
          <span className="delta">önkéntes</span>
        </div>
        <div className="stat-cell is-accent">
          <span className="label">Kirúgás</span>
          <span className="value">{counts.kirugás.toLocaleString('hu-HU')}</span>
          <span className="delta">kívülről</span>
        </div>
        <div className="stat-cell">
          <span className="label">Felmentés</span>
          <span className="value">{counts.felmentés.toLocaleString('hu-HU')}</span>
          <span className="delta">formális</span>
        </div>
      </section>

      <section className="detail-section" style={{ padding: '28px 0', borderBottom: 0 }}>
        {rows.length === 0 ? (
          <div className="empty-state">Még nincs rögzített esemény.</div>
        ) : (
          <table className="case-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Dátum</th>
                <th>Típus</th>
                <th>Név</th>
                <th>Pozíció</th>
                <th>Intézmény</th>
                <th>Leírás</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="Dátum" style={{ whiteSpace: 'nowrap', fontSize: 13, color: '#666' }}>
                    {new Date(r.resignationDate).toLocaleDateString('hu-HU')}
                  </td>
                  <td data-label="Típus">
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 7px',
                        borderRadius: '4px',
                        backgroundColor: `${typeColor(r.resignationType)}20`,
                        color: typeColor(r.resignationType),
                        fontSize: '12px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {typeLabel(r.resignationType)}
                    </span>
                  </td>
                  <td data-label="Név" style={{ fontWeight: 500 }}>{r.name}</td>
                  <td data-label="Pozíció" style={{ fontSize: 13, color: '#666' }}>{r.position}</td>
                  <td data-label="Intézmény" style={{ fontSize: 13, color: '#666' }}>{r.institution}</td>
                  <td data-label="Leírás" style={{ fontSize: 12, color: '#666', maxWidth: 280 }}>
                    {r.description ?? '—'}
                  </td>
                  <td>
                    <ResignationDeleteButton id={r.id} name={r.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
