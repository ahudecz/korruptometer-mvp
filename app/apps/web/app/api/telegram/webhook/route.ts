import 'server-only';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, ilike, inArray, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { answerCallbackQuery, editMessageReplyMarkup, sendTelegramMessage, type InlineKeyboardMarkup } from '@/lib/telegram';
import {
  applyWatchlistRemoval,
  checkWatchlistRemovalForArticle,
  DETECTOR_PROCESSORS,
  findWatchlistCandidates,
  type ArticleForReprocess,
} from '@/lib/telegram-review-actions';
import type { DetectorType } from '@korr/db';
import { canonicalUrl, dedupHash, fetchPrimaryArticle, getAdapter, routeOutletByUrl } from '@korr/scrapers';
import { WATCH_LIST, type WatchPerson } from '@app/_home/watchlist-config';

// Legvégső fallback-név (csak akkor, ha a beküldött szöveg URL-nek NÉZETT ki
// a regexben, de a new URL() mégis elhasal rajta — gyakorlatilag sosem fordul
// elő). A tényleges attribúció findOrCreateAdHocSource()-ból jön: hostname +
// og:site_name alapján dedikált (enabled:false) Source sort kap minden nem
// konfigurált outlet is, l. migráció 0039 (ami csak ennek a végső esetnek
// a statikus párja volt, mielőtt a dinamikus per-domain megoldás megszületett).
const TELEGRAM_TIP_SOURCE_SLUG = 'telegram-bejelentes';

// 008-telegram-review-bot — one-letter callback_data codes, keeps
// "{action}:{code}:{id}" well under Telegram's 64-byte callback_data limit.
const DETECTOR_BY_CODE: Record<string, DetectorType> = {
  r: 'resignation',
  m: 'media_closure',
  c: 'court_verdict',
  x: 'asset_recovery',
  f: 'criminal_complaint',
};

// 2026-07-14 — codes for the "auto-published, revertible" notification
// (notify-auto-publish.ts). Deliberately excludes 'resignation': watchlist
// people now always go through the pending-review flow (decideStatus fix),
// and non-watchlist resignations are exactly the noise the user doesn't
// want a Telegram ping for (e.g. a small-town spa director resigning).
const AUTO_PUBLISH_CODE_TABLE: Record<string, 'court_verdict' | 'asset_recovery' | 'watchlist_removal'> = {
  c: 'court_verdict',
  x: 'asset_recovery',
  w: 'watchlist_removal',
};

const DETECTOR_LABELS_HU: Record<DetectorType, string> = {
  resignation: 'Lemondás/kirúgás',
  media_closure: 'Médium megszűnés',
  court_verdict: 'Bírósági ítélet',
  asset_recovery: 'Vagyonvisszaszerzés',
  criminal_complaint: 'Feljelentés',
};

// 2026-07-13 — "📰 Csak hírbe" gomb: ugyanazok a rövid címkék, amiket a
// sikeres strukturált beszúrás is rátenne a cikkre (l. detect-*.ts), hogy
// a /hirek szűrője/kiemelése konzisztens legyen attól függetlenül, hogy
// született-e formális CourtVerdict/PoliticalResignation/stb. sor.
const NEWS_ONLY_TAG: Record<DetectorType, string> = {
  resignation: 'Lemondás',
  media_closure: 'Megszűnés',
  court_verdict: 'Ítélet',
  asset_recovery: 'Vagyonvisszaszerzés',
  criminal_complaint: 'Feljelentés',
};

// ── 2026-07-14 — "Név - kategória - visszavonás" kézi visszavonó parancs.
// A user gépközel nélkül is elé tudja állítani a törlést, ha bármi miatt
// (pl. deploy-lag, gate-hiba) nem jött normál review/auto-publish üzenet.
// Sosem töröl szöveg alapján közvetlenül — mindig egy jelölt-listát küld
// vissza gombokkal ("d:{kód}:{id}"), a tényleges törlés csak gombnyomásra
// történik. Ugyanazt a "töröl, nem reviewStatus='rejected'" logikát
// használja, mint a meglévő Visszavonás gombok (l. setPendingStatus komment).
const REVOKE_TRIGGER = /visszavon/i;

const CATEGORY_HINTS: Array<{ keywords: string[]; code: string }> = [
  { keywords: ['lemond', 'kirúg', 'kirug', 'felment'], code: 'r' },
  { keywords: ['megszűn', 'megszun', 'médium', 'medium'], code: 'm' },
  { keywords: ['ítélet', 'itelet', 'bírósági', 'birosagi', 'verdikt'], code: 'c' },
  { keywords: ['vagyon'], code: 'x' },
  { keywords: ['watchlist', 'kiemelt', 'eltávolít', 'eltavolit'], code: 'w' },
  { keywords: ['feljelent'], code: 'f' },
];

const DELETE_CODE_TABLE: Record<string, DetectorType | 'watchlist_removal'> = {
  r: 'resignation',
  m: 'media_closure',
  c: 'court_verdict',
  x: 'asset_recovery',
  w: 'watchlist_removal',
  f: 'criminal_complaint',
};

function matchCategoryHint(text: string): string | null {
  const t = text.toLowerCase();
  for (const h of CATEGORY_HINTS) {
    if (h.keywords.some((k) => t.includes(k))) return h.code;
  }
  return null;
}

function parseRevokeCommand(text: string): { nameQuery: string; categoryCode: string | null } | null {
  if (!REVOKE_TRIGGER.test(text)) return null;
  const parts = text.split(/[-–—]/).map((p) => p.trim()).filter(Boolean);
  const withoutTrigger = parts.filter((p) => !REVOKE_TRIGGER.test(p));
  const nameQuery = withoutTrigger[0];
  if (!nameQuery) return null;
  const categoryCode = matchCategoryHint(withoutTrigger.slice(1).join(' '));
  return { nameQuery, categoryCode };
}

function fmtDateShort(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('hu-HU');
}

