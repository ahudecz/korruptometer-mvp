# Dependabot policy + audit allowlist

`pnpm audit --prod` runs in CI on every PR + every push to `main`. Findings
that we cannot or will not fix immediately are tracked in
`app/.audit-allowlist.json`. Every entry expires after at most 90 days and
gets re-blocked automatically.

## The flow

1. `pnpm audit --prod --json` runs in CI (see `.github/workflows/ci.yml`).
2. The audit script joins the JSON output against `.audit-allowlist.json`.
3. **Any advisory not in the allowlist fails the build.**
4. **Any allowlist entry past `expires` fails the build** — the entry has to
   be reviewed and either re-justified or removed.

## Allowlist schema

```json
{
  "$schema": "...",
  "policy": {
    "max_age_days": 90,
    "review_owner": "@korr/security",
    "review_doc": "app/docs/dependabot-policy.md"
  },
  "allowlist": {
    "<advisory id>": {
      "rationale": "why this is acceptable for now",
      "expires": "2026-07-30",
      "reviewer": "@username"
    }
  }
}
```

* `rationale` — required, human-readable. "We don't use that code path
  because …" or "Vendor patch landed but isn't published yet, ETA …".
* `expires` — required, ISO date, ≤90 days from the entry being added.
* `reviewer` — required, the GitHub handle who countersigned.

## When an advisory fires

1. Audit script logs the advisory ID and exits with non-zero status.
2. Reproduce locally: `cd app && pnpm audit --prod`.
3. Choose:
   * **Fix**: bump the dependency, rebuild, re-run audit.
   * **Allowlist**: add an entry with a justification and an `expires` date.
   * **Replace**: swap the dependency for an alternative.
4. Open a PR. Audit-allowlist edits require sign-off from `@korr/security`.

## Dependabot configuration

Dependabot is configured at repo level (`.github/dependabot.yml`) to open
PRs for `app/` workspace packages weekly. PRs that bump dependencies
referenced in the allowlist auto-link to the allowlist entry so the
reviewer can mark them resolved.

## Forbidden allowlist patterns

Never allowlist:

* Advisories with `severity = critical` and a fix available
* Advisories on packages directly used in submission-handling code
  (`packages/shared/src/turnstile.ts`, `encryption.ts`, `sealed-box.ts`)
* Advisories on packages used in the auth path (`@supabase/ssr`,
  `@simplewebauthn/server`)

If one of these fires, fix or replace — never allowlist.
