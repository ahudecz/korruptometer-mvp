import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const rows = await db
    .selectDistinct({ region: schema.cases.region })
    .from(schema.cases)
    .orderBy(sql`region asc`);

  return NextResponse.json(
    { regions: rows.map((r) => r.region) },
    {
      headers: { 'Cache-Control': 'public, s-maxage=3600' },
    },
  );
}
