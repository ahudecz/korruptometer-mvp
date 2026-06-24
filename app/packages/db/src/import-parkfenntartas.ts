import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });

import postgres from 'postgres';
import { randomUUID } from 'node:crypto';

function pgArr(items: string[]): string {
  return '{' + items.map(i => `"${i.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',') + '}';
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const PARK_SOURCE_URLS = [
    'https://telex.hu/belfold/2026/06/04/orsi-gergely-reakcio-letartoztatas',
    'https://hvg.hu/itthon/20260605_bunismetles-parkfenntartasi-kenopenzbotrany-gyanusitott-letartoztatas',
  ];
  const PARK_SOURCE_NAMES = ['Telex', 'HVG'];
  const PARK_SOURCE_HEADLINES = [
    'Letartóztatva: Őrsi Gergely és más politikusok — parkfenntartási kenőpénzbotrány',
    'Bűnismétlés — gyanúsítotti letartóztatás a parkfenntartási kenőpénzbotrányban',
  ];
  const PARK_SOURCE_DATES = ['2026. június 4.', '2026. június 5.'];

  const persons = [
    {
      personName: 'Őrsi Gergely',
      position: 'II. kerületi polgármester (DK)',
      summary: 'A II. kerületi polgármestert 2026. június 4-én tartóztatta le a Fővárosi Törvényszék befolyással üzérkedés és vesztegetés gyanújával a parkfenntartási kenőpénzbotrányban. Letartóztatása napján nyilatkozatot adott ki, amelyben tagadja a gyanúsítást.',
    },
    {
      personName: 'Láng Zsolt',
      position: 'II. kerület volt polgármestere (Fidesz)',
      summary: 'A II. kerület korábbi fideszes polgármesterét 2026. június 4-én tartóztatta le a Fővárosi Törvényszék a parkfenntartási kenőpénzbotrányban. Gyanú: befolyással üzérkedés és vesztegetés.',
    },
    {
      personName: 'Puskás Péter',
      position: 'Óbudai Fidesz-elnök (III. ker.)',
      summary: '2026. június 4-én tartóztatta le a Fővárosi Törvényszék a parkfenntartási kenőpénzbotrányban. Puskás Péter aláírta az óbudai parkolási és parkfenntartási szerződéseket. Gyanú: befolyással üzérkedés és vesztegetés.',
    },
    {
      personName: 'Szkaliczki Tünde',
      position: 'Momentum, volt képviselő',
      summary: 'A Momentum korábbi képviselőjét 2026. június 4-én tartóztatta le a Fővárosi Törvényszék a parkfenntartási kenőpénzbotrányban. Gyanú: befolyással üzérkedés és vesztegetés.',
    },
    {
      personName: 'Matisz Károly',
      position: 'Momentum pártigazgató',
      summary: 'A Momentum pártigazgatóját 2026. június 4-én tartóztatta le a Fővárosi Törvényszék a parkfenntartási kenőpénzbotrányban. Gyanú: befolyással üzérkedés és vesztegetés.',
    },
    {
      personName: 'Molnár Zsolt',
      position: 'MSZP, volt OGY-képviselő',
      summary: 'Az MSZP korábbi országgyűlési képviselőjét 2026. június 4-én tartóztatta le a Fővárosi Törvényszék a parkfenntartási kenőpénzbotrányban. Gyanú: befolyással üzérkedés és vesztegetés.',
    },
  ];

  for (const p of persons) {
    const id = randomUUID();
    await sql`
      INSERT INTO "CourtVerdict" (
        id,
        "personName",
        position,
        crimes,
        "sentenceYears",
        "sentenceMonths",
        "verdictType",
        "verdictDate",
        court,
        summary,
        "sourceUrls",
        "sourceNames",
        "sourceHeadlines",
        "sourceDates",
        "personUgyId"
      ) VALUES (
        ${id},
        ${p.personName},
        ${p.position},
        ${pgArr(['befolyással üzérkedés', 'vesztegetés'])}::text[],
        ${0},
        ${null},
        ${'előzetesben'},
        ${'2026-06-04'},
        ${'Fővárosi Törvényszék'},
        ${p.summary},
        ${pgArr(PARK_SOURCE_URLS)}::text[],
        ${pgArr(PARK_SOURCE_NAMES)}::text[],
        ${pgArr(PARK_SOURCE_HEADLINES)}::text[],
        ${pgArr(PARK_SOURCE_DATES)}::text[],
        ${'parkfenntartas'}
      )
    `;
    console.log('Hozzáadva:', p.personName, id);
  }

  await sql.end();
  console.log('\nKész — 6 személy importálva a parkfenntartási ügyhöz.');
}

main().catch(console.error);
