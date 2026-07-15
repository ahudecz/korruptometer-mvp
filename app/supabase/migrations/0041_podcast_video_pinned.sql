-- PodcastVideo.pinnedUntil — kézzel kitűzött "kiemelt" videó, időkorláttal
-- (pl. "ez legyen a hero 1 hétig"). A homepage/podcastok lekérdezés ezt
-- részesíti előnyben a legfrissebb videó helyett, amíg pinnedUntil a jövőben
-- van; utána automatikusan visszaáll a normál "legfrissebb elöl" sorrendre.
ALTER TABLE "PodcastVideo" ADD COLUMN IF NOT EXISTS "pinnedUntil" timestamptz;

CREATE INDEX IF NOT EXISTS "PodcastVideo_pinnedUntil_idx" ON "PodcastVideo" ("pinnedUntil");
