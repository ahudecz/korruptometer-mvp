import { createHash } from 'node:crypto';

const DEFAULT_STRIP_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
]);

/**
 * Canonicalise an article URL so that the same article observed twice (with
 * different share-tracking variants, host casing, fragments, or trailing
 * slashes) maps to one stable string.
 *
 * - scheme → https
 * - host → lowercase, strip leading "www."
 * - drop fragment
 * - strip trailing slash on the path (root path stays "/")
 * - keep only query params present in the per-outlet allowlist
 *
 * The allowlist is per-outlet because a few outlets do encode meaning into
 * specific query params (e.g. paginated archive views). Most should pass
 * `[]` so all params are stripped.
 */
export function canonicalUrl(input: string, queryAllowlist: readonly string[] = []): string {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`canonicalUrl: invalid URL: ${input}`);
  }

  parsed.protocol = 'https:';
  parsed.hash = '';

  let host = parsed.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  parsed.hostname = host;

  // Drop the explicit default port if Node leaves one in.
  parsed.port = '';

  let path = parsed.pathname;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  parsed.pathname = path;

  const allow = new Set(queryAllowlist);
  const next = new URLSearchParams();
  for (const [k, v] of parsed.searchParams.entries()) {
    if (allow.has(k)) {
      next.append(k, v);
    } else if (!DEFAULT_STRIP_PARAMS.has(k) && allow.size === 0) {
      // When no per-outlet allowlist is provided, strip everything except
      // params not on the universal strip list. Allowlist of [] means strict
      // strip-all behaviour.
    }
  }
  // Sort allowed keys so order does not affect the dedup hash.
  const sorted = new URLSearchParams();
  [...next.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([k, v]) => sorted.append(k, v));
  parsed.search = sorted.toString() ? `?${sorted.toString()}` : '';

  return parsed.toString();
}

export function dedupHash(canonical: string): string {
  return createHash('sha256').update(canonical).digest('hex');
}
