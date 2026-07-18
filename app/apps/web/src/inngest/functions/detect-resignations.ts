import 'server-only';
import { eq, sql } from 'drizzle-orm';

import { detectResignationFromArticle } from '@korr/db/ai';
import {
  articleDateIso,
  type CheckReason,
  decideStatus,
  hasIndividualResignationForInstitution,
  isCollectiveEntityName,
  isDuplicate,
  isPlaceholderName,
  isTransientLlmFailure,
  isWatchlistPerson,
  loadUncheckedArticles,
  markChecked,
  NEAR_MISS_MIN,
} from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { notifyReviewNeeded } from '@/lib/notify';
import { inngest } from '../client';

const BATCH_SIZE = 20;
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
const RESIGNATION_KEYWORDS = [
  'lemond', 'kirúg', 'felment', 'levált', 'mond le', 'menesz',
  'visszahív', 'cserél', 'visszavon', 'távoz',
  // kirúgás szinonimái (2026-07-16, user által megadott teljes lista):
  'elbocsát', 'felmond', 'megválás', 'megszüntet', 'állásveszt',
  'eltanácsol', 'hivatalveszt', 'eltávolít',
];

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
export const detectResignations = inngest.createFunction(
  { id: 'detect-resignations', name: 'Detect political resignations', concurrency: 1 },
  { cron: '20 * * * *' }, // 2026-07-18: visszaállítva óránkéntire — a 2 órás ritkítás nem csökkentette a költséget (backlog-alapú, cikkmennyiség-függő, nem gyakoriság-függő; üres futás ingyenes), csak a friss detektálást lassította
  async ({ step, logger }) => {
    const db = getDb();

    const articles = await step.run('load-unchecked-articles', () =>
      loadUncheckedArticles(db, DETECTOR_TYPE),
    );

    if (articles.length === 0) return { scanned: 0, inserted: 0 };

    const candidates = articles.filter((a) => {
      const text = `${a.headline} ${a.excerpt}`.toLowerCase();
      return RESIGNATION_KEYWORDS.some((kw) => text.includes(kw));
    });

    if (candidates.length === 0) return { scanned: articles.length, inserted: 0 };

    let inserted = 0;
    let approvedInserted = 0;

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE);

      const batchResult = await step.run(`process-batch-${batchNum}`, async () => {
        let count = 0;
        let approvedCount = 0;
        for (const article of batch) {
          const llmResult = await detectResignationFromArticle(article.headline, article.excerpt, articleDateIso(article.publishedAt));

          // Transient (API/network/credit) failure — leave unrecorded so the
          // article stays eligible and is retried on the next hourly run.
          if (isTransientLlmFailure(llmResult)) continue;

          const result = llmResult.data;

          if (!result || result.resignations.length === 0) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'not_applicable',
            });
            continue;
          }

          // 2026-07-14 — an article can name several distinct people leaving
          // positions at once (e.g. an MÁV board reshuffle). Every entry runs
          // the FULL per-item pipeline below; DetectionCheck is still keyed
          // (articleId, detectorType) so only ONE summary row is written per
          // article once the whole array has been processed.
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

            // Dedup by normalized name across ALL statuses within the window, so a
            // rejected detection is not re-created (FR-009, FR-011).
            if (await isDuplicate(db, { table: 'PoliticalResignation', nameColumn: 'name' }, person.name)) {
              lastDiscardReason = 'duplicate';
              continue;
            }

            // A collective/testületi name ("MÁV igazgatósága") is redundant
            // noise if the same institution's members were already named
            // individually — the by-name dedup above can't catch this since
            // "MÁV igazgatósága" doesn't match any individual's name.
            if (isCollectiveEntityName(person.name) && await hasIndividualResignationForInstitution(db, person.institution)) {
              lastDiscardReason = 'duplicate';
              continue;
            }

            // Same-URL + same-name dedup. Scoped to THIS person (unlike the old
            // any-row-with-this-URL check) so a second/third genuinely distinct
            // person from the SAME multi-person article doesn't get wrongly
            // blocked as a duplicate of the sibling just inserted a moment ago.
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

            // A public entry MUST always be traceable to a source article —
            // never publish an unsourced claim.
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

            const pinned = isWatchlistPerson(person.name);

            const [insertedRow] = await db.insert(schema.politicalResignations).values({
              name: person.name.slice(0, 200),
              position: person.position.slice(0, 200),
              institution: person.institution.slice(0, 200),
              resignationType: coerceResignationType(person.resignationType),
              resignationDate,
              description: person.description.slice(0, 1000) || null,
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

          if (anyInserted) count++;
          if (anyApproved) approvedCount++;
        }
        return { count, approvedCount };
      });

      inserted += batchResult.count;
      approvedInserted += batchResult.approvedCount;
    }

    // Only a publicly-visible (approved) insert can change what's breaking —
    // a 'pending' row awaiting Telegram review isn't live yet.
    if (approvedInserted > 0) {
      await step.sendEvent('emit-breaking-recompute', {
        name: 'breaking.recompute',
        data: { reason: 'resignation' },
      });
    }

    logger?.info?.(
      `resignation.detect: scanned=${articles.length} candidates=${candidates.length} inserted=${inserted}`,
    );
    return { scanned: articles.length, candidates: candidates.length, inserted };
  },
);
