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

// A képre írt NAGY szám kompakt "Mrd" formája — user report, 2026-08-31:
// "2000 milliárd Ft" 128px-es betűvel új sorba tört a "Ft"-nél. A caption/
// cím továbbra is a teljes "milliárd Ft" alakot használja (formatMilliardLabel),
// csak a képen lévő nagy szám rövidül — ugyanaz a minta, mint a site FtValue
// komponensének 'short' módja.
export function formatMilliardLabelShort(ft: bigint): string {
  const mrd = ft / 1_000_000_000n;
  return `${mrd} Mrd Ft`;
}

// A mérföldkő-kép nagy, piros összegsorának betűmérete a szöveg
// HOSSZÁTÓL függ, nem fix szám — user report, 2026-08-31: egy statikus
// méret vagy túl kicsinek tűnt a jelenlegi rövid számokra ("2000 milliárd
// Ft"), vagy túl szorosan fért volna ki egy jövőbeli, hosszabb (5-jegyű)
// mérföldkőnél. Az arányt (0.435 px/karakter fontSize-egységenként)
// próba-renderekkel kalibráltam a social-image.tsx Satori-sablonjához
// (900-as vastagságú sans-serif) — ha a sablon paddingja/betűtípusa
// változna, ezt újra kell hangolni ugyanígy: renderelj néhány próba-képet
// különböző fontSize-okkal, és nézd meg, melyik a legnagyobb, ami még
// nem lóg túl a jobb margón.
export function amountFontSize(label: string): number {
  const AVAILABLE_PX = 800; // a kép szélessége mínusz a padding és egy biztonsági margó
  const CHAR_WIDTH_RATIO = 0.435;
  return Math.min(140, Math.max(70, Math.floor(AVAILABLE_PX / (label.length * CHAR_WIDTH_RATIO))));
}
