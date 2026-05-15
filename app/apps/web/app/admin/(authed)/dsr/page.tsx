import { desc, sql } from 'drizzle-orm';

import { fmtDate } from '@korr/shared/format';
import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

import { DsrIntakeForm } from './dsr-form';

export const dynamic = 'force-dynamic';

type DsrStatus = 'received' | 'verified' | 'fulfilled' | 'closed';
type DsrKind = 'access' | 'deletion';

const STATUS_LABEL: Record<DsrStatus, string> = {
  received: 'Beérkezett',
  verified: 'Igazolt',
  fulfilled: 'Teljesítve',
  closed: 'Lezárva',
};

const STATUS_BADGE: Record<DsrStatus, 'pending' | 'approved' | 'rejected'> = {
  received: 'pending',
  verified: 'pending',
  fulfilled: 'approved',
  closed: 'approved',
};

const KIND_LABEL: Record<DsrKind, string> = {
  access: 'Hozzáférés',
  deletion: 'Törlés',
};

export default async function DsrPage() {
  await requireEditor();
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.dsrRequests)
    .orderBy(desc(schema.dsrRequests.createdAt));

  const counts = { all: rows.length, open: 0, overdue: 0, closed: 0 };
  const now = Date.now();
  for (const r of rows) {
    const isClosed = r.status === 'fulfilled' || r.status === 'closed';
    if (isClosed) counts.closed += 1;
    else counts.open += 1;
    if (!isClosed && r.slaDeadline && new Date(r.slaDeadline).getTime() < now) counts.overdue += 1;
  }

  return (
    <>
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Adminisztráció · Adatalany-megkeresések</div>
          <h1 className="admin-title">DSR</h1>
          <p className="admin-sub">
            A <code>dpo@korruptometer.hu</code> levelezés strukturált sorra
            leképezve. SLA: <strong>30 nap</strong>. Minden állapotváltás
            auditnaplóba kerül.
          </p>
        </div>
      </header>

      <section className="stat-ribbon" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-cell">
          <span className="label">Összes megkeresés</span>
          <span className="value">{counts.all.toLocaleString('hu-HU')}</span>
          <span className="delta">összesen rögzítve</span>
        </div>
        <div className="stat-cell">
          <span className="label">Nyitott</span>
          <span className="swatch s-pending" />
          <span className="value">{counts.open.toLocaleString('hu-HU')}</span>
          <span className="delta">SLA-n belüli ügyek</span>
        </div>
        <div className="stat-cell">
          <span className="label">SLA-túlfutó</span>
          <span className="swatch s-rejected" />
          <span className="value">{counts.overdue.toLocaleString('hu-HU')}</span>
          <span className="delta">azonnali intézkedés szükséges</span>
        </div>
        <div className="stat-cell">
          <span className="label">Lezárt</span>
          <span className="swatch s-approved" />
          <span className="value">{counts.closed.toLocaleString('hu-HU')}</span>
          <span className="delta">teljesítve vagy lezárva</span>
        </div>
      </section>

      <section className="detail-section" style={{ padding: '28px 0', borderBottom: 0 }}>
        <h4>Új DSR rögzítése</h4>
        <DsrIntakeForm />
      </section>

      <section className="detail-section" style={{ padding: '0 0 60px', borderBottom: 0 }}>
        <h4>
          Megkeresések <span className="aside">{rows.length} db · legutóbbi elöl</span>
        </h4>
        {rows.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 8 }}>
            Még nincs DSR-megkeresés. A levelezésben érkező kérelmeket kézzel
            rögzítheti az ügyeletes szerkesztő.
          </div>
        ) : (
          <table className="case-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Beérkezett</th>
                <th>Típus</th>
                <th>Állapot</th>
                <th>SLA-határidő</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = r.status as DsrStatus;
                const kind = r.kind as DsrKind;
                const overdue =
                  status !== 'fulfilled' &&
                  status !== 'closed' &&
                  r.slaDeadline &&
                  new Date(r.slaDeadline).getTime() < now;
                return (
                  <tr key={r.id}>
                    <td data-label="Beérkezett">{fmtDate(r.createdAt)}</td>
                    <td data-label="Típus">
                      <span className="tag">{KIND_LABEL[kind] ?? kind}</span>
                    </td>
                    <td data-label="Állapot">
                      <span className={`state-badge ${STATUS_BADGE[status]}`}>
                        <span className="dot" />
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </td>
                    <td data-label="SLA-határidő">
                      {overdue ? (
                        <span className="state-badge rejected">
                          <span className="dot" />
                          {fmtDate(r.slaDeadline)}
                        </span>
                      ) : (
                        fmtDate(r.slaDeadline)
                      )}
                    </td>
                    <td
                      data-label="Hash"
                      style={{ fontFamily: 'Archivo Narrow, monospace', fontSize: 12 }}
                    >
                      {r.subjectEmailHash.slice(0, 16)}…
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
