CREATE TYPE "public"."resignation_type" AS ENUM('lemondás', 'kirúgás', 'felmentés', 'egyéb');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PoliticalResignation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"institution" text NOT NULL,
	"resignationType" "resignation_type" NOT NULL,
	"resignationDate" timestamp with time zone NOT NULL,
	"description" text,
	"sourceUrls" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"sourceNames" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"relatedCaseId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PoliticalResignation" ADD CONSTRAINT "PoliticalResignation_relatedCaseId_Case_id_fk" FOREIGN KEY ("relatedCaseId") REFERENCES "public"."Case"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PoliticalResignation_resignationDate_idx" ON "PoliticalResignation" USING btree ("resignationDate");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PoliticalResignation_institution_idx" ON "PoliticalResignation" USING btree ("institution");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PoliticalResignation_resignationType_idx" ON "PoliticalResignation" USING btree ("resignationType");