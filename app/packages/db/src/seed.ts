/**
 * Seed for Phase 1 — 12 cases + their RogueProfile rows + 5 sources + KpiSnapshot
 * + a small set of NewsArticle rows linked to seeded cases.
 *
 * Pinned to the data shape in 01-tesla/index.html:1955-2282 at tag mockup-port-base-v1.
 */

import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

// Walk up from this file to find the workspace .env.local first.
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

import * as schema from './schema';
import {
  cases,
  editors,
  kpiSnapshots,
  newsArticles,
  rogueProfiles,
  sources,
} from './schema';

const CASE_DATA = [
  { id: 'KM-001', name: 'K. Zoltán', position: 'Volt államtitkár', amount: 4_200_000_000n, sentenceYears: 8, caseYear: 2019, status: 'Vádemelés' as const, region: 'Budapest', sector: 'Közbeszerzés' as const },
  { id: 'KM-002', name: 'N. Imre', position: 'Polgármester', amount: 850_000_000n, sentenceYears: 3, caseYear: 2020, status: 'Folyamatban' as const, region: 'Pest', sector: 'Önkormányzat' as const },
  { id: 'KM-003', name: 'S. Péter', position: 'Cégvezető', amount: 12_500_000_000n, sentenceYears: 12, caseYear: 2018, status: 'Lezárva' as const, region: 'Budapest', sector: 'Állami vállalat' as const },
  { id: 'KM-004', name: 'T. László', position: 'Volt miniszteri biztos', amount: 6_800_000_000n, sentenceYears: 9, caseYear: 2021, status: 'Vádemelés' as const, region: 'Hajdú-Bihar', sector: 'Közbeszerzés' as const },
  { id: 'KM-005', name: 'V. Gábor', position: 'Önkormányzati képviselő', amount: 320_000_000n, sentenceYears: 2, caseYear: 2022, status: 'Folyamatban' as const, region: 'Csongrád', sector: 'Önkormányzat' as const },
  { id: 'KM-006', name: 'B. Krisztián', position: 'EU pályázati tanácsadó', amount: 9_400_000_000n, sentenceYears: 11, caseYear: 2017, status: 'Lezárva' as const, region: 'Budapest', sector: 'EU pályázat' as const },
  { id: 'KM-007', name: 'H. Tamás', position: 'Állami vállalat igazgató', amount: 5_600_000_000n, sentenceYears: 7, caseYear: 2020, status: 'Vádemelés' as const, region: 'Borsod', sector: 'Állami vállalat' as const },
  { id: 'KM-008', name: 'M. Eszter', position: 'Közbeszerzési referens', amount: 180_000_000n, sentenceYears: 1, caseYear: 2023, status: 'Folyamatban' as const, region: 'Budapest', sector: 'Közbeszerzés' as const },
  { id: 'KM-009', name: 'F. Csaba', position: 'Volt képviselő', amount: 7_200_000_000n, sentenceYears: 10, caseYear: 2019, status: 'Lezárva' as const, region: 'Győr-Moson', sector: 'EU pályázat' as const },
  { id: 'KM-010', name: 'P. Bence', position: 'Min. főosztályvezető', amount: 2_100_000_000n, sentenceYears: 5, caseYear: 2021, status: 'Vádemelés' as const, region: 'Budapest', sector: 'EU pályázat' as const },
  { id: 'KM-011', name: 'R. Andrea', position: 'Kórházigazgató', amount: 480_000_000n, sentenceYears: 3, caseYear: 2022, status: 'Folyamatban' as const, region: 'Veszprém', sector: 'Egészségügy' as const },
  { id: 'KM-012', name: 'D. Ákos', position: 'Iparkamarai vezető', amount: 1_350_000_000n, sentenceYears: 4, caseYear: 2020, status: 'Lezárva' as const, region: 'Fejér', sector: 'Egyéb' as const },
];

type Hair = 'short' | 'bald' | 'wave' | 'cap' | 'slick';
type Det = 'loose' | 'wanted' | 'busted' | 'pretrial' | 'investig';

