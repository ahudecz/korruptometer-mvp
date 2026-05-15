/**
 * Rate-limited, robots-aware HTTP wrapper used by every outlet adapter.
 *
 * Guarantees:
 *  - identifying User-Agent header (FR-061)
 *  - per-host outbound throttle ≥ 2s between requests
 *  - robots.txt fetched per-host once per day, cached in-memory; requests
 *    are aborted if the path is disallowed for our UA
 *  - exponential backoff on 4xx/5xx (max 3 retries)
 */

const USER_AGENT = 'Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)';
const MIN_GAP_MS = 2000;
const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RETRIES = 3;

type RobotsCache = {
  fetchedAt: number;
  disallow: string[];
};

const lastHitByHost = new Map<string, number>();
const robotsByHost = new Map<string, RobotsCache>();

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function ensureGap(host: string) {
  const last = lastHitByHost.get(host) ?? 0;
  const since = Date.now() - last;
  if (since < MIN_GAP_MS) await sleep(MIN_GAP_MS - since);
  lastHitByHost.set(host, Date.now());
}

function parseRobots(text: string): string[] {
  // Minimal parser: captures Disallow rules under * or our UA group.
  const lines = text.split('\n').map((l) => l.trim());
  const disallow: string[] = [];
  let inGroup = false;
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey?.trim().toLowerCase() ?? '';
    const val = rest.join(':').trim();
    if (key === 'user-agent') {
      const ua = val.toLowerCase();
      inGroup = ua === '*' || USER_AGENT.toLowerCase().includes(ua);
    } else if (inGroup && key === 'disallow' && val) {
      disallow.push(val);
    }
  }
  return disallow;
}

async function ensureRobots(
  host: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RobotsCache> {
  const cached = robotsByHost.get(host);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) return cached;
  await ensureGap(host);
  let text = '';
  try {
    const res = await fetchImpl(`https://${host}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (res.ok) text = await res.text();
  } catch {
    // Treat fetch failures as "no rules" — outlets without robots are open.
  }
  const entry: RobotsCache = { fetchedAt: Date.now(), disallow: parseRobots(text) };
  robotsByHost.set(host, entry);
  return entry;
}

function disallowed(path: string, disallow: string[]) {
  return disallow.some((rule) => rule !== '/' && path.startsWith(rule));
}

export class HttpDisallowedByRobotsError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
    this.name = 'HttpDisallowedByRobotsError';
  }
}

export class HttpStatusError extends Error {
  readonly status: number;
  readonly url: string;
  constructor(status: number, url: string) {
    super(`http ${status} ${url}`);
    this.name = 'HttpStatusError';
    this.status = status;
    this.url = url;
  }
}

export type HttpGetOptions = {
  signal?: AbortSignal;
  // Allow tests to swap fetch out without monkey-patching globalThis.
  fetchImpl?: typeof fetch;
};

export async function httpGet(url: string, opts: HttpGetOptions = {}): Promise<string> {
  const target = new URL(url);
  const host = target.hostname;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const robots = await ensureRobots(host, fetchImpl);
  if (disallowed(target.pathname, robots.disallow)) {
    throw new HttpDisallowedByRobotsError(url);
  }
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < MAX_RETRIES) {
    await ensureGap(host);
    try {
      const res = await fetchImpl(url, {
        signal: opts.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*;q=0.5' },
      });
      if (res.status >= 200 && res.status < 300) {
        return await res.text();
      }
      // Retry on 5xx and 429; surface 4xx (other than 429) immediately.
      if (res.status !== 429 && res.status < 500) {
        throw new HttpStatusError(res.status, url);
      }
      lastErr = new HttpStatusError(res.status, url);
    } catch (err) {
      // Bail immediately on non-retryable status errors (4xx, non-429).
      if (
        err instanceof HttpStatusError &&
        err.status !== 429 &&
        err.status < 500
      ) {
        throw err;
      }
      lastErr = err;
    }
    attempt += 1;
    await sleep(500 * 2 ** attempt);
  }
  throw lastErr instanceof Error ? lastErr : new Error(`fetch failed ${url}`);
}

/** Test-only — reset the in-memory throttling/robots state between specs. */
export function _resetHttpStateForTests() {
  lastHitByHost.clear();
  robotsByHost.clear();
}

/**
 * Fetch `primaryUrl`; if the primary returns 404/410, fall back to
 * `archiveUrl` (if provided) — used by the K-Monitor discovery worker
 * (FR-080) for articles whose primary outlet has rotated/removed the
 * canonical URL but K-Monitor preserved a Wayback snapshot.
 */
export async function httpGetWithArchiveFallback(
  primaryUrl: string,
  archiveUrl: string | null,
  opts: HttpGetOptions = {},
): Promise<{ html: string; viaArchive: boolean }> {
  try {
    const html = await httpGet(primaryUrl, opts);
    return { html, viaArchive: false };
  } catch (err) {
    if (
      archiveUrl &&
      err instanceof HttpStatusError &&
      (err.status === 404 || err.status === 410)
    ) {
      const html = await httpGet(archiveUrl, opts);
      return { html, viaArchive: true };
    }
    throw err;
  }
}
