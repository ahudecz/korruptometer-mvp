-- PodcastVideo — "legfrissebb podcastok" homepage-blokk (YouTube-videók
-- csatorna-RSS + kulcsszó/AI relevancia + csatornánkénti nézettségi küszöb
-- alapján, Telegram-jóváhagyással a bizonytalan esetekre).
--
-- Elutasításkor SZÁNDÉKOSAN nem törlünk sort (eltérően a
-- PoliticalResignation/MediaClosure/CourtVerdict "reject = delete" mintától,
-- l. app/apps/web/app/api/telegram/webhook/route.ts setPendingStatus
-- kommentje) — a videoId UNIQUE constraint az egyetlen dedup-mechanizmus az
-- RSS-újrafelfedezés ellen, egy törölt sor minden óránkénti pollnál újra
-- felbukkanna és újra Telegram-értesítést küldene, amíg ki nem csúszik a
-- csatorna RSS-jének ~15 elemes ablakából.
CREATE TABLE IF NOT EXISTS "PodcastVideo" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "videoId" text NOT NULL UNIQUE,
  "channelSlug" text NOT NULL,
  "channelName" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "publishedAt" timestamptz NOT NULL,
  "viewCount" integer,
  "viewThresholdMet" boolean NOT NULL DEFAULT false,
  "lastViewCheckAt" timestamptz,
  "reviewStatus" review_status NOT NULL DEFAULT 'pending',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "PodcastVideo_publishedAt_idx" ON "PodcastVideo" ("publishedAt");
CREATE INDEX IF NOT EXISTS "PodcastVideo_reviewStatus_idx" ON "PodcastVideo" ("reviewStatus");