const ROGUE_DATA: Record<string, {
  variant: number;
  glasses: boolean;
  hair: Hair;
  detention: Det;
  detentionLabel: string;
  crimes: string[];
  extraStatus: string;
}> = {
  'KM-001': { variant: 0, glasses: false, hair: 'short', detention: 'loose', detentionLabel: 'SZABADLÁBON', crimes: ['Hivatali visszaélés', 'Korrupció'], extraStatus: 'Tárgyalás 2024-ben' },
  'KM-002': { variant: 1, glasses: true, hair: 'short', detention: 'wanted', detentionLabel: 'KÖRÖZÖTT', crimes: ['Korrupció', 'Közbeszerzés'], extraStatus: 'Külföldre szökött' },
  'KM-003': { variant: 2, glasses: false, hair: 'bald', detention: 'busted', detentionLabel: 'BÖRTÖNBEN · 12 ÉV', crimes: ['Túlárazás', 'Állami vállalat'], extraStatus: 'Jogerős, 2022' },
  'KM-004': { variant: 3, glasses: true, hair: 'wave', detention: 'loose', detentionLabel: 'SZABADLÁBON', crimes: ['Közbeszerzési csalás', 'Kartell'], extraStatus: 'Óvadékkal kiengedve' },
  'KM-005': { variant: 4, glasses: false, hair: 'cap', detention: 'investig', detentionLabel: 'VIZSGÁLAT ALATT', crimes: ['Önkormányzat', 'Korrupció'], extraStatus: 'Felfüggesztve' },
  'KM-006': { variant: 0, glasses: false, hair: 'slick', detention: 'busted', detentionLabel: 'BÖRTÖNBEN · 11 ÉV', crimes: ['EU-csalás', 'Korrupció'], extraStatus: 'Jogerős, 2020' },
  'KM-007': { variant: 1, glasses: false, hair: 'short', detention: 'pretrial', detentionLabel: 'ELŐZETESBEN', crimes: ['Túlárazás', 'Korrupció'], extraStatus: '11 hónapja letartóztatva' },
  'KM-008': { variant: 2, glasses: true, hair: 'short', detention: 'investig', detentionLabel: 'VIZSGÁLAT ALATT', crimes: ['Közbeszerzés'], extraStatus: 'NAV-vizsgálat' },
  'KM-009': { variant: 3, glasses: false, hair: 'bald', detention: 'busted', detentionLabel: 'BÖRTÖNBEN · 10 ÉV', crimes: ['EU-csalás', 'Hivatali visszaélés'], extraStatus: 'Jogerős, 2023' },
  'KM-010': { variant: 4, glasses: true, hair: 'wave', detention: 'loose', detentionLabel: 'SZABADLÁBON', crimes: ['EU-csalás'], extraStatus: 'Útlevele bevonva' },
  'KM-011': { variant: 0, glasses: false, hair: 'short', detention: 'investig', detentionLabel: 'VIZSGÁLAT ALATT', crimes: ['Közbeszerzés'], extraStatus: 'Felfüggesztett szolgálat' },
  'KM-012': { variant: 1, glasses: false, hair: 'cap', detention: 'busted', detentionLabel: 'BÖRTÖNBEN · 4 ÉV', crimes: ['Kartell', 'Korrupció'], extraStatus: 'Jogerős, 2021' },
};

const SOURCE_DATA = [
  { slug: 'telex', name: 'Telex', homepage: 'https://telex.hu', tag: 'national' as const },
  { slug: '444', name: '444', homepage: 'https://444.hu', tag: 'national' as const },
  { slug: 'hvg', name: 'HVG', homepage: 'https://hvg.hu', tag: 'national' as const },
  { slug: 'magyar-hang', name: 'Magyar Hang', homepage: 'https://hang.hu', tag: 'national' as const },
  { slug: 'atlatszo', name: 'Átlátszó', homepage: 'https://atlatszo.hu', tag: 'investigative' as const },
  { slug: '24hu', name: '24.hu', homepage: 'https://24.hu', tag: 'national' as const },
  { slug: 'kontroll', name: 'Kontroll', homepage: 'https://kontroll.hu', tag: 'national' as const },
  { slug: 'vastagbor', name: 'Vastagbőr', homepage: 'https://vastagbor.hu', tag: 'newsletter' as const },
  { slug: 'direkt36', name: 'Direkt36', homepage: 'https://direkt36.hu', tag: 'investigative' as const },
  { slug: 'valasz', name: 'Válasz Online', homepage: 'https://www.valaszonline.hu', tag: 'national' as const },
  { slug: 'nepszava', name: 'Népszava', homepage: 'https://nepszava.hu', tag: 'national' as const },
  { slug: 'jambor', name: 'Jámbor András', homepage: 'https://www.jamborandras.hu', tag: 'newsletter' as const },
];

