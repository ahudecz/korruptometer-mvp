import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

async function main() {
  const rows = [
    {
      name: 'Gönczi Gábor',
      position: 'műsorvezető',
      institution: 'TV2 Tények',
      resignationType: 'lemondás' as const,
      resignationDate: new Date('2026-04-17T12:00:00Z'),
      description: 'A Tények műsorvezetői közösen úgy döntöttek, hogy elhagyják a műsort. Gönczi Gábor és Marsi Anikó egyszerre mondtak le a TV2 Tények vezető műsorvezetői pozíciójából.',
      pinned: false,
      sourceUrls: ['https://www.origo.hu/itthon/2026/04/tenyek-marsi-aniko-gonczi-gabor-tv2-valtozasok'],
      sourceNames: ['Origo'],
    },
    {
      name: 'Marsi Anikó',
      position: 'műsorvezető',
      institution: 'TV2 Tények',
      resignationType: 'lemondás' as const,
      resignationDate: new Date('2026-04-17T12:00:00Z'),
      description: 'Marsi Anikó és Gönczi Gábor egyszerre mondtak le a TV2 Tények vezető műsorvezetői pozíciójából.',
      pinned: false,
      sourceUrls: ['https://www.origo.hu/itthon/2026/04/tenyek-marsi-aniko-gonczi-gabor-tv2-valtozasok'],
      sourceNames: ['Origo'],
    },
    {
      name: 'Szalai Vivien',
      position: 'hírigazgató',
      institution: 'TV2',
      resignationType: 'kirúgás' as const,
      resignationDate: new Date('2026-04-16T12:00:00Z'),
      description: 'Szalai Vivient kirúgták a TV2 hírigazgatói pozíciójából.',
      pinned: false,
      sourceUrls: ['https://www.origo.hu/itthon/2026/04/tv2-csatorna-szalai-vivien-hirigazgato-valtozas'],
      sourceNames: ['Origo'],
    },
  ];

  for (const row of rows) {
    await db.insert(schema.politicalResignations).values(row).onConflictDoNothing();
    console.log(`✅ Beírva: ${row.name} (${row.resignationDate.toISOString().slice(0, 10)})`);
  }

  console.log('\n✅ Mind a 3 TV2 bejegyzés beírva.');
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
