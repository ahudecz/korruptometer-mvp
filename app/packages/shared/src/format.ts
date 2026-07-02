/**
 * Hungarian-locale formatters for currency, dates, numbers, and personal initials.
 *
 * Currency contract (FR-012, SC-005): always pick the magnitude bucket via integer
 * division — never delegate to Intl.NumberFormat compact notation, since that uses
 * different bucket boundaries.
 *
 *   n < 1_000              → "<n> Ft"             (non-breaking thin spaces from hu-HU locale)
 *   1_000 ≤ n < 1_000_000  → "<n / 1_000> e Ft"
 *   1_000_000 ≤ n < 1e9    → "<n / 1_000_000> M Ft"
 *   n ≥ 1_000_000_000      → "<n / 1_000_000_000> Mrd Ft"
 *
 * For amounts ≥ 1 Mrd we keep one decimal (Hungarian decimal comma) so '4_200_000_000'
 * renders as '4,2 Mrd Ft', mirroring the mockup's tone.
 */

const HU_NUMBER = new Intl.NumberFormat('hu-HU');
const HU_DATE = new Intl.DateTimeFormat('hu-HU', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Strukturált pénz-formátum: a számérték és a mértékegység külön, hogy a UI
 * reszponzívan válthasson hosszú ("Milliárd") és rövid ("Mrd") forma között.
 * Csak a milliárdos sávnak van eltérő hosszú/rövid alakja; a többi azonos.
 */
export function fmtFtParts(n: number | bigint): {
  value: string;
  unitLong: string;
  unitShort: string;
} {
  const value = typeof n === 'bigint' ? Number(n) : n;
  if (!Number.isFinite(value)) return { value: '—', unitLong: 'Ft', unitShort: 'Ft' };
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    const billionsRaw = abs / 1_000_000_000;
    // 100 Mrd alatt 1 tizedes (kifér, és pontosabb: „1,6 Mrd"); 100 Mrd felett
    // tizedes nélkül, mert a hatalmas összeg (pl. 23 167) így fér egy sorba.
    const value =
      billionsRaw >= 100
        ? HU_NUMBER.format(Math.floor(billionsRaw))
        : (Math.floor(billionsRaw * 10) / 10).toLocaleString('hu-HU', { maximumFractionDigits: 1 });
    return { value, unitLong: 'Milliárd Ft', unitShort: 'Milliárd Ft' };
  }
  if (abs >= 1_000_000) {
    return { value: String(Math.floor(abs / 1_000_000)), unitLong: 'millió Ft', unitShort: 'millió Ft' };
  }
  if (abs >= 1_000) {
    return { value: String(Math.floor(abs / 1_000)), unitLong: 'e Ft', unitShort: 'e Ft' };
  }
  return { value: HU_NUMBER.format(abs), unitLong: 'Ft', unitShort: 'Ft' };
}

/**
 * Sztring pénz-formátum. Alapból a hosszú alak ("… Milliárd Ft"); `short: true`
 * esetén a tömör "… Mrd Ft" (szűk helyekre, ahol a hosszú nem fér ki).
 */
export function fmtFt(n: number | bigint, opts?: { short?: boolean }): string {
  const { value, unitLong, unitShort } = fmtFtParts(n);
  return `${value} ${opts?.short ? unitShort : unitLong}`;
}

export function fmtNumber(n: number): string {
  return HU_NUMBER.format(n);
}

export function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return HU_DATE.format(date);
}

export function initials(name: string): string {
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.replace(/\.$/, ''));
  const first = parts[0];
  if (!first) return '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? '';
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}
