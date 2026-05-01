# Cloudmersive EICAR smoke — 2026-04-30

Launch-gate T131. Verifies the Cloudmersive integration end-to-end by
uploading a known EICAR test file and confirming the queue marks it
`infected` with a Slack alert (FR-034, SC-013).

## Status

`PENDING` — must be exercised on staging before spec-Phase-2 ships.

## Procedure

1. **Prepare** the EICAR test string in a file:
   ```sh
   echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > /tmp/eicar.com
   ```
2. **Submit** a test report at `/bejelentes` (staging) with `eicar.com`
   attached. The form should accept the upload (ALLOWED_MIME includes
   `application/octet-stream`? — check; otherwise rename to `.txt`).
3. **Watch** the editor Slack channel — within 15 minutes a message
   should arrive saying "vírus detected on KM-NEW-XXXXXX, attachment
   quarantined".
4. **Open** `/admin` — the row should be `rejected` with a red badge;
   its `SubmissionAttachment` row should have `virusScanStatus = 'infected'`.
5. **Verify** the storage object is gone:
   ```sh
   supabase storage ls submissions/<id>/
   ```
   Should return zero objects.

## Evidence

| Field | Value |
|-------|-------|
| Submission ref | _to be recorded_ |
| Slack alert received at | _to be recorded_ |
| Queue status | `rejected` (expected) |
| Storage object removed | _PASS / FAIL_ |
| Operator | _to be recorded_ |
| Notes | |

## Recurrence

Re-run after any change to `packages/shared/src/virus-scan.ts` or the
`submission.intake` Inngest function. Annual rehearsal otherwise.
