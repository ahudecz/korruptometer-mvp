/**
 * Shared "which article is THE breaking one" picker — used by every surface
 * that needs a single featured/breaking article (homepage, /hirek grid).
 * Isomorphic (no 'server-only') since the /hirek grid picks client-side
 * from an already-fetched list.
 *
 * Tier priority: an editorial/LLM pick (breakingOverride) always outranks a
 * raw auto-tagged candidate (isBreakingCandidate), regardless of which is
 * more recent — recency only breaks ties within the same tier. See
 * lib/breaking.ts's getActiveBreaking() for the matching server-side logic
 * behind the BREAKING banner itself; this covers the "kiemelt" news-card.
 */
export type BreakingPickable = {
  breakingOverride?: boolean | null;
  isBreakingCandidate?: boolean | null;
  publishedAt: string | Date;
};

export function pickBreakingArticle<T extends BreakingPickable>(articles: T[]): T | null {
  let best: T | null = null;
  let bestTier = -1;
  let bestTime = -Infinity;
  for (const a of articles) {
    const tier = a.breakingOverride ? 2 : a.isBreakingCandidate ? 1 : 0;
    if (tier === 0) continue;
    const t = new Date(a.publishedAt).getTime();
    if (tier > bestTier || (tier === bestTier && t > bestTime)) {
      best = a;
      bestTier = tier;
      bestTime = t;
    }
  }
  return best;
}
