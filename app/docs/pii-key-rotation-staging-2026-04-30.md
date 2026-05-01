# PII key rotation — staging exercise — 2026-04-30

Launch-gate T129. Verifies the rotation runbook for `PII_ENC_KEY` end-to-end
on a staging Supabase branch.

## Status

`PENDING` — must be exercised on staging before spec-Phase-2 ships.

## Why

Phase 2 leans on a single symmetric key (`PII_ENC_KEY`) to keep reporter
PII unreadable in offline backup-tape scenarios (FR-058,
`pii-threat-model.md`). If that key ever leaks, we must be able to
re-encrypt every submission within hours.

## Procedure

1. **Snapshot** the staging Postgres. Note the snapshot id.
2. **Generate** a new key:
   ```sh
   openssl rand -base64 32 > .pii-enc-key.next
   ```
3. **Set both keys** as Vercel env vars: `PII_ENC_KEY` (current),
   `PII_ENC_KEY_NEXT` (rotation target). The encryption helper reads
   `PII_ENC_KEY` to encrypt and tries `PII_ENC_KEY_NEXT` first to decrypt
   during the rotation window.
4. **Run the rotation script** (`pnpm --filter @korr/db tsx scripts/rotate-pii-key.ts`),
   which iterates every `Submission` row, decrypts with the old key,
   re-encrypts with the new key, and writes back atomically.
5. **Verify** by reading 3 sample rows from `/admin` and confirming PII
   renders correctly.
6. **Promote**: swap `PII_ENC_KEY` to the new value and unset
   `PII_ENC_KEY_NEXT`. Redeploy. Confirm `/admin` still renders.

## Evidence

| Field | Value |
|-------|-------|
| Snapshot ID | _to be recorded_ |
| Rows re-encrypted | _to be recorded_ |
| Verification render | _PASS / FAIL_ |
| Operator | _to be recorded_ |
| Notes | |

## Recurrence

Re-rehearse after any change to `packages/shared/src/encryption.ts` or
`scripts/rotate-pii-key.ts`. Annual rehearsal otherwise.
