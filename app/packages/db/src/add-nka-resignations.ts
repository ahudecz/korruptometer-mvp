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
      name: 'Bús Balázs',
      position: 'NKA alelnök',
      institution: 'Nemzeti Kulturális Alap',
      resignationType: 'lemondás' as const,
      resignationDate: new Date('2026-04-28T12:00:00Z'),
      description: 'Bús Balázs, az NKA alelnöke lemondott tisztségéről az NKA körüli milliárdos támogatási botrány kirobbanása után.',
      pinned: false,
      sourceUrls: ['https://telex.hu/belfold/2026/04/28/bus-balazs-nka-alelnok-lemondott-fidesz-celebek'],
      sourceNames: ['Telex'],
    },
    {
      name: 'Báán László',
      position: 'NKA bizottsági tag',
      institution: 'Nemzeti Kulturális Alap',
      resignationType: 'lemondás' as const,
      resignationDate: new Date('2026-04-30T12:00:00Z'),
      description: 'Báán László lemondott az NKA bizottsági tagságáról a Hankó Balázs által vezérelt szabálytalan milliárdos támogatások botrányát követően.',
      pinned: false,
      sourceUrls: ['https://telex.hu/belfold/2026/04/30/baan-laszlo-nemzeti-kulturalis-alap-bizottsagi-tagsag-lemondas'],
      sourceNames: ['Telex'],
    },
    {
      name: 'Vidnyánszky Attila',
      position: 'NKA bizottsági tag',
      institution: 'Nemzeti Kulturális Alap',
      resignationType: 'lemondás' as const,
      resignationDate: new Date('2026-05-02T12:00:00Z'),
      description: 'Vidnyánszky Attila lemondott az NKA bizottsági tagságáról. Lemondólevelében a Hankó Balázs alatt osztott milliárdos NKA-támogatásokat és a Fidesz-kampányarcok finanszírozását jelölte meg okként.',
      pinned: false,
      sourceUrls: ['https://telex.hu/belfold/2026/05/02/vidnyanszky-attila-lemondott-a-nemzeti-kulturalis-alap-nka-bizottsagi-tagsagarol-hanko-balazs-tavozo-miniszter-milliardos-tamogatas-osztogatas-fidesz'],
      sourceNames: ['Telex'],
    },
  ];

  for (const row of rows) {
    await db.insert(schema.politicalResignations).values(row).onConflictDoNothing();
    console.log(`✅ Beírva: ${row.name} (${row.resignationDate.toISOString().slice(0, 10)})`);
  }

  console.log('\n✅ Mind a 3 NKA lemondás beírva.');
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
