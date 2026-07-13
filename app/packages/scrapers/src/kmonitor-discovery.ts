/**
 * K-Monitor case-discovery layer (FR-076 → FR-080).
 *
 * K-Monitor is NOT modelled as an OutletAdapter and its slug never appears
 * as the `source` of a NewsArticle. We use it only to enumerate tag slugs
 * and harvest primary-outlet URLs from their paginated tag listings; those
 * URLs are then handed to the existing OutletAdapters for actual ingestion.
 *
 * Robots compliance (`adatbazis.k-monitor.hu/robots.txt`, verified
 * 2026-05-10): ClaudeBot and GPTBot are disallowed outright. Our
 * `Korruptometer-Bot/1.0` UA falls under `User-agent: *`, which leaves the
 * one-segment `/adatbazis/cimkek/<tag>` and querystring `?page=N` paths
 * default-allowed, the two-segment `/adatbazis/cimkek/<tag>/<outlet>` path
 * explicitly Allowed, and anything deeper (3+ segments after `/cimkek/`)
 * explicitly Disallowed.
 *
 * Per FR-079 this module extracts only: tag slug, primary `sourceUrl`,
 * Wayback `archiveUrl`, K-Monitor's date string, and an outlet-slug hint.
 * It NEVER extracts the editorial excerpt (`.card__content`), the cached
 * headline, or any K-Monitor-internal URL.
 */

import { httpGet, httpGetWithArchiveFallback } from './http';
import {
  EXCERPT_MAX,
  clipExcerpt,
  loadHtml,
  metaContent,
  parseDate,
} from './parse';
import type { ScrapedArticle } from './types';

const KMONITOR_BASE = 'https://adatbazis.k-monitor.hu';
const KMONITOR_INDEX_URL = `${KMONITOR_BASE}/hirek`;
const MAX_TRAVERSAL_PAGES = 50;

export type DiscoveredArticleRef = {
  /** K-Monitor tag slug this article was found under. */
  tagSlug: string;
  /** Primary-outlet URL — feed this to the matching OutletAdapter, NOT stored as-is. */
  sourceUrl: string;
  /** Wayback snapshot URL, kept only as a fallback for dead primary URLs. */
  archiveUrl: string | null;
  /** Hungarian-language date string as rendered, for human inspection only. */
  dateText: string | null;
  /** K-Monitor's own outlet-slug filter (e.g. "444", "hvg") — useful for routing. */
  outletHint: string | null;
};

export type TagPageParse = {
  tagSlug: string;
  articles: DiscoveredArticleRef[];
  /** Pagination targets discovered on this page (relative URLs as rendered). */
  nextPages: string[];
};

export type TagIndex = {
  /** Tag slugs visible from /hirek. Mixed taxonomy: cases, concepts, parties, content types. */
  tagSlugs: string[];
};

const CARD_SELECTOR = 'article.news_list_1';
const SOURCE_URL_SEL = '.card__metadata__item--source_url a';
const ARCHIVE_URL_SEL = '.card__metadata__item--archive_url a';
const DATE_SEL = '.card__metadata__item--date a';
const NEWSPAPER_SEL = '.card__metadata__item--newspaper a';

export function parseKMonitorTagPage(html: string, tagSlug: string): TagPageParse {
  const $ = loadHtml(html);
  const articles: DiscoveredArticleRef[] = [];

  $(CARD_SELECTOR).each((_, el) => {
    const $card = $(el);
    const sourceUrl = ($card.find(SOURCE_URL_SEL).attr('href') ?? '').trim();
    if (!sourceUrl || !sourceUrl.startsWith('http')) return;
    const archiveUrl = ($card.find(ARCHIVE_URL_SEL).attr('href') ?? '').trim() || null;
    const dateText = $card.find(DATE_SEL).text().trim() || null;
    // The newspaper filter <a> has href like "/adatbazis/cimkek/<tag>/<outlet>"
    // — last path segment is the K-Monitor-side outlet slug.
    const newspaperHref = $card.find(NEWSPAPER_SEL).attr('href') ?? '';
    const outletHint = newspaperHref.split('/').filter(Boolean).pop() ?? null;
    articles.push({ tagSlug, sourceUrl, archiveUrl, dateText, outletHint });
  });

  // Pagination: K-Monitor uses ?page=N querystring.
  const nextPages = new Set<string>();
  $(`a[href*="cimkek/${tagSlug}?"]`).each((_, el) => {
    const href = $(el).attr('href');
    if (href && /[?&]page=\d+/.test(href)) nextPages.add(href);
  });

  return { tagSlug, articles, nextPages: [...nextPages] };
}

