import 'server-only';
import { eq, sql } from 'drizzle-orm';

import { detectResignationFromArticle, type ResignationExtraction } from '@korr/db/ai';
import {
  type CandidateArticle,
  type CheckReason,
  cleanPositionTitle,
  decideStatus,
  hasIndividualResignationForInstitution,
  isCollectiveEntityName,
  isDuplicate,
  isPlaceholderName,
  isPermanentBreakingPerson,
  isWatchlistPerson,
  markChecked,
  NEAR_MISS_MIN,
  truncateDescriptionWords,
} from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { notifyReviewNeeded } from '@/lib/notify';
import type { BypassStep, BypassLogger } from '@/lib/cron-bypass';
import { createBypassGuardedFunction, runArticleDetectionBatch, type ArticleProcessResult } from '../lib/detector-runner';

const DETECTOR_TYPE = 'resignation' as const;

const VALID_RESIGNATION_TYPES = ['lemondás', 'kirúgás', 'felmentés', 'egyéb'] as const;
type ValidResignationType = (typeof VALID_RESIGNATION_TYPES)[number];

/**
 * The LLM tool call is schema-constrained to these 4 values, but streamed/
 * partial tool-call output has been observed to truncate or otherwise mangle
 * the string (e.g. "lemond" instead of "lemondás") — a raw insert of that
 * value throws a Postgres enum error that kills the whole batch step, so
 * every other article queued in the same hourly run silently goes
 * unprocessed too. Repair obvious truncations by prefix match; anything
 * unrecognisable falls back to 'egyéb' rather than crashing the batch.
 */
export function coerceResignationType(value: string): ValidResignationType {
  const normalized = value.normalize('NFC').trim();
  if ((VALID_RESIGNATION_TYPES as readonly string[]).includes(normalized)) {
    return normalized as ValidResignationType;
  }
  const match = VALID_RESIGNATION_TYPES.find((v) => v.startsWith(normalized) || normalized.startsWith(v.slice(0, 5)));
  return match ?? 'egyéb';
}

const VALID_SECTORS = [
  'nemzetbiztonság',
  'fegyveres és rendvédelmi szervek',
  'ügyészség',
  'honvédség',
  'hatóságok, hivatalok, állami cégek',
  'egészségügy',
  'média',
  'sport és civil szervezetek',
  'kultúra',
  'közigazgatás',
  'egyéb',
] as const;
type ValidSector = (typeof VALID_SECTORS)[number];

/**
 * 2026-07-14 — sector is a brand-new field on the LLM schema (see
 * resignation-detect.ts); same truncation/mangling risk as
 * coerceResignationType, so it gets the same guarded fallback instead of a
 * raw enum insert that could crash the whole batch step.
 */
export function coerceSector(value: string): ValidSector {
  const normalized = value.normalize('NFC').trim();
  if ((VALID_SECTORS as readonly string[]).includes(normalized)) {
    return normalized as ValidSector;
  }
  return 'egyéb';
}

// Quick keyword pre-filter — avoids burning LLM tokens on irrelevant articles.
//
// 2026-07-16 — a real miss slipped through: "Rendészeti vezetőket cserélt le
// Pósfai Gábor belügyminiszter" (Töreki Sándor's kinevezés-visszavonása)
// never reached the LLM because none of the old keywords matched "cserélt
// le" / "visszavonta a kinevezését" — user report. Added 'cserél' and
// 'visszavon', then (same day, user-supplied full kirúgás-szinonima lista)
// the rest below. Stems are used instead of full words wherever safe so
// inflected forms match too (e.g. 'levált' catches "leváltás", "leváltotta",
// "leváltják", "leváltásra" — consolidated the old separate entries for
// this reason; 'távoz' the same way now also catches "távozás", which the
// old 'távozik'/'távozott'-only pair missed). 'megválás' is kept as a full
// word, not the shorter 'megvál' stem, because that stem would also match
// "megválasztás" (election) — an unrelated false-positive class not worth
// the extra LLM calls. This is a pre-filter only (the LLM still makes the
// real lemondás/kirúgás/felmentés/nincs-ilyen call), so a broader list only
// costs a few extra LLM calls, not precision.
export const RESIGNATION_KEYWORDS = [
  'lemond', 'kirúg', 'felment', 'levált', 'mond le', 'menesz',
  'visszahív', 'cserél', 'visszavon', 'távoz',
  // kirúgás szinonimái (2026-07-16, user által megadott teljes lista):
  'elbocsát', 'felmond', 'megválás', 'megszüntet', 'állásveszt',
  'eltanácsol', 'hivatalveszt', 'eltávolít',
];

