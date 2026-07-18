-- NewsArticle.breakingPinnedUntil — kézzel kitűzött BREAKING hír, időkorláttal
-- védve (pl. "ez maradjon kint 48 óráig, semmi ne írja felül"). A getActiveBreaking()
-- / pickBreakingArticle() ezt a legmagasabb prioritási szintként kezeli, amíg a
-- pinnedUntil a jövőben van — utána automatikusan visszaáll a normál
-- breakingOverride/isBreakingCandidate rangsorolásra. Ugyanaz a minta, mint a
-- PodcastVideo.pinnedUntil (0041) — l. 2026-07-18 user report: a refresh-daily-
-- breaking cron (eseményvezérelt, gyakran fut) egy sima breakingOverride-ot bármikor
-- felülírhat egy frissebb sztorival, nincs beépített "X óráig érinthetetlen".
ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "breakingPinnedUntil" timestamptz;

CREATE INDEX IF NOT EXISTS "NewsArticle_breakingPinnedUntil_idx" ON "NewsArticle" ("breakingPinnedUntil");
