import { readFileSync, writeFileSync } from 'fs';
import postgres from 'postgres';
import Anthropic from '@anthropic-ai/sdk';

// Windows TLS revocation check workaround (same as previous generation runs)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DB_URL = 'postgresql://postgres:SPORTwavez80@127.0.0.1:5432/nextjs_db';
const JSON_PATH = 'apps/web/app/_home/case-content.generated.json';
const MODEL = 'claude-haiku-4-5-20251001';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sql = postgres(DB_URL, { prepare: false });

// Read existing JSON
const existing = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
console.log(`Existing entries: ${Object.keys(existing).length}`);

// Read top 100 from temp file
const top100 = JSON.parse(readFileSync('scripts/top100cases.json', 'utf8'));
// Re-process stubs (single-block entries ending in "— az ügy részletes ismertetője folyamatban.")
const isStub = (entry) => entry?.blocks?.length === 1 && entry.blocks[0].content.includes('folyamatban');
const missing = top100.filter(c => !existing[c.id] || isStub(existing[c.id]));
console.log(`Missing: ${missing.length}`);

function parseParagraphs(text) {
  // Split on double newlines or single newlines between sentences
  const raw = text.trim().split(/\n{2,}/);
  const paras = raw.map(p => p.replace(/\n/g, ' ').trim()).filter(p => p.length > 20);
  return paras.length > 0 ? paras : [text.trim()];
}

async function getArticles(person) {
  if (!person) return [];
  try {
    const rows = await sql`
      SELECT title, newspaper, pub_time
      FROM "KmdbArticle"
      WHERE ${person} = ANY(persons)
      ORDER BY pub_time DESC NULLS LAST
      LIMIT 8
    `;
    return rows;
  } catch {
    return [];
  }
}

async function generateEntry(c) {
  const articles = await getArticles(c.person);
  const articleText = articles.length > 0
    ? articles.map(a => `- ${a.title} (${a.newspaper ?? 'ismeretlen'}, ${a.pub_time?.slice(0,10) ?? '?'})`).join('\n')
    : '(nem találhatók K-Monitor cikkek)';

  const damageStr = c.damage_huf ? (BigInt(c.damage_huf) / 1_000_000_000n) + ' milliárd Ft' : 'ismeretlen';

  const prompt = `Az alábbi magyar korrupciós ügyről írj 2-3 bekezdést magyarul, tényszerű, újságírói stílusban.
Kizárólag erről az ügyről írj. Ne adj meg URL-eket, ne fabrikálj dátumokat vagy idézeteket, ne írj olyat ami nincs az adatokban.
Ha kevés az információ, írj rövidebb, általánosabb ismertetőt.

Ügy neve az adatbázisban: ${c.name}
Érintett személy: ${c.person ?? 'ismeretlen'}
Érintett intézmény: ${c.institution ?? 'ismeretlen'}
Becsült kár: ${damageStr}
Cikkszám: ${c.article_count}

Kapcsolódó sajtócikkek (K-Monitor adatbázisból):
${articleText}

Formátum: 2-3 önálló bekezdés, mindegyik 2-4 mondatból. Ne használj alcímeket vagy listákat. Csak a konkrét ügyet ismertedd.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.text ?? '';
  const paragraphs = parseParagraphs(text);
  return {
    blocks: paragraphs.map(p => ({ type: 'text', content: p })),
    attribution: 'Forrás: K-Monitor sajtóadatbázis (CC BY-SA 4.0)',
  };
}

let count = 0;
for (const c of missing) {
  try {
    console.log(`[${++count}/${missing.length}] ${c.id}`);
    const entry = await generateEntry(c);
    existing[c.id] = entry;

    if (count % 10 === 0) {
      writeFileSync(JSON_PATH, JSON.stringify(existing, null, 2), 'utf8');
      console.log(`  -> saved at ${count}`);
    }
  } catch (e) {
    console.error(`  ERROR for ${c.id}: ${e.message}`);
    // Write a stub so we don't lose progress
    existing[c.id] = {
      blocks: [{ type: 'text', content: `${c.name} — az ügy részletes ismertetője folyamatban.` }],
      attribution: 'Forrás: K-Monitor sajtóadatbázis (CC BY-SA 4.0)',
    };
  }
}

writeFileSync(JSON_PATH, JSON.stringify(existing, null, 2), 'utf8');
await sql.end();
console.log(`Done. Total entries: ${Object.keys(existing).length}`);
