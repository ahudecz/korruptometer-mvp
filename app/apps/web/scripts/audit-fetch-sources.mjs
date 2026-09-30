/**
 * Forrás-ellenőrzés (2026-09-29): MINDEN ügy összes forráscikkének letöltése
 * és helyi gyorsítótárazása, majd gépi egyezés-vizsgálat: szerepel-e a
 * forrásokban az ügy címének minden lényeges szava és a „Felelős" személy
 * vezetékneve. A user által talált hibák (Diorit, kézilabda, Mydent,
 * agrárkorrupció) mind ilyenek voltak: a cím olyat állított, ami a
 * forrásban nincs benne.
 *
 * Használat (apps/web-ből):
 *   node scripts/audit-fetch-sources.mjs <cache-mappa>
 * Kimenet: <cache-mappa>/report.json — ügyenként a hiányzó szavak.
 * Csak olvas (DB: SELECT, web: GET).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';
import { config } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env.local') });
const sql = postgres(process.env.PROD_DATABASE_URL, { prepare: false, max: 2 });
const CACHE = process.argv[2];
if (!CACHE) throw new Error('Add meg a cache-mappát.');
mkdirSync(join(CACHE, 'src'), { recursive: true });

const decode = (s) =>
  s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&[a-z]+;/g, ' ');

function extract(html) {
  const bodies = [...html.matchAll(/"articleBody"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => {
    try { return JSON.parse(`"${m[1]}"`); } catch { return m[1]; }
  });
  const ld = decode(bodies.sort((a, b) => b.length - a.length)[0] ?? '');
  const clean = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  const paras = [...clean.matchAll(/<(p|h1|h2|li)[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((m) => decode(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 25);
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/) ?? [])[1] ?? '').trim();
  const desc = decode((html.match(/<meta[^>]+(?:name|property)="(?:og:)?description"[^>]+content="([^"]*)"/) ?? [])[1] ?? '');
  const body = ld.length > paras.join('\n').length * 0.8 ? ld : paras.join('\n');
  return `${title}\n${desc}\n${body}`.trim();
}

async function fetchCached(url) {
  const f = join(CACHE, 'src', createHash('sha1').update(url).digest('hex') + '.txt');
  if (existsSync(f)) return readFileSync(f, 'utf8');
  let out = '';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/125 Safari/537.36', 'accept-language': 'hu' } });
    clearTimeout(t);
    out = r.ok ? extract(await r.text()) : `HTTP ${r.status}`;
  } catch (e) {
    out = `HIBA ${e.name ?? ''}`;
  }
  writeFileSync(f, out);
  return out;
}

const fold = (t) => (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (t) => fold(t).split(/[^a-z0-9]+/).filter(Boolean);
// Általános, a forrásban más szóval is kifejezhető szavak — ezek hiánya nem árulkodó.
const GENERIC = new Set(`ugy ugye ugyei ugylete ugyelete botrany korrupcios korrupcio kozpenz kozpenzes milliard milliardos milliardok
millio millios forint forintos allami allam ceg cegek ceges tamogatas tamogatasi tamogatasa kozbeszerzes kozbeszerzesi szerzodes
szerzodesi szerzodese ugyek per perek nyomozas vizsgalat alapitvany alapitvanyi alapitvanya kft zrt nyrt bt es a az volt uj regi
elso ugyei hatter kerdes kapcsolat kapcsolatok halozat halozata kormany kormanyzati fidesz ner kozeli penz penzek penzugyi
beruhazas beruhazasi beruhazasa felujitas felujitasi felujitasa kiadas kiadasai koltseg koltsegei koltsegvetesi osztalek
eladas eladasa vasarlas vasarlasa uzlet uzlete uzleti vagyon vagyona vagyonkezelo gyanu gyanus ugyelet magyar magyarorszag
orszagos budapesti budapest nemzeti szovetseg kozpont egyesulet`.split(/\s+/));

function missing(c, text) {
  const src = fold(text);
  const miss = [];
  for (const w of new Set(words(c.name))) {
    if (w.length < 4 || /\d/.test(w) || GENERIC.has(w)) continue;
    const stem = w.slice(0, Math.max(4, Math.min(w.length, 6)));
    if (!src.includes(stem)) miss.push(w);
  }
  let personMissing = false;
  if (c.person) {
    const sur = words(c.person.replace(/\([^)]*\)/g, ' ').replace(/^dr\.?\s+/i, ''))[0];
    if (sur && !src.includes(sur.slice(0, Math.max(4, sur.length - 2)))) personMissing = true;
  }
  return { miss, personMissing };
}

try {
  const cases = await sql`SELECT id, name, person, institution, article_count, damage_huf::text AS damage FROM "ScandalCatalog"`;
  const links = await sql`
    SELECT iv."scandalKey" AS id, COALESCE(n."sourceUrl", k.source_url, k.kmdb_url) AS url
      FROM "Investigation" iv JOIN "InvestigationArticleLink" l ON l."investigationId" = iv.id
      LEFT JOIN "NewsArticle" n ON l."articleSource" = 'news' AND n.id::text = l."articleId"
      LEFT JOIN "KmdbArticle" k ON l."articleSource" = 'kmonitor' AND k.news_id::text = l."articleId"
     WHERE iv.status NOT IN ('merged','dismissed') AND iv."scandalKey" IS NOT NULL`;
  const byCase = new Map();
  for (const l of links) if (l.url) (byCase.get(l.id) ?? byCase.set(l.id, new Set()).get(l.id)).add(l.url);

  const allUrls = [...new Set(links.map((l) => l.url).filter(Boolean))];
  let done = 0;
  const queue = [...allUrls];
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      await fetchCached(queue.shift());
      if (++done % 200 === 0) console.error(`${done}/${allUrls.length}`);
    }
  }));

  const report = [];
  for (const c of cases) {
    const urls = [...(byCase.get(c.id) ?? [])];
    const texts = await Promise.all(urls.map(fetchCached));
    const usable = texts.filter((t) => t.length > 200 && !t.startsWith('HTTP') && !t.startsWith('HIBA'));
    const { miss, personMissing } = missing(c, usable.join('\n'));
    report.push({ id: c.id, name: c.name, person: c.person, articles: c.article_count, damage: c.damage,
      sources: urls.length, readable: usable.length, missingWords: miss, personMissing });
  }
  writeFileSync(join(CACHE, 'report.json'), JSON.stringify(report, null, 1));
  const bad = report.filter((r) => r.readable > 0 && (r.missingWords.length || r.personMissing));
  const unreadable = report.filter((r) => r.readable === 0);
  console.log(`${report.length} ügy · ${allUrls.length} forrás · gyanús: ${bad.length} · olvashatatlan forrású: ${unreadable.length}`);
} finally {
  await sql.end();
}
