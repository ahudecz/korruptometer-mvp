/**
 * Ügy-forrásellenőrzés (2026-09-29) — dosszié egy csomag ügyhöz.
 *
 * Minden ügyhöz kiírja, amit az oldal ÁLLÍT (cím, személy, intézmény, összeg,
 * DB-összefoglaló, generált leírás), és a forráscikkek kinyert szövegét, hogy
 * kézzel össze lehessen vetni. Csak olvas: a DB-ből SELECT, a forrásokból GET.
 *
 * Használat (apps/web-ből):
 *   node scripts/audit-dossier.mjs <sorszám-tól> <darab> > dosszie.txt
 * A sorrend: előbb az ajánlóba kerülő ügyek (≥2 cikk, ≥500 M Ft), aztán a
 * többi, érintett összeg szerint csökkenően.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';
import { config } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env.local') });
const sql = postgres(process.env.PROD_DATABASE_URL, { prepare: false, max: 1 });

const from = Number(process.argv[2] ?? 0);
const count = Number(process.argv[3] ?? 10);
const MAX_SRC_CHARS = Number(process.env.MAX_SRC_CHARS ?? 3500);

const gen = JSON.parse(readFileSync(resolve(here, '../app/_home/case-content.generated.json'), 'utf8'));

const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, ' ');

/** Cikkszöveg kinyerése: JSON-LD articleBody, különben a <p> bekezdések. */
function extract(html) {
  const bodies = [...html.matchAll(/"articleBody"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => {
    try {
      return JSON.parse(`"${m[1]}"`);
    } catch {
      return m[1];
    }
  });
  const ld = bodies.sort((a, b) => b.length - a.length)[0] ?? '';
  const paras = [...html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 60);
  const pText = paras.join('\n');
  const text = decode(ld).length > pText.length * 0.8 ? decode(ld) : pText;
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/) ?? [])[1] ?? '').trim();
  return { title, text: text.replace(/\s+\n/g, '\n').trim() };
}

async function fetchSource(url) {
  // Ha az audit-fetch-sources.mjs már letöltötte, a gyorsítótárból olvasunk.
  if (process.env.SRC_CACHE) {
    const { createHash } = await import('node:crypto');
    const { existsSync } = await import('node:fs');
    const f = resolve(process.env.SRC_CACHE, 'src', createHash('sha1').update(url).digest('hex') + '.txt');
    if (existsSync(f)) {
      const t = readFileSync(f, 'utf8');
      return { status: t.startsWith('HTTP') || t.startsWith('HIBA') ? t.split('\n')[0] : 'cache', title: '', text: t };
    }
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/125 Safari/537.36' } });
    clearTimeout(t);
    if (!r.ok) return { status: r.status, title: '', text: '' };
    const html = await r.text();
    return { status: r.status, ...extract(html) };
  } catch (e) {
    return { status: 'HIBA ' + (e.name ?? ''), title: '', text: '' };
  }
}

try {
  // IDS=a,b,c — konkrét ügyek (pl. user által jelzettek); különben sorszám szerint.
  let ids = process.env.IDS ? process.env.IDS.split(',') : null;
  if (!ids && process.env.SKIP_AUDITED) {
    // A case-audit.ts-ben már szereplő ügyeket kihagyjuk; a következő `count`
    // még ellenőrizetlen ügy jön a szokásos sorrendben.
    const audited = new Set(
      [...readFileSync(resolve(here, '../app/_home/case-audit.ts'), 'utf8').matchAll(/^ {2}'([^']+)': \{/gm)].map((m) => m[1]),
    );
    const order = await sql`
      SELECT id FROM "ScandalCatalog"
      ORDER BY (article_count >= 2 AND damage_huf >= 500000000) DESC, damage_huf DESC, id`;
    ids = order.map((r) => r.id).filter((id) => !audited.has(id)).slice(from, from + count);
    console.error(`hátralévő ellenőrizetlen: ${order.length - audited.size} (kb.)`);
  }
  const cases = ids
    ? await sql`
        SELECT sc.id, sc.name, sc.person, sc.institution, sc.article_count, sc.damage_huf::text AS damage, sc.summary,
               (sc.article_count >= 2 AND sc.damage_huf >= 500000000) AS ajanlo
        FROM "ScandalCatalog" sc WHERE sc.id = ANY(${ids})`
    : await sql`
        SELECT sc.id, sc.name, sc.person, sc.institution, sc.article_count, sc.damage_huf::text AS damage, sc.summary,
               (sc.article_count >= 2 AND sc.damage_huf >= 500000000) AS ajanlo
        FROM "ScandalCatalog" sc
        ORDER BY (sc.article_count >= 2 AND sc.damage_huf >= 500000000) DESC, sc.damage_huf DESC, sc.id
        OFFSET ${from} LIMIT ${count}`;

  for (const [i, c] of cases.entries()) {
    const srcs = await sql`
      SELECT DISTINCT * FROM (
        SELECT n.headline AS title, n."sourceUrl" AS url, s.name AS outlet, n."publishedAt"::date::text AS date
          FROM "Investigation" iv JOIN "InvestigationArticleLink" l ON l."investigationId" = iv.id AND l."articleSource" = 'news'
          JOIN "NewsArticle" n ON n.id::text = l."articleId" LEFT JOIN "Source" s ON s.id = n."sourceId"
         WHERE iv."scandalKey" = ${c.id} AND iv.status NOT IN ('merged','dismissed')
        UNION ALL
        SELECT k.title, COALESCE(k.source_url, k.kmdb_url), k.newspaper, k.pub_time::text
          FROM "Investigation" iv JOIN "InvestigationArticleLink" l ON l."investigationId" = iv.id AND l."articleSource" = 'kmonitor'
          JOIN "KmdbArticle" k ON k.news_id::text = l."articleId"
         WHERE iv."scandalKey" = ${c.id} AND iv.status NOT IN ('merged','dismissed')
      ) x LIMIT 6`;

    const g = gen[c.id];
    console.log(`\n${'='.repeat(100)}\n#${from + i} ${c.id}${c.ajanlo ? '  [AJÁNLÓ]' : ''}`);
    console.log(`CÍM: ${c.name}\nSZEMÉLY: ${c.person ?? '—'} | INTÉZMÉNY: ${c.institution ?? '—'} | ÖSSZEG: ${(Number(c.damage) / 1e9).toFixed(2)} Mrd | CIKK: ${c.article_count}`);
    console.log(`DB-ÖSSZEFOGLALÓ: ${c.summary ?? '—'}`);
    if (g?.blocks) {
      console.log(`GENERÁLT LEÍRÁS${g.title ? ` (cím: ${g.title})` : ''}:`);
      for (const b of g.blocks) {
        if (b.type === 'text') console.log(`  ¶ ${b.content}`);
        else if (b.type === 'article-card') console.log(`  ▣ [${b.source}] ${b.headline} <${b.url}>`);
        else console.log(`  · ${b.type}`);
      }
    }
    for (const s of srcs) {
      const f = await fetchSource(s.url);
      console.log(`--- FORRÁS [${s.outlet ?? '?'} ${s.date ?? ''}] ${s.title}\n    <${s.url}> → ${f.status}`);
      console.log('    ' + (f.text || '(nincs kinyerhető szöveg)').slice(0, MAX_SRC_CHARS).replace(/\n/g, '\n    '));
    }
  }
} finally {
  await sql.end();
}
