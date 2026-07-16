/**
 * Inngest-bypass for the criminal-complaint (feljelentés) detector — the
 * Inngest account is over its monthly quota (same root cause as the
 * Facebook-sync / YouTube-sync bypasses, see project-facebook-sync.md
 * memory). Standalone script using the SAME review/state-machine helpers
 * the eventual Inngest function (detect-criminal-complaints.ts, tasks.md
 * T007) will use, so switching over once the quota resets is a matter of
 * moving this loop into an Inngest function body, not a rewrite.
 *
 * Known simplification vs. the eventual Inngest function: no near_miss
 * digest notification (that's a nice-to-have monthly-digest feature, not
 * core value) — a low-confidence complaint is just discarded and logged.
 *
 * notify.ts/telegram.ts are 'server-only' guarded and can't be imported
 * into a plain tsx script (see apps/web/scripts/scrape-youtube-standalone.ts)
 * — sendTelegramMessage()/notifyPending() below are a minimal reimplementation.
 *
 * DRY_RUN=1: reports counts, does not call the LLM or write to the DB.
 * Usage: pnpm --filter @korr/db detect-criminal-complaints-now
 *        DRY_RUN=1 pnpm --filter @korr/db detect-criminal-complaints-now
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql as dsql } from 'drizzle-orm';
import * as schema from './schema';
import { decideStatus, findExistingComplaint, decideComplaintTransition, type ComplaintStatus } from './review';
import { isWatchlistPerson } from './watchlist';
import {
  articleDateIso,
  isPlaceholderName,
  isTransientLlmFailure,
  markChecked,
  type CandidateArticle,
  type CheckReason,
} from './detection-check';
import { detectCriminalComplaintFromArticle } from './criminal-complaint-detect';

const DRY_RUN = process.env.DRY_RUN === '1';
const DETECTOR_TYPE = 'criminal_complaint' as const;
// 14 days, not the usual 7 (BACKLOG_DAYS) — this is a brand-new detector
// type, so on its first run every article in the window is "unchecked"
// regardless of when it was scraped; a wider window catches the backlog
// that built up before this feature existed.
const BACKLOG_DAYS = 14;

const DB_URL = process.env.PROD_DATABASE_URL ?? process.env.DATABASE_URL;
if (!DB_URL) throw new Error('PROD_DATABASE_URL / DATABASE_URL not set');
if (!DRY_RUN && !process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');

const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

const KEYWORDS = ['feljelent'];

/**
 * loadUncheckedArticles() (detection-check.ts) caps at LIMIT 200, most-recent
 * first — fine for an hourly cron catching a handful of new articles, but a
 * trap for a one-time bulk backfill: it never marks a keyword-negative
 * article as checked, so on every re-run the SAME ~195 unchecked-but-
 * irrelevant recent articles keep re-filling the top 200 slots, and
 * genuinely older unprocessed candidates (further back in the 14-day
 * window) are never reached (2026-07-16, confirmed live: rounds 2-4 of this
 * script kept re-scanning the same slice and found 0 new candidates, while
 * a manual full-text scan had found real matches from 07-03–07-10). This
 * loads the WHOLE window in one query instead, and filters out
 * already-DetectionCheck'd articles client-side — same "don't reprocess"
 * guarantee, no pagination trap.
 */
async function loadAllArticlesInWindow(backlogDays: number): Promise<CandidateArticle[]> {
  return (await db.execute(dsql`
    SELECT a.id, a.headline, a.excerpt, a."publishedAt", a."sourceUrl", s.name AS "sourceName"
    FROM "NewsArticle" a
    LEFT JOIN "Source" s ON s.id = a."sourceId"
    WHERE a."publishedAt" >= now() - make_interval(days => ${backlogDays})
      AND NOT EXISTS (
        SELECT 1 FROM "DetectionCheck" dc
        WHERE dc."articleId" = a.id AND dc."detectorType" = ${DETECTOR_TYPE}
      )
    ORDER BY a."publishedAt" DESC
    LIMIT 5000
  `)) as unknown as CandidateArticle[];
}

// ─── Minimal Telegram sender (notify.ts/telegram.ts are 'server-only') ──────

type InlineKeyboardMarkup = { inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> };

async function sendTelegramMessage(text: string, replyMarkup?: InlineKeyboardMarkup): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
    });
  } catch {
    // never let notification delivery break the run
  }
}

async function notifyPending(opts: { targetName: string; filerName: string; confidence: number; articleUrl: string; recordId: string }): Promise<void> {
  await sendTelegramMessage(
    `🔔 ÁTNÉZENDŐ — Feljelentés\n${opts.targetName}\nFeljelentő: ${opts.filerName}\nBizonyosság: ${(opts.confidence * 100).toFixed(0)}%`,
    {
      inline_keyboard: [
        [{ text: '📄 Cikk megnyitása', url: opts.articleUrl }],
        [{ text: '✅ Jóváhagyom', callback_data: `a:f:${opts.recordId}` }, { text: '❌ Elutasítom', callback_data: `r:f:${opts.recordId}` }],
      ],
    },
  );
}

