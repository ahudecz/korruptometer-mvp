CREATE TYPE "public"."case_status" AS ENUM('Lezárva', 'Vádemelés', 'Folyamatban');--> statement-breakpoint
CREATE TYPE "public"."detention" AS ENUM('loose', 'wanted', 'busted', 'pretrial', 'investig');--> statement-breakpoint
CREATE TYPE "public"."dsr_kind" AS ENUM('access', 'deletion');--> statement-breakpoint
CREATE TYPE "public"."dsr_status" AS ENUM('received', 'verified', 'fulfilled', 'closed');--> statement-breakpoint
CREATE TYPE "public"."editor_role" AS ENUM('admin', 'editor');--> statement-breakpoint
CREATE TYPE "public"."kmonitor_approval_state" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."scraper_run_status" AS ENUM('running', 'success', 'failure');--> statement-breakpoint
CREATE TYPE "public"."sector" AS ENUM('Közbeszerzés', 'Önkormányzat', 'Állami vállalat', 'EU pályázat', 'Egészségügy', 'Egyéb');--> statement-breakpoint
CREATE TYPE "public"."source_tag" AS ENUM('investigative', 'national', 'regional', 'agency', 'newsletter');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('received', 'in_review', 'approved', 'rejected', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."virus_scan_status" AS ENUM('pending', 'clean', 'infected', 'error');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "AuditLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actorEditorId" uuid,
	"action" text NOT NULL,
	"entityType" text NOT NULL,
	"entityId" text NOT NULL,
	"detail" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Case" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"amount" bigint NOT NULL,
	"sentenceYears" integer NOT NULL,
	"caseYear" integer NOT NULL,
	"status" "case_status" NOT NULL,
	"region" text NOT NULL,
	"sector" "sector" NOT NULL,
	"summary" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DsrRequest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subjectEmailHash" text NOT NULL,
	"kind" "dsr_kind" NOT NULL,
	"status" "dsr_status" DEFAULT 'received' NOT NULL,
	"slaDeadline" timestamp with time zone NOT NULL,
	"assignedEditorId" uuid,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "EditorKey" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"editorId" uuid NOT NULL,
	"publicKey" text NOT NULL,
	"fingerprint" text NOT NULL,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Editor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"displayName" text,
	"role" "editor_role" DEFAULT 'editor' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "Editor_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "KMonitorArticle" (
	"newsId" integer PRIMARY KEY NOT NULL,
	"sourceUrl" text DEFAULT '' NOT NULL,
	"archiveUrl" text,
	"title" text DEFAULT '' NOT NULL,
	"pubTime" timestamp with time zone,
	"amountHuf" bigint,
	"newspaper" text,
	"category" text,
	"topics" jsonb,
	"institutions" jsonb,
	"places" jsonb,
	"importedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "KMonitorPersonArticle" (
	"personId" uuid NOT NULL,
	"newsId" integer NOT NULL,
	"amountHuf" bigint,
	CONSTRAINT "KMonitorPersonArticle_personId_newsId_pk" PRIMARY KEY("personId","newsId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "KMonitorPersonCandidate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"displayName" text NOT NULL,
	"normalizedName" text NOT NULL,
	"mentionCount" integer DEFAULT 0 NOT NULL,
	"articleCountWithAmount" integer DEFAULT 0 NOT NULL,
	"medianAmountHuf" bigint,
	"p75AmountHuf" bigint,
	"p1AmountHuf" bigint,
	"p10AmountHuf" bigint,
	"p50AmountHuf" bigint,
	"p90AmountHuf" bigint,
	"p99AmountHuf" bigint,
	"topTopics" jsonb,
	"maxAmountHuf" bigint,
	"topInstitutions" jsonb,
	"topPersons" jsonb,
	"sampleArticles" jsonb,
	"llmAmountHuf" bigint,
	"llmConfidence" integer,
	"llmEvidence" text,
	"llmCheckedAt" timestamp with time zone,
	"firstSeenAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSeenAt" timestamp with time zone DEFAULT now() NOT NULL,
	"approvalState" "kmonitor_approval_state" DEFAULT 'pending' NOT NULL,
	"caseId" text,
	"decidedAt" timestamp with time zone,
	"decidedBy" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "KMonitorPersonCandidate_normalizedName_unique" UNIQUE("normalizedName")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "KMonitorTagCandidate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"firstSeenAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSeenAt" timestamp with time zone DEFAULT now() NOT NULL,
	"approvalState" "kmonitor_approval_state" DEFAULT 'pending' NOT NULL,
	"caseId" text,
	"articleCount" integer DEFAULT 0 NOT NULL,
	"lastTraversedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "KMonitorTagCandidate_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "KpiSnapshot" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"computedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"totalDamage" bigint NOT NULL,
	"totalPrisonYears" integer NOT NULL,
	"activeCases" integer NOT NULL,
	"newIndictmentsThisWeek" integer NOT NULL,
	"partnerCount" integer NOT NULL,
	"bySector" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "NewsArticle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sourceId" uuid NOT NULL,
	"headline" text NOT NULL,
	"excerpt" text NOT NULL,
	"sourceUrl" text NOT NULL,
	"sourceUrlHash" text NOT NULL,
	"publishedAt" timestamp with time zone NOT NULL,
	"tag" text,
	"relatedCaseId" text,
	"linkConfidence" integer,
	"linkOverridden" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"viaArchive" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "RogueProfile" (
	"caseId" text PRIMARY KEY NOT NULL,
	"variant" integer NOT NULL,
	"glasses" boolean DEFAULT false NOT NULL,
	"hair" text NOT NULL,
	"detention" "detention" NOT NULL,
	"detentionLabel" text NOT NULL,
	"crimes" text[] NOT NULL,
	"extraStatus" text,
	"mugshotUrl" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ScraperRun" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sourceId" uuid NOT NULL,
	"startedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"finishedAt" timestamp with time zone,
	"status" "scraper_run_status" DEFAULT 'running' NOT NULL,
	"articlesFound" integer DEFAULT 0 NOT NULL,
	"articlesNew" integer DEFAULT 0 NOT NULL,
	"errorMessage" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"homepage" text NOT NULL,
	"tag" "source_tag" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"lastScrapedAt" timestamp with time zone,
	"lastSuccessAt" timestamp with time zone,
	"consecutiveFailures" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "Source_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SubmissionAttachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submissionId" uuid NOT NULL,
	"storageKey" text NOT NULL,
	"fileName" text NOT NULL,
	"mimeType" text NOT NULL,
	"sizeBytes" bigint NOT NULL,
	"virusScanStatus" "virus_scan_status" DEFAULT 'pending' NOT NULL,
	"virusScanDetail" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"suspectName" text NOT NULL,
	"suspectPosition" text,
	"suspectRegion" text,
	"period" text,
	"crimes" text[] NOT NULL,
	"estimatedAmount" bigint,
	"summary" text,
	"sourceUrls" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"anonymous" boolean DEFAULT true NOT NULL,
	"allowContact" boolean DEFAULT false NOT NULL,
	"reporterEmailEnc" text,
	"reporterNameEnc" text,
	"status" "submission_status" DEFAULT 'received' NOT NULL,
	"purgePiiAt" timestamp with time zone,
	"createdCaseId" text,
	"bodyCipher" text,
	"reporterEmailCipher" text,
	"reporterNameCipher" text,
	"recipientFingerprints" text[],
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "Submission_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "WorkerHeartbeat" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorEditorId_Editor_id_fk" FOREIGN KEY ("actorEditorId") REFERENCES "public"."Editor"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DsrRequest" ADD CONSTRAINT "DsrRequest_assignedEditorId_Editor_id_fk" FOREIGN KEY ("assignedEditorId") REFERENCES "public"."Editor"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "EditorKey" ADD CONSTRAINT "EditorKey_editorId_Editor_id_fk" FOREIGN KEY ("editorId") REFERENCES "public"."Editor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "KMonitorPersonArticle" ADD CONSTRAINT "KMonitorPersonArticle_personId_KMonitorPersonCandidate_id_fk" FOREIGN KEY ("personId") REFERENCES "public"."KMonitorPersonCandidate"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "KMonitorPersonArticle" ADD CONSTRAINT "KMonitorPersonArticle_newsId_KMonitorArticle_newsId_fk" FOREIGN KEY ("newsId") REFERENCES "public"."KMonitorArticle"("newsId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "KMonitorPersonCandidate" ADD CONSTRAINT "KMonitorPersonCandidate_caseId_Case_id_fk" FOREIGN KEY ("caseId") REFERENCES "public"."Case"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "KMonitorPersonCandidate" ADD CONSTRAINT "KMonitorPersonCandidate_decidedBy_Editor_id_fk" FOREIGN KEY ("decidedBy") REFERENCES "public"."Editor"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "KMonitorTagCandidate" ADD CONSTRAINT "KMonitorTagCandidate_caseId_Case_id_fk" FOREIGN KEY ("caseId") REFERENCES "public"."Case"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_sourceId_Source_id_fk" FOREIGN KEY ("sourceId") REFERENCES "public"."Source"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_relatedCaseId_Case_id_fk" FOREIGN KEY ("relatedCaseId") REFERENCES "public"."Case"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "RogueProfile" ADD CONSTRAINT "RogueProfile_caseId_Case_id_fk" FOREIGN KEY ("caseId") REFERENCES "public"."Case"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ScraperRun" ADD CONSTRAINT "ScraperRun_sourceId_Source_id_fk" FOREIGN KEY ("sourceId") REFERENCES "public"."Source"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SubmissionAttachment" ADD CONSTRAINT "SubmissionAttachment_submissionId_Submission_id_fk" FOREIGN KEY ("submissionId") REFERENCES "public"."Submission"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Submission" ADD CONSTRAINT "Submission_createdCaseId_Case_id_fk" FOREIGN KEY ("createdCaseId") REFERENCES "public"."Case"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AuditLog_actorAt_idx" ON "AuditLog" USING btree ("actorEditorId","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AuditLog_entity_idx" ON "AuditLog" USING btree ("entityType","entityId","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Case_amount_idx" ON "Case" USING btree ("amount");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Case_year_idx" ON "Case" USING btree ("caseYear");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Case_sector_idx" ON "Case" USING btree ("sector");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Case_region_idx" ON "Case" USING btree ("region");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Case_status_idx" ON "Case" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KMonitorArticle_pubTime_idx" ON "KMonitorArticle" USING btree ("pubTime");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KMonitorArticle_newspaper_idx" ON "KMonitorArticle" USING btree ("newspaper");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KMonitorPersonArticle_personId_amount_idx" ON "KMonitorPersonArticle" USING btree ("personId","amountHuf");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KMonitorPersonCandidate_approvalState_idx" ON "KMonitorPersonCandidate" USING btree ("approvalState");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KMonitorPersonCandidate_mentionCount_idx" ON "KMonitorPersonCandidate" USING btree ("mentionCount");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KMonitorPersonCandidate_decidedAt_idx" ON "KMonitorPersonCandidate" USING btree ("decidedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KMonitorTagCandidate_approvalState_idx" ON "KMonitorTagCandidate" USING btree ("approvalState");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KMonitorTagCandidate_firstSeenAt_idx" ON "KMonitorTagCandidate" USING btree ("firstSeenAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "NewsArticle_sourceUrlHash_idx" ON "NewsArticle" USING btree ("sourceUrlHash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "NewsArticle_publishedAt_idx" ON "NewsArticle" USING btree ("publishedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "NewsArticle_relatedCaseId_idx" ON "NewsArticle" USING btree ("relatedCaseId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ScraperRun_sourceId_startedAt_idx" ON "ScraperRun" USING btree ("sourceId","startedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "SubmissionAttachment_submissionId_idx" ON "SubmissionAttachment" USING btree ("submissionId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Submission_status_createdAt_idx" ON "Submission" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Submission_purgePiiAt_idx" ON "Submission" USING btree ("purgePiiAt");