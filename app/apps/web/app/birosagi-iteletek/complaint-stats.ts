// Egyetlen forrás a "/birosagi-iteletek" Feljelentések szekció fölötti
// feljelentési értékösszeg-számlálóhoz (user kérés, 2026-08-07).
//
// A CriminalComplaint.amountLabel szabad magyar szöveg (pl. "106 milliárd
// Ft", "~60 milliárd Ft", "100 milliárd Ft felett", "2,8 milliárd Ft
// (informatikai rendszer) + 4,6 milliárd Ft (üzemeltetés)"), NEM numerikus
// oszlop — l. schema.ts kommentje. Ez a modul olvassa ki belőle az összes
// "szám + milliárd/millió" előfordulást és összegzi Ft-ban; egy összetett
// (több tételes) label minden tételét hozzáadja. Ha egy feljelentésnek
// nincs felismerhető összege (amountLabel null/üres, vagy nem tartalmaz
// számot), egyszerűen nem ad hozzá semmit a számlálóhoz — a számláló ilyenkor
// NEM esik vissza, csak nem nő.

// A trailing \b NEM használható itt: JS-ben a \w (és így \b) csak ASCII
// betűket ismer fel, "millió" ó-ra végződik, ami nem \w — a határ emiatt
// sose illeszkedne "millió Ft" esetén. Helyette Unicode-tudatos negatív
// lookahead (nem követheti betű, azaz nem folytatódhat pl. "milliárdos"-sá).
const AMOUNT_RE = /(\d+(?:[.,]\d+)?)\s*(milliárd|millió)(?!\p{L})/giu;
// "félmilliárd" külön szó, nincs előtte leírt szám — a fenti regex nem
// illeszkedik rá (nincs \d közvetlenül a "milliárd" előtt), ezért nem
// számolja duplán.
const FELMILLIARD_RE = /félmilliárd(?!\p{L})/giu;

export function parseComplaintAmountFt(label: string | null | undefined): bigint {
  if (!label) return 0n;
  let total = 0n;
  for (const m of label.matchAll(AMOUNT_RE)) {
    const numStr = m[1];
    const unit = m[2];
    if (!numStr || !unit) continue;
    const value = parseFloat(numStr.replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    const multiplier = unit.toLowerCase() === 'milliárd' ? 1_000_000_000 : 1_000_000;
    total += BigInt(Math.round(value * multiplier));
  }
  const felCount = (label.match(FELMILLIARD_RE) ?? []).length;
  total += BigInt(felCount) * 500_000_000n;
  return total;
}

export type ComplaintStatRow = { amountLabel: string | null };

export function computeComplaintTotal(rows: ComplaintStatRow[]): bigint {
  return rows.reduce((s, r) => s + parseComplaintAmountFt(r.amountLabel), 0n);
}

// Alap sávvég 1000 milliárd Ft; ha a számláló eléri/túllépi, 5000 milliárd
// Ft-ra ugrik (user kérés — ez NEM jelképes cél, csak a sáv skálázásának
// felső határa, l. VerdictList.tsx feliratozás).
export const COMPLAINT_BAR_BASE_FT = 1_000_000_000_000n;
export const COMPLAINT_BAR_JUMPED_FT = 5_000_000_000_000n;

export function computeComplaintBarMax(total: bigint): bigint {
  return total >= COMPLAINT_BAR_BASE_FT ? COMPLAINT_BAR_JUMPED_FT : COMPLAINT_BAR_BASE_FT;
}
