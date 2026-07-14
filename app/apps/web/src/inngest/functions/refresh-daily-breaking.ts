import 'server-only';
import { desc, eq, gte, sql } from 'drizzle-orm';

import { isTransientLlmFailure } from '@korr/db';
import { pickDailyBreaking } from '@korr/db/ai-breaking';
import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

const CANDIDATE_WINDOW_HOURS = 36;
const CANDIDATE_LIMIT = 25;

/**
 * breaking.refresh-daily — cron every 6 hours.
 *
 * The homepage BREAKING banner (breaking-banner.tsx) always shows the most
 * recently published article among those with breakingOverride=true OR a
 * match against the fixed tracked-case keyword/name list (relevance.ts) —
 * so a big story outside that fixed list (a revealing interview, a mass
 * protest, an unrelated fresh arrest) never surfaces there on its own, and
 * the banner can go stale for days. This function asks an LLM to pick the
 * single most editorially important article from the last ~36h and sets
 * its breakingOverride=true, so the banner keeps pace with the actual news.
 *
 * Old overrides don't need clearing — the banner picks the most recently
 * PUBLISHED qualifying row, so a fresher pick (or a fresher keyword match)
 * naturally supersedes an older override.
 */
export const refreshDailyBreaking = inngest.createFunction(
  { id: 'refresh-daily-breaking', name: 'Pick the most important recent article for the BREAKING banner', concurrency: 1 },
  // Event-driven — fires right after a detector (or a Telegram-approved
  // review) actually inserts something, instead of waiting up to 6h for the
  // next tick. The cron stays as a safety net (catches anything the event
  // path missed, e.g. a manual DB insert) but is now rarely the one that
  // actually changes the pick. See project-breaking-priority memory.
  [{ event: 'breaking.recompute' }, { cron: '0 */6 * * *' }],
  async ({ step, logger }) => {
    const db = getDb();

    const candidates = await step.run('load-candidates', async () => {
      const since = new Date(Date.now() - CANDIDATE_WINDOW_HOURS * 60 * 60 * 1000);
      const rows = await db
        .select({
          id: schema.newsArticles.id,
          headline: schema.newsArticles.headline,
          excerpt: schema.newsArticles.excerpt,
          publishedAt: schema.newsArticles.publishedAt,
          sourceName: schema.sources.name,
        })
        .from(schema.newsArticles)
        .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
        .where(gte(schema.newsArticles.publishedAt, since))
        .orderBy(desc(schema.newsArticles.publishedAt))
        .limit(CANDIDATE_LIMIT);
      return rows.map((r) => ({
        id: r.id,
        headline: r.headline,
        excerpt: r.excerpt,
        sourceName: r.sourceName,
        publishedAt: r.publishedAt.toISOString(),
      }));
    });

    if (candidates.length === 0) return { candidates: 0, picked: false };

    const result = await step.run('pick', () => pickDailyBreaking(candidates));

    if (isTransientLlmFailure(result)) {
      logger?.warn?.('refresh-daily-breaking: transient LLM failure, will retry next run');
      return { candidates: candidates.length, picked: false, reason: 'transient' };
    }

    const pick = result.data;
    if (!pick || !pick.hasPick || !pick.selectedId) {
      return { candidates: candidates.length, picked: false, reason: pick?.reason ?? 'no_pick' };
    }

    await step.run('apply-override', () =>
      db.update(schema.newsArticles)
        .set({ breakingOverride: true })
        .where(eq(schema.newsArticles.id, pick.selectedId)),
    );

    logger?.info?.(`refresh-daily-breaking: picked ${pick.selectedId} — ${pick.reason}`);
    return { candidates: candidates.length, picked: true, selectedId: pick.selectedId, reason: pick.reason };
  },
);
