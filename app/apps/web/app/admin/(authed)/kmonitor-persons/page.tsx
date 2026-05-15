import { aliasedTable, and, asc, desc, eq, ilike, sql } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

import { PersonsList, type FilterState } from './persons-list';
import type { PersonHeader } from './person-detail-panel';

export const dynamic = 'force-dynamic';

type SearchParams = {
  q?: string;
  state?: string;
  topic?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

const DEFAULT_DIR: Record<FilterState['sort'], FilterState['dir']> = {
  mentions: 'desc',
  total: 'desc',
  name: 'asc',
  recent: 'desc',
};

function parseFilter(sp: SearchParams): FilterState {
  const state = (sp.state ?? 'all') as FilterState['state'];
  const sort = (['mentions', 'total', 'name', 'recent'].includes(sp.sort ?? '')
    ? (sp.sort as FilterState['sort'])
    : 'mentions') as FilterState['sort'];
  const dir = (sp.dir === 'asc' || sp.dir === 'desc' ? sp.dir : DEFAULT_DIR[sort]) as FilterState['dir'];
  const pageRaw = Number.parseInt(sp.page ?? '1', 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  return {
    q: (sp.q ?? '').trim(),
    state: (['all', 'pending', 'approved', 'rejected'].includes(state) ? state : 'all') as FilterState['state'],
    topic: (sp.topic ?? '').trim(),
    sort,
    dir,
    page,
  };
}

const PAGE_SIZE = 50;

export default async function KMonitorPersonsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireEditor();
  const sp = await searchParams;
  const filter = parseFilter(sp);
  const db = getDb();

  const whereParts: ReturnType<typeof eq>[] = [];
  if (filter.state !== 'all') {
    whereParts.push(eq(schema.kMonitorPersonCandidates.approvalState, filter.state));
  }
  if (filter.q) {
    whereParts.push(ilike(schema.kMonitorPersonCandidates.displayName, `%${filter.q}%`));
  }
  if (filter.topic) {
    whereParts.push(
      sql`${schema.kMonitorPersonCandidates.topTopics} @> ${JSON.stringify([{ topic: filter.topic }])}::jsonb` as never,
    );
  }
  const whereClause = whereParts.length > 0 ? and(...whereParts) : undefined;

  // Pre-aggregated total of article-attributed HUF per person.
  const personTotals = db
    .select({
      personId: schema.kMonitorPersonArticles.personId,
      total: sql<string>`SUM(${schema.kMonitorPersonArticles.amountHuf})`.as('total'),
    })
    .from(schema.kMonitorPersonArticles)
    .groupBy(schema.kMonitorPersonArticles.personId)
    .as('person_totals');

  const orderBy = (() => {
    const isAsc = filter.dir === 'asc';
    switch (filter.sort) {
      case 'total':
        return [
          isAsc
            ? sql`${personTotals.total} ASC NULLS LAST`
            : sql`${personTotals.total} DESC NULLS LAST`,
        ];
      case 'name':
        return [
          isAsc
            ? asc(schema.kMonitorPersonCandidates.displayName)
            : desc(schema.kMonitorPersonCandidates.displayName),
        ];
      case 'recent':
        return [
          isAsc
            ? asc(schema.kMonitorPersonCandidates.lastSeenAt)
            : desc(schema.kMonitorPersonCandidates.lastSeenAt),
        ];
      case 'mentions':
      default:
        return [
          isAsc
            ? asc(schema.kMonitorPersonCandidates.mentionCount)
            : desc(schema.kMonitorPersonCandidates.mentionCount),
        ];
    }
  })();

  const decider = aliasedTable(schema.editors, 'decider');
  const rowsQ = db
    .select({
      id: schema.kMonitorPersonCandidates.id,
      displayName: schema.kMonitorPersonCandidates.displayName,
      mentionCount: schema.kMonitorPersonCandidates.mentionCount,
      articleCountWithAmount: schema.kMonitorPersonCandidates.articleCountWithAmount,
      p1AmountHuf: schema.kMonitorPersonCandidates.p1AmountHuf,
      p10AmountHuf: schema.kMonitorPersonCandidates.p10AmountHuf,
      p50AmountHuf: schema.kMonitorPersonCandidates.p50AmountHuf,
      p90AmountHuf: schema.kMonitorPersonCandidates.p90AmountHuf,
      p99AmountHuf: schema.kMonitorPersonCandidates.p99AmountHuf,
      topTopics: schema.kMonitorPersonCandidates.topTopics,
      topInstitutions: schema.kMonitorPersonCandidates.topInstitutions,
      topPersons: schema.kMonitorPersonCandidates.topPersons,
      approvalState: schema.kMonitorPersonCandidates.approvalState,
      caseId: schema.kMonitorPersonCandidates.caseId,
      decidedAt: schema.kMonitorPersonCandidates.decidedAt,
      decidedByName: decider.displayName,
      decidedByEmail: decider.email,
      totalHuf: personTotals.total,
    })
    .from(schema.kMonitorPersonCandidates)
    .leftJoin(decider, eq(decider.id, schema.kMonitorPersonCandidates.decidedBy))
    .leftJoin(personTotals, eq(personTotals.personId, schema.kMonitorPersonCandidates.id))
    .$dynamic();
  if (whereClause) rowsQ.where(whereClause);
  const offset = (filter.page - 1) * PAGE_SIZE;
  const rows = await rowsQ.orderBy(...orderBy).limit(PAGE_SIZE).offset(offset);

  const filteredTotalQ = db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.kMonitorPersonCandidates)
    .$dynamic();
  if (whereClause) filteredTotalQ.where(whereClause);
  const filteredTotalRows = await filteredTotalQ;
  const filteredTotal = filteredTotalRows[0]?.total ?? 0;

  // Per-state counts (unconditioned).
  const stateCountsRows = await db
    .select({
      state: schema.kMonitorPersonCandidates.approvalState,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.kMonitorPersonCandidates)
    .groupBy(schema.kMonitorPersonCandidates.approvalState);

  const counts = { all: 0, pending: 0, approved: 0, rejected: 0 };
  for (const r of stateCountsRows) {
    counts[r.state as keyof typeof counts] = r.count;
    counts.all += r.count;
  }

  const recentRows = await db.execute<{ c: number }>(
    sql`SELECT count(*)::int AS c FROM "KMonitorPersonCandidate" WHERE "firstSeenAt" >= NOW() - INTERVAL '24 hours'`,
  );
  const recentCount = Number(
    (Array.isArray(recentRows) ? recentRows[0] : (recentRows as unknown as { rows?: { c: number }[] }).rows?.[0])?.c ?? 0,
  );

  // Total stolen money — sum of article-attributed HUF across approved candidates.
  const totalStolenRows = await db.execute<{ total: string | null }>(
    sql`SELECT COALESCE(SUM(kpa."amountHuf"), 0)::text AS total
        FROM "KMonitorPersonArticle" kpa
        JOIN "KMonitorPersonCandidate" p ON p.id = kpa."personId"
        WHERE p."approvalState" = 'approved' AND kpa."amountHuf" IS NOT NULL`,
  );
  const totalStolenHuf =
    (Array.isArray(totalStolenRows)
      ? totalStolenRows[0]
      : (totalStolenRows as unknown as { rows?: { total: string | null }[] }).rows?.[0])?.total ?? null;

  const latencyRows = await db.execute<{ avg_hours: string | null }>(
    sql`SELECT EXTRACT(EPOCH FROM AVG("decidedAt" - "firstSeenAt"))/3600 AS avg_hours
        FROM "KMonitorPersonCandidate"
        WHERE "decidedAt" IS NOT NULL`,
  );
  const avgLatencyHours = Number(
    (Array.isArray(latencyRows) ? latencyRows[0] : (latencyRows as unknown as { rows?: { avg_hours: string | null }[] }).rows?.[0])?.avg_hours ?? 0,
  );

  const lastRunRows = await db
    .select({ at: schema.scraperRuns.finishedAt })
    .from(schema.scraperRuns)
    .where(eq(schema.scraperRuns.status, 'success'))
    .orderBy(desc(schema.scraperRuns.finishedAt))
    .limit(1);
  const lastSyncAt = lastRunRows[0]?.at ?? null;

  // Topic universe — for the column-header filter dropdown.
  const topicRowsRaw = await db.execute<{ topic: string }>(
    sql`SELECT (t->>'topic') AS topic, COUNT(*)::int AS c
        FROM "KMonitorPersonCandidate", jsonb_array_elements("topTopics") t
        WHERE "topTopics" IS NOT NULL
        GROUP BY 1
        ORDER BY c DESC, 1 ASC`,
  );
  const topicUniverse = (Array.isArray(topicRowsRaw)
    ? topicRowsRaw
    : (topicRowsRaw as unknown as { rows?: { topic: string }[] }).rows ?? [])
    .map((r) => r.topic)
    .filter(Boolean)
    .slice(0, 100);

  const headers: PersonHeader[] = rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    mentionCount: r.mentionCount,
    articleCountWithAmount: r.articleCountWithAmount,
    p1: r.p1AmountHuf?.toString() ?? null,
    p10: r.p10AmountHuf?.toString() ?? null,
    p50: r.p50AmountHuf?.toString() ?? null,
    p90: r.p90AmountHuf?.toString() ?? null,
    p99: r.p99AmountHuf?.toString() ?? null,
    topTopics: (r.topTopics as { topic: string; count: number }[] | null) ?? [],
    topInstitutions: (r.topInstitutions as { institution: string; count: number }[] | null) ?? [],
    topPersons: (r.topPersons as { person: string; count: number }[] | null) ?? [],
    approvalState: r.approvalState,
    caseId: r.caseId,
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    decidedBy: r.decidedByName ?? r.decidedByEmail?.split('@')[0] ?? null,
    total: r.totalHuf ?? null,
  }));

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  return (
    <>
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Adminisztráció · K-Monitor adatbázis</div>
          <h1 className="admin-title">
            Érintett
            <br />
            személyek
          </h1>
          <p className="admin-sub">
            A K-Monitor <code>kmdb_base</code> adatbázisban (CC-BY-SA-4.0) szereplő
            nevek átnézése, jóváhagyása, vagy elutasítása. Az összegek a cikkek
            szövegéből kinyert HUF értékek <strong>p1 / p10 / p50 / p90 / p99</strong>{' '}
            percentilisei — log skálán ábrázolva a részletes panelben.
          </p>
        </div>
        <div className="admin-meta">
          <span className="dot" />
          <strong>Élő</strong> kapcsolat
          <br />
          Utolsó szinkron{' '}
          <strong>{lastSyncAt ? fmtSyncTime(lastSyncAt) : '—'}</strong>
          <br />
          Adatfrissítés <strong>napi 04:00</strong>
        </div>
      </header>

      <section className="stat-ribbon">
        <StatCell
          label="Összes jelölt"
          value={fmtInt(counts.all)}
          delta={
            recentCount > 0 ? (
              <>
                <strong className="up">+{fmtInt(recentCount)}</strong> az elmúlt 24 órában
              </>
            ) : (
              <>nincs új a 24 órában</>
            )
          }
        />
        <StatCell
          label="Sorban áll"
          value={fmtInt(counts.pending)}
          swatch="s-pending"
          delta={
            avgLatencyHours > 0 ? (
              <>
                <strong className="flat">~ {fmtLatency(avgLatencyHours)}</strong> átlagos átfutás
              </>
            ) : (
              <>nincs lezárt döntés</>
            )
          }
        />
        <StatCell
          label="Jóváhagyott"
          value={fmtInt(counts.approved)}
          swatch="s-approved"
          delta={
            counts.all > 0 ? <>{fmtPct(counts.approved, counts.all)} összes jelölt aránya</> : <>—</>
          }
        />
        <StatCell
          label="Elutasítva"
          value={fmtInt(counts.rejected)}
          swatch="s-rejected"
          delta={
            counts.all > 0 ? <>{fmtPct(counts.rejected, counts.all)} homonim/névrokon</> : <>—</>
          }
        />
        <StatCell
          label="Összes ellopott pénz"
          value={fmtFtRibbon(totalStolenHuf)}
          accent
          delta={<>Jóváhagyott esetek mediánjainak összege</>}
        />
      </section>

      <PersonsList
        rows={headers}
        filter={filter}
        filteredTotal={filteredTotal}
        totalPages={totalPages}
        topicUniverse={topicUniverse}
        stateCounts={counts}
      />
    </>
  );
}

