-- 002-investigation-engine — Scandal key (matter-level merge).
--
-- The bootstrap keyed cases by person+institution, which shatters a single
-- scandal that spans many entities/people (e.g. the MNB-alapítvány affair) into
-- a dozen near-duplicate cases. scandalKey/scandalName group those fragments
-- into one matter; the merge collapses fragments via the existing
-- Investigation.mergedIntoId (status='merged'), so the catalog shows one case.
-- Additive only (Principle VII).

ALTER TABLE "Investigation" ADD COLUMN "scandalKey"  text;
ALTER TABLE "Investigation" ADD COLUMN "scandalName" text;

CREATE INDEX "Investigation_scandalKey_idx" ON "Investigation" ("scandalKey");
