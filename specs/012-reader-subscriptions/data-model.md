# Data model — Reader subscriptions

**Feature**: `012-reader-subscriptions` | **Date**: 2026-09-01
**Migration**: `app/supabase/migrations/0053_reader_subscriptions.sql`
**Drizzle**: appended at the bottom of `app/packages/db/src/schema.ts` (the file is 1757 lines)

`0053` is the next free number. `app/supabase/migrations/` holds `0048`–`0052`;
`0047_criminal_complaint_related_cases.sql` is the stray at the repository-root
`supabase/migrations/` that the spec puts out of scope.

**Applied by hand**, like `0048`–`0052`. `supabase migration up` does not work in this repo.
**No `-- ROLLBACK` block** — none of the 58 existing migrations has one, and
`app/docs/migrations.md:65` documents the roll-forward-or-restore policy instead. See
plan.md → Rollback.

The migration is purely additive: five tables, four enums, no drop, no rename, no `NOT NULL`
on a backfilled column. It therefore satisfies constitution Principle VII on its own.

---

## Migration header — the two sentences a future reader needs

```sql
-- 0053_reader_subscriptions.sql — 012-reader-subscriptions
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
```

---

## Enums

Four new pg enums. Member order is the storage order and is not alphabetised.

| Type | Members |
|---|---|
| `subscription_section` | `resignation`, `media_closure`, `court_verdict`, `criminal_complaint`, `asset_recovery`, `watchlist_removal` |
| `subscriber_status` | `pending`, `active`, `unsubscribed`, `bounced`, `complained` |
| `digest_cadence` | `daily`, `weekly` |
| `digest_status` | `awaiting_approval`, `approved`, `sending`, `sent`, `discarded`, `expired` |

`digest_status` has **no `draft` member**. A digest is `awaiting_approval` from the moment it
exists; `draft` would never be entered.

The `subscription_section` members are generated from `SUBSCRIPTION_SECTIONS` in
`app/packages/shared/src/sections.ts`, which `@korr/db` imports. The enum and the form controls
therefore cannot drift (FR-007).

---

## `Subscriber`

One reader's email subscription.

| Column | Type | Written by | Read by |
|---|---|---|---|
| `id` | `uuid` PK `defaultRandom()` | insert | the signed unsubscribe payload |
| `emailHash` | `text NOT NULL` **UNIQUE** | subscribe POST, via `hashSubscriberEmail` | lookup, erasure, the tombstone, the provider webhook |
| **`emailEnc`** | `text` | **subscribe POST — `encryptPii(email)` from `@korr/shared/encryption:24`** | **the confirmation sender and digest-send — `decryptPii()` (`:32`) to address the message.** Never logged. Never in an `AuditLog.detail`. |
| `sections` | `subscription_section[] NOT NULL` | subscribe POST | the send-time filter |
| `cadence` | `digest_cadence NOT NULL DEFAULT 'weekly'` | subscribe POST | the recipient select |
| `status` | `subscriber_status NOT NULL DEFAULT 'pending'` | subscribe / confirm / unsubscribe / provider webhook | the recipient select |
| `confirmTokenHash` | `text` | the confirmation sender; **nulled on confirm** | the confirm POST |
| `confirmTokenExpiresAt` | `timestamptz` | the confirmation sender | the confirm POST |
| `confirmSentCount` | `integer NOT NULL DEFAULT 0` | **the confirmation sender, in the same transaction as the ledger reservation** | the cap of `CONFIRM_MAX_SENDS` |
| `confirmLastSentAt` | `timestamptz` | same transaction | the `CONFIRM_COOLDOWN_MINUTES` cooldown |
| `confirmedAt` | `timestamptz` | the confirm POST | Article 7(1) proof; the FR-060 too-new exclusion |
| `confirmedIpHash` | `text` | the confirm POST | Article 7(1) proof |
| `consentTextVersion` | `text` | subscribe POST, from `CONSENT_TEXT_VERSION` | Article 7(1) proof. **Survives the purge.** |
| `lastDigestSentAt` | `timestamptz` | **digest-send, per successful recipient** | the `ORDER BY … NULLS FIRST` at send (FR-063) |
| `lastDigestCursorAt` | `timestamptz` | **digest-send, set to `Digest.periodEnd`** | the per-recipient item filter (FR-062) |
| `signupIpHash` | `text` | subscribe POST | the FR-079 burst signal. **Pseudonymised personal data (Art. 4(5)), not anonymous.** |
| `bounceCount` | `integer NOT NULL DEFAULT 0` | the provider webhook | soft-bounce suppression at 3 |
| `lastBounceAt` | `timestamptz` | the provider webhook | — |
| `unsubscribedAt` | `timestamptz` | the unsubscribe POST | — |
| `purgePiiAt` | `timestamptz` | unsubscribe (`now() + PURGE_DAYS`), erase route (`now()`) | the retention sweep |
| `createdAt` | `timestamptz NOT NULL DEFAULT now()` | insert | — |

