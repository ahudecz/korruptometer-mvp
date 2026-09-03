import 'server-only';
import { and, desc, eq, gt, ne, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { renderMilestoneImage, renderBreakingImage, renderSummaryImage } from '@/lib/social-image';
import { milestoneCaption, breakingCaption, summaryCaption } from '@/lib/social-caption';
import { sendTelegramPhoto, type InlineKeyboardMarkup } from '@/lib/telegram';
import { computeComplaintTotal } from '@app/birosagi-iteletek/complaint-stats';
import { computeNextMilestone, formatMilliardLabel } from '@/lib/social-milestone';
import { UGYEK } from '@app/_home/ugyek-config';
import { toAsciiId, autoDisplayTitle, RETIRED_SCANDAL_IDS } from '@app/_home/case-detail-config';
import { listPolls, getPollWithResults } from '@/lib/poll-queries';
import type { BypassStep, BypassLogger } from '@/lib/cron-bypass';

/**
 * check.social-triggers — óránként (GitHub Actions,
 * ../../.github/workflows/hourly-social-triggers.yml, monorepo gyökér).
 *
 * user kérés, 2026-08-30, kibővítve 2026-09-03: automatikus, Telegram-
 * jóváhagyás mögötti Facebook-posztok (1) a feljelentési összeg minden
 * +1000 milliárdos mérföldkövénél, (2) friss breaking eseményeknél (BÁRMELY
 * jóváhagyott lemondás/megszűnés/ítélet/vagyonvisszaszerzés/feljelentés,
 * NEM csak WATCH_LIST — user kérés 2026-09-03, korábban itt watchlist-szűrés
 * volt), (3) aktív szavazás napi állásáról. Napi max. TARGET_PER_DAY (3)
 * poszt-jelölt kerül Telegramra — ha ennyi friss esemény nincs egy napon,
 * a nap egy rögzített órájában (FALLBACK_HOUR_BUDAPEST) a hiányzó helyeket
 * három tartalék-típus FELVÁLTVA tölti ki (l. buildFallbackTrigger):
 * összesítő statisztika / kiemelt ügy felidézése / galéria-profil
 * felidézése — sose ugyanaz mindig, l. fallbackRotationForToday().
 *
 * SOSEM posztol közvetlenül — mindig SocialPostOutbox sort ír
 * 'pending_approval' státusszal, és egy KÉPES Telegram-üzenetet küld
 * Jóváhagyás/Elutasítás gombokkal (l. telegram/webhook route.ts 's' ág).
 * Nincs LLM-hívás (sablon-alapú caption, l. social-caption.ts) — a napi
 * Anthropic-keretre nulla hatással van.
 */

const BREAKING_LOOKBACK_HOURS = 2; // órás cron + puffer; a valódi dedup a triggerRefId-egyediség
const TARGET_PER_DAY = 3;
const FALLBACK_HOUR_BUDAPEST = 20; // csak ekkor tölt fel tartalékkal, hogy a nap folyamán a valódi eseményeknek legyen esélyük
const CATALOG_COOLDOWN_DAYS = 60; // ennyi napon belül nem ismétlünk kiemelt ügyet / galéria-profilt

type OutboxInsert = {
  triggerType: string;
  triggerRefId: string | null;
  milestoneValueFt: bigint | null;
  headline: string;
  caption: string;
  imagePng: Buffer;
  imageText: string; // a képre írt, "✏️ Módosítás"-sal szerkeszthető szöveg (subline/detail) — summary_stats-nál JSON.stringify(stats)
  kicker: string | null; // csak breaking-típusoknál — l. schema.ts komment
};

function budapestHour(d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', hour: '2-digit', hour12: false }).format(d));
}

function formatFtLabel(amountFt: bigint): string {
  if (amountFt <= 0n) return '0 Ft';
  const mrd = amountFt / 1_000_000_000n;
  if (mrd > 0n) return `${mrd} milliárd Ft`;
  const m = amountFt / 1_000_000n;
  if (m > 0n) return `${m} millió Ft`;
  return `${amountFt} Ft`;
}

async function alreadyPostedRefIds(db: ReturnType<typeof getDb>, triggerType: string): Promise<Set<string>> {
  const rows = await db
    .select({ triggerRefId: schema.socialPostOutbox.triggerRefId })
    .from(schema.socialPostOutbox)
    .where(eq(schema.socialPostOutbox.triggerType, triggerType));
  return new Set(rows.map((r) => r.triggerRefId).filter((v): v is string => v !== null));
}

/** Ma (UTC nap-határ — a pontos budapesti éjfél itt nem kritikus) hány,
 *  nem elutasított jelölt ment már ki Telegramra. Ez a napi TARGET_PER_DAY
 *  sapka alapja. */
async function countTodayQueued(db: ReturnType<typeof getDb>): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.socialPostOutbox)
    .where(and(
      sql`"createdAt" >= date_trunc('day', now())`,
      ne(schema.socialPostOutbox.status, 'rejected'),
    ));
  return row?.c ?? 0;
}

