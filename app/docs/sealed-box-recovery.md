# Sealed-box recovery (Phase 4)

The Phase 4 sealed box (FR-076 / FR-077) addresses every submission to the
**multi-recipient envelope** of currently active editors. Every editor on
the recipient list can independently unseal a copy. This document covers
what to do when none of them can.

## The orphan-recipient state

If every editor on a sealed envelope's `recipientFingerprints[]` is now
inactive or has revoked their `EditorKey`, the queue cell renders the
explicit text:

> Ez a bejelentés olyan kulcsra van titkosítva, amit egyetlen aktív
> szerkesztő sem tart (orphan-recipient).

This is honest failure — never a 500, never a silently-blank cell. The cell
links to this document so the reader has a recovery path.

## Why the multi-recipient envelope

Single-recipient sealed boxes turn a lost device into a permanent dataloss.
We seal every submission to **N** editors at submission time so the loss of
any one device leaves the others able to read.

## Quorum unsealing

When a submission predates the current editor set entirely (for example, a
newsroom rotation where every editor has rotated out without doing the
rotation re-seal), the only path is **quorum recovery** from the previous
editors' personal device backups.

Procedure:

1. Identify the historic editor set from `EditorKey.fingerprint` matches
   against the row's `recipientFingerprints[]`.
2. Out-of-band, ask one of those editors to recover their secret key from
   their personal backup (typically a 1Password vault or a hardware key
   plus the WebAuthn PRF derivation).
3. That editor signs into `/admin/sealed-box/rotate` with their restored
   key and re-seals the affected rows to the current editor set.
4. Document the recovery in this file with an additional line below.

## The rotation function

`submissions.rotate-seal` (T209) re-seals every in-flight submission to a
new recipient list. It MUST be triggered:

* Whenever an editor is added (so they can read existing rows).
* Whenever an editor is revoked (so they cannot read new rows).
* On a schedule (monthly) so accidental misses don't accumulate.

The function is idempotent and resumable via Inngest step durability — an
interrupted run resumes at the last completed row.

## Single-admin device-loss path

The same path as `admin-recovery.md` applies for the WebAuthn passkey, but
the libsodium secret key requires extra care:

* The libsodium secret key is encrypted at rest in IndexedDB by a
  passkey-derived secret (large-blob extension preferred, PRF fallback).
* Losing the device means losing the IndexedDB store. Recovery is via a
  **personal backup** that the editor was instructed to take during
  enrolment.
* If no backup exists, the editor cannot recover — but the multi-recipient
  envelope means every other editor can still read every submission.

## Rotation drill

Schedule one rotation drill per quarter on staging. Document each in
`app/docs/sealed-box-rotation-staging-YYYY-MM-DD.md`. The first drill is
launch-gate T207 / T220.

## Recovery log

| Date | Affected rows | Recovery editor | Method | Re-seal status |
|------|---------------|-----------------|--------|----------------|
| (none yet) | | | | |