type RevokeCandidate = { code: string; id: string; label: string };

async function searchResignations(q: string): Promise<RevokeCandidate[]> {
  const rows = await getDb()
    .select({ id: schema.politicalResignations.id, name: schema.politicalResignations.name, institution: schema.politicalResignations.institution, resignationDate: schema.politicalResignations.resignationDate })
    .from(schema.politicalResignations)
    .where(ilike(schema.politicalResignations.name, `%${q}%`))
    .orderBy(desc(schema.politicalResignations.createdAt))
    .limit(5);
  return rows.map((r) => ({ code: 'r', id: r.id, label: `${r.name} — ${r.institution} (${fmtDateShort(r.resignationDate)})` }));
}

async function searchMediaClosures(q: string): Promise<RevokeCandidate[]> {
  const rows = await getDb()
    .select({ id: schema.mediaClosures.id, name: schema.mediaClosures.name, eventDate: schema.mediaClosures.eventDate })
    .from(schema.mediaClosures)
    .where(ilike(schema.mediaClosures.name, `%${q}%`))
    .orderBy(desc(schema.mediaClosures.createdAt))
    .limit(5);
  return rows.map((r) => ({ code: 'm', id: r.id, label: `${r.name} (${fmtDateShort(r.eventDate)})` }));
}

async function searchCourtVerdicts(q: string): Promise<RevokeCandidate[]> {
  const rows = await getDb()
    .select({ id: schema.courtVerdicts.id, personName: schema.courtVerdicts.personName, verdictType: schema.courtVerdicts.verdictType, verdictDate: schema.courtVerdicts.verdictDate })
    .from(schema.courtVerdicts)
    .where(ilike(schema.courtVerdicts.personName, `%${q}%`))
    .orderBy(desc(schema.courtVerdicts.createdAt))
    .limit(5);
  return rows.map((r) => ({ code: 'c', id: r.id, label: `${r.personName} — ${r.verdictType} (${fmtDateShort(r.verdictDate)})` }));
}

async function searchAssetRecoveries(q: string): Promise<RevokeCandidate[]> {
  const rows = await getDb()
    .select({ id: schema.assetRecoveries.id, caseLabel: schema.assetRecoveries.caseLabel, recoveredAt: schema.assetRecoveries.recoveredAt })
    .from(schema.assetRecoveries)
    .where(ilike(schema.assetRecoveries.caseLabel, `%${q}%`))
    .orderBy(desc(schema.assetRecoveries.createdAt))
    .limit(5);
  return rows.map((r) => ({ code: 'x', id: r.id, label: `${r.caseLabel} (${fmtDateShort(r.recoveredAt)})` }));
}

async function searchCriminalComplaints(q: string): Promise<RevokeCandidate[]> {
  const rows = await getDb()
    .select({ id: schema.criminalComplaints.id, targetName: schema.criminalComplaints.targetName, status: schema.criminalComplaints.status, eventDate: schema.criminalComplaints.eventDate })
    .from(schema.criminalComplaints)
    .where(ilike(schema.criminalComplaints.targetName, `%${q}%`))
    .orderBy(desc(schema.criminalComplaints.createdAt))
    .limit(5);
  return rows.map((r) => ({ code: 'f', id: r.id, label: `${r.targetName} — ${r.status} (${fmtDateShort(r.eventDate)})` }));
}

async function searchWatchlistRemovals(q: string): Promise<RevokeCandidate[]> {
  const matchedPersons = WATCH_LIST.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  if (matchedPersons.length === 0) return [];
  const rows = await getDb()
    .select({ id: schema.watchlistRemovals.id, personId: schema.watchlistRemovals.personId, removalType: schema.watchlistRemovals.removalType, sourceDateLabel: schema.watchlistRemovals.sourceDateLabel })
    .from(schema.watchlistRemovals)
    .where(inArray(schema.watchlistRemovals.personId, matchedPersons.map((p) => p.id)));
  return rows.map((r) => {
    const person = matchedPersons.find((p) => p.id === r.personId);
    return { code: 'w', id: r.id, label: `${person?.name ?? r.personId} — ${r.removalType} (${r.sourceDateLabel ?? '?'})` };
  });
}

async function searchRevokeCandidates(nameQuery: string, categoryCode: string | null): Promise<RevokeCandidate[]> {
  const searchers: Record<string, () => Promise<RevokeCandidate[]>> = {
    r: () => searchResignations(nameQuery),
    m: () => searchMediaClosures(nameQuery),
    c: () => searchCourtVerdicts(nameQuery),
    x: () => searchAssetRecoveries(nameQuery),
    w: () => searchWatchlistRemovals(nameQuery),
    f: () => searchCriminalComplaints(nameQuery),
  };
  if (categoryCode && searchers[categoryCode]) return searchers[categoryCode]();
  const all = await Promise.all(Object.values(searchers).map((fn) => fn()));
  return all.flat().slice(0, 8);
}

async function deleteByCode(target: DetectorType | 'watchlist_removal', id: string): Promise<void> {
  const db = getDb();
  if (target === 'resignation') await db.delete(schema.politicalResignations).where(eq(schema.politicalResignations.id, id));
  else if (target === 'media_closure') await db.delete(schema.mediaClosures).where(eq(schema.mediaClosures.id, id));
  else if (target === 'court_verdict') await db.delete(schema.courtVerdicts).where(eq(schema.courtVerdicts.id, id));
  else if (target === 'asset_recovery') await db.delete(schema.assetRecoveries).where(eq(schema.assetRecoveries.id, id));
  else if (target === 'criminal_complaint') await db.delete(schema.criminalComplaints).where(eq(schema.criminalComplaints.id, id));
  else await db.delete(schema.watchlistRemovals).where(eq(schema.watchlistRemovals.id, id));
}

type TelegramUpdate = {
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number; text?: string };
  };
  message?: {
    chat: { id: number };
    text?: string;
  };
};

