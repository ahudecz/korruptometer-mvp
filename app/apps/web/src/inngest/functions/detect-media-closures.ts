import 'server-only';
import { eq, sql } from 'drizzle-orm';

import { detectMediaClosureFromArticle, type MediaClosureExtraction } from '@korr/db/ai-closures';
import {
  decideStatus,
  isDuplicate,
  isPlaceholderName,
  markChecked,
  NEAR_MISS_MIN,
  type CandidateArticle,
} from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { notifyReviewNeeded } from '@/lib/notify';
import type { BypassStep, BypassLogger } from '@/lib/cron-bypass';
import { createBypassGuardedFunction, runArticleDetectionBatch, type ArticleProcessResult } from '../lib/detector-runner';

const DETECTOR_TYPE = 'media_closure' as const;

export const CLOSURE_KEYWORDS = [
  'megszűnt', 'megszűnik', 'bezár', 'bezárnak', 'leállítják', 'leáll', 'felszámol',
  'leépítés', 'leépít', 'leépítik', 'elbocsát', 'tömeges kirúgás', 'tömeges elbocsátás',
  'médium', 'szerkesztőség', 'csatorna', 'műsor', 'lap', 'portál',
  'felfüggesztik', 'felfüggesztés', 'elmarad', 'lemondják', 'nem jelenik meg',
];

const VALID_CLOSURE_EVENT_TYPES = ['megszűnés', 'leépítés', 'elmaradt esemény', 'egyéb'] as const;
type ValidClosureEventType = (typeof VALID_CLOSURE_EVENT_TYPES)[number];

/**
 * Same class of bug as detect-resignations.ts's coerceResignationType: a
 * malformed/truncated LLM value inserted straight into a strict Postgres
 * enum throws inside step.run and kills the whole hourly batch, silently
 * starving every other queued article. Repair by prefix match; unknown
 * values fall back to 'egyéb' instead of crashing.
 */
export function coerceClosureEventType(value: string): ValidClosureEventType {
  const normalized = value.normalize('NFC').trim();
  if ((VALID_CLOSURE_EVENT_TYPES as readonly string[]).includes(normalized)) {
    return normalized as ValidClosureEventType;
  }
  const match = VALID_CLOSURE_EVENT_TYPES.find((v) => v.startsWith(normalized) || normalized.startsWith(v.slice(0, 5)));
  return match ?? 'egyéb';
}

