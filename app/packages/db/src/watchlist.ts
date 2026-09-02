/**
 * 003-detection-review-engine — unified watchlist.
 *
 * Single source of truth for the monitored persons whose detections MUST always
 * go to editorial review (never auto-published), regardless of confidence:
 *   - the 8 "lemondásra felszólított" (called-to-resign) office holders, and
 *   - the 10 highlighted gallery persons.
 *
 * Previously these lists were duplicated across detect-resignations.ts and
 * scrapers/relevance.ts; this module consolidates them.
 */

// Hungarian honorifics that can prefix a name without changing who it
// refers to. Mirrors the equivalent list in
// apps/web/src/lib/investigation/normalize-name.ts (a separate module for
// the investigation-clustering feature, which already had to solve this
// same problem — kept as two lists rather than a shared import because the
// two packages don't otherwise depend on each other).
const HONORIFIC_TOKENS = new Set(['dr', 'ifj', 'id', 'prof']);

/**
 * Normalised name key: lowercase, accent- and punctuation-insensitive,
 * trimmed, leading honorific stripped.
 *
 * 2026-08-07 — bug report: "Dr. Fürcht Pál" (created 2026-06-14) and
 * "Fürcht Pál" (created 2026-08-07, extracted from an unrelated follow-up
 * article that recapped the same June resignation as background) normalized
 * to DIFFERENT keys ("dr furcht pal" vs "furcht pal") because the honorific
 * was never stripped — isDuplicate()'s exact-match dedup treated them as two
 * different people and let the recap through as a "new" resignation. Strip
 * the honorific so both forms collapse to the same identity key regardless
 * of which article happened to include the title.
 */
export function normalizeName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation → space
    .replace(/\s+/g, ' ')
    .trim();

  // Peel leading honorific tokens ("dr", "prof", "ifj", "id") — bounded so a
  // pathological input can't loop, and never strips the last remaining
  // token (an honorific never appears without an actual name following).
  let s = base;
  for (let i = 0; i < 4; i += 1) {
    const [first, ...rest] = s.split(' ');
    if (!first || rest.length === 0 || !HONORIFIC_TOKENS.has(first)) break;
    s = rest.join(' ');
  }
  return s;
}

// 8 "lemondásra felszólított" — NER key office holders.
export const CALLED_TO_RESIGN = [
  'Sulyok Tamás',
  'Polt Péter',
  'Nagy Gábor Bálint',
  'Varga Zs. András',
  'Windisch László',
  'Rigó Csaba Balázs',
  'Koltay András',
  'Senyei György',
];

// 10 highlighted gallery persons.
const GALLERY_PERSONS = [
  'Orbán Viktor',
  'Rogán Antal',
  'Mészáros Lőrinc',
  'Tiborcz István',
  'Szíjjártó Péter',
  'Takács Péter',
  'Matolcsy György',
  'Lázár János',
  'Balásy Gyula',
  'Semjén Zsolt',
];

// Tisza-kormány miniszterei — kirúgás/felmentés esetén szerkesztői jóváhagyás kell.
const MINISTER_PERSONS = [
  'Magyar Péter',
  'Orbán Anita',
  'Ruff Bálint',
  'Kármán András',
  'Pósfai Gábor',
  'Görög Márta',
  'Hegedűs Zsolt',
  'Lannert Judit',
  'Kapitány István',
  'Vitézy Dávid',
  'Ruszin-Szendi Romulusz',
  'Bóna Szabolcs',
  'Kátai-Németh Vilmos',
  'Lőrincz Viktória',
  'Gajdos László',
  'Tarr Zoltán',
  'Tanács Zoltán',
  'Forsthoffer Ágnes',
];

export const WATCHLIST_PERSONS: readonly string[] = [
  ...CALLED_TO_RESIGN,
  ...GALLERY_PERSONS,
  ...MINISTER_PERSONS,
];

// Pre-normalised token sets for matching.
const WATCHLIST_TOKENS = WATCHLIST_PERSONS.map((p) =>
  normalizeName(p)
    .split(' ')
    .filter((t) => t.length > 2),
);

