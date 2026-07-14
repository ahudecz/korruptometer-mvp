import 'server-only';
import { eq, sql } from 'drizzle-orm';

import { detectVerdictFromArticle } from '@korr/db/ai-verdicts';
import {
  articleDateIso,
  decideStatus,
  findExistingVerdict,
  isPlaceholderName,
  isTransientLlmFailure,
  isWatchlistPerson,
  loadUncheckedArticles,
  markChecked,
  NEAR_MISS_MIN,
} from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { notifyReviewNeeded } from '@/lib/notify';
import { notifyAutoPublished } from '@/lib/notify-auto-publish';
import { inngest } from '../client';

const BATCH_SIZE = 20;
const DETECTOR_TYPE = 'court_verdict' as const;

const VERDICT_KEYWORDS = [
  'előzetes letartóztatás', 'letartóztatt', 'előzetesbe', 'előzetesben',
  'vádemelés', 'vádat emel', 'vádlott', 'bírósági ítélet',
  'börtönbüntetés', 'szabadságvesztés', 'elítélt', 'elítélték',
  'jogerős', 'elsőfokú ítélet', 'bíróság elé', 'bíróság ítélt',
  'fogdába', 'fogvatartott', 'kihallgat', 'gyanúsított',
  // Gyakori előzmény-fázisú megfogalmazás letartóztatás előtt/helyett —
  // hiányzott, pedig a relevance.ts BREAKING_TRIGGERS listája már ismeri.
  'őrizetbe', 'házkutatás', 'razzia', 'körözik', 'elfogatóparancs',
  // Szabadon engedés / eljárás-vég — enélkül egy korábban letartóztatott
  // személy kiengedése sosem jutott el az LLM-ig (2026-07-08, Szakács
  // István-eset: a "Kiengedték Szakács Istvánt" jellegű cikkek egyike sem
  // tartalmazott letartóztatás-szót, csak ezeket).
  'szabadlábra', 'kiengedt', 'elengedt', 'szabadon engedt', 'szabadult',
  'megszüntették az eljárást', 'ejtette a vádat', 'felmentették',
  // Entitás-jelző: egy Megafon-hoz köthető személyt érintő cikk gyakran nem
  // tartalmaz önmagában letartóztatás-szót a címben/kivonatban — a "megafon"
  // szó önmagában is elég ok az LLM-ellenőrzésre.
  'megafon',
];

/**
 * verdict.detect — cron every hour (offset 15 min).
 * Backlog scan (006) over NOT-YET-CHECKED articles from the last 7 days —
 * see specs/006-detection-pipeline-reliability. Auto-inserts confirmed rows
 * into CourtVerdict; every non-inserted candidate is recorded in
 * DetectionCheck with a reason, except a transient LLM failure, which is
 * left unrecorded so the article is retried next run.
 */
