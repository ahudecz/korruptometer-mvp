-- 003 financial-evidence layer — damage basis tier.
--
-- Every damage figure now carries its evidential basis so a press allegation is
-- never shown as a proven fact. Tiers (strongest→weakest):
--   court_confirmed    — jogerős bírósági ítélet
--   audit_finding      — hatósági megállapítás (ÁSZ / OLAF)
--   procurement_modeled— TED túlárazás (megítélt − ajánlatkérői becslés)  [built]
--   alleged_reported   — sajtóban közölt VÉLELMEZETT kár (forrásolt idézettel)
-- "Unknown" = no DamageEstimate row at all. Additive only (Principle VII).

CREATE TYPE damage_basis AS ENUM (
  'court_confirmed',
  'audit_finding',
  'procurement_modeled',
  'alleged_reported'
);

ALTER TABLE "DamageEstimate" ADD COLUMN "basis" damage_basis;

-- existing estimates are all the TED procurement-overpricing model
UPDATE "DamageEstimate" SET "basis" = 'procurement_modeled' WHERE "basis" IS NULL;