async function buildMilestoneTrigger(db: ReturnType<typeof getDb>): Promise<OutboxInsert | null> {
  const rows = await db.select({ amountLabel: schema.criminalComplaints.amountLabel }).from(schema.criminalComplaints);
  const total = computeComplaintTotal(rows);

  // A státusztól FÜGGETLENÜL számít, ha egy küszöbérték már egyszer sorba
  // került — egy kézzel elutasított mérföldkövet ne kérdezzünk meg minden
  // órában újra (2026-08-30, saját QA közben derült ki).
  const [lastRow] = await db
    .select({ maxVal: sql<string>`COALESCE(MAX("milestoneValueFt"), 0)` })
    .from(schema.socialPostOutbox)
    .where(eq(schema.socialPostOutbox.triggerType, 'complaint_milestone'));
  const lastMax = lastRow ? BigInt(lastRow.maxVal) : 0n;

  const currentThreshold = computeNextMilestone(total, lastMax);
  if (currentThreshold === null) return null;

  const amountLabel = formatMilliardLabel(currentThreshold);
  const subline = 'NER-hez és államigazgatáshoz köthető feljelentések összértéke';
  const image = await renderMilestoneImage({ amountLabel, subline });
  return {
    triggerType: 'complaint_milestone',
    triggerRefId: null,
    milestoneValueFt: currentThreshold,
    headline: `Mérföldkő: ${amountLabel}`,
    caption: milestoneCaption(amountLabel),
    imagePng: image,
    imageText: subline,
    kicker: null,
  };
}

const RESIGNATION_KICKERS: Record<string, string> = {
  'lemondás': 'LEMONDÁS', 'kirúgás': 'KIRÚGÁS', 'felmentés': 'FELMENTÉS', 'visszahívás': 'VISSZAHÍVÁS',
};

async function buildResignationTriggers(db: ReturnType<typeof getDb>): Promise<OutboxInsert[]> {
  const since = new Date(Date.now() - BREAKING_LOOKBACK_HOURS * 60 * 60 * 1000);
  const recent = await db
    .select({ id: schema.politicalResignations.id, name: schema.politicalResignations.name, institution: schema.politicalResignations.institution, position: schema.politicalResignations.position, resignationType: schema.politicalResignations.resignationType })
    .from(schema.politicalResignations)
    .where(and(
      eq(schema.politicalResignations.reviewStatus, 'approved'),
      gt(schema.politicalResignations.createdAt, since),
    ))
    .orderBy(desc(schema.politicalResignations.createdAt));
  if (recent.length === 0) return [];

  const alreadyPostedIds = await alreadyPostedRefIds(db, 'resignation');
  const out: OutboxInsert[] = [];
  for (const r of recent) {
    if (alreadyPostedIds.has(r.id)) continue;
    // user kérés, 2026-09-03: nem csak WATCH_LIST — minden jóváhagyott
    // lemondás/kirúgás poszt-jelölt, hogy legyen elég napi alapanyag.
    const kicker = RESIGNATION_KICKERS[r.resignationType] ?? 'TÁVOZÁS';
    const headline = `${r.name} távozott: ${r.position}, ${r.institution}`;
    const image = await renderBreakingImage({ kicker, headline });
    out.push({
      triggerType: 'resignation',
      triggerRefId: r.id,
      milestoneValueFt: null,
      headline,
      caption: breakingCaption(kicker, headline, undefined, '/lemondasok/' + r.id),
      imagePng: image,
      imageText: '',
      kicker,
    });
  }
  return out;
}

