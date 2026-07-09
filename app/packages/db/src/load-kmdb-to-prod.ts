/**
 * Copies the already-ingested local "KmdbArticle" table (64,644 K-Monitor
 * articles, loaded 2026-06-30 from the kmdb_base Hugging Face dataset) into
 * PROD. Reuses the local data instead of re-downloading/re-parsing the 173MB
 * parquet — it's only ~9 days stale against the weekly-refreshed HF source,
 * which is close enough for "Kapcsolódó hírek" + case-description grounding.
 *
 * Run: pnpm --filter @korr/db exec tsx src/load-kmdb-to-prod.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import postgres from 'postgres';
import { assertWriteTarget } from './guard';

const LOCAL_URL = 'postgresql://postgres:SPORTwavez80@127.0.0.1:5432/nextjs_db';
const PROD_URL = process.env.PROD_DATABASE_URL;
if (!PROD_URL) throw new Error('PROD_DATABASE_URL not set');

process.env.DATABASE_URL = PROD_URL;

const BATCH_SIZE = 2000;

async function main() {
  assertWriteTarget('load-kmdb-to-prod');

  const local = postgres(LOCAL_URL, { prepare: false });
  const prod = postgres(PROD_URL, { prepare: false, max: 1 });

  await prod`
    CREATE TABLE IF NOT EXISTS "KmdbArticle" (
      news_id      bigint PRIMARY KEY,
      title        text,
      description  text,
      source_url   text,
      kmdb_url     text,
      newspaper    text,
      pub_time     text,
      persons      text[] NOT NULL,
      institutions text[] NOT NULL,
      files        text[] NOT NULL,
      others       text[] NOT NULL
    )
  `;
  await prod`CREATE INDEX IF NOT EXISTS "KmdbArticle_persons_gin" ON "KmdbArticle" USING gin (persons)`;
  await prod`CREATE INDEX IF NOT EXISTS "KmdbArticle_files_gin" ON "KmdbArticle" USING gin (files)`;

  const [{ n: localCount }] = await local`SELECT count(*)::int AS n FROM "KmdbArticle"`;
  console.log(`Local rows: ${localCount}`);

  let inserted = 0;
  const cursor = local`
    SELECT news_id, title, description, source_url, kmdb_url, newspaper, pub_time,
           persons, institutions, files, others
    FROM "KmdbArticle"
    ORDER BY news_id
  `.cursor(BATCH_SIZE);

  for await (const rows of cursor) {
    await prod`
      INSERT INTO "KmdbArticle" ${prod(
        rows,
        'news_id', 'title', 'description', 'source_url', 'kmdb_url',
        'newspaper', 'pub_time', 'persons', 'institutions', 'files', 'others',
      )}
      ON CONFLICT (news_id) DO NOTHING
    `;
    inserted += rows.length;
    console.log(`  ${inserted}/${localCount}`);
  }

  const [{ n: prodCount }] = await prod`SELECT count(*)::int AS n FROM "KmdbArticle"`;
  console.log(`Prod rows after load: ${prodCount}`);

  await local.end();
  await prod.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