**`emailEnc` is the column the whole feature exists to mail.** It is AES-256-GCM under the
existing `PII_ENC_KEY` — the same helper the tip form uses — and is decrypted only at send
time. `PII_ENC_KEY` is **not** the link-signing key; those are separate secrets with separate
rotation schedules (FR-041).

**One canonicalisation** (FR-082): `hashSubscriberEmail(raw) = sha256(raw.trim().toLowerCase())`,
called by the subscribe route, the erase route **and** the provider webhook. The pre-existing
`app/apps/web/app/api/admin/dsr/route.ts` does **not** normalise, so its hash space stays separate.
The spec puts repairing that out of scope.

**Dropped from the source design**: `emailDomain` — disposable-domain rejection happens on the
input, not on a stored column, so it had no reader.

### After the retention purge

Nulled: `emailEnc`, `signupIpHash`, `confirmedIpHash`, `confirmTokenHash`.
**Kept**: `emailHash` (the suppression tombstone), `status`, `consentTextVersion` (FR-086).

### Indexes

| Index | Shape |
|---|---|
| `Subscriber_emailHash_uq` | `UNIQUE (emailHash)` |
| `Subscriber_status_cadence_idx` | `(status, cadence)` — the recipient select |
| `Subscriber_purgePiiAt_idx` | `(purgePiiAt) WHERE "purgePiiAt" IS NOT NULL` — partial, for the sweep |

**No GIN index on `sections`.** Section filtering is application-side, on a recipient set that
is already bounded by `status` and `cadence`.

---

## `SubscriberAlert`

One published item worth telling readers about. This is the outbox.

| Column | Type | Written by | Read by |
|---|---|---|---|
| `id` | `uuid` PK `defaultRandom()` | `recordSubscriberAlert` | the flush claim, `Digest.alertIds` |
| `section` | `subscription_section NOT NULL` | `recordSubscriberAlert` | the per-recipient filter; the message text |
| `entityId` | `text NOT NULL` | `recordSubscriberAlert` | the dedupe key; nothing else |
| `dedupeKey` | `text NOT NULL` **UNIQUE** | `recordSubscriberAlert` | `onConflictDoNothing`, `revokeSubscriberAlert` |
| `title` | `text NOT NULL` | `recordSubscriberAlert` | the channel message; the digest body |
| `detail` | `text` | `recordSubscriberAlert` | same |
| `url` | `text NOT NULL` | `recordSubscriberAlert` | same |
| `occurredAt` | `timestamptz NOT NULL` | `recordSubscriberAlert` | the flush order; the digest window; the per-recipient cursor |
| `channelSentAt` | `timestamptz` | **the flush claim statement, never a later UPDATE** | the claim predicate; the FR-076 staleness check |
| `revokedAt` | `timestamptz` | `revokeSubscriberAlert`, from both delete paths | the claim predicate; the send-time re-filter |
| `createdAt` | `timestamptz NOT NULL DEFAULT now()` | insert | — |

**Dropped from the source design**: `entityType` and `sourceUrl`. Neither had a reader —
`section` carries the type, and the message is built from `title`, `detail` and `url`.

