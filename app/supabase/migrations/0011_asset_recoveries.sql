-- Asset recoveries tracker — powers the KPI-03 stat card and /visszaszerzett-vagyon page.
-- Each row is one distinct recovery event (returned funds, voided grants, etc.).

CREATE TABLE IF NOT EXISTS "AssetRecovery" (
  "id"          uuid          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "caseId"      text          NOT NULL,
  "caseLabel"   text          NOT NULL,
  "description" text          NOT NULL,
  "amountFt"    bigint        NOT NULL,
  "recoveredAt" timestamptz   NOT NULL,
  "sourceUrl"   text,
  "sourceName"  text,
  "createdAt"   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "AssetRecovery_caseId_idx"      ON "AssetRecovery"("caseId");
CREATE INDEX IF NOT EXISTS "AssetRecovery_recoveredAt_idx" ON "AssetRecovery"("recoveredAt");
CREATE INDEX IF NOT EXISTS "AssetRecovery_amountFt_idx"    ON "AssetRecovery"("amountFt");

-- Seed: two known NKA recoveries as of 2026-06
INSERT INTO "AssetRecovery" ("caseId", "caseLabel", "description", "amountFt", "recoveredAt", "sourceUrl", "sourceName")
VALUES
  (
    'nka-botrany',
    'NKA · pályázók visszautaltak',
    'Kis-Grófo, Városliget Zrt. és mások visszautaltak',
    1690000000,
    '2026-05-23 00:00:00+00',
    'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt',
    'Telex'
  ),
  (
    'nka-botrany',
    'NKA · Tarr Zoltán visszavont',
    'Hankó Balázs választás előtti osztogatásából visszavont',
    400000000,
    '2026-06-15 00:00:00+00',
    'https://telex.hu/belfold/2026/06/15/tarr-zoltan-visszavonja-hanko-balazs-aprilis-8-i-donteseit-melyekben-kozel-400-millio-forintot-osztott-ki',
    'Telex'
  )
ON CONFLICT DO NOTHING;
