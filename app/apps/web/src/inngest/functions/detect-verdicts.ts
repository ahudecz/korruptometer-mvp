import 'server-only';
import { eq, sql } from 'drizzle-orm';

import { detectVerdictFromArticle, type VerdictExtraction } from '@korr/db/ai-verdicts';
import {
  decideStatus,
  findExistingVerdict,
  isPlaceholderName,
  isWatchlistPerson,
  markChecked,
  NEAR_MISS_MIN,
  type CandidateArticle,
} from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { notifyReviewNeeded } from '@/lib/notify';
import { notifyAutoPublished } from '@/lib/notify-auto-publish';
import type { BypassStep, BypassLogger } from '@/lib/cron-bypass';
import { createBypassGuardedFunction, runArticleDetectionBatch, type ArticleProcessResult } from '../lib/detector-runner';

const DETECTOR_TYPE = 'court_verdict' as const;

export const VERDICT_KEYWORDS = [
  'előzetes letartóztatás', 'letartóztatt', 'előzetesbe', 'előzetesben',
  'vádemelés', 'vádat emel', 'vádlott', 'bírósági ítélet',
  'börtönbüntetés', 'szabadságvesztés', 'elítélt', 'elítélték',
  'jogerős', 'elsőfokú ítélet', 'bíróság elé', 'bíróság ítélt',
  'fogdába', 'fogvatartott', 'kihallgat', 'gyanúsított',
  // Gyakori előzmény-fázisú megfogalmazás letartóztatás előtt/helyett —
  // hiányzott, pedig a relevance.ts BREAKING_TRIGGERS listája már ismeri.
  // 'razzia' helyett 'razzi' stem: a magyar tárgyrag ("razziát") az 'a'
  // végződést 'á'-ra nyújtja, így a teljes szó szerinti "razzia" nem
  // egyezett volna a leggyakoribb, ragozott alakkal (a
  // detect-verdicts.test.ts írása közben derült ki).
  'őrizetbe', 'házkutatás', 'razzi', 'körözik', 'elfogatóparancs',
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

async function processVerdictArticle(
  article: CandidateArticle,
  result: VerdictExtraction | null,
): Promise<ArticleProcessResult> {
  const db = getDb();
  // Csak a "mikor rögzítettük ezt a forrásidézetet" (sourceDates) mezőhöz —
  // ez tényleg a feldolgozás napja, NEM a cikk dátuma. Az LLM-hívásoknál
  // articleDateIso(article.publishedAt)-ot használjuk a hívásnál, l. a
  // detector-runner.ts közös batch-hívását.
  const todayIso = new Date().toISOString().slice(0, 10);

  if (!result || !result.isVerdict) {
    await markChecked(db, {
      articleId: article.id,
      detectorType: DETECTOR_TYPE,
      outcome: 'discarded',
      reason: 'not_applicable',
    });
    return { inserted: false, approved: false };
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
    return { inserted: false, approved: false };
  }

  // 003-review: route by confidence + watchlist; discard below the floor.
  let reviewStatus = decideStatus(result.confidence, isWatchlistPerson(result.personName));

  // 2026-07-25 — user kérés: "ítélet született" státuszba (tényleges első-
  // vagy jogerős fokú ítélet, nem előzetes/vádemelés/kiengedés) SENKI ne
  // kerülhessen automatikusan, csak Telegram-jóváhagyással, a forráscikk
  // linkjével. Eddig magas bizonyosságnál ez a legkomolyabb státusz is
  // simán, emberi jóváhagyás NÉLKÜL ment élesbe (csak utólagos,
  // "visszavonható" értesítést kapott) — ez a legmagasabb téttel járó
  // állapotváltás, itt a legindokoltabb az előzetes emberi megerősítés, nem
  // az utólagos visszavonási esély.
  if (reviewStatus === 'approved' && (result.verdictType === 'elsőfokú' || result.verdictType === 'jogerős')) {
    reviewStatus = 'pending';
  }

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
    return { inserted: false, approved: false };
  }

  // CourtVerdict rows track a case's real lifecycle (letartóztatás →
  // szabadlábra helyezve → jogerős ítélet, etc.), unlike a resignation or
  // media closure, which are one-shot events. So a matching existing row is
  // only a TRUE duplicate if it already has the SAME verdictType — a
  // different verdictType means a real status change that must UPDATE the
  // existing row, not silently discard the development the way
  // isDuplicate() used to.
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
    return { inserted: false, approved: false };
  }

  // A public entry MUST always be traceable to a source article — never
  // publish/update from an unsourced claim.
  if (!article.sourceUrl) {
    await markChecked(db, {
      articleId: article.id,
      detectorType: DETECTOR_TYPE,
      outcome: 'discarded',
      reason: 'missing_source',
      extractedName: result.personName,
      confidence: result.confidence,
    });
    return { inserted: false, approved: false };
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
      // 2026-07-24 — defenzív: a séma most már ['number','null']-t enged
      // (l. court-verdict-detect.ts), de a "??"-fallback nem fogja el, ha
      // valamiért mégis egy nem-szám string jönne át (pl. egy régi
      // cache-elt hívásból) — a Postgres integer oszlop egyébként
      // ugyanazzal a hibával halna el.
      sentenceMonths: typeof result.sentenceMonths === 'number' ? result.sentenceMonths : null,
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
      sentenceMonths: typeof result.sentenceMonths === 'number' ? result.sentenceMonths : null,
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
  }

  if (reviewStatus !== 'pending' && !existingVerdict) {
    // 2026-07-14 — auto-published straight to 'approved' with zero human
    // review. Only for a fresh INSERT: reverting an UPDATE to an ongoing
    // case would need to roll back to the prior state, not delete the
    // whole row, which is out of scope for now.
    await notifyAutoPublished({
      target: 'court_verdict',
      recordId,
      name: result.personName,
      detail: `${result.verdictType}${result.sentenceLabel ? ` — ${result.sentenceLabel}` : ''}`,
      articleUrl: article.sourceUrl ?? '',
    });
  }

  return { inserted: true, approved: reviewStatus !== 'pending' };
}

/**
 * verdict.detect — cron every hour (offset 15 min).
 * Backlog scan (006) over NOT-YET-CHECKED articles from the last 7 days —
 * see specs/006-detection-pipeline-reliability. Auto-inserts confirmed rows
 * into CourtVerdict; every non-inserted candidate is recorded in
 * DetectionCheck with a reason, except a transient LLM failure, which is
 * left unrecorded so the article is retried next run.
 */
// 2026-07-22 — kiemelve, hogy a Vercel-cron bypass route Inngest nélkül is
// meg tudja hívni (l. cron-bypass.ts fejléce).
export async function runVerdictDetectionCore({ step, logger }: { step: BypassStep; logger?: BypassLogger }) {
  return runArticleDetectionBatch({
    step,
    logger,
    detectorType: DETECTOR_TYPE,
    keywords: VERDICT_KEYWORDS,
    callLlm: detectVerdictFromArticle,
    // 2026-07-24 — l. detect-resignations.ts azonos mintája.
    isIncomplete: (result) =>
      !result || !result.isVerdict || !result.personName || isPlaceholderName(result.personName) || !result.verdictType,
    processArticle: processVerdictArticle,
    logLabel: 'verdict.detect',
  });
}

export const detectVerdicts = createBypassGuardedFunction(
  { id: 'detect-verdicts', name: 'Detect court verdicts and pretrial detentions', cron: '30 * * * *' },
  runVerdictDetectionCore,
);
