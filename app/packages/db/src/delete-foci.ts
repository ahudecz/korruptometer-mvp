import { sql } from 'drizzle-orm';
import { db as getDb } from './index';

async function main() {
  const db = getDb();
  const result = await db.execute(
    sql`DELETE FROM "NewsArticle" WHERE tag ILIKE '%foci%vb%'`
  );
  console.log('Törölve:', result.count, 'cikk');
}

main().catch(console.error).finally(() => process.exit(0));
