import 'server-only';
import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { isBypassActive, type BypassStep, type BypassLogger } from '@/lib/cron-bypass';

import { inngest } from '../client';

const APIFY_API = 'https://api.apify.com/v2';
const ACTOR_ID = 'apify~facebook-posts-scraper';
const RESULTS_PER_PAGE = 2;
const ONLY_POSTS_NEWER_THAN = '1 day';
const MIN_TEXT_LENGTH = 20;
const STORAGE_BUCKET = 'social-images';

// Apify-nak nincs natív költséglimitje (csak havi plan-cap), ezért ide,
// a "ApifyBudget" táblába könyveljük el a tényleges elköltött összeget
// (Apify run usageTotalUsd mezője), és leállunk, ha eléri a limitUsd-t.
// Nem resetelődik automatikusan — kézzel kell emelni/nullázni, ha kell.
const BUDGET_TABLE = 'ApifyBudget';
const BUDGET_ID = 'global';

interface ApifyBudgetRow {
  id: string;
  spentUsd: number;
  limitUsd: number;
}

async function getBudget(supabaseUrl: string, supabaseKey: string): Promise<ApifyBudgetRow> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/${BUDGET_TABLE}?id=eq.${BUDGET_ID}&select=id,spentUsd,limitUsd`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  if (!res.ok) throw new Error(`ApifyBudget lekérés sikertelen: HTTP ${res.status} — futott már a 0036 migráció?`);
  const rows = (await res.json()) as ApifyBudgetRow[];
  const row = rows[0];
  if (!row) throw new Error('ApifyBudget: nincs "global" sor — futott már a 0036 migráció?');
  return row;
}

async function addSpend(supabaseUrl: string, supabaseKey: string, deltaUsd: number, newTotal: number): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/${BUDGET_TABLE}?id=eq.${BUDGET_ID}`, {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ spentUsd: newTotal, updatedAt: new Date().toISOString() }),
  });
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

// 2026-07-22 — kiemelve, hogy a Vercel-cron bypass route Inngest nélkül is
// meg tudja hívni (l. cron-bypass.ts fejléce).
export async function runFacebookSyncCore({ step, logger }: { step: BypassStep; logger?: BypassLogger }) {
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

    const budget = await step.run('check-budget', () => getBudget(supabaseUrl, supabaseKey));
    if (budget.spentUsd >= budget.limitUsd) {
      logger?.warn?.(`sync-facebook-posts: Apify budget elfogyott ($${budget.spentUsd}/$${budget.limitUsd}) — megszakítva`);
      return { pages: pages.length, inserted: 0, skipped: 'budget-exhausted' };
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

    await step.run('record-spend', async () => {
      const runRes = await fetch(`${APIFY_API}/actor-runs/${runId}?token=${token}`);
      if (!runRes.ok) {
        logger?.warn?.(`sync-facebook-posts: run cost lekérés sikertelen (HTTP ${runRes.status}), a budget nem frissül ezúttal`);
        return;
      }
      const runJson = (await runRes.json()) as { data: { usageTotalUsd?: number } };
      const runCost = runJson.data.usageTotalUsd ?? 0;
      const newTotal = budget.spentUsd + runCost;
      await addSpend(supabaseUrl, supabaseKey, runCost, newTotal);
      logger?.info?.(`sync-facebook-posts: futás cost $${runCost.toFixed(3)}, összesen $${newTotal.toFixed(2)}/$${budget.limitUsd}`);
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
}

export const syncFacebookPosts = inngest.createFunction(
  { id: 'sync-facebook-posts', name: 'Sync Facebook posts', concurrency: 1 },
  [{ event: 'facebook.sync' }, { cron: 'TZ=Europe/Budapest 0 7 * * *' }],
  async ({ step, logger }) => {
    if (isBypassActive()) {
      logger?.info?.('sync-facebook-posts: skipped — PIPELINE_BYPASS_INNGEST active, Vercel cron owns this run');
      return { skipped: 'inngest_bypass_active' };
    }
    return runFacebookSyncCore({ step: step as unknown as BypassStep, logger });
  },
);