// Fordított irányú bejelentés (user küld be egy URL-t Telegramon) — 5 gomb,
// ugyanazokkal a callback_data kódokkal, mint a normál review-üzenetek
// ("a:{code}:{id}" = jóváhagyás/near-miss-force-insert útvonal, "n:g:{id}"
// = "Csak hír", generikus címkével). Nincs szükség új callback-ághoz: a
// meglévő POST-kezelő az 'a' útvonalon a findPendingRecord() üresen tér
// vissza (ez egy vadonatúj cikk, nincs hozzá PoliticalResignation/stb. sor),
// így a near_miss-approve ágra esik, ami újra lefuttatja a detektort
// bypassConfidenceGate=true-val — a rossz kategória-választást maga az LLM
// szűri ki (isResignation/isClosure/stb. false esetén discarded).
const TIP_CATEGORY_BUTTONS: Array<{ label: string; callbackData: (id: string) => string }> = [
  { label: '🚪 Lemondás/kirúgás', callbackData: (id) => `a:r:${id}` },
  { label: '🏛️ Tisztségviselő-eltávolítás', callbackData: (id) => `a:w:${id}` },
  { label: '📴 Megszűnés', callbackData: (id) => `a:m:${id}` },
  { label: '⚖️ Bírósági ítélet', callbackData: (id) => `a:c:${id}` },
  { label: '💰 Vagyonvisszaszerzés', callbackData: (id) => `a:x:${id}` },
  { label: '📝 Feljelentés', callbackData: (id) => `a:f:${id}` },
  { label: '📰 Csak hír', callbackData: (id) => `n:g:${id}` },
];

function tipCategoryKeyboard(articleId: string): InlineKeyboardMarkup {
  return { inline_keyboard: TIP_CATEGORY_BUTTONS.map((b) => [{ text: b.label, callback_data: b.callbackData(articleId) }]) };
}

function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/\S+/);
  return m ? m[0].replace(/[.,)\]>]+$/, '') : null;
}

type ResolveArticleResult = { id: string; headline: string } | { error: string };

/**
 * Ismeretlen (nem konfigurált outlet-adapterrel rendelkező) domainhez dedikált
 * Source sort keres/hoz létre — `enabled: false`, hogy a rendes órás
 * scrape.news cron ne próbálja meg (nincs hozzá adapter, csak logolna egy
 * figyelmeztetést). A név az og:site_name meta-tagből jön, ha a site megadja
 * (a legtöbb hírportál igen) — enélkül a bare hostname a fallback.
 */
async function findOrCreateAdHocSource(hostname: string, siteName: string | null): Promise<string | { error: string }> {
  const db = getDb();
  const slug = `tip-${hostname}`.slice(0, 100);
  const existing = await db.select({ id: schema.sources.id }).from(schema.sources).where(eq(schema.sources.slug, slug)).limit(1);
  if (existing[0]) return existing[0].id;

  const rows = await db
    .insert(schema.sources)
    .values({ slug, name: siteName ?? hostname, homepage: `https://${hostname}`, tag: 'newsletter', enabled: false })
    .onConflictDoNothing({ target: schema.sources.slug })
    .returning({ id: schema.sources.id });
  if (rows[0]) return rows[0].id;

  const raceRows = await db.select({ id: schema.sources.id }).from(schema.sources).where(eq(schema.sources.slug, slug)).limit(1);
  if (raceRows[0]) return raceRows[0].id;
  return { error: `Nem sikerült Source sort létrehozni "${hostname}"-hoz.` };
}

/** Beküldött URL feloldása/beszúrása NewsArticle-ként (008 kiterjesztés — kézi bejelentés). */
async function resolveOrCreateArticleFromUrl(rawUrl: string): Promise<ResolveArticleResult> {
  const db = getDb();
  const outletSlug = routeOutletByUrl(rawUrl);
  const adapter = outletSlug ? getAdapter(outletSlug) : null;
  const canonical = canonicalUrl(rawUrl, adapter?.queryAllowlist ?? []);
  const hash = dedupHash(canonical);

  const existing = await db
    .select({ id: schema.newsArticles.id, headline: schema.newsArticles.headline })
    .from(schema.newsArticles)
    .where(eq(schema.newsArticles.sourceUrlHash, hash))
    .limit(1);
  if (existing[0]) return { id: existing[0].id, headline: existing[0].headline };

  let fetched;
  try {
    fetched = await fetchPrimaryArticle({ sourceUrl: rawUrl, archiveUrl: null, tagSlug: '', dateText: null });
  } catch {
    fetched = null;
  }
  if (!fetched) return { error: 'A cikk nem tölthető be (védett oldal vagy hibás link).' };

  let sourceId: string;
  if (outletSlug) {
    const sourceRows = await db.select({ id: schema.sources.id }).from(schema.sources).where(eq(schema.sources.slug, outletSlug)).limit(1);
    if (!sourceRows[0]) return { error: `Nincs "${outletSlug}" Source sor.` };
    sourceId = sourceRows[0].id;
  } else {
    let hostname: string;
    try {
      hostname = new URL(rawUrl).hostname.replace(/^www\./, '');
    } catch {
      hostname = TELEGRAM_TIP_SOURCE_SLUG;
    }
    const resolved = await findOrCreateAdHocSource(hostname, fetched.siteName);
    if (typeof resolved !== 'string') return resolved;
    sourceId = resolved;
  }

  const rows = await db
    .insert(schema.newsArticles)
    .values({
      sourceId,
      headline: fetched.headline,
      excerpt: fetched.excerpt,
      sourceUrl: canonical,
      sourceUrlHash: hash,
      publishedAt: fetched.publishedAt,
      viaArchive: fetched.viaArchive,
    })
    .onConflictDoNothing({ target: schema.newsArticles.sourceUrlHash })
    .returning({ id: schema.newsArticles.id, headline: schema.newsArticles.headline });

  if (rows[0]) return { id: rows[0].id, headline: rows[0].headline };

  // Race: valaki más (pl. a rendes cron) épp most szúrta be — olvassuk vissza.
  const raceRows = await db.select({ id: schema.newsArticles.id, headline: schema.newsArticles.headline }).from(schema.newsArticles).where(eq(schema.newsArticles.sourceUrlHash, hash)).limit(1);
  if (raceRows[0]) return { id: raceRows[0].id, headline: raceRows[0].headline };
  return { error: 'Ismeretlen hiba a cikk beszúrásakor.' };
}

