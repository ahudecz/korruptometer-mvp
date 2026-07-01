export type ScrapedArticle = {
  headline: string;
  excerpt: string;
  sourceUrl: string;
  publishedAt: Date;
  tag?: string | null;
  imageUrl?: string | null;
};

export type OutletSlug =
  | 'telex'
  | '444'
  | 'hvg'
  | 'magyar-hang'
  | 'atlatszo'
  | '24hu'
  | 'kontroll'
  | 'vastagbor'
  | 'direkt36'
  | 'valasz'
  | 'nepszava'
  | 'jambor'
  | 'rtl'
  | 'kmonitor-news'
  | 'media1'
  | 'portfolio'
  | 'panyiszabolcs';

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
   * If true, every article from this outlet is considered relevant and the
   * keyword filter is skipped. Use for specialist political/investigative
   * outlets where off-topic articles are rare. General news outlets
   * (telex, 444, hvg, 24hu, nepszava) should leave this unset (false).
   */
  relevantByDefault?: boolean;
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
