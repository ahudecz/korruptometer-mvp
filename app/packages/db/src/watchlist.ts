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
const CALLED_TO_RESIGN = [
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

export const WATCHLIST_PERSONS: readonly string[] = [
  ...CALLED_TO_RESIGN,
  ...GALLERY_PERSONS,
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
