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
 * in ANY reviewStatus (approved/pending/rejected), and rejected rows count,
 * so a previously rejected detection is not re-created (FR-009, FR-011).
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
 *
 * 2026-08-23 — that "identical name = same event" assumption over-corrected:
 * a person CAN legitimately resign from two unrelated posts at different
 * times (Lázár János: Magyar Teniszszövetség elnöke, 2026-04-12 vs.
 * országgyűlési képviselő, 2026-08-20 — same name, unrelated institutions,
 * user report — the 3-months-later resignation from Parliament was silently
 * discarded as a "duplicate" of the tennis-federation one). `institution`
 * is now an optional extra guard: when passed (PoliticalResignation only —
 * the only DedupTable with that column), a name match ALSO requires the
 * existing row's institution to reasonably match (normalized equality or
 * substring containment either way, to tolerate "Zrt."/suffix wording
 * drift) before counting as a duplicate. Omitted for tables with no
 * institution concept (MediaClosure/CourtVerdict/AssetRecovery) — those
 * keep the old name-only behavior.
 */
export async function isDuplicate(
  db: Executable,
  target: DedupTable,
  name: string,
  withinDays?: number,
  institution?: string,
): Promise<boolean> {
  const key = normalizeName(name);
  if (!key) return false;
  const tableId = sql.identifier(target.table);
  const nameCol = sql.identifier(target.nameColumn);
  const windowClause = withinDays != null
    ? sql`AND "createdAt" >= now() - make_interval(days => ${withinDays})`
    : sql``;
  const institutionClause = institution
    ? sql`AND (
        trim(regexp_replace(lower(unaccent(trim("institution"))), '[^a-z0-9]+', ' ', 'g'))
          = trim(regexp_replace(lower(unaccent(${institution})), '[^a-z0-9]+', ' ', 'g'))
        OR trim(regexp_replace(lower(unaccent(trim("institution"))), '[^a-z0-9]+', ' ', 'g'))
          LIKE '%' || trim(regexp_replace(lower(unaccent(${institution})), '[^a-z0-9]+', ' ', 'g')) || '%'
        OR trim(regexp_replace(lower(unaccent(${institution})), '[^a-z0-9]+', ' ', 'g'))
          LIKE '%' || trim(regexp_replace(lower(unaccent(trim("institution"))), '[^a-z0-9]+', ' ', 'g')) || '%'
      )`
    : sql``;
  const rows = (await db.execute(sql`
    SELECT 1 FROM ${tableId}
    WHERE trim(regexp_replace(lower(unaccent(trim(${nameCol}))), '[^a-z0-9]+', ' ', 'g')) = ${key}
      ${windowClause}
      ${institutionClause}
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

export type ExistingComplaint = { id: string; status: ComplaintStatus; filerName: string; amountLabel: string | null };

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
    SELECT id, "status", "filerName", "amountLabel" FROM "CriminalComplaint"
    WHERE trim(regexp_replace(lower(unaccent(trim("targetName"))), '[^a-z0-9]+', ' ', 'g')) = ${key}
      AND "createdAt" >= now() - make_interval(days => ${withinDays})
    ORDER BY "eventDate" DESC
    LIMIT 1
  `)) as unknown as ExistingComplaint[];
  if (exactRows[0]) return exactRows[0];

  const fuzzyRows = (await db.execute(sql`
    SELECT id, "status", "filerName", "amountLabel", "targetName", word_similarity(${targetName}, "targetName") AS wsim
    FROM "CriminalComplaint"
    WHERE "createdAt" >= now() - make_interval(days => ${withinDays})
    ORDER BY wsim DESC
    LIMIT 3
  `)) as unknown as Array<ExistingComplaint & { targetName: string; wsim: number }>;
  const best = fuzzyRows[0];
  if (!best) return null;
  if (best.wsim >= COMPLAINT_FUZZY_HIGH) return { id: best.id, status: best.status, filerName: best.filerName, amountLabel: best.amountLabel };
  if (best.wsim < COMPLAINT_FUZZY_LOW) return null;

  const same = await isSameComplaintAi(targetName, best.targetName);
  return same ? { id: best.id, status: best.status, filerName: best.filerName, amountLabel: best.amountLabel } : null;
}

