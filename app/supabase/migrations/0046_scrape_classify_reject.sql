-- ScrapeClassifyReject — a hash-alapú "már ismerjük" szűrő hiányzó fele
-- (scrape-news.ts). A NewsArticle.sourceUrlHash-alapú cache csak a
-- korábban BEILLESZTETT cikkeket ismeri fel újra; amit az AI korábban
-- irrelevánsnak ítélt, sosem kerül be a NewsArticle-be, ezért eddig minden
-- órában újra fizetős classify-hívást kapott. Ez a tábla permanensen
-- (nem évülő, szimmetrikusan a NewsArticle-alapú elfogadás-cache-sel)
-- rögzíti a valódi (nem tranziens-hiba) AI-elutasításokat.
CREATE TABLE IF NOT EXISTS "ScrapeClassifyReject" (
  "sourceUrlHash" text PRIMARY KEY,
  "checkedAt" timestamptz NOT NULL DEFAULT now()
);
