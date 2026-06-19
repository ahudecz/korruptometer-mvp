-- 003 financial-evidence layer — weakest validity tier.
-- 'estimated_rough' = LLM order-of-magnitude estimate of public money implicated,
-- for cases with no stated/grounded figure. Always flagged as the weakest tier
-- so the ranking can sort while making the low validity unmistakable.
ALTER TYPE damage_basis ADD VALUE IF NOT EXISTS 'estimated_rough';
