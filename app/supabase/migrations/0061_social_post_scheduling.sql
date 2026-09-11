-- Ütemezett Facebook-posztolás.
-- user kérés, 2026-09-11: "olyat tudsz, hogy egyben jönnek telegramra, hogy ne
-- kelljen velük baszakodnom külön, de pár óra csúsztatással küldöd ki akkor is,
-- ha egyben hagyom jóvá?" — a jóváhagyás mostantól nem posztol azonnal (az első
-- kivételével), hanem `status='approved'` + `scheduledFor` időpontot ad, és a
-- /api/cron/publish-scheduled-social cron viszi ki, amikor esedékes.
ALTER TABLE "SocialPostOutbox"
  ADD COLUMN IF NOT EXISTS "scheduledFor" timestamptz;

-- A publikáló cron kizárólag (status, scheduledFor) alapján keres.
CREATE INDEX IF NOT EXISTS "SocialPostOutbox_status_scheduledFor_idx"
  ON "SocialPostOutbox" ("status", "scheduledFor");