async function processResignationArticle(
  article: CandidateArticle,
  result: ResignationExtraction | null,
): Promise<ArticleProcessResult> {
  const db = getDb();

  if (!result || result.resignations.length === 0) {
    await markChecked(db, {
      articleId: article.id,
      detectorType: DETECTOR_TYPE,
      outcome: 'discarded',
      reason: 'not_applicable',
    });
    return { inserted: false, approved: false };
  }

  // 2026-07-14 — an article can name several distinct people leaving
  // positions at once (e.g. an MÁV board reshuffle). Every entry runs the
  // FULL per-item pipeline below; DetectionCheck is still keyed (articleId,
  // detectorType) so only ONE summary row is written per article once the
  // whole array has been processed.
  let anyInserted = false;
  let anyApproved = false;
  let anyPinnedInserted = false;
  const insertedNames: string[] = [];
  let lastDiscardReason: CheckReason = 'not_applicable';
  let lastName: string | undefined;
  let lastConfidence: number | undefined;

  for (const person of result.resignations) {
    lastName = person.name || lastName;
    lastConfidence = person.confidence;

    if (!person.name || isPlaceholderName(person.name) || !person.institution) {
      lastDiscardReason = 'missing_fields';
      continue;
    }

    // 003-review: route by confidence + watchlist; discard below the floor.
    const reviewStatus = decideStatus(person.confidence, isWatchlistPerson(person.name));
    if (reviewStatus === 'discard') {
      lastDiscardReason = 'low_confidence';
      if (person.confidence >= NEAR_MISS_MIN) {
        await notifyReviewNeeded({
          type: 'near_miss',
          detectorType: DETECTOR_TYPE,
          name: person.name,
          confidence: person.confidence,
          articleUrl: article.sourceUrl ?? '',
          articleId: article.id,
        });
      }
      continue;
    }

    // Dedup by normalized name + institution across ALL statuses, so a
    // rejected detection is not re-created (FR-009, FR-011) — but a second,
    // genuinely different resignation by the same person from a DIFFERENT
    // institution is NOT blocked (l. isDuplicate() komment, 2026-08-23: Lázár
    // János Teniszszövetség-lemondása néma duplikátumnak jelölte az OGY-
    // mandátumáról szóló, teljesen más lemondását).
    if (await isDuplicate(db, { table: 'PoliticalResignation', nameColumn: 'name' }, person.name, undefined, person.institution)) {
      lastDiscardReason = 'duplicate';
      continue;
    }

    // A collective/testületi name ("MÁV igazgatósága") is redundant noise if
    // the same institution's members were already named individually — the
    // by-name dedup above can't catch this since "MÁV igazgatósága" doesn't
    // match any individual's name.
    if (isCollectiveEntityName(person.name) && await hasIndividualResignationForInstitution(db, person.institution)) {
      lastDiscardReason = 'duplicate';
      continue;
    }

    // Same-URL + same-name dedup. Scoped to THIS person (unlike the old
    // any-row-with-this-URL check) so a second/third genuinely distinct
    // person from the SAME multi-person article doesn't get wrongly blocked
    // as a duplicate of the sibling just inserted a moment ago.
    if (article.sourceUrl) {
      const sameUrlExisting = await db.execute(sql`
        SELECT 1 FROM "PoliticalResignation"
        WHERE ${article.sourceUrl} = ANY("sourceUrls") AND lower("name") = lower(${person.name})
        LIMIT 1
      `) as unknown as { length: number };
      if (sameUrlExisting.length > 0) {
        lastDiscardReason = 'duplicate';
        continue;
      }
    }

    // A public entry MUST always be traceable to a source article — never
    // publish an unsourced claim.
    if (!article.sourceUrl) {
      lastDiscardReason = 'missing_source';
      continue;
    }

    // article.publishedAt is serialized as string by Inngest JSON
    const fallbackDate = new Date(article.publishedAt as unknown as string);
    let resignationDate: Date;
    try {
      resignationDate = new Date(person.resignationDate);
      if (isNaN(resignationDate.getTime())) resignationDate = fallbackDate;
    } catch {
      resignationDate = fallbackDate;
    }

    // 2026-07-26 — a WATCH_LIST-en kívül a PERMANENT_BREAKING_NAMES lista is
    // örökre pinneli a sort (l. watchlist.ts komment).
    const pinned = isWatchlistPerson(person.name) || isPermanentBreakingPerson(person.name);

    const [insertedRow] = await db.insert(schema.politicalResignations).values({
      name: person.name.slice(0, 200),
      position: cleanPositionTitle(person.position).slice(0, 200),
      institution: person.institution.slice(0, 200),
      resignationType: coerceResignationType(person.resignationType),
      resignationDate,
      description: truncateDescriptionWords(person.description.slice(0, 1000)) || null,
      sector: coerceSector(person.sector),
      pinned,
      reviewStatus,
      sourceUrls: [article.sourceUrl],
      sourceNames: article.sourceName ? [article.sourceName] : [],
    }).returning({ id: schema.politicalResignations.id });

    anyInserted = true;
    insertedNames.push(person.name);
    if (pinned) anyPinnedInserted = true;

    if (reviewStatus === 'pending') {
      await notifyReviewNeeded({
        type: 'pending',
        detectorType: DETECTOR_TYPE,
        name: person.name,
        confidence: person.confidence,
        articleUrl: article.sourceUrl ?? '',
        articleId: article.id,
        recordId: insertedRow!.id,
      });
    } else {
      anyApproved = true;
    }
  }

  if (anyInserted) {
    // Tag the source article so it appears in /hirek under the 'Lemondás' filter.
    // Watchlist persons (pinned) and auto-approved detections are marked as
    // breaking candidates so the BreakingBanner fires without manual override.
    await db
      .update(schema.newsArticles)
      .set({
        tag: 'Lemondás',
        isBreakingCandidate: anyPinnedInserted || anyApproved,
      })
      .where(eq(schema.newsArticles.id, article.id));
  }

  await markChecked(db, {
    articleId: article.id,
    detectorType: DETECTOR_TYPE,
    outcome: anyInserted ? 'inserted' : 'discarded',
    reason: anyInserted ? undefined : lastDiscardReason,
    extractedName: (insertedNames.length > 0 ? insertedNames.join(', ') : lastName)?.slice(0, 200),
    confidence: lastConfidence,
  });

  return { inserted: anyInserted, approved: anyApproved };
}