export const detectVerdicts = inngest.createFunction(
  { id: 'detect-verdicts', name: 'Detect court verdicts and pretrial detentions', concurrency: 1 },
  { cron: '30 * * * *' },
  async ({ step, logger }) => {
    const db = getDb();
    // Csak a "mikor rögzítettük ezt a forrásidézetet" (sourceDates) mezőhöz —
    // ez tényleg a feldolgozás napja, NEM a cikk dátuma. Az LLM-hívásoknál
    // articleDateIso(article.publishedAt)-ot használunk, l. lentebb.
    const todayIso = new Date().toISOString().slice(0, 10);

    const articles = await step.run('load-unchecked-articles', () =>
      loadUncheckedArticles(db, DETECTOR_TYPE),
    );

    if (articles.length === 0) return { scanned: 0, inserted: 0 };

    const candidates = articles.filter((a) => {
      const text = `${a.headline} ${a.excerpt}`.toLowerCase();
      return VERDICT_KEYWORDS.some((kw) => text.includes(kw));
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
          const llmResult = await detectVerdictFromArticle(article.headline, article.excerpt, articleDateIso(article.publishedAt));

          if (isTransientLlmFailure(llmResult)) continue;

          const result = llmResult.data;

          if (!result || !result.isVerdict) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'not_applicable',
            });
            continue;
          }

          if (!result.personName || isPlaceholderName(result.personName) || !result.verdictType) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'missing_fields',
              extractedName: result.personName || undefined,
              confidence: result.confidence,
            });
            continue;
          }

          // 003-review: route by confidence + watchlist; discard below the floor.
          const reviewStatus = decideStatus(result.confidence, isWatchlistPerson(result.personName));
          if (reviewStatus === 'discard') {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'low_confidence',
              extractedName: result.personName,
              confidence: result.confidence,
            });
            if (result.confidence >= NEAR_MISS_MIN) {
              await notifyReviewNeeded({
                type: 'near_miss',
                detectorType: DETECTOR_TYPE,
                name: result.personName,
                confidence: result.confidence,
                articleUrl: article.sourceUrl ?? '',
                articleId: article.id,
              });
            }
            continue;
          }

          // CourtVerdict rows track a case's real lifecycle (letartóztatás →
          // szabadlábra helyezve → jogerős ítélet, etc.), unlike a
          // resignation or media closure, which are one-shot events. So a
          // matching existing row is only a TRUE duplicate if it already has
          // the SAME verdictType — a different verdictType means a real
          // status change that must UPDATE the existing row, not silently
          // discard the development the way isDuplicate() used to.
          const existingVerdict = await findExistingVerdict(db, result.personName);
          if (existingVerdict && existingVerdict.verdictType === result.verdictType) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'duplicate',
              extractedName: result.personName,
              confidence: result.confidence,
            });
            continue;
          }

          // A public entry MUST always be traceable to a source article —
          // never publish/update from an unsourced claim.
          if (!article.sourceUrl) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'missing_source',
              extractedName: result.personName,
              confidence: result.confidence,
            });
            continue;
          }

          const fallbackDate = new Date(article.publishedAt as unknown as string);
          let verdictDate: Date;
          try {
            verdictDate = new Date(result.verdictDate);
            if (isNaN(verdictDate.getTime())) verdictDate = fallbackDate;
          } catch {
            verdictDate = fallbackDate;
          }

          let recordId: string;
          if (existingVerdict) {
            await db.update(schema.courtVerdicts).set({
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
              sourceDates: sql`array_append("sourceDates", ${todayIso})`,
              updatedAt: new Date(),
            }).where(eq(schema.courtVerdicts.id, existingVerdict.id));
            recordId = existingVerdict.id;
          } else {
            const [insertedRow] = await db.insert(schema.courtVerdicts).values({
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
              sourceDates: [todayIso],
              reviewStatus,
            }).returning({ id: schema.courtVerdicts.id });
            recordId = insertedRow!.id;
          }

          // Egy detektált ítélet/előzetes börtönhöz kötődő esemény → breaking-jelölt,
          // így megjelenik a breaking csíkban és az érintett doboz/végoldal breaking blokkjában.
          await db
            .update(schema.newsArticles)
            .set({ tag: 'Ítélet', isBreakingCandidate: true })
            .where(eq(schema.newsArticles.id, article.id));

          await markChecked(db, {
            articleId: article.id,
            detectorType: DETECTOR_TYPE,
            outcome: 'inserted',
            extractedName: result.personName,
            confidence: result.confidence,
          });

          if (reviewStatus === 'pending') {
            await notifyReviewNeeded({
              type: 'pending',
              detectorType: DETECTOR_TYPE,
              name: result.personName,
              confidence: result.confidence,
              articleUrl: article.sourceUrl ?? '',
              articleId: article.id,
              recordId,
            });
          } else {
            approvedCount++;
          }

          if (reviewStatus !== 'pending' && !existingVerdict) {
            // 2026-07-14 — auto-published straight to 'approved' with zero
            // human review. Only for a fresh INSERT: reverting an UPDATE to
            // an ongoing case would need to roll back to the prior state,
            // not delete the whole row, which is out of scope for now.
            await notifyAutoPublished({
              target: 'court_verdict',
              recordId,
              name: result.personName,
              detail: `${result.verdictType}${result.sentenceLabel ? ` — ${result.sentenceLabel}` : ''}`,
              articleUrl: article.sourceUrl ?? '',
            });
          }

          count++;
        }
        return { count, approvedCount };
      });

      inserted += batchResult.count;
      approvedInserted += batchResult.approvedCount;
    }

    if (approvedInserted > 0) {
      await step.sendEvent('emit-breaking-recompute', {
        name: 'breaking.recompute',
        data: { reason: 'court_verdict' },
      });
    }

    logger?.info?.(`verdict.detect: scanned=${articles.length} candidates=${candidates.length} inserted=${inserted}`);
    return { scanned: articles.length, candidates: candidates.length, inserted };
  },
);
