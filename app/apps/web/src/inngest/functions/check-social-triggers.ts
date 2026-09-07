import 'server-only';
import { and, desc, eq, gt, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { renderMilestoneImage, renderBreakingImage, renderSummaryImage } from '@/lib/social-image';
import { milestoneCaption, breakingCaption, summaryCaption } from '@/lib/social-caption';
import { sendTelegramPhoto, type InlineKeyboardMarkup } from '@/lib/telegram';
import { computeComplaintTotal } from '@app/birosagi-iteletek/complaint-stats';
import { computeNextMilestone, formatMilliardLabel } from '@/lib/social-milestone';
import { UGYEK } from '@app/_home/ugyek-config';
import { toAsciiId, autoDisplayTitle, RETIRED_SCANDAL_IDS } from '@app/_home/case-detail-config';
import { listPolls, getPollWithResults } from '@/lib/poll-queries';
import { polishSocialCopy } from '@/lib/social-copy-polish';
import { hookFor, resignationHeadline } from '@/lib/social-copy-variety';
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
 * volt), (3) egy KVÍZ felidézése 2 naponta, (4) egy szavazás LEZÁRÁSAKOR
 * egyszeri végeredmény-poszt. Napi max. TARGET_PER_DAY (3) TÉNYLEGESEN
 * KIPOSTOLT (status='posted') bejegyzés a cél — egy még elbírálatlan vagy
 * elutasított jelölt NEM foglalja a napi keretet (user report, 2026-09-03:
 * egy sose jóváhagyott jelölt tévesen "betelt a nap"-ot eredményezett),
 * ezért egy nap akár 3-nál TÖBB jelölt is kimehet Telegramra, ha korábbiak
 * elutasításra/válasz nélkül maradtak. Ha a ténylegesen kiposztolt
 * darabszám egy napon nem éri el a 3-at, a nap egy rögzített órájában
 * (FALLBACK_HOUR_BUDAPEST) a hiányzó helyeket három tartalék-típus
 * FELVÁLTVA tölti ki (l. buildFallbackTrigger): összesítő statisztika /
 * kiemelt ügy felidézése / galéria-profil felidézése — sose ugyanaz
 * mindig, l. fallbackRotationForToday().
 *
 * 2026-09-07 — user kérés: a korábbi NAPI szavazás-állás poszt
 * (buildPollStatusTriggers, most törölve) unalmas és félrevezető volt
 * (élő szavazatszám egy nappal később már elavult, ráadásul a caption ki
 * se írta, MIRŐL szól a szavazás, és nem hívott szavazásra) — helyette a
 * szavazás státusza 'closed'-ra állításakor EGYSZER kimegy egy záró
 * végeredmény-poszt (l. buildPollFinalResultTrigger). A poll 'closed'-ra
 * állítása MANUÁLIS admin-lépés marad (nincs automatikus lezárási
 * határidő) — l. project-facebook-quiz-poll-revamp memória.
 *
 * SOSEM posztol közvetlenül — mindig SocialPostOutbox sort ír
 * 'pending_approval' státusszal, és egy KÉPES Telegram-üzenetet küld
 * Jóváhagyás/Elutasítás gombokkal (l. telegram/webhook route.ts 's' ág).
 * A caption/headline/detail ALAPJA sablon (social-caption.ts, nincs LLM-
 * hívás rajta) — a user szerint ez "kurva unalmas" volt, DE 2026-09-07-i
 * user döntés: nem akar pluszban fizetni egy LLM-hívásért (sem külön
 * OpenAI-kulcsért, sem a meglévő LangDock-előfizetés terhére), ezért a
 * "sztori jellegű" trigger-típusok (lemondás/megszűnés/ítélet/
 * vagyonvisszaszerzés/feljelentés/kiemelt-ügy-felidézés/kvíz/szavazás-
 * végeredmény) két, EGYMÁSTÓL FÜGGETLEN réteget kapnak:
 *   1) social-copy-variety.ts — ZÉRÓ KÖLTSÉGŰ, kézzel megírt, forgó
 *      "hook"-mondatok (emoji + energikus felvezető sor a caption elején,
 *      + a lemondásnál a headline maga is élőbb: "Név: lemondott!" stb.,
 *      l. resignationHeadline()). Ez fut MINDIG, kulcs nélkül is — ez adja
 *      a napi élő működést.
 *   2) social-copy-polish.ts — OPCIONÁLIS, LLM-alapú továbbfinomítás,
 *      CSAK ha valaha lesz OPENAI_API_KEY (jelenleg NINCS, a user
 *      szándékosan nem kért ilyet, l. fent). Kulcs nélkül néma no-op —
 *      az (1) réteg kimenete megy ki változatlanul. Ha valaha mégis lenne
 *      kulcs, ez tovább finomítaná az (1) réteg már-nem-unalmas szövegét.
 * A link/CTA/hashtag lábjegyzet MINDIG kódból, a fenti rétegek UTÁN kerül
 * rá, hogy egy hallucinált URL (vagy elgépelt tény) sose mehessen ki. A
 * milestone/summary_stats "dashboard" jellegű posztokat (fix számsor, nem
 * történet) szándékosan nem érinti sem az (1), sem a (2) réteg.
 */

