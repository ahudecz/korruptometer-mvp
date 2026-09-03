-- Kvíz-rendszer: több kvízt támogató, skálázható feleletválasztós játék, a
-- szavazás (PollQuestion) mintáját követve. Tisztán additív (2 új tábla),
-- nem érint meglévő oszlopot — nem igényel két lépéses migrációt
-- (Constitution VII).
--
-- Nincs eredmény-/kitöltés-tábla — a kvíz kitöltése kliens-oldali állapot,
-- nincs "már kitöltötted" korlátozás (ellentétben a szavazással), és nincs
-- IP/session-adat tárolva.

CREATE TABLE "Quiz" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "intro" text NOT NULL,
  "tiers" jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "QuizQuestion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "quizId" uuid NOT NULL REFERENCES "Quiz"("id") ON DELETE CASCADE,
  "displayOrder" integer NOT NULL DEFAULT 0,
  "questionText" text NOT NULL,
  "options" jsonb NOT NULL,
  "correctIndex" integer NOT NULL,
  "explanation" text,
  CONSTRAINT "QuizQuestion_correctIndex_range" CHECK ("correctIndex" >= 0 AND "correctIndex" <= 2)
);

CREATE INDEX "QuizQuestion_quiz_order_idx" ON "QuizQuestion" ("quizId", "displayOrder");
