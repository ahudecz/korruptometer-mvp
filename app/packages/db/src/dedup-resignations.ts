import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import { ilike, eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

async function main() {
  // List all Pesti Srácok and VG resignation records
  const rows = await db
    .select()
    .from(schema.politicalResignations)
    .where(
      sql`lower(${schema.politicalResignations.institution}) in ('pesti srácok', 'világgazdaság', 'pesti sracok')`
    );

  console.log(`Found ${rows.length} rows:`);
  for (const r of rows) {
    console.log(`  [${r.id}] ${r.name} | ${r.institution} | ${r.resignationType} | ${r.description?.slice(0, 60)}`);
  }

  // Group by institution, keep the one with longest description (most complete)
  const byInstitution = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.institution.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!byInstitution.has(key)) byInstitution.set(key, []);
    byInstitution.get(key)!.push(r);
  }

  for (const [inst, group] of byInstitution.entries()) {
    if (group.length <= 1) continue;
    // Sort: keep the one with longest description
    group.sort((a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0));
    const keep = group[0]!;
    const toDelete = group.slice(1);
    console.log(`\n${inst}: keeping [${keep.id}], deleting ${toDelete.length} duplicate(s)`);
    for (const r of toDelete) {
      await db.delete(schema.politicalResignations).where(eq(schema.politicalResignations.id, r.id));
      console.log(`  Deleted [${r.id}] ${r.name}`);
    }
  }

  console.log('\nDone.');
  await conn.end();
}

main().catch(console.error);