/** A pending row's own primary source URL — used to resolve back to the
 *  NewsArticle it came from (no direct FK exists), so the cross-category
 *  check (US2) has an article to re-analyze. mediaClosures stores a single
 *  `sourceUrl`; the other two store a `sourceUrls` array (first = original). */
async function findPendingRecord(detectorType: DetectorType, id: string): Promise<{ id: string; sourceUrl: string | null } | null> {
  if (detectorType === 'resignation') {
    const rows = await getDb().select({ id: schema.politicalResignations.id, sourceUrls: schema.politicalResignations.sourceUrls })
      .from(schema.politicalResignations).where(eq(schema.politicalResignations.id, id)).limit(1);
    const row = rows[0];
    return row ? { id: row.id, sourceUrl: row.sourceUrls[0] ?? null } : null;
  }
  if (detectorType === 'media_closure') {
    const rows = await getDb().select({ id: schema.mediaClosures.id, sourceUrl: schema.mediaClosures.sourceUrl })
      .from(schema.mediaClosures).where(eq(schema.mediaClosures.id, id)).limit(1);
    const row = rows[0];
    return row ? { id: row.id, sourceUrl: row.sourceUrl } : null;
  }
  if (detectorType === 'court_verdict') {
    const rows = await getDb().select({ id: schema.courtVerdicts.id, sourceUrls: schema.courtVerdicts.sourceUrls })
      .from(schema.courtVerdicts).where(eq(schema.courtVerdicts.id, id)).limit(1);
    const row = rows[0];
    return row ? { id: row.id, sourceUrl: row.sourceUrls[0] ?? null } : null;
  }
  if (detectorType === 'criminal_complaint') {
    const rows = await getDb().select({ id: schema.criminalComplaints.id, sourceUrls: schema.criminalComplaints.sourceUrls })
      .from(schema.criminalComplaints).where(eq(schema.criminalComplaints.id, id)).limit(1);
    const row = rows[0];
    return row ? { id: row.id, sourceUrl: row.sourceUrls[0] ?? null } : null;
  }
  return null; // asset_recovery has no reviewStatus/pending concept
}

/**
 * 2026-07-14 — rejecting used to set reviewStatus='rejected', but a rejected
 * row still counts as a "duplicate" for 30 days (isDuplicate, FR-009/FR-011)
 * — a genuinely new, later article about the same person would be silently
 * swallowed as a dupe with no notification. Deleting the row instead means
 * there's nothing left to match: a real future event gets a fully fresh run
 * through the normal threshold logic (and a fresh review/revert prompt if it
 * auto-publishes again).
 */
async function setPendingStatus(detectorType: DetectorType, id: string, status: 'approved' | 'rejected'): Promise<void> {
  if (status === 'rejected') {
    if (detectorType === 'resignation') {
      await getDb().delete(schema.politicalResignations).where(eq(schema.politicalResignations.id, id));
    } else if (detectorType === 'media_closure') {
      await getDb().delete(schema.mediaClosures).where(eq(schema.mediaClosures.id, id));
    } else if (detectorType === 'court_verdict') {
      await getDb().delete(schema.courtVerdicts).where(eq(schema.courtVerdicts.id, id));
    } else if (detectorType === 'criminal_complaint') {
      await getDb().delete(schema.criminalComplaints).where(eq(schema.criminalComplaints.id, id));
    }
    return;
  }
  if (detectorType === 'resignation') {
    await getDb().update(schema.politicalResignations).set({ reviewStatus: 'approved', updatedAt: new Date() }).where(eq(schema.politicalResignations.id, id));
  } else if (detectorType === 'media_closure') {
    await getDb().update(schema.mediaClosures).set({ reviewStatus: 'approved', updatedAt: new Date() }).where(eq(schema.mediaClosures.id, id));
  } else if (detectorType === 'court_verdict') {
    await getDb().update(schema.courtVerdicts).set({ reviewStatus: 'approved', updatedAt: new Date() }).where(eq(schema.courtVerdicts.id, id));
  } else if (detectorType === 'criminal_complaint') {
    await getDb().update(schema.criminalComplaints).set({ reviewStatus: 'approved', updatedAt: new Date() }).where(eq(schema.criminalComplaints.id, id));
  }
}

async function loadArticle(articleId: string): Promise<ArticleForReprocess | null> {
  const rows = await getDb()
    .select({
      id: schema.newsArticles.id,
      headline: schema.newsArticles.headline,
      excerpt: schema.newsArticles.excerpt,
      sourceUrl: schema.newsArticles.sourceUrl,
      publishedAt: schema.newsArticles.publishedAt,
      sourceName: schema.sources.name,
    })
    .from(schema.newsArticles)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
    .where(eq(schema.newsArticles.id, articleId))
    .limit(1);
  return rows[0] ?? null;
}

async function loadArticleByUrl(sourceUrl: string): Promise<ArticleForReprocess | null> {
  const rows = await getDb()
    .select({
      id: schema.newsArticles.id,
      headline: schema.newsArticles.headline,
      excerpt: schema.newsArticles.excerpt,
      sourceUrl: schema.newsArticles.sourceUrl,
      publishedAt: schema.newsArticles.publishedAt,
      sourceName: schema.sources.name,
    })
    .from(schema.newsArticles)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
    .where(eq(schema.newsArticles.sourceUrl, sourceUrl))
    .limit(1);
  return rows[0] ?? null;
}

