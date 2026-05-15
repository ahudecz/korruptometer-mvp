import Link from 'next/link';
import { desc, sql } from 'drizzle-orm';

import { fmtDate } from '@korr/shared/format';

import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Status = 'received' | 'in_review' | 'approved' | 'rejected' | 'duplicate';

const STATUS_LABEL: Record<Status, string> = {
  received: 'Beérkezett',
  in_review: 'Vizsgálat alatt',
  approved: 'Jóváhagyva',
  rejected: 'Elutasítva',
  duplicate: 'Duplikátum',
};

const STATUS_BADGE: Record<Status, 'pending' | 'approved' | 'rejected'> = {
  received: 'pending',
  in_review: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  duplicate: 'rejected',
};

export default async function AdminQueuePage() {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.submissions.id,
      ref: schema.submissions.ref,
      suspectName: schema.submissions.suspectName,
      crimes: schema.submissions.crimes,
      status: schema.submissions.status,
      createdAt: schema.submissions.createdAt,
      anonymous: schema.submissions.anonymous,
      hasPii: schema.submissions.reporterEmailEnc,
      hasSealedBox: schema.submissions.bodyCipher,
    })
    .from(schema.submissions)
    .orderBy(desc(schema.submissions.createdAt))
    .limit(50);

  const statusCounts = await db
    .select({
      status: schema.submissions.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.submissions)
    .groupBy(schema.submissions.status);
  const counts = { all: 0, received: 0, in_review: 0, approved: 0, rejected: 0, duplicate: 0 };
  for (const r of statusCounts) {
    counts[r.status as Status] = r.count;
    counts.all += r.count;
  }

  return (
    <>
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Adminisztráció · Bejelentési sor</div>
          <h1 className="admin-title">Sor</h1>
          <p className="admin-sub">
            A <Link href="/bejelentes">/bejelentes</Link> oldalon érkező bejelentések
            kronológikus listája — legutóbbi 50. A vizsgálat alá vétel és az
            ügyaktához kapcsolás minden lépése auditnaplóba kerül.
          </p>
        </div>
      </header>

      <section className="stat-ribbon">
        <StatCell label="Összes" value={counts.all} />
        <StatCell label="Beérkezett" value={counts.received} swatch="s-pending" />
        <StatCell label="Vizsgálat alatt" value={counts.in_review} swatch="s-pending" />
        <StatCell label="Jóváhagyva" value={counts.approved} swatch="s-approved" />
        <StatCell label="Elutasítva / dup." value={counts.rejected + counts.duplicate} swatch="s-rejected" />
      </section>

      <div style={{ marginTop: 28 }}>
        {rows.length === 0 ? (
          <div className="empty-state">
            Még nincs bejelentés. A <Link href="/bejelentes">/bejelentes</Link>-ről
            érkező űrlapok itt landolnak.
          </div>
        ) : (
          <table className="case-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Gyanúsított</th>
                <th>Cselekmények</th>
                <th>Állapot</th>
                <th>Beérkezett</th>
                <th>Visszahívás?</th>
                <th>Sealed-box?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const status = s.status as Status;
                return (
                  <tr key={s.id}>
                    <td data-label="Ref">
                      <Link
                        href={`/admin/submission/${s.id}`}
                        style={{ fontFamily: 'Archivo Narrow, monospace' }}
                      >
                        {s.ref}
                      </Link>
                    </td>
                    <td data-label="Gyanúsított">{s.suspectName}</td>
                    <td data-label="Cselekmények">{(s.crimes ?? []).join(', ')}</td>
                    <td data-label="Állapot">
                      <span className={`state-badge ${STATUS_BADGE[status]}`}>
                        <span className="dot" />
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </td>
                    <td data-label="Beérkezett">{fmtDate(s.createdAt)}</td>
                    <td data-label="Visszahívás?">{s.anonymous ? 'névtelen' : 'kéri'}</td>
                    <td data-label="Sealed-box?">{s.hasSealedBox ? 'igen' : 'nem'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function StatCell({
  label,
  value,
  swatch,
}: {
  label: string;
  value: number;
  swatch?: string;
}) {
  return (
    <div className="stat-cell">
      <span className="label">{label}</span>
      {swatch && <span className={`swatch ${swatch}`} />}
      <span className="value">{value.toLocaleString('hu-HU')}</span>
      <span className="delta">&nbsp;</span>
    </div>
  );
}
