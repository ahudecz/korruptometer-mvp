import 'server-only';
import { and, desc, eq, gt, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { renderMilestoneImage, renderBreakingImage, renderSummaryImage } from '@/lib/social-image';
import { milestoneCaption, breakingCaption, summaryCaption, resignationLinkPath } from '@/lib/social-caption';
import { sendTelegramPhoto, type InlineKeyboardMarkup } from '@/lib/telegram';
import { computeComplaintTotal } from '@app/birosagi-iteletek/complaint-stats';
import { computeNextMilestone, formatMilliardLabel } from '@/lib/social-milestone';
import { UGYEK } from '@app/_home/ugyek-config';
import { toAsciiId, autoDisplayTitle, RETIRED_SCANDAL_IDS } from '@app/_home/case-detail-config';
import { listPolls, getPollWithResults } from '@/lib/poll-queries';
import {
  hookFor,
  resignationHeadline,
  complaintHeadline,
  truncateAtWordBoundary,
  fitCompleteSentences,
  IMAGE_DETAIL_MAX_CHARS,
  telegramPreview,
} from '@/lib/social-copy-variety';
import {
  EVENT_LOOKBACK_HOURS,
  MIN_CASE_DAMAGE_FT,

  checkPostGate,
  fallbackKindsForRun,
  isPlaceholderSummary,
  parseHungarianFtAmount,
  selectQueueBatch,
  type FallbackKind,
} from '@/lib/social-post-policy';
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
 * volt), (3) egy KVÍZ felidézése kb. 2 naponta, (4) egy szavazás LEZÁRÁSAKOR
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
 * 2026-09-09 — user kérés (hotfix a régi napi szavazás-állás poszt ellen,
 * l. project-facebook-quiz-poll-revamp memória): a korábbi NAPI
 * szavazás-állás poszt (buildPollStatusTriggers, most törölve) unalmas és
 * félrevezető volt (élő szavazatszám egy nappal később már elavult, a
 * caption ki se írta MIRŐL szól a szavazás, és nem hívott szavazásra) —
 * helyette a szavazás státusza 'closed'-ra állításakor EGYSZER kimegy egy
 * záró végeredmény-poszt (l. buildPollFinalResultTrigger). A poll
 * 'closed'-ra állítása MANUÁLIS admin-lépés marad (nincs automatikus
 * lezárási határidő).
 *
 * SOSEM posztol közvetlenül — mindig SocialPostOutbox sort ír
 * 'pending_approval' státusszal, és egy KÉPES Telegram-üzenetet küld
 * Jóváhagyás/Elutasítás gombokkal (l. telegram/webhook route.ts 's' ág).
 * Nincs LLM-hívás (sablon-alapú caption, l. social-caption.ts) — a napi
 * Anthropic-keretre nulla hatással van.
 *
 * ═══ A POSZT-SZÖVEG KÖTELEZŐ FORRÁSA: docs/facebook-content-brief.md ═══
 * User utasítás, 2026-09-09: „csak ez alapján készülhet bármilyen poszt".
 * A briefből az alábbiak vannak KÓDBAN kikényszerítve, ne lazíts rajtuk:
 *  - 6. pont (tilos a csonkítás): sehol nincs nyers `.slice(0, N)` karakter-
 *    vágás — mindenhol truncateAtWordBoundary(), ami sose vág szó közepén.
 *    (Ez a 2026-09-08-i user report gyökéroka volt: "...rejtélyes befekte…")
 *  - 7-8. pont (SOURCE / POST / IMAGE COPY három külön réteg): a képre
 *    rövidebb sor megy (IMAGE_DETAIL_MAX_CHARS), a caption-be a hosszabb
 *    kontextus TELJES EGÉSZÉBEN, vágás nélkül — sose ugyanaz a levágott szöveg
 *    mindkettőn.
 *  - 11. pont (jogi státuszok nem szinonimák): VERDICT_KICKERS a
 *    CourtVerdict.verdictType-ból dolgozik, sose "erősít fel" egy státuszt
 *    (l. az 'előzetesben' melletti kommentet).
 *  - 12. pont (kirúgás ≠ lemondás): resignationHeadline() a tényleges
 *    resignationType-ból képzi az igét, nincs generikus "távozott".
 */