/** Runs the AI removal-check for a matched WATCH_LIST person and sends the
 *  verdict as a new message with confirm/discard buttons — the human's
 *  confirm press is the "second source" a fully automated run would
 *  otherwise require (see the long comment in telegram-review-actions.ts). */
async function runWatchlistCheck(person: WatchPerson, article: ArticleForReprocess, callbackQueryId: string) {
  await answerCallbackQuery(callbackQueryId, 'AI-ellenőrzés fut…');
  const checked = await checkWatchlistRemovalForArticle(person, article);
  if (!checked.ok) {
    await sendTelegramMessage(`⚠️ ${checked.message}`);
    return;
  }
  const { check } = checked;
  const verdictLabel =
    check.confirmedArticleIds.length === 0
      ? 'NEM MEGERŐSÍTETT (csak jövő idejű/tervezett megfogalmazás)'
      : check.removalType === 'resigned'
        ? 'LEMONDÁS'
        : check.removalType === 'removed'
          ? 'ELTÁVOLÍTÁS'
          : 'BIZONYTALAN';
  const text = [
    `🏛️ ${person.name} (${person.institution})`,
    `AI-verdikt: ${verdictLabel}`,
    check.lead ? `Összefoglaló: ${check.lead}` : null,
    `Indoklás: ${check.reason}`,
    '',
    'Egyetlen forrás alapján — a Jóváhagyás gombbal Te adod a második megerősítést.',
  ].filter(Boolean).join('\n');
  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[
      { text: '✅ Jóváhagyás — rögzítés', callback_data: `a:wc:${person.id}.${article.id}` },
      { text: '❌ Elutasítás', callback_data: `a:wd:${person.id}.${article.id}` },
    ]],
  };
  await sendTelegramMessage(text, keyboard);
}

function revalidatePublicPaths() {
  revalidatePath('/');
  revalidatePath('/hirek');
  revalidatePath('/lemondasok');
  revalidatePath('/megszunt');
  revalidatePath('/birosagi-iteletek');
  revalidatePath('/podcastok');
}

/**
 * Sikeres jóváhagyás után (008 US2, FR-005/FR-006): a másik 3
 * detektor-típust is megvizsgálja UGYANAZON a cikken, de csak azt,
 * amelyiknek MÉG NINCS DetectionCheck sora — a rendes cron már
 * kiértékelt kategóriákat nem futtatja újra. A NORMÁL küszöb-logikával
 * fut (bypassConfidenceGate=false), tehát csak akkor szúr be
 * automatikusan, ha a cikk önmagában is átlépné a 0.77-es
 * auto-publikálási küszöböt — alacsonyabb bizonyosságnál új, gombos
 * Telegram-üzenetet küld, nem hallgat el semmit.
 */
