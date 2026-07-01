import { NextResponse } from 'next/server';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { EVIDENCE_GRADE_ORDER } from '@korr/shared';
import type {
  ArticleClaimDto,
  AvailableAction,
  BenchmarkDto,
  DisclosureTier,
  EvidenceGrade,
  ExternalRecordDto,
  HypothesisCapKind,
  InvestigationArticleDto,
  InvestigationDetail,
  InvestigationLeadDto,
  InvestigationStatus,
  LeadActorKind,
  LeadKind,
  LeadStatus,
  Party,
  RedFlagDto,
  Relevance,
} from '@korr/shared';

function notFound() {
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

function evidenceGradeAtLeast(
  observed: EvidenceGrade | null,
  threshold: EvidenceGrade,
): boolean {
  if (!observed) return false;
  return (
    EVIDENCE_GRADE_ORDER.indexOf(observed)
    >= EVIDENCE_GRADE_ORDER.indexOf(threshold)
  );
}

function computeAvailableActions(opts: {
  status: InvestigationStatus;
  tier: DisclosureTier;
  quantityScore: number;
  qualityScore: EvidenceGrade | null;
  hasCorroboratingPublicEligibleSource: boolean;
}): AvailableAction[] {
  const list: AvailableAction[] = [];
  if (opts.status !== 'new') {
    return list;
  }
  list.push('run_xref', 'run_redflags', 'run_hypothesis_loop');
  list.push('escalate_paid_lookup', 'write_paid_result');
  list.push('dismiss', 'merge_into', 'edit_summary');
  // FR-026 promotion predicate (per spec): journalist requires
  // quantity ≥ 2 AND quality ≥ investigative_journalism. Prosecutor uses
  // the same gate by default — the spec ties handoff metadata, not
  // separate thresholds.
  const journalistEligible =
    opts.quantityScore >= 2
    && evidenceGradeAtLeast(opts.qualityScore, 'investigative_journalism');
  if (journalistEligible && opts.tier === 'internal') {
    list.push('promote_journalist');
  }
  if (journalistEligible && opts.tier !== 'prosecutor') {
    list.push('promote_prosecutor');
  }
  // Public requires AT LEAST one corroborating record from
  // {TED, EKR, palyazat, integritas, olaf}, in addition to the gate above.
  if (
    journalistEligible
    && opts.hasCorroboratingPublicEligibleSource
    && opts.tier !== 'public'
  ) {
    list.push('promote_public');
  }
  if (opts.tier === 'public') {
    list.push('depromote_public');
  }
  return list;
}

const PUBLIC_ELIGIBLE_SOURCES = new Set([
  'TED',
  'EKR',
  'palyazat',
  'integritas',
  'olaf',
]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.investigations)
    .where(eq(schema.investigations.id, id))
    .limit(1);
  const inv = rows[0];
  if (!inv) return notFound();

  // Articles via the link table.
  const links = await db
    .select()
    .from(schema.investigationArticleLinks)
    .where(eq(schema.investigationArticleLinks.investigationId, id));

  const newsIds = links
    .filter((l) => l.articleSource === 'news')
    .map((l) => l.articleId);
  const kmIds = links
    .filter((l) => l.articleSource === 'kmonitor')
    .map((l) => Number.parseInt(l.articleId, 10))
    .filter((n) => Number.isFinite(n));

  const [newsRows, kmRows] = await Promise.all([
    newsIds.length === 0
      ? Promise.resolve([] as Array<{ id: string; headline: string; sourceUrl: string }>)
      : (db
          .select({
            id: schema.newsArticles.id,
            headline: schema.newsArticles.headline,
            sourceUrl: schema.newsArticles.sourceUrl,
          })
          .from(schema.newsArticles)
          .where(inArray(schema.newsArticles.id, newsIds)) as unknown as Promise<
          Array<{ id: string; headline: string; sourceUrl: string }>
        >),
    kmIds.length === 0
      ? Promise.resolve([] as Array<{ newsId: number; title: string; sourceUrl: string }>)
      : (db
          .select({
            newsId: schema.kMonitorArticles.newsId,
            title: schema.kMonitorArticles.title,
            sourceUrl: schema.kMonitorArticles.sourceUrl,
          })
          .from(schema.kMonitorArticles)
          .where(inArray(schema.kMonitorArticles.newsId, kmIds)) as unknown as Promise<
          Array<{ newsId: number; title: string; sourceUrl: string }>
        >),
  ]);
  const articles: InvestigationArticleDto[] = [
    ...newsRows.map((r) => ({
      source: 'news' as const,
      id: r.id,
      headline: r.headline,
      sourceUrl: r.sourceUrl,
      role:
        links.find((l) => l.articleSource === 'news' && l.articleId === r.id)
          ?.role ?? 'primary',
    })),
    ...kmRows.map((r) => ({
      source: 'kmonitor' as const,
      id: String(r.newsId),
      headline: r.title,
      sourceUrl: r.sourceUrl,
      role:
        links.find(
          (l) => l.articleSource === 'kmonitor' && l.articleId === String(r.newsId),
        )?.role ?? 'primary',
    })),
  ];

  // Claims joined through the link table, current extractor versions
  // only (most recent per article).
  const sourcePairs = links.map((l) => ({
    s: l.articleSource as 'news' | 'kmonitor',
    a: l.articleId,
  }));
  let claims: ArticleClaimDto[] = [];
  if (sourcePairs.length > 0) {
    // Read every claim matching the article tuples; group by article and
    // keep only the rows whose extractorVersion matches the article's
    // latest run.
    const claimRows = await db
      .select()
      .from(schema.articleClaims)
      .where(
        sourcePairs.length === 1
          ? and(
              eq(schema.articleClaims.articleSource, sourcePairs[0]!.s),
              eq(schema.articleClaims.articleId, sourcePairs[0]!.a),
            )
          : // Use a SQL ANY via a value-set: rebuild from inArray for both columns.
            // This is rare-path: link rows come from clustering and never duplicate
            // the same (source, id); we can dedup client-side.
            inArray(
              schema.articleClaims.articleId,
              sourcePairs.map((p) => p.a),
            ),
      )
      .orderBy(asc(schema.articleClaims.claimOrdinal));

    // Filter to claims whose (articleSource, articleId) is in sourcePairs.
    const pairKeys = new Set(sourcePairs.map((p) => `${p.s}:${p.a}`));
    const filtered = claimRows.filter((c) =>
      pairKeys.has(`${c.articleSource}:${c.articleId}`),
    );

    // Find the latest extractor version per (source, id).
    const latestVersionRows = await db
      .select()
      .from(schema.articleExtractionRuns)
      .where(
        inArray(
          schema.articleExtractionRuns.articleId,
          sourcePairs.map((p) => p.a),
        ),
      )
      .orderBy(desc(schema.articleExtractionRuns.extractedAt));
    const latestByPair = new Map<string, string>();
    for (const r of latestVersionRows) {
      const key = `${r.articleSource}:${r.articleId}`;
      if (!latestByPair.has(key)) latestByPair.set(key, r.extractorVersion);
    }
    const currentOnly = filtered.filter((c) => {
      const key = `${c.articleSource}:${c.articleId}`;
      return latestByPair.get(key) === c.extractorVersion;
    });
    claims = currentOnly.map((c) => ({
      id: c.id,
      articleSource: c.articleSource as 'news' | 'kmonitor',
      articleId: c.articleId,
      claimOrdinal: c.claimOrdinal,
      extractorVersion: c.extractorVersion,
      mechanism: c.mechanism as ArticleClaimDto['mechanism'],
      allegedAmountHuf:
        c.allegedAmountHuf == null ? null : c.allegedAmountHuf.toString(),
      amountBasis: (c.amountBasis ?? null) as ArticleClaimDto['amountBasis'],
      parties: (c.parties as Party[]) ?? [],
      evidenceQuote: c.evidenceQuote,
      sourceUrl: c.sourceUrl,
      paragraphLocator: c.paragraphLocator,
      confidence: c.confidence,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  const externalRows = await db
    .select()
    .from(schema.externalRecords)
    .where(eq(schema.externalRecords.investigationId, id))
    .orderBy(desc(schema.externalRecords.fetchedAt));
  const externalRecords: ExternalRecordDto[] = externalRows.map((r) => ({
    id: r.id,
    sourceSystem: r.sourceSystem as ExternalRecordDto['sourceSystem'],
    externalId: r.externalId,
    canonicalUrl: r.canonicalUrl,
    fetchedAt: r.fetchedAt.toISOString(),
    fetchHash: r.fetchHash,
    recordType: r.recordType,
    relevance: (r.relevance ?? null) as Relevance | null,
    evidenceGrade: (r.evidenceGrade ?? null) as EvidenceGrade | null,
    rawPayload: r.rawPayload,
  }));

  const redFlagRows = await db
    .select()
    .from(schema.redFlagChecks)
    .where(eq(schema.redFlagChecks.investigationId, id))
    .orderBy(desc(schema.redFlagChecks.evaluatedAt));
  const redFlags: RedFlagDto[] = redFlagRows.map((r) => ({
    ruleId: r.ruleId,
    severity: r.severity as RedFlagDto['severity'],
    verdict: r.verdict as RedFlagDto['verdict'],
    observationHu: r.observationHu,
    supportingRecordIds: r.supportingRecordIds ?? [],
    evaluatedAt: r.evaluatedAt.toISOString(),
  }));

  const leadRows = await db
    .select()
    .from(schema.investigationLeads)
    .where(eq(schema.investigationLeads.investigationId, id))
    .orderBy(desc(schema.investigationLeads.createdAt));
  const leads: InvestigationLeadDto[] = leadRows.map((r) => ({
    id: r.id,
    kind: r.kind as LeadKind,
    status: r.status as LeadStatus,
    question: r.question,
    finding: r.finding,
    createdBy: r.createdBy as LeadActorKind,
    capFired: (r.capFired ?? null) as HypothesisCapKind | null,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
  }));

  const benchmarkRows = await db.execute(
    // Pull the benchmarks that include any of this investigation's
    // external-record ids in their memberRecordIds array.
    // Returning shape matches BenchmarkDto + isOutlier hint.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await import('drizzle-orm')).sql`
      SELECT b."cohortHash",
             b.dimension,
             b.p10::text  AS p10,
             b.p50::text  AS p50,
             b.p90::text  AS p90,
             b.n,
             b."computedAt"
        FROM "Benchmark" b
       WHERE EXISTS (
               SELECT 1 FROM "ExternalRecord" er
                WHERE er."investigationId" = ${id}
                  AND er.id = ANY(b."memberRecordIds")
             )
       ORDER BY b."computedAt" DESC
    `,
  );
  const benchmarks: BenchmarkDto[] = (
    (await benchmarkRows) as unknown as Array<{
      cohortHash: string;
      dimension: string;
      p10: string;
      p50: string;
      p90: string;
      n: number;
      computedAt: Date;
    }>
  ).map((b) => ({
    cohortHash: b.cohortHash,
    dimension: b.dimension,
    investigationValue: null,
    p10: b.p10,
    p50: b.p50,
    p90: b.p90,
    n: b.n,
    computedAt: new Date(b.computedAt).toISOString(),
    isOutlier: false,
  }));

  const historyRows = await db
    .select()
    .from(schema.investigationPublicCaseLinks)
    .where(eq(schema.investigationPublicCaseLinks.investigationId, id))
    .orderBy(desc(schema.investigationPublicCaseLinks.promotedAt));
  const history = {
    publicCases: historyRows.map((h) => ({
      id: h.publicCaseId,
      promotedAt: h.promotedAt.toISOString(),
      depromotedAt: h.depromotedAt?.toISOString() ?? null,
    })),
  };

  const hasCorroboratingPublicEligibleSource = externalRecords.some(
    (r) => PUBLIC_ELIGIBLE_SOURCES.has(r.sourceSystem) && r.relevance === 'corroborates',
  );

  const investigationDto: InvestigationDetail['investigation'] = {
    id: inv.id,
    status: inv.status as InvestigationStatus,
    primaryPersonName: inv.primaryPersonName,
    primaryEntityName: inv.primaryEntityName,
    articleCount: inv.articleCount,
    quantityScore: inv.quantityScore.toString(),
    qualityScore: inv.qualityScore as EvidenceGrade | null,
    disclosureTier: inv.disclosureTier as DisclosureTier,
    publicCaseId: inv.publicCaseId,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    summary: inv.summary,
    mergedIntoId: inv.mergedIntoId ?? null,
  };

  const detail: InvestigationDetail = {
    investigation: investigationDto,
    articles,
    claims,
    externalRecords,
    redFlags,
    leads,
    benchmarks,
    history,
    availableActions: computeAvailableActions({
      status: investigationDto.status,
      tier: investigationDto.disclosureTier,
      quantityScore: Number(investigationDto.quantityScore),
      qualityScore: investigationDto.qualityScore,
      hasCorroboratingPublicEligibleSource,
    }),
  };
  return NextResponse.json(detail);
}
