import { asc } from 'drizzle-orm';

import { fmtDate } from '@korr/shared/format';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

import { EditorsForm } from './editors-form';

export const dynamic = 'force-dynamic';

export default async function EditorsPage() {
  await requireAdmin();
  const db = getDb();
  const rows = await db.select().from(schema.editors).orderBy(asc(schema.editors.email));

  return (
    <>
      <h3 style={{ marginTop: 16 }}>Szerkesztők ({rows.length})</h3>
      <p className="lede">
        Csak <strong>admin</strong> szerepkörrel látható és módosítható. A
        bejelentkezéshez varázs-link szolgál; a passkey-step-up Phase-2
        elkövetkező csomagban érkezik.
      </p>

      <EditorsForm />

      <table className="case-table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>E-mail</th>
            <th>Név</th>
            <th>Szerep</th>
            <th>Aktív?</th>
            <th>Felvéve</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td data-label="E-mail">{e.email}</td>
              <td data-label="Név">{e.displayName ?? '—'}</td>
              <td data-label="Szerep">
                <span className="pill">{e.role}</span>
              </td>
              <td data-label="Aktív?">{e.active ? 'igen' : 'nem'}</td>
              <td data-label="Felvéve">{fmtDate(e.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
