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
// KÉPEK: az og:image egy fbcdn-link, ami alá van írva és hetek múlva 404-re
// vált (ez az Apify-os megoldás gyengéje is volt). Ezért minden képet
// ÁTMÁSOLUNK a Supabase `social-images` bucketjébe (fb-<id>.jpg néven, a
// korábbi szinkron konvenciója szerint), és a SocialPost.imageUrl már a
// saját, tartós URL-t kapja. Így a feed képei nem tűnnek el.

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

const BUCKET = 'social-images';

/**
 * Átmásolja a Facebook képét a saját Storage-unkba, és a tartós URL-t adja
 * vissza. Ha bármi hibázik, `null` — inkább kép nélküli kártya, mint egy
 * link, ami két hét múlva 404.
 */
async function mirrorImage(fbUrl, postId) {
  if (!fbUrl) return null;
  try {
    const res = await fetch(fbUrl, {
      headers: { 'User-Agent': FBBOT },
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // A pár kilobájtos válasz jellemzően hibakép vagy placeholder.
    if (buf.byteLength < 8000) return null;

    const name = `fb-${postId}.jpg`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: buf,
      signal: AbortSignal.timeout(60_000),
    });
    if (!up.ok) {
      console.error(`    kép-feltöltés hiba (${up.status}):`, (await up.text()).slice(0, 120));
      return null;
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}`;
  } catch {
    return null;
  }
}

/**
 * Poszt-azonosító → megjelenési idő. A Meta a keresőrobotnak kiszolgált
 * oldal-HTML-be beágyazza a publish_time/creation_time mezőket; ezeket a
 * poszt-azonosítóhoz a dokumentumbeli KÖZELSÉG alapján párosítjuk (a mérés
 * szerint ~96%-os találati arány). Enélkül csak a beolvasás ideje lenne
 * ismert, és a feed sorrendje a scrape sorrendjét tükrözné, nem a valóságot.
 */
function pairTimestamps(html) {
  const ids = [...html.matchAll(/(pfbid[0-9A-Za-z]{20,}|\/posts\/(\d{10,}))/g)].map((m) => ({
    pos: m.index ?? 0,
    id: m[2] ?? m[1],
  }));
  const times = [...html.matchAll(/"(?:publish_time|creation_time)"\s*:\s*(\d{9,11})/g)].map(
    (m) => ({ pos: m.index ?? 0, ts: Number(m[1]) }),
  );
  const out = new Map();
  for (const { pos, id } of ids) {
    if (out.has(id)) continue;
    let best = null;
    for (const t of times) {
      if (Math.abs(t.pos - pos) < 20_000 && (best === null || t.ts > best)) best = t.ts;
    }
    if (best) out.set(id, new Date(best * 1000).toISOString());
  }
  return out;
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

  // Azok a már ismert posztok, amelyeknél hiányzik a megjelenési idő.
  const missingRes = await sb('SocialPost?select=postUrl&postedAt=is.null&limit=5000');
  const missingPostedAt = new Set(
    ((await missingRes.json()) ?? []).map((r) => r.postUrl).filter(Boolean),
  );
  console.log(`${missingPostedAt.size} sornál hiányzik a megjelenési idő.`);

  let inserted = 0;
  let skipped = 0;
  let backfilled = 0;

  for (const page of pages) {
    const ident = page.pageHandle ?? page.pageId;
    if (!ident) continue;
    const isNumericPage = /^\d+$/.test(String(page.pageId));
    const pageUrl = isNumericPage
      ? `https://www.facebook.com/profile.php?id=${page.pageId}`
      : `https://www.facebook.com/${ident}`;

    const html = await getText(pageUrl, GOOGLEBOT);
    const ids = discoverPostIds(html);
    const postedAtById = pairTimestamps(html);
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
        // Visszamenőleg pótoljuk a hiányzó megjelenési időt, hogy a feed
        // időrendje a régi sorokra is helyes legyen.
        const known = postedAtById.get(pfbid);
        if (known && !DRY_RUN && missingPostedAt.has(postUrl)) {
          await sb(`SocialPost?postUrl=eq.${encodeURIComponent(postUrl)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ postedAt: known }),
          });
          backfilled += 1;
        }
        continue;
      }
      const post = await getText(postUrl, FBBOT);
      const content = og(post, 'og:description');
      if (!content) continue; // megosztás / szöveg nélküli bejegyzés

      // A kép a saját Storage-unkba kerül át, hogy ne járjon le. A pfbid
      // túl hosszú fájlnévnek, ezért a rövidített azonosítót használjuk.
      const shortId = String(pfbid).slice(-24);
      const imageUrl = DRY_RUN
        ? og(post, 'og:image')
        : await mirrorImage(og(post, 'og:image'), shortId);

      const row = {
        authorName: page.pageName,
        authorHandle: page.pageHandle ?? null,
        platform: 'facebook',
        postUrl,
        content,
        imageUrl,
        postedAt: postedAtById.get(pfbid) ?? null,
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

  console.log(
    `\nKÉSZ — ${inserted} új poszt, ${skipped} már megvolt, ` +
      `${backfilled} kapott megjelenési időt.${DRY_RUN ? ' (DRY RUN)' : ''}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
