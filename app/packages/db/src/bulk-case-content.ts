/**
 * Bulk case content generator — article-cards hozzáadása az összes
 * olyan ügyhez, amelyhez van K-Monitor cikk, de nincs article-card a
 * case-content.generated.json-ban.
 *
 * Futtatás: pnpm --filter @korr/db bulk-case-content
 * (A prod DB-vel: DATABASE_URL=postgres://... pnpm --filter @korr/db bulk-case-content)
 *
 * Mit csinál:
 *   1. Betölti a case-content.generated.json-t
 *   2. Lekéri az összes scandal + K-Monitor cikk párt
 *   3. Minden cikkhez title-relevance score-t számol (scandalKey token match)
 *   4. A legjobb cikket választja article-card-nak
 *   5. Ha nincs content entry → létrehozza (1 leírás-sor + article-card)
 *      Ha van content de nincs article-card → hozzáfűzi a végéhez
 *   6. Kiírja a frissített JSON-t
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { readFileSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');

const conn = postgres(DB_URL, { prepare: false, max: 1 });

const GENERATED_PATH = resolve(__dirname, '../../../apps/web/app/_home/case-content.generated.json');

const STOP_TOKENS = new Set([
  'ugy', 'eset', 'per', 'botrany', 'vallalat', 'allami', 'allam', 'ugyek', 'korrupcios',
  'szerzodes', 'gyar', 'ingatlan', 'beruhazas', 'tamogatas', 'biznisz', 'kozpenz',
  'vezerigazgato', 'fejlesztes', 'kozbeszerzesi', 'kozossegi',
]);

function tokenizeKey(id: string): string[] {
  return id.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .split('-')
    .filter(t => t.length >= 3 && !/^\d+$/.test(t) && !STOP_TOKENS.has(t));
}

function scoreTitle(title: string, id: string): number {
  const tokens = tokenizeKey(id);
  const n = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return tokens.filter(t => n.includes(t)).length;
}

function formatNewspaper(raw: string | null): string {
  if (!raw) return 'K-Monitor';
  const map: Record<string, string> = {
    'hvg360': 'HVG360', 'hvg': 'HVG', '444': '444.hu', '24.hu': '24.hu',
    'telex': 'Telex', 'atlatszo': 'Átlátszó', 'direkt36': 'Direkt36',
    'magyar hang': 'Magyar Hang', 'nepszava': 'Népszava', 'rtl': 'RTL',
    'portfolio': 'Portfolio', 'kontroll': 'Kontroll.hu', 'bbc': 'BBC',
    'vs.hu': 'VS.hu', 'szabad europa': 'Szabad Európa', 'rádió': 'Magyar Rádió',
    'magyar narancs': 'Magyar Narancs',
  };
  const lower = raw.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (lower.includes(k)) return v;
  }
  return raw;
}

function formatDate(raw: string | null): string {
  if (!raw) return '';
  return raw.slice(0, 10); // YYYY-MM-DD
}

type ArticleRow = {
  scandalKey: string;
  scandalName: string;
  primaryPersonName: string | null;
  news_id: number;
  title: string;
  source_url: string;
  kmdb_url: string;
  newspaper: string | null;
  pub_time: string | null;
  article_excerpt: string | null;
};

type Block = {
  type: string;
  content?: string;
  source?: string;
  date?: string;
  title?: string;
  url?: string;
  lead?: string;
};

type ContentEntry = {
  blocks: Block[];
  relatedNews?: Array<{ source: string; headline: string; date: string; url: string }>;
  attribution?: string;
};

async function main() {
  const generated = JSON.parse(readFileSync(GENERATED_PATH, 'utf8')) as Record<string, ContentEntry>;
  const existingKeys = new Set(Object.keys(generated));

  console.log(`📚 Jelenlegi JSON entries: ${existingKeys.size}`);

  // Összes K-Monitor cikk lekérése (scandalKey-enként)
  const rows = await conn<ArticleRow[]>`
    SELECT
      i."scandalKey",
      i."scandalName",
      i."primaryPersonName",
      k.news_id,
      k.title,
      k.source_url,
      k.kmdb_url,
      k.newspaper,
      k.pub_time,
      k.description AS article_excerpt
    FROM "Investigation" i
    JOIN "InvestigationArticleLink" l ON l."investigationId" = i.id AND l."articleSource" = 'kmonitor'
    JOIN "KmdbArticle" k ON k.news_id::text = l."articleId"
    WHERE i."scandalKey" IS NOT NULL
    ORDER BY i."scandalKey", k.pub_time DESC
  `;

  // Csoportosítás scandalKey-enként
  const byKey = new Map<string, ArticleRow[]>();
  for (const row of rows) {
    if (!byKey.has(row.scandalKey)) byKey.set(row.scandalKey, []);
    byKey.get(row.scandalKey)!.push(row);
  }

  let addedNew = 0;
  let addedCard = 0;
  let skipped = 0;

  for (const [key, articles] of byKey) {
    // Rendezés: score DESC, akkor pub_time DESC (legfrissebb)
    const scored = articles.map(a => ({ ...a, score: scoreTitle(a.title, key) }));
    scored.sort((a, b) => b.score - a.score || (b.pub_time ?? '').localeCompare(a.pub_time ?? ''));
    const best = scored[0]!;

    const articleCard: Block = {
      type: 'article-card',
      source: formatNewspaper(best.newspaper),
      date: formatDate(best.pub_time),
      headline: best.title,
      url: best.source_url || best.kmdb_url,
      lead: best.article_excerpt?.slice(0, 300) ?? undefined,
    };

    if (!existingKeys.has(key)) {
      // Nincs content → új entry (leírás + article-card)
      const person = best.primaryPersonName;
      const descText = person
        ? `${person} ügyéhez kapcsolódó sajtóhírek szerint: ${best.title.slice(0, 120)}.`
        : `${best.scandalName} kapcsán az alábbi sajtócikk számolt be részletesen.`;

      generated[key] = {
        blocks: [
          { type: 'text', content: descText },
          articleCard,
        ],
        attribution: 'Forrás: K-Monitor sajtóadatbázis (CC BY-SA 4.0)',
      };
      addedNew++;
    } else {
      const entry = generated[key]!;
      const hasCard = entry.blocks.some(b => b.type === 'article-card');
      if (hasCard) {
        skipped++;
        continue;
      }
      // Van content de nincs article-card → hozzáfűzés
      entry.blocks.push(articleCard);
      addedCard++;
    }
  }

  writeFileSync(GENERATED_PATH, JSON.stringify(generated, null, 2));
  console.log(`\n✅ Kész:`);
  console.log(`   ${addedNew} új content entry (leírás + article-card)`);
  console.log(`   ${addedCard} article-card hozzáadva meglévő entryhez`);
  console.log(`   ${skipped} kihagyva (már van article-card)`);

  await conn.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
