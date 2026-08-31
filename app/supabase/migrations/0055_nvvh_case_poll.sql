-- 011-nvvh-case-poll: egy kérdéses, multiple-choice közösségi szavazás.
-- Tisztán additív (4 új tábla + 1 új enum), nem érint meglévő oszlopot —
-- nem igényel két lépéses migrációt (Constitution VII).
--
-- Szándékosan NINCS IP-oszlop egyik táblában sem — a nyers IP-cím sosem
-- kerül adatbázisba, csak az Upstash rate-limit kulcsban él, saját TTL-lel
-- (lásd specs/011-nvvh-case-poll/research.md #2).

CREATE TYPE "poll_question_status" AS ENUM ('open', 'closed');

CREATE TABLE "PollQuestion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "questionText" text NOT NULL,
  "minSelect" integer NOT NULL DEFAULT 1,
  "maxSelect" integer NOT NULL DEFAULT 5,
  "status" "poll_question_status" NOT NULL DEFAULT 'open',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "closedAt" timestamptz,
  CONSTRAINT "PollQuestion_select_range" CHECK ("minSelect" >= 1 AND "minSelect" <= "maxSelect")
);

CREATE TABLE "PollOption" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pollQuestionId" uuid NOT NULL REFERENCES "PollQuestion"("id") ON DELETE CASCADE,
  "displayOrder" integer NOT NULL DEFAULT 0,
  "title" text NOT NULL,
  "shortDescription" text NOT NULL,
  "longDescription" text,
  "amountHuf" bigint,
  "amountLabel" text,
  "sourceUrl" text NOT NULL,
  "sourceOutlet" text NOT NULL,
  "isAreaNotCase" boolean NOT NULL DEFAULT false,
  "touchesEuFunds" boolean NOT NULL DEFAULT false,
  "alreadyReported" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "PollOption_sourceUrl_not_empty" CHECK (length(trim("sourceUrl")) > 0)
);

CREATE INDEX "PollOption_question_order_idx" ON "PollOption" ("pollQuestionId", "displayOrder");
CREATE UNIQUE INDEX "PollOption_question_title_uq" ON "PollOption" ("pollQuestionId", "title");

CREATE TABLE "PollVote" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pollQuestionId" uuid NOT NULL REFERENCES "PollQuestion"("id") ON DELETE CASCADE,
  "votedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "PollVote_question_votedAt_idx" ON "PollVote" ("pollQuestionId", "votedAt");

-- Kapcsolótábla — az összetett PK garantálja, hogy egy szavazáson belül egy
-- opció csak egyszer szerepelhet. Az 1-5 darabszám-korlátot (FR-005) az API
-- route ellenőrzi tranzakción belül, beszúrás előtt.
CREATE TABLE "PollVoteSelection" (
  "pollVoteId" uuid NOT NULL REFERENCES "PollVote"("id") ON DELETE CASCADE,
  "pollOptionId" uuid NOT NULL REFERENCES "PollOption"("id") ON DELETE CASCADE,
  PRIMARY KEY ("pollVoteId", "pollOptionId")
);

CREATE INDEX "PollVoteSelection_option_idx" ON "PollVoteSelection" ("pollOptionId");
