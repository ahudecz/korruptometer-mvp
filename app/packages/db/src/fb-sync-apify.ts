/**
 * Apify Facebook sync Supabase REST API-n keresztül.
 * Képeket Supabase Storage-ba tölti fel (CSP: csak *.supabase.co engedélyezett).
 *
 * Használat: pnpm --filter @korr/db fb-sync-apify
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../apps/web/.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

const APIFY_API = 'https://api.apify.com/v2';
const ACTOR_ID = 'apify~facebook-posts-scraper';
const RESULTS_PER_PAGE = 2;
const ONLY_POSTS_NEWER_THAN = '1 day';
const MIN_TEXT_LENGTH = 20;
const STORAGE_BUCKET = 'social-images';

// Apify-nak nincs natív napi költséglimitje (csak havi plan-cap) — ezért itt,
// alkalmazás-szinten védekezünk. $0.0053/poszt verifikálva 2026-07-01
// (specs/005-apify-facebook-scraper/research.md).
const COST_PER_POST_USD = 0.0053;
const DAILY_BUDGET_USD = 0.5;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APIFY_TOKEN = process.env.APIFY_TOKEN;

if (!SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
if (!SUPABASE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN not set');

const DB_HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer': 'return=minimal',
};

interface SupabaseFbPage {
  id: string;
  pageId: string;
  pageName: string;
  pageHandle: string | null;
}

interface ApifyPost {
  facebookUrl: string;
  pageName: string;
  url: string;
  time: string;
  text: string;
  media?: Array<{ thumbnail?: string }>;
}

interface ApifyRunResponse {
  data: { id: string; status: string; defaultDatasetId: string };
}

async function sbFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { ...DB_HEADERS, ...(opts.headers as Record<string, string> ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${path} hiba: HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res;
}

/**
 * Facebook CDN URL feldolgozása:
 * - Ha Facebook external proxy URL (external-*.fbcdn.net), kiveszi az eredeti URL-t
 * - Ha közvetlen fbcdn.net URL, letölti és Supabase Storage-ba tölti
 * - Visszatér a végleges, CSP-kompatibilis URL-lel vagy null-lal
 */
async function resolveAndStoreImage(rawUrl: string, storageKey: string): Promise<string | null> {
  if (!rawUrl) return null;

  try {
    const u = new URL(rawUrl);

    // Facebook external media proxy — kivesszük az eredeti URL-t
    if (u.hostname.startsWith('external-') && u.hostname.includes('fbcdn.net')) {
      const originalUrl = u.searchParams.get('url');
      if (originalUrl) return decodeURIComponent(originalUrl);
    }

    // Közvetlen Facebook CDN — letöltés + Supabase Storage feltöltés
    if (u.hostname.includes('fbcdn.net')) {
      const imgRes = await fetch(rawUrl, {
        headers: { 'Referer': 'https://www.facebook.com/', 'User-Agent': 'Mozilla/5.0' },
      });
      if (!imgRes.ok) return null;

      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const filename = `${storageKey}.${ext}`;
      const buffer = await imgRes.arrayBuffer();

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${filename}`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY!,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': contentType,
            'x-upsert': 'true',
          },
          body: buffer,
        },
      );

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        console.log(`    Kép feltöltés hiba (${filename}): ${err.slice(0, 100)}`);
        return null;
      }

      return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${filename}`;
    }

    // Más domain (pl. már Supabase URL) — használjuk as-is
    return rawUrl;
  } catch (e) {
    return null;
  }
}

/** Facebook post URL-ből stable storage key: numerikus ID kinyerése */
function storageKeyFromPostUrl(postUrl: string): string {
  const m = postUrl.match(/\/(\d+)\/?$/);
  return m ? `fb-${m[1]}` : `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function main() {
  // 1. Aktív oldalak
  const pagesRes = await sbFetch('FacebookPage?enabled=eq.true&select=id,pageId,pageName,pageHandle');
  const pages = (await pagesRes.json()) as SupabaseFbPage[];
  console.log(`\n${pages.length} aktív Facebook oldal\n`);
  if (pages.length === 0) return;

  const estimatedCost = pages.length * RESULTS_PER_PAGE * COST_PER_POST_USD;
  console.log(`Becsült cost: ~$${estimatedCost.toFixed(2)} (napi keret: $${DAILY_BUDGET_USD})`);
  if (estimatedCost > DAILY_BUDGET_USD) {
    console.log('Megszakítva: a becsült cost meghaladja a napi keretet.');
    return;
  }

  const pageUrlMap = new Map(
    pages.map(p => [`https://www.facebook.com/${p.pageHandle ?? p.pageId}`, p.pageName]),
  );
  const startUrls = pages.map(p => ({ url: `https://www.facebook.com/${p.pageHandle ?? p.pageId}` }));

  // 2. Apify run
  console.log('Apify run indítása (waitForFinish=120)...');
  const runRes = await fetch(
    `${APIFY_API}/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}&waitForFinish=120`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startUrls, resultsLimit: RESULTS_PER_PAGE, onlyPostsNewerThan: ONLY_POSTS_NEWER_THAN }),
    },
  );
  if (!runRes.ok) throw new Error(`Apify run sikertelen: HTTP ${runRes.status}`);

  const runJson = (await runRes.json()) as ApifyRunResponse;
  const { id: runId, status, defaultDatasetId: datasetId } = runJson.data;
  console.log(`Run ${runId} — ${status}, dataset: ${datasetId}`);

  if (status !== 'SUCCEEDED') {
    console.log('Még fut, 90mp várakozás...');
    await new Promise(r => setTimeout(r, 90_000));
  }

  // 3. Dataset
  console.log('\nDataset lekérése...');
  const dataRes = await fetch(`${APIFY_API}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`);
  if (!dataRes.ok) throw new Error(`Dataset hiba: HTTP ${dataRes.status}`);
  const posts = (await dataRes.json()) as ApifyPost[];
  console.log(`${posts.length} poszt érkezett\n`);

  // 4. Beillesztés képekkel
  let inserted = 0;
  for (const post of posts) {
    const content = post.text?.trim() ?? '';
    if (content.length < MIN_TEXT_LENGTH) {
      console.log(`  SKIP (rövid): ${post.facebookUrl}`);
      continue;
    }

    const authorName = pageUrlMap.get(post.facebookUrl) ?? post.pageName;
    const handle = post.facebookUrl.replace('https://www.facebook.com/', '');
    const rawImageUrl = post.media?.[0]?.thumbnail ?? null;
    const storageKey = storageKeyFromPostUrl(post.url);

    let imageUrl: string | null = null;
    if (rawImageUrl) {
      imageUrl = await resolveAndStoreImage(rawImageUrl, storageKey);
      console.log(`    kép: ${imageUrl ? '✓' : '✗'}`);
    }

    try {
      await sbFetch('SocialPost', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({
          authorName, authorHandle: handle, platform: 'facebook',
          postUrl: post.url, content, imageUrl,
          postedAt: new Date(post.time).toISOString(),
        }),
      });
      console.log(`  ✓ ${authorName}: ${content.slice(0, 60)}...`);
      inserted++;
    } catch (e) {
      console.log(`  ✗ ${authorName}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 5. lastSyncedAt
  await sbFetch('FacebookPage?enabled=eq.true', {
    method: 'PATCH',
    body: JSON.stringify({ lastSyncedAt: new Date().toISOString(), consecutiveFailures: 0 }),
  });

  console.log(`\nKész: ${posts.length} poszt scraped, ${inserted} beillesztve\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