const MEDIA_CLOSURE_KICKERS: Record<string, string> = {
  'megszűnés': 'MEGSZŰNÉS', 'leépítés': 'LEÉPÍTÉS', 'elmaradt esemény': 'ELMARADT ESEMÉNY', 'egyéb': 'MÉDIA-HÍR',
};

async function buildMediaClosureTriggers(db: ReturnType<typeof getDb>): Promise<OutboxInsert[]> {
  const since = new Date(Date.now() - BREAKING_LOOKBACK_HOURS * 60 * 60 * 1000);
  const recent = await db
    .select({ id: schema.mediaClosures.id, name: schema.mediaClosures.name, eventType: schema.mediaClosures.eventType, description: schema.mediaClosures.description })
    .from(schema.mediaClosures)
    .where(and(
      eq(schema.mediaClosures.reviewStatus, 'approved'),
      gt(schema.mediaClosures.createdAt, since),
    ))
    .orderBy(desc(schema.mediaClosures.createdAt));
  if (recent.length === 0) return [];

  const alreadyPostedIds = await alreadyPostedRefIds(db, 'media_closure');
  const out: OutboxInsert[] = [];
  for (const m of recent) {
    if (alreadyPostedIds.has(m.id)) continue;
    const kicker = MEDIA_CLOSURE_KICKERS[m.eventType] ?? 'MÉDIA-HÍR';
    const headline = m.name;
    const image = await renderBreakingImage({ kicker, headline, detail: m.description ?? undefined });
    out.push({
      triggerType: 'media_closure',
      triggerRefId: m.id,
      milestoneValueFt: null,
      headline,
      caption: breakingCaption(kicker, headline, m.description ?? undefined, '/megszunt'),
      imagePng: image,
      imageText: m.description ?? '',
      kicker,
    });
  }
  return out;
}

async function buildCourtVerdictTriggers(db: ReturnType<typeof getDb>): Promise<OutboxInsert[]> {
  const since = new Date(Date.now() - BREAKING_LOOKBACK_HOURS * 60 * 60 * 1000);
  const recent = await db
    .select({ id: schema.courtVerdicts.id, personName: schema.courtVerdicts.personName, sentenceLabel: schema.courtVerdicts.sentenceLabel, sentenceYears: schema.courtVerdicts.sentenceYears, summary: schema.courtVerdicts.summary })
    .from(schema.courtVerdicts)
    .where(and(
      eq(schema.courtVerdicts.reviewStatus, 'approved'),
      gt(schema.courtVerdicts.createdAt, since),
    ))
    .orderBy(desc(schema.courtVerdicts.createdAt));
  if (recent.length === 0) return [];

  const alreadyPostedIds = await alreadyPostedRefIds(db, 'court_verdict');
  const out: OutboxInsert[] = [];
  for (const v of recent) {
    if (alreadyPostedIds.has(v.id)) continue;
    const kicker = 'ÍTÉLET';
    const sentence = v.sentenceLabel ?? (v.sentenceYears > 0 ? `${v.sentenceYears} év` : null);
    const headline = sentence ? `${v.personName}: ${sentence}` : v.personName;
    const detail = v.summary.length > 220 ? v.summary.slice(0, 217) + '…' : v.summary;
    const image = await renderBreakingImage({ kicker, headline, detail });
    out.push({
      triggerType: 'court_verdict',
      triggerRefId: v.id,
      milestoneValueFt: null,
      headline,
      caption: breakingCaption(kicker, headline, detail, '/birosagi-iteletek'),
      imagePng: image,
      imageText: detail,
      kicker,
    });
  }
  return out;
}

