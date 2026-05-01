/**
 * Shared listing-page extraction. Per-outlet adapters supply the listing URL
 * + per-card selector + helpers; this module turns one HTML page into a
 * normalised `ScrapedArticle[]`.
 *
 * NOTE: real selectors must be verified against live HTML for each outlet.
 * The adapters in this package ship sensible defaults (semantic markup
 * common to Hungarian editorial sites) and saved fixtures that exercise the
 * extraction logic; the selectors WILL drift as the outlets restyle and
 * must be re-verified during the spec-Phase-3 ship gate (T143).
 */
import { absoluteUrl, clipExcerpt, loadHtml, metaContent, parseDate } from './parse';
import { httpGet } from './http';
import type { ScrapedArticle } from './types';

export type ListingCardSelectors = {
  /** CSS selector matching one article card on the listing page. */
  card: string;
  /** Selector inside a card whose href is the article URL. */
  link: string;
  /** Selector for the headline text inside a card. */
  headline: string;
  /** Selector for an excerpt/lead inside a card (optional — falls back to og:description). */
  excerpt?: string;
  /** Selector for a `<time>` element or anything carrying a parseable datetime. */
  time?: string;
  /** Optional tag/category badge selector. */
  tag?: string;
};

export type ListingExtractorConfig = {
  base: string;
  listingUrl: string;
  selectors: ListingCardSelectors;
  /** Fetch the article page to fill in og:description / publishedAt when the listing is sparse. */
  hydrateMissing?: boolean;
};

export async function extractFromListing(
  config: ListingExtractorConfig,
  fetchImpl?: typeof fetch,
): Promise<ScrapedArticle[]> {
  const html = await httpGet(config.listingUrl, fetchImpl ? { fetchImpl } : {});
  return parseListingHtml(html, config, fetchImpl);
}

export async function parseListingHtml(
  html: string,
  config: ListingExtractorConfig,
  fetchImpl?: typeof fetch,
): Promise<ScrapedArticle[]> {
  const $ = loadHtml(html);
  const out: ScrapedArticle[] = [];
  const cards = $(config.selectors.card).toArray();
  for (const el of cards) {
    const card = $(el);
    const link = card.find(config.selectors.link).first();
    const href = link.attr('href');
    const sourceUrl = absoluteUrl(href, config.base);
    if (!sourceUrl) continue;

    const headlineText = card.find(config.selectors.headline).first().text().trim();
    if (!headlineText) continue;

    let excerptText = config.selectors.excerpt
      ? card.find(config.selectors.excerpt).first().text().trim()
      : '';

    let publishedAt: Date | null = null;
    if (config.selectors.time) {
      const timeEl = card.find(config.selectors.time).first();
      publishedAt =
        parseDate(timeEl.attr('datetime')) ?? parseDate(timeEl.text() || null);
    }

    const tag = config.selectors.tag
      ? card.find(config.selectors.tag).first().text().trim() || null
      : null;

    if ((!excerptText || !publishedAt) && config.hydrateMissing) {
      try {
        const articleHtml = await httpGet(sourceUrl, fetchImpl ? { fetchImpl } : {});
        const $$ = loadHtml(articleHtml);
        if (!excerptText) {
          excerptText = metaContent($$, 'og:description') ?? '';
        }
        if (!publishedAt) {
          publishedAt =
            parseDate(metaContent($$, 'article:published_time')) ??
            parseDate($$('time').first().attr('datetime') ?? null);
        }
      } catch {
        // Hydration is best-effort; fall through with what we have.
      }
    }

    out.push({
      headline: headlineText,
      excerpt: clipExcerpt(excerptText),
      sourceUrl,
      publishedAt: publishedAt ?? new Date(),
      tag,
    });
  }
  return out;
}
