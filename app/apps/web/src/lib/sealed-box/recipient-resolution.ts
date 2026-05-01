/**
 * T204 / T205 — `recipientResolution`. A submission is "orphan-recipient"
 * iff none of its `recipientFingerprints[]` overlap with the active editor
 * recipient set (FR-080, SC-033). Pure function, no DOM, no libsodium —
 * shared between server (queue handler) and client (unseal UI).
 */

export type SealedRecipient = { fingerprint: string; ciphertextB64: string };

export type RecipientResolution =
  | 'sealed-box-active'
  | 'orphan-recipient'
  | 'no-envelope';

export function hasActiveRecipient(
  fingerprints: readonly string[],
  activeFingerprints: ReadonlySet<string>,
): boolean {
  return fingerprints.some((f) => activeFingerprints.has(f));
}

export function resolveRecipient(
  fingerprints: readonly string[] | null | undefined,
  activeFingerprints: ReadonlySet<string>,
): RecipientResolution {
  if (!fingerprints || fingerprints.length === 0) return 'no-envelope';
  return hasActiveRecipient(fingerprints, activeFingerprints)
    ? 'sealed-box-active'
    : 'orphan-recipient';
}
