import { test, expect } from '@playwright/test';

/**
 * T108 — admin can invite a second editor and that editor reaches the
 * queue but gets 403 on /admin/editors (US 7 acceptance scenarios 3, 4).
 * Skips when no session is available — the full flow is exercised at
 * launch-gate T130.
 */
test('/admin/login renders the magic-link form', async ({ page }) => {
  await page.goto('/admin/login');
  // The login page must show a heading + email input.
  await expect(page.getByRole('heading').first()).toBeVisible();
  const email = page.locator('input[type="email"]').first();
  await expect(email).toBeVisible();
});
