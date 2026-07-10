import 'server-only';
import { and, desc, eq, gte, ilike, or } from 'drizzle-orm';

import { isTransientLlmFailure } from '@korr/db';
import { checkRemoval, type RemovalCandidateArticle } from '@korr/db/ai-watchlist';
import { WATCH_LIST } from '@app/_home/watchlist-config';
import { WATCHLIST_DETAIL } from '@app/_home/watchlist-detail-config';
import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

const CANDIDATE_WINDOW_DAYS = 30;
const CANDIDATE_LIMIT = 15;
const MIN_DISTINCT_SOURCES = 2;

// Matches the "2026. júl. 10." display format used across the site (e.g.
// lemondasok/[id]/page.tsx's fmtDate) — toLocaleDateString('hu-HU') isn't
// reliably ICU-backed in every Node runtime.
const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

/**
 * watchlist.detect-removals — cron every 6 hours.
 *
 * The WATCH_LIST people (watchlist-config.ts — Sulyok Tamás, Polt Péter,
 * Nagy Gábor Bálint etc.) are constitutional-office holders whose
 * "HIVATALBAN VAN"/"ELTÁVOLÍTVA" status has always been a hand-edited
 * static field. This function watches for real removals (e.g. the
 * Alaptörvény 17. módosítása formally ending someone's mandate) and writes
 * a WatchlistRemoval row once confirmed — the frontend (lemondasok/[id]/
 * page.tsx, watchlist-grid.tsx) reads this row as an override on top of the
 * static config.
 *
 * Deliberately conservative: only ever acts on someone still 'active' in
 * WATCH_LIST with no existing WatchlistRemoval row, and only writes once an
 * LLM confirms — from the actual article text — that at least
 * MIN_DISTINCT_SOURCES independent outlets state the mandate has ALREADY,
 * FORMALLY ended (not merely proposed/pending). See
 * watchlist-removal-detect.ts for the exact prompt/timeline rules. A sitting
 * President/chief justice/prosecutor general is exactly the kind of subject
 * where a premature auto-flip would be a real credibility problem, hence
 * the two-source bar instead of the single-source threshold used elsewhere.
 */
export const detectWatchlistRemovals = inngest.createFunction(
  { id: 'detect-watchlist-removals', name: 'Detect WATCH_LIST mandate terminations', concurrency: 1 },
  { cron: '0 */6 * * *' },
  async ({ step, logger }) => {
    const db = getDb();

    const alreadyDetected = await step.run('load-existing', () =>
      db.select({ personId: schema.watchlistRemovals.personId }).from(schema.watchlistRemovals),
    );
    const detectedIds = new Set(alreadyDetected.map((r) => r.personId));

    const pending = WATCH_LIST.filter((p) => p.status === 'active' && !detectedIds.has(p.id));
    if (pending.length === 0) return { checked: 0, detected: 0 };

    let detected = 0;

    for (const person of pending) {
      const detail = WATCHLIST_DETAIL.find((d) => d.id === person.id);
      const keywords = detail?.newsKeywords ?? [person.name];

      const candidates = await step.run(`load-candidates-${person.id}`, async () => {
        const since = new Date(Date.now() - CANDIDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const conditions = keywords.map((kw) => ilike(schema.newsArticles.headline, `%${kw}%`));
        const rows = await db
          .select({
            id: schema.newsArticles.id,
            headline: schema.newsArticles.headline,
            excerpt: schema.newsArticles.excerpt,
            sourceUrl: schema.newsArticles.sourceUrl,
            publishedAt: schema.newsArticles.publishedAt,
            sourceName: schema.sources.name,
          })
          .from(schema.newsArticles)
          .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
          .where(and(gte(schema.newsArticles.publishedAt, since), or(...conditions)))
          .orderBy(desc(schema.newsArticles.publishedAt))
          .limit(CANDIDATE_LIMIT);
        return rows;
      });

      if (candidates.length < MIN_DISTINCT_SOURCES) continue;

      const llmCandidates: RemovalCandidateArticle[] = candidates.map((c) => ({
        id: c.id,
        headline: c.headline,
        excerpt: c.excerpt,
        sourceName: c.sourceName,
        publishedAt: new Date(c.publishedAt as unknown as string).toISOString(),
      }));

      const result = await step.run(`check-${person.id}`, () =>
        checkRemoval(person.name, person.institution, llmCandidates),
      );

      if (isTransientLlmFailure(result)) {
        logger?.warn?.(`detect-watchlist-removals: transient LLM failure for ${person.id}, will retry next run`);
        continue;
      }

      const verdict = result.data;
      if (!verdict || verdict.removalType === 'unclear' || verdict.confirmedArticleIds.length === 0) continue;

      const confirmedById = new Map(candidates.map((c) => [c.id, c]));
      const confirmedArticles = verdict.confirmedArticleIds
        .map((id) => confirmedById.get(id))
        .filter((a): a is (typeof candidates)[number] => Boolean(a));
      const distinctSources = new Set(confirmedArticles.map((a) => a.sourceName ?? a.sourceUrl));

      if (distinctSources.size < MIN_DISTINCT_SOURCES) {
        logger?.info?.(`detect-watchlist-removals: ${person.id} — only ${distinctSources.size} distinct source(s), below threshold`);
        continue;
      }

      const primary = confirmedById.get(verdict.primarySourceArticleId) ?? confirmedArticles[0];
      if (!primary) continue;

      await step.run(`write-${person.id}`, () =>
        db.insert(schema.watchlistRemovals).values({
          personId: person.id,
          removalType: verdict.removalType,
          sourceHeadline: primary.headline.slice(0, 500),
          sourceName: primary.sourceName,
          sourceUrl: primary.sourceUrl,
          sourceDateLabel: fmtDate(new Date(primary.publishedAt as unknown as string)),
          lead: verdict.lead.slice(0, 1000) || null,
        }).onConflictDoNothing({ target: schema.watchlistRemovals.personId }),
      );

      logger?.info?.(`detect-watchlist-removals: ${person.id} confirmed removed/resigned (${distinctSources.size} sources) — ${verdict.reason}`);
      detected++;
    }

    return { checked: pending.length, detected };
  },
);
