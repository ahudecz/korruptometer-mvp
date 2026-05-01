import { describe, it, expect } from 'vitest';

import { hasActiveRecipient, resolveRecipient } from './recipient-resolution';

/**
 * T203 — recipient-resolution. A submission counts as "orphan-recipient"
 * iff none of `recipientFingerprints[]` match an active EditorKey
 * fingerprint (FR-080, SC-033). Pure function, no libsodium.
 */
describe('hasActiveRecipient', () => {
  const fingerprints = ['a'.repeat(32), 'b'.repeat(32)];

  it('returns true when at least one fingerprint is active', () => {
    expect(hasActiveRecipient(fingerprints, new Set([fingerprints[0]!]))).toBe(true);
  });

  it('returns false when no fingerprints overlap (orphan-recipient)', () => {
    expect(hasActiveRecipient(fingerprints, new Set(['x'.repeat(32)]))).toBe(false);
  });

  it('handles an empty active set', () => {
    expect(hasActiveRecipient(fingerprints, new Set())).toBe(false);
  });
});

describe('resolveRecipient', () => {
  it('returns no-envelope for an empty/missing fingerprint list', () => {
    expect(resolveRecipient(null, new Set())).toBe('no-envelope');
    expect(resolveRecipient([], new Set())).toBe('no-envelope');
  });

  it('returns sealed-box-active when at least one recipient overlaps', () => {
    expect(resolveRecipient(['a'], new Set(['a']))).toBe('sealed-box-active');
  });

  it('returns orphan-recipient when nothing overlaps', () => {
    expect(resolveRecipient(['a'], new Set(['b']))).toBe('orphan-recipient');
  });
});
