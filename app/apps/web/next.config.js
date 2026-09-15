/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

// T022 + T073 — Phase-2 CSP. Adds Cloudflare Turnstile (script + frame),
// Supabase (connect + img), and keeps the Phase-1 hardening (default-src,
// frame-ancestors, form-action, base-uri, object-src). The
// `tests/e2e/security-headers.spec.ts` snapshot test pins this list — drift
// fails the build (FR-023, FR-059).
const ContentSecurityPolicy = [
  "default-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  // Next.js inlines a small bootstrap script; nonce-based hardening is the
  // T073 follow-up. 'unsafe-eval' is required by Next's React Refresh
  // runtime in dev only. Cloudflare Turnstile injects an iframe + script.
  // googletagmanager.com serves the gtag.js library (cookie-banner.tsx) —
  // without it in script-src the browser silently blocks the script load,
  // so dataLayer.push() calls queue up but nothing ever ships to GA
  // (found 2026-07-11: GA showed zero traffic despite the consent flow and
  // inline dataLayer pushes working, because the real gtag.js never loaded).
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://www.googletagmanager.com"
    : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "frame-src https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com",
  // google-analytics.com/analytics.google.com: GA4's actual measurement
  // beacon (gtag.js posts here) — googletagmanager.com is also needed here
  // since gtag.js itself does a config fetch back to it.
  isDev
    ? "connect-src 'self' http://127.0.0.1:54421 ws: http: https://*.supabase.co https://*.supabase.in https://challenges.cloudflare.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com"
    : "connect-src 'self' https://*.supabase.co https://*.supabase.in https://challenges.cloudflare.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com",
  // i.ytimg.com: YouTube videó-thumbnailok a "legfrissebb podcastok" rács-
  // kártyáin (podcast-video-card.tsx) — a lejátszás maga frame-src alá esik
  // (fentebb, már engedélyezve), de a kattintás-előtti thumbnail-kép saját
  // img-src szabályt igényel, különben a böngésző csendben blokkolja.
  "img-src 'self' data: https://*.supabase.co https://*.google-analytics.com https://*.googletagmanager.com https://i.ytimg.com",
  "object-src 'none'",
];

const securityHeaders = [
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy.join('; ') },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  async redirects() {
    return [
      // Accent-normalization redirects used to live here as ~80 hardcoded
      // entries, one per accented DB id — and all of them pointed at a
      // *destination* id that never actually existed in ScandalCatalog
      // (destinations were hand-typed ascii guesses, not real ids), so they
      // actively 404ed every accented URL they caught instead of fixing it.
      // [id]/page.tsx now resolves any accented/ascii variant via Postgres
      // unaccent() and every on-site link is pre-normalized to ascii via
      // toAsciiId() (case-detail-config.ts) — so this class of redirect is
      // both unnecessary and was actively wrong. See 2026-07-08 404 audit.
      {
        source: '/adatbazis/evi-61-4-milliot-kaphat-varkonyi-andrea-a-foldjei-utan-amike',
        destination: '/adatbazis/varkonyi-andrea-csongradi-fold-vasarlas',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  transpilePackages: ['@korr/db', '@korr/shared', '@korr/ui', '@korr/scrapers'],
};

module.exports = nextConfig;
