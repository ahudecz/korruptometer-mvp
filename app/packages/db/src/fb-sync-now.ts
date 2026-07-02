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
const RESULTS_PER_PAGE = 3;
const MIN_TEXT_LENGTH = 20;

const DB_URL = process.env.PROD_DATABASE_URL ?? process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');

const APIFY_TOKEN = process.env.APIFY_TOKEN;
if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN not set');

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
      body: JSON.stringify({ startUrls, resultsLimit: RESULTS_PER_PAGE }),
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
    const imageUrl = post.media?.[0]?.thumbnail ?? null;

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
