import { desc } from 'drizzle-orm';

import { fmtDate } from '@korr/shared/format';
import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

import { DsrIntakeForm } from './dsr-form';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  received: 'Beérkezett',
  verified: 'Igazolt',
  fulfilled: 'Teljesítve',
  closed: 'Lezárva',
};

export default async function DsrPage() {
  await requireEditor();
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.dsrRequests)
    .orderBy(desc(schema.dsrRequests.createdAt));

  return (
    <>
      <h3 style={{ marginTop: 16 }}>Adatalany-megkeresések (DSR)</h3>
      <p className="lede">
        A <code>dpo@korruptometer.hu</code> levelezés strukturált sorra
        leképezve. SLA: 30 nap. Minden állapotváltás auditnaplóba kerül.
      </p>

      <DsrIntakeForm />

      {rows.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 12 }}>
          Még nincs DSR-megkeresés. A levelezésben érkező kérelmeket kézzel
          rögzítheti az ügyeletes szerkesztő.
        </div>
      ) : (
        <table className="case-table" style={{ marginTop: 12 }}>
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
            {rows.map((r) => (
              <tr key={r.id}>
                <td data-label="Beérkezett">{fmtDate(r.createdAt)}</td>
                <td data-label="Típus">
                  <span className="pill">{r.kind}</span>
                </td>
                <td data-label="Állapot">
                  <span className="pill">{STATUS_LABEL[r.status] ?? r.status}</span>
                </td>
                <td data-label="SLA-határidő">{fmtDate(r.slaDeadline)}</td>
                <td
                  data-label="Hash"
                  style={{ fontFamily: 'Archivo Narrow, monospace', fontSize: 12 }}
                >
                  {r.subjectEmailHash.slice(0, 16)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
