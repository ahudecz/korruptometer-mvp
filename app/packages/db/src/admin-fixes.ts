import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import { ilike, or, sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

async function main() {
  // ── 1. Hajdú János beírása (force upsert, ne blokkolja semmi) ───────────
  const hajdu = await db
    .insert(schema.politicalResignations)
    .values({
      name: 'Hajdú János',
      position: 'Igazgató',
      institution: 'TEK (Terrorelhárítási Központ)',
      resignationType: 'kirúgás',
      resignationDate: new Date('2026-06-15T00:00:00Z'),
      description: 'A TEK korábbi igazgatója, nem rendőr többé.',
      sourceUrls: ['https://444.hu/2026/06/15/nem-rendor-tobbe-hajdu-janos-a-tek-korabbi-igazgatoja'],
      sourceNames: ['444'],
    })
    .onConflictDoNothing()
    .returning({ id: schema.politicalResignations.id });

  console.log(hajdu.length > 0 ? '✅ Hajdú János beírva' : '⏭  Hajdú János már szerepelt');

  // ── 2. Fürcht duplikát törlése automatikusan ──────────────────────────
  const furchtAll = await db
    .select({ id: schema.politicalResignations.id, name: schema.politicalResignations.name, createdAt: schema.politicalResignations.createdAt })
    .from(schema.politicalResignations)
    .where(ilike(schema.politicalResignations.name, '%fürcht%'));

  if (furchtAll.length <= 1) {
    console.log('⏭  Nincs Fürcht duplikát');
  } else {
    // Megtartjuk a legrégebbit, a többit töröljük
    const sorted = furchtAll.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const toDelete = sorted.slice(1).map(r => r.id);
    for (const id of toDelete) {
      const deleted = await db
        .delete(schema.politicalResignations)
        .where(sql`id = ${id}::uuid`)
        .returning({ name: schema.politicalResignations.name });
      console.log(`✅ Törölve: "${deleted[0]?.name}"`);
    }
  }

  // ── 3. Mészáros + Szíjjártó taggelés ──────────────────────────────────
  const meszaros = await db
    .update(schema.newsArticles)
    .set({ tag: 'Mészáros Lőrinc', featured: true })
    .where(or(
      ilike(schema.newsArticles.headline, '%mészáros%'),
      ilike(schema.newsArticles.excerpt, '%mészáros%'),
    ))
    .returning({ id: schema.newsArticles.id });
  console.log(`✅ ${meszaros.length} Mészáros cikk taggelve`);

  const szijjarto = await db
    .update(schema.newsArticles)
    .set({ tag: 'Szíjjártó Péter', featured: true })
    .where(or(
      ilike(schema.newsArticles.headline, '%szíjjártó%'),
      ilike(schema.newsArticles.excerpt, '%szíjjártó%'),
    ))
    .returning({ id: schema.newsArticles.id });
  console.log(`✅ ${szijjarto.length} Szíjjártó cikk taggelve`);

  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
