# PII threat model

The Phase-2 control around reporter PII (email, name, body) is **symmetric
encryption with a server-held key** (`PII_ENC_KEY`, AES-256-GCM via
`packages/shared/src/encryption.ts`). The Phase-4 upgrade is a **multi-recipient
sealed box** (libsodium, FR-077) where the application server has no key
material.

This document states plainly what each control defends against and what it
does NOT defend against. The `/bejelentes` form copy must match the
honest characterisation here exactly (FR-058, FR-083).

## Threat actors

1. **Lost-tape attacker.** Someone who finds an offline backup of the
   Postgres database on a backup-tape, S3 export, or stolen disk.
2. **Compromised app-server attacker.** Someone with shell or memory
   access to a running Vercel function or scheduled Inngest worker.
3. **Compromised editor device.** Someone who has the editor's unlocked
   laptop with browser sessions intact and the local IndexedDB key store
   accessible.
4. **Compromised editor-secret-store.** Someone who has the team password
   manager / shared cred store containing every editor's libsodium secret
   key.

## Phase 2 — `pgp_sym_encrypt` (server-held key)

| Threat | Defended? | Why |
|--------|-----------|-----|
| Lost-tape attacker | YES — *if* the key is held separately from the backup tape (i.e. in Vercel secrets or Supabase Vault, NOT in the same backup) | The ciphertext is opaque without the key |
| Compromised app-server | NO | The key is in process memory on every render |
| Compromised editor device | NO | Editor renders rely on a server decrypt that flows plaintext over the wire |
| Compromised editor-secret-store | N/A | No editor secret in scope |

**Bottom line:** Phase 2 is honest about being a backup-tape control only.
The form copy says "csak a szerkesztőség férhet hozzá" — true under normal
operations, but a server compromise breaks this.

## Phase 4 — multi-recipient sealed box (no server key)

| Threat | Defended? | Why |
|--------|-----------|-----|
| Lost-tape attacker | YES | Recovery requires editor secret keys, which are not in scope of an offline tape |
| Compromised app-server | YES | The server never has plaintext or any secret key |
| Compromised editor device (unlocked, key store accessible) | NO | The local libsodium secret key is in IndexedDB, encrypted at rest by a passkey-derived secret. An unlocked browser with a recent passkey assertion can recover plaintext. |
| Compromised editor-secret-store | NO | Multiple editor secret keys in the same external store (e.g. team password manager) defeats the multi-recipient protection |

**Bottom line:** Phase 4 closes the server-compromise hole. The residual
risks are device-level — and we treat editor devices the same way we treat
journalist source material.

## Why Phase 2 ships first

Even with the residual risks documented, Phase 2 reduces the worst-case
exposure (backup-tape leak) and gives editors a workable queue while the
Phase 4 client encryption is built. The form copy is **deliberately
modest** in Phase 2 ("a szerkesztőséghez kerülnek titkosítva, csak ők
férnek hozzá az adatbázisban") and is upgraded to the strong promise
("Beérkezésed végpont-titkosítva tároljuk") in lockstep with the Phase 4
schema migration (T214 — flag-aware copy). Never before, never after.

## What changes if `PII_ENC_KEY` leaks (Phase 2)

1. Treat every reporter PII row as compromised. Notify reporters through
   the contact paths in the DSR runbook.
2. Rotate `PII_ENC_KEY` per `pii-key-rotation-staging-YYYY-MM-DD.md`,
   re-encrypting every existing submission.
3. Audit access to Vercel / Supabase secrets stores — the key should never
   have been read by a human.

## What changes if a single editor device is compromised (Phase 4)

1. Revoke the editor's `EditorKey` (`UPDATE EditorKey SET revokedAt = now() WHERE editorId = …`).
2. Re-seal every in-flight submission via `/admin/sealed-box/rotate` (T210)
   so the compromised key can no longer decrypt new content.
3. Treat the submissions that the compromised device decrypted as exposed;
   rely on the `pii.read` audit log to identify which rows were rendered.

This document is part of the launch gate; updates ship in lockstep with
`/bejelentes` form-copy changes (T128, T215, T216).
