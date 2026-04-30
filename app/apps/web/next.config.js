/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const ContentSecurityPolicy = [
  "default-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  // Next.js inlines a small bootstrap script; nonce-based hardening lands in Phase 2 with Turnstile.
  // 'unsafe-eval' is required by Next's React Refresh runtime in dev only.
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  "img-src 'self' data:",
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
  transpilePackages: ['@korr/db', '@korr/shared', '@korr/ui'],
};

module.exports = nextConfig;
