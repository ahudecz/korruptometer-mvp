import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(__dirname, '../../../.env.local') });

import postgres from 'postgres';

const PROD = process.env.PROD_DATABASE_URL;
if (!PROD) throw new Error('PROD_DATABASE_URL nincs beállítva');

const sql = postgres(PROD, { ssl: 'require', max: 1, connect_timeout: 15 });

async function main() {
  const check = await sql`
    SELECT id, headline, "isBreakingCandidate", "sourceUrl"
    FROM "NewsArticle"
    WHERE
      "sourceUrl" ILIKE '%koltay-andras-nmhh-felmentes%'
      OR "sourceUrl" ILIKE '%titkosszolgalat-elere-magyar-peter-most-menesztette%'
  `;

  console.log('Talált cikkek:', check.length);
  check.forEach(r => console.log(' -', r.id, '|', r.headline?.slice(0, 70), '| breaking:', r.isBreakingCandidate));

  if (check.length === 0) {
    console.log('\n⚠️  Nincs találat URL alapján. Próbálom headline-nal...');
    const byHead = await sql`
      SELECT id, headline, "isBreakingCandidate", "sourceUrl"
      FROM "NewsArticle"
      WHERE
        headline ILIKE '%koltay%nmhh%'
        OR headline ILIKE '%titkosszolgalat%menesztette%'
        OR "sourceUrl" ILIKE '%444%titkos%menesztette%'
      ORDER BY "publishedAt" DESC
      LIMIT 10
    `;
    console.log('Headline-alapú találatok:', byHead.length);
    byHead.forEach(r => console.log(' -', r.id, '|', r.headline?.slice(0, 70), '|', r.sourceUrl?.slice(0, 80)));
    return;
  }

  const updated = await sql`
    UPDATE "NewsArticle"
    SET "isBreakingCandidate" = true
    WHERE
      "sourceUrl" ILIKE '%koltay-andras-nmhh-felmentes%'
      OR "sourceUrl" ILIKE '%titkosszolgalat-elere-magyar-peter-most-menesztette%'
    RETURNING id, headline, "isBreakingCandidate"
  `;

  console.log('\n✅ Frissítve:', updated.length, 'cikk');
  updated.forEach(r => console.log(' -', r.headline?.slice(0, 70)));

  await sql.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
