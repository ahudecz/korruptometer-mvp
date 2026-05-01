import Link from 'next/link';
import { and, asc, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';

import { fmtFt, fmtNumber } from '@korr/shared/format';
import { caseQuerySchema } from '@korr/shared/schemas/cases';
import { encodeCursor, type SortValue } from '@korr/shared/cursor';

import { getDb, schema } from '@/lib/db';

import { CaseFilters } from './case-filters';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SORT_LABELS: Record<SortValue, string> = {
  amount_desc: 'Kár (legnagyobb)',
  amount_asc: 'Kár (legkisebb)',
  sentence_desc: 'Évek (legtöbb)',
  year_desc: 'Dátum (legfrissebb)',
  name_asc: 'Név (A–Z)',
};

function statusPillClass(s: string): string {
  if (s === 'Lezárva') return 'pill lezarva';
  if (s === 'Vádemelés') return 'pill vad';
  return 'pill folyamatban';
}

export default async function AdatbazisPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const parsed = caseQuerySchema.safeParse(flat);
  const params = parsed.success ? parsed.data : caseQuerySchema.parse({});

  const db = getDb();
  const { cases } = schema;

  const conditions: SQL[] = [];
  if (params.q) {
    conditions.push(
      sql`"Case"."searchVector" @@ websearch_to_tsquery('simple', immutable_unaccent(${params.q}))`,
    );
  }
  if (params.status) conditions.push(eq(cases.status, params.status));
  if (params.region) conditions.push(eq(cases.region, params.region));
  if (params.sector) conditions.push(eq(cases.sector, params.sector));
  if (params.minAmount !== undefined)
    conditions.push(gte(cases.amount, BigInt(params.minAmount)));
  if (params.minSentenceYears !== undefined)
    conditions.push(gte(cases.sentenceYears, params.minSentenceYears));
  if (params.caseYearFrom !== undefined)
    conditions.push(gte(cases.caseYear, params.caseYearFrom));
  if (params.caseYearTo !== undefined)
    conditions.push(lte(cases.caseYear, params.caseYearTo));

  const where = conditions.length ? and(...conditions) : undefined;
  const orderBy = orderByFor(cases, params.sort);

  const rows = await db
    .select({
      id: cases.id,
      name: cases.name,
      position: cases.position,
      amount: cases.amount,
      sentenceYears: cases.sentenceYears,
      caseYear: cases.caseYear,
      status: cases.status,
      region: cases.region,
      sector: cases.sector,
    })
    .from(cases)
    .where(where)
    .orderBy(...orderBy)
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  const page = hasMore ? rows.slice(0, params.limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          s: params.sort,
          k:
            params.sort === 'amount_desc' || params.sort === 'amount_asc'
              ? last.amount.toString()
              : params.sort === 'sentence_desc'
                ? last.sentenceYears
                : params.sort === 'year_desc'
                  ? last.caseYear
                  : last.name,
          id: last.id,
        })
      : null;

  // Count total cases (for the meta line)
  const totalRows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(cases);
  const totalCases = totalRows[0]?.c ?? 0;

  const regionRows = await db
    .selectDistinct({ region: cases.region })
    .from(cases)
    .orderBy(asc(cases.region));
  const regions = regionRows.map((r) => r.region);

  return (
    <section className="section" id="database">
      <div className="section-head">
        <div className="section-num">03 / Adatbázis</div>
        <h2 className="section-title">Az ügyek nyilvántartása.</h2>
      </div>

      <CaseFilters regions={regions} initial={params} sortLabels={SORT_LABELS} />

      <div className="db-meta">
        <div className="db-count">
          <strong>{fmtNumber(page.length)}</strong> találat {fmtNumber(totalCases)} ügyből
          {hasMore ? ' (folytatható)' : ''}
        </div>
        <div className="db-sort">
          <a href={updateSort(flat, 'amount_desc')}>
            <button
              type="button"
              className={params.sort === 'amount_desc' ? 'active' : ''}
            >
              Kár ↓
            </button>
          </a>
          <a href={updateSort(flat, 'sentence_desc')}>
            <button
              type="button"
              className={params.sort === 'sentence_desc' ? 'active' : ''}
            >
              Évek ↓
            </button>
          </a>
          <a href={updateSort(flat, 'year_desc')}>
            <button
              type="button"
              className={params.sort === 'year_desc' ? 'active' : ''}
            >
              Dátum ↓
            </button>
          </a>
        </div>
      </div>

      {page.length === 0 ? (
        <div className="empty-state">
          Nincs ilyen találat. Próbáld lazítani a szűrőket — különösen a min.
          összeget vagy az évszakaszt.
        </div>
      ) : (
        <table className="db-table">
          <thead>
            <tr>
              <th>Ügy</th>
              <th>Pozíció</th>
              <th>Régió</th>
              <th>Év</th>
              <th>Státusz</th>
              <th className="num">Kár (Ft)</th>
              <th className="num">Évek</th>
            </tr>
          </thead>
          <tbody>
            {page.map((c) => (
              <tr key={c.id}>
                <td data-label="Ügy">
                  <div className="case-id">{c.id}</div>
                  <Link href={`/adatbazis/${c.id}`} className="case-name">
                    {c.name}
                  </Link>
                </td>
                <td data-label="Pozíció">
                  <div style={{ fontSize: 14, color: 'var(--ink)' }}>
                    {c.position}
                  </div>
                </td>
                <td data-label="Régió">{c.region}</td>
                <td data-label="Év">{c.caseYear}</td>
                <td data-label="Státusz">
                  <span className={statusPillClass(c.status)}>{c.status}</span>
                </td>
                <td className="num" data-label="Kár">
                  {fmtFt(c.amount)}
                </td>
                <td className="num" data-label="Évek">
                  {fmtNumber(c.sentenceYears)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {nextCursor && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link
            href={`/adatbazis?${nextCursorHref(flat, nextCursor)}`}
            style={{
              display: 'inline-block',
              background: 'var(--ink)',
              color: '#fff',
              padding: '14px 28px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            További találatok →
          </Link>
        </div>
      )}
    </section>
  );
}

function orderByFor(t: typeof schema.cases, sort: SortValue) {
  switch (sort) {
    case 'amount_desc':
      return [desc(t.amount), asc(t.id)];
    case 'amount_asc':
      return [asc(t.amount), asc(t.id)];
    case 'sentence_desc':
      return [desc(t.sentenceYears), asc(t.id)];
    case 'year_desc':
      return [desc(t.caseYear), asc(t.id)];
    case 'name_asc':
      return [asc(t.name), asc(t.id)];
  }
}

function nextCursorHref(
  current: Record<string, string | undefined>,
  cursor: string,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (k === 'cursor' || v === undefined || v === '') continue;
    params.set(k, v);
  }
  params.set('cursor', cursor);
  return params.toString();
}

function updateSort(
  current: Record<string, string | undefined>,
  next: SortValue,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (k === 'sort' || k === 'cursor' || v === undefined || v === '') continue;
    params.set(k, v);
  }
  params.set('sort', next);
  return `/adatbazis?${params.toString()}`;
}
