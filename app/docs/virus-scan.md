# Virus-scan failure-mode runbook

Cloudmersive is the Phase-2 vendor. Every submission attachment is enqueued
to `submission.intake` (Inngest), which calls `scanObject(bucket, key)` and
records the result on `SubmissionAttachment.virusScanStatus`.

## Status states

| Status | Meaning | Editor UX |
|--------|---------|-----------|
| `pending` | Scan in flight or vendor temporarily unavailable | Editor sees a banner: "Vírusellenőrzés folyamatban — letöltés tiltva" |
| `clean` | Scan passed | Editor can download |
| `infected` | Scan flagged the file | Storage object quarantined; submission marked `rejected`; Slack alert |
| `error` | Vendor returned an unexpected error after retries | Editor sees the same banner as `pending` and is asked to retry from the queue |

## Retry budget

`scanObject` retries up to **5 times** with exponential backoff (1s → 2s →
4s → 8s → 16s). Subsequent retries happen in a separate Inngest step on the
next manual queue review or on the next scheduled retention sweep.

A run-level cap of 5 attempts means a transient outage doesn't pin the worker;
a sustained outage flips the queue banner so editors know not to download
attachments.

## Pending-scan UX

* Editor queue lists `pending` rows with a yellow badge.
* Download buttons are disabled with the title "Várakozik a vírusellenőrzésre".
* Submission body and PII can still be read (per launch-gate T130 — the PII
  decrypt is independent of the attachment scan).

## Infected file handling

1. The Inngest step calls `Storage.deleteObject` to quarantine the file.
2. `Submission.status = 'rejected'` and `purgePiiAt = now() + 30d`.
3. The editor channel webhook fires with the `KM-NEW-XXXXXX` ref + the file
   name.
4. An `AuditLog` row is written: `action = 'attachment.infected'`,
   `entityType = 'SubmissionAttachment'`.
5. The reporter sees "elutasítva" in the public submission status check (no
   reason — we don't disclose detection signals to a potential attacker).

## Vendor-replace path

If Cloudmersive is unavailable for >24 hours **OR** the editor team decides
to drop the dependency, the replacement is **ClamAV** running in a separate
worker.

Migration outline:

1. Stand up ClamAV behind a small HTTP shim (Fly.io / Railway / a Fastify
   handler).
2. Replace `packages/shared/src/virus-scan.ts` with the new client; same
   `scanObject(bucket, key)` interface.
3. Keep both vendors in parallel for one week, alerting on disagreement.
4. Drop Cloudmersive when the parallel period is clean.

The runbook is intentionally vendor-agnostic — only `scanObject` is the
contract.
