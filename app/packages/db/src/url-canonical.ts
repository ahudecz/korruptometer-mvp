/**
 * Canonical-URL identity for the K-Monitor ↔ scraping dedup.
 *
 * Mirrors @korr/scrapers canonicalUrl()/dedupHash() (kept in sync by hand
 * because @korr/db does not depend on @korr/scrapers). The strip-all form
 * (empty allowlist) matches how the scraper canonicalises NewsArticle URLs for
 * the common case, so a kmdb article and its scraped twin hash to the same
 * value. A non-match is conservative: the kmdb row simply stays a separate
 * engine input (no regression).
 */
import { createHash } from 'node:crypto';

const DEFAULT_STRIP_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref',
]);

export function canonicalUrl(input: string, queryAllowlist: readonly string[] = []): string | null {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }
  parsed.protocol = 'https:';
  parsed.hash = '';
  let host = parsed.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  parsed.hostname = host;
  parsed.port = '';
  let path = parsed.pathname;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  parsed.pathname = path;

  const allow = new Set(queryAllowlist);
  const next = new URLSearchParams();
  for (const [k, v] of parsed.searchParams.entries()) {
    if (allow.has(k)) next.append(k, v);
    else if (!DEFAULT_STRIP_PARAMS.has(k) && allow.size === 0) {
      /* strict strip-all */
    }
  }
  const sorted = new URLSearchParams();
  [...next.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([k, v]) => sorted.append(k, v));
  parsed.search = sorted.toString() ? `?${sorted.toString()}` : '';
  return parsed.toString();
}

export function dedupHash(canonical: string): string {
  return createHash('sha256').update(canonical).digest('hex');
}

/** Convenience: canonical + hash for a raw URL, or null if unparseable. */
export function urlIdentity(input: string | null | undefined): { canonical: string; hash: string } | null {
  if (!input) return null;
  const canonical = canonicalUrl(input, []);
  if (!canonical) return null;
  return { canonical, hash: dedupHash(canonical) };
}
