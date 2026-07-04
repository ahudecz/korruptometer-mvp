process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { readFileSync, writeFileSync } from 'fs';
import postgres from 'postgres';
import Anthropic from '@anthropic-ai/sdk';

const sql = postgres('postgresql://postgres:SPORTwavez80@127.0.0.1:5432/nextjs_db', { prepare: false });
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FILE = 'apps/web/app/_home/case-content.generated.json';
const KEYS_TO_FIX = ['matolcsy-global-trade-centre-mnb-vagyonkezeles', 'habony-eszak-macedonia-eximbank'];

const gen = JSON.parse(readFileSync(FILE, 'utf8'));

// Step 1: delete old entries
for (const k of KEYS_TO_FIX) {
  delete gen[k];
  console.log(`Deleted: ${k}`);
}

// Step 2: query DB
const rows = await sql`
  SELECT id, name, person, institution, damage_huf, article_count, summary, is_open
  FROM "ScandalCatalog"
  WHERE id = ANY(${KEYS_TO_FIX})
`;
console.log(`Found ${rows.length} DB rows`);

// Step 3: generate new content for each
for (const row of rows) {
  console.log(`\nGenerating for: ${row.id}`);
  console.log(`  DB name: "${row.name}"`);

  const userPrompt = `Írj 2-3 bekezdéses, tömör magyar nyelvű összefoglalót az alábbi KONKRÉT korrupciós ügyről. Az összefoglaló pontosan arról szóljon, amit a DB ID és az ügy neve sugall — ne téveszd össze hasonló, de más ügyekkel.

Ügy adatai:
- DB azonosító (slug): ${row.id}
- Ügy neve: ${row.name}
- Felelős személy: ${row.person ?? 'ismeretlen'}
- Érintett intézmény: ${row.institution ?? 'ismeretlen'}
- Becsült kár: ${row.damage_huf} Ft
- Cikkek száma: ${row.article_count}
- Státusz: ${row.is_open ? 'Nyitott ügy' : 'Lezárt ügy'}
- Meglévő összefoglaló: ${row.summary ?? 'nincs'}

Fontos: a slug/azonosító alapján ez az ügy pontosan "${row.name}" — ne keverd össze más, kapcsolódó ügyekkel.
2-3 bekezdés, körülbelül 150-250 szó összesen.`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: 'Te egy magyar korrupciós ügyekkel foglalkozó újságírói adatbázis szerkesztője vagy. Tömör, tényszerű, magyar nyelvű összefoglalókat írsz nyilvánosan elérhető adatok alapján. FONTOS: Csak tényeket írj. Ne találj ki dátumokat, összegeket, idézeteket. Ha valamit nem tudsz biztosan, írd: "A sajtójelentések szerint..." vagy "Gyanú szerint...".',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const fullText = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '';
  console.log(`  Generated ${fullText.length} chars`);

  // Split on double newlines into paragraphs
  const paragraphs = fullText.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 20);
  const blocks = paragraphs.map(p => ({ type: 'text', content: p }));

  gen[row.id] = {
    blocks,
    attribution: 'Forrás: K-Monitor sajtóadatbázis (CC BY-SA 4.0)',
  };
}

// Step 4: write back
writeFileSync(FILE, JSON.stringify(gen, null, 1), 'utf8');
console.log(`\nDone. Total entries in JSON: ${Object.keys(gen).length}`);

await sql.end();
