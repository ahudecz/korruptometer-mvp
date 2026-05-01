import { test } from '@playwright/test';
import { axe, expectNoSerious } from './axe-config';

/** T178 — `/admin/dsr` axe-clean (FR-022, SC-004). */
test('/admin/dsr is axe-clean', async ({ page }) => {
  const response = await page.goto('/admin/dsr');
  if (response && (response.status() === 302 || response.status() === 401 || response.url().includes('/admin/login'))) {
    test.skip(true, 'admin DSR requires a session — skipping in unauth env');
    return;
  }
  const results = await axe(page).analyze();
  expectNoSerious(results);
});
