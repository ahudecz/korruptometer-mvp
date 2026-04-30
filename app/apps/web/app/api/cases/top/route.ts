import { NextResponse } from 'next/server';
import { desc, eq, asc } from 'drizzle-orm';
import { z } from 'zod';

import { getDb, schema } from '@/lib/db';

export const revalidate = 300;

const querySchema = z.object({
  n: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { n } = querySchema.parse(Object.fromEntries(url.searchParams));

  const db = getDb();
  const { cases, rogueProfiles } = schema;

  const rows = await db
    .select({
      case: cases,
      rogue: rogueProfiles,
    })
    .from(cases)
    .leftJoin(rogueProfiles, eq(rogueProfiles.caseId, cases.id))
    .orderBy(desc(cases.amount), asc(cases.id))
    .limit(n);

  return NextResponse.json(
    {
      items: rows.map((r) => ({
        case: { ...r.case, amount: r.case.amount.toString() },
        rogue: r.rogue,
      })),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
      },
    },
  );
}
