import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../apps/web/.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env.local') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, ilike } from 'drizzle-orm';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

function dedupHash(url: string) {
  return createHash('sha256').update(url).digest('hex');
}

async function main() {
  // ── 1. Delete the irrelevant Csonka András / RTL Wicked article ──────────
  const csonkaUrl = 'https://rtl.hu/reggeli/2026/06/17/csonka-andras-reggeli-musorvezeto-wicked-szeged';
  const deleted = await db
    .delete(schema.newsArticles)
    .where(eq(schema.newsArticles.sourceUrl, csonkaUrl))
    .returning({ id: schema.newsArticles.id });
  if (deleted.length > 0) {
    console.log(`🗑️  Törölve: Csonka András / Wicked cikk (${deleted[0].id})`);
  } else {
    // Try by hash too
    const deleted2 = await db
      .delete(schema.newsArticles)
      .where(eq(schema.newsArticles.sourceUrlHash, dedupHash(csonkaUrl)))
      .returning({ id: schema.newsArticles.id });
    if (deleted2.length > 0) {
      console.log(`🗑️  Törölve hash alapján: ${deleted2[0].id}`);
    } else {
      console.log('⚠️  Csonka-cikk nem található a DB-ben (lehet, hogy már törölve volt).');
    }
  }

  // ── 2. Find 444.hu source ────────────────────────────────────────────────
  const sources = await db
    .select()
    .from(schema.sources)
    .where(ilike(schema.sources.homepage, '%444.hu%'));

  if (sources.length === 0) {
    console.error('❌ 444.hu forrás nem található a sources táblában!');
    await conn.end();
    process.exit(1);
  }
  const source444 = sources[0];
  console.log(`✅ 444.hu forrás: ${source444.id} (${source444.name})`);

  // ── 3. Insert Magyar Nemzet kirúgás article ──────────────────────────────
  const mnUrl = 'https://444.hu/2026/06/17/kirugtak-a-hetilappa-alakulo-magyar-nemzet-szerkesztosegenek-felet';
  await db
    .insert(schema.newsArticles)
    .values({
      sourceId: source444.id,
      headline: 'Kirúgták a hetilappá alakuló Magyar Nemzet szerkesztőségének felét',
      excerpt: 'A Magyar Nemzet napilap hetilappá alakul át — és ennek részeként a szerkesztőség felét elküldték. A leépítés a KESMA-birodalom egyik utolsó nyomtatott fellegvárát érinti.',
      sourceUrl: mnUrl,
      sourceUrlHash: dedupHash(mnUrl),
      publishedAt: new Date('2026-06-17T09:00:00Z'),
      tag: 'KESMA',
      featured: true,
    })
    .onConflictDoNothing();
  console.log('✅ Magyar Nemzet kirúgás cikk beírva (tag: KESMA, featured: true)');

  // ── 4. Add to political_resignations ─────────────────────────────────────
  await db
    .insert(schema.politicalResignations)
    .values({
      name: 'Magyar Nemzet szerkesztőség',
      position: 'Újságírók — szerkesztőség fele',
      institution: 'Magyar Nemzet (KESMA)',
      resignationType: 'kirúgás',
      resignationDate: new Date('2026-06-17T09:00:00Z'),
      description: 'A hetilappá alakuló Magyar Nemzeti szerkesztőségének felét kirúgták.',
      pinned: false,
      sourceUrls: [mnUrl],
      sourceNames: ['444.hu'],
    })
    .onConflictDoNothing();
  console.log('✅ Magyar Nemzet kirúgás beírva a political_resignations táblába');

  await conn.end();
  console.log('\n✅ Kész.');
}

main().catch(e => { console.error(e); process.exit(1); });
