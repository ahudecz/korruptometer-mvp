import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const conn = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

const PAGES = [
  { handle: 'panyiszabolcs', name: 'Pányi Szabolcs' },
  { handle: 'Juhi.JuhaszPeter', name: 'Juhász Péter' },
  { handle: 'kormanyzat', name: 'Kormány.hu' },
  { handle: 'peter.magyar.102', name: 'Magyar Péter' },
  { handle: 'dullszabolcsujsagiro', name: 'Dull Szabolcs' },
  { handle: 'kontrollponthu', name: 'Kontrollpont' },
  { handle: 'vastagbor', name: 'Vastagbőr' },
  { handle: 'TransparencyInternationalMagyarorszag', name: 'Transparency International' },
  { handle: 'jamborandrasoldala', name: 'Jámbor András' },
  { handle: 'feketegyorandras.momentum', name: 'Fekete-Győr András' },
];

async function main() {
  for (const page of PAGES) {
    const [row] = await db
      .insert(schema.facebookPages)
      .values({
        pageId: page.handle,
        pageName: page.name,
        pageHandle: page.handle,
        enabled: true,
      })
      .onConflictDoNothing({ target: schema.facebookPages.pageId })
      .returning({ id: schema.facebookPages.id, pageName: schema.facebookPages.pageName });
    console.log(row ? `OK: ${row.pageName}` : `SKIP: ${page.name} már létezik`);
  }

  await conn.end();
  console.log(`\nKész: ${PAGES.length} oldal feldolgozva.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
