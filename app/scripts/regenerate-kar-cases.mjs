import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import Anthropic from '@anthropic-ai/sdk';
import { config as loadEnv } from 'dotenv';

// Windows SSL revocation check fails in sandboxed environments — bypass it.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '../.env.local') });
const JSON_PATH = path.join(__dirname, '../apps/web/app/_home/case-content.generated.json');
const LIMIT = process.env.REGEN_LIMIT ? Number(process.env.REGEN_LIMIT) : Infinity;

const sql = postgres('postgresql://postgres:SPORTwavez80@127.0.0.1:5432/nextjs_db', { prepare: false });
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  httpAgent: httpsAgent,
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function writeJson(data) {
  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 1), 'utf8');
}

async function regenerateForCase(row) {
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
- Dokumentált közpénz-érintettség (K-Monitor becslés): ${damageMrd}
- Cikkek száma: ${row.article_count}
- Státusz: ${row.is_open ? 'Nyitott ügy' : 'Lezárt ügy'}
- Meglévő összefoglaló: ${row.summary ?? 'nincs'}

FONTOS az összeg megnevezésénél: a fenti összeg alapesetben dokumentált
közpénz-érintettség (sajtóban/vizsgálati iratokban szereplő becslés,
szerződésérték vagy keretösszeg) — NEM jogilag bizonyított kár. Az összegre
hivatkozva használj olyan kifejezéseket, mint "közpénz-érintettség",
"érintett közpénz" vagy "a sajtó szerint ennyi közpénz áramlott/volt érintett".
CSAK akkor nevezd "kár"-nak vagy "kárösszeg"-nek, ha a fenti "Meglévő
összefoglaló" mező kifejezetten arról szól, hogy jogerős bírósági ítélet,
ügyészségi vádirat vagy hivatalos állami vizsgálat (pl. ÁSZ, KEHI) konkrét,
számszerűsített kárt állapított meg — ilyenkor a "kár" szó helyénvaló.
Ha nem egyértelmű, maradj a "közpénz-érintettség" megfogalmazásnál.

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
Soha ne hivatkozz konkrét cikkekre amelyeket nem adtam meg.
Az összegek megnevezésénél kövesd szigorúan a felhasználói üzenetben leírt
"kár" vs. "közpénz-érintettség" megkülönböztetést.`,
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
  const explicitIds = process.env.REGEN_IDS ? process.env.REGEN_IDS.split(',') : null;
  const allKar = explicitIds ?? Object.keys(existing).filter((k) =>
    existing[k].blocks.map((b) => b.content).join(' ').match(/kár/i),
  );
  const toRegenerate = allKar.slice(0, LIMIT);
  console.log(`"kár" szót tartalmazó esetek összesen: ${allKar.length}, most feldolgozva: ${toRegenerate.length}`);

  const rows = await sql`
    SELECT id, name, person, institution, damage_huf::text as damage_huf, article_count, summary, is_open
    FROM "ScandalCatalog"
    WHERE id = ANY(${toRegenerate})
  `;
  const rowById = new Map(rows.map((r) => [r.id, r]));

  const result = { ...existing };
  let regenerated = 0;
  let skipped = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (let i = 0; i < toRegenerate.length; i++) {
    const id = toRegenerate[i];
    const row = rowById.get(id);
    process.stdout.write(`[${i + 1}/${toRegenerate.length}] ${id} ... `);

    if (!row) {
      console.log('HIBA: nincs meg a ScandalCatalog sorban');
      skipped++;
      continue;
    }

    try {
      const content = await regenerateForCase(row);
      if (content) {
        result[id] = content;
        regenerated++;
        inputTokens += 500;
        outputTokens += 300;
        const stillHasKar = content.blocks.map((b) => b.content).join(' ').match(/kár/i);
        console.log(stillHasKar ? 'OK (kár megmaradt — LLM szerint indokolt)' : 'OK');
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
  console.log(`Újragenerálva: ${regenerated}`);
  console.log(`Kihagyva: ${skipped}`);
  console.log(`Becsült API-költség: $${(inputCost + outputCost).toFixed(3)}`);

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