const BREAKING_LOOKBACK_HOURS = 2; // órás cron + puffer; a valódi dedup a triggerRefId-egyediség
const TARGET_PER_DAY = 3;
const FALLBACK_HOUR_BUDAPEST = 20; // csak ekkor tölt fel tartalékkal, hogy a nap folyamán a valódi eseményeknek legyen esélyük
const CATALOG_COOLDOWN_DAYS = 60; // ennyi napon belül nem ismétlünk kiemelt ügyet / galéria-profilt
const QUIZ_COOLDOWN_DAYS = 2; // user kérés, 2026-09-07: a kvíz(ek) felidézése kb. 2 naponta egyszer

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

/** Ma (UTC nap-határ — a pontos budapesti éjfél itt nem kritikus) hány
 *  TÉNYLEGESEN kipostolt (status='posted') bejegyzés van. A sapka a valódi
 *  posztokat számolja, NEM a Telegramra kiküldött jelölteket — user report,
 *  2026-09-03: egy még el sem bírált vagy elutasított jelölt ne foglaljon
 *  helyet a napi keretből, amíg ténylegesen ki nem ment. */
async function countTodayQueued(db: ReturnType<typeof getDb>): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.socialPostOutbox)
    .where(and(
      sql`"createdAt" >= date_trunc('day', now())`,
      eq(schema.socialPostOutbox.status, 'posted'),
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
    // "Név: lemondott!" — l. resignationHeadline() fejlécje, miért biztonságos
    // ez a kettőspontos forma tetszőleges névre/intézményre.
    const rawHeadline = resignationHeadline(r.name, r.resignationType);
    const rawDetail = `${r.position}, ${r.institution}`;
    const hookLine = hookFor('resignation', r.id);
    const polished = await polishSocialCopy({ triggerType: 'resignation', headline: rawHeadline, detail: rawDetail });
    const detail = polished.detail ?? rawDetail;
    const image = await renderBreakingImage({ kicker, headline: polished.headline, detail });
    out.push({
      triggerType: 'resignation',
      triggerRefId: r.id,
      milestoneValueFt: null,
      headline: polished.headline,
      caption: breakingCaption(kicker, polished.headline, detail, '/lemondasok/' + r.id, undefined, hookLine),
      imagePng: image,
      imageText: detail,
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
    const hookLine = hookFor('media_closure', m.id);
    const polished = await polishSocialCopy({ triggerType: 'media_closure', headline: m.name, detail: m.description ?? undefined });
    const image = await renderBreakingImage({ kicker, headline: polished.headline, detail: polished.detail });
    out.push({
      triggerType: 'media_closure',
      triggerRefId: m.id,
      milestoneValueFt: null,
      headline: polished.headline,
      caption: breakingCaption(kicker, polished.headline, polished.detail, '/megszunt', undefined, hookLine),
      imagePng: image,
      imageText: polished.detail ?? '',
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
    const rawHeadline = sentence ? `${v.personName}: ${sentence}` : v.personName;
    const rawDetail = v.summary.length > 220 ? v.summary.slice(0, 217) + '…' : v.summary;
    const hookLine = hookFor('court_verdict', v.id);
    const polished = await polishSocialCopy({ triggerType: 'court_verdict', headline: rawHeadline, detail: rawDetail });
    const detail = polished.detail ?? rawDetail;
    const image = await renderBreakingImage({ kicker, headline: polished.headline, detail });
    out.push({
      triggerType: 'court_verdict',
      triggerRefId: v.id,
      milestoneValueFt: null,
      headline: polished.headline,
      caption: breakingCaption(kicker, polished.headline, detail, '/birosagi-iteletek', undefined, hookLine),
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
    const rawHeadline = `${a.caseLabel}: ${formatFtLabel(a.amountFt)}`;
    const hookLine = hookFor('asset_recovery', a.id);
    const polished = await polishSocialCopy({ triggerType: 'asset_recovery', headline: rawHeadline, detail: a.description });
    const detail = polished.detail ?? a.description;
    const image = await renderBreakingImage({ kicker, headline: polished.headline, detail });
    out.push({
      triggerType: 'asset_recovery',
      triggerRefId: a.id,
      milestoneValueFt: null,
      headline: polished.headline,
      caption: breakingCaption(kicker, polished.headline, detail, '/visszaszerzett-vagyon', undefined, hookLine),
      imagePng: image,
      imageText: detail,
      kicker,
    });
  }
  return out;
}

async function buildComplaintTriggers(db: ReturnType<typeof getDb>): Promise<OutboxInsert[]> {
  const since = new Date(Date.now() - BREAKING_LOOKBACK_HOURS * 60 * 60 * 1000);
  const recent = await db
    .select({ id: schema.criminalComplaints.id, targetName: schema.criminalComplaints.targetName, targetEntity: schema.criminalComplaints.targetEntity, filerName: schema.criminalComplaints.filerName, amountLabel: schema.criminalComplaints.amountLabel })
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
    // 2026-09-07 user report: "${filerName} feljelentést tett ${targetName}
    // ellen" élesen értelmetlen mondatot adott ki ("...tett Magyar
    // Fejlesztési Bank 77 milliárdos kötvényvásárlása a Waberer's-től
    // ellen") — a targetName egy szabad szöveges ÜGY-LEÍRÁS (l.
    // criminal-complaint-detect.ts targetName mezőjének doksija), NEM egy
    // önálló főnév, amire az "ellen" névutó ráépíthető. Ha van targetEntity
    // (l. migráció 0060 — a feljelentett fél rövid, önálló neve), az "ellen"
    // forma vele biztonságos és természetesebb; ha nincs (régi sor, vagy
    // "ismeretlen tettes" eset), a kettőspontos forma (mint
    // resignationHeadline() a lemondásoknál) tetszőleges szabad szövegre
    // biztonságos, sose igényel egyeztetést.
    const rawHeadline = c.targetEntity
      ? `${c.filerName} feljelentést tett ${c.targetEntity} ellen`
      : `${c.filerName} feljelentést tett: ${c.targetName}`;
    const rawDetail = c.amountLabel ? `Érintett összeg: ${c.amountLabel}` : undefined;
    const hookLine = hookFor('criminal_complaint', c.id);
    const polished = await polishSocialCopy({ triggerType: 'criminal_complaint', headline: rawHeadline, detail: rawDetail });
    const detail = polished.detail ?? rawDetail;
    const image = await renderBreakingImage({ kicker, headline: polished.headline, detail });
    out.push({
      triggerType: 'criminal_complaint',
      triggerRefId: c.id,
      milestoneValueFt: null,
      headline: polished.headline,
      caption: breakingCaption(kicker, polished.headline, detail, '/birosagi-iteletek', undefined, hookLine),
      imagePng: image,
      imageText: detail ?? '',
      kicker,
    });
  }
  return out;
}

/**
 * Kvíz-felidéző poszt — user kérés, 2026-09-07: "ott van a kvíz, amit lehet
 * nyomni 2 naponta". Globális (nem kvízenkénti) cooldown: ha az utolsó
 * QUIZ_COOLDOWN_DAYS napban ment már kvíz-poszt (bármelyik kvízről), ez a
 * függvény üres tömböt ad, amíg le nem jár. Több kvíz esetén a legrégebben
 * (vagy sose) posztolt kap elsőbbséget, hogy körbeforogjanak, nem csak az
 * első kvíz ismétlődik örökké.
 */
async function buildQuizTriggers(db: ReturnType<typeof getDb>): Promise<OutboxInsert[]> {
  const cooldownSince = new Date(Date.now() - QUIZ_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const [recentRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.socialPostOutbox)
    .where(and(
      eq(schema.socialPostOutbox.triggerType, 'quiz_highlight'),
      gt(schema.socialPostOutbox.createdAt, cooldownSince),
    ));
  if ((recentRow?.c ?? 0) > 0) return [];

  const allQuizzes = await db.select({ id: schema.quizzes.id, slug: schema.quizzes.slug, title: schema.quizzes.title, intro: schema.quizzes.intro }).from(schema.quizzes);
  if (allQuizzes.length === 0) return [];

  const lastPostedRows = await db
    .select({ triggerRefId: schema.socialPostOutbox.triggerRefId, createdAt: schema.socialPostOutbox.createdAt })
    .from(schema.socialPostOutbox)
    .where(eq(schema.socialPostOutbox.triggerType, 'quiz_highlight'))
    .orderBy(desc(schema.socialPostOutbox.createdAt));
  const lastPostedAt = new Map<string, Date>();
  for (const r of lastPostedRows) {
    if (r.triggerRefId && !lastPostedAt.has(r.triggerRefId)) lastPostedAt.set(r.triggerRefId, r.createdAt);
  }
  // Legrégebben posztolt (vagy sose posztolt, ami "legrégebbi") elöl.
  const sorted = [...allQuizzes].sort((a, b) => {
    const at = lastPostedAt.get(a.id)?.getTime() ?? 0;
    const bt = lastPostedAt.get(b.id)?.getTime() ?? 0;
    return at - bt;
  });
  const pick = sorted[0];
  if (!pick) return [];

  const kicker = 'KVÍZ';
  const rawDetail = pick.intro.length > 200 ? pick.intro.slice(0, 197) + '…' : pick.intro;
  const hookLine = hookFor('quiz_highlight', pick.id);
  const polished = await polishSocialCopy({ triggerType: 'quiz_highlight', headline: pick.title, detail: rawDetail });
  const detail = polished.detail ?? rawDetail;
  const image = await renderBreakingImage({ kicker, headline: polished.headline, detail });
  return [{
    triggerType: 'quiz_highlight',
    triggerRefId: pick.id,
    milestoneValueFt: null,
    headline: polished.headline,
    caption: breakingCaption(kicker, polished.headline, detail, `/kviz/${pick.slug}`, '🧠 Töltsd ki, és nézd meg, hányat tudtál!', hookLine),
    imagePng: image,
    imageText: detail,
    kicker,
  }];
}

/**
 * Egyszeri záró végeredmény-poszt, akkor és csak akkor, ha egy szavazás
 * státusza 'closed' — user kérés, 2026-09-07: a korábbi NAPI "napi állás"
 * poszt (l. fájl-fejléc) unalmas volt és nem is mondta ki, miről szól a
 * szavazás, sem hogy szavazzon rá a látvó. A lezárás MANUÁLIS admin-lépés
 * (nincs automatikus dátum-alapú lezárás), ez a trigger csak arra vár, hogy
 * megtörténjen — attól kezdve egyszer, örökre kimegy (a soron következő
 * órás futásban), a triggerRefId a pollQuestions.id-jével dedupolva.
 */
async function buildPollFinalResultTrigger(db: ReturnType<typeof getDb>): Promise<OutboxInsert[]> {
  const allPolls = await listPolls(db);
  const closedPolls = allPolls.filter((p) => p.status === 'closed' && p.totalVotes > 0);
  if (closedPolls.length === 0) return [];

  const alreadyPostedIds = await alreadyPostedRefIds(db, 'poll_final_result');
  const out: OutboxInsert[] = [];
  for (const poll of closedPolls) {
    const [row] = await db
      .select({ id: schema.pollQuestions.id })
      .from(schema.pollQuestions)
      .where(eq(schema.pollQuestions.slug, poll.slug));
    const pollId = row?.id;
    if (!pollId || alreadyPostedIds.has(pollId)) continue;

    const full = await getPollWithResults(db, poll.slug);
    if (!full) continue;
    const top3 = [...full.options].sort((a, b) => b.votes - a.votes).slice(0, 3);

    const kicker = 'SZAVAZÁS EREDMÉNYE';
    const rawHeadline = `Lezárult a szavazás: ${full.question.questionText}`;
    const detailLines = top3.map((o, i) => `${i + 1}. ${o.title} — ${o.sharePct}% (${o.votes} szavazat)`);
    const rawDetail = detailLines.join(' ');
    const hookLine = hookFor('poll_final_result', pollId);
    const polished = await polishSocialCopy({ triggerType: 'poll_final_result', headline: rawHeadline, detail: detailLines });
    const detail = polished.detail ?? rawDetail;
    const image = await renderBreakingImage({ kicker, headline: polished.headline, detail: detailLines });
    out.push({
      triggerType: 'poll_final_result',
      triggerRefId: pollId,
      milestoneValueFt: null,
      headline: polished.headline,
      caption: breakingCaption(kicker, polished.headline, detail, `/szavazas/${poll.slug}`, `👉 Összesen ${full.totalVotes} szavazat érkezett — nézd meg a teljes eredményt!`, hookLine),
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
  const rawDetail = pick.summary.length > 220 ? pick.summary.slice(0, 217) + '…' : pick.summary;
  const hookLine = hookFor('catalog_highlight', pick.id);
  const polished = await polishSocialCopy({ triggerType: 'catalog_highlight', headline: pick.title, detail: rawDetail });
  const detail = polished.detail ?? rawDetail;
  const image = await renderBreakingImage({ kicker, headline: polished.headline, detail });
  return {
    triggerType: 'catalog_highlight',
    triggerRefId: pick.id,
    milestoneValueFt: null,
    headline: polished.headline,
    caption: breakingCaption(kicker, polished.headline, detail, `/ugyek/${pick.id}`, undefined, hookLine),
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
  const rawHeadline = autoDisplayTitle(pick.name, pick.person) || pick.name;
  const detailParts = [pick.summary ?? ''];
  if (pick.damageHuf) {
    const dmg = BigInt(pick.damageHuf);
    if (dmg > 0n) detailParts.push(`Érintett összeg: ${formatFtLabel(dmg)}`);
  }
  const detail = detailParts.filter(Boolean).join(' — ');
  const trimmedDetail = detail.length > 220 ? detail.slice(0, 217) + '…' : detail;
  const hookLine = hookFor('gallery_highlight', pick.id);
  const polished = await polishSocialCopy({ triggerType: 'gallery_highlight', headline: rawHeadline, detail: trimmedDetail });
  const polishedDetail = polished.detail ?? trimmedDetail;
  const image = await renderBreakingImage({ kicker, headline: polished.headline, detail: polishedDetail });
  return {
    triggerType: 'gallery_highlight',
    triggerRefId: pick.id,
    milestoneValueFt: null,
    headline: polished.headline,
    caption: breakingCaption(kicker, polished.headline, polishedDetail, `/adatbazis/${toAsciiId(pick.id)}`, undefined, hookLine),
    imagePng: image,
    imageText: polishedDetail,
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
  candidates.push(...(await step.run('check-quiz', () => buildQuizTriggers(db))));
  candidates.push(...(await step.run('check-poll-final-result', () => buildPollFinalResultTrigger(db))));

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
