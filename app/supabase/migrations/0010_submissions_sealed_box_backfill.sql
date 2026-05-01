-- T200 — sealed-box backfill placeholder.
--
-- The Phase-4 backfill is operationally driven (editors re-seal existing
-- rows from the queue UI; see app/docs/sealed-box-recovery.md) so this
-- migration is intentionally a checklist comment plus a sanity-check view.
-- The destructive follow-up `0011_drop_legacy_pii_columns.sql` ships only
-- after this view reports zero rows for `legacy_only`.
--
-- Backfill checklist:
--   [ ] Every editor has enrolled their libsodium keypair via
--       /admin/security/passkey and POSTed the public-key half to
--       /api/admin/webauthn/register, populating `editor_recipient_keys`.
--   [ ] /admin/sealed-box/rotate has been run so every in-flight
--       Submission row has non-empty `recipientFingerprints[]`.
--   [ ] `submissions_backfill_status` reports
--       `legacy_only = 0`.
--   [ ] Phase-4 trust-copy snapshot test (T213) is green for
--       SUBMISSIONS_SEALED_BOX_ENABLED=true.

CREATE OR REPLACE VIEW submissions_backfill_status AS
SELECT
  COUNT(*) FILTER (
    WHERE "bodyCipher" IS NOT NULL OR "reporterEmailCipher" IS NOT NULL OR "reporterNameCipher" IS NOT NULL
  ) AS sealed_box,
  COUNT(*) FILTER (
    WHERE ("bodyCipher" IS NULL AND "reporterEmailCipher" IS NULL AND "reporterNameCipher" IS NULL)
      AND ("reporterEmailEnc" IS NOT NULL OR "reporterNameEnc" IS NOT NULL OR summary IS NOT NULL)
  ) AS legacy_only,
  COUNT(*) FILTER (
    WHERE status IN ('approved', 'rejected', 'duplicate') AND "purgePiiAt" IS NULL
  ) AS purged
FROM "Submission";
