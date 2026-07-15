import 'server-only';
import { eq, sql } from 'drizzle-orm';

import { detectResignationFromArticle } from '@korr/db/ai';
import { detectMediaClosureFromArticle } from '@korr/db/ai-closures';
import { detectVerdictFromArticle } from '@korr/db/ai-verdicts';
import { detectAssetRecoveryFromArticle } from '@korr/db/ai-assets';
import {
  articleDateIso,
  decideStatus,
  findExistingVerdict,
  hasIndividualResignationForInstitution,
  isCollectiveEntityName,
  isDuplicate,
  isPlaceholderName,
  isTransientLlmFailure,
  isWatchlistPerson,
  NEAR_MISS_MIN,
  type DetectorType,
} from '@korr/db';
import { getDb, schema } from './db';
import { notifyReviewNeeded } from './notify';
import { inngest } from '../inngest/client';
import { coerceResignationType, coerceSector } from '../inngest/functions/detect-resignations';
import { coerceClosureEventType } from '../inngest/functions/detect-media-closures';

const ASSET_CONFIDENCE_FLOOR = 0.7;

export type ArticleForReprocess = {
  id: string;
  headline: string;
  excerpt: string;
  sourceUrl: string | null;
  sourceName: string | null;
  publishedAt: Date;
};

export type ProcessOutcome =
  | { status: 'inserted' | 'updated'; recordId: string }
  // 2026-07-14 — a multi-person resignation article (see processResignation)
  // can auto-approve more than one row from a single button press.
  | { status: 'inserted_multi'; recordIds: string[]; total: number }
  | { status: 'pending_notified' }
  | { status: 'discarded'; reason: string }
  | { status: 'error'; message: string };

type Db = ReturnType<typeof getDb>;

/**
 * 008-telegram-review-bot — unlike the cron's markChecked() (ON CONFLICT DO
 * NOTHING, by design: a concurrent run must never clobber an existing
 * decision), a human-triggered re-process here MUST be able to upgrade an
 * existing 'discarded'/near_miss DetectionCheck row to 'inserted' once the
 * editor approves it — otherwise the audit trail stays permanently wrong.
 */
async function upsertDetectionCheckOverride(
  db: Db,
  opts: { articleId: string; detectorType: DetectorType; outcome: 'inserted' | 'discarded'; reason?: string; extractedName?: string; confidence?: number },
): Promise<void> {
  await db.execute(sql`
    INSERT INTO "DetectionCheck"
      ("articleId", "detectorType", outcome, reason, "extractedName", confidence)
    VALUES (
      ${opts.articleId}, ${opts.detectorType}, ${opts.outcome},
      ${opts.reason ?? null}, ${opts.extractedName ?? null}, ${opts.confidence ?? null}
    )
    ON CONFLICT ("articleId", "detectorType") DO UPDATE SET
      outcome = EXCLUDED.outcome,
      reason = EXCLUDED.reason,
      "extractedName" = EXCLUDED."extractedName",
      confidence = EXCLUDED.confidence,
      "checkedAt" = now()
  `);
}

function resolveDate(raw: string | undefined, fallback: Date): Date {
  if (!raw) return fallback;
  try {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? fallback : d;
  } catch {
    return fallback;
  }
}

/**
 * Re-runs the resignation detector on an already-stored article.
 * bypassConfidenceGate=true = a human already approved a near_miss — skip
 * decideStatus()'s discard branch entirely, always insert as 'approved'.
 * bypassConfidenceGate=false = the cross-category check (008 US2) — applies
 * the SAME thresholds/routing as the hourly cron, including a fresh
 * near_miss/pending notification if that's what the confidence warrants.
 */
/**
 * 2026-07-14 — an article can name several distinct people leaving positions
 * at once (see resignation-detect.ts). Every entry in result.resignations
 * runs the full per-item pipeline; the single DetectionCheck row and the
 * returned ProcessOutcome summarize what happened across all of them.
 */
