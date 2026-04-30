import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

export const revalidate = 120;

export async function GET() {
  const db = getDb();
  const snapshot = await db.query.kpiSnapshots.findFirst({
    where: eq(schema.kpiSnapshots.id, 'singleton'),
  });

  if (!snapshot) {
    return NextResponse.json({ error: 'no snapshot' }, { status: 404 });
  }

  return NextResponse.json(
    {
      computedAt: snapshot.computedAt,
      totalDamage: snapshot.totalDamage.toString(),
      totalPrisonYears: snapshot.totalPrisonYears,
      activeCases: snapshot.activeCases,
      newIndictmentsThisWeek: snapshot.newIndictmentsThisWeek,
      partnerCount: snapshot.partnerCount,
      bySector: snapshot.bySector,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
      },
    },
  );
}