### The dedupe key (FR-015)

`${section}:${entityId}` — **except `watchlist_removal`, which keys on the person id**.
`applyWatchlistRemoval` (`app/apps/web/src/lib/telegram-review-actions.ts:690`) uses
`onConflictDoUpdate({ target: personId })`, so a re-tap or a revert-then-redetect would
otherwise alert twice for one person. The paired resignation row produces no second alert
(FR-017).

### Indexes

| Index | Shape |
|---|---|
| `SubscriberAlert_dedupeKey_uq` | `UNIQUE (dedupeKey)` |
| `SubscriberAlert_unsent_idx` | `("occurredAt") WHERE "channelSentAt" IS NULL AND "revokedAt" IS NULL` — partial, drives both the claim and the staleness check |
| `SubscriberAlert_occurredAt_idx` | `("occurredAt")` — the digest window |

### The claim — one statement, no second UPDATE

```sql
UPDATE "SubscriberAlert"
   SET "channelSentAt" = now()
 WHERE id IN (
   SELECT id FROM "SubscriberAlert"
    WHERE "channelSentAt" IS NULL AND "revokedAt" IS NULL
    ORDER BY "occurredAt" ASC
    LIMIT $1                         -- FLUSH_BATCH_SIZE
    FOR UPDATE SKIP LOCKED
 )
RETURNING id, section, title, detail, url, "occurredAt";
```

Claim first, post the returned rows afterwards. A crash between the two **loses** an alert
rather than duplicating a public post (FR-024). With `TELEGRAM_PUBLIC_CHANNEL_ID` unset the
flush returns `{ sent: 0 }` **before this statement runs**, so nothing is marked (FR-022).

---

## `Digest`

One drafted mailing awaiting an editor.

| Column | Type | Written by | Read by |
|---|---|---|---|
| `id` | `uuid` PK `defaultRandom()` | `digest-draft` | — |
| `code` | `text NOT NULL` **UNIQUE**, `DIGEST_CODE_CHARS` = 8 | `digest-draft` — `randomBytes(6).toString('base64url')` | the `dg:a:{code}` / `dg:x:` / `dg:r:` callbacks |
| `cadence` | `digest_cadence NOT NULL` | `digest-draft` | the recipient select |
| `status` | `digest_status NOT NULL DEFAULT 'awaiting_approval'` | draft / the `dg:*` callbacks / `digest-send` | every consumer |
| `periodStart` | `timestamptz NOT NULL` | `digest-draft` | the item window |
| `periodEnd` | `timestamptz NOT NULL` | `digest-draft` | the item window; **written to each recipient's `lastDigestCursorAt`** |
| `alertIds` | `uuid[] NOT NULL` | `digest-draft` | the frozen item list, re-filtered at send |
| `draftedAt` | `timestamptz NOT NULL` | draft, and **rewritten on `dg:r`** | the FR-060 too-new exclusion |
| `subjectHu` | `text NOT NULL` | draft; overwritten by `dg:r` and by a corrected-text reply | the send |
| `bodyHtml` | `text NOT NULL` | same | the send |
| `bodyText` | `text NOT NULL` | same | the send |
| `telegramMessageId` | `bigint` | draft, from `sendTelegramMessage`'s return (`telegram.ts:34-35`); **overwritten by `dg:r`** | the reply seam's match |
| `regenCount` | `integer NOT NULL DEFAULT 0` | `dg:r` **and** a corrected-text reply | the `DIGEST_MAX_REGEN` cap |
| `approvedAt` | `timestamptz` | `dg:a` | the clock the `DIGEST_RESUME_DAYS` cap counts from |
| `sentAt` | `timestamptz` | `digest-send` on completion | the FR-076 cadence-staleness check |
| `sentCount` | `integer NOT NULL DEFAULT 0` | `digest-send`, per successful recipient | the ledger reconcile |
| `createdAt` | `timestamptz NOT NULL DEFAULT now()` | insert | — |

**Dropped from the source design**: `recipientCount` — no reader.

