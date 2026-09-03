-- A kvíz nyitóoldalán (Kezdés-gomb előtt) megjelenő borítókép mezői.
-- User report 2026-09-03: "nincs az első oldalon kép, amit kértem" — a
-- player.hu-mintájú kvíz-hero eddig hiányzott, csak a kérdéseknek volt képe.
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "coverImageUrl" text;
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "coverImageCaption" text;
