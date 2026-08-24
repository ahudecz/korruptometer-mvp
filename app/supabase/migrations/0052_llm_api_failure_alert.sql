-- LlmApiFailureAlert — naponta egyszeri dedup-marker a VALÓDI Anthropic
-- API-hiba (halott kulcs, elfogyott kredit, kvóta-túllépés stb.) Telegram-
-- riasztásához (packages/db/src/llm-api-failure-alert.ts). Ez KÜLÖNBÖZIK a
-- LlmBudgetAlert-től: az a mi ÖNKÉNT vállalt napi költséglimitünk elérésekor
-- fut (a hívás el sem indul), ez pedig akkor, amikor a hívás TÉNYLEGESEN
-- elindult és az Anthropic API hibával tért vissza — 2026-07-12 óta ismert
-- tünet (kredit kifogyás), eddig teljesen csendben, csak console.error-ral.
CREATE TABLE IF NOT EXISTS "LlmApiFailureAlert" (
  "day" date PRIMARY KEY,
  "sentAt" timestamptz NOT NULL DEFAULT now(),
  "lastError" text
);
