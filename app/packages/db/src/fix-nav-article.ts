import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const nav = await sql`
    SELECT id, headline, featured, "breakingOverride", "publishedAt"
    FROM "NewsArticle"
    WHERE "sourceUrl" LIKE '%nav.gov.hu%NKA%'
       OR "sourceUrl" LIKE '%Attores_az_NKA%'
    LIMIT 5
  `;
  console.log('NAV cikkek:', nav.length);
  for (const r of nav) console.log(r.id, r.featured, r.breakingOverride, r.headline?.slice(0, 50));

  if (nav[0]) {
    const r = await sql`
      UPDATE "NewsArticle"
      SET featured = false,
          "publishedAt" = '2026-06-23T08:00:00Z'
      WHERE id = ${nav[0].id}
      RETURNING id, headline, featured, "publishedAt"
    `;
    console.log('Frissítve:', r[0]);
  }

  await sql.end();
}
main().catch(console.error);
