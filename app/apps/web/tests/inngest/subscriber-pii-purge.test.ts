import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ getDb: () => ({}), schema: {} }));
vi.mock('@/inngest/client', () => ({ inngest: { createFunction: () => ({}) } }));
vi.mock('@korr/shared/storage', () => ({ deleteObject: vi.fn(), listObjects: vi.fn(async () => []) }));
vi.mock('@korr/shared/slack', () => ({ postSlackDigest: vi.fn(async () => ({ posted: false })) }));

const { SUBSCRIBER_PURGE_COLUMNS } = await import('@/inngest/functions/gdpr-retention-sweep');

/**
 * 012-reader-subscriptions FR-086 — rögzítő teszt a törlendő oszlopokon.
 *
 * Ez a lista két irányban is teherviselő. Egy ide felvett `emailHash` csendben
 * megszüntetné a letiltás-jelölőt: egy törölt cím újra feliratkozhatna. Egy
 * innen kivett `emailEnc` csendben megtartaná a címet, azaz a törlés nem
 * törölne.
 */
describe('the subscriber PII purge column list (FR-086)', () => {
  it('nulls exactly these four columns', () => {
    expect([...SUBSCRIBER_PURGE_COLUMNS].sort()).toEqual([
      'confirmTokenHash',
      'confirmedIpHash',
      'emailEnc',
      'signupIpHash',
    ]);
  });

  it('KEEPS emailHash — the suppression marker an erased address relies on', () => {
    expect(SUBSCRIBER_PURGE_COLUMNS).not.toContain('emailHash');
  });

  it('KEEPS status and consentTextVersion — the Article 7(1) consent record', () => {
    expect(SUBSCRIBER_PURGE_COLUMNS).not.toContain('status');
    expect(SUBSCRIBER_PURGE_COLUMNS).not.toContain('consentTextVersion');
  });

  it('holds exactly four columns — no silent fifth', () => {
    expect(SUBSCRIBER_PURGE_COLUMNS).toHaveLength(4);
  });
});
