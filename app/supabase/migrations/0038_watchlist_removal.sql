-- WatchlistRemoval — runtime "eltávolítva" felismerés a WATCH_LIST 8 fejére.
-- A watchlist-config.ts / watchlist-detail-config.ts statikus config marad az
-- alap; ez a tábla csak akkor kap sort egy személyhez, ha a
-- detect-watchlist-removals.ts cron legalább 2 független forrású cikk alapján
-- megerősítette, hogy a megbízatása ténylegesen (nem csak tervezetten) megszűnt.
CREATE TABLE IF NOT EXISTS "WatchlistRemoval" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "personId" text NOT NULL UNIQUE,
  "removalType" text NOT NULL,
  "detectedAt" timestamptz NOT NULL DEFAULT now(),
  "sourceHeadline" text NOT NULL,
  "sourceName" text,
  "sourceUrl" text NOT NULL,
  "sourceDateLabel" text,
  "lead" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