/**
 * True if the extracted name refers to a watchlist person. Tolerant of accents,
 * casing, extra words and word order: every meaningful token of a watchlist
 * name must appear in the extracted name.
 */
export function isWatchlistPerson(extractedName: string): boolean {
  const n = normalizeName(extractedName);
  return WATCHLIST_TOKENS.some(
    (parts) => parts.length > 0 && parts.every((part) => n.includes(part)),
  );
}

// 2026-07-26 — user kérés: a 8 CALLED_TO_RESIGN tisztségviselő lemondása/
// eltávolítása MINDIG kapjon örökre-BREAKING jelölést a lemondás-táblázatban,
// a nyitón és a saját végoldalán, FÜGGETLENÜL attól, hogy a cikk még friss-e
// (l. PoliticalResignation.pinned + a 3 megjelenítési felület). Ez egy
// SZÁNDÉKOSAN KÜLÖN lista a WATCHLIST_PERSONS-tól: annak a célja "kötelező
// szerkesztői jóváhagyás", ez viszont "örök vizuális kiemelés" — a kettő nem
// ugyanaz a döntés (pl. Gulyás Gergely lemondása annak idején simán auto-
// publikálódott, mégis örök kiemelést kap most). A user időnként bővíti ezt
// a listát ("a többit majd mindig mondom") — új nevet ide vegyél fel, NE a
// WATCHLIST_PERSONS-ba.
export const PERMANENT_BREAKING_NAMES: readonly string[] = [
  ...CALLED_TO_RESIGN,
  // 2026-08-23 — user kérés: Lázár János (OGY-mandátum lemondása) vette át
  // Hende Csaba helyét — nagyobb súlyú, aktuálisabb sztori a "Top lemondások"
  // homepage-kártyán (l. page.tsx TOP_RESIGNATION_PRIORITY, ami erről a
  // listáról származtatva épül).
  'Lázár János',
  'Gulyás Gergely',
  'Szíjjártó Péter',
  'Császár Attila',
  'Németh Zsolt',
];

const PERMANENT_BREAKING_TOKENS = PERMANENT_BREAKING_NAMES.map((p) =>
  normalizeName(p)
    .split(' ')
    .filter((t) => t.length > 2),
);

/** True if this person should get the permanent (never-expiring) BREAKING marker once they leave — l. PERMANENT_BREAKING_NAMES komment. */
export function isPermanentBreakingPerson(extractedName: string): boolean {
  const n = normalizeName(extractedName);
  return PERMANENT_BREAKING_TOKENS.some(
    (parts) => parts.length > 0 && parts.every((part) => n.includes(part)),
  );
}

const CALLED_TO_RESIGN_TOKENS = CALLED_TO_RESIGN.map((p) =>
  normalizeName(p)
    .split(' ')
    .filter((t) => t.length > 2),
);

/**
 * True for the narrower 8-person CALLED_TO_RESIGN set specifically (a
 * subset of isWatchlistPerson()'s WATCHLIST_PERSONS) — used to route these
 * 8 constitutional office holders differently from the broader watchlist:
 * 2026-09-01 user report (Polt Péter): a mandátum-megszűnésük a
 * detect-watchlist-removals.ts külön, 2-forrásos crontja miatt AMÚGY IS
 * auto-publikál (l. notify-auto-publish.ts), de a detect-resignations.ts
 * generikus, 1-cikkes ága eddig a decideStatus() "watchlist sosem auto-
 * publikál" szabálya miatt ezt a sort is örökre 'pending'-ben hagyta — és
 * arra a queue-ra ("azt a jóváhagyást nem nézi senki", user szó szerint)
 * senki nem reagált időben. A GALLERY_PERSONS/MINISTER_PERSONS (a
 * WATCHLIST_PERSONS többi tagja) NEM kap ilyen kivételt — nincs párhuzamos,
 * szigorú auto-publikáló pályájuk, és sokkal nagyobb/zajosabb a halmaz.
 */
export function isCalledToResignPerson(extractedName: string): boolean {
  const n = normalizeName(extractedName);
  return CALLED_TO_RESIGN_TOKENS.some(
    (parts) => parts.length > 0 && parts.every((part) => n.includes(part)),
  );
}
