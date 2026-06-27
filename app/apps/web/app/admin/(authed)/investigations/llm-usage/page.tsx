import 'server-only';
import { gte } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

function fmtHuf(s: string | number | bigint): string {
  try {
    return new Intl.NumberFormat('hu-HU').format(BigInt(Math.round(Number(s)))) + ' Ft';
  } catch {
    return `${s} Ft`;
  }
}

function fmtTokens(n: bigint | string): string {
  try {
    return new Intl.NumberFormat('hu-HU').format(BigInt(n));
  } catch {
    return String(n);
  }
}

export default async function LlmUsagePage() {
  await requireEditor();
  const ceiling = process.env.LLM_DAILY_CEILING_HUF ?? '50000';

  const db = getDb();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const sinceDay = since.toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(schema.dailyLlmUsage)
    .where(gte(schema.dailyLlmUsage.day, sinceDay));

  const sorted = [...rows].sort((a, b) =>
    a.day < b.day ? 1 : a.day > b.day ? -1 : a.model.localeCompare(b.model),
  );

  // Today's aggregate.
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = sorted.filter((r) => r.day === today);
  const todayTotal = todayRows.reduce(
    (acc, r) => acc + Number(r.estimatedHufSpend),
    0,
  );
  const paused = todayTotal >= Number(ceiling);

  return (
    <main className="admin-llm-usage">
      <h1>LLM költés (utolsó 30 nap)</h1>
      <p>
        Napi plafon: <strong>{fmtHuf(ceiling)}</strong>. Mai becsült költés:{' '}
        <strong>{fmtHuf(todayTotal)}</strong>.
      </p>
      {paused ? (
        <div role="alert" className="banner banner-paused">
          A kinyerés szünetel — a mai költés elérte a plafont. A következő
          ingestion-eseményekre nem indít LLM-hívást.
        </div>
      ) : null}
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Nap</th>
            <th scope="col">Modell</th>
            <th scope="col">Input tokens</th>
            <th scope="col">Output tokens</th>
            <th scope="col">Becsült HUF</th>
            <th scope="col">Hívások</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={6}>Nincs adat.</td>
            </tr>
          ) : (
            sorted.map((r) => (
              <tr key={`${r.day}-${r.model}`}>
                <td>{r.day}</td>
                <td>
                  <code>{r.model}</code>
                </td>
                <td>{fmtTokens(r.inputTokens)}</td>
                <td>{fmtTokens(r.outputTokens)}</td>
                <td>{fmtHuf(r.estimatedHufSpend)}</td>
                <td>{r.callCount}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </main>
  );
}
