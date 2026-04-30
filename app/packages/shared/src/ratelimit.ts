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
