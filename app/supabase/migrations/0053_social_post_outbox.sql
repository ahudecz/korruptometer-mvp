-- SocialPostOutbox — kifelé menő, automatikusan generált közösségimédia-
-- posztok (Facebook, később TikTok) mérföldkövekhez és breaking eseményekhez.
-- NE keverd a meglévő SocialPost táblával — az befelé jövő (más oldalak
-- posztjai a mi közösségi hírfolyamunkba), ez kifelé megy. Telegram-
-- jóváhagyás kötelező, mielőtt bármi élesben kimegy (l. check-social-
-- triggers.ts + telegram/webhook route.ts 's' ág). user kérés, 2026-08-30.
CREATE TABLE IF NOT EXISTS "SocialPostOutbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "triggerType" text NOT NULL,
  "triggerRefId" text,
  "milestoneValueFt" bigint,
  "headline" text NOT NULL,
  "caption" text NOT NULL,
  "imagePng" text NOT NULL,
  "platform" text NOT NULL DEFAULT 'facebook',
  "status" text NOT NULL DEFAULT 'pending_approval',
  "externalPostId" text,
  "telegramMessageId" integer,
  "failureReason" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "postedAt" timestamptz
);

CREATE INDEX IF NOT EXISTS "SocialPostOutbox_createdAt_idx" ON "SocialPostOutbox" ("createdAt");
