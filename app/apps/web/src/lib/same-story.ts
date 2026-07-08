import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { extractNameCandidates, decideSameStoryTier, stemCandidate } from '@korr/scrapers';
import { llmExtract, type LlmToolSpec } from '@korr/db/llm';

/**
 * Cross-source "same story" guard for scrape-time ingestion (see
 * `packages/scrapers/src/same-story.ts` for the free heuristic half).
 *
 * Two outlets covering the same real event (e.g. Telex/HVG/Magyar Hang all
 * reporting the Áder-villa drone video, or Telex/444 both reporting Guller
 * Zoltán's double firing) each pass the existing sourceUrlHash dedup because
 * they're genuinely different URLs — this guard catches that case instead.
 *
 * Cost control: the pg_trgm word_similarity() check is free and runs for
 * every candidate-bearing headline; the LLM call only fires for the narrow
 * "ambiguous" band, and only against the single best-scoring candidate.
 */

const LOOKBACK_HOURS = 72;

// Headlines built around an institution/party ("A Fidesz bojkottálja...",
// "Bojkottálja az Alaptörvény-módosítás...") never yield a 2-word name
// candidate — extractNameCandidates is tuned for PERSON names ("Szakács
// István"), and a lone capitalised word like "Fidesz" doesn't pair with
// anything. Without a candidate, the name-based search below never even
// runs, so three outlets covering the same boycott story each landed as
// a separate row. This fallback compares against the handful of most
// recent cross-source articles regardless of candidates — bounded to a
// short window so it stays cheap (word_similarity() is a free local
// Postgres computation; the only paid step, the AI tiebreaker, remains
// gated by the exact same ambiguous-tier threshold either path uses).
const RECENT_FALLBACK_HOURS = 12;
const RECENT_FALLBACK_LIMIT = 15;

export type SameStoryResult =
  | { duplicate: false }
  | { duplicate: true; matchId: string; via: 'heuristic' | 'ai' };

type CandidateRow = { id: string; headline: string; excerpt: string; wsim: number };

export async function findSameStoryDuplicate(opts: {
  headline: string;
  excerpt: string;
  sourceId: string;
}): Promise<SameStoryResult> {
  const db = getDb();
  const candidates = extractNameCandidates(opts.headline);

  let rows: CandidateRow[] = [];
  if (candidates.length > 0) {
    const ilikeConds = candidates.map((c) => sql`unaccent(headline) ILIKE unaccent(${`%${stemCandidate(c)}%`})`);
    rows = (await db.execute(sql`
      SELECT id, headline, excerpt, word_similarity(${opts.headline}, headline) AS wsim
      FROM "NewsArticle"
      WHERE "sourceId" != ${opts.sourceId}
        AND "publishedAt" >= now() - interval '${sql.raw(String(LOOKBACK_HOURS))} hours'
        AND (${sql.join(ilikeConds, sql` OR `)})
      ORDER BY wsim DESC
      LIMIT 3
    `)) as unknown as CandidateRow[];
  }

  const recentRows = (await db.execute(sql`
    SELECT id, headline, excerpt, word_similarity(${opts.headline}, headline) AS wsim
    FROM "NewsArticle"
    WHERE "sourceId" != ${opts.sourceId}
      AND "publishedAt" >= now() - interval '${sql.raw(String(RECENT_FALLBACK_HOURS))} hours'
    ORDER BY "publishedAt" DESC
    LIMIT ${RECENT_FALLBACK_LIMIT}
  `)) as unknown as CandidateRow[];

  const best = [...rows, ...recentRows].sort((a, b) => b.wsim - a.wsim)[0];
  if (!best) return { duplicate: false };

  const tier = decideSameStoryTier(best.wsim);
  if (tier === 'duplicate') return { duplicate: true, matchId: best.id, via: 'heuristic' };
  if (tier === 'distinct') return { duplicate: false };

  // 'ambiguous' — worth one cheap AI check against the single best candidate.
  const same = await isSameStoryAi(opts.headline, opts.excerpt, best.headline, best.excerpt);
  return same ? { duplicate: true, matchId: best.id, via: 'ai' } : { duplicate: false };
}

const SAME_STORY_SYSTEM = `Te egy magyar hírszerkesztő asszisztens vagy. Két cikk címét és rövid összefoglalóját kapod. Döntsd el, hogy a két cikk UGYANARRÓL a valós eseményről szól-e (pl. két lap ugyanazt a hírt írta meg), vagy két KÜLÖNBÖZŐ eseményről (akkor is, ha ugyanazt a személyt vagy intézményt említik).`;

const SAME_STORY_TOOL: LlmToolSpec = {
  name: 'same_story',
  description: 'Decide whether two Hungarian news articles report the same real-world event.',
  schema: {
    type: 'object',
    properties: {
      same: {
        type: 'boolean',
        description: 'True only if both articles report the same specific event, not just the same person/topic in general.',
      },
    },
    required: ['same'],
  },
};

async function isSameStoryAi(
  headlineA: string,
  excerptA: string,
  headlineB: string,
  excerptB: string,
): Promise<boolean> {
  const user = `A cikk:\nCím: ${headlineA}\nÖsszefoglaló: ${excerptA}\n\nB cikk:\nCím: ${headlineB}\nÖsszefoglaló: ${excerptB}`;
  const { data } = await llmExtract<{ same: boolean }>({
    system: SAME_STORY_SYSTEM,
    user,
    tool: SAME_STORY_TOOL,
    maxTokens: 100,
  });
  return Boolean(data?.same);
}