const ARTICLE_SEED: { sourceSlug: string; headline: string; excerpt: string; url: string; published: string; tag: string | null; relatedCaseId: string | null; featured?: boolean }[] = [
  { sourceSlug: 'atlatszo', headline: 'Új vádemelés a 12 milliárdos állami beszerzési ügyben', excerpt: 'A nyomozás lezárult, a fővádlott jogerős ítéletre vár — ügyészségi források szerint új vádpontok is felmerülhetnek.', url: 'https://atlatszo.hu/2026/04/01/uj-vademeles-12-milliard', published: '2026-04-12T08:00:00Z', tag: 'kiemelt', relatedCaseId: 'KM-003', featured: true },
  { sourceSlug: 'telex', headline: 'Önkormányzati biztos lemondatása után újabb gyanúsítások', excerpt: 'A polgármesteri hivatal négy munkatársa ellen indult eljárás közbeszerzési visszaélés miatt.', url: 'https://telex.hu/belfold/2026/04/15/gyanusitasok', published: '2026-04-15T07:30:00Z', tag: 'belfold', relatedCaseId: 'KM-002' },
  { sourceSlug: '444', headline: 'EU-csalás: kiadták a körözést egy volt képviselőre', excerpt: 'Belföldi és nemzetközi körözést rendelt el a bíróság. A bizonyítékok között uniós támogatási dokumentumok vannak.', url: 'https://444.hu/2026/04/18/eu-csalas-korozes', published: '2026-04-18T11:00:00Z', tag: 'eu-csalás', relatedCaseId: 'KM-006' },
  { sourceSlug: 'hvg', headline: 'Másfél milliárdos kartellügy zárult', excerpt: 'A Versenyhivatal jogerős döntése értelmében az érintett vállalkozások bírságot fizetnek és vezetőjük szabadságvesztést kap.', url: 'https://hvg.hu/itthon/2026/04/22/kartell', published: '2026-04-22T09:30:00Z', tag: 'kartell', relatedCaseId: 'KM-012' },
  { sourceSlug: 'magyar-hang', headline: 'NAV-vizsgálat egy budapesti közbeszerzési referensnél', excerpt: 'A vizsgálat előzménye egy bejelentés, amely a beszerzési értékek manipulálását veti fel.', url: 'https://hang.hu/2026/04/24/nav-vizsgalat', published: '2026-04-24T13:15:00Z', tag: 'NAV', relatedCaseId: 'KM-008' },
  { sourceSlug: 'telex', headline: 'Heti összegzés: négy új vádemelés', excerpt: 'Az elmúlt héten négy új vádemelés érkezett a Korruptométer adatbázisába; két ügyben kiemelt érdek fűződik a feldolgozáshoz.', url: 'https://telex.hu/heti-osszegzes/2026-04-29', published: '2026-04-29T05:00:00Z', tag: 'heti', relatedCaseId: null },
];

