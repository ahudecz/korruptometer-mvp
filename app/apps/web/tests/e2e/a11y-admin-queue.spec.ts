import { test } from '@playwright/test';
import { axe, expectNoSerious } from './axe-config';

/**
 * T098 — `/admin` axe-clean (FR-022, SC-004). Skips if the admin login
 * gate redirects unauthenticated browsers, which is the expected behavior
 * in CI without a seeded session.
 */
test('/admin is axe-clean', async ({ page }) => {
  const response = await page.goto('/admin');
  if (response && (response.status() === 302 || response.status() === 401 || response.url().includes('/admin/login'))) {
    test.skip(true, 'admin queue requires a session — skipping in unauth env');
    return;
  }
  const results = await axe(page).analyze();
  expectNoSerious(results);
});
