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

// Alap sávvég 1000 milliárd Ft; ha a számláló eléri/túllépi, 10 000 milliárd
// Ft-ra ugrik (user kérés, 2026-08-30 — az 5000 milliárdos felső határ túl
// hamar betelt volna; ez NEM jelképes cél, csak a sáv skálázásának felső
// határa, l. VerdictList.tsx feliratozás).
export const COMPLAINT_BAR_BASE_FT = 1_000_000_000_000n;
export const COMPLAINT_BAR_JUMPED_FT = 10_000_000_000_000n;

export function computeComplaintBarMax(total: bigint): bigint {
  return total >= COMPLAINT_BAR_BASE_FT ? COMPLAINT_BAR_JUMPED_FT : COMPLAINT_BAR_BASE_FT;
}

// "Legnagyobb feljelentők" blokk (user kérés, 2026-08-30) — a feljelentési
// értékösszeg-számláló alatt, a kormány és a nagy intézményi/hatósági
// bejelentők (nem magánszemélyek, nem pártok) rangsora esetszám + érték
// alapján. Csak intézményi feljelentőket mutatunk, mert egy 1-2
// magánszemély/politikus (pl. Hadházy Ákos, Vitézy Dávid) simán bekerülne a
// négybe puszta darabszám vagy egy nagy összegű ügy miatt, holott a user
// szándéka szerint ez a blokk a hatóságokat/civil szervezeteket rangsorolja,
// nem az egyéni feljelentőket.
const INSTITUTIONAL_FILER_KEYWORDS = [
  'állami számvevőszék',
  'transparency international',
  'integritás hatóság',
  'gazdasági versenyhivatal',
  'ügyészség',
  'alapvető jogok biztosa',
];

function looksGovernmentFiled(filerName: string): boolean {
  const n = filerName.toLowerCase();
  return (
    n.includes('minisztérium') ||
    n.includes('miniszterelnökség') ||
    n === 'kormány' ||
    n === 'a kormány' ||
    n.includes('tisza-kormány')
  );
}

function isInstitutionalFiler(filerName: string): boolean {
  const n = filerName.toLowerCase();
  return looksGovernmentFiled(filerName) || INSTITUTIONAL_FILER_KEYWORDS.some(k => n.includes(k));
}

// A minisztériumi bejelentők egy "Kormány" csoportba, a Transparency
// International-variánsok ("...Magyarország" is előfordul) pedig egy közös
// névre vonódnak össze — l. kormanyhu-match.ts looksGovernmentFiled().
function normalizeFilerGroupName(filerName: string): string {
  if (looksGovernmentFiled(filerName)) return 'Kormány';
  const n = filerName.toLowerCase();
  if (n.includes('transparency international')) return 'Transparency International';
  if (n.includes('állami számvevőszék')) return 'Állami Számvevőszék (ÁSZ)';
  if (n.includes('integritás hatóság')) return 'Integritás Hatóság';
  return filerName;
}

export type TopFilerRow = { filerName: string; amountLabel: string | null };
export type TopFilerStat = { name: string; count: number; amount: bigint };

export function computeTopFilers(rows: TopFilerRow[], limit = 4): TopFilerStat[] {
  const groups = new Map<string, TopFilerStat>();
  for (const r of rows) {
    if (!r.filerName || !isInstitutionalFiler(r.filerName)) continue;
    const name = normalizeFilerGroupName(r.filerName);
    const g = groups.get(name) ?? { name, count: 0, amount: 0n };
    g.count += 1;
    g.amount += parseComplaintAmountFt(r.amountLabel);
    groups.set(name, g);
  }
  return [...groups.values()].sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : b.count - a.count)).slice(0, limit);
}