async function processClosureArticle(
  article: CandidateArticle,
  result: MediaClosureExtraction | null,
): Promise<ArticleProcessResult> {
  const db = getDb();

  if (!result || !result.isClosure) {
    await markChecked(db, {
      articleId: article.id,
      detectorType: DETECTOR_TYPE,
      outcome: 'discarded',
      reason: 'not_applicable',
    });
    return { inserted: false, approved: false };
  }

  if (!result.name || isPlaceholderName(result.name)) {
    await markChecked(db, {
      articleId: article.id,
      detectorType: DETECTOR_TYPE,
      outcome: 'discarded',
      reason: 'missing_fields',
      confidence: result.confidence,
    });
    return { inserted: false, approved: false };
  }

  // 003-review: media outlets aren't watchlist persons → confidence only.
  const reviewStatus = decideStatus(result.confidence, false);
  if (reviewStatus === 'discard') {
    await markChecked(db, {
      articleId: article.id,
      detectorType: DETECTOR_TYPE,
      outcome: 'discarded',
      reason: 'low_confidence',
      extractedName: result.name,
      confidence: result.confidence,
    });
    if (result.confidence >= NEAR_MISS_MIN) {
      await notifyReviewNeeded({
        type: 'near_miss',
        detectorType: DETECTOR_TYPE,
        name: result.name,
        confidence: result.confidence,
        articleUrl: article.sourceUrl ?? '',
        articleId: article.id,
      });
    }
    return { inserted: false, approved: false };
  }

  if (await isDuplicate(db, { table: 'MediaClosure', nameColumn: 'name' }, result.name)) {
    await markChecked(db, {
      articleId: article.id,
      detectorType: DETECTOR_TYPE,
      outcome: 'discarded',
      reason: 'duplicate',
      extractedName: result.name,
      confidence: result.confidence,
    });
    return { inserted: false, approved: false };
  }

  // Same-URL dedup, independent of name matching — see the identical
  // comment in detect-resignations.ts (2026-07-13, Káel Csaba dupe).
  if (article.sourceUrl) {
    const sameUrlExisting = await db.execute(sql`
      SELECT 1 FROM "MediaClosure" WHERE "sourceUrl" = ${article.sourceUrl} LIMIT 1
    `) as unknown as { length: number };
    if (sameUrlExisting.length > 0) {
      await markChecked(db, {
        articleId: article.id,
        detectorType: DETECTOR_TYPE,
        outcome: 'discarded',
        reason: 'duplicate',
        extractedName: result.name,
        confidence: result.confidence,
      });
      return { inserted: false, approved: false };
    }
  }

  // A public entry MUST always be traceable to a source article —
  // never publish an unsourced claim.
  if (!article.sourceUrl) {
    await markChecked(db, {
      articleId: article.id,
      detectorType: DETECTOR_TYPE,
      outcome: 'discarded',
      reason: 'missing_source',
      extractedName: result.name,
      confidence: result.confidence,
    });
    return { inserted: false, approved: false };
  }

  const fallbackDate = new Date(article.publishedAt as unknown as string);
  let eventDate: Date;
  try {
    eventDate = new Date(result.eventDate);
    if (isNaN(eventDate.getTime())) eventDate = fallbackDate;
  } catch {
    eventDate = fallbackDate;
  }

  const [insertedRow] = await db.insert(schema.mediaClosures).values({
    name: result.name.slice(0, 200),
    eventType: coerceClosureEventType(result.eventType),
    description: result.description.slice(0, 1000) || null,
    eventDate,
    sourceUrl: article.sourceUrl,
    sourceName: article.sourceName,
    reviewStatus,
  }).returning({ id: schema.mediaClosures.id });

  await db
    .update(schema.newsArticles)
    .set({ tag: 'Megszűnés' })
    .where(eq(schema.newsArticles.id, article.id));

  await markChecked(db, {
    articleId: article.id,
    detectorType: DETECTOR_TYPE,
    outcome: 'inserted',
    extractedName: result.name,
    confidence: result.confidence,
  });

  if (reviewStatus === 'pending') {
    await notifyReviewNeeded({
      type: 'pending',
      detectorType: DETECTOR_TYPE,
      name: result.name,
      confidence: result.confidence,
      articleUrl: article.sourceUrl ?? '',
      articleId: article.id,
      recordId: insertedRow!.id,
    });
    return { inserted: true, approved: false };
  }

  return { inserted: true, approved: true };
}

/**
 * closure.detect — cron every hour.
 * Backlog scan (006) over NOT-YET-CHECKED articles from the last 7 days —
 * see specs/006-detection-pipeline-reliability. Auto-inserts confirmed rows
 * into MediaClosure; every non-inserted candidate is recorded in
 * DetectionCheck with a reason, except a transient LLM failure, which is
 * left unrecorded so the article is retried next run.
 */
// 2026-07-22 — kiemelve, hogy a Vercel-cron bypass route Inngest nélkül is
// meg tudja hívni (l. cron-bypass.ts fejléce).
export async function runMediaClosureDetectionCore({ step, logger }: { step: BypassStep; logger?: BypassLogger }) {
  return runArticleDetectionBatch({
    step,
    logger,
    detectorType: DETECTOR_TYPE,
    keywords: CLOSURE_KEYWORDS,
    callLlm: detectMediaClosureFromArticle,
    // 2026-07-24 — l. detect-resignations.ts azonos mintája: gyanú esetén
    // (üres/hiányos találat) egyetlen extra hívás a cikk teljes
    // törzsszövegével, élőben lekérve, SOSE tárolva (constitution IV).
    isIncomplete: (result) => !result || !result.isClosure || !result.name || isPlaceholderName(result.name),
    processArticle: processClosureArticle,
    logLabel: 'closure.detect',
  });
}

export const detectMediaClosures = createBypassGuardedFunction(
  { id: 'detect-media-closures', name: 'Detect media closures', cron: '40 * * * *' },
  runMediaClosureDetectionCore,
);
