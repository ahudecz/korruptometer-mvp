import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { ALERT_ON_EDITOR_CONFIRM } = await import('@/lib/notify-auto-publish');

/**
 * 012-reader-subscriptions FR-016 / FR-008 — rögzítő teszt.
 *
 * Ez a halmaz az FR-007 egyetlen engedett kivétele: nem a hat szekció, hanem
 * egy másik, háromértékű unió része. Ha valaki felveszi ide a bírósági
 * ítéletet, azzal elnémítja az A2 szerinti azonnali riasztást; ha kiveszi a
 * vagyonvisszaszerzést, azzal szerkesztői művelet nélkül enged ki üzenetet.
 */
describe('ALERT_ON_EDITOR_CONFIRM (FR-016)', () => {
  it('contains exactly asset_recovery and watchlist_removal', () => {
    expect([...ALERT_ON_EDITOR_CONFIRM].sort()).toEqual(['asset_recovery', 'watchlist_removal']);
  });

  it('asserts membership positively', () => {
    expect(ALERT_ON_EDITOR_CONFIRM.has('asset_recovery')).toBe(true);
    expect(ALERT_ON_EDITOR_CONFIRM.has('watchlist_removal')).toBe(true);
  });

  it('asserts non-membership: court_verdict alerts at the detector insert (A2), not on confirm', () => {
    expect(ALERT_ON_EDITOR_CONFIRM.has('court_verdict')).toBe(false);
  });

  it('holds exactly two members — no silent third', () => {
    expect(ALERT_ON_EDITOR_CONFIRM.size).toBe(2);
  });
});
