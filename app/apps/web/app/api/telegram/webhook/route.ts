import 'server-only';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, ilike, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { answerCallbackQuery, editMessageCaption, editMessageReplyMarkup, sendTelegramMessage, sendTelegramPhoto, type InlineKeyboardMarkup } from '@/lib/telegram';
import { postPhotoToPage } from '@/lib/facebook';
import { postPhotoViaMake } from '@/lib/make-facebook';
import { regenerateOutboxImage } from '@/lib/social-image';
import { approvalKeyboard as socialApprovalKeyboard } from '@/inngest/functions/check-social-triggers';
import {
  applyWatchlistRemoval,
  checkWatchlistRemovalForArticle,
  DETECTOR_PROCESSORS,
  findWatchlistCandidates,
  type ArticleForReprocess,
} from '@/lib/telegram-review-actions';
import type { DetectorType } from '@korr/db';
import { ALERT_ON_EDITOR_CONFIRM } from '@/lib/notify-auto-publish';
import { recordAlertsForRecordIds, recordSubscriberAlert, revokeSubscriberAlert } from '@/lib/notify-subscribers';
import {
  approvalKeyboard as digestApprovalKeyboard,
  DIGEST_MAX_REGEN,
  renderTemplateBody as renderDigestTemplateBody,
} from '@/lib/digest-build';
import { inngest } from '@/inngest/client';
import { canonicalUrl, clipExcerpt, dedupHash, fetchArticleBodyTransient, fetchPrimaryArticle, getAdapter, routeOutletByUrl } from '@korr/scrapers';
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
// (notify-auto-publish.ts). 2026-09-01: 'resignation' (code 'r') added —
// scoped to the CALLED_TO_RESIGN 8 fő only (isCalledToResignPerson), NOT
// every watchlist person — see notify-auto-publish.ts's header for why.
const AUTO_PUBLISH_CODE_TABLE: Record<string, 'court_verdict' | 'asset_recovery' | 'watchlist_removal' | 'resignation'> = {
  c: 'court_verdict',
  x: 'asset_recovery',
  w: 'watchlist_removal',
  r: 'resignation',
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

/**
 * 012-reader-subscriptions — a szerkesztő javított szövegének HTML-párja.
 *
 * A szerkesztő sima szöveget ír a Telegramba. A `<` és a `&` elszökik, a
 * sorközök bekezdéssé válnak — semmi több. A szerkesztő szövege NEM
 * olvasói bemenet, de a levélbe kerülő HTML akkor sem lehet nyers.
 */
function correctedTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

// 012-reader-subscriptions FR-019 — a törlés visszavonja a hozzá tartozó
// olvasói riasztást is. A watchlist-eltávolítás dedup-kulcsa a SZEMÉLYRE
// épül, ezért a törlésnek vissza kell adnia a personId-t: a sor azonosítója
// önmagában nem tudná újraépíteni a kulcsot.
async function deleteByCode(target: DetectorType | 'watchlist_removal', id: string): Promise<void> {
  const db = getDb();
  if (target === 'resignation') await db.delete(schema.politicalResignations).where(eq(schema.politicalResignations.id, id));
  else if (target === 'media_closure') await db.delete(schema.mediaClosures).where(eq(schema.mediaClosures.id, id));
  else if (target === 'court_verdict') await db.delete(schema.courtVerdicts).where(eq(schema.courtVerdicts.id, id));
  else if (target === 'asset_recovery') await db.delete(schema.assetRecoveries).where(eq(schema.assetRecoveries.id, id));
  else if (target === 'criminal_complaint') await db.delete(schema.criminalComplaints).where(eq(schema.criminalComplaints.id, id));
  else {
    const [removed] = await db
      .delete(schema.watchlistRemovals)
      .where(eq(schema.watchlistRemovals.id, id))
      .returning({ personId: schema.watchlistRemovals.personId });
    if (removed) await revokeSubscriberAlert('watchlist_removal', removed.personId);
    return;
  }
  await revokeSubscriberAlert(target, id);
}

type TelegramUpdate = {
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number; text?: string; caption?: string };
  };
  message?: {
    chat: { id: number };
    // 012-reader-subscriptions FR-068 — a javított szövegű válasz EZEKEN
    // párosít. A `callback_query.message` tagon már van `message_id`; a sima
    // üzenet tagján eddig nem volt, ezért a válasz-ág nem is létezhetett.
    message_id: number;
    reply_to_message?: { message_id: number };
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
  // 2026-07-19 — user kérés: ne kelljen külön "visszavon <név>" parancsot
  // gépelni, ha a gép előtt nem ülő usernek csak annyi kell, hogy egy
  // konkrét, már kint lévő szar cikket linkkel törölni tudjon.
  { label: '🗑️ Törlés (rossz cikk)', callbackData: (id) => `td:n:${id}` },
];

function tipCategoryKeyboard(articleId: string): InlineKeyboardMarkup {
  return { inline_keyboard: TIP_CATEGORY_BUTTONS.map((b) => [{ text: b.label, callback_data: b.callbackData(articleId) }]) };
}

function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/\S+/);
  return m ? m[0].replace(/[.,)\]>]+$/, '') : null;
}

// 2026-07-24 — a user az URL MELLÉ bemásolhatja a cikk lényegét (l. a
// múzeumigazgatók-eset után kért munkafolyamat): "<link> - <pár mondat>"
// vagy akár több sorban. A linket kivágva, a maradék szöveget adjuk a
// detektornak tipBodyText-ként — ha van benne érdemi tartalom (nem csak egy
// árva kötőjel/írásjel a link után). MIN_MANUAL_TEXT_LEN alatt inkább nem
// vesszük figyelembe (elkerüli, hogy egy véletlen szóköz "manuális szövegnek"
// tűnjön és felülírja a scrape-elt cikktörzset egy üres stringgel).
const MIN_MANUAL_TEXT_LEN = 15;

