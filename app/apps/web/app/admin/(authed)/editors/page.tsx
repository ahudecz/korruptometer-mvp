import { asc } from 'drizzle-orm';

import { fmtDate } from '@korr/shared/format';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

import { EditorsForm } from './editors-form';

export const dynamic = 'force-dynamic';

type Role = 'admin' | 'editor';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  editor: 'Szerkesztő',
};

export default async function EditorsPage() {
  await requireAdmin();
  const db = getDb();
  const rows = await db.select().from(schema.editors).orderBy(asc(schema.editors.email));

  const adminCount = rows.filter((e) => e.role === 'admin').length;
  const editorCount = rows.filter((e) => e.role === 'editor').length;
  const inactiveCount = rows.filter((e) => !e.active).length;

  return (
    <>
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Adminisztráció · Hozzáférés</div>
          <h1 className="admin-title">Szerkesztők</h1>
          <p className="admin-sub">
            Csak <strong>admin</strong> szerepkörrel látható és módosítható. A
            bejelentkezéshez varázs-link szolgál; a passkey-step-up Phase-2
            elkövetkező csomagban érkezik.
          </p>
        </div>
      </header>

      <section className="stat-ribbon" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-cell">
          <span className="label">Összes szerkesztő</span>
          <span className="value">{rows.length.toLocaleString('hu-HU')}</span>
          <span className="delta">felhasználói rekord összesen</span>
        </div>
        <div className="stat-cell is-accent">
          <span className="label">Admin</span>
          <span className="value">{adminCount.toLocaleString('hu-HU')}</span>
          <span className="delta">teljes hozzáférésű felhasználó</span>
        </div>
        <div className="stat-cell">
          <span className="label">Szerkesztő</span>
          <span className="value">{editorCount.toLocaleString('hu-HU')}</span>
          <span className="delta">olvasói + döntés-jog</span>
        </div>
        <div className="stat-cell">
          <span className="label">Inaktív</span>
          <span className="swatch s-rejected" />
          <span className="value">{inactiveCount.toLocaleString('hu-HU')}</span>
          <span className="delta">bejelentkezni nem tud</span>
        </div>
      </section>

      <section className="detail-section" style={{ padding: '28px 0', borderBottom: 0 }}>
        <h4>Új szerkesztő felvétele</h4>
        <EditorsForm />
      </section>

      <section className="detail-section" style={{ padding: '0 0 60px', borderBottom: 0 }}>
        <h4>
          Allowlist <span className="aside">{rows.length} db · ABC-rendben</span>
        </h4>
        <table className="case-table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Név</th>
              <th>Szerep</th>
              <th>Állapot</th>
              <th>Felvéve</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const role = e.role as Role;
              return (
                <tr key={e.id}>
                  <td
                    data-label="E-mail"
                    style={{ fontFamily: 'Archivo Narrow, monospace', fontSize: 13 }}
                  >
                    {e.email}
                  </td>
                  <td data-label="Név">{e.displayName ?? '—'}</td>
                  <td data-label="Szerep">
                    <span className={`tag${role === 'admin' ? '' : ''}`} style={role === 'admin' ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: '#f7c8d0' } : undefined}>
                      {ROLE_LABEL[role] ?? role}
                    </span>
                  </td>
                  <td data-label="Állapot">
                    <span className={`state-badge ${e.active ? 'approved' : 'rejected'}`}>
                      <span className="dot" />
                      {e.active ? 'Aktív' : 'Letiltva'}
                    </span>
                  </td>
                  <td data-label="Felvéve">{fmtDate(e.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