async function buildAssetRecoveryTriggers(db: ReturnType<typeof getDb>): Promise<OutboxInsert[]> {
  const since = new Date(Date.now() - BREAKING_LOOKBACK_HOURS * 60 * 60 * 1000);
  // Nincs reviewStatus oszlopa — l. schema.ts, minden sor közvetlen írással kerül be.
  const recent = await db
    .select({ id: schema.assetRecoveries.id, caseLabel: schema.assetRecoveries.caseLabel, description: schema.assetRecoveries.description, amountFt: schema.assetRecoveries.amountFt })
    .from(schema.assetRecoveries)
    .where(gt(schema.assetRecoveries.createdAt, since))
    .orderBy(desc(schema.assetRecoveries.createdAt));
  if (recent.length === 0) return [];

  const alreadyPostedIds = await alreadyPostedRefIds(db, 'asset_recovery');
  const out: OutboxInsert[] = [];
  for (const a of recent) {
    if (alreadyPostedIds.has(a.id)) continue;
    const kicker = 'VAGYONVISSZASZERZÉS';
    const headline = `${a.caseLabel}: ${formatFtLabel(a.amountFt)}`;
    const image = await renderBreakingImage({ kicker, headline, detail: a.description });
    out.push({
      triggerType: 'asset_recovery',
      triggerRefId: a.id,
      milestoneValueFt: null,
      headline,
      caption: breakingCaption(kicker, headline, a.description, '/visszaszerzett-vagyon'),
      imagePng: image,
      imageText: a.description,
      kicker,
    });
  }
  return out;
}

async function buildComplaintTriggers(db: ReturnType<typeof getDb>): Promise<OutboxInsert[]> {
  const since = new Date(Date.now() - BREAKING_LOOKBACK_HOURS * 60 * 60 * 1000);
  const recent = await db
    .select({ id: schema.criminalComplaints.id, targetName: schema.criminalComplaints.targetName, filerName: schema.criminalComplaints.filerName, amountLabel: schema.criminalComplaints.amountLabel })
    .from(schema.criminalComplaints)
    .where(and(
      eq(schema.criminalComplaints.reviewStatus, 'approved'),
      gt(schema.criminalComplaints.createdAt, since),
    ))
    .orderBy(desc(schema.criminalComplaints.createdAt));
  if (recent.length === 0) return [];

  const alreadyPostedIds = await alreadyPostedRefIds(db, 'criminal_complaint');
  const out: OutboxInsert[] = [];
  for (const c of recent) {
    if (alreadyPostedIds.has(c.id)) continue;
    const kicker = 'FELJELENTÉS';
    const headline = `${c.filerName} feljelentést tett ${c.targetName} ellen`;
    const detail = c.amountLabel ? `Érintett összeg: ${c.amountLabel}` : undefined;
    const image = await renderBreakingImage({ kicker, headline, detail });
    out.push({
      triggerType: 'criminal_complaint',
      triggerRefId: c.id,
      milestoneValueFt: null,
      headline,
      caption: breakingCaption(kicker, headline, detail, '/birosagi-iteletek'),
      imagePng: image,
      imageText: detail ?? '',
      kicker,
    });
  }
  return out;
}

/** Aktív szavazás(ok) napi állása — max 1 poszt/szavazás/nap (mai dátumra
 *  ellenőrizve, l. lent). Az élő eredmény-lekérdezést a poll-queries.ts
 *  (a /szavazas oldal saját forrása) adja, hogy ne duplikáljunk join-logikát. */
async function buildPollStatusTriggers(db: ReturnType<typeof getDb>): Promise<OutboxInsert[]> {
  const allPolls = await listPolls(db);
  const openPolls = allPolls.filter((p) => p.status === 'open' && p.totalVotes > 0);
  if (openPolls.length === 0) return [];

  const out: OutboxInsert[] = [];
  for (const poll of openPolls) {
    const [postedTodayRow] = await db
      .select({ id: schema.pollQuestions.id })
      .from(schema.pollQuestions)
      .where(eq(schema.pollQuestions.slug, poll.slug));
    const pollId = postedTodayRow?.id;
    if (!pollId) continue;

    const [alreadyToday] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.socialPostOutbox)
      .where(and(
        eq(schema.socialPostOutbox.triggerType, 'poll_status'),
        eq(schema.socialPostOutbox.triggerRefId, pollId),
        sql`"createdAt" >= date_trunc('day', now())`,
      ));
    if ((alreadyToday?.c ?? 0) > 0) continue; // ma már ment erről a szavazásról

    const full = await getPollWithResults(db, poll.slug);
    if (!full) continue;
    const top3 = [...full.options].sort((a, b) => b.votes - a.votes).slice(0, 3);

    const kicker = 'SZAVAZÁS';
    const headline = `Már ${full.totalVotes} szavazat érkezett — itt a jelenlegi állás`;
    const detailLines = top3.map((o, i) => `${i + 1}. ${o.title} (${o.votes})`);
    const detail = detailLines.join('\n'); // imageText-be flat sztringként megy, l. regenerateOutboxImage split()-je
    const image = await renderBreakingImage({ kicker, headline, detail: detailLines });
    out.push({
      triggerType: 'poll_status',
      triggerRefId: pollId,
      milestoneValueFt: null,
      headline,
      caption: breakingCaption(kicker, headline, detail, `/szavazas/${poll.slug}`, '👉 Szavazz te is, ha még nem tetted!'),
      imagePng: image,
      imageText: detail,
      kicker,
    });
  }
  return out;
}

