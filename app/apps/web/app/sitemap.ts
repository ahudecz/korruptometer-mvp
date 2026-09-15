import type { MetadataRoute } from 'next';
import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { UGYEK } from './_home/ugyek-config';
import { UGY_SUBPAGES } from './_home/ugyek-subpages';
import { GALERIA } from './_home/galeria-config';
import { WATCH_LIST } from './_home/watchlist-config';
import { PERSON_ROLLUPS } from './_home/person-rollup-config';
import { RETIRED_SCANDAL_IDS, toAsciiId } from './_home/case-detail-config';

// 2026-09-15 — az oldalnak addig nem volt sitemap-je. A legtöbb érték nem a
// nyitóoldalon van, hanem az ezernyi /adatbazis/<ügy> végoldalon, amikre alig
// mutat belső link — a Google ezeket sitemap nélkül csak nagyon lassan, vagy
// egyáltalán nem találja meg.
//
// A DB-lekérdezések MIND try/catch-ben futnak: egy hiányzó tábla vagy egy
// adatbázis-kiesés miatt sose essen szét az egész sitemap (a részleges
// sitemap sokkal jobb, mint egy 500-as). Ugyanez a minta, mint a
// /lemondasok/[id] WatchlistRemoval-lekérdezésénél.
// Szándékosan force-dynamic és NEM ISR: ha build időben nem érné el az
// adatbázist (a try/catch miatt nem hiba, csak üres eredmény), egy hiányos
// sitemap égne bele a deployba. A sitemap.xml-t naponta ha néhányszor kérik
// le a robotok, úgyhogy a kérésenkénti lekérdezés ára elhanyagolható.
export const dynamic = 'force-dynamic';

// A sitemap-protokoll felső határa 50 000 URL / fájl. Messze vagyunk tőle,
// de a limit legyen kiírva, ne a véletlenen múljon.
const MAX_URLS = 45000;

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.startsWith('http')
  ? process.env.NEXT_PUBLIC_APP_URL
  : 'https://www.kegyencjarat.hu';

type Entry = MetadataRoute.Sitemap[number];

/** Indexelendő statikus oldalak. A /hamarosan, /admin, /whistleblower,
 *  /bejelentes és a régi átirányító útvonalak (/lemondosok, /resignations)
 *  szándékosan hiányoznak — l. app/robots.ts. */
const STATIC_PAGES: { path: string; priority: number; changeFrequency: Entry['changeFrequency'] }[] = [
  { path: '/', priority: 1.0, changeFrequency: 'daily' },
  { path: '/ugyek', priority: 0.9, changeFrequency: 'daily' },
  { path: '/adatbazis', priority: 0.9, changeFrequency: 'daily' },
  { path: '/hirek', priority: 0.8, changeFrequency: 'hourly' },
  { path: '/galeria', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/lemondasok', priority: 0.8, changeFrequency: 'daily' },
  { path: '/megszunt', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/birosagi-iteletek', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/visszaszerzett-vagyon', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/podcastok', priority: 0.6, changeFrequency: 'daily' },
  { path: '/legfontosabb-hangok', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/szavazas', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/kviz', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/volvo-gate', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/adatok', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/modszertan', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/forrashivatkozasok', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/adomanyozas', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/csapat', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/partnerek', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/sajto', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/impresszum', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/adatvedelem', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/aszf', priority: 0.2, changeFrequency: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: Entry[] = STATIC_PAGES.map((p) => ({
    url: `${appUrl}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  // ── Konfigból jövő végoldalak (mindig elérhetők, DB nélkül is) ──
  for (const u of UGYEK) {
    entries.push({
      url: `${appUrl}/ugyek/${u.id}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    });
  }
  for (const s of UGY_SUBPAGES) {
    entries.push({
      url: `${appUrl}/ugyek/${s.parentId}/${s.id}`,
      lastModified: new Date(s.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }
  for (const g of GALERIA) {
    entries.push({
      url: `${appUrl}/galeria/${g.id}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }
  for (const w of WATCH_LIST) {
    entries.push({
      url: `${appUrl}/lemondasok/${w.id}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }
  for (const p of PERSON_ROLLUPS) {
    entries.push({
      url: `${appUrl}/adatbazis/szemely/${p.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  const db = getDb();

  // ── Adatbázis-végoldalak ──
  // A ScandalCatalog id-je néha ékezetes; a kanonikus URL MINDIG az ASCII-ra
  // normalizált alak (l. toAsciiId / [[project-ascii-url-canonical]]), ezért a
  // sitemapbe is az kerül — különben a Google két különböző URL-en indexelné
  // ugyanazt az ügyet.
  try {
    const rows = (await db.execute(sql`
      SELECT id
      FROM "ScandalCatalog"
      WHERE id NOT IN (${sql.join(RETIRED_SCANDAL_IDS.map((v) => sql`${v}`), sql`, `)})
      ORDER BY coalesce(damage_huf, 0) DESC
      LIMIT ${MAX_URLS}
    `)) as unknown as { id: string }[];
    for (const r of rows) {
      entries.push({
        url: `${appUrl}/adatbazis/${encodeURIComponent(toAsciiId(r.id))}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  } catch {
    // A katalógus nélkül is adjunk vissza működő sitemapot.
  }

  // ── Szavazások és kvízek ──
  try {
    const polls = (await db.execute(sql`SELECT slug FROM "PollQuestion"`)) as unknown as { slug: string }[];
    for (const p of polls) {
      entries.push({
        url: `${appUrl}/szavazas/${p.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    }
  } catch {
    /* a szavazás-tábla hiánya ne döntse le a sitemapot */
  }

  try {
    const quizzes = (await db.execute(sql`SELECT slug FROM "Quiz"`)) as unknown as { slug: string }[];
    for (const q of quizzes) {
      entries.push({
        url: `${appUrl}/kviz/${q.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    }
  } catch {
    /* ua. */
  }

  // Duplikátum-szűrés (pl. ha két ScandalCatalog-id ugyanarra az ASCII-alakra
  // normalizálódik) — ugyanaz az URL kétszer a sitemapben hiba a Search
  // Console-ban.
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  }).slice(0, MAX_URLS);
}
