-- Kvíz-rendszer bővítés: kép/videó/link a kérdésekhez és a kvíz végi
-- lezáró videóhoz (user kérés — MNB-kvíz tartalmi finomítás, 2026-09-03).
-- Tisztán additív (csak új, nullable oszlopok) — nem igényel két lépéses
-- migrációt (Constitution VII). A meglévő "explanation" oszlop marad az
-- alapértelmezett (bármelyik válaszra mutatott) magyarázatnak;
-- "explanationWrong" csak akkor kerül felhasználásra, ha egy kérdésnél
-- külön kell kezelni a helyes/helytelen válasz utáni szöveget (l. a
-- Bánki Erik-es "meglepő helyes válasz" kérdést).

ALTER TABLE "QuizQuestion"
  ADD COLUMN "imageUrl" text,
  ADD COLUMN "imageCaption" text,
  ADD COLUMN "linkUrl" text,
  ADD COLUMN "linkLabel" text,
  ADD COLUMN "videoId" text,
  ADD COLUMN "videoIntro" text,
  ADD COLUMN "explanationWrong" text;

ALTER TABLE "Quiz"
  ADD COLUMN "outroVideoId" text,
  ADD COLUMN "outroVideoIntro" text;