// ─── Tartalék-posztok (csak ha egy napra nincs elég friss esemény) ────────

async function buildSummaryStatsTrigger(db: ReturnType<typeof getDb>): Promise<OutboxInsert | null> {
  const [[resignationCount], [closureCount], [complaintCount], [verdictCount], [recoverySum]] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(schema.politicalResignations).where(eq(schema.politicalResignations.reviewStatus, 'approved')),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.mediaClosures).where(eq(schema.mediaClosures.reviewStatus, 'approved')),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.criminalComplaints).where(eq(schema.criminalComplaints.reviewStatus, 'approved')),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.courtVerdicts).where(eq(schema.courtVerdicts.reviewStatus, 'approved')),
    db.select({ s: sql<string>`COALESCE(SUM("amountFt"), 0)` }).from(schema.assetRecoveries),
  ]);

  const stats = [
    { label: 'lemondás / kirúgás / felmentés eddig', value: String(resignationCount?.c ?? 0) },
    { label: 'megszűnt médium', value: String(closureCount?.c ?? 0) },
    { label: 'feljelentés a nyilvántartásban', value: String(complaintCount?.c ?? 0) },
    { label: 'jogerős/elsőfokú ítélet', value: String(verdictCount?.c ?? 0) },
  ];
  const recoveredFt = recoverySum?.s ? BigInt(recoverySum.s) : 0n;
  if (recoveredFt > 0n) {
    stats.push({ label: 'visszaszerzett vagyon', value: formatFtLabel(recoveredFt) });
  }

  const lines = stats.map((s) => `• ${s.value} ${s.label}`);
  const image = await renderSummaryImage({ stats });
  return {
    triggerType: 'summary_stats',
    triggerRefId: null,
    milestoneValueFt: null,
    headline: 'Eddig a Kegyencjáraton',
    caption: summaryCaption(lines, '/adatbazis'),
    imagePng: image,
    imageText: JSON.stringify(stats),
    kicker: null,
  };
}

async function buildCatalogHighlightTrigger(db: ReturnType<typeof getDb>): Promise<OutboxInsert | null> {
  const cooldownSince = new Date(Date.now() - CATALOG_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const recentlyPosted = await db
    .select({ triggerRefId: schema.socialPostOutbox.triggerRefId })
    .from(schema.socialPostOutbox)
    .where(and(
      eq(schema.socialPostOutbox.triggerType, 'catalog_highlight'),
      gt(schema.socialPostOutbox.createdAt, cooldownSince),
    ));
  const recentIds = new Set(recentlyPosted.map((r) => r.triggerRefId));

  const candidates = UGYEK.filter((u) => !recentIds.has(u.id) && u.summary);
  const pool = candidates.length > 0 ? candidates : UGYEK.filter((u) => u.summary);
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick) return null;

  const kicker = 'KIEMELT ÜGY';
  const headline = pick.title;
  const detail = pick.summary.length > 220 ? pick.summary.slice(0, 217) + '…' : pick.summary;
  const image = await renderBreakingImage({ kicker, headline, detail });
  return {
    triggerType: 'catalog_highlight',
    triggerRefId: pick.id,
    milestoneValueFt: null,
    headline,
    caption: breakingCaption(kicker, headline, detail, `/ugyek/${pick.id}`),
    imagePng: image,
    imageText: detail,
    kicker,
  };
}

