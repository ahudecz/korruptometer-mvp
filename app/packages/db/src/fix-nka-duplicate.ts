import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  // Delete the manually inserted duplicate (my script's insert)
  // The scraper's original article (516d2f09) already has breakingOverride+imageUrl+featured
  const deleted = await sql`
    DELETE FROM "NewsArticle"
    WHERE id = '72ea2540-0000-0000-0000-000000000000'
  `;

  // Get actual id by sourceUrl + newest createdAt (my insert has a later createdAt)
  const dupes = await sql`
    SELECT id, "createdAt", "publishedAt", "isBreakingCandidate"
    FROM "NewsArticle"
    WHERE "sourceUrl" LIKE '%2026/06/23/nka-botrany-hat-szemelyt%'
    ORDER BY "createdAt" DESC
  `;
  console.log('Duplikátumok:', dupes.length);
  for (const d of dupes) console.log(d.id, d.createdAt, d.isBreakingCandidate);

  if (dupes.length >= 2) {
    // Delete the newest one (my manual insert — createdAt is latest)
    const toDelete = dupes[0].id;
    await sql`DELETE FROM "NewsArticle" WHERE id = ${toDelete}`;
    console.log('Törölve:', toDelete);
  }

  await sql.end();
}
main().catch(console.error);