function extractManualBodyText(text: string, url: string): string | null {
  const rest = text.replace(url, '').replace(/^[\s\-–—:]+/, '').trim();
  return rest.length >= MIN_MANUAL_TEXT_LEN ? rest : null;
}

// 2026-07-19 — YouTube-link felismerés a kézi bejelentés flow-hoz: egy
// youtube.com/youtu.be linket NEM szabad resolveOrCreateArticleFromUrl-lel
// NewsArticle-ként feldolgozni (az cikk-scrapelést próbálna futtatni egy
// videó-oldalon, ami vagy hibázik, vagy szemetet szúrna be) — ehelyett a
// meglévő PodcastVideo sort keressük meg videoId alapján, és egy önálló
// törlés-gombot kínálunk (nincs kategória-választás, egy videónak nincs
// "lemondás/ítélet/stb." kategóriája).
function extractYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const shortsMatch = u.pathname.match(/^\/(shorts|live)\/([^/]+)/);
      if (shortsMatch) return shortsMatch[2] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

// 2026-07-24 — bodyText itt SOSE kerül adatbázisba (constitution IV — Data
// Minimization: "NewsArticle.body is not stored"). Csak ebben a válaszban él,
// a hívó a Telegram-üzenet SZÖVEGÉBE ágyazza be (l. embedBodyInMessage /
// extractEmbeddedBodyText lentebb) — a later category-gombnyomáskor onnan,
// cq.message.text-ből olvassuk vissza, sose egy DB-oszlopból.
type ResolveArticleResult =
  | { id: string; headline: string; bodyText: string | null }
  | { error: string };

/** Fallback-cím, ha a lekérés elhasalt, de a user mellékelt szöveget — a
 *  szöveg első mondata/sora, max 120 karakterig. */
function deriveHeadlineFromManualText(text: string): string {
  const firstLine = text.split(/\n/)[0]!.trim();
  const firstSentence = firstLine.split(/(?<=[.!?])\s/)[0]!.trim();
  return (firstSentence || firstLine).slice(0, 120) || 'Kézzel beküldött hír';
}

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

/**
 * Beküldött URL feloldása/beszúrása NewsArticle-ként (008 kiterjesztés — kézi
 * bejelentés). `manualBodyText` — 2026-07-24, a múzeumigazgatók-eset után —
 * a user az URL mellé bemásolhatja a cikk lényegét (l. extractManualBodyText);
 * ha ez megvan, EZ a mérvadó a detektáláshoz, a scrape-elt bodyText helyett
 * (megbízhatóbb, nincs 403/bot-blokk kockázat). Ha a lekérés is elhasal ÉS
 * nincs manualBodyText, hibát adunk vissza — a hívó ilyenkor megkéri a
 * usert, hogy küldje újra a linket + pár mondatot.
 *
 * A visszaadott `bodyText` SOSE kerül adatbázisba (constitution IV) — a
 * hívó a Telegram-válaszüzenet szövegébe ágyazza, onnan él tovább.
 */
async function resolveOrCreateArticleFromUrl(rawUrl: string, manualBodyText?: string | null): Promise<ResolveArticleResult> {
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
  if (existing[0]) {
    const bodyText = manualBodyText ?? (await fetchArticleBodyTransient(rawUrl).catch(() => null));
    return { id: existing[0].id, headline: existing[0].headline, bodyText };
  }

  let fetched;
  try {
    fetched = await fetchPrimaryArticle({ sourceUrl: rawUrl, archiveUrl: null, tagSlug: '', dateText: null });
  } catch {
    fetched = null;
  }
  const bodyText = manualBodyText ?? (await fetchArticleBodyTransient(rawUrl).catch(() => null));
  if (!fetched && !manualBodyText) {
    return { error: 'A cikk nem tölthető be (védett oldal vagy hibás link). Küldd be újra így: <link>, új sorban pár mondat a lényegről — abból dolgozom.' };
  }

  const headline = fetched?.headline ?? deriveHeadlineFromManualText(manualBodyText!);
  const excerpt = fetched?.excerpt ?? clipExcerpt(manualBodyText!);
  const publishedAt = fetched?.publishedAt ?? new Date();
  const viaArchive = fetched?.viaArchive ?? false;

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
    const resolved = await findOrCreateAdHocSource(hostname, fetched?.siteName ?? null);
    if (typeof resolved !== 'string') return resolved;
    sourceId = resolved;
  }

  const rows = await db
    .insert(schema.newsArticles)
    .values({
      sourceId,
      headline,
      excerpt,
      sourceUrl: canonical,
      sourceUrlHash: hash,
      publishedAt,
      viaArchive,
    })
    .onConflictDoNothing({ target: schema.newsArticles.sourceUrlHash })
    .returning({ id: schema.newsArticles.id, headline: schema.newsArticles.headline });

  if (rows[0]) return { id: rows[0].id, headline: rows[0].headline, bodyText };

  // Race: valaki más (pl. a rendes cron) épp most szúrta be — olvassuk vissza.
  const raceRows = await db.select({ id: schema.newsArticles.id, headline: schema.newsArticles.headline }).from(schema.newsArticles).where(eq(schema.newsArticles.sourceUrlHash, hash)).limit(1);
  if (raceRows[0]) return { id: raceRows[0].id, headline: raceRows[0].headline, bodyText };
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

// 2026-07-24 — a múzeumigazgatók-eset fixe: a rövid excerpt helyett a teljes
// cikktörzset adjuk a detektornak, DE constitution IV (Data Minimization)
// miatt ez SOSE kerül adatbázisba. A submission-kori bot-üzenet szövegébe
// ágyazzuk (l. embedBodyInMessage), és a KÉSŐBBI gombnyomáskor `cq.message
// .text`-ből olvassuk vissza — ez a Telegram-szál, nem a mi DB-nk, tárolja.
// Ha a marker hiányzik (pl. régi, e commit előtti gomb), utolsó esélyként
// egyszeri élő újralekérést próbálunk — sose blokkoló hiba.
const BODY_MARKER_START = '\n\n📄 RÉSZLET (ezt használom a döntéshez):\n';
const BODY_MARKER_END = '\n\nMelyik kategóriába tegyem?';