function urlHash(u: string): string {
  return createHash('sha256').update(u).digest('hex');
}

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set to seed the DB');
  }
  const conn = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(conn, { schema });

  console.log('🌱 seeding cases…');
  for (const c of CASE_DATA) {
    await db
      .insert(cases)
      .values({
        id: c.id,
        name: c.name,
        position: c.position,
        amount: c.amount,
        sentenceYears: c.sentenceYears,
        caseYear: c.caseYear,
        status: c.status,
        region: c.region,
        sector: c.sector,
      })
      .onConflictDoUpdate({
        target: cases.id,
        set: {
          name: c.name,
          position: c.position,
          amount: c.amount,
          sentenceYears: c.sentenceYears,
          caseYear: c.caseYear,
          status: c.status,
          region: c.region,
          sector: c.sector,
          updatedAt: new Date(),
        },
      });
  }

  console.log('🌱 seeding rogue profiles…');
  for (const c of CASE_DATA) {
    const profile = ROGUE_DATA[c.id];
    if (!profile) continue;
    await db
      .insert(rogueProfiles)
      .values({
        caseId: c.id,
        variant: profile.variant,
        glasses: profile.glasses,
        hair: profile.hair,
        detention: profile.detention,
        detentionLabel: profile.detentionLabel,
        crimes: profile.crimes,
        extraStatus: profile.extraStatus,
      })
      .onConflictDoUpdate({
        target: rogueProfiles.caseId,
        set: {
          variant: profile.variant,
          glasses: profile.glasses,
          hair: profile.hair,
          detention: profile.detention,
          detentionLabel: profile.detentionLabel,
          crimes: profile.crimes,
          extraStatus: profile.extraStatus,
        },
      });
  }

  console.log('🌱 seeding sources…');
  const sourceIdBySlug = new Map<string, string>();
  for (const s of SOURCE_DATA) {
    const inserted = await db
      .insert(sources)
      .values({ slug: s.slug, name: s.name, homepage: s.homepage, tag: s.tag })
      .onConflictDoUpdate({
        target: sources.slug,
        set: { name: s.name, homepage: s.homepage, tag: s.tag },
      })
      .returning({ id: sources.id, slug: sources.slug });
    const row = inserted[0];
    if (row) sourceIdBySlug.set(row.slug, row.id);
  }

  console.log('🌱 seeding news articles…');
  for (const a of ARTICLE_SEED) {
    const sourceId = sourceIdBySlug.get(a.sourceSlug);
    if (!sourceId) continue;
    const hash = urlHash(a.url);
    await db
      .insert(newsArticles)
      .values({
        sourceId,
        headline: a.headline,
        excerpt: a.excerpt,
        sourceUrl: a.url,
        sourceUrlHash: hash,
        publishedAt: new Date(a.published),
        tag: a.tag,
        relatedCaseId: a.relatedCaseId,
        featured: a.featured ?? false,
      })
      .onConflictDoUpdate({
        target: newsArticles.sourceUrlHash,
        set: {
          headline: a.headline,
          excerpt: a.excerpt,
          publishedAt: new Date(a.published),
          tag: a.tag,
          relatedCaseId: a.relatedCaseId,
          featured: a.featured ?? false,
        },
      });
  }

  console.log('🌱 seeding KpiSnapshot…');
  const totalDamage = CASE_DATA.reduce((acc, c) => acc + c.amount, 0n);
  const totalPrison = CASE_DATA.reduce((acc, c) => acc + c.sentenceYears, 0);
  const activeCases = CASE_DATA.filter((c) => c.status !== 'Lezárva').length;
  const indictmentsThisWeek = CASE_DATA.filter((c) => c.status === 'Vádemelés').length;

  const bySectorMap = new Map<string, bigint>();
  for (const c of CASE_DATA) {
    bySectorMap.set(c.sector, (bySectorMap.get(c.sector) ?? 0n) + c.amount);
  }
  const bySector = Array.from(bySectorMap.entries())
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value);

  await db
    .insert(kpiSnapshots)
    .values({
      id: 'singleton',
      computedAt: new Date(),
      totalDamage,
      totalPrisonYears: totalPrison,
      activeCases,
      newIndictmentsThisWeek: indictmentsThisWeek,
      partnerCount: SOURCE_DATA.length,
      bySector,
    })
    .onConflictDoUpdate({
      target: kpiSnapshots.id,
      set: {
        computedAt: new Date(),
        totalDamage,
        totalPrisonYears: totalPrison,
        activeCases,
        newIndictmentsThisWeek: indictmentsThisWeek,
        partnerCount: SOURCE_DATA.length,
        bySector,
      },
    });

  // Bootstrap admin editor (idempotent — re-running seed never duplicates).
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  if (bootstrapEmail) {
    console.log(`🌱 seeding bootstrap admin: ${bootstrapEmail}`);
    await db
      .insert(editors)
      .values({
        email: bootstrapEmail,
        displayName: 'Bootstrap admin',
        role: 'admin',
        active: true,
      })
      .onConflictDoUpdate({
        target: editors.email,
        set: { role: 'admin', active: true },
      });
  } else {
    console.warn('⚠️  BOOTSTRAP_ADMIN_EMAIL not set — admin queue will reject all sign-ins');
  }

  console.log(`✅ seed complete: ${CASE_DATA.length} cases, ${SOURCE_DATA.length} sources, ${ARTICLE_SEED.length} articles, 1 KPI snapshot`);
  await conn.end();
  // suppress an unused-import warning for sql while keeping the import available for ad-hoc scripts.
  void sql;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