/**
 * 2026-08-30 user report (Fradiváros-eset): a Ferenczvárosi C Közép
 * szurkolói csoport 2026-07-21-én feljelentést tett az ÁSZ-nál a
 * Fradiváros-projekt ~25 Mrd Ft-os állami támogatása miatt — az ÁSZ ezt a
 * rendőrséghez továbbította. 2026-08-28-án a Belügyminisztérium (a már
 * folyamatban lévő ügyet) hivatalosan is bejelentette — UGYANARRA a
 * célra, UGYANAKKORA (24,947 vs 25 Mrd Ft) összegre. isSameComplainant()/
 * isSameComplainantAi() ezt duplikátumnak nem ismerte fel, mert a két
 * "bejelentő" (szurkolói csoport vs minisztérium) valóban különböző
 * szereplő — de a cél ÉS az összeg gyakorlati azonossága erősebb jel arra,
 * hogy ez UGYANAZ a feljelentés/ügy, csak két fázisban vált nyilvánossá,
 * mint amennyire a különböző "bejelentő" külön ügyet jelezne. Ez a NEM a
 * Gondosóra-mintát írja felül (ott a két feljelentés különböző konkrét
 * összeget/almenetet érintett) — csak akkor old fel egy filer-mismatch-et,
 * ha a két összeg egymáshoz képest ≤5%-on belül van, ami erős jele a
 * ténybeli azonosságnak.
 */
export function sameApproxComplaintAmount(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const parse = (label: string): number => {
    let total = 0;
    for (const m of label.matchAll(/(\d+(?:[.,]\d+)?)\s*(milliárd|millió)(?!\p{L})/giu)) {
      const value = parseFloat(m[1]!.replace(',', '.'));
      if (!Number.isFinite(value)) continue;
      total += value * (m[2]!.toLowerCase() === 'milliárd' ? 1_000_000_000 : 1_000_000);
    }
    return total;
  };
  const fa = parse(a);
  const fb = parse(b);
  if (fa === 0 || fb === 0) return false;
  const avg = (fa + fb) / 2;
  return Math.abs(fa - fb) / avg <= 0.05;
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

/**
 * 2026-08-11 bug report: a second, genuinely INDEPENDENT complaint about
 * the same broader case (Gondosóra-program) — the Ministry filing against
 * the program's named director, weeks after the Integritás Hatóság's
 * original filing — was silently discarded as 'stale_status'. Root cause:
 * findExistingComplaint()'s fuzzy targetName match (built to collapse
 * DIFFERENT WORDING of the SAME complaint, see COMPLAINT_FUZZY_* above)
 * correctly found the same case, but decideComplaintTransition() then saw
 * two 'feljelentés' entries and treated the new one as non-advancing —
 * there was no signal that this was a SECOND, separate complaint rather
 * than a recap of the first. filerName is that signal: the same legal case
 * only ever has one complainant of record per filing, so a different filer
 * on a fuzzy-matched case means "new complaint", not "stale update" — the
 * caller (detect-criminal-complaints.ts) should insert a new row instead of
 * running it through decideComplaintTransition at all.
 */
export function isSameComplainant(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na.length === 0 || nb.length === 0) return false;
  if (na === nb) return true;
  // 2026-08-25 — user report: recurring duplicate-complaint pattern where
  // different outlets name the SAME filer with extra context appended —
  // "Pintér Bence" / "Pintér Bence (Győr polgármestere)", "Miniszterelnökség"
  // / "Miniszterelnökség (Ruff Bálint)". Substring containment catches this
  // for free (no AI call) without weakening the Gondosóra-guard above: two
  // GENUINELY different institutions (e.g. "Integritás Hatóság" vs
  // "Tudományos és Technológiai Minisztérium") never contain one another.
  return na.includes(nb) || nb.includes(na);
}

