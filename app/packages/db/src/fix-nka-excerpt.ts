import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  // Show all Telex NKA articles
  const all = await sql`
    SELECT id, "createdAt", "isBreakingCandidate", "breakingOverride", featured, excerpt
    FROM "NewsArticle"
    WHERE "sourceUrl" LIKE '%2026/06/23/nka-botrany-hat-szemelyt%'
    ORDER BY "createdAt" DESC
  `;
  console.log('Jelenlegi cikkek:', all.length);
  for (const r of all) {
    console.log(r.id, r.createdAt, 'cand:', r.isBreakingCandidate, 'break:', r.breakingOverride, 'feat:', r.featured);
    console.log('  excerpt:', r.excerpt?.slice(0, 80));
  }

  if (all.length === 2) {
    // Delete newest (manual insert), update remaining with long excerpt
    const toDelete = all[0].id;
    const toKeep   = all[1].id;
    const longExcerpt = 'A NAV nyomozói 2026. június 23-án hat személyt vettek őrizetbe hűtlen kezelés bűntett megalapozott gyanúja miatt — köztük Bús Balázs volt fideszes óbudai polgármestert, az NKA alelnökét, aki részletes vallomást tett.';
    await sql`UPDATE "NewsArticle" SET excerpt = ${longExcerpt} WHERE id = ${toKeep}`;
    await sql`DELETE FROM "NewsArticle" WHERE id = ${toDelete}`;
    console.log('\nTörölve:', toDelete);
    console.log('Frissítve (excerpt):', toKeep);
  } else if (all.length === 1) {
    // Only one left — just update excerpt
    const longExcerpt = 'A NAV nyomozói 2026. június 23-án hat személyt vettek őrizetbe hűtlen kezelés bűntett megalapozott gyanúja miatt — köztük Bús Balázs volt fideszes óbudai polgármestert, az NKA alelnökét, aki részletes vallomást tett.';
    await sql`UPDATE "NewsArticle" SET excerpt = ${longExcerpt} WHERE id = ${all[0].id}`;
    console.log('\nExcerpt frissítve:', all[0].id);
  }

  await sql.end();
}
main().catch(console.error);