export async function processResignation(article: ArticleForReprocess, todayIso: string, bypassConfidenceGate: boolean): Promise<ProcessOutcome> {
  const db = getDb();
  const llmResult = await detectResignationFromArticle(article.headline, article.excerpt, articleDateIso(article.publishedAt));
  if (isTransientLlmFailure(llmResult)) return { status: 'error', message: 'Az AI-hívás átmenetileg hibázott, próbáld újra.' };

  const result = llmResult.data;
  if (!result || result.resignations.length === 0) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'resignation', outcome: 'discarded', reason: 'not_applicable' });
    return { status: 'discarded', reason: 'not_applicable' };
  }

  const approvedIds: string[] = [];
  const pendingIds: string[] = [];
  let pinnedInserted = false;
  let lastDiscardReason = 'not_applicable';
  let lastName: string | undefined;
  let lastConfidence: number | undefined;

  for (const person of result.resignations) {
    lastName = person.name || lastName;
    lastConfidence = person.confidence;

    if (!person.name || isPlaceholderName(person.name) || !person.institution) {
      lastDiscardReason = 'missing_fields';
      continue;
    }

    let reviewStatus: 'approved' | 'pending' | 'discard' = 'approved';
    if (!bypassConfidenceGate) {
      reviewStatus = decideStatus(person.confidence, isWatchlistPerson(person.name));
      if (reviewStatus === 'discard') {
        lastDiscardReason = 'low_confidence';
        if (person.confidence >= NEAR_MISS_MIN) {
          await notifyReviewNeeded({ type: 'near_miss', detectorType: 'resignation', name: person.name, confidence: person.confidence, articleUrl: article.sourceUrl ?? '', articleId: article.id });
        }
        continue;
      }
    }

    if (await isDuplicate(db, { table: 'PoliticalResignation', nameColumn: 'name' }, person.name)) {
      lastDiscardReason = 'duplicate';
      continue;
    }
    if (isCollectiveEntityName(person.name) && await hasIndividualResignationForInstitution(db, person.institution)) {
      lastDiscardReason = 'duplicate';
      continue;
    }
    if (!article.sourceUrl) {
      lastDiscardReason = 'missing_source';
      continue;
    }

    const pinned = isWatchlistPerson(person.name);
    const [row] = await db.insert(schema.politicalResignations).values({
      name: person.name.slice(0, 200),
      position: person.position.slice(0, 200),
      institution: person.institution.slice(0, 200),
      resignationType: coerceResignationType(person.resignationType),
      resignationDate: resolveDate(person.resignationDate, article.publishedAt),
      description: person.description.slice(0, 1000) || null,
      sector: coerceSector(person.sector),
      pinned,
      reviewStatus: reviewStatus === 'approved' ? 'approved' : 'pending',
      sourceUrls: [article.sourceUrl],
      sourceNames: article.sourceName ? [article.sourceName] : [],
    }).returning({ id: schema.politicalResignations.id });

    if (pinned) pinnedInserted = true;

    if (reviewStatus === 'pending') {
      pendingIds.push(row!.id);
      await notifyReviewNeeded({ type: 'pending', detectorType: 'resignation', name: person.name, confidence: person.confidence, articleUrl: article.sourceUrl ?? '', articleId: article.id, recordId: row!.id });
    } else {
      approvedIds.push(row!.id);
    }
  }

  const totalInserted = approvedIds.length + pendingIds.length;
  if (totalInserted > 0) {
    await db.update(schema.newsArticles).set({ tag: 'Lemondás', isBreakingCandidate: pinnedInserted || approvedIds.length > 0 }).where(eq(schema.newsArticles.id, article.id));
  }
  await upsertDetectionCheckOverride(db, {
    articleId: article.id,
    detectorType: 'resignation',
    outcome: totalInserted > 0 ? 'inserted' : 'discarded',
    reason: totalInserted > 0 ? undefined : lastDiscardReason,
    extractedName: lastName,
    confidence: lastConfidence,
  });

  if (totalInserted === 0) {
    return { status: 'discarded', reason: lastDiscardReason };
  }
  if (approvedIds.length > 0) {
    await inngest.send({ name: 'breaking.recompute', data: { reason: 'resignation:telegram-approve' } });
  }
  if (approvedIds.length === 1 && pendingIds.length === 0) {
    return { status: 'inserted', recordId: approvedIds[0]! };
  }
  if (approvedIds.length > 0) {
    return { status: 'inserted_multi', recordIds: approvedIds, total: result.resignations.length };
  }
  return { status: 'pending_notified' };
}

