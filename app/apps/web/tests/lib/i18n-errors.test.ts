import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: () => undefined,
}));

import {
  _registryForTests,
  codeFromHttp,
  tError,
} from '../../src/lib/investigation/i18n-errors';

const HU_VOWELS = /[áéíóöőúüű]/i;

const FORBIDDEN_TOKENS: RegExp[] = [
  // English-only words. Hungarian shares many roots — we only flag the
  // bare English verb forms that would indicate an untranslated string.
  /\b(failed|missing|invalid)\b/i,
  /\bHTTP\b/,
  // Raw HTTP status code — `http_409`, `HTTP 401`, `409 stale`, etc. Not a
  // bare 3-digit segment of a thousands-separated number (e.g. "50 000").
  /\bhttp[_ ]\d{3}\b/i,
  /\b\d{3}\s+[a-z]+\b/i,
];

describe('i18n-errors (T127, SC-018)', () => {
  it('every registry entry contains Hungarian vowels and no forbidden tokens', () => {
    const registry = _registryForTests();
    for (const [code, msg] of Object.entries(registry)) {
      expect(HU_VOWELS.test(msg), `${code}: missing Hungarian vowel`).toBe(true);
      for (const forbidden of FORBIDDEN_TOKENS) {
        expect(
          forbidden.test(msg),
          `${code}: forbidden token /${forbidden}/ in "${msg}"`,
        ).toBe(false);
      }
    }
  });

  it('snapshot — registry shape is locked (key set)', () => {
    const keys = Object.keys(_registryForTests()).sort();
    expect(keys).toMatchInlineSnapshot(`
      [
        "adapter_blocked_by_robots",
        "adapter_parse_failure",
        "already_promoted",
        "cap_tokens",
        "cap_tool_calls",
        "cap_wall_clock",
        "claim_record_conflict",
        "cohort_too_thin",
        "cohort_window_drift",
        "ekr_timeout",
        "internal_error",
        "job_canceled",
        "job_timeout",
        "job_unknown_error",
        "loop_in_flight",
        "not_authorized",
        "predicate_failed",
        "rate_limited",
        "score_invariant_drift",
        "stale",
        "ted_timeout",
        "upstream_unavailable",
        "webauthn_required",
      ]
    `);
  });

  it('unknown codes return the catch-all string (and emit a breadcrumb internally)', () => {
    const out = tError('nope_this_does_not_exist');
    expect(out).toBe('Ismeretlen hiba történt — próbáld újra később.');
  });

  it('codeFromHttp maps the documented HTTP statuses', () => {
    expect(codeFromHttp(401)).toBe('not_authorized');
    expect(codeFromHttp(409)).toBe('stale');
    expect(codeFromHttp(429)).toBe('rate_limited');
    expect(codeFromHttp(500)).toBe('internal_error');
    expect(codeFromHttp(418)).toBeNull();
  });
});