type ScandalCatalogRow = { id: string; name: string; person: string | null; institution: string | null; summary: string | null; damageHuf: string | null };

/** A `/adatbazis/[id]` NEM a Drizzle `cases` ("Case") táblát olvassa —
 *  hanem egy Drizzle-en kívüli, csak nyers SQL-lel elért "ScandalCatalog"
 *  táblát (l. adatbazis/[id]/page.tsx). Korábban itt tévedésből a `cases`
 *  táblából választottunk, ami garantált 404-hez vezetett (user report,
 *  2026-09-03: "K. Zoltán", kamunak tűnő, linkje 404). Ugyanazokat az
 *  oszlopokat kérdezzük, mint a valódi oldal, hogy a link biztosan éljen. */
async function buildGalleryHighlightTrigger(db: ReturnType<typeof getDb>): Promise<OutboxInsert | null> {
  const cooldownSince = new Date(Date.now() - CATALOG_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const recentlyPosted = await db
    .select({ triggerRefId: schema.socialPostOutbox.triggerRefId })
    .from(schema.socialPostOutbox)
    .where(and(
      eq(schema.socialPostOutbox.triggerType, 'gallery_highlight'),
      gt(schema.socialPostOutbox.createdAt, cooldownSince),
    ));
  const recentIds = new Set(recentlyPosted.map((r) => r.triggerRefId).filter((v): v is string => v !== null));
  const excludeIds = [...recentIds, ...RETIRED_SCANDAL_IDS];

  const rows = (await db.execute(sql`
    SELECT sc.id, sc.name, sc.person, sc.institution, sc.summary, sc.damage_huf AS "damageHuf"
    FROM "ScandalCatalog" sc
    WHERE sc.summary IS NOT NULL AND length(trim(sc.summary)) > 0
      AND sc.id NOT IN (${sql.join(excludeIds.length > 0 ? excludeIds.map((v) => sql`${v}`) : [sql`''`], sql`, `)})
  `)) as unknown as ScandalCatalogRow[];

  let pool = rows;
  if (pool.length === 0) {
    // Ha a cooldown mindent kizárt, essünk vissza a teljes (RETIRED nélküli) készletre.
    const fallbackRows = (await db.execute(sql`
      SELECT sc.id, sc.name, sc.person, sc.institution, sc.summary, sc.damage_huf AS "damageHuf"
      FROM "ScandalCatalog" sc
      WHERE sc.summary IS NOT NULL AND length(trim(sc.summary)) > 0
        AND sc.id NOT IN (${sql.join(RETIRED_SCANDAL_IDS.length > 0 ? RETIRED_SCANDAL_IDS.map((v) => sql`${v}`) : [sql`''`], sql`, `)})
    `)) as unknown as ScandalCatalogRow[];
    pool = fallbackRows;
  }
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick) return null;

  const kicker = 'ADATBÁZIS';
  const headline = autoDisplayTitle(pick.name, pick.person) || pick.name;
  const detailParts = [pick.summary ?? ''];
  if (pick.damageHuf) {
    const dmg = BigInt(pick.damageHuf);
    if (dmg > 0n) detailParts.push(`Érintett összeg: ${formatFtLabel(dmg)}`);
  }
  const detail = detailParts.filter(Boolean).join(' — ');
  const trimmedDetail = detail.length > 220 ? detail.slice(0, 217) + '…' : detail;
  const image = await renderBreakingImage({ kicker, headline, detail: trimmedDetail });
  return {
    triggerType: 'gallery_highlight',
    triggerRefId: pick.id,
    milestoneValueFt: null,
    headline,
    caption: breakingCaption(kicker, headline, trimmedDetail, `/adatbazis/${toAsciiId(pick.id)}`),
    imagePng: image,
    imageText: trimmedDetail,
    kicker,
  };
}

type FallbackKind = 'summary_stats' | 'catalog_highlight' | 'gallery_highlight';

/** Napi rotáció, hogy ne mindig ugyanaz a tartalék-típus menjen ki elsőnek —
 *  user kérés, 2026-09-03: "mindahárom, váltogatva". */
