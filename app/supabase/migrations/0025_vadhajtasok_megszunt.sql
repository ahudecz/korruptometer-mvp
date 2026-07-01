-- Vadhajtások.hu megszűnés — 2026. június 20.
INSERT INTO "MediaClosure" (id, name, "eventType", description, "eventDate", "sourceUrl", "sourceName", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Vadhajtások.hu',
  'megszűnés',
  'Szélsőjobboldali propagandaoldal, amelyet Orbán Viktor a választási vereség után saját „igeforrásának" nevezett. 2026. június 17-én rendőrségi házkutatást tartottak Bede Zsolt tulajdonosnál (Perintfalvi Rita és Pottyondy Edina feljelentései alapján, személyes adatokkal való visszaélés gyanúja miatt), adathordozóit lefoglalták. Az oldal ezután elérhetetlen lett.',
  '2026-06-20 00:00:00+00',
  'https://index.hu/belfold/2026/06/17/bede-zsolt-hazkutatas-rendorseg-feljelentes-perintfalvi-rita-vadhajtasok/',
  'Index',
  NOW(),
  NOW()
);
