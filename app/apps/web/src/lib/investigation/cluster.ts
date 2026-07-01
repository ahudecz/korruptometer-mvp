import 'server-only';
import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { normalizeName, namesOverlap } from './normalize-name';

const DEFAULT_AMOUNT_BAND = 2; // FR-008: 2× band
const DEFAULT_DATE_WINDOW_DAYS = 180; // FR-008
const UNKNOWN_AMOUNT_DATE_WINDOW_DAYS = 90; // FR-009

export type ClaimForCluster = {
  id: string;
  articleSource: 'news' | 'kmonitor';
  articleId: string;
  allegedAmountHuf: bigint | null;
  parties: Array<{ kind: 'person' | 'entity'; name: string; normalizedName: string; role: string }>;
  articlePublishedAt: Date | null;
};

export type CandidateInvestigation = {
  id: string;
  primaryPersonName: string | null;
  primaryPersonNormalized: string | null;
  primaryEntityName: string | null;
  articleCount: number;
  /** Earliest and latest article-published-at observed on the cluster. */
  minClaimDate: Date | null;
  maxClaimDate: Date | null;
  /** Distinct normalized party names that appear on any of the cluster's claims. */
  partyNames: string[];
  /** Whether any of the cluster's claims carry an allegedAmountHuf. */
  hasAnyAmount: boolean;
  /** Min/max of the cluster's allegedAmountHuf values (for the 2x band check). */
  minAmount: bigint | null;
  maxAmount: bigint | null;
};

export type ClusterResolution =
  | { kind: 'attach'; investigationId: string }
  | { kind: 'ambiguous'; candidateIds: string[] }
  | { kind: 'new' };

function withinAmountBand(
  claim: bigint | null,
  cluster: { minAmount: bigint | null; maxAmount: bigint | null; hasAnyAmount: boolean },
): boolean {
  // If either side has no amount, the band check is trivially satisfied;
  // the unknown-amount predicate (FR-009) handles the both-null case.
  if (claim == null || !cluster.hasAnyAmount) return true;
  const min = cluster.minAmount;
  const max = cluster.maxAmount;
  if (min == null || max == null) return true;
  // 2x band: claim is within [min/2, max*2].
  const lo = min / 2n;
  const hi = max * 2n;
  return claim >= lo && claim <= hi;
}

function withinDateWindow(
  claimDate: Date | null,
  cluster: { minClaimDate: Date | null; maxClaimDate: Date | null },
  days: number,
): boolean {
  if (!claimDate) return true;
  if (!cluster.minClaimDate || !cluster.maxClaimDate) return true;
  const minMs = cluster.minClaimDate.getTime() - days * 24 * 60 * 60 * 1000;
  const maxMs = cluster.maxClaimDate.getTime() + days * 24 * 60 * 60 * 1000;
  const t = claimDate.getTime();
  return t >= minMs && t <= maxMs;
}

function partyNamesOfClaim(claim: ClaimForCluster): string[] {
  return Array.from(
    new Set(
      claim.parties.map((p) => normalizeName(p.normalizedName || p.name)),
    ),
  ).filter((s) => s.length > 0);
}

/**
 * Apply FR-008 / FR-009 predicates against one candidate investigation.
 */
export function matchesCandidate(
  claim: ClaimForCluster,
  candidate: CandidateInvestigation,
): boolean {
  const claimNames = partyNamesOfClaim(claim);
  const overlap = namesOverlap(claimNames, candidate.partyNames);
  // FR-009: unknown-amount path. Triggers when the new claim has no
  // amount AND the cluster does not carry an amount.
  if (claim.allegedAmountHuf == null && !candidate.hasAnyAmount) {
    if (overlap < 2) return false;
    if (
      !withinDateWindow(
        claim.articlePublishedAt,
        candidate,
        UNKNOWN_AMOUNT_DATE_WINDOW_DAYS,
      )
    ) {
      return false;
    }
    return true;
  }
  // FR-008: default path.
  if (overlap < 1) return false;
  if (
    !withinDateWindow(
      claim.articlePublishedAt,
      candidate,
      DEFAULT_DATE_WINDOW_DAYS,
    )
  ) {
    return false;
  }
  if (
    !withinAmountBand(claim.allegedAmountHuf, {
      minAmount: candidate.minAmount,
      maxAmount: candidate.maxAmount,
      hasAnyAmount: candidate.hasAnyAmount,
    })
  ) {
    return false;
  }
  return true;
}

