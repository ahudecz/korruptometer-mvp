-- 0056_reader_subscriptions.sql — 012-reader-subscriptions
--
-- SORSZÁM: a terv 0053-at írt, de az azóta bemergelt main már elvitte a
-- 0053/0054/0055 számot (social-post-outbox, edit-fields, nvvh-case-poll).
-- A következő szabad szám ezért 0056.
--
-- A "subscription_section" ENUM ára (spec A8): egy HETEDIK szekció
-- felvétele MINDIG KÉT migrációba kerül, örökre — az ALTER TYPE ... ADD
-- VALUE nem futhat ugyanabban a tranzakcióban, amelyik már használja az
-- új értéket. Ezt tudatosan vállaltuk: cserébe az adatbázis utasítja
-- vissza azt a szekciónevet, amit a @korr/shared/sections lista nem ismer.
--
-- A megőrzési söprés (gdpr-retention-sweep, 'subscriber-pii-purge' lépés)
-- SZÁNDÉKOSAN megtartja a Subscriber.emailHash, .status és
-- .consentTextVersion oszlopokat: ez a letiltás-jelölő és a GDPR 7. cikk
-- (1) szerinti hozzájárulás-bizonyíték. Csak az emailEnc, a signupIpHash,
-- a confirmedIpHash és a confirmTokenHash nullázódik.
--
-- A SubscriptionHealthAlert KÉT időbélyeget visel, nem egyet: a szívverés
-- (lastRunAt) minden futásnál íródik, a napi egyszeri riasztás-jelölő
-- (alertedAt) viszont csak akkor, amikor tényleg ment üzenet — egy mezőben
-- a kettő kioltaná egymást, mert a feltétel nélküli szívverés elfoglalná a
-- nap sorát, és az ON CONFLICT (day) DO NOTHING riasztás aznap soha többé
-- nem tüzelne.
--
-- Kézzel alkalmazandó (psql "$DIRECT_URL" -f ...), mint a 0048–0055.
-- Nincs -- ROLLBACK blokk: a repó 58 migrációja közül egyben sincs, és az
-- app/docs/migrations.md:65 az előre-gördülést vagy visszaállítást írja elő.
-- Tisztán additív: öt tábla, négy enum, nincs drop, nincs átnevezés, nincs
-- NOT NULL egy utólag feltöltött oszlopon (alkotmány VII. alapelv).

DO $$ BEGIN
  CREATE TYPE "subscription_section" AS ENUM (
    'resignation',
    'media_closure',
    'court_verdict',
    'criminal_complaint',
    'asset_recovery',
    'watchlist_removal'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "subscriber_status" AS ENUM (
    'pending',
    'active',
    'unsubscribed',
    'bounced',
    'complained'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "digest_cadence" AS ENUM ('daily', 'weekly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nincs 'draft' tag: egy összefoglaló a létrejötte pillanatától
-- 'awaiting_approval'.
DO $$ BEGIN
  CREATE TYPE "digest_status" AS ENUM (
    'awaiting_approval',
    'approved',
    'sending',
    'sent',
    'discarded',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Subscriber" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "emailHash"             text NOT NULL,
  "emailEnc"              text,
  "sections"              subscription_section[] NOT NULL,
  "cadence"               digest_cadence NOT NULL DEFAULT 'weekly',
  "status"                subscriber_status NOT NULL DEFAULT 'pending',
  "confirmTokenHash"      text,
  "confirmTokenExpiresAt" timestamptz,
  "confirmSentCount"      integer NOT NULL DEFAULT 0,
  "confirmLastSentAt"     timestamptz,
  "confirmedAt"           timestamptz,
  "confirmedIpHash"       text,
  "consentTextVersion"    text,
  "lastDigestSentAt"      timestamptz,
  "lastDigestCursorAt"    timestamptz,
  "signupIpHash"          text,
  "bounceCount"           integer NOT NULL DEFAULT 0,
  "lastBounceAt"          timestamptz,
  "unsubscribedAt"        timestamptz,
  "purgePiiAt"            timestamptz,
  "createdAt"             timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscriber_emailHash_uq"
  ON "Subscriber" ("emailHash");
CREATE INDEX IF NOT EXISTS "Subscriber_status_cadence_idx"
  ON "Subscriber" ("status", "cadence");
CREATE INDEX IF NOT EXISTS "Subscriber_purgePiiAt_idx"
  ON "Subscriber" ("purgePiiAt") WHERE "purgePiiAt" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "SubscriberAlert" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "section"       subscription_section NOT NULL,
  "entityId"      text NOT NULL,
  "dedupeKey"     text NOT NULL,
  "title"         text NOT NULL,
  "detail"        text,
  "url"           text NOT NULL,
  "occurredAt"    timestamptz NOT NULL,
  "channelSentAt" timestamptz,
  "revokedAt"     timestamptz,
  "createdAt"     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriberAlert_dedupeKey_uq"
  ON "SubscriberAlert" ("dedupeKey");
-- Ez a részleges index hajtja a foglaló utasítást ÉS a beragadás-ellenőrzést.
CREATE INDEX IF NOT EXISTS "SubscriberAlert_unsent_idx"
  ON "SubscriberAlert" ("occurredAt")
  WHERE "channelSentAt" IS NULL AND "revokedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "SubscriberAlert_occurredAt_idx"
  ON "SubscriberAlert" ("occurredAt");

CREATE TABLE IF NOT EXISTS "Digest" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"              text NOT NULL,
  "cadence"           digest_cadence NOT NULL,
  "status"            digest_status NOT NULL DEFAULT 'awaiting_approval',
  "periodStart"       timestamptz NOT NULL,
  "periodEnd"         timestamptz NOT NULL,
  "alertIds"          uuid[] NOT NULL,
  "draftedAt"         timestamptz NOT NULL,
  "subjectHu"         text NOT NULL,
  "bodyHtml"          text NOT NULL,
  "bodyText"          text NOT NULL,
  "telegramMessageId" bigint,
  "regenCount"        integer NOT NULL DEFAULT 0,
  "approvedAt"        timestamptz,
  "sentAt"            timestamptz,
  "sentCount"         integer NOT NULL DEFAULT 0,
  "createdAt"         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "Digest_code_uq" ON "Digest" ("code");
CREATE INDEX IF NOT EXISTS "Digest_status_draftedAt_idx"
  ON "Digest" ("status", "draftedAt");
CREATE INDEX IF NOT EXISTS "Digest_telegramMessageId_idx"
  ON "Digest" ("telegramMessageId") WHERE "telegramMessageId" IS NOT NULL;

-- SZÁMLÁLÓ, nem jelölő. A "day" mindig az adatbázis current_date-je: az
-- Actions ütemezés UTC, a szerkesztői ritmus budapesti, a szolgáltatói kvóta
-- UTC — egy órának nyernie kell.
CREATE TABLE IF NOT EXISTS "EmailSendLedger" (
  "day"           date PRIMARY KEY,
  "reservedCount" integer NOT NULL DEFAULT 0,
  "sentCount"     integer NOT NULL DEFAULT 0,
  "updatedAt"     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "SubscriptionHealthAlert" (
  "day"        date PRIMARY KEY,
  "lastReason" text,
  "alertedAt"  timestamptz,
  "lastRunAt"  timestamptz NOT NULL DEFAULT now()
);
