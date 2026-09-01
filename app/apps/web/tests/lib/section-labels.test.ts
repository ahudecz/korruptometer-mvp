import { describe, expect, it, vi } from 'vitest';
import { SECTION_LABELS_HU, SUBSCRIPTION_SECTIONS } from '@korr/shared/sections';

vi.mock('server-only', () => ({}));

const { TARGET_LABELS_HU } = await import('@/lib/notify-auto-publish');
const { DETECTOR_LABELS_HU } = await import('@/lib/notify');

/**
 * 012-reader-subscriptions FR-009 / V11 — rögzítő teszt.
 *
 * A kulcshalmazokat FUTÁSIDŐBEN olvassuk ki az objektumokból, nem a TypeScript
 * típusból: egy típus futásidőben semmit nem rögzít, és pont az a hiba, amit
 * el akarunk kapni (valaki felvesz egy szekciót az egyik térképbe, a másikba nem).
 */
describe('section label maps (FR-009)', () => {
  it('SECTION_LABELS_HU covers exactly the six subscription sections', () => {
    expect(Object.keys(SECTION_LABELS_HU).sort()).toEqual([...SUBSCRIPTION_SECTIONS].sort());
    for (const label of Object.values(SECTION_LABELS_HU)) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it('every key of TARGET_LABELS_HU has a counterpart in SECTION_LABELS_HU', () => {
    for (const key of Object.keys(TARGET_LABELS_HU)) {
      expect(SECTION_LABELS_HU).toHaveProperty(key);
    }
  });

  it('every key of DETECTOR_LABELS_HU has a counterpart in SECTION_LABELS_HU', () => {
    for (const key of Object.keys(DETECTOR_LABELS_HU)) {
      expect(SECTION_LABELS_HU).toHaveProperty(key);
    }
  });

  it('the editor-facing wording is NOT re-derived from the reader-facing map', () => {
    // FR-009 — a watchlist_removal szerkesztői címkéje szándékosan MÁS szöveg.
    // Ha ez a teszt elbukik, valaki összekötötte a két térképet, és ezzel
    // csendben átírta az élő szerkesztői Telegram-értesítéseket.
    expect(TARGET_LABELS_HU.watchlist_removal).not.toBe(SECTION_LABELS_HU.watchlist_removal);
  });
});