function fallbackRotationForToday(): FallbackKind[] {
  const order: FallbackKind[] = ['summary_stats', 'catalog_highlight', 'gallery_highlight'];
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % order.length;
  return [...order.slice(dayIndex), ...order.slice(0, dayIndex)];
}

async function buildFallbackTrigger(kind: FallbackKind, db: ReturnType<typeof getDb>): Promise<OutboxInsert | null> {
  if (kind === 'summary_stats') return buildSummaryStatsTrigger(db);
  if (kind === 'catalog_highlight') return buildCatalogHighlightTrigger(db);
  return buildGalleryHighlightTrigger(db);
}

export function approvalKeyboard(outboxId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '✅ Közzététel (Facebook)', callback_data: `s:a:${outboxId}` }],
      [
        { text: '✏️ Módosítás', callback_data: `s:m:${outboxId}` },
        { text: '❌ Elutasítás', callback_data: `s:r:${outboxId}` },
      ],
    ],
  };
}

export async function runSocialTriggersCore({
  step,
  logger,
}: {
  step: BypassStep;
  logger?: BypassLogger;
}) {
  const db = getDb();

  const todayCount = await step.run('count-today-queued', () => countTodayQueued(db));
  let remaining = TARGET_PER_DAY - todayCount;
  if (remaining <= 0) {
    logger?.info?.(`check-social-triggers: napi sapka (${TARGET_PER_DAY}) már elérve, kihagyva`);
    return { candidates: 0, queued: 0 };
  }

  const candidates: OutboxInsert[] = [];
  const milestone = await step.run('check-milestone', () => buildMilestoneTrigger(db));
  if (milestone) candidates.push(milestone);
  candidates.push(...(await step.run('check-resignations', () => buildResignationTriggers(db))));
  candidates.push(...(await step.run('check-media-closures', () => buildMediaClosureTriggers(db))));
  candidates.push(...(await step.run('check-verdicts', () => buildCourtVerdictTriggers(db))));
  candidates.push(...(await step.run('check-asset-recoveries', () => buildAssetRecoveryTriggers(db))));
  candidates.push(...(await step.run('check-complaints', () => buildComplaintTriggers(db))));
  candidates.push(...(await step.run('check-poll-status', () => buildPollStatusTriggers(db))));

  const selected = candidates.slice(0, remaining);
  remaining -= selected.length;

  // Tartalék csak egy rögzített napi órában lép be, hogy a nap folyamán a
  // valódi eseményeknek legyen esélyük betölteni a napi kvótát — l. fájl
  // fejléce.
  if (remaining > 0 && budapestHour() === FALLBACK_HOUR_BUDAPEST) {
    const rotation = await step.run('fallback-rotation', () => Promise.resolve(fallbackRotationForToday()));
    for (const kind of rotation) {
      if (remaining <= 0) break;
      const built = await step.run(`fallback-${kind}`, () => buildFallbackTrigger(kind, db));
      if (built) {
        selected.push(built);
        remaining--;
      }
    }
  }

  let queued = 0;
  for (const c of selected) {
    await step.run(`queue-${c.triggerType}-${c.triggerRefId ?? c.milestoneValueFt ?? Math.random()}`, async () => {
      const [inserted] = await db
        .insert(schema.socialPostOutbox)
        .values({
          triggerType: c.triggerType,
          triggerRefId: c.triggerRefId,
          milestoneValueFt: c.milestoneValueFt,
          headline: c.headline,
          caption: c.caption,
          imagePng: c.imagePng.toString('base64'),
          imageText: c.imageText,
          kicker: c.kicker,
          status: 'pending_approval',
        })
        .returning({ id: schema.socialPostOutbox.id });
      if (!inserted) return;

      const messageId = await sendTelegramPhoto(
        c.imagePng,
        `📢 Új Facebook-poszt-jelölt\n\n${c.caption}`,
        approvalKeyboard(inserted.id),
      );
      if (messageId) {
        await db.update(schema.socialPostOutbox).set({ telegramMessageId: messageId }).where(eq(schema.socialPostOutbox.id, inserted.id));
      }
      queued++;
    });
  }

  logger?.info?.(`check-social-triggers: candidates=${candidates.length} selected=${selected.length} queued=${queued}`);
  return { candidates: candidates.length, queued };
}
