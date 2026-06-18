import 'server-only';
import Link from 'next/link';
import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import type {
  DisclosureTier,
  InvestigationListItem,
  InvestigationStatus,
} from '@korr/shared';
import { InvestigationFilters } from './filters';

export const dynamic = 'force-dynamic';

function fmtScore(s: string | null | undefined): string {
  if (!s) return '—';
  return Number(s).toFixed(2);
}

function fmtQuality(g: string | null | undefined): string {
  if (!g) return '—';
  switch (g) {
    case 'court_document':
      return 'bírósági irat';
    case 'audit_report':
      return 'audit-jelentés';
    case 'prosecutor_statement':
      return 'ügyészségi nyilatkozat';
    case 'investigative_journalism':
      return 'oknyomozó cikk';
    case 'opposition_politician':
      return 'ellenzéki politikus';
    case 'opinion_press':
      return 'vélemény';
    case 'rumor':
      return 'pletyka';
    default:
      return g;
  }
}

function fmtQualityShort(g: string | null | undefined): string {
  if (!g) return '—';
  switch (g) {
    case 'court_document':
      return 'bírósági';
    case 'audit_report':
      return 'audit';
    case 'prosecutor_statement':
      return 'ügyészi';
    case 'investigative_journalism':
      return 'újságírói';
    case 'opposition_politician':
      return 'ellenzéki';
    case 'opinion_press':
      return 'vélemény';
    case 'rumor':
      return 'pletyka';
    default:
      return g;
  }
}

function statusLabel(s: InvestigationStatus): string {
  switch (s) {
    case 'new':
      return 'Új';
    case 'dismissed':
      return 'Elvetve';
    case 'merged':
      return 'Összevonva';
  }
}

function mechanismLabel(m: string): string {
  switch (m) {
    case 'overpricing':
      return 'Túlárazás';
    case 'no_bid':
      return 'Versenytárgyalás nélküli';
    case 'kickback':
      return 'Visszacsorgatás';
    case 'amendment_inflation':
      return 'Szerződésmódosítás-felfújás';
    case 'phantom_service':
      return 'Fantomteljesítés';
    case 'related_party':
      return 'Közeli érdekeltség';
    default:
      return m;
  }
}

function tierLabel(t: DisclosureTier): string {
  switch (t) {
    case 'internal':
      return 'Belső';
    case 'journalist':
      return 'Újságírói';
    case 'prosecutor':
      return 'Ügyészi';
    case 'public':
      return 'Publikus';
  }
}

function fmtDamageRange(
  low: string | null | undefined,
  high: string | null | undefined,
): { primary: string; unit: string } | null {
  if (low === null || low === undefined || high === null || high === undefined) {
    return null;
  }
  const lo = Number(low);
  const hi = Number(high);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (lo <= 0 && hi <= 0) return null;
  // Pick the divisor based on the high end; format BOTH numbers in the same
  // unit so the range reads consistently (e.g. "0,9–2,3 Bil Ft", not
  // "905–2,3 Bil Ft" which looks like 905 trillion).
  const pick = (n: number): { div: number; unit: string } => {
    if (n >= 1_000_000_000_000) return { div: 1_000_000_000_000, unit: 'Bil Ft' };
    if (n >= 1_000_000_000) return { div: 1_000_000_000, unit: 'Mrd Ft' };
    if (n >= 1_000_000) return { div: 1_000_000, unit: 'M Ft' };
    return { div: 1, unit: 'Ft' };
  };
  const { div, unit } = pick(hi);
  const f = new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: div === 1 ? 0 : 1,
  });
  const loStr = f.format(lo / div);
  const hiStr = f.format(hi / div);
  if (loStr === hiStr) return { primary: hiStr, unit };
  return { primary: `${loStr}–${hiStr}`, unit };
}

function fmtBigHuf(huf: bigint | string | null | undefined): {
  value: string;
  unit: string;
} {
  if (huf === null || huf === undefined) return { value: '—', unit: '' };
  const n = typeof huf === 'bigint' ? Number(huf) : Number(huf);
  if (!Number.isFinite(n) || n <= 0) return { value: '0', unit: 'Ft' };
  if (n >= 1_000_000_000_000) {
    return {
      value: new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(
        n / 1_000_000_000_000,
      ),
      unit: 'Bil Ft',
    };
  }
  if (n >= 1_000_000_000) {
    return {
      value: new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(
        n / 1_000_000_000,
      ),
      unit: 'Mrd Ft',
    };
  }
  if (n >= 1_000_000) {
    return {
      value: new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(
        n / 1_000_000,
      ),
      unit: 'M Ft',
    };
  }
  return { value: new Intl.NumberFormat('hu-HU').format(n), unit: 'Ft' };
}

function pickQueryRow<T>(
  raw: unknown,
): T | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (Array.isArray(raw)) return raw[0] as T | undefined;
  if (typeof raw === 'object' && 'rows' in raw) {
    const rows = (raw as { rows?: T[] }).rows;
    return Array.isArray(rows) ? rows[0] : undefined;
  }
  return undefined;
}