const SAME_COMPLAINANT_SYSTEM = `Te egy magyar korrupció-figyelő szerkesztő asszisztens vagy. Két megnevezést kapsz, amik egy-egy feljelentés BENYÚJTÓJÁRA utalnak (cikkenként eltérő megfogalmazásban). Döntsd el, hogy UGYANARRA a valós szereplőre utalnak-e — pl. egy minisztérium és az azt A CIKK IDEJÉN vezető miniszter/államtitkár neve ugyanaz a bejelentő, mert a személy a hivatal nevében jár el (pl. "Külügyminisztérium" és "Orbán Anita" ugyanaz, ha ő a külügyminiszter; "a kormány" és egy konkrét minisztérium neve is gyakran ugyanaz). Csak akkor mondj "true"-t, ha ténylegesen ugyanaz a szereplő, ne csak hasonló témában.`;

const SAME_COMPLAINANT_TOOL: LlmToolSpec = {
  name: 'same_complainant',
  description: 'Decide whether two filer names/descriptions refer to the same real-world complainant.',
  schema: {
    type: 'object',
    properties: {
      same: { type: 'boolean', description: 'True only if both names refer to the same real-world person/institution acting as filer.' },
    },
    required: ['same'],
  },
};

/**
 * AI fallback for isSameComplainant() — ONLY meant to be called when the
 * free textual check (exact/substring) already returned false, and ONLY
 * when a target-name match already suggests the same underlying case (l.
 * detect-criminal-complaints.ts hívási hely) — így nem szór feleslegesen
 * AI-hívást minden egyes új feljelentésre, csak a valóban kétséges
 * esetekre. Bridge-eli azt a rést, amit semmilyen string-hasonlóság nem
 * tud: "Külügyminisztérium" és "Orbán Anita" szövegszinten nulla átfedés,
 * mégis ugyanaz a bejelentő (2026-08-25, lélegeztetőgép-ügy, 3 duplikátum
 * sor jött belőle, mire ez a fallback megépült).
 */
export async function isSameComplainantAi(a: string, b: string): Promise<boolean> {
  const user = `A megnevezés: ${a}\n\nB megnevezés: ${b}`;
  const { data } = await llmExtract<{ same: boolean }>({
    system: SAME_COMPLAINANT_SYSTEM,
    user,
    tool: SAME_COMPLAINANT_TOOL,
    maxTokens: 100,
  });
  return Boolean(data?.same);
}

/**
 * 2026-08-25 — user report ("Mandiner"-eset): egy cikk 2026-08-24-i
 * megjelenéséhez a modell 2026-06-24-i eseménydátumot rendelt — ugyanaz a
 * nap, pontosan 2 hónappal korábbra, holott a prompt explicit közli a
 * "Mai dátum"-ot. Ismert LLM-gyengeség: bizonytalan dátum-reasoningnél a
 * modell hajlamos a saját betanítási vágópontjához közeli dátum felé
 * húzni, felülírva a promptban explicit megadott kontextust — a user
 * szerint egy MÁSIK, teljesen független eszköznél (LangDock) is
 * ugyanezt tapasztalta, ami megerősíti: ez általános LLM-jelenség, nem
 * egyedi bug.
 *
 * NEM minden korai dátum hallucináció — egy cikk tényleg szólhat egy
 * hetekkel korábbi eseményről —, ezért ez a függvény sosem dob el semmit,
 * csak jelzi, hogy a hívónak emberi jóváhagyásra kell küldenie (nem
 * auto-publikálnia), akkor is, ha a confidence egyébként engedné.
 */
export function isSuspiciouslyEarlyDate(
  extractedDateIso: string,
  articleDateIso: string,
  thresholdDays: number = 30,
): boolean {
  const extracted = new Date(extractedDateIso);
  const article = new Date(articleDateIso);
  if (Number.isNaN(extracted.getTime()) || Number.isNaN(article.getTime())) return false;
  const diffDays = (article.getTime() - extracted.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > thresholdDays;
}
