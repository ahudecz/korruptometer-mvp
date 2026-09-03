/**
 * Upstash-backed rate limiters with an in-memory fallback for local dev where
 * UPSTASH_REDIS_REST_URL is empty. The fallback is per-process and resets on
 * server restart — fine for development; production must point at real Upstash.
 *
 * FR-016: q= search 60 / IP / minute
 * FR-017: cursor   120 / IP / minute
 * FR-031/032: submission 3 / IP / min (default), 100 / IP / day, presign 30 / IP / hour
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type Limiter = {
  limit: (id: string) => Promise<{ success: boolean; remaining: number; reset: number }>;
};

let cachedRedis: Redis | null = null;
function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (cachedRedis) return cachedRedis;
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

function makeUpstashLimiter(prefix: string, max: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`): Limiter | null {
  const r = redis();
  if (!r) return null;
  return new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(max, window),
    analytics: false,
    prefix,
  });
}

function makeMemoryLimiter(max: number, windowMs: number): Limiter {
  const buckets = new Map<string, number[]>();
  return {
    async limit(id: string) {
      const now = Date.now();
      const bucket = buckets.get(id) ?? [];
      const fresh = bucket.filter((ts) => ts > now - windowMs);
      fresh.push(now);
      buckets.set(id, fresh);
      const remaining = Math.max(0, max - fresh.length);
      return {
        success: fresh.length <= max,
        remaining,
        reset: now + windowMs,
      };
    },
  };
}

function getOrCreate(prefix: string, max: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`, windowMs: number): Limiter {
  const upstash = makeUpstashLimiter(prefix, max, window);
  if (upstash) return upstash;
  return makeMemoryLimiter(max, windowMs);
}

export const qSearchLimiter = getOrCreate('q', 60, '1 m', 60_000);
export const cursorLimiter = getOrCreate('cursor', 120, '1 m', 60_000);

export function submissionMinuteLimiter(): Limiter {
  const max = Number(process.env.SUBMISSION_RATE_MINUTE ?? 3);
  return getOrCreate('subm', max, '1 m', 60_000);
}

export function submissionDayLimiter(): Limiter {
  const max = Number(process.env.SUBMISSION_RATE_DAY ?? 100);
  return getOrCreate('subd', max, '1 d', 24 * 60 * 60_000);
}

export const presignLimiter = getOrCreate('pre', 30, '1 h', 60 * 60_000);

// 011-nvvh-case-poll — csak másodlagos, tömeges-visszaélés elleni védőháló;
// az elsődleges "már szavaztál" védelem egy böngésző-cookie, ezért a küszöb
// szándékosan nagyvonalú (shared-NAT: munkahely, egyetem, közös Wi-Fi ne
// ütközzön bele).
//
// 2026-08-31 (d5f66a9) óta NINCS harmadik réteg: a Turnstile lekerült a
// szavazási folyamatról, mert a Cloudflare-oldali domain-engedélyezés valódi
// forgalom alatt megbízhatatlanul utasított el valódi szavazókat. A szavazás
// tehát ma két réteggel véd, nem hárommal. Ez tudatosan vállalt csere, nem
// figyelmetlenség — de aki ezt a számot olvassa, ne higgye, hogy áll mögötte
// még valami.
//
// A 012-reader-subscriptions feliratkozó űrlapja SZÁNDÉKOSAN nem ezt
// használja, hanem a lentebbi, külön és szigorúbb subscribeIpLimiter-t: sem
// a böngésző-cookie-t nem örökli (az egy háztartásban a második embert
// utasítaná el), sem a Turnstile-t, és a végpont LEVELET KÜLD.
export function pollVoteIpLimiter(): Limiter {
  const max = Number(process.env.POLL_VOTE_IP_DAILY_LIMIT ?? 75);
  return getOrCreate('pollv', max, '1 d', 24 * 60 * 60_000);
}

// ── 012-reader-subscriptions (FR-046, FR-093) ───────────────────────────────
//
// Mind az öt a modul-privát `getOrCreate` gyárból épül. Egy route NEM építhet
// saját limitert: a gyár az EGYETLEN út, ami viszi a memóriabeli visszaesést
// egy Upstash nélküli környezetre, tehát egy saját limiter minden helyi és
// preview-környezetben CSENDBEN nyitva hagyná a kaput.

/** Feliratkozás: 3 / IP / óra. */
export function subscribeIpHourLimiter(): Limiter {
  const max = Number(process.env.SUBSCRIBE_IP_HOURLY_LIMIT ?? 3);
  return getOrCreate('subh', max, '1 h', 60 * 60_000);
}

/**
 * Feliratkozás: 20 / IP / nap.
 *
 * Az előtag `subsd` és nem `subd`: a `subd`-t a `submissionDayLimiter()`
 * (:72-75) MÁR HASZNÁLJA, és a kettő ugyanabban a Redis-névtérben osztozna —
 * egy bejelentés-beküldés fogyasztaná a feliratkozási keretet, és fordítva.
 */
export function subscribeIpLimiter(): Limiter {
  const max = Number(process.env.SUBSCRIBE_IP_DAILY_LIMIT ?? 20);
  return getOrCreate('subsd', max, '1 d', 24 * 60 * 60_000);
}

// A token-szerinti kulcs KÖTELEZŐ: egy közös vállalati kimenő IP-cím
// hatástalanítja a cím-szerinti kulcsot (FR-046).
/** Megerősítés/leiratkozás beküldés: 5 / token / óra. */
export function confirmTokenLimiter(): Limiter {
  return getOrCreate('cfmt', 5, '1 h', 60 * 60_000);
}

/** Megerősítés/leiratkozás beküldés: 60 / IP / óra. */
export function confirmIpLimiter(): Limiter {
  return getOrCreate('cfmi', 60, '1 h', 60 * 60_000);
}

/** A megerősítő és leiratkozó OLDALAK lekérése: 240 / IP / óra. */
export const subscribePageLimiter = getOrCreate('subpg', 240, '1 h', 60 * 60_000);