/**
 * resignation.detect — cron every hour.
 * Scans NOT-YET-CHECKED articles from the last 7 days (006 backlog scan —
 * replaces the old fixed 2h lookback so a transient LLM outage can never
 * silently drop a candidate forever, see specs/006-detection-pipeline-reliability),
 * runs them through the switchable LLM layer to detect political
 * resignations/firings/dismissals, and auto-inserts confirmed rows into
 * PoliticalResignation. Every non-inserted candidate is recorded in
 * DetectionCheck with a specific reason — except a transient API failure,
 * which is left unrecorded so the article is retried next run.
 */
// 2026-07-22 — kiemelve, hogy a Vercel-cron bypass route Inngest nélkül is
// meg tudja hívni (l. cron-bypass.ts fejléce).
export async function runResignationDetectionCore({ step, logger }: { step: BypassStep; logger?: BypassLogger }) {
  return runArticleDetectionBatch({
    step,
    logger,
    detectorType: DETECTOR_TYPE,
    keywords: RESIGNATION_KEYWORDS,
    callLlm: detectResignationFromArticle,
    // 2026-07-24 — Jákli Gergely/Paks II eset: a rövid og:description
    // gyakran nem tartalmazza az érintett nevét (csak azt, hogy VALAKIT
    // menesztettek), és emiatt a fenti hívás minden órában újra és újra
    // ugyanúgy elhasal. "Gyanú esetén" (üres találat VAGY hiányos név/
    // intézmény) egyetlen extra híváshoz folyamodunk, a cikk teljes
    // törzsszövegével (élőben lekérve, SOSE tárolva — constitution IV).
    // Fail-open: ha a lekérés/retry nem hoz jobbat, marad az eredeti.
    isIncomplete: (result) =>
      !result || result.resignations.length === 0 ||
      result.resignations.some((p) => !p.name || isPlaceholderName(p.name) || !p.institution),
    processArticle: processResignationArticle,
    logLabel: 'resignation.detect',
  });
}

export const detectResignations = createBypassGuardedFunction(
  { id: 'detect-resignations', name: 'Detect political resignations', cron: '20 * * * *' },
  runResignationDetectionCore,
);