function extractEmbeddedBodyText(messageText: string | undefined): string | null {
  if (!messageText) return null;
  const startIdx = messageText.indexOf(BODY_MARKER_START);
  if (startIdx === -1) return null;
  const afterMarker = startIdx + BODY_MARKER_START.length;
  const endIdx = messageText.indexOf(BODY_MARKER_END, afterMarker);
  const body = (endIdx === -1 ? messageText.slice(afterMarker) : messageText.slice(afterMarker, endIdx)).trim();
  return body.length > 0 ? body : null;
}

async function withDetectionBody(article: ArticleForReprocess, cqMessageText: string | undefined): Promise<ArticleForReprocess> {
  const embedded = extractEmbeddedBodyText(cqMessageText);
  if (embedded) return { ...article, excerpt: embedded };
  if (article.excerpt.length >= 900 || !article.sourceUrl) return article; // már eleve elég gazdag, vagy nincs mit lekérni
  const fetched = await fetchArticleBodyTransient(article.sourceUrl).catch(() => null);
  return fetched ? { ...article, excerpt: fetched } : article;
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
    // 012-reader-subscriptions FR-012 / FR-016 — a kereszt-ellenőrzés is
    // publikál sorokat, tehát riasztania kell rájuk. A kapuhalmaz két
    // szekciója viszont KIMARAD: erre a kategóriára a szerkesztő nem nyomott
    // gombot, és FR-016 pont ezt tiltja.
    const crossCheckMayAlert = !(ALERT_ON_EDITOR_CONFIRM as ReadonlySet<string>).has(type);
    if (outcome.status === 'inserted' || outcome.status === 'updated') {
      if (crossCheckMayAlert) await recordAlertsForRecordIds(type, [outcome.recordId]);
      notes.push(`✅ Automatikusan felvéve: ${DETECTOR_LABELS_HU[type]}`);
    } else if (outcome.status === 'inserted_multi') {
      if (crossCheckMayAlert) await recordAlertsForRecordIds(type, outcome.recordIds);
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

    // ── 012-reader-subscriptions FR-068…FR-072 — javított hírlevél-szöveg. ──
    //
    // Ez az ág MINDEN más szöveges kezelés ELŐTT fut, két külön okból:
    //
    // 1. Az URL-detektálás (:firstUrl) elé kell kerülnie, mert egy javított
    //    hírlevél-törzs LINKEKET tartalmaz az oldalra. A régi sorrend
    //    hírbejelentésként nyelné le, és egy ötgombos review-billentyűzettel
    //    válaszolna a szerkesztőnek (FR-069).
    // 2. A SocialPostOutbox "pendingEdit" ág elé is kell kerülnie: az a
    //    legfrissebb, szerkesztésre váró sorra illeszt, és NEM nézi a
    //    reply_to_message-t — egy függő poszt-szerkesztés mellett a javított
    //    hírlevél csendben Facebook-képaláírásként mentődne.
    //
    // Ez az ág PONTOSAN párosít, a `reply_to_message.message_id`-n. Ami nem
    // párosít, az érintetlenül esik tovább a meglévő kezelésre (FR-070).
    const replyToId = msg.reply_to_message?.message_id;
    if (msg.text && replyToId) {
      const [digest] = await getDb()
        .select({
          id: schema.digests.id,
          code: schema.digests.code,
          status: schema.digests.status,
          regenCount: schema.digests.regenCount,
        })
        .from(schema.digests)
        .where(eq(schema.digests.telegramMessageId, replyToId))
        .limit(1);

      if (digest) {
        if (digest.status !== 'awaiting_approval') {
          // FR-071 — semmit nem változtat, magyarul megmondja, miért.
          await sendTelegramMessage(
            'Ez a hírlevél már elment vagy el lett vetve — a javítás nem került bele.',
          );
          return NextResponse.json({ ok: true });
        }
        if (digest.regenCount >= DIGEST_MAX_REGEN) {
          // FR-072 — a javított szöveg UGYANAZT az egy újragenerálási keretet
          // fogyasztja, mint a "🔄 Újragenerálás" gomb.
          await sendTelegramMessage(
            'Ehhez a hírlevélhez már volt egy átírás. Vagy ez megy ki, vagy vesd el.',
          );
          return NextResponse.json({ ok: true });
        }

        const corrected = msg.text;
        await getDb()
          .update(schema.digests)
          .set({
            bodyText: corrected,
            bodyHtml: correctedTextToHtml(corrected),
            regenCount: digest.regenCount + 1,
            // FR-059 — az újragenerálás a piszkozat idejét is újraírja, mert az
            // dönti el, ki számít "túl újnak" a címzettek közül.
            draftedAt: new Date(),
          })
          .where(eq(schema.digests.id, digest.id));

        const messageId = await sendTelegramMessage(
          ['📬 Heti hírlevél — javított szöveggel', '', corrected.slice(0, 3000)].join('\n'),
          digestApprovalKeyboard(digest.code),
        );
        if (messageId) {
          // FR-068 — a leváltott üzenetre adott válasz többé nem találhat.
          await getDb()
            .update(schema.digests)
            .set({ telegramMessageId: messageId })
            .where(eq(schema.digests.id, digest.id));
        }
        return NextResponse.json({ ok: true });
      }
    }

    // ── 2026-08-31 — "✏️ Módosítás" gomb utáni szöveges válasz (Social Post
    // Outbox). MINDEN egyéb logika (URL-detektálás, visszavon-parancs) ELŐTT
    // fut: ha van függőben lévő szerkesztés, a beérkező szöveg AZ, nem egy
    // link vagy parancs — ellenkező esetben egy beírt leírás-szöveg
    // véletlenül revoke-parancsként vagy hírbejelentésként értelmeződne.
    // Egyetlen operátoros admin-bot, ezért nem kell chat/user-szintű
    // munkamenet-azonosító — a legfrissebb pendingEdit-es sor a mérvadó.
    if (msg.text) {
      const pendingRows = await getDb()
        .select()
        .from(schema.socialPostOutbox)
        .where(isNotNull(schema.socialPostOutbox.pendingEdit))
        .orderBy(desc(schema.socialPostOutbox.createdAt))
        .limit(1);
      const pendingRow = pendingRows[0];
      if (pendingRow) {
        try {
          if (pendingRow.pendingEdit === 'caption' || pendingRow.pendingEdit === 'both_caption') {
            const wasBoth = pendingRow.pendingEdit === 'both_caption';
            await getDb().update(schema.socialPostOutbox).set({ caption: msg.text, pendingEdit: null }).where(eq(schema.socialPostOutbox.id, pendingRow.id));
            if (wasBoth) {
              await sendTelegramMessage('✅ Leírás mentve. Mit csináljunk a képpel?', {
                inline_keyboard: [
                  [{ text: '✍️ Szöveg a képen', callback_data: `s:mis:${pendingRow.id}` }],
                  [{ text: '🎨 Új design', callback_data: `s:mid:${pendingRow.id}` }],
                ],
              });
            } else {
              await sendTelegramPhoto(
                Buffer.from(pendingRow.imagePng, 'base64'),
                `📢 Frissített poszt-jelölt\n\n${msg.text}`,
                socialApprovalKeyboard(pendingRow.id),
              );
            }
            return NextResponse.json({ ok: true });
          }
          if (pendingRow.pendingEdit === 'image_text') {
            const newImage = await regenerateOutboxImage({ ...pendingRow, imageText: msg.text });
            await getDb().update(schema.socialPostOutbox)
              .set({ imagePng: newImage.toString('base64'), imageText: msg.text, pendingEdit: null })
              .where(eq(schema.socialPostOutbox.id, pendingRow.id));
            await sendTelegramPhoto(newImage, `📢 Frissített poszt-jelölt\n\n${pendingRow.caption}`, socialApprovalKeyboard(pendingRow.id));
            return NextResponse.json({ ok: true });
          }
        } catch (err) {
          console.error('[telegram-webhook] social-post-outbox text-edit error', err);
          await sendTelegramMessage('⚠️ Hiba történt a szerkesztés mentésekor, próbáld újra.');
          return NextResponse.json({ ok: true });
        }
      }
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
      const youtubeId = extractYoutubeVideoId(url);
      if (youtubeId) {
        const videoRows = await getDb()
          .select({ id: schema.podcastVideos.id, title: schema.podcastVideos.title, channelName: schema.podcastVideos.channelName })
          .from(schema.podcastVideos)
          .where(eq(schema.podcastVideos.videoId, youtubeId))
          .limit(1);
        const video = videoRows[0];
        if (!video) {
          await sendTelegramMessage(`⚠️ Nincs ilyen videó az adatbázisban (talán már törölve, vagy sose vettük fel).\n\n${url}`);
          return NextResponse.json({ ok: true });
        }
        await sendTelegramMessage(
          `📺 ${video.channelName} — ${video.title}\n\n${url}`,
          { inline_keyboard: [[{ text: '🗑️ Törlés', callback_data: `td:y:${video.id}` }]] },
        );
        return NextResponse.json({ ok: true });
      }

      const manualBodyText = extractManualBodyText(msg.text ?? '', url);
      const resolved = await resolveOrCreateArticleFromUrl(url, manualBodyText);
      if ('error' in resolved) {
        await sendTelegramMessage(`⚠️ ${resolved.error}\n\n${url}`);
        return NextResponse.json({ ok: true });
      }
      // 2026-07-24 — a múzeumigazgatók-eset óta: ha van teljes szöveg
      // (mellékelt vagy scrape-elt), a Telegram-üzenet SZÖVEGÉBE ágyazzuk
      // (constitution IV miatt DB-be nem mehet) — a gombnyomáskor onnan
      // olvassuk vissza, l. extractEmbeddedBodyText. Ha nincs, figyelmeztetünk.
      const bodyNote = manualBodyText
        ? '📝 A mellékelt szöveg alapján dolgozom.'
        : resolved.bodyText
          ? null
          : '⚠️ Nem sikerült elolvasnom a cikk teljes szövegét (csak a rövid kivonatot). Ha több eset/személy van benne, küldd újra a linket, alá írva pár mondatban a lényeget — abból pontosabban dolgozom.';
      const embeddedBody = resolved.bodyText
        ? `${BODY_MARKER_START}${resolved.bodyText.slice(0, 3000)}`
        : null;
      await sendTelegramMessage(
        [`📥 Beküldött hír:\n${resolved.headline}`, url, bodyNote].filter(Boolean).join('\n\n')
          + (embeddedBody ?? '')
          + `${BODY_MARKER_END}`,
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

  // ── 012-reader-subscriptions FR-005 — a gombnyomás EREDETÉNEK ellenőrzése.
  // A szöveges üzenetek ága (:641) régóta whitelistel, a callback_query ága
  // eddig NEM: bárki, aki egy továbbított gombos üzenetre rátalált, tudott
  // rekordot törölni vagy publikálni. Ez a feature ugyanezt a botot teszi
  // először NYILVÁNOS csatorna elé, ezért itt záródik be az ablak.
  //
  // A `!allowedChatId` ág teherviselő, nem dísz: ha a változó nincs beállítva,
  // a közvetlen `String(...) !== process.env.TELEGRAM_CHAT_ID` összehasonlítás
  // `undefined`-dal hasonlítana, ami MINDIG egyenlőtlen — így minden szerkesztői
  // gomb csendben, magyarázat nélkül elromlana. Így viszont explicit a szabály:
  // provisioning nélkül egyetlen gombnyomás sem ír adatbázist.
  const allowedCallbackChatId = process.env.TELEGRAM_CHAT_ID;
  if (!allowedCallbackChatId || String(cq.message.chat.id) !== allowedCallbackChatId) {
    console.log('[telegram-webhook] callback_query from unauthorised chat', cq.message.chat.id);
    return NextResponse.json({ ok: true });
  }

  const [action, code, id] = cq.data.split(':');

  // ── 2026-07-14 — "auto-publikálva, visszavonható" gombok (CourtVerdict /
  // AssetRecovery / WatchlistRemoval automata beszúrásaihoz, l.
  // notify-auto-publish.ts). Külön ág az 'a'/'r'/'n' review-gomboktól, mert
  // itt a sor MÁR élő — "Visszavonás" törli (nem reviewStatus='rejected',
  // l. setPendingStatus komment: a törlés nem blokkolja 30 napig a valódi
  // jövőbeli újradetektálást), "OK, marad" csak nyugtáz. ──
  // ── 012-reader-subscriptions FR-056, FR-059, FR-068 — hírlevél-gombok. ──
  //
  // A gomb-adat a NYOLC KARAKTERES rövid kódot viszi, soha nem a rekord
  // azonosítóját: `dg:a:{code}` 13 bájt a Telegram 64 bájtos korlátjából.
  //
  // A "Kimehet" NEM küld helyben. Eseményt tüzel, és azonnal nyugtáz: egy
  // több százas kiküldés egy callback-kezelőn belül időtúllépéssel járna,
  // miközben a Telegram vár — és egy félbeszakadt küldés már kiadott
  // keretfoglalásokkal pontosan az a szivárgás, amit az egészség-ellenőrzés
  // keres.
  if (action === 'dg') {
    if (!id || !code) {
      await answerCallbackQuery(cq.id, 'Érvénytelen gomb.');
      return NextResponse.json({ ok: true });
    }
    try {
      const [digest] = await getDb()
        .select({
          id: schema.digests.id,
          status: schema.digests.status,
          regenCount: schema.digests.regenCount,
          alertIds: schema.digests.alertIds,
          periodStart: schema.digests.periodStart,
          periodEnd: schema.digests.periodEnd,
        })
        .from(schema.digests)
        .where(eq(schema.digests.code, id))
        .limit(1);

      if (!digest) {
        await answerCallbackQuery(cq.id, 'Ez a hírlevél már nem található.');
        return NextResponse.json({ ok: true });
      }
      if (digest.status !== 'awaiting_approval') {
        await answerCallbackQuery(cq.id, 'Ez a hírlevél már elment vagy el lett vetve.');
        return NextResponse.json({ ok: true });
      }

      let resultText: string;
      if (code === 'a') {
        await getDb()
          .update(schema.digests)
          .set({ status: 'approved', approvedAt: new Date() })
          .where(eq(schema.digests.id, digest.id));
        await inngest.send({ name: 'digest.send', data: { digestId: digest.id } });
        resultText = 'Kimehet — kiküldés folyamatban.';
      } else if (code === 'x') {
        // FR-065 — az elvetés EGYETLEN olvasó kurzorát sem lépteti előre, így
        // az időszak nem vész el: a következő összefoglaló lefedi.
        await getDb()
          .update(schema.digests)
          .set({ status: 'discarded' })
          .where(eq(schema.digests.id, digest.id));
        resultText = '🗑️ Elvetve — egyetlen olvasó sem esik el az időszaktól.';
      } else if (code === 'r') {
        if (digest.regenCount >= DIGEST_MAX_REGEN) {
          await answerCallbackQuery(cq.id, 'Ehhez a hírlevélhez már volt egy átírás.');
          return NextResponse.json({ ok: true });
        }
        const alertRows = digest.alertIds.length
          ? await getDb()
              .select({
                id: schema.subscriberAlerts.id,
                section: schema.subscriberAlerts.section,
                title: schema.subscriberAlerts.title,
                detail: schema.subscriberAlerts.detail,
                url: schema.subscriberAlerts.url,
                occurredAt: schema.subscriberAlerts.occurredAt,
              })
              .from(schema.subscriberAlerts)
              .where(and(
                inArray(schema.subscriberAlerts.id, digest.alertIds),
                isNull(schema.subscriberAlerts.revokedAt),
              ))
          : [];
        const body = renderDigestTemplateBody(alertRows.map((r) => ({ ...r })));
        const messageId = await sendTelegramMessage(
          ['📬 Heti hírlevél — újragenerálva', '', body.text.slice(0, 3000)].join('\n'),
          digestApprovalKeyboard(id),
        );
        await getDb()
          .update(schema.digests)
          .set({
            bodyText: body.text,
            bodyHtml: body.html,
            regenCount: digest.regenCount + 1,
            // FR-059 — a piszkozat ideje ÚJRAÍRÓDIK: ez dönti el, ki számít
            // túl újnak a címzettek közül. Egy elavult érték csendben
            // változtatná meg a közönséget két jóváhagyó üzenet között.
            draftedAt: new Date(),
            // FR-068 — a leváltott üzenetre adott válasz többé nem találhat.
            ...(messageId ? { telegramMessageId: messageId } : {}),
          })
          .where(eq(schema.digests.id, digest.id));
        await answerCallbackQuery(cq.id, '🔄 Újragenerálva.');
        return NextResponse.json({ ok: true });
      } else {
        await answerCallbackQuery(cq.id, 'Érvénytelen gomb.');
        return NextResponse.json({ ok: true });
      }

      await answerCallbackQuery(cq.id, resultText);
      const finalText = [cq.message.text ?? '', resultText].filter(Boolean).join('\n\n');
      await editMessageReplyMarkup(cq.message.chat.id, cq.message.message_id, finalText);
    } catch (err) {
      await answerCallbackQuery(cq.id, 'Hiba történt, próbáld újra.');
      console.error('[telegram-webhook] digest action error', err);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'v' || action === 'k') {
    const target = code ? AUTO_PUBLISH_CODE_TABLE[code] : undefined;
    if (!target || !id) {
      await answerCallbackQuery(cq.id, 'Érvénytelen gomb.');
      return NextResponse.json({ ok: true });
    }
    try {
      let resultText: string;
      if (action === 'k') {
        // 012-reader-subscriptions FR-016 / FR-018 — 5. hívási hely. Az "OK,
        // marad" gomb MAGA a szerkesztői kapu. Csak a kapuhalmaz két
        // szekciója riaszt itt: a bírósági ítélet már a detektor
        // beszúrásánál riasztott (A2), és a dedup-kulcs úgyis elnyelné.
        if (ALERT_ON_EDITOR_CONFIRM.has(target)) {
          if (target === 'watchlist_removal') {
            const [row] = await getDb()
              .select({ personId: schema.watchlistRemovals.personId, lead: schema.watchlistRemovals.lead })
              .from(schema.watchlistRemovals)
              .where(eq(schema.watchlistRemovals.id, id))
              .limit(1);
            const person = row ? WATCH_LIST.find((p) => p.id === row.personId) : undefined;
            if (row && person) {
              await recordSubscriberAlert({
                section: 'watchlist_removal',
                entityId: row.personId,
                title: person.name,
                detail: row.lead ?? person.institution ?? null,
              });
            }
          } else {
            await recordAlertsForRecordIds(target, [id]);
          }
        }
        resultText = '✅ OK, marad.';
      } else {
        if (target === 'court_verdict') {
          await getDb().delete(schema.courtVerdicts).where(eq(schema.courtVerdicts.id, id));
          await revokeSubscriberAlert('court_verdict', id);
        } else if (target === 'asset_recovery') {
          await getDb().delete(schema.assetRecoveries).where(eq(schema.assetRecoveries.id, id));
          await revokeSubscriberAlert('asset_recovery', id);
        } else if (target === 'resignation') {
          await getDb().delete(schema.politicalResignations).where(eq(schema.politicalResignations.id, id));
          // FR-019 — a visszavonásnak MINDKÉT törlési úton vissza kell vonnia
          // a riasztást. A main-ről érkező új 'resignation' ág enélkül némán
          // kint hagyna egy riasztást egy már törölt sorra.
          await revokeSubscriberAlert('resignation', id);
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
          // FR-019 — a visszavonás a személyre kulcsolt riasztást vonja
          // vissza, nem a soréra: a dedup-kulcs a personId-ből épül.
          if (removed) await revokeSubscriberAlert('watchlist_removal', removed.personId);
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

  // ── 2026-07-24 — a 010-post-publish-verification 'vy'/'vn' ág ide volt
  // beszúrva egy PÁRHUZAMOS Claude Code session által, félkészen: az
  // `ALL_VERIFICATION_TARGETS` importja @korr/db-ből olyan exportra
  // hivatkozott, ami csak a másik session helyi (nem commitolt) working
  // tree-jében létezett. Mivel ez a fájl egyben lett commitolva, a hiányzó
  // export eltörte a prod buildet — a blokk ezért ideiglenesen KIVÉVE innen
  // (nem törölve, csak nincs itt), amíg a másik session a teljes feature-t
  // (schema+migráció+index-exportok+ez az ág) egyben, sajátjaként be nem
  // commitolja.

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

  // ── 2026-07-19 — "🗑️ Törlés" gomb a kézi URL-bejelentés flow-ból (hír
  // vagy YouTube-videó, amit a user beküldött linkkel, mert szerinte nem
  // kellett volna kikerülnie). code='n' → NewsArticle sor törlése, code='y'
  // → PodcastVideo sor törlése. Mindkettő tényleges DELETE, nem
  // reviewStatus-váltás — egy NewsArticle-nek nincs "elutasítva" állapota
  // (a hír-pipeline sose ír ilyet vissza egy már beszúrt sorra), a
  // PodcastVideo esetén pedig itt direkt szándékos a hard delete: a user
  // egy MÁR KIKERÜLT, publikusan látható rossz videót akar eltüntetni, nem
  // egy jóváhagyásra váró jelöltet elutasítani (az a meglévő 'y' ág dolga,
  // ami reviewStatus='rejected'-et ír, hogy a videoId UNIQUE constraint
  // ne engedje újra felfedezni — itt viszont a user már döntött, a sor
  // NULLÁZÁSA a cél, nem a re-discovery elleni védelem). ──
  if (action === 'td') {
    if ((code !== 'n' && code !== 'y') || !id) {
      await answerCallbackQuery(cq.id, 'Érvénytelen gomb.');
      return NextResponse.json({ ok: true });
    }
    try {
      if (code === 'n') {
        await getDb().delete(schema.newsArticles).where(eq(schema.newsArticles.id, id));
      } else {
        await getDb().delete(schema.podcastVideos).where(eq(schema.podcastVideos.id, id));
      }
      revalidatePublicPaths();
      await answerCallbackQuery(cq.id, '🗑️ Törölve.');
      const finalText = [cq.message.text ?? '', '🗑️ Törölve.'].filter(Boolean).join('\n\n');
      await editMessageReplyMarkup(cq.message.chat.id, cq.message.message_id, finalText);
    } catch (err) {
      await answerCallbackQuery(cq.id, 'Hiba történt, próbáld újra.');
      console.error('[telegram-webhook] tip-delete-by-link error', err);
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
        const enrichedArticle = await withDetectionBody(article, cq.message.text);
        const candidates = findWatchlistCandidates(enrichedArticle.headline, enrichedArticle.excerpt);
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
        await runWatchlistCheck(candidates[0]!, enrichedArticle, cq.id);
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
        await runWatchlistCheck(person, await withDetectionBody(article, cq.message.text), cq.id);
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
      const checked = await checkWatchlistRemovalForArticle(person, await withDetectionBody(article, cq.message.text));
      if (!checked.ok) {
        await answerCallbackQuery(cq.id, 'Hiba.');
        await sendTelegramMessage(`⚠️ ${checked.message}`);
        return NextResponse.json({ ok: true });
      }
      await applyWatchlistRemoval(person, article, checked.check);
      // 012-reader-subscriptions FR-017 / FR-018 — 6. hívási hely, KAPU
      // NÉLKÜL: ez a gombnyomás MAGA a szerkesztői kapu (A1). Kézi
      // eltávolításnál soha nincs auto-publikálási értesítés, tehát ha erre
      // várnánk, ez a szekció sosem riasztana.
      //
      // A kulcs a SZEMÉLY, nem a sor: az applyWatchlistRemoval a personId-ra
      // konfliktál, és a párosított PoliticalResignation sort SZÁNDÉKOSAN
      // nem riasztjuk külön — egy eltávolításról egy üzenet megy ki.
      await recordSubscriberAlert({
        section: 'watchlist_removal',
        entityId: person.id,
        title: person.name,
        detail: person.institution,
      });
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

  // ── 2026-08-30/31 — "Legnagyobb feljelentők"/breaking Social Post Outbox
  // jóváhagyás. code='a' → jóváhagyás ÉS azonnali kipostolás Facebookra
  // (l. postPhotoToPage — ha nincs még FACEBOOK_PAGE_ID/TOKEN beállítva,
  // a sor 'approved' marad, NEM 'failed', hogy egy későbbi retry-vel
  // kimehessen, amint megvan a token). code='r' → elutasítás, nem posztol.
  // code='m'/'mc'/'mi'/'mb'/'mis'/'mid' → "✏️ Módosítás" almenü (user
  // kérés, 2026-08-31): a tényleges szöveg-mentés a fenti szöveges-üzenet
  // ágban történik (pendingEdit mező jelöli, mire vár a bot).
  if (action === 's') {
    if (!id) {
      await answerCallbackQuery(cq.id, 'Érvénytelen gomb.');
      return NextResponse.json({ ok: true });
    }

    if (code === 'm') {
      await answerCallbackQuery(cq.id);
      await sendTelegramMessage('Mit módosítsunk?', {
        inline_keyboard: [
          [{ text: '📝 Szöveg (leírás)', callback_data: `s:mc:${id}` }],
          [{ text: '🖼️ Kép', callback_data: `s:mi:${id}` }],
          [{ text: '🔀 Mindkettő', callback_data: `s:mb:${id}` }],
        ],
      });
      return NextResponse.json({ ok: true });
    }

    if (code === 'mc' || code === 'mb') {
      await getDb().update(schema.socialPostOutbox)
        .set({ pendingEdit: code === 'mb' ? 'both_caption' : 'caption' })
        .where(eq(schema.socialPostOutbox.id, id));
      await answerCallbackQuery(cq.id);
      await sendTelegramMessage('Írd meg üzenetben az új leírás (caption) szövegét.');
      return NextResponse.json({ ok: true });
    }

    if (code === 'mi') {
      await answerCallbackQuery(cq.id);
      await sendTelegramMessage('Mit csináljunk a képpel?', {
        inline_keyboard: [
          [{ text: '✍️ Szöveg a képen', callback_data: `s:mis:${id}` }],
          [{ text: '🎨 Új design', callback_data: `s:mid:${id}` }],
        ],
      });
      return NextResponse.json({ ok: true });
    }

    if (code === 'mis') {
      await getDb().update(schema.socialPostOutbox).set({ pendingEdit: 'image_text' }).where(eq(schema.socialPostOutbox.id, id));
      await answerCallbackQuery(cq.id);
      await sendTelegramMessage('Írd meg üzenetben, milyen szöveg legyen a képen.');
      return NextResponse.json({ ok: true });
    }

    if (code === 'mid') {
      try {
        const rows = await getDb().select().from(schema.socialPostOutbox).where(eq(schema.socialPostOutbox.id, id)).limit(1);
        const row = rows[0];
        if (!row) {
          await answerCallbackQuery(cq.id, 'A poszt-jelölt már nem található.');
          return NextResponse.json({ ok: true });
        }
        const newVariant = row.imageVariant === 'light' ? 'dark' : 'light';
        const newImage = await regenerateOutboxImage({ ...row, imageVariant: newVariant });
        await getDb().update(schema.socialPostOutbox)
          .set({ imagePng: newImage.toString('base64'), imageVariant: newVariant })
          .where(eq(schema.socialPostOutbox.id, id));
        await answerCallbackQuery(cq.id, '🎨 Design frissítve.');
        await sendTelegramPhoto(newImage, `📢 Frissített poszt-jelölt\n\n${row.caption}`, socialApprovalKeyboard(id));
      } catch (err) {
        await answerCallbackQuery(cq.id, 'Hiba történt, próbáld újra.');
        console.error('[telegram-webhook] social-post-outbox design-toggle error', err);
      }
      return NextResponse.json({ ok: true });
    }

    if (code !== 'a' && code !== 'r') {
      await answerCallbackQuery(cq.id, 'Érvénytelen gomb.');
      return NextResponse.json({ ok: true });
    }
    try {
      const rows = await getDb().select().from(schema.socialPostOutbox).where(eq(schema.socialPostOutbox.id, id)).limit(1);
      const outboxRow = rows[0];
      if (!outboxRow) {
        await answerCallbackQuery(cq.id, 'A poszt-jelölt már nem található.');
        return NextResponse.json({ ok: true });
      }

      let resultText: string;
      if (code === 'r') {
        await getDb().update(schema.socialPostOutbox).set({ status: 'rejected' }).where(eq(schema.socialPostOutbox.id, id));
        resultText = '❌ Elutasítva — nem megy ki.';
      } else {
        const imageBuffer = Buffer.from(outboxRow.imagePng, 'base64');
        // user kérés, 2026-08-31: a saját Facebook App-unkon (Graph API,
        // Standard Access) keresztüli posztolás csak azoknak látszik,
        // akiknek szerepük van az App-on — a nyilvános láthatósághoz
        // Advanced Access kellene, ami Business Verificationt igényel
        // (valódi jogi dokumentumot, ami egy be nem jegyzett civil
        // projektnél nincs). Ezért az ELSŐDLEGES posztoló út mostantól a
        // Make.com-on átvezetett, már Advanced Access-es Facebook Pages
        // integráció (l. make-facebook.ts) — ha az nincs beállítva,
        // visszaesünk a régi közvetlen Graph API hívásra (postPhotoToPage).
        const viaMake = await postPhotoViaMake(imageBuffer, outboxRow.caption);
        if (viaMake.ok) {
          await getDb().update(schema.socialPostOutbox)
            .set({ status: 'posted', postedAt: new Date() })
            .where(eq(schema.socialPostOutbox.id, id));
          const pagePublicId = process.env.FACEBOOK_PAGE_PUBLIC_ID;
          const pageLink = pagePublicId ? `\nhttps://www.facebook.com/profile.php?id=${pagePublicId}` : '';
          // A Make-scenario aszinkron dolgozik (pár másodperc), ezért itt
          // nincs azonnali poszt-permalink — csak az Oldal linkje.
          resultText = `✅ Elküldve posztolásra (Make.com-on keresztül) — pár másodpercen belül megjelenik az Oldalon.${pageLink}`;
        } else if (viaMake.notConfigured) {
          // Make nincs beállítva → visszaesés a közvetlen Graph API hívásra.
          const posted = await postPhotoToPage(imageBuffer, outboxRow.caption);
          if (posted.ok) {
            await getDb().update(schema.socialPostOutbox)
              .set({ status: 'posted', externalPostId: posted.postId, postedAt: new Date() })
              .where(eq(schema.socialPostOutbox.id, id));
            resultText = `✅ Kiposztolva a Facebookra.\n${posted.postUrl}`;
          } else if (posted.notConfigured) {
            await getDb().update(schema.socialPostOutbox).set({ status: 'approved' }).where(eq(schema.socialPostOutbox.id, id));
            resultText = '⚠️ Jóváhagyva, de sem a Make.com, sem a közvetlen Facebook-fiók nincs bekötve — amint megvan, kézzel újraküldhető.';
          } else {
            await getDb().update(schema.socialPostOutbox)
              .set({ status: 'failed', failureReason: posted.error })
              .where(eq(schema.socialPostOutbox.id, id));
            resultText = `❌ Hiba a Facebook-posztolásnál: ${posted.error}`;
          }
        } else {
          await getDb().update(schema.socialPostOutbox)
            .set({ status: 'failed', failureReason: viaMake.error })
            .where(eq(schema.socialPostOutbox.id, id));
          resultText = `❌ Hiba a Facebook-posztolásnál (Make.com): ${viaMake.error}`;
        }
      }
      await answerCallbackQuery(cq.id, resultText);
      await editMessageCaption(cq.message.chat.id, cq.message.message_id, `${cq.message.caption ?? ''}\n\n${resultText}`.trim());
    } catch (err) {
      await answerCallbackQuery(cq.id, 'Hiba történt, próbáld újra.');
      console.error('[telegram-webhook] social-post-outbox action error', err);
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
      // 012-reader-subscriptions FR-018 — 4. hívási hely. A jóváhagyással a
      // sor MOST kerül ki az oldalra, tehát most keletkezik a riasztás. Az
      // elutasítás törli a sort, ezért a hozzá tartozó riasztást visszavonja.
      if (action === 'a') await recordAlertsForRecordIds(detectorType, [id]);
      else await revokeSubscriberAlert(detectorType, id);
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
      // 2026-07-24 — a teljes cikktörzset a submission-kori bot-üzenetből
      // (cq.message.text) olvassuk vissza (l. withDetectionBody) — SOSE egy
      // DB-oszlopból (constitution IV — Data Minimization: NewsArticle.body
      // nem tárolható). Ha a marker hiányzik, egyszeri élő újralekérést
      // próbál, biztonsági hálóként.
      const detectArticle = await withDetectionBody(article, cq.message.text);
      const todayIso = new Date().toISOString().slice(0, 10);
      const outcome = await DETECTOR_PROCESSORS[detectorType](detectArticle, todayIso, true);

      if (outcome.status === 'inserted' || outcome.status === 'updated') {
        // FR-018 — 4. hívási hely, near-miss ág: a szerkesztő gombnyomására
        // ÚJ sor keletkezett, tehát riasztunk rá.
        await recordAlertsForRecordIds(detectorType, [outcome.recordId]);
        revalidatePublicPaths();
        resultText = '✅ Jóváhagyva és felvéve.';
        extraNotes = await crossCheckOtherCategories(detectArticle, detectorType);
      } else if (outcome.status === 'inserted_multi') {
        await recordAlertsForRecordIds(detectorType, outcome.recordIds);
        revalidatePublicPaths();
        resultText = `✅ Jóváhagyva — ${outcome.recordIds.length}/${outcome.total} fő felvéve.`;
        extraNotes = await crossCheckOtherCategories(detectArticle, detectorType);
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
