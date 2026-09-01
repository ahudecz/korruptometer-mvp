-- SocialPostOutbox bővítése a Telegram "✏️ Módosítás" gombhoz (user kérés,
-- 2026-08-31). `pendingEdit` kódolja, hogy a chat következő szöveges
-- üzenetét minek vegyük (l. apps/web/app/api/telegram/webhook/route.ts):
-- 'caption' | 'image_text' | 'both_caption'.
ALTER TABLE "SocialPostOutbox"
  ADD COLUMN IF NOT EXISTS "pendingEdit" text,
  ADD COLUMN IF NOT EXISTS "imageText" text,
  ADD COLUMN IF NOT EXISTS "imageVariant" text NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS "kicker" text;
