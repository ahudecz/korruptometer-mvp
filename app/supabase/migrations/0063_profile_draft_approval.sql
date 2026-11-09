-- 0063 — Dicsőségfal-tervezetek jóváhagyása (user kérés, 2026-11-09)
--
-- A napi felhős futás egy `live: false` profiltervezetet tesz a main-re, és
-- Telegramon elküldi a titkos előnézeti linket egy „Élesít" gombbal. A gomb
-- ide írja a jóváhagyást; a következő napi futás innen olvassa ki, átírja a
-- configban `live: true`-ra, majd `publishedAt`-et állít.
--
-- Élesben nincs Redis, ezért kell tábla. Tisztán additív, nem érint meglévő
-- oszlopot (Constitution VII). RLS bekapcsolva, policy nélkül: csak a
-- szerveroldali, közvetlen Postgres-kapcsolat éri el, a PostgREST nem.

CREATE TABLE IF NOT EXISTS "ProfileDraftApproval" (
  "slug" text PRIMARY KEY,
  "approvedAt" timestamptz NOT NULL DEFAULT now(),
  "publishedAt" timestamptz
);

ALTER TABLE "ProfileDraftApproval" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "ProfileDraftApproval" IS
  'Dicsőségfal-profiltervezetek Telegram-jóváhagyása. publishedAt NULL = jóváhagyva, de még nem élesítve.';
