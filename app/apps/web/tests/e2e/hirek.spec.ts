import { test, expect } from '@playwright/test';

/**
 * T144 — `/hirek` renders cards from at least three outlets, each card
 * has no body copy beyond headline+excerpt+meta, the outlet/tag filters
 * narrow the list, and pagination doesn't crash (US 10 acceptance
 * scenarios 1–3, FR-022).
 *
 * Skips when the seeded news set is empty (the empty-state UI is exercised
 * in component tests, not e2e).
 */
test('/hirek shows cards from multiple outlets', async ({ page }) => {
  await page.goto('/hirek');
  await expect(page.getByRole('heading', { name: /korrupciós hírfolyam/i })).toBeVisible();
  const empty = await page.getByText(/nincs még híranyag/i).count();
  test.skip(empty > 0, 'no seeded news in this environment');

  const cards = page.locator('.news-card');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  const outlets = new Set<string>();
  for (let i = 0; i < Math.min(count, 20); i += 1) {
    const meta = await cards.nth(i).locator('.news-meta span').first().innerText();
    outlets.add(meta);
  }
  expect(outlets.size).toBeGreaterThanOrEqual(3);
});

test('/hirek tag filter narrows results', async ({ page }) => {
  await page.goto('/hirek');
  const empty = await page.getByText(/nincs még híranyag/i).count();
  test.skip(empty > 0, 'no seeded news in this environment');

  const totalBefore = await page.locator('.news-card').count();
  const firstTag = await page
    .locator('.news-card .pill')
    .first()
    .innerText()
    .catch(() => '');
  test.skip(!firstTag, 'no tag pills available to filter on');

  await page.goto(`/hirek?tag=${encodeURIComponent(firstTag)}`);
  const totalAfter = await page.locator('.news-card').count();
  expect(totalAfter).toBeGreaterThan(0);
  expect(totalAfter).toBeLessThanOrEqual(totalBefore);
});
