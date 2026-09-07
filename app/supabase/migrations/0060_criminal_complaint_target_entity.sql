-- 2026-09-07 user report: két valós feljelentés-duplikátum csúszott át élesen
-- (Waberer's/MFB, MNB), és egy harmadik hiba is előjött ugyanabból az
-- okból — a "targetName" mező egy szabad szöveges ÜGY-LEÍRÁS, nem egy
-- önálló, atomi név, ezért (1) a duplikátum-egyeztetés csak elmosódott
-- szó-átfedéssel tudott dolgozni, (2) a Facebook-poszt "${filerName}
-- feljelentést tett ${targetName} ellen" mondata nyelvtanilag értelmetlenné
-- vált, ha targetName nem egy főnév, hanem egy egész mondat.
--
-- Ez a migráció egy ÚJ, opcionális "targetEntity" mezőt ad hozzá: a
-- feljelentés TÁRGYÁNAK (a feljelentett fél — személy/cég/intézmény) rövid,
-- kanonikus neve, elkülönítve a hosszabb targetName ügy-címkétől. A
-- detektor mostantól ezt is kinyeri (l. criminal-complaint-detect.ts), és a
-- review.ts findExistingComplaint()-ja ezt használja egy ÚJ, determinisztikus
-- (nem fuzzy, nem AI-döntőbírós) egyeztetési lépcsőhöz: ha a bejelentő ÉS a
-- feljelentett fél is egyezik, az egyértelműen ugyanaz a feljelentés.
--
-- Nullable, backfill nélkül — a régi sorok targetEntity=NULL marad, a
-- findExistingComplaint() ilyenkor a meglévő fuzzy-scoring útra esik vissza
-- (nincs viselkedésváltozás a régi soroknál). Nem destruktív változás,
-- Principle VII (two-step migráció) nem vonatkozik rá.

ALTER TABLE "CriminalComplaint" ADD COLUMN IF NOT EXISTS "targetEntity" text;

CREATE INDEX IF NOT EXISTS "CriminalComplaint_targetEntity_idx" ON "CriminalComplaint" ("targetEntity");
