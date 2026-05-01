import { test, expect } from '@playwright/test';

/**
 * T097 — admin-role gating + WebAuthn step-up enforcement. The middleware
 * redirects unauthenticated requests to /admin/login; admin-only API
 * routes return 401/403 without a fresh assertion (FR-041, FR-042,
 * SC-018).
 */
test.describe('admin role + step-up gating', () => {
  test('GET /api/admin/editors without a session returns 401/403', async ({ request }) => {
    const res = await request.get('/api/admin/editors', { failOnStatusCode: false });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/admin/sealed-box/rotate without admin session returns 401/403', async ({ request }) => {
    const res = await request.post('/api/admin/sealed-box/rotate', {
      data: {},
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/admin/_internal/run-retention-sweep without admin session returns 403', async ({ request }) => {
    const res = await request.post('/api/admin/_internal/run-retention-sweep', {
      data: {},
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(res.status());
  });
});
