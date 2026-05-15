import { desc, eq } from 'drizzle-orm';

import { fmtDate } from '@korr/shared/format';
import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RunStatus = 'running' | 'success' | 'failure';

const STATUS_LABEL: Record<RunStatus, string> = {
  running: 'Fut',
  success: 'Sikeres',
  failure: 'Hibára futott',
};

const STATUS_BADGE: Record<RunStatus, 'pending' | 'approved' | 'rejected'> = {
  running: 'pending',
  success: 'approved',
  failure: 'rejected',
};

export default async function ScraperRunsPage() {
  await requireEditor();
  const db = getDb();
  const sources = await db.select().from(schema.sources);
  const latestRuns = await db
    .select({
      run: schema.scraperRuns,
      slug: schema.sources.slug,
      name: schema.sources.name,
    })
    .from(schema.scraperRuns)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.scraperRuns.sourceId))
    .orderBy(desc(schema.scraperRuns.startedAt))
    .limit(50);

  const activeSources = sources.filter((s) => s.enabled).length;
  const failingSources = sources.filter((s) => s.consecutiveFailures > 0).length;

  return (
    <>
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Adminisztráció · Forrás-állapot</div>
          <h1 className="admin-title">Scraperek</h1>
          <p className="admin-sub">
            A scraper-runner Phase 3-ban indul; addig a táblák azt mutatják, mely
            forrásokra vagyunk konfigurálva és melyik futott utoljára.
          </p>
        </div>
      </header>

      <section className="stat-ribbon" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-cell">
          <span className="label">Konfigurált forrás</span>
          <span className="value">{sources.length.toLocaleString('hu-HU')}</span>
          <span className="delta">összes definiált adatforrás</span>
        </div>
        <div className="stat-cell">
          <span className="label">Aktív</span>
          <span className="swatch s-approved" />
          <span className="value">{activeSources.toLocaleString('hu-HU')}</span>
          <span className="delta">élesben crawlozó forrás</span>
        </div>
        <div className="stat-cell">
          <span className="label">Hibára futó</span>
          <span className="swatch s-rejected" />
          <span className="value">{failingSources.toLocaleString('hu-HU')}</span>
          <span className="delta">egymás utáni hibákkal</span>
        </div>
      </section>

      <section className="detail-section" style={{ padding: '28px 0 0', borderBottom: 0 }}>
        <h4>
          Források <span className="aside">{sources.length} db</span>
        </h4>
        <table className="case-table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Forrás</th>
              <th>Állapot</th>
              <th>Utolsó futás</th>
              <th>Utolsó siker</th>
              <th>Egymás utáni hibák</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td data-label="Forrás">{s.name}</td>
                <td data-label="Állapot">
                  <span className={`state-badge ${s.enabled ? 'approved' : 'pending'}`}>
                    <span className="dot" />
                    {s.enabled ? 'Aktív' : 'Szünetel'}
                  </span>
                </td>
                <td data-label="Utolsó futás">
                  {s.lastScrapedAt ? fmtDate(s.lastScrapedAt) : '—'}
                </td>
                <td data-label="Utolsó siker">
                  {s.lastSuccessAt ? fmtDate(s.lastSuccessAt) : '—'}
                </td>
                <td data-label="Egymás utáni hibák">
                  {s.consecutiveFailures > 0 ? (
                    <span className="state-badge rejected">
                      <span className="dot" />
                      {s.consecutiveFailures}
                    </span>
                  ) : (
                    '0'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="detail-section" style={{ padding: '28px 0 60px', borderBottom: 0 }}>
        <h4>
          Legutóbbi futások <span className="aside">{latestRuns.length} db</span>
        </h4>
        {latestRuns.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 8 }}>
            Még nem futott egyetlen scraper sem. Az első futás Phase 3-ban indul.
          </div>
        ) : (
          <table className="case-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Forrás</th>
                <th>Indult</th>
                <th>Befejeződött</th>
                <th>Állapot</th>
                <th>Talált / új</th>
              </tr>
            </thead>
            <tbody>
              {latestRuns.map((r) => {
                const status = r.run.status as RunStatus;
                return (
                  <tr key={r.run.id}>
                    <td data-label="Forrás">{r.name ?? r.slug ?? '—'}</td>
                    <td data-label="Indult">{fmtDate(r.run.startedAt)}</td>
                    <td data-label="Befejeződött">
                      {r.run.finishedAt ? fmtDate(r.run.finishedAt) : '—'}
                    </td>
                    <td data-label="Állapot">
                      <span className={`state-badge ${STATUS_BADGE[status]}`}>
                        <span className="dot" />
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </td>
                    <td data-label="Talált / új">
                      {r.run.articlesFound} / {r.run.articlesNew}
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
