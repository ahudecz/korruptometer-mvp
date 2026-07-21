-- LlmBudgetAlert — naponta egyszeri dedup-marker a "napi LLM-limit elérve"
-- Telegram-riasztáshoz (packages/db/src/llm-budget-alert.ts). A napi
-- ceiling-gate minden refuse-olt hívásnál újra látja, hogy spent >= ceiling
-- — magas forgalmú napon ez akár százszor is igaz lehet —, de a riasztást
-- csak EGYSZER küldjük el naponta. day PRIMARY KEY-re ON CONFLICT DO
-- NOTHING RETURNING adja az idempotenciát, a napi advisory lock alatt
-- (l. llm.ts), külön zárolás nélkül.
CREATE TABLE IF NOT EXISTS "LlmBudgetAlert" (
  "day" date PRIMARY KEY,
  "sentAt" timestamptz NOT NULL DEFAULT now()
);
