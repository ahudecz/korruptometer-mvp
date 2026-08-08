/**
 * 003-detection-review-engine — review decision logic.
 *
 * Pure, testable rules that route each LLM detection to auto-publish, the
 * editorial review queue, or discard. See specs/003-detection-review-engine.
 */
import { sql } from 'drizzle-orm';
import { normalizeName } from './watchlist';
import { llmExtract, type LlmToolSpec } from './llm';

export type ReviewDecision = 'approved' | 'pending' | 'discard';

export const AUTO_PUBLISH_THRESHOLD = 0.77; // lowered from 0.9 — false positives get deleted after the fact instead of stuck in review
export const REVIEW_FLOOR = 0.7; // FR-004 / FR-005
// FR-009. 2026-08-07: no longer isDuplicate()'s default (that's now
// unbounded — see its doc comment) — still used as the default window for
// CourtVerdict's lifecycle-aware findExistingVerdict() below, where a time
// cutoff is actually meaningful (a case can go quiet and later become newly
// relevant again).
export const DEDUP_WINDOW_DAYS = 30;
export const DESCRIPTION_WORD_LIMIT = 7; // matches the DB check constraints (migration 0034)

/**
 * Hungarian words that can never grammatically be the LAST word of a short
 * label — either they are an attributive adjective/participle that modifies
 * a noun which must follow ("helyettes kormányzó" → cutting after "helyettes"
 * strands it without its noun), or a conjunction/relative pronoun/article
 * that always introduces more text. A naive fixed-word-count cut can land
 * exactly on one of these (2026-08-06 user report: "Felmentette Nagy
 * Mártont az IMF-ben betöltött helyettes" — the source was "...betöltött
 * helyettes kormányzói tisztségéből", 9 words, sliced to 7 mid-phrase).
 * Not an exhaustive grammar check — a closed-class blocklist of the specific
 * word types observed to produce this failure — but cheap and catches the
 * pattern regardless of which detector/table produced the text.
 */
const DANGLING_LAST_WORDS = new Set([
  // attributive adjectives/participles that require a following noun
  'helyettes', 'volt', 'korábbi', 'jelenlegi', 'egykori', 'leendő',
  'megbízott', 'ideiglenes', 'kinevezett', 'nyugalmazott', 'vezető', 'fő',
  'társ', 'ügyvezető', 'betöltött', 'akkori', 'új', 'régi', 'soron',
  // conjunctions / relative pronouns that always continue the sentence
  'és', 'vagy', 'de', 'hogy', 'mint', 'mivel', 'ha', 'amely', 'amelyet',
  'amelynek', 'aki', 'akit', 'akinek', 'ami', 'amit', 'amik', 'mert',
  'illetve', 'valamint', 'majd', 'míg', 'pedig',
  // bare articles that always need an object
  'a', 'az', 'egy',
]);

function isDanglingLastWord(word: string): boolean {
  const stripped = word.toLowerCase().replace(/[.,;:!?]+$/, '');
  return DANGLING_LAST_WORDS.has(stripped);
}

/**
 * PoliticalResignation.description and MediaClosure.description have a
 * DB-level "max 7 words" check constraint (migration 0034 —
 * memory/feedback-media-description-length.md: a long sentence-style
 * description breaks the homepage KPI grid). The LLM prompt is supposed to
 * keep to that on its own, but when it doesn't the old `.slice(0, 1000)`
 * char-truncation let the row through to `db.insert()`, which then threw
 * on the constraint and silently discarded the whole detection (2026-07-31
 * — MediaClosure hadn't gotten a new row since 2026-07-07 because of this).
 * Enforce the word limit in code so a verbose LLM output degrades to a
 * shorter description instead of failing the insert.
 *
 * 2026-08-06 — cutting at a fixed word count can itself strand a dangling
 * word at the new end (see DANGLING_LAST_WORDS above). After slicing to
 * `limit`, keep dropping trailing words while the last one is a dangler, so
 * the result is always a complete-reading phrase instead of a mid-word/
 * mid-clause fragment. Also applied to inputs already at/under the limit —
 * an LLM output can be short AND still end badly.
 */
