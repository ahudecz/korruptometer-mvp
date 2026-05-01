import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/scraper-runs (T173) — per-source dashboard rows joined to
 * the latest ScraperRun. Powers the JSON shape behind /admin/scraper-runs.
 */
export async function GET() {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const db = getDb();
  const sources = await db.select().from(schema.sources);
  const latestRuns = await db
    .select({
      id: schema.scraperRuns.id,
      sourceId: schema.scraperRuns.sourceId,
      sourceName: schema.sources.name,
      sourceSlug: schema.sources.slug,
      startedAt: schema.scraperRuns.startedAt,
      finishedAt: schema.scraperRuns.finishedAt,
      status: schema.scraperRuns.status,
      articlesFound: schema.scraperRuns.articlesFound,
      articlesNew: schema.scraperRuns.articlesNew,
      errorMessage: schema.scraperRuns.errorMessage,
    })
    .from(schema.scraperRuns)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.scraperRuns.sourceId))
    .orderBy(desc(schema.scraperRuns.startedAt))
    .limit(50);

  return NextResponse.json({ sources, latestRuns }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
