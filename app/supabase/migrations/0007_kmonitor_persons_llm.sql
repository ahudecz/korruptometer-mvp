-- Slice 10 — LLM-refined fields for KMonitorPersonCandidate.
-- Populated by scripts/kmdb/llm-tighten.ts using Anthropic Haiku 4.5 with
-- structured output, asking "did this person allegedly misappropriate X HUF?"
-- llmConfidence is stored as 0..100 (integer percentage) for portability.

ALTER TABLE "KMonitorPersonCandidate"
  ADD COLUMN IF NOT EXISTS "llmAmountHuf" bigint,
  ADD COLUMN IF NOT EXISTS "llmConfidence" integer,
  ADD COLUMN IF NOT EXISTS "llmEvidence" text,
  ADD COLUMN IF NOT EXISTS "llmCheckedAt" timestamptz;
