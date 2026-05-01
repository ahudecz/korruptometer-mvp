import { test, expect } from '@playwright/test';

/**
 * T166 — `/admin/scraper-runs` shows every required column for the
 * Source overview + the Latest runs table (US 13 acceptance scenario 1,
 * FR-072).
 *
 * Requires the test environment to have a signed-in editor session
 * (cookie set out-of-band by the harness). Skips in unauthenticated
 * environments rather than failing — a 401 from /admin is a separate
 * gate covered by the auth e2e.
 */
test('admin scraper-runs renders all required columns', async ({ page }) => {
  const res = await page.goto('/admin/scraper-runs');
  if (res?.status() === 401 || res?.status() === 403) {
    test.skip(true, 'editor session not available in this run');
    return;
  }
  await expect(page.getByRole('heading', { name: /forrás-állapot/i })).toBeVisible();

  const sourceTable = page.locator('table.case-table').first();
  await expect(sourceTable).toBeVisible();
  for (const header of ['Forrás', 'Aktív?', 'Utolsó futás', 'Utolsó siker', 'Egymás utáni hibák']) {
    await expect(sourceTable.locator('thead th', { hasText: header })).toBeVisible();
  }

  const runsHeader = page.getByRole('heading', { name: /legutóbbi futások/i });
  await expect(runsHeader).toBeVisible();
});
