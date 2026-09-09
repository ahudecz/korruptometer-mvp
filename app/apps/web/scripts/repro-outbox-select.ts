/** Diagnosztika: pontosan azt a Drizzle-hívást futtatja, amit a Telegram
 *  webhook 's' ága csinál (select() = MINDEN oszlop), hogy kiderüljön,
 *  elszáll-e éles adaton. */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: 'C:/Users/bbmar/Documents/korruptometer-mvp/app/.env.local' });
process.env.DATABASE_URL = process.env.PROD_DATABASE_URL;

import { eq } from 'drizzle-orm';
import { getDb, schema } from '../src/lib/db';

const ID = '33e2b71d-1e45-47b0-92d3-9140aae2d665';

async function main() {
  const db = getDb();
  try {
    const rows = await db.select().from(schema.socialPostOutbox).where(eq(schema.socialPostOutbox.id, ID)).limit(1);
    console.log('SELECT * OK — sorok:', rows.length, '| status:', rows[0]?.status, '| caption hossz:', rows[0]?.caption?.length);
  } catch (e) {
    console.error('SELECT * ELSZÁLLT:', (e as Error).message);
  }
  process.exit(0);
}
main();
