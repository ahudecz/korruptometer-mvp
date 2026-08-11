/**
 * 010-post-publish-verification — transient (never persisted) article-body
 * fetch used ONLY to feed the verification LLM prompt. `NewsArticle.body` is
 * not stored anywhere in this system (Constitution IV) — this function's
 * return value must never be written to a database column, only passed
 * straight into an LLM call and discarded.
 *
 * Generic heuristic, not a per-outlet parser (see the scoped follow-up note
 * this replaces): the DOM container with the highest cumulative `<p>` text
 * length, after stripping script/style/nav/footer/aside. Deliberately not
 * 100% reliable per outlet — callers MUST treat a `null` return as "fall
 * back to cross-outlet corroboration", never as a hard failure.
 */
import { httpGet } from './http';
import { loadHtml } from './parse';

const FETCH_TIMEOUT_MS = 8000;
const MAX_CHARS = 4000;
const MIN_VIABLE_CHARS = 200;

export async function fetchArticleBodyTransient(
  url: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const html = await httpGet(url, { signal: controller.signal, fetchImpl: opts.fetchImpl });
    const text = extractBodyText(html);
    if (!text || text.length < MIN_VIABLE_CHARS) return null;
    return text.slice(0, MAX_CHARS);
  } catch {
    // 403/timeout/robots-disallow/network error — all fail-open the same
    // way, the caller falls back to cross-outlet corroboration.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Groups every <p> by its DIRECT parent (not all ancestors, to avoid the
 * outermost wrapper always "winning" by accumulating every paragraph on the
 * page) and returns the parent whose own paragraphs sum to the most text —
 * a minimal readability-style heuristic, good enough given the fail-open
 * cross-outlet fallback for whatever this misses.
 *
 * 2026-08-11 bug report: a Telex article's single most load-bearing fact —
 * a named minister quote naming exactly who was dismissed ("...felmentette
 * a ... Kft. ügyvezetőjét, dr. Juhász Rolandot") — lived inside a
 * <blockquote>, its own separate DOM parent with only that one paragraph.
 * It always loses the "biggest parent" comparison against the main body
 * (many paragraphs, one shared parent) and was silently dropped entirely —
 * the retry-with-full-body detector path then still had no name to extract
 * from. <blockquote> is a semantically distinct element (a pull-quote/cited
 * statement, not navigation or a sidebar) — appended unconditionally rather
 * than made to compete on raw length, since it's exactly the kind of text
 * that carries a precise, citable fact.
 */
function extractBodyText(html: string): string {
  const $ = loadHtml(html);
  $('script, style, nav, footer, aside, header, form, noscript').remove();

  const byParent = new Map<unknown, string[]>();
  $('p').each((_i, el) => {
    const text = $(el).text().trim();
    if (!text) return;
    const parent = el.parent;
    if (!parent) return;
    const list = byParent.get(parent) ?? [];
    list.push(text);
    byParent.set(parent, list);
  });

  let bestTexts: string[] = [];
  let bestLength = 0;
  for (const texts of byParent.values()) {
    const length = texts.reduce((sum, t) => sum + t.length, 0);
    if (length > bestLength) {
      bestLength = length;
      bestTexts = texts;
    }
  }

  const quoteTexts: string[] = [];
  $('blockquote').each((_i, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text) quoteTexts.push(text);
  });

  return [...bestTexts, ...quoteTexts].join('\n\n');
}
