import 'server-only';

import * as Sentry from '@sentry/nextjs';

/**
 * Central Hungarian translator for every internal error code or HTTP
 * status that can reach the reviewer surface (FR-056).
 *
 * Contract:
 *   - Every value in REGISTRY is a Hungarian phrase. No raw HTTP code, no
 *     English word, no internal symbol.
 *   - `tError(code)` returns the registry entry or the catch-all
 *     `UNKNOWN_HU` and emits a Sentry breadcrumb of
 *     `category: 'investigation.error.untranslated'`.
 *   - Snapshot tests (`tests/lib/i18n-errors.test.ts`, T127) lock the
 *     registry shape and assert no entry contains forbidden tokens.
 *
 * Adding an entry: pick a stable internal code (snake_case) — never an
 * HTTP status by itself; map status codes to a code first.
 */

const UNKNOWN_HU = 'Ismeretlen hiba történt — próbáld újra később.';

const REGISTRY = {
  // Optimistic-concurrency / concurrency guards.
  stale: 'A nyomozás közben módosult. Frissítsd az oldalt.',
  loop_in_flight:
    'A hipotézis-hurok már fut ezen a nyomozáson — várd meg a végét.',
  already_promoted: 'Ez a nyomozás már promotálva van.',
  predicate_failed:
    'A promotálás előfeltételei nem teljesülnek (mennyiségi vagy minőségi szint).',

  // Job-state errors surfaced on the pipeline panel.
  job_timeout: 'A futás időtúllépés miatt megszakadt. Próbáld újra.',
  job_canceled: 'A futást megszakították.',
  job_unknown_error: 'A futás ismeretlen hibával ért véget.',

  // Hypothesis-loop caps (FR-023).
  cap_tool_calls:
    'Eszközhívás-keret elfogyott (8). Szűkítsd a kérdést, vagy várd a következő futtatást.',
  cap_tokens:
    'Token-keret elfogyott (50 000). Vágd szűkebbre a kérdést, vagy várj a nightly-refresh-ig.',
  cap_wall_clock:
    'Időkeret elfogyott (90 mp). A nyomozás túl szerteágazó a hipotézis-hurokhoz.',

  // Cross-reference / adapter failures.
  ted_timeout: 'TED API időtúllépés. Próbáld újra később.',
  ekr_timeout: 'EKR API időtúllépés. Próbáld újra később.',
  adapter_parse_failure:
    'A külső forrás válasza nem volt értelmezhető. Az üzemeltetők értesülnek.',
  adapter_blocked_by_robots:
    'A külső forrás letiltotta a lekérést (robots.txt). Hagyd ki ezt a forrást.',

  // Damage-recompute issues.
  cohort_too_thin:
    'A benchmark-kohorsz túl kicsi (n<10) — szakmai becslés helyett várd ki a több adatpontot.',
  cohort_window_drift:
    'A benchmark időablaka már nem fedi a szerződés évét.',
  claim_record_conflict:
    'Az állítás és a külső rekord összege ellentmond — reviewer-i felülvizsgálat szükséges.',
  score_invariant_drift:
    'A pontszám és a részjegyzések összege eltér. Az üzemeltetők értesülnek.',

  // Permissions / auth.
  not_authorized: 'Nincs jogosultságod ehhez a művelethez.',
  webauthn_required: 'Erős hitelesítés (WebAuthn) szükséges a folytatáshoz.',

  // Generic infrastructure.
  rate_limited: 'Túl sok kérés — várj egy percet, és próbáld újra.',
  internal_error:
    'A szerver hibát jelzett. Az üzemeltetők értesülnek; próbáld újra később.',
  upstream_unavailable: 'A külső szolgáltatás nem elérhető — próbáld újra később.',
} as const;

export type ErrorCode = keyof typeof REGISTRY;

const HTTP_TO_CODE: Record<number, ErrorCode> = {
  401: 'not_authorized',
  403: 'webauthn_required',
  409: 'stale',
  422: 'predicate_failed',
  429: 'rate_limited',
  500: 'internal_error',
  502: 'upstream_unavailable',
  503: 'upstream_unavailable',
  504: 'job_timeout',
};

/** Maps a raw HTTP status to a known error code, or null. */
export function codeFromHttp(status: number): ErrorCode | null {
  return HTTP_TO_CODE[status] ?? null;
}

/**
 * Translate an internal error code to Hungarian. Unknown codes return
 * `UNKNOWN_HU` and emit a Sentry breadcrumb so the on-call engineer can
 * triage the gap.
 */
export function tError(code: string): string {
  if (Object.prototype.hasOwnProperty.call(REGISTRY, code)) {
    return REGISTRY[code as ErrorCode];
  }
  Sentry.addBreadcrumb({
    category: 'investigation.error.untranslated',
    message: 'unknown error code',
    data: { code },
    level: 'warning',
  });
  return UNKNOWN_HU;
}

/** Re-exported for test snapshots — the registry must not leak elsewhere. */
export function _registryForTests(): Readonly<typeof REGISTRY> {
  return REGISTRY;
}
