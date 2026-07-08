import { XMLParser } from 'fast-xml-parser';

import type { ScrapedArticle } from './types';
import { clipExcerpt, parseDate } from './parse';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  cdataPropName: '#cdata',
  textNodeName: '#text',
});

type RawMediaContent =
  | { '@_url'?: string; '@_medium'?: string }
  | Array<{ '@_url'?: string; '@_medium'?: string }>;

type RawItem = {
  title?: string | { '#cdata'?: string; '#text'?: string };
  link?: string | { '#text'?: string; '@_href'?: string };
  description?: string | { '#cdata'?: string; '#text'?: string };
  pubDate?: string;
  category?: string | { '#cdata'?: string } | Array<string | { '#cdata'?: string }>;
  'dc:creator'?: string;
  'content:encoded'?: string;
  'media:content'?: RawMediaContent;
  'media:thumbnail'?: { '@_url'?: string } | Array<{ '@_url'?: string }>;
  enclosure?: { '@_url'?: string; '@_type'?: string };
};

type RawRss = {
  rss?: { channel?: { item?: RawItem | RawItem[] } };
};

function pickText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    const obj = value as { '#cdata'?: string; '#text'?: string };
    return (obj['#cdata'] ?? obj['#text'] ?? '').trim();
  }
  return String(value).trim();
}

function pickLink(value: RawItem['link']): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return (value['#text'] ?? value['@_href'] ?? '').trim();
}

function pickCategory(value: RawItem['category']): string | null {
  if (!value) return null;
  const first = Array.isArray(value) ? value[0] : value;
  const text = pickText(first);
  return text.length > 0 ? text : null;
}

function pickImageUrl(item: RawItem): string | null {
  // 1. media:content (prefer image medium, else first entry)
  if (item['media:content']) {
    const mc = item['media:content'];
    const arr = Array.isArray(mc) ? mc : [mc];
    const img = arr.find((m) => m['@_medium'] === 'image') ?? arr[0];
    if (img?.['@_url']) return img['@_url'];
  }
  // 2. media:thumbnail
  if (item['media:thumbnail']) {
    const mt = item['media:thumbnail'];
    const first = Array.isArray(mt) ? mt[0] : mt;
    if (first?.['@_url']) return first['@_url'];
  }
  // 3. enclosure (RSS 2.0 image attachment)
  if (item.enclosure?.['@_url'] && item.enclosure['@_type']?.startsWith('image/')) {
    return item.enclosure['@_url'];
  }
  // 4. First <img src="..."> in description/content
  const raw = pickText(item.description) || pickText(item['content:encoded']);
  const m = raw.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m?.[1]) return m[1];
  return null;
}

// Named entities RSS feeds commonly ship (beyond the numeric/hex entities
// handled generically below).
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  hellip: '…',
  mdash: '—',
  ndash: '–',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
};

/**
 * Decodes HTML entities RSS/XML feeds embed in <title>/<description> text —
 * both numeric (&#39; &#039; &#x27;) and named (&amp; &nbsp; …). Must run on
 * every text field pulled out of RSS content, not just descriptions: a
 * feed's <title> is just as likely to contain an escaped apostrophe (e.g.
 * "&#039;70-es évek") as its <description>, and the old code only ever
 * decoded the latter — leaving raw entities visible on the site.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function stripHtml(text: string): string {
  // Most RSS descriptions ship with <p>, <a>, <br>, <img>, etc. Strip
  // tags conservatively so the excerpt is plain text.
  return decodeEntities(text)
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseRss(xml: string): ScrapedArticle[] {
  const data = parser.parse(xml) as RawRss;
  const itemsRaw = data.rss?.channel?.item;
  if (!itemsRaw) return [];
  const items = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];
  const out: ScrapedArticle[] = [];
  for (const item of items) {
    const sourceUrl = pickLink(item.link);
    if (!sourceUrl) continue;
    const headline = decodeEntities(pickText(item.title));
    if (!headline) continue;
    const description = pickText(item.description) || pickText(item['content:encoded']);
    const excerpt = clipExcerpt(stripHtml(description));
    const publishedAt = parseDate(item.pubDate ?? null) ?? new Date();
    const tag = pickCategory(item.category);
    const imageUrl = pickImageUrl(item);
    out.push({ headline, excerpt, sourceUrl, publishedAt, tag, imageUrl });
  }
  return out;
}
