import { test, expect } from '@playwright/test';

/**
 * T087 / T213 — flag-aware trust-posture snapshot. Default (Phase 2) renders
 * the truthful-but-modest copy; with SUBMISSIONS_SEALED_BOX_ENABLED=true the
 * Phase-4 strong-promise text replaces it verbatim.
 *
 * The dev server reads the env var at boot, so this spec runs as two
 * separate `test.describe` blocks gated by the flag's current value.
 */

const PHASE_2 =
  'A bejelentésedet titkosítva tároljuk és csak a szerkesztőség férhet hozzá. Az IP-címedet az adatbázisban nem tároljuk; CDN- és platformszintű hozzáférési naplók ideiglenesen rögzíthetik, ezeket legfeljebb 7 napig őrizzük. Súlyosan bizalmas anyagokhoz használj Tor-böngészőt.';

const PHASE_4 =
  'Beérkezésed végpont-titkosítva tároljuk és csak a szerkesztőség férhet hozzá. Az IP-címedet az adatbázisban nem tároljuk; CDN- és platformszintű hozzáférési naplók ideiglenesen rögzíthetik, ezeket legfeljebb 7 napig őrizzük. Súlyosan bizalmas anyagokhoz használj Tor-böngészőt.';

const flagOn = process.env.SUBMISSIONS_SEALED_BOX_ENABLED === 'true';
const expected = flagOn ? PHASE_4 : PHASE_2;

test('/bejelentes renders the correct trust-posture text for the current flag', async ({ page }) => {
  await page.goto('/bejelentes');
  const body = await page.locator('body').innerText();
  expect(body).toContain(expected);
  // The other version must not appear — if both leak we have drift.
  const other = flagOn ? PHASE_2 : PHASE_4;
  expect(body).not.toContain(other);
});