async function crossCheckOtherCategories(article: ArticleForReprocess, handledType: DetectorType): Promise<string[]> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const otherTypes = (Object.keys(DETECTOR_PROCESSORS) as DetectorType[]).filter((t) => t !== handledType);

  const alreadyChecked = (await getDb().execute(
    sql`SELECT "detectorType" FROM "DetectionCheck" WHERE "articleId" = ${article.id}`,
  )) as unknown as Array<{ detectorType: string }>;
  const checkedSet = new Set(alreadyChecked.map((r) => r.detectorType));

  const notes: string[] = [];
  for (const type of otherTypes) {
    if (checkedSet.has(type)) continue;
    const outcome = await DETECTOR_PROCESSORS[type](article, todayIso, false);
    if (outcome.status === 'inserted' || outcome.status === 'updated') {
      notes.push(`✅ Automatikusan felvéve: ${DETECTOR_LABELS_HU[type]}`);
    } else if (outcome.status === 'inserted_multi') {
      notes.push(`✅ Automatikusan felvéve (${outcome.recordIds.length}/${outcome.total} fő): ${DETECTOR_LABELS_HU[type]}`);
    } else if (outcome.status === 'pending_notified') {
      notes.push(`🔔 Jelezve (jóváhagyásra vár): ${DETECTOR_LABELS_HU[type]}`);
    }
    // 'discarded' / 'error' → no note, matches normal cron's silent discard.
  }
  return notes;
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;

  // ── Bejövő szöveges üzenet (nem gombnyomás) — 008 kiterjesztés: kézi
  // bejelentés. A chat.id-t MINDIG logoljuk (akkor is, ha a whitelist
  // elutasítja), hogy egy új Telegram-csoport ID-ja megtalálható legyen a
  // Vercel logokban, amikor a botot hozzáadják egy grouphoz. ──
  if (update?.message) {
    const msg = update.message;
    console.log('[telegram-webhook] message from chat', msg.chat.id, (msg.text ?? '').slice(0, 80));

    const allowedChatId = process.env.TELEGRAM_CHAT_ID;
    if (!allowedChatId || String(msg.chat.id) !== allowedChatId) {
      return NextResponse.json({ ok: true }); // ismeretlen chat — csendben eldobva
    }

    // Az URL-detektálás MINDIG előbb fut, mint a revoke-parancs parseolása:
    // a REVOKE_TRIGGER (/visszavon/i) a nyers szövegre illeszkedik, és egy
    // beküldött URL slugja (pl. ".../hegedus-zsolt-...-visszavonas-okfo")
    // tartalmazhatja a "visszavon" szót, ami false-positive revoke-parancsként
    // értelmezné a linket ahelyett hogy hírként dolgozná fel (2026-07-13,
    // hvg.hu URL-lel reprodukálva — a bot "Nem találtam egyezést erre:
    // https://hvg.hu/itthon/20260713_hegedus"-t válaszolt, mert a szöveget
    // kötőjelek mentén feldarabolta).
    const url = msg.text ? firstUrl(msg.text) : null;
    if (url) {
      const resolved = await resolveOrCreateArticleFromUrl(url);
      if ('error' in resolved) {
        await sendTelegramMessage(`⚠️ ${resolved.error}\n\n${url}`);
        return NextResponse.json({ ok: true });
      }
      await sendTelegramMessage(
        `📥 Beküldött hír:\n${resolved.headline}\n\n${url}\n\nMelyik kategóriába tegyem?`,
        tipCategoryKeyboard(resolved.id),
      );
      return NextResponse.json({ ok: true });
    }

    const revoke = msg.text ? parseRevokeCommand(msg.text) : null;
    if (revoke) {
      const candidates = await searchRevokeCandidates(revoke.nameQuery, revoke.categoryCode);
      if (candidates.length === 0) {
        await sendTelegramMessage(`Nem találtam egyezést erre: "${revoke.nameQuery}".`);
      } else {
        const keyboard: InlineKeyboardMarkup = {
          inline_keyboard: candidates.map((c) => [{ text: `🗑️ ${c.label}`, callback_data: `d:${c.code}:${c.id}` }]),
        };
        await sendTelegramMessage(`Találatok "${revoke.nameQuery}"-ra — válaszd ki, mit töröljek:`, keyboard);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true }); // se URL, se revoke-parancs — nem érdekel minket
  }

  const cq = update?.callback_query;
  if (!cq?.data || !cq.message) {
    return NextResponse.json({ ok: true }); // not a button press we care about
  }

  const [action, code, id] = cq.data.split(':');

  // ── 2026-07-14 — "auto-publikálva, visszavonható" gombok (CourtVerdict /
  // AssetRecovery / WatchlistRemoval automata beszúrásaihoz, l.
  // notify-auto-publish.ts). Külön ág az 'a'/'r'/'n' review-gomboktól, mert
  // itt a sor MÁR élő — "Visszavonás" törli (nem reviewStatus='rejected',
  // l. setPendingStatus komment: a törlés nem blokkolja 30 napig a valódi
  // jövőbeli újradetektálást), "OK, marad" csak nyugtáz. ──
  if (action === 'v' || action === 'k') {
    const target = code ? AUTO_PUBLISH_CODE_TABLE[code] : undefined;
    if (!target || !id) {
      await answerCallbackQuery(cq.id, 'Érvénytelen gomb.');
      return NextResponse.json({ ok: true });
    }
    try {
      let resultText: string;
      if (action === 'k') {
        resultText = '✅ OK, marad.';
      } else {
        if (target === 'court_verdict') {
          await getDb().delete(schema.courtVerdicts).where(eq(schema.courtVerdicts.id, id));
        } else if (target === 'asset_recovery') {
          await getDb().delete(schema.assetRecoveries).where(eq(schema.assetRecoveries.id, id));
        } else {
          // 2026-07-18 — applyWatchlistRemoval() (Telegram "🏛️
          // Tisztségviselő-eltávolítás" gomb) mindig ír egy párosított
          // PoliticalResignation sort is (hogy a homepage/lemondasok listákon
          // is megjelenjen, nem csak a personId-kártyán) — visszavonáskor ezt
          // is törölni kell, különben a lista-oldalakon árván megmaradna egy
          // már visszavont eltávolítás.
          const [removed] = await getDb()
            .delete(schema.watchlistRemovals)
            .where(eq(schema.watchlistRemovals.id, id))
            .returning({ personId: schema.watchlistRemovals.personId, sourceUrl: schema.watchlistRemovals.sourceUrl });
          const person = removed ? WATCH_LIST.find((p) => p.id === removed.personId) : undefined;
          if (person) {
            await getDb()
              .delete(schema.politicalResignations)
              .where(and(
                eq(schema.politicalResignations.name, person.name),
                sql`${removed!.sourceUrl} = ANY(${schema.politicalResignations.sourceUrls})`,
              ));
          }
        }
        revalidatePublicPaths();
        resultText = '↩️ Visszavonva.';
      }
      await answerCallbackQuery(cq.id, resultText);
      const finalText = [cq.message.text ?? '', resultText].filter(Boolean).join('\n\n');
      await editMessageReplyMarkup(cq.message.chat.id, cq.message.message_id, finalText);
    } catch (err) {
      await answerCallbackQuery(cq.id, 'Hiba történt, próbáld újra.');
      console.error('[telegram-webhook] auto-publish action error', err);
    }
    return NextResponse.json({ ok: true });
  }

  // ── 2026-07-14 — "Név - kategória - visszavonás" keresés eredményéből
  // választott törlés-gomb. Mindig törli a sort (nem reviewStatus='rejected',
  // ua. indok mint a fenti 'v' ágnál). ──
  if (action === 'd') {
    const target = code ? DELETE_CODE_TABLE[code] : undefined;
    if (!target || !id) {
      await answerCallbackQuery(cq.id, 'Érvénytelen gomb.');
      return NextResponse.json({ ok: true });
    }
    try {
      await deleteByCode(target, id);
      revalidatePublicPaths();
      await answerCallbackQuery(cq.id, '🗑️ Törölve.');
      const finalText = [cq.message.text ?? '', '🗑️ Törölve.'].filter(Boolean).join('\n\n');
      await editMessageReplyMarkup(cq.message.chat.id, cq.message.message_id, finalText);
    } catch (err) {
      await answerCallbackQuery(cq.id, 'Hiba történt, próbáld újra.');
      console.error('[telegram-webhook] delete-by-search error', err);
    }
    return NextResponse.json({ ok: true });
  }

  // ── 2026-07-15 — "legfrissebb podcastok" (YouTube-videó) jóváhagyás. Külön
  // ág a DETECTOR_BY_CODE gépezettől: a PodcastVideo nem NewsArticle-ből
  // származtatott struktúra (nincs findPendingRecord/near_miss fogalom — a
  // sor már véglegesen be van szúrva a scrape-youtube.ts jobban belül,
  // KÉTFÉLE állapotban: 'pending' — AI-bizonytalan, tényleges jóváhagyásra
  // vár; vagy MÁR 'approved' — topikailag rendben van, csak a nézettségi
  // küszöböt nem érte el, de "breaking"-nek tűnik (l. notify.ts
  // notifyPodcastBreakingBelowThreshold). A két eset "Elutasítom" gombja nem
  // ugyanazt jelenti — ezért a jelenlegi reviewStatus-t előbb ki kell
  // olvasni: ha már 'approved', az elutasítás csak nyugtázás (nem vonja
  // vissza egy már legitim jóváhagyást), csak a 'pending' esetben tényleges
  // elutasítás. Elutasításkor SZÁNDÉKOSAN nem töröljük a sort (ellentétben a
  // többi detektorral, l. setPendingStatus komment) — a videoId UNIQUE
  // constraint az egyetlen dedup-mechanizmus az RSS-újrafelfedezés ellen;
  // törléskor a csatorna RSS-je minden óránkénti pollnál újra felfedezné és
  // újra Telegramra küldené ugyanazt a videót.
  if (code === 'y') {
    if ((action !== 'a' && action !== 'r') || !id) {
      await answerCallbackQuery(cq.id, 'Érvénytelen gomb.');
      return NextResponse.json({ ok: true });
    }
    try {
      let resultText: string;
      if (action === 'a') {
        await getDb()
          .update(schema.podcastVideos)
          .set({ reviewStatus: 'approved', viewThresholdMet: true, updatedAt: new Date() })
          .where(eq(schema.podcastVideos.id, id));
        resultText = '✅ Jóváhagyva.';
      } else {
        const rows = await getDb()
          .select({ reviewStatus: schema.podcastVideos.reviewStatus })
          .from(schema.podcastVideos)
          .where(eq(schema.podcastVideos.id, id))
          .limit(1);
        if (rows[0]?.reviewStatus === 'approved') {
          // Már topikailag jóváhagyott (breaking-below-threshold eset) —
          // az "Elutasítom" itt csak nyugtázás, nem von vissza semmit.
          resultText = '👍 Nyugtázva — várunk a nézettségi küszöbre.';
        } else {
          await getDb()
            .update(schema.podcastVideos)
            .set({ reviewStatus: 'rejected', updatedAt: new Date() })
            .where(eq(schema.podcastVideos.id, id));
          resultText = '❌ Elutasítva.';
        }
      }
      revalidatePublicPaths();
      await answerCallbackQuery(cq.id, resultText);
      const finalText = [cq.message.text ?? '', resultText].filter(Boolean).join('\n\n');
      await editMessageReplyMarkup(cq.message.chat.id, cq.message.message_id, finalText);
    } catch (err) {
      await answerCallbackQuery(cq.id, 'Hiba történt, próbáld újra.');
      console.error('[telegram-webhook] podcast-video action error', err);
    }
    return NextResponse.json({ ok: true });
  }

  // ── 2026-07-18 — "🏛️ Tisztségviselő-eltávolítás" kategória. 3 lépés:
  // 'w' (kezdő gomb, articleId) → WATCH_LIST név-egyezés a cikkben, 0/1/több
  // találat; 'wp' (személy-választó, ha több találat volt, id = "personId.
  // articleId") → ugyanoda fut tovább, mint az 1-találatos ág; 'wc'/'wd'
  // (Jóváhagyás/Elutasítás az AI-verdikt üzeneten, id = "personId.articleId")
  // → 'wc' írja be ténylegesen a WatchlistRemoval + PoliticalResignation
  // sorokat (l. applyWatchlistRemoval). Lásd a hosszú kommentet
  // telegram-review-actions.ts-ben, miért nem a DETECTOR_BY_CODE gépezet
  // része ez. ──
  if (action === 'a' && (code === 'w' || code === 'wp' || code === 'wc' || code === 'wd')) {
    if (!id) {
      await answerCallbackQuery(cq.id, 'Érvénytelen gomb.');
      return NextResponse.json({ ok: true });
    }
    try {
      if (code === 'w') {
        const article = await loadArticle(id);
        if (!article) {
          await answerCallbackQuery(cq.id, 'A cikk nem található.');
          return NextResponse.json({ ok: true });
        }
        const candidates = findWatchlistCandidates(article.headline, article.excerpt);
        if (candidates.length === 0) {
          await answerCallbackQuery(cq.id, 'Nincs egyezés.');
          await sendTelegramMessage(
            `Nem találtam egyezést a figyelt listán (${WATCH_LIST.map((p) => p.name).join(', ')}) ebben a cikkben.`,
          );
          return NextResponse.json({ ok: true });
        }
        if (candidates.length > 1) {
          await answerCallbackQuery(cq.id, 'Válassz személyt.');
          const keyboard: InlineKeyboardMarkup = {
            inline_keyboard: candidates.map((p) => [{ text: `🏛️ ${p.name}`, callback_data: `a:wp:${p.id}.${id}` }]),
          };
          await sendTelegramMessage('Több figyelt személy is egyezik — melyikről van szó?', keyboard);
          return NextResponse.json({ ok: true });
        }
        await runWatchlistCheck(candidates[0]!, article, cq.id);
        return NextResponse.json({ ok: true });
      }

      const [personId, articleId] = id.split('.');
      const person = personId ? WATCH_LIST.find((p) => p.id === personId) : undefined;
      if (!person) {
        await answerCallbackQuery(cq.id, 'Érvénytelen gomb.');
        return NextResponse.json({ ok: true });
      }

      if (code === 'wp') {
        const article = articleId ? await loadArticle(articleId) : null;
        if (!article) {
          await answerCallbackQuery(cq.id, 'A cikk nem található.');
          return NextResponse.json({ ok: true });
        }
        await runWatchlistCheck(person, article, cq.id);
        return NextResponse.json({ ok: true });
      }

      if (code === 'wd') {
        await answerCallbackQuery(cq.id, '❌ Elutasítva.');
        const finalText = [cq.message.text ?? '', '❌ Elutasítva.'].filter(Boolean).join('\n\n');
        await editMessageReplyMarkup(cq.message.chat.id, cq.message.message_id, finalText);
        return NextResponse.json({ ok: true });
      }

      // code === 'wc'
      const article = articleId ? await loadArticle(articleId) : null;
      if (!article) {
        await answerCallbackQuery(cq.id, 'A cikk nem található.');
        return NextResponse.json({ ok: true });
      }
      const checked = await checkWatchlistRemovalForArticle(person, article);
      if (!checked.ok) {
        await answerCallbackQuery(cq.id, 'Hiba.');
        await sendTelegramMessage(`⚠️ ${checked.message}`);
        return NextResponse.json({ ok: true });
      }
      await applyWatchlistRemoval(person, article, checked.check);
      revalidatePublicPaths();
      const resultText = '✅ Eltávolítás rögzítve.';
      await answerCallbackQuery(cq.id, resultText);
      const finalText = [cq.message.text ?? '', resultText].filter(Boolean).join('\n\n');
      await editMessageReplyMarkup(cq.message.chat.id, cq.message.message_id, finalText);
    } catch (err) {
      await answerCallbackQuery(cq.id, 'Hiba történt, próbáld újra.');
      console.error('[telegram-webhook] watchlist-removal action error', err);
    }
    return NextResponse.json({ ok: true });
  }

  const isGeneralNews = action === 'n' && code === 'g';
  const detectorType = code ? DETECTOR_BY_CODE[code] : undefined;
  if ((action !== 'a' && action !== 'r' && action !== 'n') || (!detectorType && !isGeneralNews) || !id) {
    await answerCallbackQuery(cq.id, 'Érvénytelen gomb.');
    return NextResponse.json({ ok: true });
  }

  try {
    if (action === 'n') {
      // ── "Csak hírbe": nem nyúl semmilyen strukturált táblához, csak a
      // NewsArticle címkéjét/breaking-jelzését állítja be. `id` itt mindig
      // articleId (l. notify.ts, vagy a fenti kézi-bejelentés ág). A "g"
      // (general) kód a kézi bejelentésből jön, amikor nincs eredeti
      // detektor-kategória, amihez a címkét igazítani lehetne. ──
      await getDb()
        .update(schema.newsArticles)
        .set({ tag: isGeneralNews ? 'Hír' : NEWS_ONLY_TAG[detectorType!], isBreakingCandidate: true })
        .where(eq(schema.newsArticles.id, id));
      revalidatePublicPaths();
      await answerCallbackQuery(cq.id, '📰 Hírként kiemelve.');
      const finalText = [cq.message.text ?? '', '📰 Hírként kiemelve (nem került strukturált táblába).'].filter(Boolean).join('\n\n');
      await editMessageReplyMarkup(cq.message.chat.id, cq.message.message_id, finalText);
      return NextResponse.json({ ok: true });
    }
    if (!detectorType) {
      // Unreachable: the entry guard only allows a missing detectorType when
      // action === 'n' (isGeneralNews), which always returns above. Kept for
      // TypeScript narrowing on the 'a'/'r' paths below.
      return NextResponse.json({ ok: true });
    }

    const pending = await findPendingRecord(detectorType, id);
    let resultText: string;
    let extraNotes: string[] = [];

    if (pending) {
      // ── pending: already-inserted row, just flip reviewStatus ──
      await setPendingStatus(detectorType, id, action === 'a' ? 'approved' : 'rejected');
      revalidatePublicPaths();
      resultText = action === 'a' ? '✅ Jóváhagyva.' : '❌ Elutasítva.';

      if (action === 'a' && pending.sourceUrl) {
        const article = await loadArticleByUrl(pending.sourceUrl);
        if (article) extraNotes = await crossCheckOtherCategories(article, detectorType);
      }
    } else if (action === 'r') {
      // ── near_miss reject: nothing was ever inserted, nothing to undo ──
      resultText = '❌ Elutasítva — nem kerül be.';
    } else {
      // ── near_miss approve: id is the articleId, re-run extraction and force-insert ──
      const article = await loadArticle(id);
      if (!article) {
        await answerCallbackQuery(cq.id, 'A cikk már nem található.');
        return NextResponse.json({ ok: true });
      }
      const todayIso = new Date().toISOString().slice(0, 10);
      const outcome = await DETECTOR_PROCESSORS[detectorType](article, todayIso, true);

      if (outcome.status === 'inserted' || outcome.status === 'updated') {
        revalidatePublicPaths();
        resultText = '✅ Jóváhagyva és felvéve.';
        extraNotes = await crossCheckOtherCategories(article, detectorType);
      } else if (outcome.status === 'inserted_multi') {
        revalidatePublicPaths();
        resultText = `✅ Jóváhagyva — ${outcome.recordIds.length}/${outcome.total} fő felvéve.`;
        extraNotes = await crossCheckOtherCategories(article, detectorType);
      } else if (outcome.status === 'error') {
        await answerCallbackQuery(cq.id, outcome.message);
        return NextResponse.json({ ok: true });
      } else if (outcome.status === 'discarded') {
        resultText = `⚠️ Jóváhagyva, de nem sikerült felvenni (${outcome.reason}).`;
      } else {
        // Logically unreachable with bypassConfidenceGate=true (see
        // telegram-review-actions.ts) — kept for type exhaustiveness.
        resultText = '✅ Jóváhagyva.';
      }
    }

    await answerCallbackQuery(cq.id, resultText);
    const finalText = [cq.message.text ?? '', resultText, ...extraNotes].filter(Boolean).join('\n\n');
    await editMessageReplyMarkup(cq.message.chat.id, cq.message.message_id, finalText);
  } catch (err) {
    await answerCallbackQuery(cq.id, 'Hiba történt, próbáld újra.');
    console.error('[telegram-webhook] error', err);
  }

  return NextResponse.json({ ok: true });
}
