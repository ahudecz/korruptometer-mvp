# Log retention

The form copy on `/bejelentes` says **"CDN- és platformszintű hozzáférési naplók
ideiglenesen rögzíthetik, ezeket legfeljebb 7 napig őrizzük."** Every platform
this product runs on must honour that ≤7-day cap. This file enumerates each
one, the configured retention, and the audit step at every deploy.

| Platform | Setting | Configured | Verified-by |
|----------|---------|-----------|-------------|
| Vercel project logs | Project Settings → Logs → Retention | ≤7 days | `VERCEL_LOG_RETENTION_DAYS_DECLARED` env var + screenshot SHA |
| Vercel log drain (Better Stack) | Drain target | ≤7 days | rolling-delete policy on Better Stack source |
| Inngest function-run logs | Project → Settings → Logs | ≤7 days | `INNGEST_LOG_RETENTION_DAYS_DECLARED` env var |
| Better Stack logs | Source → Retention | ≤7 days | API exposes `attributes.retention_days` per source |
| Sentry events | Project → Settings → Data Privacy | ≤7 days | screenshot in this folder |
| Supabase Storage | bucket lifecycle | N/A — orphan-scan owns deletion | `gdpr.retention-sweep` Inngest pass 2 |
| Resend send logs | Account → Settings → data retention | ≤7 days | `RESEND_LOG_RETENTION_DAYS_DECLARED` env var + dated screenshot SHA |

**Why Resend is a declared value and not an API read.** Better Stack's row can be
checked over its API because `GET /api/v1/sources` returns
`attributes.retention_days`. Resend's public API has no equivalent field — checked
2026-09-01 against the API reference — so Resend falls in the same class as Vercel
and Inngest: hand-verified, recorded in a `*_DECLARED` env var, evidenced by a dated
screenshot SHA. Re-check when the provider changes its API; an API read is the
stronger mechanism and takes precedence the moment one exists.

**Why this row exists at all.** The retention setting is made once, by hand, at
account creation. A one-time act has no ongoing enforcement: a later
reconfiguration, a tier change or a new team member would silently undo it. Only a
row here puts it under the deploy-time check. Resend's send logs carry recipient
addresses, and a retention setting added after the first send does not delete what
those sends already wrote.

## Deploy-time audit

The CI step `audit-log-retention.ts` runs once per deploy and queries each
platform's API where one exists, comparing the configured retention against
the 7-day cap. **Failure aborts the deploy.** See `app/scripts/audit-log-retention.ts`.

For platforms that don't expose their setting via API (Vercel, Inngest), the
deploy operator records the configured value in the corresponding
`*_DECLARED` env var and pastes the dashboard screenshot SHA into this file.

## When the limit is exceeded

1. Page the on-call editor — the form copy is now untrue.
2. Roll back the platform setting immediately.
3. Open a privacy-incident ticket via the DSR runbook (`dsr-runbook.md`).
4. The next `/bejelentes` deploy must NOT ship until the audit script
   returns `OK` for every platform.

## Rationale

This is FR-037, SC-019, and Constitution Principle I working together: the
truthful form copy depends on a verifiable platform configuration, not on a
runbook step that an operator might forget. The deploy-time check is the
guard.
