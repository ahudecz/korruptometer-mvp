import 'server-only';
import { desc, eq, gte, sql } from 'drizzle-orm';

import { isTransientLlmFailure } from '@korr/db';
import { pickDailyBreaking } from '@korr/db/ai-breaking';
import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

const CANDIDATE_WINDOW_HOURS = 36;
const CANDIDATE_LIMIT = 25;

/**
 * breaking.refresh-daily — cron 2x/day (08:00, 20:00).
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
  // 2026-07-18 user request: was event-driven (fired right after EVERY
  // detector insert / Telegram-approved review — see project-breaking-
  // priority memory), which meant this LLM call could fire many times a
  // day unpredictably. Now a fixed 2x/day cron only — the detectors' own
  // `inngest.send({ name: 'breaking.recompute' })` calls are harmless
  // no-ops now (nothing subscribes to that event anymore).
  { cron: '0 8,20 * * *' },
  async ({ step, logger }) => {
    const db = getDb();

    // A live pin (breakingPinnedUntil in the future) always outranks a plain
    // breakingOverride pick anyway (breaking.ts / breaking-pick.ts tiering),
    // so spending an LLM call here while one's active would just produce a
    // result nobody will ever see — skip the run entirely until it expires.
    const activePin = await step.run('check-active-pin', async () => {
      const rows = await db
        .select({ breakingPinnedUntil: schema.newsArticles.breakingPinnedUntil })
        .from(schema.newsArticles)
        .where(gte(schema.newsArticles.breakingPinnedUntil, new Date()))
        .limit(1);
      return rows.length > 0;
    });
    if (activePin) {
      logger?.info?.('refresh-daily-breaking: skipped, an active breaking pin exists');
      return { candidates: 0, picked: false, reason: 'active_pin' };
    }

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
