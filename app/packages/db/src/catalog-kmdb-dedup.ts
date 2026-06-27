/**
 * K-Monitor ↔ scraping dedup backfill.
 *
 * For every KMonitorArticle: compute its canonicalUrl + urlHash (same identity
 * the scraper uses) and, where that hash already exists as a scraped
 * NewsArticle.sourceUrlHash, set matchedNewsArticleId. Matched rows become
 * enrichment for the scraped article and are excluded from the engine as a
 * separate extraction input (see catalog-bootstrap / extract-claims).
 *
 * Idempotent. DRY_RUN=1 reports the match rate without writing.
 * Usage: pnpm --filter @korr/db exec tsx src/catalog-kmdb-dedup.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import postgres from 'postgres';
import { urlIdentity } from './url-canonical';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const DRY_RUN = process.env.DRY_RUN === '1';

const sql = postgres(DB_URL, { prepare: false, max: 4 });

async function main() {
  const rows = await sql<{ newsId: number; sourceUrl: string | null }[]>`
    SELECT "newsId", "sourceUrl" FROM "KMonitorArticle"
  `;
  console.log(`backfilling urlHash for ${rows.length} KMonitorArticle rows (DRY_RUN=${DRY_RUN})`);

  let hashed = 0;
  let matched = 0;
  const BATCH = 500;
  let pending: { newsId: number; canonical: string; hash: string }[] = [];

  async function flush() {
    if (!pending.length) return;
    if (!DRY_RUN) {
      for (const p of pending) {
        await sql`
          UPDATE "KMonitorArticle"
          SET "canonicalUrl" = ${p.canonical}, "urlHash" = ${p.hash},
              "matchedNewsArticleId" = (
                SELECT id FROM "NewsArticle" WHERE "sourceUrlHash" = ${p.hash} LIMIT 1
              )
          WHERE "newsId" = ${p.newsId}`;
      }
    }
    pending = [];
  }

  for (const r of rows) {
    const id = urlIdentity(r.sourceUrl);
    if (!id) continue;
    hashed++;
    pending.push({ newsId: r.newsId, canonical: id.canonical, hash: id.hash });
    if (pending.length >= BATCH) {
      await flush();
      process.stdout.write(`  ${hashed}/${rows.length} hashed\r`);
    }
  }
  await flush();

  const m = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c FROM "KMonitorArticle" k
    WHERE EXISTS (SELECT 1 FROM "NewsArticle" n WHERE n."sourceUrlHash" = k."urlHash")
  `;
  matched = m[0]?.c ?? 0;
  // In DRY_RUN nothing was written, so report the prospective match by hashing here.
  if (DRY_RUN) {
    const hashes = new Set(
      rows.map((r) => urlIdentity(r.sourceUrl)?.hash).filter(Boolean) as string[],
    );
    const news = await sql<{ h: string }[]>`SELECT "sourceUrlHash" AS h FROM "NewsArticle"`;
    matched = news.filter((n) => hashes.has(n.h)).length;
  }

  console.log(`\nhashed ${hashed}/${rows.length}; overlap with scraped NewsArticle: ${matched} URLs`);
  console.log(DRY_RUN ? 'DRY_RUN — no changes written.' : 'done.');
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
