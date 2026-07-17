/**
 * Truncates to at most `max` characters, breaking on the last preceding
 * word boundary and appending an ellipsis, so generated <title>/description
 * values from free-text DB/config content never blow past SEO limits.
 */
export function truncate(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
  return trimmed.replace(/[,;:.\-—]+$/, '') + '…';
}

// A bare fact ("X — dokumentált eset") doesn't earn a click in a SERP the
// way a hook does. These CTAs get appended to every meta description via
// withCta() below — varied by case status so 900+ /adatbazis pages don't
// all carry the identical closing line.
const CTA_OPEN = 'Kattints, és nézd meg, hol tart most az ügy!';
const CTA_CLOSED = 'Kattints, és nézd meg, mi lett a vége!';
const CTA_GENERIC = 'Kattints, és ismerd meg a részleteket!';
const CTA_PERSON = 'Kattints, és nézd meg az összes ügyét!';
const CTA_RESIGNATION = 'Kattints, és nézd meg, hogy áll most!';

export function ctaForCase(isOpen: boolean | null | undefined): string {
  if (isOpen === true) return CTA_OPEN;
  if (isOpen === false) return CTA_CLOSED;
  return CTA_GENERIC;
}

export function ctaGeneric(): string {
  return CTA_GENERIC;
}

export function ctaPerson(): string {
  return CTA_PERSON;
}

export function ctaResignation(): string {
  return CTA_RESIGNATION;
}

/**
 * Appends a CTA to a base description, trimming the base (never the CTA —
 * a cut-off hook reads worse than a cut-off fact) so the joined string
 * still fits Google's ~155-char SERP snippet budget.
 */
export function withCta(base: string, cta: string, max = 155): string {
  const clean = base.trim();
  if (!clean) return cta;
  const join = (text: string) => `${text}${/[.!?…]$/.test(text) ? ' ' : '. '}${cta}`;
  const full = join(clean);
  if (full.length <= max) return full;
  // Reserve room assuming the widest (". ") separator; join() re-checks the
  // truncated text's actual ending so "…" never collides with ". ".
  const budget = max - cta.length - 2;
  if (budget < 20) return truncate(clean, max);
  const result = join(truncate(clean, budget));
  return result.length <= max ? result : truncate(clean, max);
}
