import Link from 'next/link';
import { desc } from 'drizzle-orm';

import { fmtDate } from '@korr/shared/format';

import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  received: 'Beérkezett',
  in_review: 'Vizsgálat alatt',
  approved: 'Jóváhagyva',
  rejected: 'Elutasítva',
  duplicate: 'Duplikátum',
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

  return (
    <>
      <h3 style={{ marginTop: 16 }}>Bejelentési sor ({rows.length})</h3>
      {rows.length === 0 ? (
        <div className="empty-state">
          Még nincs bejelentés. A <Link href="/bejelentes">/bejelentes</Link>-ről
          érkező űrlapok itt landolnak.
        </div>
      ) : (
        <table className="case-table" style={{ marginTop: 12 }}>
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
            {rows.map((s) => (
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
                  <span
                    className={
                      s.status === 'approved'
                        ? 'pill lezarva'
                        : s.status === 'rejected' || s.status === 'duplicate'
                          ? 'pill folyamatban'
                          : 'pill vad'
                    }
                  >
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </td>
                <td data-label="Beérkezett">{fmtDate(s.createdAt)}</td>
                <td data-label="Visszahívás?">{s.anonymous ? 'névtelen' : 'kéri'}</td>
                <td data-label="Sealed-box?">{s.hasSealedBox ? 'igen' : 'nem'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
