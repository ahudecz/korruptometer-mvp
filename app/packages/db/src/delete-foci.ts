import { sql } from 'drizzle-orm';
import { getDb } from './index';

async function main() {
  const db = getDb();
  const result = await db.execute(
    sql`DELETE FROM "NewsArticle" WHERE tag ILIKE '%foci%vb%'`
  );
  console.log('Törölve:', result.rowCount, 'cikk');
}

main().catch(console.error).finally(() => process.exit(0));
