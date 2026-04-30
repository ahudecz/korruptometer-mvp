/**
 * Phase 3 scraper observability seed: pretend each enabled Source ran once.
 * Real outlet adapters live in app/packages/scrapers/<outlet>.ts in Phase 3
 * implementation work; this lets the /admin/scraper-runs page display real
 * rows so the dashboard shape is verifiable end-to-end.
 */
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export async function seedScraperRuns() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const conn = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(conn, { schema });

  const sources = await db.select().from(schema.sources);
  for (const s of sources) {
    const startedAt = new Date(Date.now() - Math.floor(Math.random() * 60_000));
    const finishedAt = new Date(startedAt.getTime() + Math.floor(Math.random() * 5_000));
    await db.insert(schema.scraperRuns).values({
      sourceId: s.id,
      startedAt,
      finishedAt,
      status: 'success',
      articlesFound: Math.floor(Math.random() * 12) + 1,
      articlesNew: Math.floor(Math.random() * 4),
    });
    await db
      .update(schema.sources)
      .set({ lastScrapedAt: startedAt, lastSuccessAt: finishedAt })
      .where(eq(schema.sources.id, s.id));
  }

  await conn.end();
  console.log(`✅ scraper run seed: ${sources.length} runs synthesised`);
}

if (require.main === module) {
  seedScraperRuns().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
