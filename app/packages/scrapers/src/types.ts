export type ScrapedArticle = {
  headline: string;
  excerpt: string;
  sourceUrl: string;
  publishedAt: Date;
  tag?: string | null;
};

export type OutletSlug = 'telex' | '444' | 'hvg' | 'magyar-hang' | 'atlatszo';

export type OutletAdapter = {
  slug: OutletSlug;
  homepage: string;
  /**
   * Canonicalisation allowlist for query params that carry meaning for
   * articles on this outlet (most outlets carry none — the dedup hash
   * should be stable across share-tracking variants).
   */
  queryAllowlist: readonly string[];
  /**
   * Crawl the outlet listing pages and return up to `limit` newly observed
   * `ScrapedArticle`s. Implementations MUST go through `httpGet` so the
   * shared rate-limiter, robots.txt cache, and User-Agent stay consistent.
   */
  crawl(limit?: number): Promise<ScrapedArticle[]>;
};

export type OutletRunResult = {
  slug: OutletSlug;
  articles: ScrapedArticle[];
  durationMs: number;
};
