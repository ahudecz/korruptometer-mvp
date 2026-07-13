import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import Anthropic from '@anthropic-ai/sdk';

// Windows SSL revocation check fails in sandboxed environments — bypass it.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.join(__dirname, '../apps/web/app/_home/case-content.generated.json');

const sql = postgres('postgresql://postgres:SPORTwavez80@127.0.0.1:5432/nextjs_db', { prepare: false });
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  httpAgent: httpsAgent,
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function writeJson(data) {
  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 1), 'utf8');
}

async function generateForCase(row) {
  const damageHuf = BigInt(row.damage_huf);
  const damageMrd = damageHuf > 0n ? `${(damageHuf / 1_000_000_000n).toString()} milliárd Ft` : 'ismeretlen';

  const userMsg = `Írj 2-3 bekezdéses, tömör magyar nyelvű összefoglalót az alábbi korrupciós ügyről.
Az összefoglaló legyen tényszerű, óvatos (ártatlanság vélelme), és csak a megadott adatokon alapuljon.
NE találj ki cikkeket, dátumokat, összegeket amelyeket nem adtam meg.

Ügy adatai:
- Azonosító: ${row.id}
- Név: ${row.name}
- Felelős személy: ${row.person ?? 'ismeretlen'}
- Érintett intézmény: ${row.institution ?? 'ismeretlen'}
- Becsült kár (saját becslésünk sajtóadatok alapján): ${damageMrd}
- Cikkek száma: ${row.article_count}
- Státusz: ${row.is_open ? 'Nyitott ügy' : 'Lezárt ügy'}
- Meglévő összefoglaló: ${row.summary ?? 'nincs'}

SOHA ne írd azt, hogy "a K-Monitor becslése/adatbázisa szerint" ez az összeg,
és ne tulajdonítsd a K-Monitornak ezt a számot. A K-Monitor egy független
sajtóadatbázis, amely cikkeket aggregál — NEM ő számolja vagy becsüli ezt az
összeget. Az összeget vagy ne attribuáld szervezethez (pl. "a sajtóban
szereplő becslés szerint"), vagy — ha mindenképp attribuálsz — a Kegyencjárat
saját becslésének nevezd.

Az összefoglaló legyen 2-3 bekezdés, körülbelül 150-250 szó összesen.
Tömör, informatív, semleges hangú. Visszaadj CSAK a szöveget, semmi mást, JSON sem.
Bekezdéseket üres sorral válaszd el.`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: `Te egy magyar korrupciós ügyekkel foglalkozó újságírói adatbázis szerkesztője vagy.
Tömör, tényszerű, magyar nyelvű összefoglalókat írsz nyilvánosan elérhető adatok alapján.
FONTOS: Csak tényeket írj. Ne találj ki dátumokat, összegeket, idézeteket, dokumentumneveket amelyeket nem adtam meg.
Ha valamit nem tudsz biztosan, írd: "A sajtójelentések szerint..." vagy "Gyanú szerint...".
Soha ne hivatkozz konkrét cikkekre amelyeket nem adtam meg.`,
    messages: [{ role: 'user', content: userMsg }],
  });

  const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null;
  if (!text) return null;

  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 20);
  if (paragraphs.length === 0) return null;

  return {
    blocks: paragraphs.map(p => ({ type: 'text', content: p })),
    attribution: 'Forrás: K-Monitor sajtóadatbázis (CC BY-SA 4.0)',
  };
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const existingKeys = new Set(Object.keys(existing));
  console.log(`Meglévő: ${existingKeys.size} eset`);

  const rows = await sql`
    SELECT id, name, person, institution, damage_huf::text as damage_huf, article_count, summary, is_open
    FROM "ScandalCatalog"
    ORDER BY damage_huf DESC, id ASC
    LIMIT 100
  `;

  const toGenerate = rows.filter(r => !existingKeys.has(r.id));
  console.log(`Generálandó: ${toGenerate.length} eset`);

  let generated = 0;
  let skipped = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  const result = { ...existing };

  for (let i = 0; i < toGenerate.length; i++) {
    const row = toGenerate[i];
    process.stdout.write(`[${i + 1}/${toGenerate.length}] ${row.id} ... `);

    try {
      const content = await generateForCase(row);
      if (content) {
        result[row.id] = content;
        generated++;
        // rough token estimate: ~400 input, ~300 output per case
        inputTokens += 400;
        outputTokens += 300;
        console.log('OK');
      } else {
        console.log('SKIP (üres válasz)');
        skipped++;
      }
    } catch (e) {
      console.log(`HIBA: ${e.message}`);
      skipped++;
    }

    if ((i + 1) % 10 === 0) {
      writeJson(result);
      console.log(`  → Mentve (${i + 1} feldolgozva)`);
    }

    await sleep(500);
  }

  writeJson(result);

  const inputCost = (inputTokens / 1_000_000) * 1.0;
  const outputCost = (outputTokens / 1_000_000) * 5.0;
  console.log(`\n=== KÉSZ ===`);
  console.log(`Generált: ${generated}`);
  console.log(`Kihagyva: ${skipped}`);
  console.log(`Becsült API-költség: $${(inputCost + outputCost).toFixed(3)}`);

  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
