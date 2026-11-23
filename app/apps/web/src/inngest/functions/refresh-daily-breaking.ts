import 'server-only';
import { desc, eq, gte, sql } from 'drizzle-orm';

import { isTransientLlmFailure } from '@korr/db';
import { pickDailyBreaking } from '@korr/db/ai-breaking';
import { getDb, schema } from '@/lib/db';
import { isBypassActive, type BypassStep, type BypassLogger } from '@/lib/cron-bypass';
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
    if (isBypassActive()) return { skipped: 'inngest_bypass_active' };
    return runBreakingRefreshCore({ step: step as unknown as BypassStep, logger });
  },
);

// 2026-11-23 — az Inngest-cron augusztus óta nem futott (utolsó AI-pick:
// 08-20), mert a pipeline a Vercel/GitHub-bypassra költözött, ez a függvény
// viszont kimaradt onnan. Most a cron/pipeline route is hívja, de csak ha az
// előző próbálkozás óta eltelt BREAKING_MIN_INTERVAL_HOURS — így marad napi
// ~2 hívás. Az utolsó próbálkozás ideje a WorkerHeartbeat táblában
// (id='breaking-refresh'), ugyanaz a vízjel-minta, mint kozlony-resignationsnél.
const BREAKING_HEARTBEAT_ID = 'breaking-refresh';
const BREAKING_MIN_INTERVAL_HOURS = 11;

export async function runBreakingRefreshIfDue({ step, logger }: { step: BypassStep; logger?: BypassLogger }) {
  const db = getDb();
  const rows = await db
    .select({ at: schema.workerHeartbeats.at })
    .from(schema.workerHeartbeats)
    .where(eq(schema.workerHeartbeats.id, BREAKING_HEARTBEAT_ID))
    .limit(1);
  const last = rows[0]?.at ? new Date(rows[0].at).getTime() : 0;
  if (Date.now() - last < BREAKING_MIN_INTERVAL_HOURS * 3600_000) {
    return { skipped: 'not_due', lastAttemptAt: rows[0]?.at ?? null };
  }
  const result = await runBreakingRefreshCore({ step, logger });
  // Átmeneti AI-hiba (pl. elfogyott keret) után NEM rögzítjük a próbálkozást,
  // hogy a következő óránkénti futás újra próbálja.
  if ((result as { reason?: string }).reason !== 'transient') {
    await db
      .insert(schema.workerHeartbeats)
      .values({ id: BREAKING_HEARTBEAT_ID, at: new Date() })
      .onConflictDoUpdate({ target: schema.workerHeartbeats.id, set: { at: new Date() } });
  }
  return result;
}

export async function runBreakingRefreshCore({ step, logger }: { step: BypassStep; logger?: BypassLogger }) {
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
}
