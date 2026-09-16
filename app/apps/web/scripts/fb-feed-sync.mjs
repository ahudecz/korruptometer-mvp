// Napi Facebook-poszt szinkron — Apify NÉLKÜL, nulla külső költséggel.
//
// MIÉRT: az Apify-alapú szinkron (fb-sync-apify.ts) 2026-09-09 óta nem futott,
// és futásonként pénzbe kerül. Ez a script ugyanazokat az oldalakat olvassa be
// ugyanabba a SocialPost táblába, ingyen — így a nyitóoldali feed, a
// /legfontosabb-hangok és a Dicsőségfal-profilok is friss marad.
//
// HOGYAN, ÉS MI A KOMPROMISSZUM:
//  1. Poszt-AZONOSÍTÓK: az oldal HTML-jéből. A Meta ezt a listát csak
//     keresőrobotnak szolgálja ki, ezért ehhez a lépéshez Googlebot
//     user-agent kell. Ez tudatos döntés (user, 2026-09-16) — és
//     szándékosan CI-ben fut, nem a publikus weboldalon: a kegyencjarat.hu
//     futásidőben soha nem hívja a Facebookot.
//  2. TARTALOM: a hivatalos og:-tagekből, amit a Meta minden crawlernek
//     kiszolgál (facebookexternalhit). Itt nincs semmilyen trükk.
//  3. Idempotens: postUrl a természetes kulcs, a meglévő sorokat nem
//     duplikáljuk (a repó írói-konvenciója szerint).
//
// KORLÁT: az imageUrl egy fbcdn-link, ami hetek múlva lejár. Ugyanez volt
// igaz az Apify-os megoldásra is. Ha tartós kép kell, Supabase Storage-ba
// kellene menteni — az külön kör.

const GOOGLEBOT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const FBBOT = 'facebookexternalhit/1.1';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';
/** Oldalanként legfeljebb ennyi új posztot veszünk fel egy futásban. */
const PER_PAGE = Number(process.env.PER_PAGE ?? 8);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Hiányzik a NEXT_PUBLIC_SUPABASE_URL vagy a SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const sb = (path, init = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

async function getText(url, ua) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': ua, 'Accept-Language': 'hu-HU,hu;q=0.9' },
      signal: AbortSignal.timeout(45_000),
    });
    return await res.text();
  } catch {
    return '';
  }
}

function og(html, prop) {
  const re = new RegExp(
    `<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)`,
    'i',
  );
  const m = html.match(re);
  if (!m) return null;
  // A Meta hexa/decimális entitásokban adja az ékezeteket (&#xda;gy t&#x171;nik),
  // ezért a nevesített formák dekódolása önmagában nem elég.
  return m[1]
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

/** Poszt-azonosítók az oldal HTML-jéből, a megjelenés sorrendjében. */
function discoverPostIds(html, limit = 60) {
  const ids = [];
  const seen = new Set();
  // Két formátum él egymás mellett: az újabb pfbid-s és a régi, tisztán
  // számsoros azonosító (utóbbi jellemzően /posts/<szám> alakban).
  const patterns = [
    /(pfbid[0-9A-Za-z]{20,})/g,
    /\/posts\/(\d{10,})/g,
    /story_fbid=(\d{10,})/g,
  ];
  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        ids.push(m[1]);
      }
    }
  }
  return ids.slice(0, limit);
}

async function main() {
  const pagesRes = await sb('FacebookPage?select=pageId,pageHandle,pageName');
  if (!pagesRes.ok) {
    console.error('Nem sikerült beolvasni a FacebookPage táblát:', pagesRes.status);
    process.exit(1);
  }
  const pages = await pagesRes.json();
  console.log(`${pages.length} figyelt oldal.`);

  // A már meglévő postUrl-ek — ezekkel nem foglalkozunk újra.
  const existingRes = await sb('SocialPost?select=postUrl&limit=5000');
  const existing = new Set(
    ((await existingRes.json()) ?? []).map((r) => r.postUrl).filter(Boolean),
  );
  console.log(`${existing.size} ismert poszt az adatbázisban.`);

  let inserted = 0;
  let skipped = 0;

  for (const page of pages) {
    const ident = page.pageHandle ?? page.pageId;
    if (!ident) continue;
    const isNumericPage = /^\d+$/.test(String(page.pageId));
    const pageUrl = isNumericPage
      ? `https://www.facebook.com/profile.php?id=${page.pageId}`
      : `https://www.facebook.com/${ident}`;

    const html = await getText(pageUrl, GOOGLEBOT);
    const ids = discoverPostIds(html);
    if (ids.length === 0) {
      console.log(`  ${page.pageName}: nincs találat (${html.length} bájt)`);
      continue;
    }

    let taken = 0;
    for (const pfbid of ids) {
      if (taken >= PER_PAGE) break;
      // A FacebookPage.pageId a legtöbb sornál valójában a SLUG, nem szám.
      // Slug esetén a /<slug>/posts/<id> alak a működő permalink; csak a
      // tisztán numerikus oldalaknál kell a permalink.php?…&id=<szám>.
      const postUrl = isNumericPage
        ? `https://www.facebook.com/permalink.php?story_fbid=${pfbid}&id=${page.pageId}`
        : `https://www.facebook.com/${page.pageId}/posts/${pfbid}`;
      if (existing.has(postUrl)) {
        skipped += 1;
        continue;
      }
      const post = await getText(postUrl, FBBOT);
      const content = og(post, 'og:description');
      if (!content) continue; // megosztás / szöveg nélküli bejegyzés

      const row = {
        authorName: page.pageName,
        authorHandle: page.pageHandle ?? null,
        platform: 'facebook',
        postUrl,
        content,
        imageUrl: og(post, 'og:image'),
        hidden: false,
      };

      if (DRY_RUN) {
        console.log(`  [DRY] ${page.pageName}: ${content.slice(0, 60)}…`);
      } else {
        const ins = await sb('SocialPost', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(row),
        });
        if (!ins.ok) {
          console.error(`  HIBA (${ins.status}) ${page.pageName}:`, await ins.text());
          continue;
        }
      }
      existing.add(postUrl);
      inserted += 1;
      taken += 1;
    }
    console.log(`  ${page.pageName}: ${taken} új`);
  }

  console.log(`\nKÉSZ — ${inserted} új poszt, ${skipped} már megvolt.${DRY_RUN ? ' (DRY RUN)' : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
