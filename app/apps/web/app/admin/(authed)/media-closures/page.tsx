import { desc } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

import { MediaClosureDeleteButton } from './media-closure-delete-button';

export const dynamic = 'force-dynamic';

function typeLabel(t: string): string {
  if (t === 'megszűnés') return '✕ Megszűnés';
  if (t === 'leépítés') return '↓ Leépítés';
  if (t === 'elmaradt esemény') return '⊘ Elmaradt esemény';
  return t;
}

function typeColor(t: string): string {
  if (t === 'megszűnés') return '#E31937';
  if (t === 'leépítés') return '#FF9D00';
  if (t === 'elmaradt esemény') return '#4B7AFF';
  return '#666';
}

export default async function MediaClosuresAdminPage() {
  await requireAdmin();
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.mediaClosures)
    .orderBy(desc(schema.mediaClosures.eventDate));

  const counts = {
    total: rows.length,
    megszunes: rows.filter((r) => r.eventType === 'megszűnés').length,
    leepites: rows.filter((r) => r.eventType === 'leépítés').length,
    elmaradt: rows.filter((r) => r.eventType === 'elmaradt esemény').length,
  };

  return (
    <>
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Adminisztráció · Elszámoltatás</div>
          <h1 className="admin-title">Megszűnt-e már?</h1>
          <p className="admin-sub">
            NER-közeli médiumok, műsorok és rendezvények 2026. április 12. óta.
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
        <div className="stat-cell is-accent">
          <span className="label">Megszűnés</span>
          <span className="value">{counts.megszunes.toLocaleString('hu-HU')}</span>
          <span className="delta">végleg</span>
        </div>
        <div className="stat-cell">
          <span className="label">Leépítés</span>
          <span className="value">{counts.leepites.toLocaleString('hu-HU')}</span>
          <span className="delta">elbocsátások</span>
        </div>
        <div className="stat-cell">
          <span className="label">Elmaradt esemény</span>
          <span className="value">{counts.elmaradt.toLocaleString('hu-HU')}</span>
          <span className="delta">törölt</span>
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
                <th>Médium / Esemény</th>
                <th>Leírás</th>
                <th>Forrás</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="Dátum" style={{ whiteSpace: 'nowrap', fontSize: 13, color: '#666' }}>
                    {new Date(r.eventDate).toLocaleDateString('hu-HU')}
                  </td>
                  <td data-label="Típus">
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 7px',
                        borderRadius: '4px',
                        backgroundColor: `${typeColor(r.eventType)}20`,
                        color: typeColor(r.eventType),
                        fontSize: '12px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {typeLabel(r.eventType)}
                    </span>
                  </td>
                  <td data-label="Médium" style={{ fontWeight: 500 }}>{r.name}</td>
                  <td data-label="Leírás" style={{ fontSize: 12, color: '#666', maxWidth: 300 }}>
                    {r.description ?? '—'}
                  </td>
                  <td data-label="Forrás" style={{ fontSize: 12 }}>
                    {r.sourceUrl ? (
                      <a
                        href={r.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                      >
                        {r.sourceName ?? 'Forrás'}
                      </a>
                    ) : (
                      <span style={{ color: '#999' }}>{r.sourceName ?? '—'}</span>
                    )}
                  </td>
                  <td>
                    <MediaClosureDeleteButton id={r.id} name={r.name} />
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