async function main() {
  console.log(`target: ${new URL(DB_URL!).host}${DRY_RUN ? ' (DRY_RUN)' : ''}`);

  const articles = await loadAllArticlesInWindow(BACKLOG_DAYS);
  const candidates = articles.filter((a) => {
    const text = `${a.headline} ${a.excerpt}`.toLowerCase();
    return KEYWORDS.some((kw) => text.includes(kw));
  });

  console.log(`📚 Ellenőrizetlen cikk (${BACKLOG_DAYS} nap): ${articles.length}, feljelentés-gyanús: ${candidates.length}\n`);

  if (DRY_RUN) {
    for (const a of candidates) console.log(`  · [${a.publishedAt.slice(0, 10)}] ${a.headline.slice(0, 90)}`);
    console.log(`\n(DRY_RUN — nincs LLM-hívás, nincs DB-írás)`);
    await conn.end();
    return;
  }

  let inserted = 0, updated = 0, pending = 0, discarded = 0;

  for (const article of candidates) {
    process.stdout.write(`🤖 „${article.headline.slice(0, 60)}…" → `);
    const todayIso = articleDateIso(article.publishedAt);
    const publishedAtDate = new Date(article.publishedAt);

    const llmResult = await detectCriminalComplaintFromArticle(article.headline, article.excerpt, todayIso);
    if (isTransientLlmFailure(llmResult)) {
      console.log('átmeneti LLM-hiba, kihagyva (a következő futás újrapróbálja)');
      continue;
    }

    const result = llmResult.data;
    if (!result || result.complaints.length === 0) {
      await markChecked(db, { articleId: article.id, detectorType: DETECTOR_TYPE, outcome: 'discarded', reason: 'not_applicable' });
      console.log('nem releváns feljelentés');
      continue;
    }

    let articleHadInsertOrUpdate = false;
    let lastReason: CheckReason = 'not_applicable';

    for (const complaint of result.complaints) {
      if (!complaint.targetName || isPlaceholderName(complaint.targetName) || !complaint.filerName) {
        console.log(`\n  ↳ hiányzó adat, kihagyva`);
        lastReason = 'missing_fields';
        discarded++;
        continue;
      }

      const isWatchlist = isWatchlistPerson(complaint.filerName) || isWatchlistPerson(complaint.targetName);
      const reviewStatus = decideStatus(complaint.confidence, isWatchlist);
      if (reviewStatus === 'discard') {
        console.log(`\n  ↳ ${complaint.targetName}: alacsony bizonyosság (${complaint.confidence.toFixed(2)})`);
        lastReason = 'low_confidence';
        discarded++;
        continue;
      }

      if (!article.sourceUrl) {
        console.log(`\n  ↳ ${complaint.targetName}: nincs forrás-URL, kihagyva`);
        lastReason = 'missing_source';
        discarded++;
        continue;
      }

      const status = complaint.status as ComplaintStatus;
      const existing = await findExistingComplaint(db, complaint.targetName);

      if (existing) {
        const transition = decideComplaintTransition(existing.status, status);
        if (transition === 'stale') {
          console.log(`\n  ↳ ${complaint.targetName}: nincs új fejlemény (${existing.status} → ${status})`);
          lastReason = 'stale_status';
          discarded++;
          continue;
        }
        await db.update(schema.criminalComplaints).set({
          status,
          eventDate: publishedAtDate,
          sourceUrls: dsql`array_append("sourceUrls", ${article.sourceUrl})`,
          sourceNames: dsql`array_append("sourceNames", ${article.sourceName ?? ''})`,
          sourceHeadlines: dsql`array_append("sourceHeadlines", ${article.headline.slice(0, 500)})`,
          sourceDates: dsql`array_append("sourceDates", ${todayIso})`,
          updatedAt: new Date(),
        }).where(eq(schema.criminalComplaints.id, existing.id));

        console.log(`\n  ↳ ✅ frissítve: ${complaint.targetName} (${existing.status} → ${status})`);
        updated++;
        articleHadInsertOrUpdate = true;

        if (reviewStatus === 'pending') {
          pending++;
          await notifyPending({ targetName: complaint.targetName, filerName: complaint.filerName, confidence: complaint.confidence, articleUrl: article.sourceUrl, recordId: existing.id });
        }
        continue;
      }

      const [row] = await db.insert(schema.criminalComplaints).values({
        targetName: complaint.targetName.slice(0, 200),
        filerName: complaint.filerName.slice(0, 200),
        description: complaint.description.slice(0, 1000) || null,
        status,
        eventDate: publishedAtDate,
        filedAt: status === 'feljelentés' ? publishedAtDate : null,
        sourceUrls: [article.sourceUrl],
        sourceNames: article.sourceName ? [article.sourceName] : [],
        sourceHeadlines: [article.headline.slice(0, 500)],
        sourceDates: [todayIso],
        reviewStatus: reviewStatus === 'approved' ? 'approved' : 'pending',
      }).returning({ id: schema.criminalComplaints.id });

      console.log(`\n  ↳ ✅ beírva: ${complaint.targetName} (${status}, ${complaint.confidence.toFixed(2)})`);
      inserted++;
      articleHadInsertOrUpdate = true;

      if (reviewStatus === 'pending') {
        pending++;
        await notifyPending({ targetName: complaint.targetName, filerName: complaint.filerName, confidence: complaint.confidence, articleUrl: article.sourceUrl, recordId: row!.id });
      }
    }

    if (!articleHadInsertOrUpdate) console.log('(nincs felvehető feljelentés ebben a cikkben)');

    await markChecked(db, {
      articleId: article.id,
      detectorType: DETECTOR_TYPE,
      outcome: articleHadInsertOrUpdate ? 'inserted' : 'discarded',
      reason: articleHadInsertOrUpdate ? undefined : lastReason,
    });

    if (articleHadInsertOrUpdate) {
      await db.update(schema.newsArticles).set({ tag: 'Feljelentés' }).where(eq(schema.newsArticles.id, article.id));
    }
  }

  console.log(`\n✅ Kész: ${inserted} új, ${updated} frissítve, ${pending} jóváhagyásra vár (Telegram), ${discarded} kiszűrve`);
  await conn.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
