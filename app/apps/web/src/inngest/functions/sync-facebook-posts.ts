import 'server-only';
import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

import { inngest } from '../client';

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

async function resolveAndStoreImage(
  rawUrl: string,
  storageKey: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<string | null> {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);

    // Facebook external proxy → extract original URL (no upload needed)
    if (u.hostname.startsWith('external-') && u.hostname.includes('fbcdn.net')) {
      const originalUrl = u.searchParams.get('url');
      return originalUrl ? decodeURIComponent(originalUrl) : null;
    }

    // Direct Facebook CDN → download + upload to Supabase Storage
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
        `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${filename}`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': contentType,
            'x-upsert': 'true',
          },
          body: buffer,
        },
      );
      if (!uploadRes.ok) return null;
      return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${filename}`;
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

export const syncFacebookPosts = inngest.createFunction(
  { id: 'sync-facebook-posts', name: 'Sync Facebook posts', concurrency: 1 },
  [{ event: 'facebook.sync' }],
  async ({ step, logger }) => {
    const db = getDb();
    const token = process.env.APIFY_TOKEN;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

    if (!token) {
      logger?.warn?.('sync-facebook-posts: APIFY_TOKEN hiányzik');
      return { pages: 0, inserted: 0 };
    }

    const pages = await step.run('list-pages', async () =>
      db.select().from(schema.facebookPages).where(eq(schema.facebookPages.enabled, true)),
    );

    if (pages.length === 0) {
      logger?.info?.('sync-facebook-posts: nincs engedélyezett oldal');
      return { pages: 0, inserted: 0 };
    }

    const estimatedCost = pages.length * RESULTS_PER_PAGE * COST_PER_POST_USD;
    if (estimatedCost > DAILY_BUDGET_USD) {
      logger?.warn?.(`sync-facebook-posts: becsült cost ~$${estimatedCost.toFixed(2)} meghaladja a napi $${DAILY_BUDGET_USD} keretet — megszakítva`);
      return { pages: pages.length, inserted: 0, skipped: 'budget' };
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

    const { datasetId, runId } = await step.run('trigger-apify', async () => {
      const res = await fetch(
        `${APIFY_API}/acts/${ACTOR_ID}/runs?token=${token}&waitForFinish=55`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startUrls, resultsLimit: RESULTS_PER_PAGE, onlyPostsNewerThan: ONLY_POSTS_NEWER_THAN }),
        },
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Apify run sikertelen: HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as ApifyRunResponse;
      return { datasetId: json.data.defaultDatasetId, runId: json.data.id, status: json.data.status };
    });

    const posts = await step.run('fetch-apify-results', async () => {
      const statusRes = await fetch(`${APIFY_API}/actor-runs?token=${token}&limit=5&desc=1`);
      if (statusRes.ok) {
        const statusJson = await statusRes.json() as { data: { items: Array<{ id: string; status: string }> } };
        const run = statusJson.data.items.find(r => r.id === runId);
        if (run && run.status !== 'SUCCEEDED') {
          logger?.warn?.(`sync-facebook-posts: run ${runId} még ${run.status}`);
        }
      }
      const res = await fetch(`${APIFY_API}/datasets/${datasetId}/items?token=${token}&clean=true`);
      if (!res.ok) throw new Error(`Apify dataset hiba: HTTP ${res.status}`);
      return (await res.json()) as ApifyPost[];
    });

    const inserted = await step.run('store-posts', async () => {
      let count = 0;
      for (const post of posts) {
        const content = post.text?.trim() ?? '';
        if (content.length < MIN_TEXT_LENGTH) continue;

        const authorName = pageUrlMap.get(post.facebookUrl) ?? post.pageName;
        const handle = post.facebookUrl.replace('https://www.facebook.com/', '');
        const rawImageUrl = post.media?.[0]?.thumbnail ?? null;
        const storageKey = storageKeyFromPostUrl(post.url);
        const imageUrl = rawImageUrl
          ? await resolveAndStoreImage(rawImageUrl, storageKey, supabaseUrl, supabaseKey)
          : null;

        await db
          .insert(schema.socialPosts)
          .values({ authorName, authorHandle: handle, platform: 'facebook', postUrl: post.url, content, imageUrl, postedAt: new Date(post.time) })
          .onConflictDoNothing({ target: schema.socialPosts.postUrl });
        count++;
      }

      await db
        .update(schema.facebookPages)
        .set({ lastSyncedAt: new Date(), consecutiveFailures: 0 })
        .where(eq(schema.facebookPages.enabled, true));

      return count;
    });

    logger?.info?.(`sync-facebook-posts: ${pages.length} oldal, ${posts.length} poszt scraped, ${inserted} beillesztve`);
    return { pages: pages.length, scraped: posts.length, inserted };
  },
);
