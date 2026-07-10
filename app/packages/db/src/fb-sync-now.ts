/**
 * Egyszeri Facebook sync Apify facebook-posts-scraper actorral.
 * Lefuttatja a sync-facebook-posts Inngest függvény logikáját lokálisan,
 * az aktív FacebookPage sorokra, és beírja a posztokat a SocialPost táblába.
 *
 * Használat: pnpm --filter @korr/db fb-sync-now
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../apps/web/.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

const APIFY_API = 'https://api.apify.com/v2';
const ACTOR_ID = 'apify~facebook-posts-scraper';
const RESULTS_PER_PAGE = 2;
const ONLY_POSTS_NEWER_THAN = '1 day';
const MIN_TEXT_LENGTH = 20;
const STORAGE_BUCKET = 'social-images';

// Apify-nak nincs natív költséglimitje (csak havi plan-cap), ezért ide,
// a "ApifyBudget" táblába könyveljük el a tényleges elköltött összeget
// (Apify run usageTotalUsd mezője), és leállunk, ha eléri a limitUsd-t.
// Ugyanezt a táblát használja a sync-facebook-posts.ts Inngest function is.
const BUDGET_TABLE = 'ApifyBudget';
const BUDGET_ID = 'global';

const DB_URL = process.env.PROD_DATABASE_URL ?? process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');

const APIFY_TOKEN = process.env.APIFY_TOKEN;
if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN not set');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
if (!SUPABASE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');

/**
 * CSP img-src csak *.supabase.co-t enged (next.config.js) — a nyers fbcdn.net
 * thumbnail URL-eket le kell tölteni és Supabase Storage-ba kell tölteni,
 * különben a kép a böngészőben CSP-hiba miatt nem töltődik be.
 */
async function resolveAndStoreImage(rawUrl: string, storageKey: string): Promise<string | null> {
  if (!rawUrl) return null;

  try {
    const u = new URL(rawUrl);

    if (u.hostname.startsWith('external-') && u.hostname.includes('fbcdn.net')) {
      const originalUrl = u.searchParams.get('url');
      if (originalUrl) return decodeURIComponent(originalUrl);
    }

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

      if (!uploadRes.ok) return null;
      return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${filename}`;
    }

    return rawUrl;
  } catch {
    return null;
  }
}

function storageKeyFromPostUrl(postUrl: string): string {
  const m = postUrl.match(/\/(\d+)\/?$/);
  return m ? `fb-${m[1]}` : `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

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

async function main() {
  const pages = await db
    .select()
    .from(schema.facebookPages)
    .where(eq(schema.facebookPages.enabled, true));

  console.log(`\n${pages.length} aktív Facebook oldal\n`);
  if (pages.length === 0) { await conn.end(); return; }

  const budgetRes = await fetch(`${SUPABASE_URL}/rest/v1/${BUDGET_TABLE}?id=eq.${BUDGET_ID}&select=id,spentUsd,limitUsd`, {
    headers: { apikey: SUPABASE_KEY!, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const [budget] = (await budgetRes.json()) as { id: string; spentUsd: number; limitUsd: number }[];
  if (!budget) throw new Error('ApifyBudget: nincs "global" sor — futott már a 0036 migráció?');
  console.log(`Apify budget: $${budget.spentUsd}/$${budget.limitUsd}`);
  if (budget.spentUsd >= budget.limitUsd) {
    console.log('Megszakítva: az Apify budget elfogyott.');
    await conn.end();
    return;
  }

  const pageUrlMap = new Map(
    pages.map(p => [
      `https://www.facebook.com/${p.pageHandle ?? p.pageId}`,
      p.pageName,
    ]),
  );

  const startUrls = pages.map(p => ({
    url: `https://www.facebook.com/${p.pageHandle ?? p.pageId}`,
  }));

  console.log('Apify run indítása (waitForFinish=120)...');
  const runRes = await fetch(
    `${APIFY_API}/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}&waitForFinish=120`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startUrls, resultsLimit: RESULTS_PER_PAGE, onlyPostsNewerThan: ONLY_POSTS_NEWER_THAN }),
    },
  );

  if (!runRes.ok) {
    const body = await runRes.text();
    throw new Error(`Apify run indítás sikertelen: HTTP ${runRes.status}: ${body.slice(0, 300)}`);
  }

  const runJson = (await runRes.json()) as ApifyRunResponse;
  const { id: runId, status, defaultDatasetId: datasetId } = runJson.data;
  console.log(`Run ${runId} — státusz: ${status}, dataset: ${datasetId}`);

  // Ha még mindig fut, 60 másodpercet várunk és újra ellenőrizzük
  if (status !== 'SUCCEEDED') {
    console.log('Még fut, 60 másodperc várakozás...');
    await new Promise(r => setTimeout(r, 60_000));

    const listRes = await fetch(`${APIFY_API}/actor-runs?token=${APIFY_TOKEN}&limit=5&desc=1`);
    if (listRes.ok) {
      const listJson = await listRes.json() as { data: { items: Array<{ id: string; status: string }> } };
      const run = listJson.data.items.find(r => r.id === runId);
      console.log(`Run státusz: ${run?.status ?? 'ismeretlen'}`);
    }
  }

  // Tényleges futásköltség elkönyvelése
  try {
    const runInfoRes = await fetch(`${APIFY_API}/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    if (runInfoRes.ok) {
      const runInfo = (await runInfoRes.json()) as { data: { usageTotalUsd?: number } };
      const runCost = runInfo.data.usageTotalUsd ?? 0;
      const newTotal = budget.spentUsd + runCost;
      await fetch(`${SUPABASE_URL}/rest/v1/${BUDGET_TABLE}?id=eq.${BUDGET_ID}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY!,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ spentUsd: newTotal, updatedAt: new Date().toISOString() }),
      });
      console.log(`Futás cost: $${runCost.toFixed(3)}, összesen: $${newTotal.toFixed(2)}/$${budget.limitUsd}`);
    }
  } catch (e) {
    console.log('Budget frissítés sikertelen:', e instanceof Error ? e.message : e);
  }

  console.log('\nDataset lekérése...');
  const dataRes = await fetch(
    `${APIFY_API}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`,
  );
  if (!dataRes.ok) throw new Error(`Dataset lekérés sikertelen: HTTP ${dataRes.status}`);

  const posts = (await dataRes.json()) as ApifyPost[];
  console.log(`${posts.length} poszt érkezett\n`);

  let inserted = 0;
  for (const post of posts) {
    const content = post.text?.trim() ?? '';
    if (content.length < MIN_TEXT_LENGTH) {
      console.log(`  SKIP (rövid szöveg): ${post.facebookUrl}`);
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

    const result = await db
      .insert(schema.socialPosts)
      .values({
        authorName,
        authorHandle: handle,
        platform: 'facebook',
        postUrl: post.url,
        content,
        imageUrl,
        postedAt: new Date(post.time),
      })
      .onConflictDoNothing({ target: schema.socialPosts.postUrl })
      .returning({ id: schema.socialPosts.id });

    const wasInserted = result.length > 0;
    console.log(`  ${wasInserted ? '✓' : 'SKIP (már létezik)'} ${authorName}: ${content.slice(0, 60)}...`);
    if (wasInserted) inserted++;
  }

  await db
    .update(schema.facebookPages)
    .set({ lastSyncedAt: new Date(), consecutiveFailures: 0 })
    .where(eq(schema.facebookPages.enabled, true));

  console.log(`\nKész: ${posts.length} poszt scraped, ${inserted} beillesztve\n`);
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
