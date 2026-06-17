-- Hajdú János duplikátum törlése + leírás frissítése.
-- Megtartja a legrégebbit (legkisebb createdAt), a többit törli.
-- Ezután beállítja a description mezőt.

DELETE FROM "PoliticalResignation"
WHERE name ILIKE '%Hajdú János%'
  AND id NOT IN (
    SELECT id
    FROM "PoliticalResignation"
    WHERE name ILIKE '%Hajdú János%'
    ORDER BY "createdAt" ASC
    LIMIT 1
  );

UPDATE "PoliticalResignation"
SET description = 'Magyar Péter felmentette'
WHERE name ILIKE '%Hajdú János%';
