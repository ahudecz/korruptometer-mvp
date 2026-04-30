import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const db = getDb();
    const result = await db.execute(sql`SELECT 1 AS ok`);
    if (Array.isArray(result) && result.length > 0) {
      return NextResponse.json({ status: 'ok' }, { headers });
    }
    return NextResponse.json({ status: 'degraded' }, { status: 503, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json(
      { status: 'down', error: message },
      { status: 503, headers },
    );
  }
}