Three of these are load-bearing in a way the column name does not show:

- **`draftedAt` is rewritten on `dg:r`** (FR-059) because it decides which subscribers are
  excluded as too new. Leaving it stale would silently change the audience between two approval
  messages for the same period.
- **`telegramMessageId` is overwritten on `dg:r`** (FR-068), or a reply to the superseded
  message still matches and edits a body nobody is looking at.
- **`expired` is written only by `digest-send`**, which scans for `awaiting_approval` older
  than `DIGEST_APPROVAL_EXPIRY_HOURS` **before it does anything else** (FR-066). Nothing else
  expires a digest, and expiry **never** applies to a digest already `sending`.

### Indexes

| Index | Shape |
|---|---|
| `Digest_code_uq` | `UNIQUE (code)` |
| `Digest_status_draftedAt_idx` | `(status, "draftedAt")` — the approval-staleness check |
| `Digest_telegramMessageId_idx` | `("telegramMessageId") WHERE "telegramMessageId" IS NOT NULL` — the reply seam's lookup |

---

## `EmailSendLedger`

One row per calendar day. **A counter, not a marker.**

| Column | Type | Written by | Read by |
|---|---|---|---|
| `day` | `date` **PRIMARY KEY** | the reserve statement | everything |
| `reservedCount` | `integer NOT NULL DEFAULT 0` | reserve (+), release (−) | **`remaining`** — the only input to capacity |
| `sentCount` | `integer NOT NULL DEFAULT 0` | after a successful batch, by the delivered count | the daily reconcile only |
| `updatedAt` | `timestamptz NOT NULL DEFAULT now()` | both statements | — |

It borrows only the `day date PRIMARY KEY` idiom from `LlmApiFailureAlert` (`0052`). That table
is a `DO NOTHING` marker; a counter is the opposite shape, which is why the two do not share a
helper.

**`day` is always the database's `current_date`** (FR-050). The Actions schedule is UTC, the
editorial rhythm is Budapest, and the provider quota resets UTC; one clock has to win.

### Reserve

```sql
INSERT INTO "EmailSendLedger" (day, "reservedCount")
VALUES (current_date, $1)
ON CONFLICT (day) DO UPDATE
   SET "reservedCount" = "EmailSendLedger"."reservedCount" + EXCLUDED."reservedCount",
       "updatedAt"     = now()
RETURNING "reservedCount";
```

The `RETURNING` is what makes the reservation atomic under concurrency: the caller learns its
post-increment total and gives back anything above the cap in the same request.

### Release — over cap, or a refused or failed batch

```sql
UPDATE "EmailSendLedger"
   SET "reservedCount" = "reservedCount" - $1,
       "updatedAt"     = now()
 WHERE day = current_date;
```

Without the release, one failed batch permanently reduces the day's capacity. This is the
decrement that stops a leak from being permanent.

### After a successful batch

```sql
UPDATE "EmailSendLedger"
   SET "sentCount"  = "sentCount" + $1,
       "updatedAt"  = now()
 WHERE day = current_date;
```

### Capacity (FR-051)

```
remaining = min(
  DIGEST_DAILY_SEND_CAP,                               -- 90
  RESEND_DAILY_LIMIT                                   -- 100
    − reservedCount[current_date]
    − SUBSCRIBE_CONFIRM_RESERVE                        -- 10
)
```

Read from the named constants, never a literal. **`remaining` reads `reservedCount`, never
`sentCount`** (FR-048) — only reservations bound concurrent senders. `sentCount` exists solely
so the Phase 8 reconcile can notice a gap over 10 and ping, which is the only way a reservation
leak is ever detected.

### Concurrency

`pg_advisory_xact_lock(SUBSCRIPTION_DIGEST_LOCK)` wraps the draft → send transition, so only
one sender runs for a given digest (FR-049). Following constitution Principle V, the magic
number lives in exactly one file: add `SUBSCRIPTION_DIGEST_LOCK` beside `KPI_ROLLUP_LOCK` in
`app/packages/db/src/locks.ts`.

---

## `SubscriptionHealthAlert`