/**
 * Enumerate candidate tag slugs from the public news index page.
 * Note: the resulting slugs MIX case-specific tags (e.g. "lounge-design-kft",
 * "paks-ii") with conceptual/political tags (e.g. "fidesz", "video"). An
 * editor must approve which tags map to cases — we never auto-promote.
 */
export function parseKMonitorTagIndex(html: string): TagIndex {
  const $ = loadHtml(html);
  const slugs = new Set<string>();
  $('a[href*="adatbazis/cimkek/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    // Only one-segment tag refs: /adatbazis/cimkek/<slug> with no further `/`.
    const m = /(?:^|\/)adatbazis\/cimkek\/([^/?#]+)(?:[?#]|$)/.exec(href);
    if (m && m[1]) slugs.add(m[1]);
  });
  return { tagSlugs: [...slugs] };
}

export type FetchOpts = { fetchImpl?: typeof fetch };

/** Fetch /hirek and return the tag-slug list (FR-076). */
export async function fetchKMonitorTagIndex(
  opts: FetchOpts = {},
): Promise<TagIndex> {
  const html = await httpGet(KMONITOR_INDEX_URL, opts);
  return parseKMonitorTagIndex(html);
}

/**
 * Paginate `/adatbazis/cimkek/<slug>` until exhaustion or MAX_TRAVERSAL_PAGES,
 * whichever comes first (FR-078). Stops early when a page yields zero
 * articles or no further `?page=N` pagination targets are visible.
 */
export async function paginateKMonitorTag(
  slug: string,
  opts: FetchOpts = {},
): Promise<DiscoveredArticleRef[]> {
  const all: DiscoveredArticleRef[] = [];
  for (let page = 1; page <= MAX_TRAVERSAL_PAGES; page++) {
    const url =
      page === 1
        ? `${KMONITOR_BASE}/adatbazis/cimkek/${slug}`
        : `${KMONITOR_BASE}/adatbazis/cimkek/${slug}?page=${page}`;
    const html = await httpGet(url, opts);
    const parsed = parseKMonitorTagPage(html, slug);
    if (parsed.articles.length === 0) break;
    all.push(...parsed.articles);
    const observedMax = parsed.nextPages.reduce((acc, p) => {
      const m = /[?&]page=(\d+)/.exec(p);
      return m && m[1] ? Math.max(acc, Number(m[1])) : acc;
    }, 0);
    if (observedMax <= page) break;
  }
  return all;
}

export type FetchedPrimaryArticle = ScrapedArticle & { viaArchive: boolean; siteName: string | null };

/**
 * Fetch the primary-outlet article whose URL was discovered via K-Monitor,
 * with 404/410 → Wayback fallback (FR-080). Extracts headline / excerpt /
 * publishedAt from standard og: meta tags; the K-Monitor-rendered date
 * is a last-resort fallback only (FR-079 — we never rely on K-Monitor's
 * editorial content).
 */
export async function fetchPrimaryArticle(
  ref: Pick<
    DiscoveredArticleRef,
    'sourceUrl' | 'archiveUrl' | 'tagSlug' | 'dateText'
  >,
  opts: FetchOpts = {},
): Promise<FetchedPrimaryArticle | null> {
  const { html, viaArchive } = await httpGetWithArchiveFallback(
    ref.sourceUrl,
    ref.archiveUrl,
    opts,
  );
  const $ = loadHtml(html);
  const headlineRaw =
    metaContent($, 'og:title') ?? $('title').first().text().trim() ?? '';
  const headline = headlineRaw.trim().slice(0, 500);
  if (!headline) return null;
  const excerptRaw = metaContent($, 'og:description') ?? '';
  const excerpt = clipExcerpt(excerptRaw);
  const publishedAt =
    parseDate(metaContent($, 'article:published_time')) ??
    parseDate($('time').first().attr('datetime') ?? null) ??
    parseDate(ref.dateText) ??
    new Date();
  // 2026-07-13 — a kézi (Telegram-tipp) bejelentésekhez kell: ha az URL nem
  // egy konfigurált OutletAdapter-hez tartozik, az og:site_name adja a
  // valódi médium-nevet (attribúcióhoz), nem csak egy generikus fallback-ot.
  const siteName = metaContent($, 'og:site_name');
  return {
    headline,
    excerpt,
    sourceUrl: ref.sourceUrl,
    publishedAt,
    tag: ref.tagSlug,
    viaArchive,
    siteName: siteName ? siteName.trim().slice(0, 100) || null : null,
  };
}

export const _internals = {
  KMONITOR_BASE,
  KMONITOR_INDEX_URL,
  MAX_TRAVERSAL_PAGES,
  EXCERPT_MAX,
};
