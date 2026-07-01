import 'server-only';
import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

import { inngest } from '../client';

const FB_API = 'https://graph.facebook.com/v25.0';
const POSTS_PER_PAGE = 20;
const FAILURE_DISABLE_THRESHOLD = 5;

interface FbPost {
  id: string;
  message?: string;
  story?: string;
  permalink_url: string;
  full_picture?: string;
  created_time: string;
}

interface FbResponse {
  data: FbPost[];
  error?: { message: string };
}

export const syncFacebookPosts = inngest.createFunction(
  { id: 'sync-facebook-posts', name: 'Sync Facebook posts', concurrency: 3 },
  [{ cron: '0 */6 * * *' }, { event: 'facebook.sync' }],
  async ({ step, logger }) => {
    const db = getDb();
    const appToken = `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`;

    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
      logger?.warn?.('sync-facebook-posts: FACEBOOK_APP_ID vagy FACEBOOK_APP_SECRET hiányzik');
      return { pages: 0, inserted: 0 };
    }

    const pages = await step.run('list-pages', async () =>
      db.select().from(schema.facebookPages).where(eq(schema.facebookPages.enabled, true)),
    );

    let totalInserted = 0;

    for (const page of pages) {
      const result = await step.run(`fetch-${page.pageId}`, async () => {
        try {
          const params = new URLSearchParams({
            fields: 'message,story,permalink_url,full_picture,created_time',
            limit: String(POSTS_PER_PAGE),
            access_token: appToken,
          });
          const res = await fetch(`${FB_API}/${page.pageId}/posts?${params}`);
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
          }
          const json = (await res.json()) as FbResponse;
          if (json.error) throw new Error(json.error.message);

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

          return { ok: true, inserted };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'unknown';
          const nextFailures = page.consecutiveFailures + 1;
          await db
            .update(schema.facebookPages)
            .set({
              consecutiveFailures: nextFailures,
              enabled: nextFailures < FAILURE_DISABLE_THRESHOLD,
            })
            .where(eq(schema.facebookPages.id, page.id));
          logger?.warn?.(`sync-facebook-posts: ${page.pageId} failed (${nextFailures}x): ${message}`);
          return { ok: false, inserted: 0 };
        }
      });

      if (result.ok) totalInserted += result.inserted;
    }

    return { pages: pages.length, inserted: totalInserted };
  },
);
