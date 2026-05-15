import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: 'csak szerkesztő' }, { status: 403 });
  }
  const { id } = await params;
  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '', 10) || DEFAULT_LIMIT),
    MAX_LIMIT,
  );
  const offset = Math.max(
    0,
    Number.parseInt(url.searchParams.get('offset') ?? '', 10) || 0,
  );

  const db = getDb();

  const rows = await db
    .select({
      newsId: schema.kMonitorArticles.newsId,
      title: schema.kMonitorArticles.title,
      sourceUrl: schema.kMonitorArticles.sourceUrl,
      archiveUrl: schema.kMonitorArticles.archiveUrl,
      pubTime: schema.kMonitorArticles.pubTime,
      newspaper: schema.kMonitorArticles.newspaper,
      topics: schema.kMonitorArticles.topics,
      amountHuf: schema.kMonitorPersonArticles.amountHuf,
    })
    .from(schema.kMonitorPersonArticles)
    .innerJoin(
      schema.kMonitorArticles,
      eq(schema.kMonitorArticles.newsId, schema.kMonitorPersonArticles.newsId),
    )
    .where(eq(schema.kMonitorPersonArticles.personId, id))
    .orderBy(
      sql`${schema.kMonitorPersonArticles.amountHuf} DESC NULLS LAST`,
      desc(schema.kMonitorArticles.pubTime),
    )
    .limit(limit)
    .offset(offset);

  const totalRows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.kMonitorPersonArticles)
    .where(eq(schema.kMonitorPersonArticles.personId, id));
  const total = totalRows[0]?.total ?? 0;

  return NextResponse.json({
    total,
    offset,
    limit,
    articles: rows.map((r) => ({
      newsId: r.newsId,
      title: r.title,
      sourceUrl: r.sourceUrl,
      archiveUrl: r.archiveUrl,
      pubTime: r.pubTime ? r.pubTime.toISOString() : null,
      newspaper: r.newspaper,
      topics: r.topics ?? [],
      amountHuf: r.amountHuf == null ? null : r.amountHuf.toString(),
    })),
  });
}
