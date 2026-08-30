/**
 * Tiszta, tesztelhető mérföldkő-küszöb logika a check-social-triggers.ts-hez
 * — user kérés, 2026-08-30: minden +1000 milliárd Ft-onként egy Facebook-
 * poszt-jelölt a feljelentési összegről.
 */

export const MILESTONE_STEP_FT = 1_000_000_000_000n; // 1000 milliárd Ft

/** A jelenlegi (lefelé kerekített) küszöb, vagy null, ha még az elsőt sem
 *  érte el, VAGY ha ez a küszöb már korábban ki lett postolva/jóváhagyva. */
export function computeNextMilestone(currentTotalFt: bigint, lastPostedMilestoneFt: bigint): bigint | null {
  if (currentTotalFt <= 0n) return null;
  const currentThreshold = (currentTotalFt / MILESTONE_STEP_FT) * MILESTONE_STEP_FT;
  if (currentThreshold <= 0n) return null;
  if (currentThreshold <= lastPostedMilestoneFt) return null;
  return currentThreshold;
}

// NEM toLocaleString('hu-HU')-val — Node ICU-build-függő, hogy tesz-e
// ezres tagolást BigIntre (élesben Vercel Node-on nem megbízható). A
// milestone-lépték (1000 Mrd) miatt ez amúgy is mindig kerek szám marad.
export function formatMilliardLabel(ft: bigint): string {
  const mrd = ft / 1_000_000_000n;
  return `${mrd} milliárd Ft`;
}
