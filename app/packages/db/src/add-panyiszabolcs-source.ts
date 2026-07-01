import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const conn = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

async function main() {
  const [row] = await db
    .insert(schema.sources)
    .values({
      slug: 'panyiszabolcs',
      name: 'Panyi Szabolcs',
      homepage: 'https://panyiszabolcs.substack.com',
      tag: 'investigative',
    })
    .onConflictDoNothing({ target: schema.sources.slug })
    .returning({ id: schema.sources.id, slug: schema.sources.slug });

  console.log(row ? `OK: ${row.slug} (${row.id})` : 'SKIP: source already exists');
  await conn.end();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