export function truncateDescriptionWords(value: string, limit = DESCRIPTION_WORD_LIMIT): string {
  let words = value.trim().split(/\s+/).filter(Boolean).slice(0, limit);
  while (words.length > 0 && isDanglingLastWord(words[words.length - 1]!)) {
    words = words.slice(0, -1);
  }
  return words.join(' ');
}

/**
 * PoliticalResignation.position / CourtVerdict.position should read as a
 * bare job-title noun phrase ("miniszter", "helyettes kormányzó") — never a
 * full sentence fragment that re-states the institution (already its own
 * column) wrapped in a leading definite article. Real bug (2026-08-06, user
 * report on the Nagy Márton row): the LLM extracted position "az IMF-ben
 * betöltött helyettes kormányzó" instead of just "helyettes kormányzó" —
 * grammatically fine in isolation, but redundant next to institution="IMF"
 * and inconsistent with every sibling row's plain style (all one-to-three
 * word titles, l. lemondasok/resignation-list.tsx).
 *
 * Two passes, in order:
 *  1. The specific construction that produced the real bug — "X-ban/-ben
 *     betöltött Y" ("the Y role held at X") — keep only Y, the part after
 *     "betöltött".
 *  2. Strip a bare leading "a "/"az " article that survives (or was there
 *     to begin with, independent of the "betöltött" construction).
 */
export function cleanPositionTitle(value: string): string {
  let title = value.trim();
  const heldAtMatch = title.match(/^az?\s+.+?\bbetöltött\s+(.+)$/i);
  if (heldAtMatch) title = heldAtMatch[1]!.trim();
  title = title.replace(/^az?\s+/i, '');
  return title;
}

/**
 * Decide what to do with a detection.
 *
 *   confidence < 0.70           → 'discard'   (FR-005, universal floor)
 *   isWatchlist && >= 0.70      → 'pending'   (2026-07-14 fix — see below)
 *   confidence >= 0.77          → 'approved'  (lowered from 0.90 — false
 *                                  positives get deleted after the fact
 *                                  instead of sitting in the review queue)
 *   0.70 <= confidence < 0.77   → 'pending'
 *
 * 2026-07-14 — `isWatchlist` used to be accepted but never read (the
 * `_isWatchlist` naming was the tell): watchlist.ts's own doc comment says
 * these ~36 people (8 "lemondásra felszólított" + 10 Galéria + 18
 * miniszter) "MUST always go to editorial review... regardless of
 * confidence", but nothing enforced it — a high-confidence wrong call
 * (Sulyok Tamás, an alaptörvény-módosítás megszavazása félreértve tényleges
 * távozásként) sailed straight to auto-publish with zero human review. Now
 * a watchlist person can never skip the pending queue, no matter how
 * confident the model is.
 */
export function decideStatus(confidence: number, isWatchlist: boolean): ReviewDecision {
  if (confidence < REVIEW_FLOOR) return 'discard';
  if (isWatchlist) return 'pending';
  if (confidence >= AUTO_PUBLISH_THRESHOLD) return 'approved';
  return 'pending';
}

/** Tables the dedup guard understands (name column varies per table). */
export type DedupTable =
  | { table: 'PoliticalResignation'; nameColumn: 'name' }
  | { table: 'MediaClosure'; nameColumn: 'name' }
  | { table: 'CourtVerdict'; nameColumn: 'personName' }
  | { table: 'AssetRecovery'; nameColumn: 'caseLabel' };

type Executable = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

/**
 * True if a row with the same normalised name already exists in the table,
 * in ANY reviewStatus (approved/pending/rejected). Institution is
 * intentionally ignored, and rejected rows count, so a previously rejected
 * detection is not re-created (FR-009, FR-011).
 *
 * The SQL side re-derives the same normalisation as normalizeName() —
 * lower + unaccent + punctuation-to-space + collapse/trim — so that e.g.
 * "Promenad24" and "Promenad24.hu" or "Kovács Zoltán!" and "Kovács Zoltán"
 * are recognised as the same name (research.md called this "írásjel-toleráns"
 * matching, but the query previously only lower/unaccent/trimmed the raw
 * strings, so punctuation differences slipped past the guard).
 *
 * 2026-08-07 — `withinDays` no longer defaults to a 30-day cutoff. Bug
 * report: "Dr. Fürcht Pál" resigned 2026-06-14; a 2026-08-07 follow-up
 * article that only RECAPPED that same resignation as background for an
 * unrelated story got re-extracted as a "new" resignation, and since the
 * row was ~54 days old, the old 30-day window would have waved it through
 * as non-duplicate even after the honorific-stripping fix in
 * normalizeName(). An exact name match within the SAME table is always the
 * SAME real-world one-shot event (a person doesn't resign from — or a
 * media outlet doesn't close under — the identical name twice), so there is
 * no principled cutoff after which it stops being a duplicate. Pass an
 * explicit `withinDays` when a table genuinely can have legitimate repeat
 * events under the same name (e.g. AssetRecovery — recurring recoveries on
 * the same case — already does, with 14).
 */
