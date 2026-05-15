import { desc } from 'drizzle-orm';

import { fmtDate } from '@korr/shared/format';
import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

import { TagDecisionForm } from './tag-decision-form';

export const dynamic = 'force-dynamic';

export default async function KMonitorTagsPage() {
  await requireEditor();
  const db = getDb();
  const candidates = await db
    .select()
    .from(schema.kMonitorTagCandidates)
    .orderBy(desc(schema.kMonitorTagCandidates.firstSeenAt));

  const pending = candidates.filter((c) => c.approvalState === 'pending');
  const approved = candidates.filter((c) => c.approvalState === 'approved');
  const rejected = candidates.filter((c) => c.approvalState === 'rejected');

  return (
    <>
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Adminisztráció · K-Monitor felderítés</div>
          <h1 className="admin-title">Címkék</h1>
          <p className="admin-sub">
            A K-Monitor adatbázisban felfedezett címkék (FR-076). Csak az itt
            jóváhagyott szavak indítják el a per-címke bejárást és az ügy-importot
            (FR-077, FR-078). A K-Monitor szerkesztői tartalmait soha nem
            tároljuk; a forrás az eredeti kiadó (<strong>Telex</strong>,{' '}
            <strong>444</strong>, <strong>HVG</strong>,{' '}
            <strong>Magyar Hang</strong>, <strong>Átlátszó</strong>).
          </p>
        </div>
      </header>

      <section className="stat-ribbon" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-cell">
          <span className="label">Sorban</span>
          <span className="swatch s-pending" />
          <span className="value">{pending.length.toLocaleString('hu-HU')}</span>
          <span className="delta">jóváhagyásra váró címke</span>
        </div>
        <div className="stat-cell">
          <span className="label">Jóváhagyott</span>
          <span className="swatch s-approved" />
          <span className="value">{approved.length.toLocaleString('hu-HU')}</span>
          <span className="delta">aktív per-címke bejárás</span>
        </div>
        <div className="stat-cell">
          <span className="label">Elutasítva</span>
          <span className="swatch s-rejected" />
          <span className="value">{rejected.length.toLocaleString('hu-HU')}</span>
          <span className="delta">nem indul címke-bejárás</span>
        </div>
      </section>

      <section className="detail-section" style={{ padding: '28px 0', borderBottom: 0 }}>
        <h4>
          Jóváhagyásra váró <span className="aside">{pending.length} db</span>
        </h4>
        {pending.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 8 }}>
            Nincs új címke. A felderítő munka naponta egyszer fut (02:30 UTC).
          </div>
        ) : (
          <table className="case-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Címke</th>
                <th>Először látva</th>
                <th>Utoljára látva</th>
                <th>Cikkek (utolsó bejárás)</th>
                <th style={{ minWidth: 320 }}>Döntés</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((c) => (
                <tr key={c.id}>
                  <td data-label="Címke">
                    <code style={{ fontFamily: 'Archivo Narrow, monospace', fontWeight: 600 }}>
                      {c.slug}
                    </code>
                  </td>
                  <td data-label="Először látva">{fmtDate(c.firstSeenAt)}</td>
                  <td data-label="Utoljára látva">{fmtDate(c.lastSeenAt)}</td>
                  <td data-label="Cikkek">{c.articleCount}</td>
                  <td data-label="Döntés">
                    <TagDecisionForm
                      id={c.id}
                      slug={c.slug}
                      initialCaseId={c.caseId}
                      current="pending"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="detail-section" style={{ padding: '0 0 28px', borderBottom: 0 }}>
        <h4>
          Jóváhagyott <span className="aside">{approved.length} db</span>
        </h4>
        {approved.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 8 }}>
            Még nincs jóváhagyott címke.
          </div>
        ) : (
          <table className="case-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Címke</th>
                <th>Ügy</th>
                <th>Cikkek</th>
                <th>Utolsó bejárás</th>
                <th style={{ minWidth: 320 }}>Módosítás</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((c) => (
                <tr key={c.id}>
                  <td data-label="Címke">
                    <code style={{ fontFamily: 'Archivo Narrow, monospace', fontWeight: 600 }}>
                      {c.slug}
                    </code>
                  </td>
                  <td data-label="Ügy">
                    {c.caseId ? (
                      <code style={{ fontFamily: 'Archivo Narrow, monospace', fontSize: 12 }}>
                        {c.caseId}
                      </code>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td data-label="Cikkek">{c.articleCount}</td>
                  <td data-label="Utolsó bejárás">
                    {c.lastTraversedAt ? fmtDate(c.lastTraversedAt) : '—'}
                  </td>
                  <td data-label="Módosítás">
                    <TagDecisionForm
                      id={c.id}
                      slug={c.slug}
                      initialCaseId={c.caseId}
                      current="approved"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="detail-section" style={{ padding: '0 0 60px', borderBottom: 0 }}>
        <h4>
          Elutasított <span className="aside">{rejected.length} db</span>
        </h4>
        {rejected.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 8 }}>
            Nincs elutasított címke.
          </div>
        ) : (
          <table className="case-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Címke</th>
                <th>Először látva</th>
                <th>Visszaállítás</th>
              </tr>
            </thead>
            <tbody>
              {rejected.map((c) => (
                <tr key={c.id}>
                  <td data-label="Címke">
                    <code style={{ fontFamily: 'Archivo Narrow, monospace', fontWeight: 600 }}>
                      {c.slug}
                    </code>
                  </td>
                  <td data-label="Először látva">{fmtDate(c.firstSeenAt)}</td>
                  <td data-label="Visszaállítás">
                    <TagDecisionForm
                      id={c.id}
                      slug={c.slug}
                      initialCaseId={c.caseId}
                      current="rejected"
                    />
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
