import { NextResponse } from 'next/server';
import { desc, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const db = getDb();
  const { politicalResignations } = schema;

  try {
    const rows = await db
      .select()
      .from(politicalResignations)
      .orderBy(desc(politicalResignations.resignationDate))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql`count(*)` })
      .from(politicalResignations);
    const total = parseInt(String(countResult[0]?.count || 0));

    const headers = new Headers({
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    });

    return NextResponse.json(
      {
        items: rows,
        total,
        limit,
        offset,
      },
      { headers },
    );
  } catch (error) {
    console.error('Resignations API error:', error);
    return NextResponse.json(
      { error: 'Adatbázis hiba' },
      { status: 500 },
    );
  }
}
