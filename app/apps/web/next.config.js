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
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com"
    : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "frame-src https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com",
  isDev
    ? "connect-src 'self' http://127.0.0.1:54421 ws: http: https://*.supabase.co https://*.supabase.in https://challenges.cloudflare.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io"
    : "connect-src 'self' https://*.supabase.co https://*.supabase.in https://challenges.cloudflare.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  "img-src 'self' data: https://*.supabase.co",
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
  experimental: {
    typedRoutes: false,
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
