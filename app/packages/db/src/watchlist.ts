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

/** Normalised name key: lowercase, accent- and punctuation-insensitive, trimmed. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation → space
    .replace(/\s+/g, ' ')
    .trim();
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
  'Hende Csaba',
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
