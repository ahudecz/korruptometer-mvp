import 'server-only';
import { eq, sql } from 'drizzle-orm';

import { detectCriminalComplaintFromArticle, type ComplaintExtraction } from '@korr/db/ai-complaints';
import {
  decideComplaintTransition,
  decideStatus,
  findExistingComplaint,
  isPlaceholderName,
  isSameComplainant,
  isSameComplainantAi,
  isWatchlistPerson,
  sameApproxComplaintAmount,
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
import { recordSubscriberAlert } from '@/lib/notify-subscribers';

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
    // amountLabel átadva — l. review.ts findExistingComplaint()/amountCloseness()
    // 2026-09-01 fixje: egy pontosan egyező összeg erősebb jel, mint a puszta
    // szóátfedés (Eximbank/Tiborcz duplikátum-bug).
    const existingMatch = await findExistingComplaint(db, complaint.targetName, complaint.amountLabel);
    // 2026-08-11 fix: the fuzzy case-match can correctly find the same
    // broader case while this article is actually reporting a SECOND,
    // independent complaint (different filer) — e.g. the Ministry filing
    // weeks after the Integritás Hatóság's original Gondosóra complaint.
    // Only treat it as an update to the SAME complaint (and run it through
    // the monotonic status state machine) when the filer also matches;
    // otherwise fall through to inserting a new row below. See
    // isSameComplainant()'s doc comment in review.ts for the full story.
    //
    // 2026-08-25 — the free textual check alone still missed real matches
    // when one outlet names the INSTITUTION and another names the PERSON
    // currently heading it ("Külügyminisztérium" vs "Orbán Anita" — 3
    // duplicate rows for the same lélegeztetőgép-feljelentés, user report).
    // AI fallback ONLY fires here — target already matched, cheap, rare —
    // never on every new complaint.
    // 2026-08-30 — Fradiváros-eset: egy szurkolói csoport és később a
    // Belügyminisztérium is "feljelentést tett" ugyanarra a célra, ugyanarra
    // az összegre (24,947 vs 25 Mrd Ft) — a filer-egyeztetés (szöveges ÉS
    // AI) sem ismerte fel duplikátumnak, mert a bejelentő ténylegesen más
    // szereplő. A közel-azonos összeg (l. sameApproxComplaintAmount()
    // komment) erősebb jel: ha van összeg mindkét oldalon és ≤5%-on belül
    // egyeznek, akkor duplikátumnak vesszük FÜGGETLENÜL a bejelentőtől.
    const sameFiler = existingMatch
      ? isSameComplainant(existingMatch.filerName, complaint.filerName)
        || (await isSameComplainantAi(existingMatch.filerName, complaint.filerName))
        || sameApproxComplaintAmount(existingMatch.amountLabel, complaint.amountLabel)
      : false;
    const existing = existingMatch && sameFiler ? existingMatch : null;

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
      // 012-reader-subscriptions FR-018 — 4. hívási hely. Csak az
      // auto-publikált feljelentés riaszt.
      await recordSubscriberAlert({
        section: 'criminal_complaint',
        entityId: insertedRow!.id,
        title: complaint.targetName,
        detail: [complaint.filerName, complaint.amountLabel].filter(Boolean).join(' — '),
      });
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
 * for the same case (findExistingComplaint, matched on targetName) AND the
 * same party filed it (isSameComplainant, matched on filerName) — updates
 * it IF the new status is a genuine forward (or reopening) transition per
 * decideComplaintTransition()'s monotonic state machine. A stale/backward
 * status on the SAME complainant is discarded with reason 'stale_status',
 * never silently overwriting a further-along case. A case-match with a
 * DIFFERENT filer (a second, independent complaint about the same broader
 * case — see isSameComplainant()'s doc comment in review.ts) is treated as
 * a new complaint and gets its own row instead.
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
