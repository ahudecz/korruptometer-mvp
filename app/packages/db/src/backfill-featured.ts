import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '../../.env.local') });
config({ path: resolve(process.cwd(), '../../.env') });
import postgres from 'postgres';

const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

const KEYWORDS = [
  'lemondott', 'lemondás', 'lemond', 'kirúgták', 'kirúgás', 'kirúgta',
  'felmentette', 'felmentés', 'felmentették', 'leváltotta', 'leváltás',
  'menesztette', 'menesztés', 'visszahívták', 'visszahívás',
  'megszűnt', 'megszűnés', 'leáll', 'bezárt', 'bezárás', 'leépítés',
  'korrupció', 'hűtlen kezelés', 'lopás', 'túlárazás',
  'költségvetési csalás', 'sikkaszt', 'veszteget', 'kenőpénz',
  'vádemelés', 'vádirat', 'letartóztatták', 'letartóztatás', 'őrizetbe',
];

const likeConditions = KEYWORDS
  .map((kw) => `LOWER(headline || ' ' || excerpt) LIKE '%${kw}%'`)
  .join(' OR ');

async function main() {
  const rows = await conn.unsafe(`
    UPDATE "NewsArticle"
    SET featured = (${likeConditions})
    RETURNING id, featured
  `);
  const on = (rows as any[]).filter((x) => x.featured).length;
  const off = (rows as any[]).filter((x) => !x.featured).length;
  console.log(`Kiemelt: ${on}, Nem kiemelt: ${off}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
