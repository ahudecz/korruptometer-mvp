-- 002-investigation-engine — Case name field.
--
-- Adds Investigation.caseName: a short descriptive case title (e.g.
-- "MNB-alapítványok – eltűnt közpénz"), distinct from primaryPersonName.
-- Populated by the catalog naming pass (singletons take their article
-- headline; multi-article cases get an LLM-generated title). The UI shows
-- caseName as the heading, falling back to person/institution when null.
-- Additive only (Principle VII).

ALTER TABLE "Investigation" ADD COLUMN "caseName" text;