function toRows<T>(raw: unknown): T[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'object' && 'rows' in raw) {
    const rows = (raw as { rows?: T[] }).rows;
    return Array.isArray(rows) ? rows : [];
  }
  return [];
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function InvestigationsQueuePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireEditor();
  const sp = await searchParams;

  const status = (typeof sp.status === 'string' ? sp.status : 'new') as
    | InvestigationStatus
    | 'all';
  const tier = (typeof sp.tier === 'string' ? sp.tier : 'all') as
    | DisclosureTier
    | 'all';
  const sort =
    (typeof sp.sort === 'string' ? sp.sort : 'recent') as
      | 'recent'
      | 'quantity'
      | 'article_count'
      | 'article_date'
      | 'damage';
  const quant = (typeof sp.quant === 'string' ? sp.quant : 'numbered') as
    | 'numbered'
    | 'unnumbered'
    | 'all';
  const q = typeof sp.q === 'string' ? sp.q : '';
  const selectedId = typeof sp.selected === 'string' ? sp.selected : '';
  const limit = 50;
  // Catalog lands on a per-person grouping (each name once); typing/clicking a
  // name (q) drills into that person's named matters. Sorting by damage shows
  // the flat, global, de-duplicated scandal list instead of the person groups.
  const groupByPerson = !q && sort !== 'damage';

  const db = getDb();
  const conds = [] as ReturnType<typeof eq>[];
  if (status !== 'all') conds.push(eq(schema.investigations.status, status));
  if (tier !== 'all')
    conds.push(eq(schema.investigations.disclosureTier, tier));
  if (q)
    conds.push(
      ilike(schema.investigations.primaryPersonNormalized, `%${q.toLowerCase()}%`),
    );
  const where = conds.length > 0 ? and(...conds) : undefined;

  let orderBy;
  if (sort === 'damage') {
    // order by the correlated DamageEstimate high, so the top-50 fetched are the
    // globally highest-damage cases (the JS pass below re-sorts within them).
    orderBy = [
      sql`(SELECT d."totalHighHuf" FROM "DamageEstimate" d WHERE d."investigationId" = "Investigation".id) DESC NULLS LAST`,
      // secondary: significance (article count) so big unknown-damage scandals
      // (e.g. MNB, 130 articles) stay visible below the grounded ones, not hidden
      desc(schema.investigations.articleCount),
      desc(schema.investigations.id),
    ];
  } else if (sort === 'recent') {
    orderBy = [desc(schema.investigations.updatedAt), desc(schema.investigations.id)];
  } else if (sort === 'quantity') {
    orderBy = [
      desc(schema.investigations.quantityScore),
      desc(schema.investigations.id),
    ];
  } else {
    orderBy = [
      desc(schema.investigations.articleCount),
      desc(schema.investigations.id),
    ];
  }
  void asc;

  const rowsP = db
    .select()
    .from(schema.investigations)
    .where(where as unknown as undefined)
    .orderBy(...orderBy)
    .limit(limit);

  // Per-row aggregates for the new multi-cell badge (option A).
  const damagePerInvP = db.execute<{
    investigationId: string;
    low: string | null;
    high: string | null;
    basis: string | null;
  }>(
    sql`SELECT "investigationId",
               "totalLowHuf"::text  AS low,
               "totalHighHuf"::text AS high,
               "basis"::text        AS basis
          FROM "DamageEstimate"`,
  );
  const sourcesPerInvP = db.execute<{ investigationId: string; n: number }>(
    sql`SELECT "investigationId", COUNT(DISTINCT "sourceSystem")::int AS n
          FROM "ExternalRecord"
         WHERE relevance = 'corroborates'
         GROUP BY "investigationId"`,
  );
  const redFlagsPerInvP = db.execute<{
    investigationId: string;
    failing: number;
    total: number;
  }>(
    sql`SELECT "investigationId",
               COUNT(*) FILTER (WHERE verdict = 'fail')::int AS failing,
               COUNT(*)::int                                 AS total
          FROM "RedFlagCheck"
         GROUP BY "investigationId"`,
  );
  // Tier-2 fallback: confidence-weighted SUM of LLM-extracted claim amounts.
  // Used when no DamageEstimate row exists yet.
  const claimedDamagePerInvP = db.execute<{
    investigationId: string;
    claimed_low: string | null;
    claimed_high: string | null;
    claim_count: number;
  }>(
    sql`SELECT l."investigationId",
               SUM(ac."allegedAmountHuf" * ac.confidence / 100.0)::text AS claimed_low,
               SUM(ac."allegedAmountHuf")::text                          AS claimed_high,
               COUNT(*)::int                                              AS claim_count
          FROM "ArticleClaim" ac
          JOIN "InvestigationArticleLink" l
            ON l."articleSource" = ac."articleSource"
           AND l."articleId"     = ac."articleId"
         WHERE ac."allegedAmountHuf" IS NOT NULL
         GROUP BY l."investigationId"`,
  );
  // Most recent article publication date per investigation.
  const latestArticleDatePerInvP = db.execute<{
    investigationId: string;
    latest_at: string | null;
  }>(
    sql`SELECT l."investigationId",
               GREATEST(
                 MAX(CASE WHEN l."articleSource" = 'news'
                          THEN na."publishedAt" END),
                 MAX(CASE WHEN l."articleSource" = 'kmonitor'
                          THEN ka."pubTime" END)
               )::text AS latest_at
          FROM "InvestigationArticleLink" l
          LEFT JOIN "NewsArticle" na
            ON l."articleSource" = 'news' AND na.id::text = l."articleId"
          LEFT JOIN "KMonitorArticle" ka
            ON l."articleSource" = 'kmonitor'
            AND ka."newsId"::text = l."articleId"
         GROUP BY l."investigationId"`,
  );

  // Per-person aggregate for the grouped landing view (each name once).
  const peopleAggP = groupByPerson
    ? db.execute<{
        person: string;
        person_norm: string | null;
        matters: number;
        articles: number;
        dmg_low: string | null;
        dmg_high: string | null;
      }>(
        sql`SELECT i."primaryPersonName"        AS person,
                   i."primaryPersonNormalized"  AS person_norm,
                   COUNT(*)::int                AS matters,
                   COALESCE(SUM(i."articleCount"),0)::int AS articles,
                   COALESCE(SUM(d."totalLowHuf"),0)::text  AS dmg_low,
                   COALESCE(SUM(d."totalHighHuf"),0)::text AS dmg_high
              FROM "Investigation" i
              LEFT JOIN "DamageEstimate" d ON d."investigationId" = i.id
             WHERE i."primaryPersonName" IS NOT NULL
               ${status === 'all' ? sql`` : sql`AND i.status = ${status}`}
             GROUP BY i."primaryPersonName", i."primaryPersonNormalized"
             ORDER BY COALESCE(SUM(d."totalHighHuf"),0) DESC, COUNT(*) DESC
             LIMIT 200`,
      )
    : Promise.resolve([]);

  // KPI aggregates — all read-only, fire in parallel.
  const kpiActiveP = db.execute<{ c: number }>(
    sql`SELECT COUNT(*)::int AS c FROM "Investigation" WHERE status = 'new'`,
  );
  const kpiNewClaimsP = db.execute<{ c: number }>(
    sql`SELECT COUNT(*)::int AS c FROM "ArticleClaim" WHERE "createdAt" > NOW() - INTERVAL '24 hours'`,
  );
  const kpiAwaitingReviewerP = db.execute<{ c: number }>(
    sql`SELECT COUNT(*)::int AS c
        FROM "Investigation" i
        WHERE i.status = 'new'
          AND NOT EXISTS (
            SELECT 1 FROM "ExternalRecord" e WHERE e."investigationId" = i.id
          )`,
  );
  const kpiRedFlagsP = db.execute<{ c: number }>(
    sql`SELECT COUNT(*)::int AS c FROM "RedFlagCheck" WHERE verdict = 'fail'`,
  );
  const kpiDamageRangeP = db.execute<{
    low: string | null;
    high: string | null;
  }>(
    // Honest total: sum each TED contract's documented overrun ONCE (a
    // contractor's overrun is attributed to every case it touches, so summing
    // per-case DamageEstimates would double-count shared contractors).
    sql`SELECT COALESCE(SUM(d), 0)::text AS low, COALESCE(SUM(d), 0)::text AS high
        FROM (
          SELECT DISTINCT e."externalId",
            (e."rawPayload"->>'awardedHuf')::numeric - (e."rawPayload"->>'estimatedHuf')::numeric AS d
          FROM "ExternalRecord" e
          JOIN "Investigation" i ON i.id = e."investigationId"
          WHERE i."caseKeySource" LIKE 'kmonitor_%' AND e."sourceSystem" = 'TED'
            AND (e."rawPayload"->>'awardedHuf') IS NOT NULL
            AND (e."rawPayload"->>'estimatedHuf') IS NOT NULL
            AND (e."rawPayload"->>'awardedHuf')::numeric > (e."rawPayload"->>'estimatedHuf')::numeric
            AND (e."rawPayload"->>'awardedHuf')::numeric <= (e."rawPayload"->>'estimatedHuf')::numeric * 3
        ) t`,
  );
  const kpiLlmSpendTodayP = db.execute<{ total: string | null }>(
    sql`SELECT COALESCE(SUM("estimatedHufSpend"), 0)::text AS total
        FROM "DailyLlmUsage" WHERE "day" = CURRENT_DATE`,
  );
  // Coverage by evidential tier: TED-grounded vs sourced press allegation.
  const kpiGroundedP = db.execute<{
    grounded: number;
    alleged: number;
    estimated: number;
    total: number;
  }>(
    sql`SELECT
          COUNT(*) FILTER (WHERE d.basis = 'procurement_modeled')::int AS grounded,
          COUNT(*) FILTER (WHERE d.basis = 'alleged_reported')::int    AS alleged,
          COUNT(*) FILTER (WHERE d.basis = 'estimated_rough')::int     AS estimated,
          (SELECT COUNT(*)::int FROM "Investigation" WHERE status = 'new') AS total
        FROM "DamageEstimate" d
        JOIN "Investigation" i ON i.id = d."investigationId"
        WHERE i."caseKeySource" LIKE 'kmonitor_%'`,
  );

  // Selected-row preview data (single round-trip per page render when set).
  const previewRowP = selectedId
    ? db
        .select()
        .from(schema.investigations)
        .where(eq(schema.investigations.id, selectedId))
        .limit(1)
    : Promise.resolve([]);
  const previewClaimP = selectedId
    ? db.execute<{
        mechanism: string;
        allegedAmountHuf: string | null;
        amountBasis: string | null;
        confidence: number;
        evidenceQuote: string;
        sourceUrl: string;
        paragraphLocator: string;
        claimCount: number;
      }>(
        sql`SELECT ac.mechanism, ac."allegedAmountHuf"::text AS "allegedAmountHuf",
                   ac."amountBasis", ac.confidence, ac."evidenceQuote",
                   ac."sourceUrl", ac."paragraphLocator",
                   (SELECT COUNT(*)::int FROM "ArticleClaim" ac2
                    JOIN "InvestigationArticleLink" l2
                      ON l2."articleSource" = ac2."articleSource"
                     AND l2."articleId" = ac2."articleId"
                    WHERE l2."investigationId" = ${selectedId}) AS "claimCount"
              FROM "ArticleClaim" ac
              JOIN "InvestigationArticleLink" l
                ON l."articleSource" = ac."articleSource"
               AND l."articleId" = ac."articleId"
              WHERE l."investigationId" = ${selectedId}
              ORDER BY ac.confidence DESC, ac."claimOrdinal" ASC
              LIMIT 1`,
      )
    : Promise.resolve(undefined);
  const previewMetaP = selectedId
    ? db.execute<{
        headline: string | null;
        source: string | null;
        mechanisms: string[] | null;
      }>(
        sql`SELECT
              (SELECT
                 CASE
                   WHEN l."articleSource" = 'news'
                     THEN (SELECT na.headline FROM "NewsArticle" na
                           WHERE na.id::text = l."articleId" LIMIT 1)
                   WHEN l."articleSource" = 'kmonitor'
                     THEN (SELECT ka.title FROM "KMonitorArticle" ka
                           WHERE ka."newsId"::text = l."articleId" LIMIT 1)
                 END
               FROM "InvestigationArticleLink" l
               WHERE l."investigationId" = ${selectedId}
               ORDER BY l."createdAt" ASC LIMIT 1) AS headline,
              (SELECT l."articleSource"::text FROM "InvestigationArticleLink" l
               WHERE l."investigationId" = ${selectedId}
               ORDER BY l."createdAt" ASC LIMIT 1) AS source,
              (SELECT array_agg(DISTINCT ac.mechanism::text)
               FROM "ArticleClaim" ac
               JOIN "InvestigationArticleLink" l
                 ON l."articleSource" = ac."articleSource"
                AND l."articleId" = ac."articleId"
               WHERE l."investigationId" = ${selectedId}) AS mechanisms`,
      )
    : Promise.resolve(undefined);
  const previewPipelineP = selectedId
    ? db.execute<{
        has_claims: boolean;
        has_external: boolean;
        has_redflag: boolean;
        has_score: boolean;
      }>(
        sql`SELECT
              EXISTS(
                SELECT 1 FROM "ArticleClaim" ac
                JOIN "InvestigationArticleLink" l
                  ON l."articleSource" = ac."articleSource"
                 AND l."articleId" = ac."articleId"
                WHERE l."investigationId" = ${selectedId}
              ) AS has_claims,
              EXISTS(SELECT 1 FROM "ExternalRecord" WHERE "investigationId" = ${selectedId}) AS has_external,
              EXISTS(SELECT 1 FROM "RedFlagCheck" WHERE "investigationId" = ${selectedId}) AS has_redflag,
              EXISTS(SELECT 1 FROM "Investigation" WHERE id = ${selectedId} AND ("quantityScore"::float > 0 OR "qualityScore" IS NOT NULL)) AS has_score`,
      )
    : Promise.resolve(undefined);

  const [
    rows,
    kpiActiveRaw,
    kpiNewClaimsRaw,
    kpiAwaitingReviewerRaw,
    kpiRedFlagsRaw,
    kpiDamageRangeRaw,
    kpiLlmSpendTodayRaw,
    kpiGroundedRaw,
    previewRows,
    previewClaimRaw,
    previewMetaRaw,
    previewPipelineRaw,
    damagePerInvRaw,
    sourcesPerInvRaw,
    redFlagsPerInvRaw,
    claimedDamagePerInvRaw,
    latestArticleDatePerInvRaw,
    peopleAggRaw,
  ] = await Promise.all([
    rowsP,
    kpiActiveP,
    kpiNewClaimsP,
    kpiAwaitingReviewerP,
    kpiRedFlagsP,
    kpiDamageRangeP,
    kpiLlmSpendTodayP,
    kpiGroundedP,
    previewRowP,
    previewClaimP,
    previewMetaP,
    previewPipelineP,
    damagePerInvP,
    sourcesPerInvP,
    redFlagsPerInvP,
    claimedDamagePerInvP,
    latestArticleDatePerInvP,
    peopleAggP,
  ]);

  const kpiActive = pickQueryRow<{ c: number }>(kpiActiveRaw)?.c ?? 0;
  const kpiNewClaims = pickQueryRow<{ c: number }>(kpiNewClaimsRaw)?.c ?? 0;
  const kpiAwaitingReviewer =
    pickQueryRow<{ c: number }>(kpiAwaitingReviewerRaw)?.c ?? 0;
  const kpiRedFlags = pickQueryRow<{ c: number }>(kpiRedFlagsRaw)?.c ?? 0;
  const damageRow = pickQueryRow<{ low: string | null; high: string | null }>(
    kpiDamageRangeRaw,
  );
  const kpiDamageLow = fmtBigHuf(damageRow?.low ?? null);
  const kpiDamageHigh = fmtBigHuf(damageRow?.high ?? null);
  const kpiLlmSpend = fmtBigHuf(
    pickQueryRow<{ total: string | null }>(kpiLlmSpendTodayRaw)?.total ?? null,
  );
  const grounded = pickQueryRow<{
    grounded: number;
    alleged: number;
    estimated: number;
    total: number;
  }>(kpiGroundedRaw) ?? { grounded: 0, alleged: 0, estimated: 0, total: 0 };

  const allItems: InvestigationListItem[] = rows.map((r) => ({
    id: r.id,
    status: r.status as InvestigationStatus,
    primaryPersonName: r.primaryPersonName,
    primaryEntityName: r.primaryEntityName,
    articleCount: r.articleCount,
    quantityScore: r.quantityScore.toString(),
    qualityScore: r.qualityScore,
    disclosureTier: r.disclosureTier as DisclosureTier,
    publicCaseId: r.publicCaseId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
  const selectedRow = selectedId ? previewRows[0] : undefined;
  const selectedItem = selectedRow
    ? allItems.find((it) => it.id === selectedRow.id) ?? {
        id: selectedRow.id,
        status: selectedRow.status as InvestigationStatus,
        primaryPersonName: selectedRow.primaryPersonName,
        primaryEntityName: selectedRow.primaryEntityName,
        articleCount: selectedRow.articleCount,
        quantityScore: selectedRow.quantityScore.toString(),
        qualityScore: selectedRow.qualityScore,
        disclosureTier: selectedRow.disclosureTier as DisclosureTier,
        publicCaseId: selectedRow.publicCaseId,
        createdAt: selectedRow.createdAt.toISOString(),
        updatedAt: selectedRow.updatedAt.toISOString(),
      }
    : undefined;
  const previewClaim = pickQueryRow<{
    mechanism: string;
    allegedAmountHuf: string | null;
    amountBasis: string | null;
    confidence: number;
    evidenceQuote: string;
    sourceUrl: string;
    paragraphLocator: string;
    claimCount: number;
  }>(previewClaimRaw);
  const previewMeta = pickQueryRow<{
    headline: string | null;
    source: string | null;
    mechanisms: string[] | null;
  }>(previewMetaRaw);
  const previewPipeline = pickQueryRow<{
    has_claims: boolean;
    has_external: boolean;
    has_redflag: boolean;
    has_score: boolean;
  }>(previewPipelineRaw) ?? {
    has_claims: false,
    has_external: false,
    has_redflag: false,
    has_score: false,
  };

  const damageMap = new Map(
    toRows<{
      investigationId: string;
      low: string | null;
      high: string | null;
      basis: string | null;
    }>(damagePerInvRaw).map((r) => [r.investigationId, r]),
  );
  const claimedDamageMap = new Map(
    toRows<{
      investigationId: string;
      claimed_low: string | null;
      claimed_high: string | null;
      claim_count: number;
    }>(claimedDamagePerInvRaw).map((r) => [r.investigationId, r]),
  );
  const sourcesMap = new Map(
    toRows<{ investigationId: string; n: number }>(sourcesPerInvRaw).map((r) => [
      r.investigationId,
      r.n,
    ]),
  );
  const redFlagsMap = new Map(
    toRows<{ investigationId: string; failing: number; total: number }>(
      redFlagsPerInvRaw,
    ).map((r) => [r.investigationId, r]),
  );
  const articleDateMap = new Map(
    toRows<{ investigationId: string; latest_at: string | null }>(
      latestArticleDatePerInvRaw,
    ).map((r) => [r.investigationId, r.latest_at]),
  );
  // caseName per matter (the LLM/headline title shown instead of person/company)
  const caseNameById = new Map(
    rows.map((r) => [r.id, (r as { caseName: string | null }).caseName]),
  );
  const peopleRows = toRows<{
    person: string;
    person_norm: string | null;
    matters: number;
    articles: number;
    dmg_low: string | null;
    dmg_high: string | null;
  }>(peopleAggRaw);

  type Tier = 'estimated' | 'claimed';
  type DamageView = {
    low: string;
    high: string;
    tier: Tier;
    basis?: string | null;
    claimCount?: number;
  };
  function pickDamage(invId: string): DamageView | null {
    const d = damageMap.get(invId);
    if (
      d
      && d.low !== null
      && d.high !== null
      && (Number(d.low) > 0 || Number(d.high) > 0)
    ) {
      return { low: d.low, high: d.high, tier: 'estimated', basis: d.basis };
    }
    const c = claimedDamageMap.get(invId);
    if (
      c
      && c.claimed_low !== null
      && c.claimed_high !== null
      && Number(c.claimed_high) > 0
    ) {
      return {
        low: c.claimed_low,
        high: c.claimed_high,
        tier: 'claimed',
        claimCount: c.claim_count,
      };
    }
    return null;
  }
  function tierLabelHu(t: Tier): string {
    switch (t) {
      case 'estimated':
        return 'becslés';
      case 'claimed':
        return 'állítás';
    }
  }
  // Evidential basis — the visible separation between a proven/modeled figure
  // and a sourced press allegation.
  function basisShort(d: DamageView): string {
    switch (d.basis) {
      case 'court_confirmed':
        return 'ítélet';
      case 'audit_finding':
        return 'ÁSZ/audit';
      case 'procurement_modeled':
        return 'közbeszerzés';
      case 'alleged_reported':
        return 'gyanú';
      case 'estimated_rough':
        return 'becslés';
      default:
        return tierLabelHu(d.tier);
    }
  }
  function fmtRelativeDays(iso: string | null | undefined): string {
    if (!iso) return '';
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return '';
    const days = Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
    if (days === 0) return 'ma';
    return `${days} napja`;
  }
  function fmtIsoYmd(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('hu-HU').replaceAll(' ', '');
  }

  const numberedCount = allItems.filter((it) => pickDamage(it.id) !== null).length;
  const unnumberedCount = allItems.length - numberedCount;

  let items = allItems;
  if (quant === 'numbered' && sort !== 'damage') {
    items = items.filter((it) => pickDamage(it.id) !== null);
  } else if (quant === 'unnumbered') {
    items = items.filter((it) => pickDamage(it.id) === null);
  }
  if (sort === 'damage') {
    items = [...items].sort((a, b) => {
      const da = pickDamage(a.id);
      const db = pickDamage(b.id);
      const aHigh = da ? Number(da.high) : -1;
      const bHigh = db ? Number(db.high) : -1;
      // grounded cases first (by figure), then unknown-damage cases by
      // significance (article count) so big scandals like MNB stay visible
      if (aHigh !== bHigh) return bHigh - aHigh;
      return b.articleCount - a.articleCount;
    });
  } else if (sort === 'article_date') {
    items = [...items].sort((a, b) => {
      const da = Date.parse(articleDateMap.get(a.id) ?? '') || 0;
      const db = Date.parse(articleDateMap.get(b.id) ?? '') || 0;
      return db - da;
    });
  }

  const railCount = items.length;

  const railHrefBase = buildRailBase(status, tier, sort, q);

  return (
    <main className="admin-investigations">
      <header className="page-head">
        <div>
          <div className="eyebrow">07 / Nyomozások · Ügyirat-kezelő</div>
          <h1 className="page-title">
            {kpiActive}
            <br />
            nyitott
            <br />
            <em>nyomozás.</em>
          </h1>
        </div>
        <p className="page-sub">
          Automatikus klaszterezésből származó <strong>nyomozásaink</strong>.
          Cikkenkénti állítás-kinyerés (Haiku 4.5) → mechanizmus-szintű
          csoportosítás → reviewer-vezérelt külső evidencia + vörös zászlók +
          pontozás. Minden átlépés audit-naplóba kerül.
        </p>
      </header>

      <section className="kpis" aria-label="KPI">
        <div className="kpi">
          <div className="kpi-label">Aktív nyomozás</div>
          <div className="kpi-value">{kpiActive}</div>
          <div className="kpi-delta">status = new</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Új állítás</div>
          <div className="kpi-value">{kpiNewClaims}</div>
          <div className="kpi-delta">24 óra · Haiku 4.5</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Várja a reviewer-t</div>
          <div className="kpi-value with-accent">{kpiAwaitingReviewer}</div>
          <div className="kpi-delta">Cross-reference még nem futott</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Vörös zászló</div>
          <div className="kpi-value">{kpiRedFlags}</div>
          <div className="kpi-delta">verdict = fail</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Igazolt kár · közbeszerzés</div>
          <div className="kpi-value">
            {kpiDamageLow.value}–{kpiDamageHigh.value}
            <span className="kpi-unit">
              {kpiDamageHigh.unit || kpiDamageLow.unit}
            </span>
          </div>
          <div className="kpi-delta">
            {grounded.grounded} igazolt · {grounded.alleged} gyanú ·{' '}
            {grounded.estimated} becslés
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">LLM költés · ma</div>
          <div className="kpi-value">
            {kpiLlmSpend.value}
            {kpiLlmSpend.unit ? (
              <span className="kpi-unit">{kpiLlmSpend.unit}</span>
            ) : null}
          </div>
          <div className="kpi-delta">DailyLlmUsage · day = ma</div>
        </div>
      </section>

      <InvestigationFilters
        numberedCount={numberedCount}
        unnumberedCount={unnumberedCount}
      />

      <section className="triage" aria-label="Triázs">
        <aside className="rail" aria-label="Nyomozások listája">
          <div className="rail-head">
            <div className="rail-count">
              {groupByPerson ? (
                <>
                  <strong>{peopleRows.length}</strong> érintett · {kpiActive}{' '}
                  nyomozás
                </>
              ) : (
                <>
                  <strong>{railCount}</strong> ügy · {q} · {kpiActive}{' '}
                  nyomozásból
                </>
              )}
            </div>
            <div className="rail-sort">
              <span>Rendezés:</span>
              <span className="is-active">
                {sort === 'recent'
                  ? 'Friss ↓'
                  : sort === 'quantity'
                  ? 'Mennyiségi ↓'
                  : 'Cikk ↓'}
              </span>
            </div>
          </div>
          {groupByPerson ? (
            <ul className="rail-list rail-list-people">
              {peopleRows.map((p, i) => {
                const range = fmtDamageRange(p.dmg_low, p.dmg_high);
                const href = `/admin/investigations?q=${encodeURIComponent(
                  p.person_norm ?? p.person,
                )}`;
                return (
                  <li key={p.person} className="rail-item">
                    <Link href={href} prefetch={false} scroll={false}>
                      <div className="rail-rank">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="rail-name">{p.person}</div>
                      <div className="rail-entity">
                        {p.matters} ügy · {p.articles} cikk
                      </div>
                      <div className="rail-score">
                        {range ? (
                          <div className="rail-score-amt tier-estimated">
                            {range.primary}
                            <small>{range.unit}</small>
                          </div>
                        ) : (
                          <div className="rail-score-amt rail-score-amt-empty">
                            kár n/a
                          </div>
                        )}
                        <div className="rail-score-grade">összesen</div>
                      </div>
                      <div className="rail-meta">
                        <span className="tag">{p.matters} ügy →</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : items.length === 0 ? (
            <div style={{ padding: '40px 24px', color: 'var(--muted)' }}>
              Nincs találat.
            </div>
          ) : (
            <ul className="rail-list">
              {items.map((it, i) => {
                const isSel = it.id === selectedId;
                const href = `${railHrefBase}selected=${it.id}`;
                const dmgView = pickDamage(it.id);
                const dmgRange = dmgView
                  ? fmtDamageRange(dmgView.low, dmgView.high)
                  : null;
                const rf = redFlagsMap.get(it.id);
                const latestArticleAt = articleDateMap.get(it.id) ?? null;
                return (
                  <li
                    key={it.id}
                    className={`rail-item${isSel ? ' is-selected' : ''}`}
                  >
                    <Link href={href} prefetch={false} scroll={false}>
                      <div className="rail-rank">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="rail-name">
                        {caseNameById.get(it.id)
                          ?? it.primaryPersonName
                          ?? '— (névtelen klaszter)'}
                      </div>
                      <div className="rail-entity">
                        {[it.primaryPersonName, it.primaryEntityName]
                          .filter(Boolean)
                          .join(' · ') || 'Szervezet ismeretlen'}
                      </div>
                      <div className="rail-score">
                        {dmgRange && dmgView ? (
                          <>
                            <div
                              className={`rail-score-amt tier-${dmgView.tier} basis-${
                                dmgView.basis ?? 'none'
                              }`}
                            >
                              {dmgRange.primary}
                              <small>{dmgRange.unit}</small>
                            </div>
                            <div
                              className={`rail-score-grade basis-${
                                dmgView.basis ?? 'none'
                              }`}
                            >
                              {basisShort(dmgView)}
                              {' · '}
                              {fmtQualityShort(it.qualityScore)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="rail-score-amt rail-score-amt-empty">
                              nem megállapított
                            </div>
                            <div className="rail-score-grade">
                              {fmtQualityShort(it.qualityScore)}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="rail-meta">
                        <span className={`tag tier-${it.disclosureTier}`}>
                          {tierLabel(it.disclosureTier)}
                        </span>
                        <span className={`tag status-${it.status}`}>
                          {statusLabel(it.status)}
                        </span>
                        <span className="tag">{it.articleCount} cikk</span>
                        {latestArticleAt ? (
                          <span className="tag rail-meta-date" title={latestArticleAt}>
                            {fmtIsoYmd(latestArticleAt)}
                            {' · '}
                            {fmtRelativeDays(latestArticleAt)}
                          </span>
                        ) : null}
                        {rf && rf.failing > 0 ? (
                          <span className="tag has-redflag">
                            ⚠ {rf.failing}/{rf.total}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="preview" aria-label="Kiválasztott nyomozás">
          {!selectedItem ? (
            <div className="preview-empty">
              <strong>Nincs kiválasztva nyomozás.</strong>
              <br />
              Kattints egy sor a listán a részletek megtekintéséhez,
              <br />
              vagy nyiss meg egyet az <em>F</em> billentyűvel.
            </div>
          ) : (
            <>
              <div className="preview-head">
                <div>
                  <div className="eyebrow">
                    № {selectedItem.id.slice(0, 8)} · gyanú alatt
                    {articleDateMap.get(selectedItem.id) ? (
                      <span className="eyebrow-date">
                        {' · cikk '}
                        {fmtIsoYmd(articleDateMap.get(selectedItem.id))}
                        {' · '}
                        {fmtRelativeDays(articleDateMap.get(selectedItem.id))}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="preview-name">
                    {selectedRow?.caseName
                      ?? selectedItem.primaryPersonName
                      ?? '— (névtelen klaszter)'}
                  </h2>
                  <div className="preview-entity">
                    {[selectedItem.primaryPersonName, selectedItem.primaryEntityName]
                      .filter(Boolean)
                      .join(' · ') || 'Szervezet ismeretlen'}
                  </div>
                  {selectedRow?.summary ? (
                    <p className="preview-synopsis">{selectedRow.summary}</p>
                  ) : null}
                </div>
                <div className="preview-tags">
                  <span className={`tag tier-${selectedItem.disclosureTier}`}>
                    {tierLabel(selectedItem.disclosureTier)}
                  </span>
                  <span className={`tag status-${selectedItem.status}`}>
                    {statusLabel(selectedItem.status)}
                  </span>
                </div>
              </div>

              {(() => {
                const selDmgView = pickDamage(selectedItem.id);
                const selDmgRange = selDmgView
                  ? fmtDamageRange(selDmgView.low, selDmgView.high)
                  : null;
                const selSources = sourcesMap.get(selectedItem.id) ?? 0;
                const selRf = redFlagsMap.get(selectedItem.id);
                const selLatestArticleAt = articleDateMap.get(selectedItem.id) ?? null;
                return (
                  <div className="preview-grid preview-grid-5">
                    <div className="preview-cell">
                      <span className="preview-cell-label">
                        Becsült kár
                        {selDmgView ? (
                          <span className={`damage-tier tier-${selDmgView.tier}`}>
                            {tierLabelHu(selDmgView.tier)}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`preview-cell-value accent${
                          selDmgRange ? '' : ' preview-cell-value-empty'
                        }`}
                      >
                        {selDmgRange ? (
                          <>
                            {selDmgRange.primary}
                            <span className="preview-cell-unit">
                              {selDmgRange.unit}
                            </span>
                          </>
                        ) : (
                          'kár n/a'
                        )}
                      </span>
                      <span className="preview-cell-foot">
                        {selDmgView?.tier === 'estimated'
                          ? 'Σ DamageEstimate komponens · sapkázva szerződésértékre'
                          : selDmgView?.tier === 'claimed'
                          ? `Σ állítás × bizonyítottság · ${selDmgView.claimCount ?? 0} állításból`
                          : 'Külső rekord vagy állításösszeg után számítható'}
                      </span>
                    </div>
                    <div className="preview-cell">
                      <span className="preview-cell-label">Bizonyíték</span>
                      <span className="preview-cell-value compact">
                        {fmtQuality(selectedItem.qualityScore)}
                      </span>
                      <span className="preview-cell-foot">
                        {selectedItem.qualityScore ?? 'Még nincs külső rekord'}
                      </span>
                    </div>
                    <div className="preview-cell">
                      <span className="preview-cell-label">
                        Független források
                      </span>
                      <span className="preview-cell-value">
                        {selSources}
                        <span className="preview-cell-unit">reg</span>
                      </span>
                      <span className="preview-cell-foot">
                        {selectedItem.articleCount} cikk ·{' '}
                        {previewClaim?.claimCount ?? 0} állítás
                      </span>
                    </div>
                    <div className="preview-cell">
                      <span className="preview-cell-label">Vörös zászlók</span>
                      <span
                        className={`preview-cell-value compact${
                          selRf && selRf.failing > 0 ? ' accent' : ''
                        }`}
                      >
                        {selRf
                          ? `${selRf.failing}/${selRf.total}`
                          : '— / —'}
                      </span>
                      <span className="preview-cell-foot">
                        {selRf
                          ? selRf.failing > 0
                            ? `${selRf.failing} szabály bukik`
                            : 'Egyik szabály se bukik'
                          : 'Szabályrendszer még nem futott'}
                      </span>
                    </div>
                    <div className="preview-cell">
                      <span className="preview-cell-label">Szint</span>
                      <span className="preview-cell-value compact">
                        {tierLabel(selectedItem.disclosureTier)}
                      </span>
                      <span className="preview-cell-foot">
                        {selectedItem.disclosureTier}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="preview-split">
                {previewClaim ? (
                  <div className="preview-claim">
                    <div className="eyebrow" style={{ marginBottom: 14 }}>
                      Vezető állítás
                    </div>
                    <div className="preview-claim-card">
                      <div className="preview-claim-head">
                        <span className="claim-mechanism">
                          {mechanismLabel(previewClaim.mechanism)}
                        </span>
                        <span className="claim-amount">
                          {previewClaim.allegedAmountHuf
                            ? new Intl.NumberFormat('hu-HU').format(
                                BigInt(previewClaim.allegedAmountHuf),
                              ) + ' Ft'
                            : 'összeg nincs'}
                          {previewClaim.amountBasis ? (
                            <small> · {previewClaim.amountBasis}</small>
                          ) : null}
                        </span>
                      </div>
                      <blockquote>{previewClaim.evidenceQuote}</blockquote>
                      {previewMeta?.headline ? (
                        <a
                          className="preview-claim-source"
                          href={
                            previewClaim.sourceUrl
                              + (previewClaim.paragraphLocator
                                ? `#${encodeURIComponent(previewClaim.paragraphLocator)}`
                                : '')
                          }
                          target="_blank"
                          rel="noreferrer noopener"
                          title={previewClaim.sourceUrl}
                        >
                          {previewMeta.headline}
                          <small> · cikk megnyitása ↗</small>
                        </a>
                      ) : null}
                      <div className="preview-claim-foot">
                        <span>Bekezdés · {previewClaim.paragraphLocator}</span>
                        <span>Bizonyítottság · {previewClaim.confidence}%</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div />
                )}

                <div className="preview-pipeline-wrap">
                  <div className="eyebrow" style={{ marginBottom: 14 }}>
                    Pipeline
                  </div>
                  <ul className="preview-pipeline">
                <li className={previewPipeline.has_claims ? 'done' : 'pending'}>
                  <span className="icon">
                    {previewPipeline.has_claims ? '✓' : '○'}
                  </span>
                  <div>
                    <strong>Állítás-kinyerés</strong>
                    <small>ArticleClaim · Haiku 4.5</small>
                  </div>
                  <time>{previewPipeline.has_claims ? 'kész' : 'vár'}</time>
                </li>
                <li className="done">
                  <span className="icon">✓</span>
                  <div>
                    <strong>Klaszterezés</strong>
                    <small>Investigation létrejött</small>
                  </div>
                  <time>kész</time>
                </li>
                <li
                  className={previewPipeline.has_external ? 'done' : 'pending'}
                >
                  <span className="icon">
                    {previewPipeline.has_external ? '✓' : '○'}
                  </span>
                  <div>
                    <strong>Cross-reference</strong>
                    <small>Reviewer-trigger · ExternalRecord</small>
                  </div>
                  <time>
                    {previewPipeline.has_external ? 'kész' : 'vár'}
                  </time>
                </li>
                <li
                  className={previewPipeline.has_redflag ? 'done' : 'pending'}
                >
                  <span className="icon">
                    {previewPipeline.has_redflag ? '✓' : '○'}
                  </span>
                  <div>
                    <strong>Vörös zászlók</strong>
                    <small>RedFlagCheck</small>
                  </div>
                  <time>
                    {previewPipeline.has_redflag ? 'kész' : '—'}
                  </time>
                </li>
                <li className={previewPipeline.has_score ? 'done' : 'pending'}>
                  <span className="icon">
                    {previewPipeline.has_score ? '✓' : '○'}
                  </span>
                  <div>
                    <strong>Pontozás</strong>
                    <small>Mennyiségi + minőségi</small>
                  </div>
                  <time>
                    {previewPipeline.has_score ? 'kész' : '—'}
                  </time>
                </li>
                  </ul>
                  <Link
                    href={`/admin/investigations/${selectedItem.id}`}
                    className="preview-deep-link"
                  >
                    Teljes nyomozás →
                  </Link>
                </div>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function buildRailBase(
  status: string,
  tier: string,
  sort: string,
  q: string,
): string {
  const p = new URLSearchParams();
  if (status && status !== 'new') p.set('status', status);
  if (tier && tier !== 'all') p.set('tier', tier);
  if (sort && sort !== 'recent') p.set('sort', sort);
  if (q) p.set('q', q);
  const prefix = '/admin/investigations?';
  return p.toString() ? `${prefix}${p.toString()}&` : prefix;
}
