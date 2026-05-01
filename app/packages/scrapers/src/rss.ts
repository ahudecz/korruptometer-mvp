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

type RawItem = {
  title?: string | { '#cdata'?: string; '#text'?: string };
  link?: string | { '#text'?: string; '@_href'?: string };
  description?: string | { '#cdata'?: string; '#text'?: string };
  pubDate?: string;
  category?: string | { '#cdata'?: string } | Array<string | { '#cdata'?: string }>;
  'dc:creator'?: string;
  'content:encoded'?: string;
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

function stripHtml(text: string): string {
  // Most RSS descriptions ship with <p>, <a>, <br>, <img>, etc. Strip
  // tags conservatively so the excerpt is plain text.
  return text
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
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
    const headline = pickText(item.title);
    if (!headline) continue;
    const description = pickText(item.description) || pickText(item['content:encoded']);
    const excerpt = clipExcerpt(stripHtml(description));
    const publishedAt = parseDate(item.pubDate ?? null) ?? new Date();
    const tag = pickCategory(item.category);
    out.push({ headline, excerpt, sourceUrl, publishedAt, tag });
  }
  return out;
}
