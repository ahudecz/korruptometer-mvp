/**
 * Phase 3 — unified case-description generator. Replaces the old
 * bulk-case-content.ts / generate-case-content.mjs / generate-missing-80.mjs
 * trio with one repeatable pass: for every ScandalCatalog row that only has
 * the generic bulk-case-content.ts stub (or nothing at all), find the best
 * matching KmdbArticle(s) and have Haiku write a grounded 2-3 paragraph
 * description + a matching article-card for the same source article.
 *
 * Order: damage_huf DESC (largest közpénz-érintettség first, per user request).
 * Cost-capped: stops before starting a new case once cumulative estimated
 * spend would exceed BUDGET_USD, and checkpoints the JSON after every case
 * so a stop mid-run never loses work.
 *
 * Run: BUDGET_USD=3 node scripts/generate-case-descriptions.mjs
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import Anthropic from '@anthropic-ai/sdk';
import { config as loadEnv } from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '../.env.local') });

const JSON_PATH = path.join(__dirname, '../apps/web/app/_home/case-content.generated.json');
const MODEL = 'claude-haiku-4-5-20251001';
const BUDGET_USD = process.env.BUDGET_USD ? Number(process.env.BUDGET_USD) : 3;
// Haiku 4.5 list pricing used for the Phase-3 estimate the user approved.
const RATE_IN = 1.0 / 1_000_000;
const RATE_OUT = 5.0 / 1_000_000;

const PROD_URL = process.env.PROD_DATABASE_URL;
if (!PROD_URL) throw new Error('PROD_DATABASE_URL not set');
const sql = postgres(PROD_URL, { prepare: false, max: 2 });
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, httpAgent: httpsAgent });

const STOP_TOKENS = new Set([
  'ugy', 'eset', 'per', 'botrany', 'vallalat', 'allami', 'allam', 'ugyek', 'korrupcios',
  'szerzodes', 'gyar', 'ingatlan', 'beruhazas', 'tamogatas', 'biznisz', 'kozpenz',
  'vezerigazgato', 'fejlesztes', 'kozbeszerzesi', 'kozossegi',
]);
function tokenizeKey(id) {
  return id.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .split('-').filter(t => t.length >= 3 && !/^\d+$/.test(t) && !STOP_TOKENS.has(t));
}
function scoreTitle(title, id) {
  const tokens = tokenizeKey(id);
  const n = (title ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return tokens.filter(t => n.includes(t)).length;
}
function formatNewspaper(raw) {
  if (!raw) return 'K-Monitor';
  const map = {
    'hvg360': 'HVG360', 'hvg': 'HVG', '444': '444.hu', '24.hu': '24.hu', 'telex': 'Telex',
    'atlatszo': 'Átlátszó', 'direkt36': 'Direkt36', 'magyar hang': 'Magyar Hang',
    'nepszava': 'Népszava', 'rtl': 'RTL', 'portfolio': 'Portfolio', 'kontroll': 'Kontroll.hu',
    'bbc': 'BBC', 'vs.hu': 'VS.hu', 'szabad europa': 'Szabad Európa', 'magyar narancs': 'Magyar Narancs',
  };
  const lower = raw.toLowerCase();
  for (const [k, v] of Object.entries(map)) if (lower.includes(k)) return v;
  return raw;
}
function fmtDate(raw) { return raw ? raw.slice(0, 10) : ''; }

function writeJson(data) {
  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 1), 'utf8');
}

const GENERIC_RE = /ügyéhez kapcsolódó sajtóhírek szerint:|kapcsán az alábbi sajtócikk számolt be részletesen\.|az ügy részletes ismertetője folyamatban/;

function needsRegeneration(entry) {
  if (!entry) return true;
  const textBlocks = (entry.blocks ?? []).filter(b => b.type === 'text');
  if (textBlocks.length >= 2) return false; // genuine multi-paragraph content — leave alone
  if (textBlocks.length === 0) return true;
  return GENERIC_RE.test(textBlocks[0].content ?? '');
}

function parseParagraphs(text) {
  const raw = text.trim().split(/\n{2,}/);
  const paras = raw.map(p => p.replace(/\n/g, ' ').trim()).filter(p => p.length > 20);
  return paras.length > 0 ? paras : [text.trim()];
}

async function findArticles(row) {
  const persons = row.person ? [row.person] : [];
  const institutions = row.institution ? [row.institution] : [];
  if (persons.length === 0 && institutions.length === 0) return [];
  const rows = await sql`
    SELECT DISTINCT news_id, title, description, source_url, kmdb_url, newspaper, pub_time
    FROM "KmdbArticle"
    WHERE (${persons.length > 0 ? sql`persons && ${persons}` : sql`false`})
       OR (${institutions.length > 0 ? sql`institutions && ${institutions}` : sql`false`})
    ORDER BY pub_time DESC NULLS LAST
    LIMIT 40
  `;
  return rows
    .map(a => ({ ...a, score: scoreTitle(a.title, row.id) }))
    .sort((a, b) => b.score - a.score || (b.pub_time ?? '').localeCompare(a.pub_time ?? ''))
    .slice(0, 5);
}

async function generateEntry(row, articles) {
  const damageHuf = BigInt(row.damage_huf ?? '0');
  const damageMrd = damageHuf > 0n ? `${(damageHuf / 1_000_000_000n).toString()} milliárd Ft` : 'ismeretlen';
  const bestArticle = articles[0] ?? null;

  const articleListText = articles.length > 0
    ? articles.map(a => `- "${a.title}" (${formatNewspaper(a.newspaper)}, ${fmtDate(a.pub_time)})${a.description ? `: ${a.description.slice(0, 200)}` : ''}`).join('\n')
    : '(nincs kapcsolódó K-Monitor cikk)';

  const userMsg = `Írj 2-3 bekezdéses, tömör magyar nyelvű összefoglalót az alábbi korrupciós ügyről, KIZÁRÓLAG a lenti adatok és cikkek alapján.
NE találj ki cikkeket, dátumokat, idézeteket vagy összegeket amelyeket nem adtam meg.

Ügy adatai:
- Név: ${row.name}
- Felelős személy: ${row.person ?? 'ismeretlen'}
- Érintett intézmény: ${row.institution ?? 'ismeretlen'}
- Dokumentált közpénz-érintettség (K-Monitor becslés): ${damageMrd}
- Cikkek száma: ${row.article_count}
- Státusz: ${row.is_open ? 'Nyitott ügy' : 'Lezárt ügy'}

Kapcsolódó sajtócikkek:
${articleListText}

FONTOS az összeg megnevezésénél: a fenti összeg alapesetben dokumentált
közpénz-érintettség (sajtóban szereplő becslés, szerződésérték vagy
keretösszeg) — NEM jogilag bizonyított kár. Használj olyan kifejezéseket,
mint "közpénz-érintettség", "érintett közpénz" vagy "a sajtó szerint ennyi
közpénz áramlott/volt érintett". CSAK akkor nevezd "kár"-nak, ha a fenti
cikkek kifejezetten jogerős bírósági ítéletről, ügyészségi vádiratról vagy
hivatalos állami vizsgálatról (ÁSZ, KEHI) számolnak be konkrét, számszerűsített
kárral — egyébként maradj a "közpénz-érintettség" megfogalmazásnál.

Az összefoglaló legyen 2-3 önálló bekezdés, kb. 150-250 szó összesen, tömör,
semleges hangú, ártatlanság vélelmét tiszteletben tartva. Ha kevés az
információ, írj rövidebb, óvatosabb ismertetőt ("A sajtójelentések szerint...").
Csak a szöveget add vissza, semmi mást, JSON-t sem.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: 'Magyar nyelvű, tényszerű, óvatos hangú korrupciós ügy-összefoglalókat írsz kizárólag a felhasználó által megadott adatok alapján. Soha ne hivatkozz meg nem adott cikkekre vagy adatokra.',
    messages: [{ role: 'user', content: userMsg }],
  });

  const usage = response.usage ?? { input_tokens: 0, output_tokens: 0 };
  const costUsd = usage.input_tokens * RATE_IN + usage.output_tokens * RATE_OUT;

  const text = response.content[0]?.text ?? '';
  const paragraphs = parseParagraphs(text);
  const blocks = paragraphs.map(p => ({ type: 'text', content: p }));

  if (bestArticle) {
    blocks.push({
      type: 'article-card',
      source: formatNewspaper(bestArticle.newspaper),
      headline: bestArticle.title,
      date: fmtDate(bestArticle.pub_time),
      url: bestArticle.source_url || bestArticle.kmdb_url,
      lead: bestArticle.description?.slice(0, 300) ?? undefined,
    });
  }

  return {
    entry: { blocks, attribution: 'Forrás: K-Monitor sajtóadatbázis (CC BY-SA 4.0)' },
    costUsd,
  };
}

async function main() {
  const generated = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

  const rows = await sql`
    SELECT id, name, person, institution, damage_huf, article_count, investigation_count, is_open
    FROM "ScandalCatalog"
    ORDER BY damage_huf DESC, id ASC
  `;

  const targets = rows.filter(r => needsRegeneration(generated[r.id]));
  console.log(`ScandalCatalog rows: ${rows.length}, needing regeneration: ${targets.length}, budget: $${BUDGET_USD}`);

  let totalCost = 0;
  let processed = 0;
  let stoppedEarly = false;
  let lastId = null;

  for (const row of targets) {
    if (totalCost >= BUDGET_USD) { stoppedEarly = true; break; }
    try {
      const articles = await findArticles(row);
      const { entry, costUsd } = await generateEntry(row, articles);
      generated[row.id] = entry;
      totalCost += costUsd;
      processed++;
      lastId = row.id;
      const damageMrd = row.damage_huf ? (BigInt(row.damage_huf) / 1_000_000_000n).toString() : '?';
      console.log(`[${processed}/${targets.length}] ${row.id} (${damageMrd} Mrd, ${articles.length} cikk) — $${costUsd.toFixed(4)}, össz: $${totalCost.toFixed(3)}`);
      writeJson(generated); // checkpoint after every case
    } catch (e) {
      console.error(`  HIBA ${row.id}: ${e.message}`);
    }
  }

  console.log(`\n=== KÉSZ ===`);
  console.log(`Feldolgozva: ${processed} ügy`);
  console.log(`Összköltség: $${totalCost.toFixed(3)}`);
  console.log(`Utolsó feldolgozott: ${lastId}`);
  console.log(stoppedEarly ? `Leállt: költségkeret ($${BUDGET_USD}) elérve.` : `Az összes hátralévő eset feldolgozva.`);

  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
