import { NextResponse } from 'next/server';
import { and, asc, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';

import { caseQuerySchema } from '@korr/shared/schemas/cases';
import { decodeCursor, encodeCursor, type SortValue } from '@korr/shared/cursor';
import { qSearchLimiter, cursorLimiter } from '@korr/shared/ratelimit';

import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}

function tooManyRequests(message: string) {
  return NextResponse.json({ error: message }, { status: 429 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = caseQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'érvénytelen lekérdezés', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const params = parsed.data;
  const ip = getClientIp(req);

  if (params.q) {
    const r = await qSearchLimiter.limit(`q:${ip}`);
    if (!r.success) return tooManyRequests('Túl sok keresés. Próbáld kicsit később.');
  }
  if (params.cursor) {
    const r = await cursorLimiter.limit(`cur:${ip}`);
    if (!r.success) return tooManyRequests('Túl sok lapozás. Próbáld kicsit később.');
  }

  const db = getDb();
  const { cases } = schema;

  // ── Filters ──────────────────────────────────────────────────────────────
  const conditions: SQL[] = [];
  if (params.q) {
    // Use the immutable_unaccent wrapper installed in 0002_case_search.sql.
    conditions.push(
      sql`"Case"."searchVector" @@ websearch_to_tsquery('simple', immutable_unaccent(${params.q}))`,
    );
  }
  if (params.status) conditions.push(eq(cases.status, params.status));
  if (params.region) conditions.push(eq(cases.region, params.region));
  if (params.sector) conditions.push(eq(cases.sector, params.sector));
  if (params.minAmount !== undefined) {
    conditions.push(gte(cases.amount, BigInt(params.minAmount)));
  }
  if (params.minSentenceYears !== undefined) {
    conditions.push(gte(cases.sentenceYears, params.minSentenceYears));
  }
  if (params.caseYearFrom !== undefined) {
    conditions.push(gte(cases.caseYear, params.caseYearFrom));
  }
  if (params.caseYearTo !== undefined) {
    conditions.push(lte(cases.caseYear, params.caseYearTo));
  }

  // ── Cursor (tuple-stable pagination) ─────────────────────────────────────
  const cursor = decodeCursor(params.cursor);
  if (cursor && cursor.s !== params.sort) {
    return NextResponse.json(
      { error: 'a cursor sort értéke eltér a kérés sort értékétől' },
      { status: 400 },
    );
  }
  if (cursor) {
    const tieBreak = sql`(
      ${orderClause(cases, params.sort)} ${tieBreakOperator(params.sort)}
        (${sortKeyLiteral(params.sort, cursor.k)}, ${cursor.id})
    )`;
    conditions.push(tieBreak);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const orderBy = orderByForSort(cases, params.sort);

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
  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor({
          s: params.sort,
          k: cursorKeyValue(params.sort, page[page.length - 1]!),
          id: page[page.length - 1]!.id,
        })
      : null;

  const cacheable = !params.q && !params.cursor;
  const headers = new Headers({
    'Cache-Control': cacheable
      ? 'public, s-maxage=60, stale-while-revalidate=300'
      : 'no-store',
  });

  return NextResponse.json(
    {
      items: page.map((c) => ({ ...c, amount: c.amount.toString() })),
      nextCursor,
    },
    { headers },
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function orderByForSort(t: typeof schema.cases, sort: SortValue) {
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

function orderClause(t: typeof schema.cases, sort: SortValue): SQL {
  switch (sort) {
    case 'amount_desc':
    case 'amount_asc':
      return sql`(${t.amount}, ${t.id})`;
    case 'sentence_desc':
      return sql`(${t.sentenceYears}, ${t.id})`;
    case 'year_desc':
      return sql`(${t.caseYear}, ${t.id})`;
    case 'name_asc':
      return sql`(${t.name}, ${t.id})`;
  }
}

function tieBreakOperator(sort: SortValue): SQL {
  return sort === 'amount_desc' || sort === 'year_desc' || sort === 'sentence_desc'
    ? sql`<`
    : sql`>`;
}

function sortKeyLiteral(sort: SortValue, value: string | number): SQL {
  if (sort === 'amount_desc' || sort === 'amount_asc') {
    return sql`${BigInt(String(value))}`;
  }
  if (sort === 'year_desc' || sort === 'sentence_desc') {
    return sql`${Number(value)}`;
  }
  return sql`${String(value)}`;
}

function cursorKeyValue(
  sort: SortValue,
  row: { amount: bigint; sentenceYears: number; caseYear: number; name: string },
): string | number {
  switch (sort) {
    case 'amount_desc':
    case 'amount_asc':
      return row.amount.toString();
    case 'sentence_desc':
      return row.sentenceYears;
    case 'year_desc':
      return row.caseYear;
    case 'name_asc':
      return row.name;
  }
}