One row per calendar day. A marker, not a counter.

| Column | Type | Written by | Read by |
|---|---|---|---|
| `day` | `date` **PRIMARY KEY** | the health route | itself, via `ON CONFLICT DO NOTHING RETURNING day` |
| `lastReason` | `text NOT NULL` | the health route | the Telegram message body |
| `lastRunAt` | `timestamptz NOT NULL DEFAULT now()` | **every run of the health route, whether or not it alerts** | the `HEALTH_HEARTBEAT_HOURS` stale-heartbeat condition |

**It cannot reuse `LlmApiFailureAlert`** (FR-075): one row per day there would let an LLM alert
suppress a subscription alert for the rest of that day, and the six-week silence that produced
`LlmApiFailureAlert` in the first place is exactly the failure this table exists to prevent.

`lastRunAt` is the heartbeat (FR-078). It is written unconditionally, on every run, including
runs that find nothing wrong — otherwise a healthy stretch would look identical to a stopped
watchdog. It is deliberately the same table rather than a second one, so the heartbeat cannot
be lost while the marker survives.

```sql
INSERT INTO "SubscriptionHealthAlert" (day, "lastReason")
VALUES (current_date, $1)
ON CONFLICT (day) DO NOTHING
RETURNING day;
```

Send the Telegram message **only when that returns a row**. Copy
`app/packages/db/src/llm-api-failure-alert.ts:42-47` exactly; put the helper in
`app/packages/db/src/subscription-health-alert.ts`.

---

## State transitions

### `Subscriber.status`

```
                subscribe POST
                      │
                      ▼
                  pending ───── confirm POST ─────▶ active
                      │                              │
                      │ (never receives anything     ├── unsubscribe POST ──▶ unsubscribed
                      │  but its own confirmation    │                        (purgePiiAt = now + PURGE_DAYS)
                      │  message — FR-094)           │
                      │                              ├── hard bounce ───────▶ bounced
                      │                              │   soft bounce ×3
                      │                              │
                      └──────────────────────────────┴── spam complaint ────▶ complained  (terminal)
```

`complained` is terminal and is never reversed (FR-055). `unsubscribed` is re-enterable — a
reader may subscribe again — but the tombstone `emailHash` survives the purge, so an **erased**
address is refused for good (FR-045, User Story 6 scenario 5).

### `Digest.status`

```
awaiting_approval ──── dg:a ────▶ approved ──── digest-send ────▶ sending ──▶ sent
        │                                                            │
        ├──── dg:x ─────────────▶ discarded   (cursor NOT advanced)   │
        │                                                            │
        ├──── dg:r ─────────────▶ awaiting_approval                   │
        │       (regenCount +1, draftedAt and telegramMessageId       │
        │        rewritten; capped at DIGEST_MAX_REGEN)               │
        │                                                            │
        └──── > DIGEST_APPROVAL_EXPIRY_HOURS ──▶ expired              │
                (written by digest-send, before anything else)        │
                                                                      │
        after DIGEST_RESUME_DAYS from approvedAt, an unfinished ───────┘
        `sending` digest drops its remainder and pings the maintainer
```

**`expired` never applies to `sending`** (FR-066). **A discard does not advance any reader's
`lastDigestCursorAt`**, so the period is not lost and the next digest covers it (FR-065).

---

## Validation rules that live in the schema rather than in code

| Rule | Enforced by |
|---|---|
| No section name outside the six | the `subscription_section` enum |
| One subscriber per canonicalised address | `Subscriber_emailHash_uq` |
| One alert per published item | `SubscriberAlert_dedupeKey_uq` |
| One digest per short code | `Digest_code_uq` |
| One ledger row per day | `EmailSendLedger.day` PK |
| At most one health message a day | `SubscriptionHealthAlert.day` PK + `ON CONFLICT DO NOTHING` |

Everything else — the cooldown, the caps, the expiry, the byte-length limit on
`callback_data` — is application logic with a unit test, because Postgres cannot express it and
a `CHECK` constraint that half-expresses it would be worse than none.
