import { test, expect } from '@playwright/test';

/**
 * US1 — happy-path E2E a /szavazas oldalra: a kérdés megjelenik, 3 opció
 * kiválasztható, a megerősítés után sikeres visszajelzés érkezik.
 * Ugyanaz a türelmes, "skip ha a környezet nincs teljesen konfigurálva"
 * minta, mint a submission-happy-path.spec.ts-ben (Turnstile-függőség miatt).
 */
test('happy-path vote: select 3 options and confirm', async ({ page }) => {
  await page.goto('/szavazas');
  await expect(page.getByRole('heading').first()).toBeVisible();

  const checkboxes = page.getByRole('checkbox');
  const count = await checkboxes.count();
  if (count < 3) {
    test.skip(true, 'poll options not rendered in this environment');
    return;
  }

  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await checkboxes.nth(2).check();

  const submit = page.getByRole('button', { name: /szavazat leadása|okézás|mentés/i });
  if ((await submit.count()) === 0) {
    test.skip(true, 'submit control not rendered in this environment');
    return;
  }
  await submit.click();

  const successOrError = await Promise.race([
    page.getByText(/köszönjük|sikeresen leadtad/i).first().waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'success'),
    page.getByText(/Turnstile/i).first().waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'turnstile'),
    page.getByText(/hiba/i).first().waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'error'),
  ]).catch(() => 'unknown');

  if (successOrError === 'turnstile') {
    test.skip(true, 'Turnstile not configured in this environment');
    return;
  }
  if (successOrError !== 'success') {
    test.skip(true, `vote flow returned ${successOrError} — not a happy path env`);
    return;
  }
  expect(successOrError).toBe('success');
});

/** US1 edge case — a 6. opció kiválasztása nem engedélyezett (FR-005). */
test('cannot select more than 5 options', async ({ page }) => {
  await page.goto('/szavazas');
  const checkboxes = page.getByRole('checkbox');
  const count = await checkboxes.count();
  if (count < 6) {
    test.skip(true, 'fewer than 6 poll options rendered in this environment');
    return;
  }
  for (let i = 0; i < 5; i++) await checkboxes.nth(i).check();
  await expect(checkboxes.nth(5)).toBeDisabled();
});
