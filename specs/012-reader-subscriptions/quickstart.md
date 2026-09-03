# Quickstart — Reader subscriptions

**Feature**: `012-reader-subscriptions`
Local bring-up, then the manual verification script. The automated suite is listed in
plan.md → Verification.

---

## 0. Before anything

**This branch must be brought up to date with `main` first.** `012-reader-subscriptions` is
based on `fe2630b`; `origin/main` is 22 commits ahead and holds `checkHoneypot`, the poll vote
route, the current `pollVoteIpLimiter`, and the `callback_query.message.message_id` field —
all of which this feature reuses. **That merge is the maintainer's call, not an implementation
step.** Until it happens, FR-089, FR-093, FR-095 and half of FR-068 have nothing to reuse.

Read anything you need from `main` without merging:

```bash
git show origin/main:app/apps/web/src/lib/poll-validation.ts
git show origin/main:app/packages/shared/src/ratelimit.ts
git show origin/main:app/apps/web/app/api/telegram/webhook/route.ts
```

---

## 1. Environment

```bash
cd app
pnpm install
```

Add to `app/apps/web/.env.local` (the template is `app/.env.example`):

```bash
# 012 — reader subscriptions
TELEGRAM_PUBLIC_CHANNEL_ID=          # leave EMPTY at first — verify the kill switch
RESEND_API_KEY=                      # leave EMPTY at first — verify the paused state
RESEND_FROM="Kegyencjárat <hirlevel@mail.kegyencjarat.hu>"
RESEND_WEBHOOK_SECRET=whsec_...
SUBSCRIBER_LINK_SECRET=k1:$(openssl rand -base64 32)
SUBSCRIBER_LINK_SECRET_PREVIOUS=
DIGEST_DAILY_SEND_CAP=90
SUBSCRIBE_CONFIRM_DAILY_CAP=50
SUBSCRIBE_CONFIRM_RESERVE=10
DIGEST_MIN_ITEMS=3
SUBSCRIBE_IP_DAILY_LIMIT=20
SUBSCRIBE_IP_HOURLY_LIMIT=3
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# pre-existing, required, and NOT in .env.example today — add them there too
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
CRON_SECRET=dev-secret
PII_ENC_KEY=                         # already required by the tip form
```

`SUBSCRIBER_LINK_SECRET` holds **`kid:secret`**. `k1:` is the kid. `SUBSCRIBER_LINK_SECRET` is
**not** `PII_ENC_KEY`; they are separate secrets with separate rotation schedules (FR-041).

**Start with both `TELEGRAM_PUBLIC_CHANNEL_ID` and `RESEND_API_KEY` empty.** Steps 1 and 2 of
the script below verify that the two kill switches work, and doing that first means no test
message can escape while you are still setting up.

---

## 2. Database

```bash
pnpm dlx supabase start
psql "$DIRECT_URL" -f ../app/supabase/migrations/0053_reader_subscriptions.sql
```

**Applied by hand**, like `0048`–`0052`. `supabase migration up` does not work in this repo.

Confirm the four enums and five tables exist:

```bash
psql "$DIRECT_URL" -c "\dT+ subscription_section"
psql "$DIRECT_URL" -c "\dt \"Subscriber\" \"SubscriberAlert\" \"Digest\" \"EmailSendLedger\" \"SubscriptionHealthAlert\""
```

---

## 3. Run

```bash
pnpm --filter @korr/web run dev            # :3000
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest   # separate terminal
```

Drive the cron routes by hand — Actions does not run locally:

```bash
curl -H "Authorization: Bearer dev-secret" localhost:3000/api/cron/flush-alerts
curl -H "Authorization: Bearer dev-secret" localhost:3000/api/cron/digest
curl -H "Authorization: Bearer dev-secret" localhost:3000/api/cron/subscription-health
```

---

## Manual verification script

Fifteen steps. Log a PASS, FAIL or NOT TESTED verdict **per step**, with the evidence, in the
task record. Never collapse them into "tests passed".

The four marked **★** are the ones that catch a silent failure. If time is short, they are the
ones to run.

