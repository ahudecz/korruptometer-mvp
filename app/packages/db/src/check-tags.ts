import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql, desc } from 'drizzle-orm';
import * as schema from './schema';

async function main() {
  const db = drizzle(postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 }), { schema });

  // Egyedi tagek és számuk
  const tags = await db.execute(sql`
    SELECT tag, count(*)::int as n
    FROM "NewsArticle"
    GROUP BY tag
    ORDER BY n DESC
  `);
  console.log('Tag eloszlás:');
  for (const r of tags as any[]) {
    console.log(`  "${r.tag}" → ${r.n}`);
  }

  // A Shein cikk pontos tagja
  const shein = await db.execute(sql`
    SELECT tag, headline, featured FROM "NewsArticle"
    WHERE headline ILIKE '%shein%' OR headline ILIKE '%vitézy%' OR headline ILIKE '%Fuller%' OR headline ILIKE '%vám%'
    LIMIT 10
  `);
  console.log('\nGyanús cikkek:');
  for (const r of shein as any[]) {
    console.log(`  tag="${r.tag}" featured=${r.featured} | ${(r.headline as string)?.slice(0, 70)}`);
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
