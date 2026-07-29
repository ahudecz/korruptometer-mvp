import 'server-only';
import { eq, sql } from 'drizzle-orm';

import { detectCriminalComplaintFromArticle, type ComplaintExtraction } from '@korr/db/ai-complaints';
import {
  decideComplaintTransition,
  decideStatus,
  findExistingComplaint,
  isPlaceholderName,
  isWatchlistPerson,
  markChecked,
  NEAR_MISS_MIN,
  type CandidateArticle,
  type CheckReason,
  type ComplaintStatus,
} from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { notifyReviewNeeded } from '@/lib/notify';
import type { BypassStep, BypassLogger } from '@/lib/cron-bypass';
import { createBypassGuardedFunction, runArticleDetectionBatch, type ArticleProcessResult } from '../lib/detector-runner';

const DETECTOR_TYPE = 'criminal_complaint' as const;

// Keyword pre-filter — the "feljelent" stem covers all Hungarian
// inflections (feljelentés, feljelentette, feljelenti, feljelentést tett,
// stb.), verified empirically against live data (spec 009 Input).
export const COMPLAINT_KEYWORDS = ['feljelent'];

async function processComplaintArticle(
  article: CandidateArticle,
  result: ComplaintExtraction | null,
): Promise<ArticleProcessResult> {
  const db = getDb();
  const todayIso = new Date().toISOString().slice(0, 10);

  if (!result || result.complaints.length === 0) {
    await markChecked(db, {
      articleId: article.id,
      detectorType: DETECTOR_TYPE,
      outcome: 'discarded',
      reason: 'not_applicable',
    });
    return { inserted: false, approved: false };
  }

  let anyHandled = false;
  let anyApproved = false;
  const handledNames: string[] = [];
  let lastDiscardReason: CheckReason = 'not_applicable';
  let lastName: string | undefined;
  let lastConfidence: number | undefined;

  // article.publishedAt is serialized as string by Inngest JSON.
  const eventDate = new Date(article.publishedAt as unknown as string);

  for (const complaint of result.complaints) {
    lastName = complaint.targetName || lastName;
    lastConfidence = complaint.confidence;

    if (!complaint.targetName || isPlaceholderName(complaint.targetName) || !complaint.filerName) {
      lastDiscardReason = 'missing_fields';
      continue;
    }

    const isWatchlist = isWatchlistPerson(complaint.filerName) || isWatchlistPerson(complaint.targetName);
    const reviewStatus = decideStatus(complaint.confidence, isWatchlist);
    if (reviewStatus === 'discard') {
      lastDiscardReason = 'low_confidence';
      if (complaint.confidence >= NEAR_MISS_MIN) {
        await notifyReviewNeeded({
          type: 'near_miss',
          detectorType: DETECTOR_TYPE,
          name: complaint.targetName,
          confidence: complaint.confidence,
          articleUrl: article.sourceUrl ?? '',
          articleId: article.id,
        });
      }
      continue;
    }

    if (!article.sourceUrl) {
      lastDiscardReason = 'missing_source';
      continue;
    }

    const status = complaint.status as ComplaintStatus;
    const existing = await findExistingComplaint(db, complaint.targetName);

    if (existing) {
      const transition = decideComplaintTransition(existing.status, status);
      if (transition === 'stale') {
        lastDiscardReason = 'stale_status';
        continue;
      }
      await db.update(schema.criminalComplaints).set({
        status,
        eventDate,
        sourceUrls: sql`array_append("sourceUrls", ${article.sourceUrl})`,
        sourceNames: sql`array_append("sourceNames", ${article.sourceName ?? ''})`,
        sourceHeadlines: sql`array_append("sourceHeadlines", ${article.headline.slice(0, 500)})`,
        sourceDates: sql`array_append("sourceDates", ${todayIso})`,
        updatedAt: new Date(),
      }).where(eq(schema.criminalComplaints.id, existing.id));

      anyHandled = true;
      handledNames.push(complaint.targetName);

      if (reviewStatus === 'pending') {
        await notifyReviewNeeded({
          type: 'pending',
          detectorType: DETECTOR_TYPE,
          name: complaint.targetName,
          confidence: complaint.confidence,
          articleUrl: article.sourceUrl ?? '',
          articleId: article.id,
          recordId: existing.id,
        });
      } else {
        anyApproved = true;
      }
      continue;
    }

    const [insertedRow] = await db.insert(schema.criminalComplaints).values({
      targetName: complaint.targetName.slice(0, 200),
      filerName: complaint.filerName.slice(0, 200),
      description: complaint.description.slice(0, 1000) || null,
      amountLabel: complaint.amountLabel.slice(0, 200) || null,
      status,
      eventDate,
      filedAt: status === 'feljelentés' ? eventDate : null,
      sourceUrls: [article.sourceUrl],
      sourceNames: article.sourceName ? [article.sourceName] : [],
      sourceHeadlines: [article.headline.slice(0, 500)],
      sourceDates: [todayIso],
      reviewStatus,
    }).returning({ id: schema.criminalComplaints.id });

    anyHandled = true;
    handledNames.push(complaint.targetName);

    if (reviewStatus === 'pending') {
      await notifyReviewNeeded({
        type: 'pending',
        detectorType: DETECTOR_TYPE,
        name: complaint.targetName,
        confidence: complaint.confidence,
        articleUrl: article.sourceUrl ?? '',
        articleId: article.id,
        recordId: insertedRow!.id,
      });
    } else {
      anyApproved = true;
    }
  }

  if (anyHandled) {
    await db
      .update(schema.newsArticles)
      .set({ tag: 'Feljelentés', isBreakingCandidate: anyApproved })
      .where(eq(schema.newsArticles.id, article.id));
  }

  await markChecked(db, {
    articleId: article.id,
    detectorType: DETECTOR_TYPE,
    outcome: anyHandled ? 'inserted' : 'discarded',
    reason: anyHandled ? undefined : lastDiscardReason,
    extractedName: (handledNames.length > 0 ? handledNames.join(', ') : lastName)?.slice(0, 200),
    confidence: lastConfidence,
  });

  return { inserted: anyHandled, approved: anyApproved };
}