export async function processMediaClosure(article: ArticleForReprocess, todayIso: string, bypassConfidenceGate: boolean): Promise<ProcessOutcome> {
  const db = getDb();
  const llmResult = await detectMediaClosureFromArticle(article.headline, article.excerpt, articleDateIso(article.publishedAt));
  if (isTransientLlmFailure(llmResult)) return { status: 'error', message: 'Az AI-hívás átmenetileg hibázott, próbáld újra.' };

  const result = llmResult.data;
  if (!result || !result.isClosure) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'media_closure', outcome: 'discarded', reason: 'not_applicable' });
    return { status: 'discarded', reason: 'not_applicable' };
  }
  if (!result.name || isPlaceholderName(result.name)) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'media_closure', outcome: 'discarded', reason: 'missing_fields', confidence: result.confidence });
    return { status: 'discarded', reason: 'missing_fields' };
  }

  let reviewStatus: 'approved' | 'pending' | 'discard' = 'approved';
  if (!bypassConfidenceGate) {
    reviewStatus = decideStatus(result.confidence, false);
    if (reviewStatus === 'discard') {
      await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'media_closure', outcome: 'discarded', reason: 'low_confidence', extractedName: result.name, confidence: result.confidence });
      if (result.confidence >= NEAR_MISS_MIN) {
        await notifyReviewNeeded({ type: 'near_miss', detectorType: 'media_closure', name: result.name, confidence: result.confidence, articleUrl: article.sourceUrl ?? '', articleId: article.id });
      }
      return { status: 'discarded', reason: 'low_confidence' };
    }
  }

  if (await isDuplicate(db, { table: 'MediaClosure', nameColumn: 'name' }, result.name)) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'media_closure', outcome: 'discarded', reason: 'duplicate', extractedName: result.name, confidence: result.confidence });
    return { status: 'discarded', reason: 'duplicate' };
  }
  if (!article.sourceUrl) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'media_closure', outcome: 'discarded', reason: 'missing_source', extractedName: result.name, confidence: result.confidence });
    return { status: 'discarded', reason: 'missing_source' };
  }

  const [row] = await db.insert(schema.mediaClosures).values({
    name: result.name.slice(0, 200),
    eventType: coerceClosureEventType(result.eventType),
    description: result.description.slice(0, 1000) || null,
    eventDate: resolveDate(result.eventDate, article.publishedAt),
    sourceUrl: article.sourceUrl,
    sourceName: article.sourceName,
    reviewStatus: reviewStatus === 'approved' ? 'approved' : 'pending',
  }).returning({ id: schema.mediaClosures.id });

  await db.update(schema.newsArticles).set({ tag: 'Megszűnés' }).where(eq(schema.newsArticles.id, article.id));
  await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'media_closure', outcome: 'inserted', extractedName: result.name, confidence: result.confidence });

  if (reviewStatus === 'pending') {
    await notifyReviewNeeded({ type: 'pending', detectorType: 'media_closure', name: result.name, confidence: result.confidence, articleUrl: article.sourceUrl ?? '', articleId: article.id, recordId: row!.id });
    return { status: 'pending_notified' };
  }
  await inngest.send({ name: 'breaking.recompute', data: { reason: 'media_closure:telegram-approve' } });
  return { status: 'inserted', recordId: row!.id };
}

