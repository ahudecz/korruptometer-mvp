import { test, expect } from '@playwright/test';

/**
 * T023 — security headers snapshot. Every public route must emit the full
 * required header set + the CSP directives the spec promises (FR-023,
 * FR-059). Build fails on drift.
 */
const PUBLIC_ROUTES = ['/', '/hirek', '/adatbazis', '/galeria', '/hamarosan', '/bejelentes'];

const REQUIRED_HEADERS = {
  'strict-transport-security': /max-age=63072000.*includeSubDomains.*preload/,
  'referrer-policy': /strict-origin-when-cross-origin/,
  'permissions-policy': /camera=\(\).*microphone=\(\).*geolocation=\(\)/,
  'x-content-type-options': /nosniff/,
  'x-frame-options': /DENY/i,
};

const REQUIRED_CSP_DIRECTIVES = [
  "default-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
];

for (const route of PUBLIC_ROUTES) {
  test(`security headers on ${route}`, async ({ request }) => {
    const res = await request.get(route, { failOnStatusCode: false });
    expect(res.status(), `${route} returned ${res.status()}`).toBeLessThan(500);
    const headers = res.headers();

    for (const [name, pattern] of Object.entries(REQUIRED_HEADERS)) {
      expect(headers[name], `missing ${name} on ${route}`).toBeDefined();
      expect(headers[name]).toMatch(pattern);
    }

    const csp = headers['content-security-policy'];
    expect(csp, `missing CSP on ${route}`).toBeDefined();
    for (const directive of REQUIRED_CSP_DIRECTIVES) {
      expect(csp).toContain(directive);
    }
  });
}