/**
 * criminal_complaint.detect — cron every hour, offset from the other 4
 * detectors (:00/:15/:30/:20) to avoid contending for the same LLM budget
 * window. Scans NOT-YET-CHECKED articles from the last 7 days (006 backlog
 * scan), extracts EVERY distinct complaint an article describes (a single
 * kormányinfó can announce several unrelated ones, see spec 009), and either
 * inserts a new CriminalComplaint row or — if a matching row already exists
 * for the same case (findExistingComplaint, matched on targetName, not
 * filerName) — updates it IF the new status is a genuine forward (or
 * reopening) transition per decideComplaintTransition()'s monotonic state
 * machine. A stale/backward status is discarded with reason 'stale_status',
 * never silently overwriting a further-along case.
 */
// 2026-07-22 — kiemelve, hogy a Vercel-cron bypass route Inngest nélkül is
// meg tudja hívni (l. cron-bypass.ts fejléce).
export async function runCriminalComplaintDetectionCore({ step, logger }: { step: BypassStep; logger?: BypassLogger }) {
  return runArticleDetectionBatch({
    step,
    logger,
    detectorType: DETECTOR_TYPE,
    keywords: COMPLAINT_KEYWORDS,
    callLlm: detectCriminalComplaintFromArticle,
    // 2026-07-24 — l. detect-resignations.ts azonos mintája.
    isIncomplete: (result) =>
      !result || result.complaints.length === 0 ||
      result.complaints.some((c) => !c.targetName || isPlaceholderName(c.targetName) || !c.filerName),
    processArticle: processComplaintArticle,
    logLabel: 'criminal_complaint.detect',
  });
}

export const detectCriminalComplaints = createBypassGuardedFunction(
  { id: 'detect-criminal-complaints', name: 'Detect criminal complaints (feljelentés)', cron: '45 * * * *' },
  runCriminalComplaintDetectionCore,
);
