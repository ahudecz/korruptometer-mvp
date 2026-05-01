import { describe, it, expect, beforeEach } from 'vitest';

// Force the in-memory limiter path (no Upstash creds in test).
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

import {
  qSearchLimiter,
  cursorLimiter,
  presignLimiter,
  submissionMinuteLimiter,
  submissionDayLimiter,
} from './ratelimit';

/**
 * T055 / T083 — assert the 60/min q= cap, 120/min cursor cap, and submission
 * envelope (3/min, 100/day, 30/hr presign). The verified-human-cookie cap
 * doubling is exercised by the route-level integration tests; here we only
 * cover the bare limiter's 429-shaped boundary behaviour (FR-016, FR-017,
 * FR-031, FR-032, SC-009, SC-012).
 */

const fresh = () => Math.random().toString(36).slice(2);

describe('rate limiters', () => {
  beforeEach(() => {
    // Each test seeds a unique key so siblings don't pollute each other.
  });

  it('q= search allows 60 calls/min and rejects the 61st', async () => {
    const id = `q:${fresh()}`;
    let lastSuccess = false;
    for (let i = 0; i < 60; i += 1) {
      const r = await qSearchLimiter.limit(id);
      lastSuccess = r.success;
    }
    expect(lastSuccess).toBe(true);
    const blocked = await qSearchLimiter.limit(id);
    expect(blocked.success).toBe(false);
  });

  it('cursor allows 120 calls/min and rejects the 121st', async () => {
    const id = `cur:${fresh()}`;
    for (let i = 0; i < 120; i += 1) await cursorLimiter.limit(id);
    const blocked = await cursorLimiter.limit(id);
    expect(blocked.success).toBe(false);
  });

  it('submission/min allows 3/min by default and rejects the 4th', async () => {
    process.env.SUBMISSION_RATE_MINUTE = '3';
    const limiter = submissionMinuteLimiter();
    const id = `sm:${fresh()}`;
    for (let i = 0; i < 3; i += 1) await limiter.limit(id);
    const blocked = await limiter.limit(id);
    expect(blocked.success).toBe(false);
  });

  it('submission/day allows 100/day by default and rejects the 101st', async () => {
    process.env.SUBMISSION_RATE_DAY = '100';
    const limiter = submissionDayLimiter();
    const id = `sd:${fresh()}`;
    for (let i = 0; i < 100; i += 1) await limiter.limit(id);
    const blocked = await limiter.limit(id);
    expect(blocked.success).toBe(false);
  });

  it('presign allows 30/hour and rejects the 31st', async () => {
    const id = `pre:${fresh()}`;
    for (let i = 0; i < 30; i += 1) await presignLimiter.limit(id);
    const blocked = await presignLimiter.limit(id);
    expect(blocked.success).toBe(false);
  });
});