/**
 * Resolution function: returns attach / ambiguous / new for a single
 * incoming claim (research.md §4).
 */
export function resolveCluster(
  claim: ClaimForCluster,
  candidates: CandidateInvestigation[],
): ClusterResolution {
  const passing = candidates.filter((c) => matchesCandidate(claim, c));
  if (passing.length === 0) return { kind: 'new' };
  if (passing.length === 1) return { kind: 'attach', investigationId: passing[0]!.id };
  return { kind: 'ambiguous', candidateIds: passing.map((c) => c.id) };
}

/**
 * Fetch candidate investigations whose existing claims share at least one
 * normalized party name with the incoming claim. Uses the jsonb GIN
 * index on ArticleClaim.parties for prefilter, then joins through
 * InvestigationArticleLink to find the candidate investigations.
 *
 * Accepts an optional `client` (typically a Drizzle transaction) so a
 * caller that's already inside a transaction can reuse the same
 * connection — the connection pool is `max:1` (pgbouncer-friendly), so
 * calling `getDb()` from inside a transaction deadlocks.
 */
export async function findCandidates(
  claim: ClaimForCluster,
  amountBand?: number,
  client?: { execute: ReturnType<typeof getDb>['execute'] },
): Promise<CandidateInvestigation[]> {
  void (amountBand ?? DEFAULT_AMOUNT_BAND);
  const db = client ?? getDb();
  const names = partyNamesOfClaim(claim);
  if (names.length === 0) return [];

  // Build a jsonb containment OR by names: matches when ANY entry in the
  // parties array has a normalizedName equal to one of `names`.
  // We use a parameterized SQL ANY(...) with text comparison so the
  // index can be used without a complex builder.
  const candidateIds = (await db.execute(sql`
    SELECT DISTINCT ial."investigationId" AS id
      FROM "ArticleClaim" ac
      JOIN "InvestigationArticleLink" ial
        ON ial."articleSource" = ac."articleSource"
       AND ial."articleId"     = ac."articleId"
     WHERE EXISTS (
             SELECT 1
               FROM jsonb_array_elements(ac.parties) AS p
              WHERE (p->>'normalizedName') = ANY(${sql.raw(arrayLiteral(names))})
           )
  `)) as Array<{ id: string }>;

  if (candidateIds.length === 0) return [];

  const ids = candidateIds.map((r) => r.id);

  const rows = (await db.execute(sql`
    WITH cluster_party AS (
      SELECT ial."investigationId"            AS investigation_id,
             (p->>'normalizedName')           AS norm_name
        FROM "InvestigationArticleLink" ial
        JOIN "ArticleClaim" ac
          ON ac."articleSource" = ial."articleSource"
         AND ac."articleId"     = ial."articleId"
       CROSS JOIN LATERAL jsonb_array_elements(ac.parties) AS p
       WHERE ial."investigationId" = ANY(${sql.raw(uuidArrayLiteral(ids))})
    ),
    cluster_date AS (
      SELECT ial."investigationId" AS investigation_id,
             MIN(COALESCE(na."publishedAt", ka."pubTime"))::timestamptz AS min_dt,
             MAX(COALESCE(na."publishedAt", ka."pubTime"))::timestamptz AS max_dt
        FROM "InvestigationArticleLink" ial
        LEFT JOIN "NewsArticle"     na  ON ial."articleSource" = 'news'     AND na.id::text = ial."articleId"
        LEFT JOIN "KMonitorArticle" ka  ON ial."articleSource" = 'kmonitor' AND ka."newsId"::text = ial."articleId"
       WHERE ial."investigationId" = ANY(${sql.raw(uuidArrayLiteral(ids))})
       GROUP BY ial."investigationId"
    ),
    cluster_amount AS (
      SELECT ial."investigationId" AS investigation_id,
             MIN(ac."allegedAmountHuf") AS min_amt,
             MAX(ac."allegedAmountHuf") AS max_amt,
             BOOL_OR(ac."allegedAmountHuf" IS NOT NULL) AS has_any
        FROM "InvestigationArticleLink" ial
        JOIN "ArticleClaim" ac
          ON ac."articleSource" = ial."articleSource"
         AND ac."articleId"     = ial."articleId"
       WHERE ial."investigationId" = ANY(${sql.raw(uuidArrayLiteral(ids))})
       GROUP BY ial."investigationId"
    )
    SELECT i.id,
           i."primaryPersonName",
           i."primaryPersonNormalized",
           i."primaryEntityName",
           i."articleCount",
           cd.min_dt   AS min_dt,
           cd.max_dt   AS max_dt,
           ca.min_amt  AS min_amt,
           ca.max_amt  AS max_amt,
           COALESCE(ca.has_any, false) AS has_any,
           ARRAY(
             SELECT DISTINCT norm_name
               FROM cluster_party
              WHERE investigation_id = i.id AND norm_name IS NOT NULL
           ) AS party_names
      FROM "Investigation" i
      LEFT JOIN cluster_date   cd ON cd.investigation_id = i.id
      LEFT JOIN cluster_amount ca ON ca.investigation_id = i.id
     WHERE i.id = ANY(${sql.raw(uuidArrayLiteral(ids))})
       AND i.status = 'new'
  `)) as Array<{
    id: string;
    primaryPersonName: string | null;
    primaryPersonNormalized: string | null;
    primaryEntityName: string | null;
    articleCount: number;
    min_dt: Date | null;
    max_dt: Date | null;
    min_amt: string | null;
    max_amt: string | null;
    has_any: boolean;
    party_names: string[];
  }>;

  return rows.map((r) => ({
    id: r.id,
    primaryPersonName: r.primaryPersonName,
    primaryPersonNormalized: r.primaryPersonNormalized,
    primaryEntityName: r.primaryEntityName,
    articleCount: r.articleCount,
    minClaimDate: r.min_dt == null ? null : new Date(r.min_dt as unknown as string),
    maxClaimDate: r.max_dt == null ? null : new Date(r.max_dt as unknown as string),
    minAmount: r.min_amt == null ? null : BigInt(r.min_amt),
    maxAmount: r.max_amt == null ? null : BigInt(r.max_amt),
    hasAnyAmount: !!r.has_any,
    partyNames: (r.party_names ?? []).filter(Boolean),
  }));
}

function arrayLiteral(values: string[]): string {
  // Build an inline `ARRAY[$1, $2, ...]::text[]` via safe escaping.
  // Drizzle's parameterised sql does not currently let us pass a JS array
  // through `ANY(...)` cleanly when mixed with `sql.raw`. Each value is
  // SQL-escaped (only single-quote handling is needed since we control
  // the contents — they are normalized names containing letters, spaces
  // and dots).
  const escaped = values.map((v) => `'${v.replace(/'/g, "''")}'`);
  return `ARRAY[${escaped.join(', ')}]::text[]`;
}

function uuidArrayLiteral(values: string[]): string {
  // Same as arrayLiteral but cast to uuid[] so comparisons against a
  // uuid column (Investigation.id, InvestigationArticleLink.investigationId)
  // don't trip Postgres' lack of an implicit uuid↔text cast in
  // `WHERE col = ANY(...)`.
  const escaped = values.map((v) => `'${v.replace(/'/g, "''")}'`);
  return `ARRAY[${escaped.join(', ')}]::uuid[]`;
}

export const CLUSTER_INTERNALS = {
  withinAmountBand,
  withinDateWindow,
  partyNamesOfClaim,
};
