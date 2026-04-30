import { desc, eq } from 'drizzle-orm';

import { fmtDate } from '@korr/shared/format';
import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

  return (
    <>
      <h3 style={{ marginTop: 16 }}>Forrás-állapot</h3>
      <p className="lede">
        A scraper-runner Phase 3-ban indul; addig a táblák azt mutatják, mely
        forrásokra vagyunk konfigurálva és melyik futott utoljára.
      </p>

      <table className="case-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Forrás</th>
            <th>Aktív?</th>
            <th>Utolsó futás</th>
            <th>Utolsó siker</th>
            <th>Egymás utáni hibák</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id}>
              <td data-label="Forrás">{s.name}</td>
              <td data-label="Aktív?">{s.enabled ? 'igen' : 'nem'}</td>
              <td data-label="Utolsó futás">
                {s.lastScrapedAt ? fmtDate(s.lastScrapedAt) : '—'}
              </td>
              <td data-label="Utolsó siker">
                {s.lastSuccessAt ? fmtDate(s.lastSuccessAt) : '—'}
              </td>
              <td data-label="Egymás utáni hibák">{s.consecutiveFailures}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={{ marginTop: 24 }}>Legutóbbi futások ({latestRuns.length})</h4>
      {latestRuns.length === 0 ? (
        <div className="empty-state">
          Még nem futott egyetlen scraper sem. Az első futás Phase 3-ban indul.
        </div>
      ) : (
        <table className="case-table" style={{ marginTop: 12 }}>
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
            {latestRuns.map((r) => (
              <tr key={r.run.id}>
                <td data-label="Forrás">{r.name ?? r.slug ?? '—'}</td>
                <td data-label="Indult">{fmtDate(r.run.startedAt)}</td>
                <td data-label="Befejeződött">
                  {r.run.finishedAt ? fmtDate(r.run.finishedAt) : '—'}
                </td>
                <td data-label="Állapot">
                  <span
                    className={
                      r.run.status === 'success'
                        ? 'pill lezarva'
                        : r.run.status === 'failure'
                          ? 'pill vad'
                          : 'pill folyamatban'
                    }
                  >
                    {r.run.status}
                  </span>
                </td>
                <td data-label="Talált / új">
                  {r.run.articlesFound} / {r.run.articlesNew}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
