import 'server-only';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { answerCallbackQuery, editMessageReplyMarkup, sendTelegramMessage, type InlineKeyboardMarkup } from '@/lib/telegram';
import { DETECTOR_PROCESSORS, type ArticleForReprocess } from '@/lib/telegram-review-actions';
import type { DetectorType } from '@korr/db';
import { canonicalUrl, dedupHash, fetchPrimaryArticle, getAdapter, routeOutletByUrl } from '@korr/scrapers';

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
};

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
  { label: '📴 Megszűnés', callbackData: (id) => `a:m:${id}` },
  { label: '⚖️ Bírósági ítélet', callbackData: (id) => `a:c:${id}` },
  { label: '💰 Vagyonvisszaszerzés', callbackData: (id) => `a:x:${id}` },
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
    }
    return;
  }
  if (detectorType === 'resignation') {
    await getDb().update(schema.politicalResignations).set({ reviewStatus: 'approved', updatedAt: new Date() }).where(eq(schema.politicalResignations.id, id));
  } else if (detectorType === 'media_closure') {
    await getDb().update(schema.mediaClosures).set({ reviewStatus: 'approved', updatedAt: new Date() }).where(eq(schema.mediaClosures.id, id));
  } else if (detectorType === 'court_verdict') {
    await getDb().update(schema.courtVerdicts).set({ reviewStatus: 'approved', updatedAt: new Date() }).where(eq(schema.courtVerdicts.id, id));
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

function revalidatePublicPaths() {
  revalidatePath('/');
  revalidatePath('/hirek');
  revalidatePath('/lemondasok');
  revalidatePath('/megszunt');
  revalidatePath('/birosagi-iteletek');
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

    const url = msg.text ? firstUrl(msg.text) : null;
    if (!url) {
      return NextResponse.json({ ok: true }); // nincs URL a szövegben — nem érdekel minket
    }

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
          await getDb().delete(schema.watchlistRemovals).where(eq(schema.watchlistRemovals.id, id));
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