export async function processCourtVerdict(article: ArticleForReprocess, todayIso: string, bypassConfidenceGate: boolean): Promise<ProcessOutcome> {
  const db = getDb();
  const llmResult = await detectVerdictFromArticle(article.headline, article.excerpt, articleDateIso(article.publishedAt));
  if (isTransientLlmFailure(llmResult)) return { status: 'error', message: 'Az AI-hívás átmenetileg hibázott, próbáld újra.' };

  const result = llmResult.data;
  if (!result || !result.isVerdict) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'court_verdict', outcome: 'discarded', reason: 'not_applicable' });
    return { status: 'discarded', reason: 'not_applicable' };
  }
  if (!result.personName || isPlaceholderName(result.personName) || !result.verdictType) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'court_verdict', outcome: 'discarded', reason: 'missing_fields', extractedName: result.personName || undefined, confidence: result.confidence });
    return { status: 'discarded', reason: 'missing_fields' };
  }

  let reviewStatus: 'approved' | 'pending' | 'discard' = 'approved';
  if (!bypassConfidenceGate) {
    reviewStatus = decideStatus(result.confidence, isWatchlistPerson(result.personName));
    if (reviewStatus === 'discard') {
      await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'court_verdict', outcome: 'discarded', reason: 'low_confidence', extractedName: result.personName, confidence: result.confidence });
      if (result.confidence >= NEAR_MISS_MIN) {
        await notifyReviewNeeded({ type: 'near_miss', detectorType: 'court_verdict', name: result.personName, confidence: result.confidence, articleUrl: article.sourceUrl ?? '', articleId: article.id });
      }
      return { status: 'discarded', reason: 'low_confidence' };
    }
  }

  const existingVerdict = await findExistingVerdict(db, result.personName);
  if (existingVerdict && existingVerdict.verdictType === result.verdictType) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'court_verdict', outcome: 'discarded', reason: 'duplicate', extractedName: result.personName, confidence: result.confidence });
    return { status: 'discarded', reason: 'duplicate' };
  }
  if (!article.sourceUrl) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'court_verdict', outcome: 'discarded', reason: 'missing_source', extractedName: result.personName, confidence: result.confidence });
    return { status: 'discarded', reason: 'missing_source' };
  }

  const verdictDate = resolveDate(result.verdictDate, article.publishedAt);
  const todaySlice = todayIso;
  let recordId: string;
  let outcomeStatus: 'inserted' | 'updated';
  if (existingVerdict) {
    await getDb().update(schema.courtVerdicts).set({
      verdictType: result.verdictType,
      sentenceYears: result.sentenceYears ?? 0,
      sentenceMonths: result.sentenceMonths ?? null,
      sentenceLabel: (result.sentenceLabel ?? '').slice(0, 200),
      verdictDate,
      summary: result.summary.slice(0, 1000),
      description: result.description ? result.description.slice(0, 200) : null,
      sourceUrls: sql`array_append("sourceUrls", ${article.sourceUrl})`,
      sourceNames: sql`array_append("sourceNames", ${article.sourceName ?? ''})`,
      sourceHeadlines: sql`array_append("sourceHeadlines", ${article.headline.slice(0, 500)})`,
      sourceDates: sql`array_append("sourceDates", ${todaySlice})`,
      updatedAt: new Date(),
    }).where(eq(schema.courtVerdicts.id, existingVerdict.id));
    recordId = existingVerdict.id;
    outcomeStatus = 'updated';
  } else {
    const [row] = await getDb().insert(schema.courtVerdicts).values({
      personName: result.personName.slice(0, 200),
      position: result.position.slice(0, 200),
      crimes: result.crimes.map((c) => c.slice(0, 200)),
      sentenceYears: result.sentenceYears ?? 0,
      sentenceMonths: result.sentenceMonths ?? null,
      sentenceLabel: (result.sentenceLabel ?? '').slice(0, 200),
      verdictType: result.verdictType,
      verdictDate,
      court: (result.court || 'Ismeretlen bíróság').slice(0, 200),
      summary: result.summary.slice(0, 1000),
      description: result.description ? result.description.slice(0, 200) : null,
      sourceUrls: [article.sourceUrl],
      sourceNames: article.sourceName ? [article.sourceName] : [],
      sourceHeadlines: article.headline ? [article.headline.slice(0, 500)] : [],
      sourceDates: [todaySlice],
      reviewStatus: reviewStatus === 'approved' ? 'approved' : 'pending',
    }).returning({ id: schema.courtVerdicts.id });
    recordId = row!.id;
    outcomeStatus = 'inserted';
  }

  await getDb().update(schema.newsArticles).set({ tag: 'Ítélet', isBreakingCandidate: true }).where(eq(schema.newsArticles.id, article.id));
  await upsertDetectionCheckOverride(getDb(), { articleId: article.id, detectorType: 'court_verdict', outcome: 'inserted', extractedName: result.personName, confidence: result.confidence });

  if (reviewStatus === 'pending') {
    await notifyReviewNeeded({ type: 'pending', detectorType: 'court_verdict', name: result.personName, confidence: result.confidence, articleUrl: article.sourceUrl ?? '', articleId: article.id, recordId });
    return { status: 'pending_notified' };
  }
  await inngest.send({ name: 'breaking.recompute', data: { reason: 'court_verdict:telegram-approve' } });
  return { status: outcomeStatus, recordId };
}