function StatCell({
  label,
  value,
  delta,
  swatch,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  delta: React.ReactNode;
  swatch?: string;
  accent?: boolean;
}) {
  return (
    <div className={`stat-cell${accent ? ' is-accent' : ''}`}>
      <span className="label">{label}</span>
      {swatch && <span className={`swatch ${swatch}`} />}
      <span className="value">{value}</span>
      <span className="delta">{delta}</span>
    </div>
  );
}

function fmtInt(n: number): string {
  return n.toLocaleString('hu-HU');
}

function fmtPct(num: number, denom: number): string {
  if (denom === 0) return '0%';
  const pct = (num * 100) / denom;
  return `${pct.toLocaleString('hu-HU', { maximumFractionDigits: 1 })}%`;
}

function fmtLatency(hours: number): string {
  if (hours < 1) return 'kevesebb mint óra';
  if (hours < 48) return `${Math.round(hours)} óra`;
  const days = hours / 24;
  return `${days.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} nap`;
}

function fmtFtRibbon(s: string | null): React.ReactNode {
  if (s == null) return <>—</>;
  const v = Number(s);
  if (!Number.isFinite(v) || v === 0) return <>—</>;
  if (v >= 1_000_000_000_000) {
    const t = Math.round((v / 1_000_000_000_000) * 10) / 10;
    return (
      <>
        {t.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} <small>E Ft</small>
      </>
    );
  }
  if (v >= 1_000_000_000) {
    const mrd = Math.round((v / 1_000_000_000) * 10) / 10;
    return (
      <>
        {mrd.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} <small>Mrd Ft</small>
      </>
    );
  }
  if (v >= 1_000_000) {
    return (
      <>
        {Math.round(v / 1_000_000).toLocaleString('hu-HU')} <small>M Ft</small>
      </>
    );
  }
  return <>{v.toLocaleString('hu-HU')} Ft</>;
}

function fmtSyncTime(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