| # | Step | Expected | Requirement |
|---|---|---|---|
| 1 | With `TELEGRAM_PUBLIC_CHANNEL_ID` empty, record an alert and run the flush | `{sent: 0}`; every `channelSentAt` still NULL; the row is still claimable | FR-022 |
| 2 | With `RESEND_API_KEY` empty, submit the subscribe form | The 503 paused response and "A feliratkozás átmenetileg szünetel." — **not** a 201 | FR-044 |
| 3 | Set both keys. Subscribe with a test address | `emailEnc` is present and `decryptPii` round-trips it; `consentTextVersion` and `signupIpHash` are populated; **only** the confirmation message is sent | FR-081, FR-083 |
| 4 ★ | **GET the confirmation link twice**, then POST it | Both GETs change nothing (compare the whole row before and after); the POST still confirms | FR-034 |
| 5 | Replay the same POST | Rejected — the token is single-use | FR-036 |
| 6 | Let a token expire, then use "Küldj újat" | A new link is sent and `confirmSentCount` resets to 0 | FR-037 |
| 7 | Submit with the honeypot field filled | 400 with the generic Hungarian failure text, and **zero** database calls in the query log | FR-089, FR-095 |
| 8 | Approve a pending resignation in Telegram, then flush | One channel post, one alert row | FR-018 |
| 9 | Approve a near-miss asset recovery via `a` | It alerts | FR-016, FR-018 |
| 10 ★ | Approve a manual watchlist removal via `a:wc:` | **One** alert, not two. The paired resignation row produces none | FR-017 |
| 11 | Revert via `v`, then delete another via `d` | Both revoke, and the `d` path uses the `personId` you added to `deleteByCode`'s `returning` | FR-019 |
| 12 ★ | **Run two flushes concurrently** — two `curl` calls in the same second | Each row posts exactly once | FR-023 |
| 13 | Revoke an alert between draft and send | It does not appear in any delivered message | FR-061 |
| 14 | Digest: discard, then regenerate, then reply with corrected text containing a site link, then approve | The discard leaves every `lastDigestCursorAt` unchanged; the regeneration rewrites `draftedAt` and `telegramMessageId`; **the corrected text is not ingested as a news tip and is not saved as a Facebook caption**; the approved digest carries the corrected body | FR-065, FR-059, FR-069, FR-068 |
| 15 ★ | **GET the unsubscribe link** — nothing changes. Then POST it. Then use the one-click `List-Unsubscribe` header | The GET mutates nothing; the POST unsubscribes; the one-click POST is idempotent | FR-034, FR-042 |

### Step 14's second trap

The corrected-text reply has **two** existing branches in front of it, not one. Set a
`SocialPostOutbox` row's `pendingEdit` before replying, and confirm your digest text is **not**
swallowed as that row's caption. That branch is at
`app/apps/web/app/api/telegram/webhook/route.ts:653-698` on `origin/main`, it matches on "the
newest row with `pendingEdit` set", and it never looks at `reply_to_message`. See
`contracts/telegram-callbacks.md` § 6b.

### The kill-switch step, run last

Unset `TELEGRAM_PUBLIC_CHANNEL_ID` again with unsent alerts present, then run the health check.
The flush must no-op, the rows must be retained, **and the health check must not ping**
(FR-077). A kill switch that pings daily for as long as it is on is a kill switch nobody leaves
on.

### The one-way step, run before any real send

**Send one digest to a Gmail address and an Outlook address and confirm inbox placement, not
the spam folder** (SC-015). Do this before the list holds anyone who did not consent to being a
test. A delivered message cannot be recalled by any mechanism in this feature, which is why
this is the last thing to verify and the first thing that matters.

**Stop if the provider's send-log retention is not configured yet.** This step is a real send:
it writes a real recipient address into Resend's own logs, which no retention setting applied
afterwards will delete. Precondition P3 requires ≤7-day retention set **at account creation,
before any send**. Confirm it is set, then run this step. See plan.md → PR-2.

---

## Validation chain

```bash
cd app
pnpm --filter @korr/web run lint
pnpm --filter @korr/web run typecheck
pnpm --filter @korr/web run test
pnpm --filter @korr/web run build
```

Then browser verification at 375 px and 1440 px of:

- `/` — the numbered newsletter section after the tip call to action
- `/hirlevel`
- `/hirlevel/megerosites`
- `/hirlevel/leiratkozas`
- `/adatvedelem` — the new stored-data, basis, retention and erasure text

Check the accessibility contract on the form specifically: the section checkboxes in a
`fieldset` with a `legend`, every label bound with `htmlFor`, `aria-live` on the result region,
and the honeypot **absent from the accessibility tree and unreachable by Tab** (FR-011).

---

## Needs a live database — cannot be covered by Vitest

Run these against local Supabase, not in CI:

- The `SubscriberAlert_dedupeKey_uq` index under a real concurrent double-insert.
- Confirmation-token expiry and single-use across two processes.
- The `EmailSendLedger` reserve statement under two concurrent senders — both must see a
  correct post-increment `reservedCount` from their own `RETURNING`.
- `pg_advisory_xact_lock(SUBSCRIPTION_DIGEST_LOCK)` actually serialising two senders.