export async function processAssetRecovery(article: ArticleForReprocess, todayIso: string, bypassConfidenceGate: boolean): Promise<ProcessOutcome> {
  const db = getDb();
  const llmResult = await detectAssetRecoveryFromArticle(article.headline, article.excerpt, articleDateIso(article.publishedAt));
  if (isTransientLlmFailure(llmResult)) return { status: 'error', message: 'Az AI-hívás átmenetileg hibázott, próbáld újra.' };

  const result = llmResult.data;
  if (!result || !result.isRecovery) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'asset_recovery', outcome: 'discarded', reason: 'not_applicable' });
    return { status: 'discarded', reason: 'not_applicable' };
  }

  if (!bypassConfidenceGate && result.confidence < ASSET_CONFIDENCE_FLOOR) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'asset_recovery', outcome: 'discarded', reason: 'low_confidence', extractedName: result.caseLabel || undefined, confidence: result.confidence });
    if (result.confidence >= NEAR_MISS_MIN && result.caseLabel) {
      await notifyReviewNeeded({ type: 'near_miss', detectorType: 'asset_recovery', name: result.caseLabel, confidence: result.confidence, articleUrl: article.sourceUrl ?? '', articleId: article.id });
    }
    return { status: 'discarded', reason: 'low_confidence' };
  }

  if (!result.caseLabel || isPlaceholderName(result.caseLabel) || !result.description) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'asset_recovery', outcome: 'discarded', reason: 'missing_fields', confidence: result.confidence });
    return { status: 'discarded', reason: 'missing_fields' };
  }

  if (await isDuplicate(db, { table: 'AssetRecovery', nameColumn: 'caseLabel' }, result.caseLabel, 14)) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'asset_recovery', outcome: 'discarded', reason: 'duplicate', extractedName: result.caseLabel, confidence: result.confidence });
    return { status: 'discarded', reason: 'duplicate' };
  }
  if (!article.sourceUrl) {
    await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'asset_recovery', outcome: 'discarded', reason: 'missing_source', extractedName: result.caseLabel, confidence: result.confidence });
    return { status: 'discarded', reason: 'missing_source' };
  }

  const caseId = result.caseLabel.toLowerCase().replace(/[^a-záéíóöőúüű0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const [row] = await db.insert(schema.assetRecoveries).values({
    caseId,
    caseLabel: result.caseLabel.slice(0, 200),
    description: result.description.slice(0, 1000),
    amountFt: BigInt(Math.round(result.amountFt)),
    recoveredAt: resolveDate(result.recoveredAt, article.publishedAt),
    sourceUrl: article.sourceUrl,
    sourceName: article.sourceName,
  }).returning({ id: schema.assetRecoveries.id });

  await upsertDetectionCheckOverride(db, { articleId: article.id, detectorType: 'asset_recovery', outcome: 'inserted', extractedName: result.caseLabel, confidence: result.confidence });
  await inngest.send({ name: 'breaking.recompute', data: { reason: 'asset_recovery:telegram-approve' } });
  return { status: 'inserted', recordId: row!.id };
}

export const DETECTOR_PROCESSORS: Record<DetectorType, typeof processResignation> = {
  resignation: processResignation,
  media_closure: processMediaClosure,
  court_verdict: processCourtVerdict,
  asset_recovery: processAssetRecovery,
};
