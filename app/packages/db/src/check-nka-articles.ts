import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  const rows = await sql`
    SELECT id, headline, featured, "breakingOverride", "isBreakingCandidate", "imageUrl", "publishedAt"
    FROM "NewsArticle"
    WHERE tag = 'NKA' OR "breakingOverride" = true
    ORDER BY "publishedAt" DESC
    LIMIT 15
  `;
  for (const r of rows) {
    console.log(
      r.id.slice(0, 8),
      'feat:', r.featured,
      'break:', r.breakingOverride,
      'cand:', r.isBreakingCandidate,
      'img:', !!r.imageUrl,
      r.headline?.slice(0, 55)
    );
  }
  await sql.end();
}
main().catch(console.error);
