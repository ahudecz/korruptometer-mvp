/**
 * Egyszeri Facebook sync — lefuttatja a sync-facebook-posts Inngest függvény
 * logikáját lokálisan, az aktív FacebookPage sorokra, és beírja a posztokat
 * a SocialPost táblába. Így lokálisan tesztelhető Inngest/Vercel nélkül.
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

const FB_API = 'https://graph.facebook.com/v25.0';
const POSTS_PER_PAGE = 20;

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');

const APP_ID = process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;
if (!APP_ID || !APP_SECRET) throw new Error('FACEBOOK_APP_ID / FACEBOOK_APP_SECRET not set');

const appToken = `${APP_ID}|${APP_SECRET}`;

const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

interface FbPost {
  id: string;
  message?: string;
  story?: string;
  permalink_url: string;
  full_picture?: string;
  created_time: string;
}
interface FbResponse {
  data?: FbPost[];
  error?: { message: string; type?: string; code?: number };
}

async function main() {
  const pages = await db
    .select()
    .from(schema.facebookPages)
    .where(eq(schema.facebookPages.enabled, true));

  console.log(`\n${pages.length} aktív oldal\n`);

  let totalInserted = 0;
  let firstError = true;

  for (const page of pages) {
    const params = new URLSearchParams({
      fields: 'message,story,permalink_url,full_picture,created_time',
      limit: String(POSTS_PER_PAGE),
      access_token: appToken,
    });

    try {
      const res = await fetch(`${FB_API}/${page.pageId}/posts?${params}`);
      const json = (await res.json()) as FbResponse;

      if (!res.ok || json.error) {
        const msg = json.error?.message ?? `HTTP ${res.status}`;
        console.log(`  ✗ ${page.pageName} (${page.pageId}): ${msg}`);
        // Az első hibánál írjuk ki a teljes választ, hogy lássuk a permission gondot
        if (firstError) {
          console.log('\n  --- TELJES HIBA ---');
          console.log('  ' + JSON.stringify(json.error, null, 2).replace(/\n/g, '\n  '));
          console.log('  -------------------\n');
          firstError = false;
        }
        continue;
      }

      const posts = json.data ?? [];
      let inserted = 0;
      for (const post of posts) {
        const content = post.message || post.story;
        if (!content) continue;
        await db
          .insert(schema.socialPosts)
          .values({
            authorName: page.pageName,
            authorHandle: page.pageHandle ?? null,
            platform: 'facebook',
            postUrl: post.permalink_url,
            content,
            imageUrl: post.full_picture ?? null,
            postedAt: new Date(post.created_time),
          })
          .onConflictDoNothing({ target: schema.socialPosts.postUrl });
        inserted++;
      }

      await db
        .update(schema.facebookPages)
        .set({ lastSyncedAt: new Date(), consecutiveFailures: 0 })
        .where(eq(schema.facebookPages.id, page.id));

      console.log(`  ✓ ${page.pageName}: ${posts.length} poszt, ${inserted} feldolgozva`);
      totalInserted += inserted;
    } catch (err) {
      console.log(`  ✗ ${page.pageName}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  console.log(`\nÖsszesen: ${totalInserted} poszt feldolgozva\n`);
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
