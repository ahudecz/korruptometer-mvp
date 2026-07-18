import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';

/**
 * T052 — CI-only Postgres-stat endpoint. Refuses to serve unless
 * `process.env.CI_DBSTAT_TOKEN` is set AND the request carries it via
 * `?token=…` or `Authorization: Bearer …`. Refuses outright in production.
 *
 * The k6 burst test (T051) reads `pg_stat_activity` count from this endpoint
 * to assert the connection pool isn't exhausted under SC-006 burst load.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'not available in production' }, { status: 404 });
  }
  const expected = process.env.CI_DBSTAT_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'CI_DBSTAT_TOKEN not configured' }, { status: 503 });
  }
  const url = new URL(req.url);
  const token =
    url.searchParams.get('token') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    '';
  if (token !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const db = getDb();
  const rows = await db.execute(sql`
    SELECT count(*)::int AS connections,
           sum(CASE WHEN state = 'active' THEN 1 ELSE 0 END)::int AS active
      FROM pg_stat_activity
     WHERE datname = current_database()
  `);
  const stat = (rows as unknown as { connections: number; active: number }[])[0] ?? {
    connections: 0,
    active: 0,
  };
  return NextResponse.json(stat, { headers: { 'Cache-Control': 'no-store' } });
}
