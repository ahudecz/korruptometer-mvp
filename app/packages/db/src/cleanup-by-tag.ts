import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, inArray, not, or, ilike, sql } from 'drizzle-orm';
import * as schema from './schema';

// Ezek a tag-ek garantáltan nem ide valók HA a headline sem tartalmaz releváns kulcsszót
const JUNK_TAGS = [
  'Üzlet', 'Külföld', 'Karrier', 'Mobil', 'Reggeli', 'Híradó',
  'Sport', 'Szórakozás', 'Tech', 'Tudomány', 'Egészség', 'Utazás',
  'Autó', 'Ingatlan', 'Életmód', 'Kultúra', 'Film', 'Zene',
  'politikai gyilkosság', 'Szép Szó',
];

// Ha ilyen cikk mégis tartalmazza ezeket, megtartjuk
const RESCUE_PATTERNS = [
  '%NKA%', '%MNB%', '%Mediaworks%', '%mediaworks%', '%KESMA%',
  '%Mészáros%', '%mészáros%', '%Rogán%', '%rogán%',
  '%Matolcsy%', '%matolcsy%', '%Tiborcz%', '%tiborcz%',
  '%Lázár%', '%Hankó%', '%hankó%', '%Szíjjártó%',
  '%Semjén%', '%Bánki%', '%Orbán Viktor%',
  '%Megafon%', '%Windisch%', '%lélegeztetőgép%',
  '%aranykonvoj%', '%hatvanpuszta%', '%volvo%gate%',
  '%Integritás Hatóság%',
];

async function main() {
  const db = drizzle(postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 }), { schema });

  const rescueConditions = RESCUE_PATTERNS.map(p => ilike(schema.newsArticles.headline, p));

  // Törlési feltétel: junk tag ÉS NEM tartalmaz rescue keyword-öt a headline-ban
  const deleteWhere = and(
    inArray(schema.newsArticles.tag, JUNK_TAGS),
    not(or(...rescueConditions)!),
  )!;

  const [{ toDelete } = { toDelete: 0 }] = await db
    .select({ toDelete: sql<number>`count(*)::int` })
    .from(schema.newsArticles)
    .where(deleteWhere);

  const sample = await db
    .select({ tag: schema.newsArticles.tag, headline: schema.newsArticles.headline })
    .from(schema.newsArticles)
    .where(deleteWhere)
    .limit(30);

  console.log(`\nTörlendő (junk tag + nincs releváns kulcsszó): ${toDelete}`);
  console.log('\nMinta:');
  for (const a of sample) console.log(`  [${a.tag}] ${a.headline?.slice(0, 80)}`);

  if (toDelete === 0) { console.log('\nNincs mit törölni.'); process.exit(0); }

  const deleted = await db.delete(schema.newsArticles).where(deleteWhere).returning({ id: schema.newsArticles.id });
  console.log(`\n✅ Törölve: ${deleted.length} cikk`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
