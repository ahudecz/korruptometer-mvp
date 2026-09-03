import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 012-reader-subscriptions FR-029 / C12 — repó-alak teszt.
 *
 * Ez a teszt azért létezik, mert a hiba MÁSKÉNT teljesen láthatatlan: a
 * GitHub Actions csak a repó gyökerében lévő `.github/workflows/`-ból olvas.
 * Egy `app/.github/workflows/` alá tett ütemezés nem ad hibát, nem ír naplót
 * és nem fut le soha.
 */
/** A repó gyökere: felfelé lépkedve az első könyvtár, amiben van `.git`. */
function findRepoRoot(from: string): string {
  let dir = from;
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(resolve(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('repository root not found');
}

const repoRoot = findRepoRoot(__dirname);

describe('subscriptions.yml lives where GitHub actually reads it (FR-029)', () => {
  it('exists at the REPOSITORY root .github/workflows/', () => {
    expect(existsSync(resolve(repoRoot, '.github/workflows/subscriptions.yml'))).toBe(true);
  });

  it('does NOT exist under app/.github/workflows/, which GitHub never reads', () => {
    expect(existsSync(resolve(repoRoot, 'app/.github/workflows/subscriptions.yml'))).toBe(false);
  });

  it('carries the flush schedule and a dispatch that can reach every endpoint (FR-078)', () => {
    const yml = readFileSync(resolve(repoRoot, '.github/workflows/subscriptions.yml'), 'utf8');
    expect(yml).toContain("cron: '*/15 * * * *'");
    expect(yml).toContain('workflow_dispatch');
    for (const target of ['flush-alerts', 'digest', 'subscription-health']) {
      expect(yml).toContain(target);
    }
  });

  it('keys concurrency on the schedule and never cancels a run in progress (FR-025)', () => {
    const yml = readFileSync(resolve(repoRoot, '.github/workflows/subscriptions.yml'), 'utf8');
    expect(yml).toContain('cancel-in-progress: false');
    // A csoportnak vinnie KELL az ütemezést, különben a három ütemezés
    // egyetlen sorba kerül, és kioltják egymást.
    expect(yml).toContain('github.event.schedule');
  });
});