// 2026-09-10: a korábbi 2 órás ablak abból indult ki, hogy a cron óránként
// lefut — nem fut. L. EVENT_LOOKBACK_HOURS kommentje (social-post-policy.ts).
const BREAKING_LOOKBACK_HOURS = EVENT_LOOKBACK_HOURS;
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
  /** Ügy-felidéző típusoknál a bizonyított érintettség; a kapu ezt méri az
   *  1 milliárdos minimumhoz (l. social-post-policy.ts). */
  provenAmountFt?: bigint | null;
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
    // Brief 12. pont: a kirúgás ≠ lemondás — a fejléc a TÉNYLEGES
    // resignationType-ból képzi az igét ("X: kirúgták!"), nem a korábbi
    // generikus "X távozott" formából.
    const headline = resignationHeadline(r.name, r.resignationType);
    const detail = `${r.position}, ${r.institution}`;
    const imageDetail = truncateAtWordBoundary(detail, IMAGE_DETAIL_MAX_CHARS);
    const hookLine = hookFor('resignation', r.id);
    const image = await renderBreakingImage({ kicker, headline, detail: imageDetail });
    out.push({
      triggerType: 'resignation',
      triggerRefId: r.id,
      milestoneValueFt: null,
      headline,
      caption: breakingCaption(kicker, headline, detail, resignationLinkPath(r.name), undefined, hookLine),
      imagePng: image,
      imageText: imageDetail ?? '',
      kicker,
    });
  }
  return out;
}

const MEDIA_CLOSURE_KICKERS: Record<string, string> = {
  'megszűnés': 'MEGSZŰNÉS', 'leépítés': 'LEÉPÍTÉS', 'elmaradt esemény': 'ELMARADT ESEMÉNY', 'egyéb': 'MÉDIA-HÍR',
};
// Brief 3. pont — a kép/hook legyen "intézmény + státusz", ne csak az
// intézmény bare neve. Kettőspontos forma (mint resignationHeadline):
// intranzitív igék, sose igényelnek tárgyeset-egyeztetést a névvel, ezért
// bármilyen médiumnévre biztonságosak.
const MEDIA_CLOSURE_VERBS: Record<string, string> = {
  'megszűnés': 'megszűnt!',
  'leépítés': 'leépítést hajtott végre!',
  'elmaradt esemény': 'elmaradt!',
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
    const verb = MEDIA_CLOSURE_VERBS[m.eventType];
    const headline = verb ? `${m.name}: ${verb}` : m.name;
    const detail = m.description ?? undefined;
    const imageDetail = truncateAtWordBoundary(m.description, IMAGE_DETAIL_MAX_CHARS);
    const hookLine = hookFor('media_closure', m.id);
    const image = await renderBreakingImage({ kicker, headline, detail: imageDetail });
    out.push({
      triggerType: 'media_closure',
      triggerRefId: m.id,
      milestoneValueFt: null,
      headline,
      caption: breakingCaption(kicker, headline, detail, '/megszunt', undefined, hookLine),
      imagePng: image,
      imageText: imageDetail ?? '',
      kicker,
    });
  }
  return out;
}