export async function isDuplicate(
  db: Executable,
  target: DedupTable,
  name: string,
  withinDays?: number,
): Promise<boolean> {
  const key = normalizeName(name);
  if (!key) return false;
  const tableId = sql.identifier(target.table);
  const nameCol = sql.identifier(target.nameColumn);
  const windowClause = withinDays != null
    ? sql`AND "createdAt" >= now() - make_interval(days => ${withinDays})`
    : sql``;
  const rows = (await db.execute(sql`
    SELECT 1 FROM ${tableId}
    WHERE trim(regexp_replace(lower(unaccent(trim(${nameCol}))), '[^a-z0-9]+', ' ', 'g')) = ${key}
      ${windowClause}
    LIMIT 1
  `)) as unknown as { length: number };
  return rows.length > 0;
}

// 2026-07-14 — the resignation extractor is instructed to use a collective
// name (e.g. "Pesti Srácok szerkesztőség") ONLY when an article names no
// individuals at all. In practice it sometimes still produces one anyway
// (e.g. "MÁV igazgatósága") even when a SIBLING article about the same
// event already named the actual board members individually — creating a
// redundant entry on top of the real ones (2026-07-14, user report).
//
// 2026-07-16 — a general "Newscast"-style roundup article, mentioning an
// already individually-recorded NAV leadership reshuffle only in passing,
// got re-extracted as the collective "NAV-vezetők" — plural, hyphen-joined,
// which the original regex (singular, space-separated: "vezetése") didn't
// match, so it slipped past this guard into a pending Telegram review
// instead of being auto-discarded as a duplicate. Widened to also catch
// the plural "-vezetők"/"-vezetői" and a hyphen (not just whitespace)
// before the suffix.
const COLLECTIVE_NAME_RE = /[\s-](igazgatósága|igazgatótanácsa|vezetősége|testülete|elnöksége|vezetése|vezetői|vezetők)$/i;

export function isCollectiveEntityName(name: string): boolean {
  return COLLECTIVE_NAME_RE.test(name.trim());
}

/**
 * AssetRecovery.caseId slug generator. The LLM's caseLabel often bakes the
 * recovered amount into the same string after a "-" or "·" separator (e.g.
 * "Orbán János Dénes jogdíjak ügye - 1,3 milliárd forint visszaszerzés",
 * "NKA · újabb visszafizetés") — slugifying the WHOLE label produced long,
 * ugly URLs and, since the amount changes per article, meant near-identical
 * stories about the same case never shared a caseId. Only the part before
 * the first separator is used, so caseId stays a short, stable case name.
 */
