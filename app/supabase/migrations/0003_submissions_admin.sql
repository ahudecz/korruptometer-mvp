-- spec-Phase-2 schema: submissions + admin queue + audit log + DSR queue.
-- spec-Phase-3 additions live in 0004_scraper_runs.sql + 0005_worker_heartbeat.sql.

-- ─── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM (
    'received', 'in_review', 'approved', 'rejected', 'duplicate'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE virus_scan_status AS ENUM ('pending', 'clean', 'infected', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE editor_role AS ENUM ('admin', 'editor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dsr_kind AS ENUM ('access', 'deletion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dsr_status AS ENUM ('received', 'verified', 'fulfilled', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Editor + EditorKey + AuditLog ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Editor" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  "displayName" text,
  role          editor_role NOT NULL DEFAULT 'editor',
  active        boolean NOT NULL DEFAULT true,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "EditorKey" (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "editorId"  uuid NOT NULL REFERENCES "Editor"(id) ON DELETE CASCADE,
  "publicKey" text NOT NULL,
  fingerprint text NOT NULL,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "EditorKey_editorId_idx" ON "EditorKey"("editorId");
CREATE INDEX IF NOT EXISTS "EditorKey_fingerprint_idx" ON "EditorKey"(fingerprint);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorEditorId" uuid REFERENCES "Editor"(id) ON DELETE SET NULL,
  action          text NOT NULL,
  "entityType"    text NOT NULL,
  "entityId"      text NOT NULL,
  detail          jsonb,
  at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "AuditLog_actorAt_idx"
  ON "AuditLog"("actorEditorId", at DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_entity_idx"
  ON "AuditLog"("entityType", "entityId", at DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_pii_read_idx"
  ON "AuditLog"(at DESC) WHERE action = 'pii.read';

-- ─── Submission + SubmissionAttachment ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Submission" (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref                      text NOT NULL UNIQUE,
  "suspectName"            text NOT NULL,
  "suspectPosition"        text,
  "suspectRegion"          text,
  period                   text,
  crimes                   text[] NOT NULL DEFAULT ARRAY[]::text[],
  "estimatedAmount"        bigint,
  summary                  text,
  "sourceUrls"             text[] NOT NULL DEFAULT ARRAY[]::text[],
  anonymous                boolean NOT NULL DEFAULT true,
  "allowContact"           boolean NOT NULL DEFAULT false,
  "reporterEmailEnc"       text,
  "reporterNameEnc"        text,
  status                   submission_status NOT NULL DEFAULT 'received',
  "purgePiiAt"             timestamptz,
  "createdCaseId"          text REFERENCES "Case"(id) ON DELETE SET NULL,
  -- Phase 4 sealed-box columns (unused until SUBMISSIONS_SEALED_BOX_ENABLED=true)
  "bodyCipher"             text,
  "reporterEmailCipher"    text,
  "reporterNameCipher"     text,
  "recipientFingerprints"  text[],
  "createdAt"              timestamptz NOT NULL DEFAULT now(),
  "updatedAt"              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Submission_status_createdAt_idx"
  ON "Submission"(status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Submission_purgePiiAt_idx"
  ON "Submission"("purgePiiAt") WHERE "purgePiiAt" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "SubmissionAttachment" (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "submissionId"     uuid NOT NULL REFERENCES "Submission"(id) ON DELETE CASCADE,
  "storageKey"       text NOT NULL,
  "fileName"         text NOT NULL,
  "mimeType"         text NOT NULL,
  "sizeBytes"        bigint NOT NULL,
  "virusScanStatus"  virus_scan_status NOT NULL DEFAULT 'pending',
  "virusScanDetail"  text,
  "createdAt"        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "SubmissionAttachment_submissionId_idx"
  ON "SubmissionAttachment"("submissionId");

-- ─── DsrRequest ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "DsrRequest" (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "subjectEmailHash"  text NOT NULL,
  kind                dsr_kind NOT NULL,
  status              dsr_status NOT NULL DEFAULT 'received',
  "slaDeadline"       timestamptz NOT NULL,
  "assignedEditorId"  uuid REFERENCES "Editor"(id) ON DELETE SET NULL,
  notes               text,
  "createdAt"         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "DsrRequest_status_idx" ON "DsrRequest"(status);
