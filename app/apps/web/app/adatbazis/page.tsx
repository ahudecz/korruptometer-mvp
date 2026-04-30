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
  year_desc: 'Év (legfrissebb)',
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
  const nextCursor = hasMore && last
    ? encodeCursor({
        s: params.sort,
        k:
          params.sort === 'amount_desc' || params.sort === 'amount_asc'
            ? last.amount.toString()
            : params.sort === 'year_desc'
              ? last.caseYear
              : last.name,
        id: last.id,
      })
    : null;

  // Distinct regions for the dropdown.
  const regionRows = await db
    .selectDistinct({ region: cases.region })
    .from(cases)
    .orderBy(asc(cases.region));
  const regions = regionRows.map((r) => r.region);

  return (
    <section className="section">
      <div className="section-eyebrow">Adatbázis</div>
      <h2>Korrupciós ügyek nyomon követése</h2>
      <p className="lede">
        Szűrhetsz név, régió, szektor, státusz, érintett összeg és kiszabott
        börtönévek alapján. A találatok URL-be is bele vannak építve, így
        megosztható.
      </p>

      <CaseFilters regions={regions} initial={params} sortLabels={SORT_LABELS} />

      <div style={{ margin: '12px 0', color: 'var(--muted)', fontSize: 13 }}>
        <strong>{fmtNumber(page.length)}</strong> találat
        {hasMore ? ' (folytatható)' : ''} ·{' '}
        <span>Rendezés: {SORT_LABELS[params.sort]}</span>
      </div>

      {page.length === 0 ? (
        <div className="empty-state">
          Nincs ilyen találat. Próbáld lazítani a szűrőket — különösen a min.
          összeget vagy az évszakaszt.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="case-table">
            <thead>
              <tr>
                <th>Ügy</th>
                <th>Pozíció</th>
                <th>Régió</th>
                <th>Év</th>
                <th>Státusz</th>
                <th style={{ textAlign: 'right' }}>Kár</th>
                <th style={{ textAlign: 'right' }}>Évek</th>
              </tr>
            </thead>
            <tbody>
              {page.map((c) => (
                <tr key={c.id}>
                  <td data-label="Ügy">
                    <div className="case-id">{c.id}</div>
                    <Link
                      href={`/adatbazis/${c.id}`}
                      className="case-name"
                      style={{ color: 'var(--ink)' }}
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td data-label="Pozíció" style={{ fontSize: 14, color: 'var(--ink)' }}>
                    {c.position}
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
        </div>
      )}

      {nextCursor && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link
            href={`/adatbazis?${nextCursorHref(flat, nextCursor)}`}
            className="btn btn-ghost"
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
