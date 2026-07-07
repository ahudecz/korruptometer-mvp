import 'server-only';
import { and, eq, gte, lt, lte, desc } from 'drizzle-orm';

import { NEAR_MISS_MAX, NEAR_MISS_MIN } from '@korr/db';
import { getDb, schema } from '@/lib/db';

/**
 * 006-detection-pipeline-reliability (US3) — monthly summary of the 4 LLM
 * detectors' activity: what auto-published, what's awaiting editorial
 * review, and what was discarded close enough to the review.ts 0.70 floor
 * (NEAR_MISS_MIN–NEAR_MISS_MAX) to be worth a second human look.
 */

export type MonthRange = { start: Date; end: Date; label: string };

/** Parses "YYYY-MM" (defaults to the current month) into a half-open [start, end) range. */
export function resolveMonth(monthParam?: string): MonthRange {
  const now = new Date();
  const match = monthParam?.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  const label = start.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', timeZone: 'UTC' });
  return { start, end, label };
}

export type DigestEntry = { id: string; name: string; date: Date; detail: string };
export type NearMissEntry = {
  id: string;
  detectorType: string;
  name: string;
  confidence: number;
  checkedAt: Date;
  articleUrl: string | null;
  headline: string | null;
};

export type MonthlyDigest = {
  approved: DigestEntry[];
  pending: DigestEntry[];
  nearMiss: NearMissEntry[];
};

export async function loadMonthlyDigest(range: MonthRange): Promise<MonthlyDigest> {
  const db = getDb();

  const [resignations, closures, verdicts, assets, nearMissRows] = await Promise.all([
    db.select().from(schema.politicalResignations)
      .where(and(gte(schema.politicalResignations.createdAt, range.start), lt(schema.politicalResignations.createdAt, range.end)))
      .orderBy(desc(schema.politicalResignations.createdAt)),
    db.select().from(schema.mediaClosures)
      .where(and(gte(schema.mediaClosures.createdAt, range.start), lt(schema.mediaClosures.createdAt, range.end)))
      .orderBy(desc(schema.mediaClosures.createdAt)),
    db.select().from(schema.courtVerdicts)
      .where(and(gte(schema.courtVerdicts.createdAt, range.start), lt(schema.courtVerdicts.createdAt, range.end)))
      .orderBy(desc(schema.courtVerdicts.createdAt)),
    // AssetRecovery has no reviewStatus — every row is an auto-publish.
    db.select().from(schema.assetRecoveries)
      .where(and(gte(schema.assetRecoveries.createdAt, range.start), lt(schema.assetRecoveries.createdAt, range.end)))
      .orderBy(desc(schema.assetRecoveries.createdAt)),
    db.select({
      id: schema.detectionChecks.id,
      detectorType: schema.detectionChecks.detectorType,
      name: schema.detectionChecks.extractedName,
      confidence: schema.detectionChecks.confidence,
      checkedAt: schema.detectionChecks.checkedAt,
      articleUrl: schema.newsArticles.sourceUrl,
      headline: schema.newsArticles.headline,
    })
      .from(schema.detectionChecks)
      .leftJoin(schema.newsArticles, eq(schema.newsArticles.id, schema.detectionChecks.articleId))
      .where(and(
        eq(schema.detectionChecks.outcome, 'discarded'),
        eq(schema.detectionChecks.reason, 'low_confidence'),
        gte(schema.detectionChecks.confidence, NEAR_MISS_MIN),
        lte(schema.detectionChecks.confidence, NEAR_MISS_MAX),
        gte(schema.detectionChecks.checkedAt, range.start),
        lt(schema.detectionChecks.checkedAt, range.end),
      ))
      .orderBy(desc(schema.detectionChecks.checkedAt)),
  ]);

  const approved: DigestEntry[] = [
    ...resignations.filter((r) => r.reviewStatus === 'approved').map((r) => ({
      id: r.id, name: r.name, date: r.createdAt, detail: `${r.resignationType} — ${r.institution}`,
    })),
    ...closures.filter((c) => c.reviewStatus === 'approved').map((c) => ({
      id: c.id, name: c.name, date: c.createdAt, detail: c.eventType,
    })),
    ...verdicts.filter((v) => v.reviewStatus === 'approved').map((v) => ({
      id: v.id, name: v.personName, date: v.createdAt, detail: v.verdictType,
    })),
    ...assets.map((a) => ({
      id: a.id, name: a.caseLabel, date: a.createdAt, detail: 'vagyonvisszaszerzés',
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const pending: DigestEntry[] = [
    ...resignations.filter((r) => r.reviewStatus === 'pending').map((r) => ({
      id: r.id, name: r.name, date: r.createdAt, detail: `${r.resignationType} — ${r.institution}`,
    })),
    ...closures.filter((c) => c.reviewStatus === 'pending').map((c) => ({
      id: c.id, name: c.name, date: c.createdAt, detail: c.eventType,
    })),
    ...verdicts.filter((v) => v.reviewStatus === 'pending').map((v) => ({
      id: v.id, name: v.personName, date: v.createdAt, detail: v.verdictType,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const nearMiss: NearMissEntry[] = nearMissRows.map((r) => ({
    id: r.id,
    detectorType: r.detectorType,
    name: r.name ?? '(névtelen)',
    confidence: r.confidence ?? 0,
    checkedAt: r.checkedAt,
    articleUrl: r.articleUrl,
    headline: r.headline,
  }));

  return { approved, pending, nearMiss };
}
