/**
 * Tiszta (DB-mentes) validációs függvények a szavazat-beküldéshez —
 * lásd contracts/poll-api.md validációs sorrendjét. Ezek a POST
 * /api/poll/vote route-ból hívódnak, de önmagukban is tesztelhetők.
 */

export type ValidationResult = { valid: true } | { valid: false; error: string };

/** FR-014 — a rejtett csali-mező kitöltve = bot, a beküldés nem folytatódik. */
export function checkHoneypot(honeypot: unknown): ValidationResult {
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
    return { valid: false, error: 'honeypot' };
  }
  return { valid: true };
}

/** FR-005 — 1 és 5 (vagy a kérdés saját min/max-a) közötti darabszám. */
export function checkSelectionCount(
  optionIds: unknown,
  minSelect: number,
  maxSelect: number,
): ValidationResult {
  if (!Array.isArray(optionIds) || optionIds.some((id) => typeof id !== 'string')) {
    return { valid: false, error: 'Érvénytelen kiválasztás.' };
  }
  const unique = new Set(optionIds);
  if (unique.size !== optionIds.length) {
    return { valid: false, error: 'Egy ügyet csak egyszer választhatsz ki.' };
  }
  if (optionIds.length < minSelect) {
    return { valid: false, error: 'Válassz ki legalább egy ügyet.' };
  }
  if (optionIds.length > maxSelect) {
    return { valid: false, error: `Legfeljebb ${maxSelect} ügyet választhatsz ki.` };
  }
  return { valid: true };
}

/** Minden kiválasztott opció ténylegesen a kérdéshez tartozik-e. */
export function checkOptionsBelongToQuestion(
  optionIds: string[],
  validOptionIds: ReadonlySet<string>,
): ValidationResult {
  const unknown = optionIds.filter((id) => !validOptionIds.has(id));
  if (unknown.length > 0) {
    return { valid: false, error: 'Ismeretlen ügy szerepel a kiválasztásban.' };
  }
  return { valid: true };
}
