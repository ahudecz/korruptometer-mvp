-- 2026-07-25 — Konczos Nóra / Bús Balázs eset: a "verdictType" oszlop eddig
-- szabad text volt, DB-szinten semmi nem ellenőrizte az értékét. Egy korábbi
-- kézi javítás egy JS unicode-escape-et ("ő") szó szerint, fel nem
-- oldva írt bele SQL-lel, ami a TS-oldali (LLM tool-séma) enum-ellenőrzést
-- megkerülte, mert az csak a beszúráskor fut, nem a DB-ben. Ez a CHECK
-- constraint zárja be a rést örökre, FÜGGETLENÜL attól, milyen karakter/
-- hiba okozná — bármilyen nem a felsorolt 8 érték egyike lenne, az INSERT/
-- UPDATE azonnal elutasításra kerül, sose kerülhet csendben adatbázisba.
ALTER TABLE "CourtVerdict" ADD CONSTRAINT "CourtVerdict_verdictType_check"
  CHECK ("verdictType" IN (
    'előzetesben', 'elsőfokú', 'jogerős', 'vádemelés',
    'szabadlábra helyezve', 'eljárás megszűnt', 'felmentve', 'egyéb'
  ));
