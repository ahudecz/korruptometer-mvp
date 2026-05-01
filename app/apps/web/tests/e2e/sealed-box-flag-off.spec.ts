import { test, expect } from '@playwright/test';

/**
 * T217 — with SUBMISSIONS_SEALED_BOX_ENABLED=false the form copy reverts
 * to the Phase-2 truthful text and the request body is the Phase-2 shape.
 * This spec only asserts the form-copy half — the request-body shape is
 * the Vitest test in T218.
 */
const PHASE_2 = 'A bejelentésedet titkosítva tároljuk és csak a szerkesztőség férhet hozzá.';

test('with the flag off, /bejelentes shows the Phase-2 truthful copy', async ({ page }) => {
  if (process.env.SUBMISSIONS_SEALED_BOX_ENABLED === 'true') {
    test.skip(true, 'flag is on — Phase-4 spec covers this run');
    return;
  }
  await page.goto('/bejelentes');
  const body = await page.locator('body').innerText();
  expect(body).toContain(PHASE_2);
});
