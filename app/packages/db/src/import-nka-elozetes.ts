import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });

import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  // Töröljük a teszt adatot
  await sql`delete from "CourtVerdict"`;
  console.log('Teszt adatok törölve.');

  const verdictDate = new Date('2026-06-23T00:00:00Z');
  const src = 'https://telex.hu/belfold/2026/06/23/nka-botrany-hat-szemelyt-orizetbe-vett-a-nav-hanko-balazs-tarr-zoltan';
  const srcName = 'Telex';
  const srcHeadline = 'NKA-botrány: hat személyt vett őrizetbe a NAV — köztük Bús Balázs volt óbudai polgármester';
  const srcDate = '2026. jún. 23.';
  const crimes = ['hűtlen kezelés', 'költségvetési csalás'];
  const court = 'NAV fogda';
  const baseSummary = 'A NAV 2026. június 23-án hat személyt vett őrizetbe az NKA-botrányban. A nyomozás 17 milliárd forintnyi pályázati pénz sikkasztására irányul — a gyanú szerint a támogatásokat Fidesz-közeli előadókhoz és szervezetekhez csatornázták a 2026-os választások előtt.';

  const persons = [
    {
      personName: 'Bús Balázs',
      personUgyId: 'nka-botrany',
      position: 'Volt fideszes óbudai polgármester, az NKA alelnöke',
      summary: `${baseSummary} Bús Balázs gyanúsítottként hallgatták ki, és részletes vallomást tett.`,
    },
    { personName: 'Ismeretlen NKA-gyanúsított (1.)', personUgyId: 'nka-botrany', position: 'Neve nem nyilvános — NKTK/KIM alkalmazott', summary: baseSummary },
    { personName: 'Ismeretlen NKA-gyanúsított (2.)', personUgyId: 'nka-botrany', position: 'Neve nem nyilvános — NKTK/KIM alkalmazott', summary: baseSummary },
    { personName: 'Ismeretlen NKA-gyanúsított (3.)', personUgyId: 'nka-botrany', position: 'Neve nem nyilvános — NKTK/KIM alkalmazott', summary: baseSummary },
    { personName: 'Ismeretlen NKA-gyanúsított (4.)', personUgyId: 'nka-botrany', position: 'Neve nem nyilvános — NKTK/KIM alkalmazott', summary: baseSummary },
    { personName: 'Ismeretlen NKA-gyanúsított (5.)', personUgyId: 'nka-botrany', position: 'Neve nem nyilvános — NKTK/KIM alkalmazott', summary: baseSummary },
  ];

  for (const p of persons) {
    await sql`
      insert into "CourtVerdict"
        ("personName", "personUgyId", position, crimes, "sentenceYears", "verdictType",
         "verdictDate", court, summary, "sourceUrls", "sourceNames", "sourceHeadlines", "sourceDates")
      values (
        ${p.personName}, ${(p as {personUgyId?: string}).personUgyId ?? null}, ${p.position},
        ${crimes}, 0, 'előzetesben',
        ${verdictDate}, ${court}, ${p.summary},
        ${[src]}, ${[srcName]}, ${[srcHeadline]}, ${[srcDate]}
      )
    `;
    console.log('Beillesztve:', p.personName);
  }

  await sql.end();
  console.log('Kész — 6 NKA-gyanúsított hozzáadva.');
}
main().catch(console.error);
