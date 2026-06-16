import 'server-only';

/**
 * Central typed env access for code paths that should refuse to misread a flag.
 * Other modules continue to read process.env.X directly; this file exists so
 * the public-tier render gate (FR-032/FR-033) is parsed exactly once, in one
 * place, with a Vercel-build-time assertion.
 */

function parseBool(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0' || v === '') return false;
  throw new Error(
    `Invalid boolean env value: "${raw}". Expected one of: true, false, 1, 0.`,
  );
}

/**
 * FR-032 / FR-033 public-tier render gate. Default is `false` in every
 * environment; the flag only flips to `true` once counsel signs off on
 * `app/docs/public-tier-redaction-policy.md`. The promotion *write path*
 * never reads this — it only gates rendering of `/galeria/**` and any
 * future `/public/*` route.
 */
export const PUBLIC_TIER_ENABLED: boolean = parseBool(
  process.env.PUBLIC_TIER_ENABLED,
);

// Build-time assertion (Vercel runs the bundler at build, so the env value
// is captured in the build manifest as well as at runtime). Production
// deployments that meant to enable the flag must set it explicitly; an
// unset value is treated as `false` everywhere.
if (process.env.NODE_ENV === 'production' && PUBLIC_TIER_ENABLED) {
  // Belt-and-braces breadcrumb in the build logs. CODEOWNERS still gates
  // the underlying render files, so this is purely an operator signal.
  // eslint-disable-next-line no-console
  console.warn(
    '[env] PUBLIC_TIER_ENABLED=true at build time — public-tier render path is live.',
  );
}