// Brief 11. pont — a jogi státuszok NEM szinonimák: "őrizetbe vett",
// "letartóztatott", "előzetesben", "vádemelés", "elsőfokú", "jogerős",
// "felmentve" mind külön kategória, és a poszt sose állíthat erősebbet,
// mint amit a rekord rögzít. Korábban MINDEN CourtVerdict-sor egységesen
// 'ÍTÉLET' kickert kapott a valós verdictType-tól függetlenül — ez a brief
// szerint hibás (egy előzetes letartóztatás nem ítélet).
//
// FIGYELEM az 'előzetesben' soron: a detektor (court-verdict-detect.ts)
// EGY bucketbe teszi az őrizetbe vételt és az előzetes letartóztatást
// ("held in custody/pretrial detention"), tehát az adatmodellből NEM
// dönthető el, melyikről van szó. Ezért itt szándékosan a rekord SAJÁT
// szava ('ELŐZETESBEN') megy ki, NEM a "LETARTÓZTATVA" — az utóbbi
// felerősítené a státuszt olyan esetekben, ahol csak őrizetbe vétel
// történt (l. NKA/Fásy-ügy, 2026-09: őrizetbe vétel + letartóztatás
// KEZDEMÉNYEZÉSE). A pontos megfogalmazás a summary-ből (detail) jön.
const VERDICT_KICKERS: Record<string, string> = {
  'előzetesben': 'ELŐZETESBEN',
  'elsőfokú': 'ÍTÉLET',
  'jogerős': 'JOGERŐS ÍTÉLET',
  'vádemelés': 'VÁDEMELÉS',
  'szabadlábra helyezve': 'SZABADLÁBON',
  'eljárás megszűnt': 'ELJÁRÁS MEGSZŰNT',
  'felmentve': 'FELMENTVE',
};
// Csak azokra a típusokra, ahol egy rövid, kettőspontos igés forma
// informatívabb, mint a puszta sentenceLabel (pl. 'előzetesben' esetén
// nincs sentenceLabel). 'elsőfokú'/'jogerős' szándékosan KIMARAD, mert ott
// a tényleges sentence ("5 év") konkrétabb. Az igék sose erősítenek a
// verdictType-on (l. fenti komment).
const VERDICT_VERBS: Record<string, string> = {
  'előzetesben': 'előzetesben!',
  'vádemelés': 'vádat emeltek ellene!',
  'szabadlábra helyezve': 'szabadlábra helyezve!',
  'eljárás megszűnt': 'az eljárás megszűnt!',
  'felmentve': 'felmentve!',
};