export function slugifyCaseLabel(label: string): string {
  const primary = (label.split(/[-·]/)[0] ?? label).trim();
  const slug = primary
    .toLowerCase()
    .replace(/[^a-záéíóöőúüű0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'vagyonvisszaszerzes';
}

/**
 * True if `institution` already has at least one PoliticalResignation row
 * (any reviewStatus) within the window — paired with isCollectiveEntityName()
 * to reject a collective/testületi entry when the same body's members were
 * already extracted by name from a sibling article about the same reshuffle.
 */
export async function hasIndividualResignationForInstitution(
  db: Executable,
  institution: string,
  withinDays: number = 7,
): Promise<boolean> {
  if (!institution.trim()) return false;
  const rows = (await db.execute(sql`
    SELECT 1 FROM "PoliticalResignation"
    WHERE lower(institution) = lower(${institution})
      AND "createdAt" >= now() - make_interval(days => ${withinDays})
    LIMIT 1
  `)) as unknown as { length: number };
  return rows.length > 0;
}

export type ExistingVerdict = { id: string; verdictType: string };

/**
 * Finds the most recent CourtVerdict row for a person within the dedup
 * window, if any — so a legal case can be tracked through its real-world
 * status changes (letartóztatás → szabadlábra helyezve → jogerős ítélet
 * etc.) instead of every follow-up article being silently swallowed by
 * isDuplicate(). A court case is fundamentally not a one-shot event the way
 * a resignation or media closure is; it has a lifecycle, and a status
 * change is itself news, not noise.
 *
 * Callers should compare the returned `verdictType` against the newly
 * extracted one: same type → genuinely the same event re-reported (still a
 * true duplicate, discard); different type → a real status change (UPDATE
 * the existing row instead of inserting a new one or discarding).
 */
export async function findExistingVerdict(
  db: Executable,
  personName: string,
  withinDays: number = DEDUP_WINDOW_DAYS,
): Promise<ExistingVerdict | null> {
  const key = normalizeName(personName);
  if (!key) return null;
  const rows = (await db.execute(sql`
    SELECT id, "verdictType" FROM "CourtVerdict"
    WHERE trim(regexp_replace(lower(unaccent(trim("personName"))), '[^a-z0-9]+', ' ', 'g')) = ${key}
      AND "createdAt" >= now() - make_interval(days => ${withinDays})
    ORDER BY "verdictDate" DESC
    LIMIT 1
  `)) as unknown as ExistingVerdict[];
  return rows[0] ?? null;
}

// ─── 009-criminal-complaint-tracking ──────────────────────────────────────

export type ComplaintStatus = 'feljelentés' | 'nyomozás' | 'vádemelés' | 'ítélet' | 'elutasítva';

export type ExistingComplaint = { id: string; status: ComplaintStatus };

/** 180 days, not the usual 30 (DEDUP_WINDOW_DAYS) — a complaint can take
 *  months to reach an indictment or verdict (spec Assumptions). */
export const COMPLAINT_DEDUP_WINDOW_DAYS = 180;

// 2026-07-23 — user report: a Neptun/Kréta/Poszeidon-ügyben egy MÁSODIK
// feljelentés-sor jött létre 6 nappal az első után, mert a régi meccselés
// egy TELJES, normalizált targetName EGYEZŐSÉGET követelt meg — a két sor
// ("Kréta, Neptun és Poszeidon rendszerek - gyanús közbeszerzések és
// verseny-korlátozás" vs. "Neptun, Kréta, Poszeidon rendszerek — Fauszt
// Zoltánhoz köthető cégek") ugyanarról a valós ügyről szól, de az LLM két
// külön cikkből két teljesen más szövegű targetName-et generált — a szó
// szerinti egyezés emiatt sose talált volna rá, akárhány napos ablakkal.
// Ugyanaz a hibaosztály, mint a cross-source "ugyanaz a sztori" probléma
// a hírszkréélésnél (l. apps/web/src/lib/same-story.ts) — és ugyanaz a
// kétlépcsős megoldás: ingyenes pg_trgm word_similarity() előszűrés, és
// csak a "bizonytalan" sávban egy olcsó, kapuzott AI-döntőbíró hívás.
// Explicit rendezés (ORDER BY, LIMIT 1) helyett minden számottevő jelöltet
// megnézünk, mert itt (ellentétben a cross-source cikk-dedupnál) nem egy
// friss beszúrás elé állított, szűk időablakos QUERY fut, hanem a teljes
// 180 napos dedup-ablak — több valódi jelölt is lehet.
const COMPLAINT_FUZZY_LOW = 0.15;
const COMPLAINT_FUZZY_HIGH = 0.27;

const SAME_COMPLAINT_SYSTEM = `Te egy magyar korrupció-figyelő szerkesztő asszisztens vagy. Két feljelentés/nyomozás cél-leírását kapod. Döntsd el, hogy UGYANARRÓL a valós ügyről/esetről szólnak-e (akkor is, ha más szavakkal, más hangsúllyal írják le — pl. ugyanaz a szoftverrendszer-botrány, csak az egyik a közbeszerzést, a másik az érintett céget emeli ki), vagy két KÜLÖNBÖZŐ ügyről van szó.`;

const SAME_COMPLAINT_TOOL: LlmToolSpec = {
  name: 'same_complaint',
  description: 'Decide whether two criminal-complaint target descriptions refer to the same real-world case.',
  schema: {
    type: 'object',
    properties: {
      same: {
        type: 'boolean',
        description: 'True only if both descriptions concern the same specific case/target, not just a similar topic.',
      },
    },
    required: ['same'],
  },
};

async function isSameComplaintAi(a: string, b: string): Promise<boolean> {
  const user = `A leírás: ${a}\n\nB leírás: ${b}`;
  const { data } = await llmExtract<{ same: boolean }>({
    system: SAME_COMPLAINT_SYSTEM,
    user,
    tool: SAME_COMPLAINT_TOOL,
    maxTokens: 100,
  });
  return Boolean(data?.same);
}

/**
 * Finds the most recent CriminalComplaint row for a target/case within the
 * dedup window, if any. Matches on `targetName` (the case/target), NOT
 * `filerName` — a follow-up article about the same case ("a rendőrség
 * nyomozást indított") often doesn't re-name the original filer, but the
 * target/case name stays stable. Mirrors findExistingVerdict()'s
 * personName-based matching, applied to the complaint's target instead of
 * the defendant, since here there's no single "accused" until an indictment
 * exists.
 *
 * Two-tier match: (1) exact normalized-string equality (cheap, catches a
 * literal re-run); (2) if that misses, pg_trgm word_similarity() against
 * every candidate in the dedup window — a "duplicate"-tier score returns
 * immediately, an "ambiguous"-tier score gets one cheap AI tie-break call
 * against the single best-scoring candidate (same pattern as
 * same-story.ts's cross-source article dedup).
 */
export async function findExistingComplaint(
  db: Executable,
  targetName: string,
  withinDays: number = COMPLAINT_DEDUP_WINDOW_DAYS,
): Promise<ExistingComplaint | null> {
  const key = normalizeName(targetName);
  if (!key) return null;
  const exactRows = (await db.execute(sql`
    SELECT id, "status" FROM "CriminalComplaint"
    WHERE trim(regexp_replace(lower(unaccent(trim("targetName"))), '[^a-z0-9]+', ' ', 'g')) = ${key}
      AND "createdAt" >= now() - make_interval(days => ${withinDays})
    ORDER BY "eventDate" DESC
    LIMIT 1
  `)) as unknown as ExistingComplaint[];
  if (exactRows[0]) return exactRows[0];

  const fuzzyRows = (await db.execute(sql`
    SELECT id, "status", "targetName", word_similarity(${targetName}, "targetName") AS wsim
    FROM "CriminalComplaint"
    WHERE "createdAt" >= now() - make_interval(days => ${withinDays})
    ORDER BY wsim DESC
    LIMIT 3
  `)) as unknown as Array<ExistingComplaint & { targetName: string; wsim: number }>;
  const best = fuzzyRows[0];
  if (!best) return null;
  if (best.wsim >= COMPLAINT_FUZZY_HIGH) return { id: best.id, status: best.status };
  if (best.wsim < COMPLAINT_FUZZY_LOW) return null;

  const same = await isSameComplaintAi(targetName, best.targetName);
  return same ? { id: best.id, status: best.status } : null;
}

const COMPLAINT_STATUS_ORDER: Record<Exclude<ComplaintStatus, 'elutasítva'>, number> = {
  'feljelentés': 0,
  'nyomozás': 1,
  'vádemelés': 2,
  'ítélet': 3,
};

/**
 * Monotonic state-machine rule for an existing CriminalComplaint row: a
 * later-processed but chronologically OLDER article must never write the
 * status backwards (e.g. a recap article mentioning the original feljelentés
 * must not downgrade an already-recorded vádemelés back to feljelentés).
 *
 * 'elutasítva' (rejected/dropped) is a special terminal state: reachable
 * from any status (a case can be dropped at any stage), and a case can also
 * be reopened FROM 'elutasítva' into any other status — both are real status
 * changes, not "stale" reprocessing.
 */
export function decideComplaintTransition(current: ComplaintStatus, next: ComplaintStatus): 'update' | 'stale' {
  if (next === 'elutasítva') return current === 'elutasítva' ? 'stale' : 'update';
  if (current === 'elutasítva') return 'update';
  return COMPLAINT_STATUS_ORDER[next] > COMPLAINT_STATUS_ORDER[current] ? 'update' : 'stale';
}
