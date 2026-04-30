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

export function fmtFt(n: number | bigint): string {
  const value = typeof n === 'bigint' ? Number(n) : n;
  if (!Number.isFinite(value)) return '— Ft';
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    const billions = Math.floor((abs / 1_000_000_000) * 10) / 10;
    return `${formatHuDecimal(billions)} Mrd Ft`;
  }
  if (abs >= 1_000_000) {
    return `${Math.floor(abs / 1_000_000)} M Ft`;
  }
  if (abs >= 1_000) {
    return `${Math.floor(abs / 1_000)} e Ft`;
  }
  return `${HU_NUMBER.format(abs)} Ft`;
}

function formatHuDecimal(n: number): string {
  // 4.2 → "4,2" ; 4 → "4"
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
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