async function buildCourtVerdictTriggers(db: ReturnType<typeof getDb>): Promise<OutboxInsert[]> {
  const since = new Date(Date.now() - BREAKING_LOOKBACK_HOURS * 60 * 60 * 1000);
  const recent = await db
    .select({ id: schema.courtVerdicts.id, personName: schema.courtVerdicts.personName, sentenceLabel: schema.courtVerdicts.sentenceLabel, sentenceYears: schema.courtVerdicts.sentenceYears, summary: schema.courtVerdicts.summary, verdictType: schema.courtVerdicts.verdictType })
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
    const kicker = VERDICT_KICKERS[v.verdictType] ?? 'ÍTÉLET';
    const sentence = v.sentenceLabel ?? (v.sentenceYears > 0 ? `${v.sentenceYears} év` : null);
    // Kettőspontos forma — sose "Letartóztatták X-et"-féle igés+tárgyeset
    // szerkezet, mert az a név accusative ragozását igényelné (pl. "Kovács
    // János" → "Kovács Jánost"), ami ismeretlen névvégződésen elcsúszik.
    const verb = VERDICT_VERBS[v.verdictType];
    const headline = verb ? `${v.personName}: ${verb}` : sentence ? `${v.personName}: ${sentence}` : v.personName;
    const detail = v.summary;
    const imageDetail = truncateAtWordBoundary(v.summary, IMAGE_DETAIL_MAX_CHARS);
    const hookLine = hookFor('court_verdict', v.id);
    const image = await renderBreakingImage({ kicker, headline, detail: imageDetail });
    out.push({
      triggerType: 'court_verdict',
      triggerRefId: v.id,
      milestoneValueFt: null,
      headline,
      caption: breakingCaption(kicker, headline, detail, '/birosagi-iteletek', undefined, hookLine),
      imagePng: image,
      imageText: imageDetail ?? '',
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
    // a.description a DB-ben max 1000 karakter lehet, és eddig EGYÁLTALÁN
    // nem volt rövidítve, mielőtt a képre került — brief 8. pont.
    const detail = a.description;
    const imageDetail = truncateAtWordBoundary(a.description, IMAGE_DETAIL_MAX_CHARS);
    const hookLine = hookFor('asset_recovery', a.id);
    const image = await renderBreakingImage({ kicker, headline, detail: imageDetail });
    out.push({
      triggerType: 'asset_recovery',
      triggerRefId: a.id,
      milestoneValueFt: null,
      headline,
      caption: breakingCaption(kicker, headline, detail, '/visszaszerzett-vagyon', undefined, hookLine),
      imagePng: image,
      imageText: imageDetail ?? '',
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
    // 2026-09-07 user report: "${filerName} feljelentést tett ${targetName}
    // ellen" élesen értelmetlen mondatot adott ki ("...tett Magyar
    // Fejlesztési Bank 77 milliárdos kötvényvásárlása a Waberer's-től
    // ellen") — a targetName egy szabad szöveges ÜGY-LEÍRÁS (l.
    // criminal-complaint-detect.ts), NEM egy önálló főnév, amire az "ellen"
    // névutó ráépíthető. complaintHeadline() a kettőspontos formát adja,
    // ami tetszőleges szabad szövegre nyelvtanilag biztonságos.
    // (targetEntity oszlop a main sémájában még nincs — l. 0060-as migráció
    // a 011-nvvh-case-poll branchen; addig mindig a biztonságos ág fut.)
    const headline = complaintHeadline(c.filerName, null, c.targetName);
    const detail = c.amountLabel ? `Érintett összeg: ${c.amountLabel}` : undefined;
    const imageDetail = truncateAtWordBoundary(detail, IMAGE_DETAIL_MAX_CHARS);
    const hookLine = hookFor('criminal_complaint', c.id);
    const image = await renderBreakingImage({ kicker, headline, detail: imageDetail });
    out.push({
      triggerType: 'criminal_complaint',
      triggerRefId: c.id,
      milestoneValueFt: null,
      headline,
      caption: breakingCaption(kicker, headline, detail, '/birosagi-iteletek', undefined, hookLine),
      imagePng: image,
      imageText: imageDetail ?? '',
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
 * (vagy sose) posztolt kap elsőbbséget, hogy körbeforogjanak.
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

  // Brief 10. pont: a kvíz NEM szavazás — sem a kicker, sem a CTA nem
  // nevezheti "szavazásnak"/"pollnak". A kvíz saját címe (pick.title, pl.
  // "Lehetnél te az NVVH legfőbb ügyésze?") már önmagában erős hook.
  const kicker = 'KVÍZ';
  const headline = pick.title;
  // 2026-09-08 user report — pontosan ez a sor adta a "...rejtélyes
  // befekte…" félbevágott szót: a nyers char-slice a szó KÖZEPÉN vágott, és
  // ugyanaz a levágott szöveg ment a képre ÉS a caption-be is.
  const detail = pick.intro;
  const imageDetail = truncateAtWordBoundary(pick.intro, IMAGE_DETAIL_MAX_CHARS);
  const hookLine = hookFor('quiz_highlight', pick.id);
  const image = await renderBreakingImage({ kicker, headline, detail: imageDetail });
  return [{
    triggerType: 'quiz_highlight',
    triggerRefId: pick.id,
    milestoneValueFt: null,
    headline,
    caption: breakingCaption(kicker, headline, detail, `/kviz/${pick.slug}`, '🧠 Töltsd ki, és nézd meg, hányat tudtál!', hookLine),
    imagePng: image,
    imageText: imageDetail ?? '',
    kicker,
  }];
}

/**
 * Egyszeri záró végeredmény-poszt, akkor és csak akkor, ha egy szavazás
 * státusza 'closed' — user kérés, 2026-09-07: a korábbi NAPI "napi állás"
 * poszt unalmas volt és nem is mondta ki, miről szól a szavazás, sem hogy
 * szavazzon rá a látogató. A lezárás MANUÁLIS admin-lépés (nincs
 * automatikus dátum-alapú lezárás), ez a trigger csak arra vár, hogy
 * megtörténjen — attól kezdve egyszer, örökre kimegy, a triggerRefId a
 * pollQuestions.id-jével dedupolva.
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
    const headline = `Lezárult a szavazás: ${full.question.questionText}`;
    const detailLines = top3.map((o, i) => `${i + 1}. ${o.title} — ${o.sharePct}% (${o.votes} szavazat)`);
    const detail = detailLines.join('\n');
    const hookLine = hookFor('poll_final_result', pollId);
    const image = await renderBreakingImage({ kicker, headline, detail: detailLines });
    out.push({
      triggerType: 'poll_final_result',
      triggerRefId: pollId,
      milestoneValueFt: null,
      headline,
      caption: breakingCaption(kicker, headline, detail, `/szavazas/${poll.slug}`, `👉 Összesen ${full.totalVotes} szavazat érkezett — nézd meg a teljes eredményt!`, hookLine),
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

  // 2026-09-10 user szabály: csak legalább MIN_CASE_DAMAGE_FT (1 milliárd Ft)
  // BIZONYÍTOTT érintettségű ügy mehet ki. Az UGYEK-ben az összeg szabad
  // szöveg (estimatedDamage), ezért parse-oljuk; amit nem tudunk
  // megállapítani, az szándékosan kiesik — inkább ne menjen poszt, mint hogy
  // egy ismeretlen súlyú ügy menjen.
  const bigEnough = UGYEK.filter((u) => {
    if (!u.summary) return false;
    const amount = parseHungarianFtAmount(u.estimatedDamage);
    return amount !== null && amount >= MIN_CASE_DAMAGE_FT;
  });
  const candidates = bigEnough.filter((u) => !recentIds.has(u.id));
  const pool = candidates.length > 0 ? candidates : bigEnough;
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick) return null;

  const kicker = 'KIEMELT ÜGY';
  const headline = pick.title;
  const detail = pick.summary;
  // A KÉPRE a rövid, kurált állapot-sor megy (pl. „Aktív · 7 személy
  // előzetesben"), NEM az összefoglaló eleje: 90 karakterbe egy valódi
  // mondat úgysem fér bele, a levágott mondat pedig pontosan az a hiba,
  // amit a user kifogásolt. A teljes összefoglaló a caption-ben marad.
  const imageDetail = fitCompleteSentences(pick.eyebrow, IMAGE_DETAIL_MAX_CHARS);
  const hookLine = hookFor('catalog_highlight', pick.id);
  const image = await renderBreakingImage({ kicker, headline, detail: imageDetail });
  return {
    provenAmountFt: parseHungarianFtAmount(pick.estimatedDamage),
    triggerType: 'catalog_highlight',
    triggerRefId: pick.id,
    milestoneValueFt: null,
    headline,
    caption: breakingCaption(kicker, headline, detail, `/ugyek/${pick.id}`, undefined, hookLine),
    imagePng: image,
    imageText: imageDetail ?? '',
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

  // 2026-09-10 — két user-szabály SQL-be kötve:
  //  (a) legalább 1 milliárd Ft érintettség (MIN_CASE_DAMAGE_FT),
  //  (b) valódi ügyleírás, nem generált katalógus-csonk. A 947 summary-ből
  //      673 ilyen csonk („Fodor János — besorolatlan (1 cikk)"), és pont
  //      egy ilyen ment ki tegnap posztként.
  const qualityWhere = sql`
      sc.summary IS NOT NULL
      AND length(trim(sc.summary)) >= 120
      AND sc.summary NOT ILIKE '%besorolatlan%'
      AND sc.summary !~ '\(\d+ cikk\)'
      AND sc.damage_huf IS NOT NULL
      AND sc.damage_huf >= ${MIN_CASE_DAMAGE_FT.toString()}::numeric`;

  const rows = (await db.execute(sql`
    SELECT sc.id, sc.name, sc.person, sc.institution, sc.summary, sc.damage_huf AS "damageHuf"
    FROM "ScandalCatalog" sc
    WHERE ${qualityWhere}
      AND sc.id NOT IN (${sql.join(excludeIds.length > 0 ? excludeIds.map((v) => sql`${v}`) : [sql`''`], sql`, `)})
  `)) as unknown as ScandalCatalogRow[];

  let pool = rows;
  if (pool.length === 0) {
    // Ha a cooldown mindent kizárt, essünk vissza a teljes (RETIRED nélküli) készletre.
    const fallbackRows = (await db.execute(sql`
      SELECT sc.id, sc.name, sc.person, sc.institution, sc.summary, sc.damage_huf AS "damageHuf"
      FROM "ScandalCatalog" sc
      WHERE ${qualityWhere}
        AND sc.id NOT IN (${sql.join(RETIRED_SCANDAL_IDS.length > 0 ? RETIRED_SCANDAL_IDS.map((v) => sql`${v}`) : [sql`''`], sql`, `)})
    `)) as unknown as ScandalCatalogRow[];
    pool = fallbackRows;
  }
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick) return null;

  if (isPlaceholderSummary(pick.summary)) return null;

  const kicker = 'ADATBÁZIS';
  const headline = autoDisplayTitle(pick.name, pick.person) || pick.name;
  const detail = (pick.summary ?? '').trim();
  const trimmedDetail = detail;
  // A KÉPRE a rövid azonosító sor megy (személy · intézmény), NEM az
  // összefoglaló levágott eleje. Az összeget szándékosan NEM írjuk ki:
  // a damage_huf sok sornál gyűjtő-/becsült érték (215 sor pontosan
  // 5 000 000 000 Ft), tehát szűrésre alkalmas, konkrét állításként
  // publikálni viszont félrevezető lenne.
  const imageDetail = fitCompleteSentences(
    [pick.person, pick.institution].filter(Boolean).join(' · '),
    IMAGE_DETAIL_MAX_CHARS,
  );
  const hookLine = hookFor('gallery_highlight', pick.id);
  const image = await renderBreakingImage({ kicker, headline, detail: imageDetail });
  return {
    provenAmountFt: pick.damageHuf ? BigInt(pick.damageHuf) : null,
    triggerType: 'gallery_highlight',
    triggerRefId: pick.id,
    milestoneValueFt: null,
    headline,
    caption: breakingCaption(kicker, headline, trimmedDetail, `/adatbazis/${toAsciiId(pick.id)}`, undefined, hookLine),
    imagePng: image,
    imageText: imageDetail ?? '',
    kicker,
  };
}

/** Mikor ment ki legutóbb összesítő poszt — a heti cooldownhoz. */
async function lastSummaryAt(db: ReturnType<typeof getDb>): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: schema.socialPostOutbox.createdAt })
    .from(schema.socialPostOutbox)
    .where(eq(schema.socialPostOutbox.triggerType, 'summary_stats'))
    .orderBy(desc(schema.socialPostOutbox.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}

/** Hány jelölt vár még emberi döntésre. Ha van ilyen, tartalék nem indul —
 *  a "töltelék" sose előzheti meg azt, amiről még nem döntöttél. */
async function pendingApprovalCount(db: ReturnType<typeof getDb>): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.socialPostOutbox)
    .where(eq(schema.socialPostOutbox.status, 'pending_approval'));
  return row?.c ?? 0;
}

async function buildFallbackTrigger(kind: FallbackKind, db: ReturnType<typeof getDb>): Promise<OutboxInsert | null> {
  if (kind === 'summary_stats') return buildSummaryStatsTrigger(db);
  if (kind === 'catalog_highlight') return buildCatalogHighlightTrigger(db);
  return buildGalleryHighlightTrigger(db);
}

export function approvalKeyboard(outboxId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      // 2026-09-11 — a jóváhagyás már nem posztol azonnal, hanem időpontot ad
      // (l. social-schedule.ts), ezért a gomb szövege is „ütemezés".
      [{ text: '✅ Ütemezett közzététel', callback_data: `s:a:${outboxId}` }],
      // „Mind" — az összes elbírálatlan jelöltet egyben hagyja jóvá, 3 órás
      // szünetekkel kiosztva. user kérés: „ne kelljen velük baszakodnom külön".
      [{ text: '✅✅ Mind jóváhagyom (3 óránként megy ki)', callback_data: `s:aa:${outboxId}` }],
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
  const remaining = TARGET_PER_DAY - todayCount;
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

  // Tartalék CSAK akkor, ha nincs valódi esemény-jelölt, nincs elbírálatlan
  // jelölt, és a nap rögzített órájában járunk. 2026-09-10 user report: a
  // nap egyetlen valódi eseménye (Volánbusz-feljelentés) helyett három
  // tartalék ment ki — a tartalék sose előzheti a valódit.
  const pending = await step.run('count-pending', () => pendingApprovalCount(db));
  if (candidates.length === 0 && pending === 0 && budapestHour() === FALLBACK_HOUR_BUDAPEST) {
    const summarySeenAt = await step.run('last-summary-at', () => lastSummaryAt(db));
    const kinds = fallbackKindsForRun({
      now: new Date(),
      lastSummaryAt: summarySeenAt ? new Date(summarySeenAt) : null,
    });
    for (const kind of kinds) {
      const built = await step.run(`fallback-${kind}`, () => buildFallbackTrigger(kind, db));
      if (built) {
        candidates.push(built);
        break; // egy futásban egy tartalék elég
      }
    }
  } else if (candidates.length === 0 && pending > 0) {
    logger?.info?.(`check-social-triggers: ${pending} jelölt vár döntésre, tartalék kihagyva`);
  }

  // Mennyi mehet ki MOST (max 1 futásonként + minimum szünet) — a döntés
  // tiszta függvényben, tesztelve: social-post-policy.ts selectQueueBatch().
  const decision = selectQueueBatch(candidates, {
    now: new Date(),
    remainingToday: remaining,
  });
  if (decision.skippedReason) logger?.info?.(`check-social-triggers: kihagyva — ${decision.skippedReason}`);
  const selected = decision.selected;

  let queued = 0;
  for (const c of selected) {
    // ═══ A KAPU ═══ Minden jelölt ezen megy át, típustól függetlenül. Egy
    // később hozzáadott ÚJ trigger-típus is automatikusan ide fut be, ezért
    // a szabályok nem tudnak "kimaradni" egy új builderből.
    const gate = checkPostGate({
      triggerType: c.triggerType,
      headline: c.headline,
      caption: c.caption,
      imageText: c.imageText,
      provenAmountFt: c.provenAmountFt ?? null,
    });
    if (!gate.ok) {
      logger?.info?.(`check-social-triggers: ELDOBVA (${c.triggerType}) — ${gate.reason}`);
      continue;
    }
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

      // A DB-ben tárolt caption (ez megy ki a Facebookra) MINDIG teljes; a
      // Telegram sendPhoto feliratának viszont 1024 karakteres platform-
      // korlátja van, ezért CSAK az előnézetet vágjuk, explicit jelöléssel
      // (l. telegramPreview()). Korábban a hosszú caption miatt a Telegram
      // hívás simán elszállt volna, jelölt nélkül.
      const messageId = await sendTelegramPhoto(
        c.imagePng,
        telegramPreview('📢 Új Facebook-poszt-jelölt', c.caption),
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
