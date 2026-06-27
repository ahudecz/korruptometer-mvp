# Public-tier redaction policy (placeholder)

Awaiting counsel sign-off — public-tier render path is gated until this
document is replaced.

This placeholder satisfies the CODEOWNERS protection that gates
`apps/web/app/galeria/**`, `apps/web/src/lib/public-render/**`, and the
investigation-engine migration. The runtime gate
(`PUBLIC_TIER_ENABLED=false`) remains in effect until counsel's
finalised policy text supersedes this file.

Until then, no public-tier route should render any of:

- claim text, evidence quotes, or paragraph locators from `ArticleClaim`
- `parties[].name` strings beyond the names already published on the
  `Case` row
- `ExternalRecord.rawPayload` content

This policy file is intentionally minimal to keep the migration
additive (constitution Principle VII) and the public-tier surface
guarded by all three FR-033 gates.
