/**
 * Éles adatbázis — egyetlen belépési pont.
 *
 * 2026-09-22, user: „férj hozzá az adatbázishoz, oldd meg, hogy ezt örökre
 * tudjad." Ez a fájl azért van itt, hogy a kapcsolat módját ne kelljen
 * minden munkamenetben újra felderíteni. Két buktató volt, mindkettő ide van
 * beégetve:
 *
 *  1. A KAPCSOLAT-STRING helye: `app/.env.local` → `PROD_DATABASE_URL`.
 *     NEM az `app/apps/web/.env.local` → `DATABASE_URL`, mert az egy ÜRES
 *     fejlesztői adatbázisra mutat (0 CriminalComplaint sor, és hiányzik
 *     belőle a PodcastVideo tábla — ettől száll el lokálisan a `pnpm build`
 *     és a `/` oldal is).
 *
 *  2. A postgres() OPCIÓI: `{ prepare: false }`, és SEMMILYEN `ssl` opció.
 *     Az `ssl: 'require'` átadása a Supabase poolerrel ECONNRESET-et ad —
 *     ez órákat vitt el. Ugyanaz a beállítás, mint amit az alkalmazás
 *     használ, l. apps/web/src/lib/db.ts getDb().
 *
 * Használat:
 *   node scripts/prod-sql.mjs "select count(*) from \"CriminalComplaint\""
 *   node scripts/prod-sql.mjs --file ./valami.sql
 *
 * Az írás (update/insert/delete) SZÁNDÉKOSAN megengedett — de a script
 * kiírja, hány sort érintett, hogy a hatás mindig látszódjon.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import postgres from 'postgres';
import { config } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env.local') });

const url = process.env.PROD_DATABASE_URL;
if (!url) {
  console.error('Hiányzik a PROD_DATABASE_URL az app/.env.local fájlból.');
  process.exit(1);
}

const args = process.argv.slice(2);
const query = args[0] === '--file' ? readFileSync(args[1], 'utf8') : args.join(' ');
if (!query.trim()) {
  console.error('Adj meg SQL-t: node scripts/prod-sql.mjs "select 1"');
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
try {
  const rows = await sql.unsafe(query);
  console.log(JSON.stringify(rows, null, 1));
  console.log(`-- érintett/visszaadott sorok: ${rows.length}`);
} finally {
  await sql.end();
}
