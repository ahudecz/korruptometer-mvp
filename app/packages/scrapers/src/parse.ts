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

/**
 * 2026-07-13 — utolsó esély a publikálási dátumra, mielőtt a hívó new Date()
 * (=ma) dátumra esne vissza. Sok magyar hírportál (444, telex, index stb.)
 * az URL útvonalába égeti a dátumot ("/2026/07/13/cikk-cim") — ha az
 * article:published_time meta és a <time datetime> is hiányzik (gyakori
 * nem-konfigurált outleteknél), ez még mindig helyes dátumot ad egy
 * "6 napos cikk mai dátummal került be" hiba helyett.
 */
export function parseDateFromUrl(url: string): Date | null {
  const m = /\/(20\d{2})\/(\d{1,2})\/(\d{1,2})(?:\/|$|[?#-])/.exec(url);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function metaContent($: cheerio.CheerioAPI, name: string): string | null {
  const v =
    $(`meta[property="${name}"]`).attr('content') ??
    $(`meta[name="${name}"]`).attr('content');
  return v ? v.trim() : null;
}
