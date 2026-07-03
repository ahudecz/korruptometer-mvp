-- Homepage restructure — adds a "pinned" flag to MediaClosure, mirroring
-- PoliticalResignation.pinned. Lets editors flag flagship closures (e.g.
-- Mandiner leépítés, Szuverenitásvédelmi Hivatal) so the compact homepage
-- teaser can show a curated "Kiemelt" row alongside the date-sorted
-- "Legfrissebb" row. Additive only.

ALTER TABLE "MediaClosure" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;
