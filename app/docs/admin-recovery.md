# Admin device-loss recovery

Single-admin passkey loss is the worst-case operational scenario short of
full data-loss. This runbook documents the path back to a working admin
session.

## Preconditions

* `BOOTSTRAP_ADMIN_EMAIL` is set in Vercel Production secrets.
* The seed script (`packages/db/seed.ts`) idempotently upserts that email
  into the `Editor` allowlist with `role = admin` and `active = true`.
* The bootstrap admin originally registered a passkey via
  `/admin/security/passkey` (per launch-gate T130).

## Recovery procedure

1. **Out-of-band identity verification.** The editor-in-chief or another
   senior staff member confirms — by phone call to a known number — that the
   admin is who they say they are and has indeed lost their device.

2. **Re-issue the passkey enrolment URL.**
   * Set `BOOTSTRAP_ADMIN_EMAIL` to the admin's email (it should already
     match — only confirm, do NOT overwrite with a new email unless that's
     part of recovery).
   * Trigger a Vercel redeploy (`vercel --prod` or the dashboard "Redeploy"
     button). The deploy re-runs the seed migration and re-asserts the
     editor row.
   * The admin opens `/admin/security/passkey` and enrols a new passkey on
     their replacement device.

3. **Audit-log entry.** The bootstrap flow writes
   `AuditLog{ action: 'admin.bootstrap', detail: { reason: 'recovery' } }`
   on every redeploy that runs the seed against an existing admin row. The
   editor-in-chief countersigns by adding a comment to the audit row via
   `/admin/audit` (or via psql).

4. **Post-recovery checklist.**
   * Rotate any shared secrets the lost device may have stored (Slack
     webhooks, Sentry DSN, CI tokens — none of these should be on a single
     admin's device, but in practice they sometimes are).
   * Within 24h, register a **second** admin's passkey so the next loss
     isn't single-pointed-failure again. The code path is the same: add a
     row to `Editor` with `role = admin`, `active = true`, then ask that
     admin to enrol via `/admin/security/passkey`.
   * Update `app/docs/passkey-bootstrap-2026-04-30.md` with the
     post-recovery state so the next launch-gate exercise has accurate
     evidence.

## Why we don't keep a "break-glass" recovery code

Recovery codes that survive device loss are credentials in disguise; if the
admin's password manager is also lost, the recovery code is too. The single
durable source of truth is the `BOOTSTRAP_ADMIN_EMAIL` env var + the seed
script. Anything else is a path to a leaked-credential incident.

## Single-admin device-loss exercise

Planned annually + after any change to the bootstrap flow. Document each run
in `passkey-bootstrap-YYYY-MM-DD.md`. The first run is launch-gate T130.
