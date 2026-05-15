import * as cheerio from 'cheerio';

export const EXCERPT_MAX = 280;

export function loadHtml(html: string) {
  return cheerio.load(html);
}

export function clipExcerpt(text: string | null | undefined): string {
  const cleaned = (text ?? '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= EXCERPT_MAX) return cleaned;
  return `${cleaned.slice(0, EXCERPT_MAX - 1).trimEnd()}…`;
}

export function absoluteUrl(href: string | undefined, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

const HUNGARIAN_MONTHS: Record<string, number> = {
  január: 1, február: 2, március: 3, április: 4, május: 5, június: 6,
  július: 7, augusztus: 8, szeptember: 9, október: 10, november: 11, december: 12,
};

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Try our known Hungarian forms first so they aren't intercepted by the
  // permissive `Date.parse` (which would interpret them as local-time).
  const numeric = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?/.exec(trimmed);
  if (numeric && numeric[1] && numeric[2] && numeric[3]) {
    return new Date(
      Date.UTC(Number(numeric[1]), Number(numeric[2]) - 1, Number(numeric[3])),
    );
  }
  // Hungarian "YYYY. <hónap> N." form (used by K-Monitor cards).
  const named = /^(\d{4})\.\s*([a-záéíóöőúüű]+)\s+(\d{1,2})\.?/i.exec(trimmed);
  if (named && named[1] && named[2] && named[3]) {
    const month = HUNGARIAN_MONTHS[named[2].toLowerCase()];
    if (month) {
      return new Date(Date.UTC(Number(named[1]), month - 1, Number(named[3])));
    }
  }
  // Fall back to native parse for ISO / RFC 1123 strings from RSS feeds.
  const t = Date.parse(trimmed);
  if (!Number.isNaN(t)) return new Date(t);
  return null;
}

export function metaContent($: cheerio.CheerioAPI, name: string): string | null {
  const v =
    $(`meta[property="${name}"]`).attr('content') ??
    $(`meta[name="${name}"]`).attr('content');
  return v ? v.trim() : null;
}
