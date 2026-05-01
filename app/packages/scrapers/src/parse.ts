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

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const t = Date.parse(value);
  if (!Number.isNaN(t)) return new Date(t);
  // Try common Hungarian "YYYY. MM. DD." form.
  const m = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?/.exec(value.trim());
  if (m) {
    const [, y, mo, d] = m;
    return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  }
  return null;
}

export function metaContent($: cheerio.CheerioAPI, name: string): string | null {
  const v =
    $(`meta[property="${name}"]`).attr('content') ??
    $(`meta[name="${name}"]`).attr('content');
  return v ? v.trim() : null;
}
