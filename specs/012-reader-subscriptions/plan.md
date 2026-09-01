# Implementation Plan: Reader subscriptions — public Telegram channel and email digest

**Branch**: `012-reader-subscriptions` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-reader-subscriptions/spec.md`

## Summary

Readers get two new ways to learn that the site published something. One public Telegram
channel carries all six sections with no personal data. An email digest carries per-section
choice, a double opt-in, a consent record and an editor approval before every send.

The mechanism has four load-bearing parts. An **outbox** table (`SubscriberAlert`) is written
on the caller's path at six existing publication points and never performs network I/O there.
A **claim-then-post flush**, on its own GitHub Actions schedule, marks each row sent inside the
`UPDATE … RETURNING` that selects it, so two overlapping runs cannot both post. An **encrypted
address column** (`Subscriber.emailEnc`, AES-256-GCM under the existing `PII_ENC_KEY`) is
decrypted only when a message is addressed. A **daily reservation ledger** bounds every send
against the provider's free-tier quota using the database's own `current_date`.

Everything in this feature fails silently when it fails. Nothing here throws. A separate
health route with its own daily marker and its own heartbeat is therefore part of the feature,
not an operational extra.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node 20 (repo pin)
**Primary Dependencies**: Next.js 15 App Router, Drizzle ORM 0.36, Inngest 3.x,
`@upstash/ratelimit`, `@anthropic-ai/sdk` (existing, for the digest summary only).
**No new npm dependency.** The email provider is called over native `fetch`; the provider
webhook signature is verified with `node:crypto`, not the `svix` package.
**Storage**: Supabase Postgres. Five new tables, four new pg enums, one hand-applied raw-SQL
migration `0053_reader_subscriptions.sql`.
**Testing**: Vitest 2 for units and route handlers; Playwright for the two reader pages.
Inngest functions are never executed in tests; their `…Core` bodies are called directly.
**Target Platform**: Vercel (web + cron routes), GitHub Actions (schedules), Supabase.
**Project Type**: Web application inside the existing `app/` pnpm + Turborepo workspace.
**Performance Goals**: Flush posts ≤ `FLUSH_BATCH_SIZE` (20) messages per run at
`TELEGRAM_CHANNEL_RATE` (20/min). Digest sends ≤ 90 messages a day. No request-path work is
added to any existing page.
**Constraints**: Free email tier — `RESEND_DAILY_LIMIT` 100/day, `RESEND_MONTHLY_LIMIT`
3000/month. Real audience ceiling ≈ 270 recipients per weekly digest across
`DIGEST_RESUME_DAYS` (3). Telegram `callback_data` ≤ 64 bytes.
**Scale/Scope**: Low hundreds of subscribers. Six sections. Six alert-recording call sites.
Three reader pages, five API routes, three cron routes, two Inngest functions, one GitHub
Actions workflow.

**No NEEDS CLARIFICATION remains.** Every value the spec left as a name is settled in
`research.md` and in the Named Constants table below.

---

## Prerequisites

### PR-1 — This branch must be brought up to date with `main` before implementation starts

`012-reader-subscriptions` is based on `fe2630b`. `origin/main` is **22 commits ahead**. The
code the spec mandates for reuse is on `main` only:

| What the spec mandates | Where it actually lives | On this branch? |
|---|---|---|
| `checkHoneypot` (FR-089) | `app/apps/web/src/lib/poll-validation.ts:11-16` | **No** — file created on `main` |
| The poll's post-Turnstile control stack (A11) | `app/apps/web/app/api/poll/vote/route.ts` | **No** — file created on `main` |
| `pollVoteIpLimiter` as the shape to copy (FR-093) | `app/packages/shared/src/ratelimit.ts:79-86` | **No** |
| `TelegramUpdate.callback_query.message.message_id` | `app/apps/web/app/api/telegram/webhook/route.ts:215` | **No** |

`app/apps/web/app/api/telegram/webhook/route.ts` is **1086 lines on this branch and 1287 on
`origin/main`**. Every `file:line` anchor in this plan is stated against **`origin/main`**,
because that is what the working tree will contain once the branch is updated. Reading the
files with `git show origin/main:<path>` was enough for planning; it is not enough for
implementation.

**Bringing the branch up to date is the maintainer's call, not an implementation task.** No
agent merges or rebases this branch. Until it happens, FR-089, FR-093, FR-095 and the
`message_id` half of FR-068 cannot be implemented as written.

### PR-2 — Preconditions owned by the maintainer

Reproduced from the spec so this plan stands alone. **These are not tasks. No agent performs
them, and `/speckit.tasks` must not emit them as work items.**

| # | Action | Owner | Blocks |
|---|---|---|---|
| P2 | Create the public Telegram channel, add the bot as an administrator, record the channel id | maintainer (manual) | Phase 4, Phase 5 |
| P3 | Create the Resend account and the sending domain — **and set the provider's send-log retention to 7 days or less at account creation, before any send whatsoever** | maintainer (manual) | Phase 7 |
| P4 | Publish DKIM and the subdomain SPF record; publish DMARC at `p=none` | maintainer (manual) | Phase 7 |

P1 and P5 of the source plan are withdrawn with Turnstile. They are not reused.

DNS has lead time. P2, P3 and P4 start in parallel with Phase 1.

#### P3's retention sub-condition — why it is a precondition and not an ops detail

**Resend's own send logs carry recipient addresses.** They are personal data sitting outside
this system's control, and they are invisible: a log nobody can see does not look like a leak.

**Retention cannot be retrofitted.** Create the account, send the first mail, then add a
retention setting afterwards, and the addresses from those first sends are already written into
the provider's logs under whatever default applies. No later setting deletes them. The plan
already names the first real send as this feature's one genuinely one-way step; this is a second
irreversible consequence hanging off the same moment. So the control has to sit **before the
first send**.

**"Any send" includes the inbox-placement test.** The Gmail and Outlook placement check in the
Phase 7 rollout is a real send that writes a real address into the provider's logs, and it
happens before the first digest. It is inside the window this precondition must cover. Set the
retention first, then test placement.

**If the free tier does not permit configuring log retention at all, this is a constitutional
problem, not an ops detail.** Principle IV minimises personal data everywhere else in this
system, and the v2.0.0 Email entry makes the address-handling constraints binding. In that case
the question goes back to the maintainer as a choice between a paid tier and a different
provider. **It must be discovered at account creation**, because after the first send the choice
is already made.

A precondition is a one-time act with no ongoing enforcement, so it is only half the control.
The other half is a row in `app/docs/log-retention.md`, which the deploy-time audit consumes —
see Phase 7.

### PR-3 — Sign-offs under CLAUDE.md "Ask Before You…"

Spec assumption A3 records these as granted: the new email provider and its DNS records; the
five new tables; `sections` as a pg-enum array rather than the `text[]` house precedent; the
new rate limiters; and the new scheduled workflow at the repository root.

**One sign-off A3 did not cover, and could not**: the constitution named Resend as a forbidden
stack substitution. **Settled on 2026-09-01** by constitution amendment **v2.0.0**, which
removed Resend from the forbidden list and admitted it as a locked-in service with named
constraints. See Constitution Check.

---

## Constitution Check

*Checked against `.specify/memory/constitution.md` v1.0.0 before Phase 0 and again after the
design below was written. Result was unchanged between the two passes. **Re-stated against
v2.0.0 (amended 2026-09-01)**, which resolved the one violation. This feature now has **no
open Constitution Check violation**.*

| Principle | Verdict | Note |
|---|---|---|
| I — Trust posture above convenience | PASS | The reader-facing copy states the IP hash is stored (FR-084, FR-088). The tip form's "Az IP-címedet nem rögzítjük" promise at `app/apps/web/app/page.tsx` is inside the `submission-assurance` block and is scoped to the tip form; this feature adds no claim that contradicts it, and does not edit it. |
| II — Phased shippability | PASS | Phases 4–5 ship the whole channel promise with no personal data, no provider and no consent record. Phases 6–7 add email. Neither entangles the other. |
| III — Single Next.js app on the inbox-to-action stack | **PASS — resolved by amendment** | Constitution v1.0.0 named **Resend** in its forbidden-substitutions list. **Amendment v2.0.0, 2026-09-01** removed it from that list and added **Email: Resend** to the locked-in services, with the constraints this feature already designed to: sending only, never a queue or a data store; subdomain sending domain; RFC 8058 one-click unsubscribe headers on every bulk send; addresses encrypted at rest and decrypted only at send time; free-tier caps enforced in the application by the reservation ledger. See Complexity Tracking. |
| III — no separate worker package | PASS | Both Inngest functions live in `app/apps/web/src/inngest/functions/`; the schedules are Actions-driven cron routes in the same app. |
| IV — Data minimization and GDPR retention | PASS | No plaintext address at rest (FR-081). No name field (FR-080). Retention pass keeps only the tombstone and the consent record (FR-086). The IP hash is treated as personal data (FR-084). |
| V — Web request path never recomputes | PASS | The subscribe route enqueues; it does not send. No page recomputes anything. |
| VI — Edge-first reads, rate-limited writes | PASS with a note | Per-route, per-verb limits are specified (FR-046). Principle VI names Turnstile on `POST /api/submissions`; **that endpoint is out of scope** and is not changed by this feature. Removing Turnstile from *this* feature's own surfaces (A11) does not touch it. |
| VII — Two-step destructive migrations | PASS | `0053` is purely additive: five new tables, four new enums, no drop, no rename, no `NOT NULL` on a backfilled column. Removing the tables later is the second PR. |
| Locale — Hungarian only, no i18n machinery | PASS | Every reader string is Hungarian (FR-010) and hard-coded, with no message catalogue. |
| Accessibility | PASS | Fieldset + legend, `htmlFor`, `aria-live` (FR-011). The honeypot is hidden from assistive technology as well as from sight — see Phase 6. |
| Security headers / CSP | PASS | Every new surface is same-origin. No new script host, no new frame host, no new connect host. `next.config.js` is not edited. |
| CI gates | PASS | Nothing in this feature changes `app/.github/workflows/ci.yml` or `turbo.json`. |

### Post-design re-check

Re-run after the data model, the contracts and the phase breakdown below were written. The
only violation was the Resend one, now resolved by constitution amendment v2.0.0
(2026-09-01), and the design did not introduce a second. Notably
the design **avoided** three constitution-adjacent temptations: Redis is used for rate
limiting only and never as a queue (Principle III); the digest never triggers a synchronous
recompute on a request path (Principle V); and no `NewsArticle.body`-shaped column is added.

---

## Complexity Tracking

**Resolved — the constitution was amended on 2026-09-01.** Version **1.0.0 → 2.0.0** (MAJOR,
per the constitution's own versioning policy: a stack substitution covered by Principle III).
The amendment removed Resend from the forbidden-substitutions list, added **Email: Resend** to
the locked-in services with named constraints, and recorded the rationale below. The row that
follows is kept as the record of why, not as an open item. **Phase 7 is not blocked.**

| Violation (resolved 2026-09-01, constitution v2.0.0) | Why needed | Simpler alternative rejected because |
|---|---|---|
| **Resend as the email provider**, named in constitution **v1.0.0**'s Principle III forbidden-substitutions list ("Neon, Fly, R2, BullMQ, Prisma, NextAuth, **Resend**"). **No longer forbidden as of v2.0.0.** | The feature's whole email half needs a transactional sending domain with DKIM, a bounce/complaint webhook and RFC 8058 one-click unsubscribe. The stack the constitution does lock in has no email sender: Supabase Auth sends magic links only, and Slack (`packages/shared/src/slack.ts`) reaches editors, not readers. Spec assumption A3 records the maintainer's sign-off on the provider and its DNS records. | The alternatives are worse, not simpler. Building an SMTP path in-house means owning IP reputation, DKIM signing and bounce parsing — far more code and far more risk than a `fetch` to one endpoint. Dropping email entirely would delete User Stories 3, 4 and 6 and reduce the feature to the Telegram channel, which is Phases 4–5 only. |
| **DONE — 2026-09-01, constitution v1.0.0 → v2.0.0 (MAJOR).** Resend removed from the Principle III forbidden list; **Email: Resend** added to the locked-in services with its constraints; the rationale above recorded in an "Amendment record" paragraph inside Principle III; Sync Impact Report prepended; `Last Amended` set to 2026-09-01. Every phase, Phase 7 included, may proceed. | | |

Two further departures from repo precedent, both already signed off under A3 and recorded here
so the reviewer sees them named:

| Departure | House precedent | Why here |
|---|---|---|
| `sections` stored as `subscription_section[]` (a pg-enum array) | `text[]` — `schema.ts:92`, `:199`, `:202`, `:1374` | FR-007 makes one list the only source of the six names. An enum makes the database refuse a seventh name that the shared list does not carry. Price, recorded in the migration header per A8: a seventh section costs **two migrations, forever** (`ALTER TYPE … ADD VALUE` cannot run in the same transaction as its use). |
| `SubscriptionHealthAlert` duplicates the `day date PRIMARY KEY` marker idiom of `LlmApiFailureAlert` (`0052`, `app/packages/db/src/llm-api-failure-alert.ts:42-47`) rather than reusing that table | One marker table | FR-075. One row per day per table means an LLM failure alert would suppress a subscription alert for the rest of that day, and the repo already learned what six weeks of silence costs. |

---

## Project Structure

### Documentation (this feature)

```text
specs/012-reader-subscriptions/
├── plan.md              # This file
├── research.md          # Phase 0 output — the settled decisions and their rejected alternatives
├── data-model.md        # Phase 1 output — the five tables, column by column
├── quickstart.md        # Phase 1 output — local bring-up and the manual verification script
├── contracts/
│   ├── subscription-api.md    # feliratkozas / megerosites / leiratkozas
│   ├── telegram-callbacks.md  # dg:a, dg:x, dg:r, the reply seam, the origin guard
│   ├── resend-webhook.md      # Svix verification and the bounce state machine
│   └── cron-endpoints.md      # flush-alerts, digest, subscription-health, the workflow
├── checklists/          # pre-existing
└── tasks.md             # Phase 2 output — /speckit.tasks, NOT created here
```

### Source code (paths are absolute from the repository root)

Every path below is stated in full because the source plan got two of them wrong.

```text
.github/workflows/                             # ← REPOSITORY ROOT. GitHub reads only this.
└── subscriptions.yml                          # NEW — flush, digest, health

app/.github/workflows/ci.yml                   # exists, holds CI, GitHub NEVER reads it. Do not add here.

app/packages/shared/
├── package.json                               # EDIT — add "./sections" and "./email" to exports
└── src/
    ├── sections.ts                            # NEW — SUBSCRIPTION_SECTIONS, SECTION_LABELS_HU, SECTION_URLS
    ├── email.ts                               # NEW — Resend batch wrapper, unsubscribeHeaders()
    ├── ratelimit.ts                           # EDIT — subscribeIpLimiter, subscribeIpHourLimiter, confirmTokenLimiter, confirmIpLimiter, subscribePageLimiter; and the stale comment fix at :82
    ├── encryption.ts                          # reuse unchanged — encryptPii :24, decryptPii :32
    └── index.ts                               # EDIT — re-export sections

app/packages/db/src/
├── schema.ts                                  # EDIT — append five tables + four enums at the bottom (file is 1757 lines)
└── subscription-health-alert.ts               # NEW — maybeSendHealthAlert(), modelled on llm-api-failure-alert.ts

app/supabase/migrations/
└── 0053_reader_subscriptions.sql              # NEW — hand-applied, no ROLLBACK block

app/apps/web/src/lib/
├── telegram.ts                                # EDIT — extract sendTelegramMessageTo(chatId, text, replyMarkup)
├── telegram-public.ts                         # NEW — sendPublicChannelMessage(text). No replyMarkup parameter, ever.
├── notify-subscribers.ts                      # NEW — recordSubscriberAlert, revokeSubscriberAlert, buildAlertDedupeKey, formatAlertMessageHu, flushSubscriberAlerts
├── subscriber-crypto.ts                       # NEW — hashSubscriberEmail, signUnsubToken, verifyUnsubToken
├── digest-build.ts                            # NEW — buildDigestDraft(), pure, spend gate injected
├── notify-auto-publish.ts                     # EDIT — export TARGET_LABELS_HU for the FR-009 pinning test
├── notify.ts                                  # EDIT — export DETECTOR_LABELS_HU for the same test
├── telegram-review-actions.ts                 # EDIT — deleteByCode returns personId; alert on applyWatchlistRemoval
├── poll-validation.ts                         # reuse unchanged — checkHoneypot :11-16
└── cron-bypass.ts                             # reuse unchanged — verifyCronRequest :67-71, isBypassActive :62, makeBypassStep :34, bypassLogger :56

app/apps/web/src/inngest/
├── functions/
│   ├── digest-draft.ts                        # NEW — createBypassGuardedFunction + exported runDigestDraftCore
│   ├── digest-send.ts                         # NEW — HAND-ROLLED guard, triggers [{ event: 'digest.send' }, { cron }] + exported runDigestSendCore
│   ├── subscriber-confirm-send.ts             # NEW — the enqueued confirmation sender (event-triggered: plain inngest.createFunction, hand-rolled guard)
│   └── gdpr-retention-sweep.ts                # EDIT — new step 'subscriber-pii-purge'
├── lib/detector-runner.ts                     # reuse unchanged — createBypassGuardedFunction :24
├── client.ts                                  # EDIT — declare the new events in the `Events` type
└── index.ts                                   # EDIT — register the three new functions (file is 91 lines)

app/apps/web/app/api/
├── hirlevel/
│   ├── feliratkozas/route.ts                  # NEW — POST
│   ├── megerosites/route.ts                   # NEW — GET + POST
│   └── leiratkozas/route.ts                   # NEW — GET + POST
├── webhooks/resend/route.ts                   # NEW — POST, Svix-verified
├── cron/
│   ├── flush-alerts/route.ts                  # NEW
│   ├── digest/route.ts                        # NEW
│   └── subscription-health/route.ts           # NEW
├── admin/subscribers/erase/route.ts           # NEW — POST
└── telegram/webhook/route.ts                  # EDIT — origin guard, dg:* branches, the reply seam

app/apps/web/app/
├── _home/newsletter-cta.tsx                   # NEW — 'use client', newsletter-cta-* class namespace
├── hirlevel/
│   ├── page.tsx                               # NEW
│   ├── megerosites/page.tsx                   # NEW
│   └── leiratkozas/page.tsx                   # NEW
├── page.tsx                                   # EDIT — a numbered section after the submission CTA
├── site-footer.tsx                            # EDIT — a /hirlevel link
├── adatvedelem/page.tsx                       # EDIT — what is stored, basis, retention, erasure
└── globals.css                                # EDIT — newsletter-cta-* tokens, Tesla only

app/.env.example                               # EDIT — the new vars, plus three pre-existing gaps (see Phase 2)
CLAUDE.md                                      # EDIT — the same var list under ## Environment
```

**Structure Decision**: no new package and no new deployable. The feature is additive inside
the existing `@korr/web`, `@korr/shared` and `@korr/db` workspaces, which is what Principle III
requires. The only file outside `app/` is the workflow, and it is outside `app/` **because the
platform does not read workflows from anywhere else** (FR-029) — see Phase 5.

---

## Named constants — where each one lives

The spec settles the values. This is where the code puts them. No literal spelling of any of
these appears anywhere else.

| Constant | Value | Home |
|---|---|---|
| `FLUSH_CRON` | `*/15 * * * *` | `.github/workflows/subscriptions.yml` only. **No env var.** A setting that cannot change behaviour is a trap. |
| `FLUSH_BATCH_SIZE` | 20 | `src/lib/notify-subscribers.ts` |
| `TELEGRAM_CHANNEL_RATE` | 20/min | `src/lib/telegram-public.ts` |
| `DIGEST_MIN_ITEMS` | 3 | `src/lib/digest-build.ts` (env-overridable via `DIGEST_MIN_ITEMS`) |
| `DIGEST_REENGAGE_DAYS` | 21 | `src/lib/digest-build.ts` |
| `DIGEST_APPROVAL_EXPIRY_HOURS` | 48 | `src/inngest/functions/digest-send.ts` |
| `DIGEST_RESUME_DAYS` | 3 | `src/inngest/functions/digest-send.ts` |
| `DIGEST_MAX_REGEN` | 1 | `src/lib/digest-build.ts` |
| `DIGEST_CODE_CHARS` | 8 | `src/lib/digest-build.ts` |
| `WATCHLIST_ID_MAX` | 22 | `src/lib/digest-build.ts`, asserted by a pinning test over `WATCH_LIST` |
| `CONFIRM_EXPIRY_HOURS` | 24 | `src/lib/subscriber-crypto.ts` |
| `CONFIRM_COOLDOWN_MINUTES` | 15 | `src/lib/subscriber-crypto.ts` — read by the subscribe route, enforced by the confirmation sender |
| `CONFIRM_MAX_SENDS` | 3 | same. **The cap is checked in `subscriber-confirm-send.ts`, inside the FR-038 transaction.** |
| `SUBSCRIBE_CONFIRM_DAILY_CAP` | 50 | `src/inngest/functions/subscriber-confirm-send.ts` (env `SUBSCRIBE_CONFIRM_DAILY_CAP`) |
| `SUBSCRIBE_CONFIRM_RESERVE` | 10 | same (env `SUBSCRIBE_CONFIRM_RESERVE`) |
| `DIGEST_DAILY_SEND_CAP` | 90 | `src/inngest/functions/digest-send.ts` (env `DIGEST_DAILY_SEND_CAP`) |
| `RESEND_DAILY_LIMIT` | 100 | `packages/shared/src/email.ts` |
| `RESEND_MONTHLY_LIMIT` | 3000 | same |
| `PURGE_DAYS` | 30 | `app/api/hirlevel/leiratkozas/route.ts` and the sweep |
| `HEALTH_FLUSH_HOURS` | 2 | `app/api/cron/subscription-health/route.ts` |
| `HEALTH_APPROVAL_HOURS` | 24 | same |
| `HEALTH_HEARTBEAT_HOURS` | 26 | same |
| `CONSENT_TEXT_VERSION` | `'2026-09-01'` | `packages/shared/src/sections.ts` |
| `SIGNUP_BURST_THRESHOLD` | 10/hour | `app/api/hirlevel/feliratkozas/route.ts` (FR-079) |

`SUBSCRIBE_CONFIRM_DAILY_CAP` is a **security bound**, not a throughput setting (FR-052).
Raising it raises the blast radius of a bot run by the same amount. A capacity problem is
solved by raising `DIGEST_DAILY_SEND_CAP` or the provider tier. The constant carries that
sentence as a code comment, in the file, where someone tempted to raise it will read it.

---

## Environment variables

New, into `app/.env.example` and the `## Environment` section of `CLAUDE.md`:

```
TELEGRAM_PUBLIC_CHANNEL_ID=      # unset = channel kill switch (FR-022)
RESEND_API_KEY=                  # unset = email paused (FR-044, FR-047)
RESEND_FROM=                     # e.g. "Kegyencjárat <hirlevel@mail.kegyencjarat.hu>"
RESEND_WEBHOOK_SECRET=           # Svix signing secret, "whsec_…"
RESEND_LOG_RETENTION_DAYS_DECLARED=7   # hand-verified provider send-log retention, read by audit-log-retention.ts
SUBSCRIBER_LINK_SECRET=          # "kid:secret" — signs AND verifies
SUBSCRIBER_LINK_SECRET_PREVIOUS= # "kid:secret" — verifies ONLY, never signs
DIGEST_DAILY_SEND_CAP=90
SUBSCRIBE_CONFIRM_DAILY_CAP=50
SUBSCRIBE_CONFIRM_RESERVE=10
DIGEST_MIN_ITEMS=3
SUBSCRIBE_IP_DAILY_LIMIT=20      # FR-046 / FR-093
SUBSCRIBE_IP_HOURLY_LIMIT=3      # FR-046
NEXT_PUBLIC_SITE_URL=https://www.kegyencjarat.hu
```

**No `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.** The source plan's Phase 2 listed it. Turnstile is
withdrawn (A11), and adding a public site key for a widget that will never render is a trap
for the next reader.

**No `FLUSH_INTERVAL_MINUTES`.** The schedule lives only in the workflow.

Three pre-existing gaps to close in the same edit, found while checking: `app/.env.example`
declares `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` and `PII_ENC_KEY` at `:38-40`, but declares
**no** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` or `CRON_SECRET`, all three of which the
running system already requires and this feature depends on. Add them, empty.

### The two signing secrets, and their wire format — stated once

`SUBSCRIBER_LINK_SECRET` holds **`kid:secret`**. `SUBSCRIBER_LINK_SECRET_PREVIOUS` holds the
same shape and **verifies only**.

- **Signed bytes**: the UTF-8 of `unsub:v1:{kid}:{subscriberId}` and nothing else. No URL, no
  query string, no trailing newline.
- **Token**: `base64url(payload) + "." + base64url(hmacSha256(secret, payload))`. The MAC is
  32 raw bytes → 43 base64url characters. A typical token is ~110 characters.
- **URL**: `${NEXT_PUBLIC_SITE_URL}/hirlevel/leiratkozas?t=<token>`.
- **Verify**: split on the last `.`; decode; parse the kid out of the payload; select **that**
  key; length-check both MAC buffers; `timingSafeEqual`. **An unknown kid rejects. Never fall
  through to trying every key** (FR-039).
- **No time expiry in the signature** (FR-040). A delivered message must stay usable.
- **Rotation**: copy the current value into `_PREVIOUS`, set a new `kid:secret`, deploy. Never
  remove a `_PREVIOUS` while any inbox may hold a message signed with it.
- `SUBSCRIBER_LINK_SECRET` is **not** `PII_ENC_KEY` (FR-041). Separate secrets, separate
  rotation schedules.

Deliberately **not** the `INTERNAL_REVALIDATE_SECRET ?? PII_ENC_KEY` fallback pattern used at
`app/apps/web/app/api/admin/submissions/[id]/audit-pii-read/route.ts`. A fallback that silently reuses the
encryption key as a signing key defeats FR-041.

---

## Rollback

*Carried here from the spec's `## Deferred to plan.md` heading, per FR-none — it is a plan
obligation. All six points are intact.*

### The mechanism

There is **no `-- ROLLBACK` block in `0053`**. Zero of the 58 existing migrations contain one,
and `app/docs/migrations.md:65` documents the opposite policy in so many words:

> We don't generate down-migrations because Supabase branches are the rollback mechanism: roll
> forward to the previous branch, restore from the nightly snapshot if the data shape
> diverged. Document each rollback in the launch-gate restore-drill folder.

So: **roll forward to the previous Supabase branch**, or **restore the nightly snapshot** if
the data shape diverged. Record the run in `app/docs/restore-drills/postgres-YYYY-MM-DD.md`,
alongside the two drills already there (`postgres-2026-04-30.md`, `storage-2026-04-30.md`).

**Removing the five tables and four enums after data exists is a separate change**, per the
two-PR idiom at `app/docs/migrations.md:72` and constitution Principle VII. It never rides
along with the code change that stopped using them.

### A restore is a data-protection event, not only an operations one

Restoring a pre-`0053` snapshot **destroys the Article 7(1) consent evidence** for every reader
who confirmed after the snapshot — while their address still exists in the email provider's
delivery logs. The result is a set of people the site can prove nothing about and can still
be shown to have mailed.

**Export `Subscriber` before any restore that reaches back past a confirmation.** That export
is the consent record. Treat it as personal data: it holds `emailEnc`, `signupIpHash` and
`confirmedIpHash`.

### What no database mechanism can undo

| Surface | Recoverable? |
|---|---|
| The five tables, the four enums, and rows written after the snapshot | Yes — schema and data only |
| An unflushed alert (`channelSentAt IS NULL`) | Yes — `revokedAt` suppresses it |
| An item already in a drafted, unsent digest | Yes — the send re-filters `revokedAt IS NULL` (FR-061) |
| **A posted public channel message** | **No.** Only a correction post, seen only by readers who look again. |
| **A delivered email** | **No. Unrecallable by any means.** This is the one genuinely one-way step in the feature. |
| DNS state and the provider's sending-domain state | No — they live outside Postgres |

### Env-only back-outs, which need no migration at all

| Surface | Back-out |
|---|---|
| Public channel | Unset `TELEGRAM_PUBLIC_CHANNEL_ID`. The module and the flush no-op, rows are retained for a later run, and the health check's stale-alert condition is suppressed (FR-022, FR-077). |
| Email | Unset `RESEND_API_KEY`. `/hirlevel` shows the paused state and the POST returns the paused response, not a false 201 (FR-044). |
| Schedules | Disable `subscriptions.yml` in the GitHub Actions UI. |
| Provider webhook | It still accepts posts after the key is unset — **disable it at the provider too**, or bounce events keep mutating `Subscriber`. |
| Subscribers arriving while email is paused | Expected. They stay `pending` and receive their confirmation when it resumes. |
| DNS at `p=quarantine` | Revert to `p=none`. |

The source plan carried a seventh row here — "Turnstile: after Phase 1 there is no env-only
back-out". **That row is void**, along with the Turnstile phase it described. Nothing in this
feature touches `packages/shared/src/turnstile.ts`, `submission-form.tsx` or
`app/api/submissions/route.ts`.

---

## Phases

Eight phases. The mapping to the source plan is given so a reader holding that document can
follow. Source Phase 0 and the widget half of source Phase 1 are deleted with Turnstile.

| Here | Source plan | Ships |
|---|---|---|
| 1 | 1 (webhook guard half only) | The `callback_query` origin guard |
| 2 | 2 | Env vars, shared constants, the exports map |
| 3 | 3 | Schema and migration 0053 |
| 4 | 4 | Public channel module, the alert seam, revocation |
| 5 | 5 | The editor-confirm gate, the flush route, the workflow |
| 6 | 6 | Subscribe, confirm, unsubscribe, honeypot, limiters, the signup-burst ping |
| 7 | 7 | The email wrapper, the provider webhook, the digest and its review |
| 8 | 8 + 9 | Health watchdog and the GDPR pass |

### Dependency graph

```
1  (origin guard — closes a live window, ships alone, no dependency)
2  (env + shared constants; P2/P3/P4 run in parallel from day one)
 └─ 3  (schema 0053)
     ├─ 4 → 5     (channel, outbox, seam, gate, flush + workflow)  ← independently shippable
     └─ 6 → 7     (subscribe, provider, digest)
                   └─ 8  (health + GDPR)
```

**Phase 8 hangs off Phase 7, not off Phase 3.** Four of the six conditions the route evaluates —
the five FR-076 conditions plus the sixth it adds beyond them — only become real once the digest
and the confirmation sender exist: a draft stuck at `awaiting_approval`, a last `sent` digest older
than its cadence, the ledger reconcile comparing `reservedCount` against the same ledger row's
`sentCount`, and a subscriber left `pending` with no confirmation ever sent. Building the watchdog
against the schema alone would leave those four untestable and the most valuable ones unwritten. The GDPR pass joins Phase 8 for the same reason: it
purges columns that only carry data once Phase 6 writes them.

**Phases 4–5 remain independently shippable.** They deliver the whole channel promise with no
personal data, no provider, no consent record and no unrecallable step, and they own the
workflow they depend on.

---

### Phase 1 — The `callback_query` origin guard (FR-005)

**Three lines, and they ship before anything reader-facing.**

The chat-id whitelist sits **inside `if (update?.message)`** at
`app/apps/web/app/api/telegram/webhook/route.ts:642-645`:

```ts
const allowedChatId = process.env.TELEGRAM_CHAT_ID;
if (!allowedChatId || String(msg.chat.id) !== allowedChatId) {
  return NextResponse.json({ ok: true }); // ismeretlen chat — csendben eldobva
}
```

The `callback_query` handler begins at `:772` and **never checks the originating chat**. Every
button — `v`/`k` (hard-deletes), `d`, `a`/`r`/`n`, `s` (posts to Facebook), and the `dg:` set
this feature adds (**which sends email to the whole list**) — runs unauthenticated as to
origin. It is safe today only because the bot posts keyboards nowhere else. Phase 4 puts the
same bot in a public channel.

Insert immediately after the `if (!cq?.data || !cq.message)` early return at `:773-775`, using
the repo's own shape and guarding on the env var **first**:

```ts
const allowedChatId = process.env.TELEGRAM_CHAT_ID;
if (!allowedChatId || String(cq.message.chat.id) !== allowedChatId) {
  return NextResponse.json({ ok: true });
}
```

Comparing `String(cq.message.chat.id) !== process.env.TELEGRAM_CHAT_ID` directly compares
against `undefined` when the variable is unset — always unequal — which silently bricks
**every** editor button. The `!allowedChatId` clause is not defensive decoration; it is the
difference between "refuse everything" and "refuse everything and nobody knows why".

**Verification**: the two acceptance scenarios of User Story 1, exercised against a route
handler with a stubbed `getDb()` that records every call. Zero calls in both cases.

---

### Phase 2 — Env, shared constants and the exports map

**`packages/shared/src/sections.ts`** is new and is the single source FR-007 demands:

```ts
export const SUBSCRIPTION_SECTIONS = [
  'resignation', 'media_closure', 'court_verdict',
  'criminal_complaint', 'asset_recovery', 'watchlist_removal',
] as const;
export type SubscriptionSection = (typeof SUBSCRIPTION_SECTIONS)[number];
export const SECTION_LABELS_HU: Record<SubscriptionSection, string> = { … };
export const SECTION_URLS: Record<SubscriptionSection, string> = { … };
export const CONSENT_TEXT_VERSION = '2026-09-01';
```

It lives in `@korr/shared`, not `@korr/db`, because the subscribe form is `'use client'` and
`@korr/db`'s entry point is the Drizzle client. `@korr/db` imports the list from here to build
the pg enum, so the enum and the form can never drift.

**`packages/shared/package.json` has fourteen explicit `exports` entries and no wildcard.** Add
both, or the import fails at build time with no other symptom:

```json
"./sections": "./src/sections.ts",
"./email":    "./src/email.ts"
```

Re-export `sections` from `src/index.ts` as well, matching the file's existing habit.

**`SECTION_LABELS_HU` is the single source for reader-facing names only.** Do **not** re-derive
the two server maps from it:

- `TARGET_LABELS_HU` — `app/apps/web/src/lib/notify-auto-publish.ts:31`
- `DETECTOR_LABELS_HU` — `app/apps/web/src/lib/notify.ts:34`

Those are editor-facing strings. `watchlist_removal` reads "Lemondásra felszólított — mandátum
megszűnt" there, which is the editor's own notification wording. Re-deriving would silently
rewrite live editor messages as a side effect of a newsletter feature.

**Both maps are currently declared `const`, not exported.** FR-009 requires a pinning test that
asserts every key of each editor map has a `SECTION_LABELS_HU` counterpart. Change both to
`export const` — a two-character edit that changes no behaviour — so the test can read them.
Deriving the key set from the TypeScript type instead would pin nothing at runtime.

**Section → URL map**, verified against the routes that exist:

| Section | URL | Detail page? |
|---|---|---|
| `resignation` | `/lemondasok` | Yes — `app/lemondasok/[id]/` exists |
| `watchlist_removal` | `/lemondosok` | No — list only |
| `media_closure` | `/megszunt` | No |
| `court_verdict` | `/birosagi-iteletek#birosagi-iteletek` | No |
| `criminal_complaint` | `/birosagi-iteletek` | No |
| `asset_recovery` | `/visszaszerzett-vagyon` | No |

Correction to the source plan: it said "four of six sections have no detail page". **Five do
not.** Only `resignation` has one. `/birosagi-iteletek/page.tsx:123` carries exactly one
anchor, `id="birosagi-iteletek"`, on the verdict section; the complaint list on the same page
has none. That is why FR-031 requires the message text to state which of the two it is — the
link cannot.

---

### Phase 3 — Schema and migration `0053`

`app/packages/db/src/schema.ts` (append at the bottom; the file is 1757 lines) and
`app/supabase/migrations/0053_reader_subscriptions.sql`.

**`0053` is the next free number**, verified: `app/supabase/migrations/` holds `0048`–`0052`;
`0047_criminal_complaint_related_cases.sql` is the stray at the repository-root
`supabase/migrations/` that the spec puts out of scope.

**Applied by hand**, like `0048`–`0052`. `supabase migration up` does not work in this repo.

**No `-- ROLLBACK` block.** See Rollback above.

The migration header carries two sentences that a future reader needs: the A8 price of the
enum (a seventh section costs two migrations, forever, because `ALTER TYPE … ADD VALUE`
cannot run in the same transaction as a use of the new value), and the FR-086 note that the
retention pass deliberately keeps `emailHash`, `status` and `consentTextVersion`.

The full column tables, the enum member lists, the indexes and the reserve/release SQL are in
[`data-model.md`](./data-model.md). The three things that decide whether this feature works
are repeated here because they are the ones that fail silently:

1. **`Subscriber.emailEnc`** is written **only** by the subscribe POST via
   `encryptPii()` (`packages/shared/src/encryption.ts:24`) and read **only** by the
   confirmation sender and the digest sender via `decryptPii()` (`:32`). It is never logged and
   never placed in an `AuditLog.detail`. `AuditLog` is `schema.ts:282-296` — `action`,
   `entityType`, `entityId`, `detail jsonb`, `actorEditorId` (nullable, which is what an
   unauthenticated reader action needs).
2. **`SubscriberAlert.channelSentAt`** is the claim marker. It is written *by the same
   statement that selects the row*, never by a later `UPDATE`.
3. **`EmailSendLedger.reservedCount`** — and never `sentCount` — is what `remaining` is
   computed from. Only reservations bound concurrent senders.

---

### Phase 4 — Public channel and the alert seam

#### The channel sender

Extract `sendTelegramMessageTo(chatId, text, replyMarkup?)` in
`app/apps/web/src/lib/telegram.ts` and make the existing `sendTelegramMessage` (`:22-36`) a
delegate that passes `process.env.TELEGRAM_CHAT_ID`. **`replyMarkup` is argument 2 at roughly
40 call sites**, so adding a third parameter to the existing function would be a trap; the new
function takes the chat id first.

New `app/apps/web/src/lib/telegram-public.ts` exports `sendPublicChannelMessage(text: string)`,
reading `TELEGRAM_PUBLIC_CHANNEL_ID` and **no-opping when it is unset — a working kill switch**
(FR-022). It is a separate module that **takes no `replyMarkup` parameter at all**, so a
message with Approve/Reject buttons is structurally unable to reach a public audience
(FR-021). Plain text, no `parse_mode`.

`sendTelegramMessage` already returns `result.message_id ?? null` (`telegram.ts:34-35`), which
Phase 7 needs for the reply seam. Preserve that return through the delegate.

#### `app/apps/web/src/lib/notify-subscribers.ts`

Same contract as `notify-auto-publish.ts`: **returns normally even when the database rejects
the insert, and never fails a caller's step** (FR-013).

- `recordSubscriberAlert(input)` — one `insert(...).onConflictDoNothing({ target: dedupeKey })`.
  **No Telegram I/O on the caller's path** (FR-014).
- `revokeSubscriberAlert(dedupeKey)` — sets `revokedAt = now()` where it is still null.
- `buildAlertDedupeKey(section, id)` and `formatAlertMessageHu(row)` are pure and exported;
  they carry the unit tests.
- `flushSubscriberAlerts({ max = FLUSH_BATCH_SIZE })` returns `{ sent, remaining }`.

#### The flush claims before it posts (FR-023, FR-024)

A duplicate public post is not recallable, and two overlapping runs would both select
`channelSentAt IS NULL` and both post. **Two defences, both required:**

1. **Database claim.** One statement selects and marks:

   ```sql
   UPDATE "SubscriberAlert"
      SET "channelSentAt" = now()
    WHERE id IN (
      SELECT id FROM "SubscriberAlert"
       WHERE "channelSentAt" IS NULL AND "revokedAt" IS NULL
       ORDER BY "occurredAt" ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
    )
   RETURNING id, section, title, detail, url, "occurredAt";
   ```

   Claim **one** row, post it, then claim the next — up to `FLUSH_BATCH_SIZE` times. The
   `LIMIT` is 1 and not `FLUSH_BATCH_SIZE`: batching the claim would mark twenty rows sent and
   then lose every row after a 429 or a timeout, which is nineteen more than FR-024 permits.

2. **Workflow concurrency.** `cancel-in-progress: false` in `subscriptions.yml`, on a group
   keyed on the schedule rather than on the file — see Phase 5 (FR-025).

**Claim-then-post means a crash mid-run loses an alert rather than duplicating one.** That is
the deliberate choice FR-024 records: a missed alert is recoverable by the next publication, a
duplicate public post is not.

A 429 from Telegram breaks the loop. Because each row is claimed immediately before it is
posted, every row the run has not reached is still unclaimed, so the next scheduled run resumes
from them exactly as FR-027 requires. Contract item C4 in `contracts/cron-endpoints.md`
describes the older batch-claim behaviour ("the loss is one batch at most") and is
**superseded by this paragraph**. With `TELEGRAM_PUBLIC_CHANNEL_ID` unset the function returns `{ sent: 0 }` **before
claiming anything**, so every `channelSentAt` stays NULL (FR-022).

#### Revocation, and its limits (FR-019)

Wire `revokeSubscriberAlert()` into **both** delete paths:

- the `v` branch at `webhook/route.ts:790`, which for watchlist removals **already returns the
  person id** — `.returning({ personId: …, sourceUrl: … })` at `:810`. Reuse it.
- `deleteByCode()` at `webhook/route.ts:201-209`, which returns nothing. **Add
  `.returning({ personId: schema.watchlistRemovals.personId })` to the watchlist branch there.**

For `watchlist_removal` the dedupe key needs the *person* id, not the row id, because
`applyWatchlistRemoval` uses `onConflictDoUpdate({ target: personId })` — a re-tap or a
revert-then-redetect would otherwise alert twice for one person (FR-015). The paired
resignation row produces no second alert (FR-017).

| Channel | Can `revokedAt` undo it? |
|---|---|
| The next digest | Yes — the send re-filters `revokedAt IS NULL` (FR-061) |
| An unflushed channel post | Yes |
| An already-posted channel message | Only by a correction post |
| **Email already delivered** | **No. Unrecallable.** |

---

### Phase 5 — The editor-confirm gate, the flush trigger and the workflow

#### The gate (FR-016)

```ts
export const ALERT_ON_EDITOR_CONFIRM: ReadonlySet<AutoPublishTarget> =
  new Set(['asset_recovery', 'watchlist_removal']);
```

`AutoPublishTarget` is `'court_verdict' | 'asset_recovery' | 'watchlist_removal'`
(`notify-auto-publish.ts:19`) — a different, three-value union from `SubscriptionSection`.
FR-008 makes this the one permitted carve-out from FR-007, and a pinning test asserts the set
is exactly those two members.

#### The six call sites (FR-018)

| # | Where | Sections it covers |
|---|---|---|
| 1 | `detect-verdicts.ts:307` (auto-publish; the insert is `:246`) | `court_verdict` |
| 2 | `detect-resignations.ts` after the insert at `:226` | `resignation` |
| 3 | `detect-media-closures.ts:159` and `detect-criminal-complaints.ts:147` (the inserts) | `media_closure`, `criminal_complaint` |
| 4 | `webhook/route.ts`, the `a` approve branch, via `outcome.recordId` / `outcome.recordIds` (see `:617`, `:1264`) | **five** of six |
| 5 | `webhook/route.ts`, the `v`/`k` branch at `:787`, guarded by `ALERT_ON_EDITOR_CONFIRM` so only the `k` ("✅ OK, marad") press alerts | `asset_recovery`, `watchlist_removal` |
| 6 | `webhook/route.ts`, the `a:wc:` branch — `applyWatchlistRemoval(person, article, checked.check)` at `:1036` — **ungated** | `watchlist_removal` |

Site 4 covers five and not six because `watchlist_removal` is absent from both
`DETECTOR_PROCESSORS` (`telegram-review-actions.ts:614`, with the exclusion comment at `:624`)
and `setPendingStatus` (`webhook/route.ts:459`).

**Site 6 is the highest-value fix in the phase.** `applyWatchlistRemoval`
(`telegram-review-actions.ts:690`, called at `webhook/route.ts:1036`) calls no
`notifyAutoPublished`, is not in `DETECTOR_PROCESSORS`, and is not a detector insert — so
sites 1–5 all miss it while it writes two live rows. It is ungated because the `a:wc:` button
press **is** the human gate (A1). One alert, keyed on the person; none for the paired
resignation row.

**Not call sites**: `detect-asset-recoveries.ts:169` and `detect-watchlist-removals.ts:169`.
Both call `notifyAutoPublished` on an automatic insert, and FR-016 says those two sections
alert only after an editor acts.

**Court verdicts are not suppressed** (A2). Three paths all alert — the auto-publish insert
(site 1), a pending row approved with `a` (site 4), and a near-miss forced through with `a`
(site 4). The mitigation is structural rather than a gate: detector-insert sites do not flush
inline, so the editor has **at least** the flush interval to press Visszavonás. "At least",
because a delayed Actions run lengthens the window, which is the safe direction.

#### The flush trigger

**Not appended to `app/apps/web/app/api/cron/pipeline/route.ts`** (FR-028). That route runs
seven sequential steps — a scraper plus six LLM detectors — under `maxDuration = 300` with no
per-step budget. A flush appended last is the step most likely to be silently truncated, and
silent truncation is exactly this feature's failure mode.

New `app/apps/web/app/api/cron/flush-alerts/route.ts`, behind `verifyCronRequest`
(`src/lib/cron-bypass.ts:67-71` — `Boolean(secret) && authHeader === 'Bearer ' + secret`),
matching the four existing cron routes under `app/apps/web/app/api/cron/`.

#### The workflow — the path that the source plan got wrong

**`/.github/workflows/subscriptions.yml`, at the REPOSITORY ROOT.**

`app/.github/workflows/ci.yml` exists and holds CI. **GitHub never reads it**, because Actions
loads workflows only from `.github/workflows/` at the repository root. Putting the schedule
there would be a silent no-fire (FR-029).

The root directory already proves the pattern works: `.github/workflows/hourly-pipeline.yml`
and `.github/workflows/daily-video-health-check.yml` are the live schedules. Copy
`hourly-pipeline.yml` exactly — same `curl` shape, same `Authorization: Bearer ${{ secrets.CRON_SECRET }}`
header, same non-200 `::error::` exit, same base URL `https://www.kegyencjarat.hu`.

```yaml
on:
  schedule:
    - cron: '*/15 * * * *'        # FLUSH_CRON — flush-alerts, created here (T031)
    # - cron: '5 7 * * 1'         # digest draft, Monday 07:05 UTC — added in Phase 7 (T073)
    # - cron: '20 6 * * *'        # subscription-health, daily — added in Phase 8 (T080)
  workflow_dispatch:
    inputs:
      target:
        description: 'Melyik cron-végpontot hívjuk'
        type: choice
        options: [flush-alerts, digest, subscription-health]
        default: flush-alerts
concurrency:
  group: subscriptions-${{ github.event.schedule || github.event.inputs.target || 'dispatch' }}
  cancel-in-progress: false
```

**The group is keyed on the schedule and not on the file.** Three schedules share this
workflow. A single group would queue them together, and GitHub cancels the older pending run
when a second one waits — so the every-15-minutes flush would evict the weekly digest and the
daily health check from the queue, silently. `cancel-in-progress: false` still guarantees
FR-025 for the flush, because every flush tick lands in the same `*/15 * * * *` group.

The digest and health jobs are added in Phases 7 and 8; the file is created here, with the
flush job only, so Phases 4–5 ship complete.

The full job body — the `case` dispatch, the `curl` shape and the non-200 `::error::` exit — is
in `contracts/cron-endpoints.md`. **Two corrections to that contract, applied here and
authoritative over it**: the `concurrency` group is keyed on the schedule (see above), and the
`case` default arm routes through the `workflow_dispatch` `target` input rather than falling
back to `flush-alerts`.

**One thing the workflow cannot do**, and the reason Phase 8 exists: GitHub disables scheduled
workflows after 60 days of repository inactivity, with no notification to the app.

---

### Phase 6 — Subscribe, confirm, unsubscribe

Routes under `app/apps/web/app/api/hirlevel/`: `feliratkozas` POST, `megerosites` GET+POST,
`leiratkozas` GET+POST. Pages at `app/apps/web/app/hirlevel/`. Client component
`app/apps/web/app/_home/newsletter-cta.tsx` in the `newsletter-cta-*` class namespace, a
numbered section in `app/apps/web/app/page.tsx` after the existing `submission-cta.tsx` block,
and a footer link in `app/apps/web/app/site-footer.tsx` (FR-092). Tesla tokens only. Every
surface is same-origin, so `next.config.js` and its CSP are not touched.

#### No plain page request in this feature ever mutates (FR-034, FR-035)

**Acceptance criterion**: a GET on `megerosites` and on `leiratkozas` returns 200 and leaves
every `Subscriber` column unchanged; a test asserts row equality before and after.

**Why.** Corporate mail scanners — SafeLinks, Proofpoint, Mimecast — GET every link on
delivery. A single-use token consumed on GET is burned before the reader ever clicks, and the
`confirmSentCount` cap of 3 then locks that address out permanently and silently.

The same attack hits unsubscribe, and **RFC 8058 does not protect it**: 8058 covers only the
`List-Unsubscribe-Post` header URL, never the body link a human clicks. Include a `mailto:`
value alongside the `https:` one in `List-Unsubscribe` — scanners cannot trigger a mailto, and
Gmail expects it (FR-042).

The GET page renders **byte-identically for a valid, an expired and an invented token**, apart
from the form nonce. Validity is revealed only after the POST.

#### The honeypot (FR-089, FR-011, FR-095)

Reuse `checkHoneypot` — **and note where it actually lives**. It is
`app/apps/web/src/lib/poll-validation.ts:11-16`, inside `apps/web`, **not** in `@korr/shared`:

```ts
export function checkHoneypot(honeypot: unknown): ValidationResult {
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
    return { valid: false, error: 'honeypot' };
  }
  return { valid: true };
}
```

The subscribe route is also in `apps/web`, so it imports it directly:
`import { checkHoneypot } from '@/lib/poll-validation';`. **Do not move the helper into
`@korr/shared`** — moving it would edit the poll vote route, which is not this feature's to
change, for no gain. "Shared" in FR-089 means one implementation, not one package.

**Hiding the field is where honeypots usually fail.** `display: none` alone is the wrong
control: some bots skip display-none inputs, and some password managers and autofill engines
still complete them, which would refuse a real reader. Specify all four:

```html
<div class="newsletter-cta-hp" aria-hidden="true">
  <label for="nl-website">Weboldal</label>
  <input id="nl-website" name="website" type="text"
         tabindex="-1" autocomplete="off" />
</div>
```

```css
.newsletter-cta-hp {
  position: absolute;
  left: -9999px;
  width: 1px; height: 1px;
  overflow: hidden;
}
```

- **Off-screen positioning, not `display:none`** — the field stays in the accessibility tree's
  layout but never on screen.
- **`aria-hidden="true"`** — a screen reader never announces it (FR-011).
- **`tabindex="-1"`** — a keyboard user can never tab into it and fail the check.
- **`autocomplete="off"`** and a field name a password manager will not recognise as an
  address, a name or a phone number. `website` is safe; `email`, `name`, `tel` are not.

A filled field returns the **same generic Hungarian failure text an invalid submission
returns**, so a bot learns nothing about which check refused it. The poll route's own wording
is the precedent — `'A beküldés nem sikerült.'`, 400.

#### Rate limits — and why this is not `pollVoteIpLimiter` (FR-046, FR-093)

New limiters are **declared and exported from `app/packages/shared/src/ratelimit.ts`**. The
`getOrCreate` factory at `:58-62` is module-private and cannot be called from a route. Only
that factory carries the in-memory fallback for an environment with no Upstash configured
(`:39-56`), so a bespoke limiter built in a route would **silently fail open** wherever Upstash
is unset — which is every local and preview environment.

**Do not import `pollVoteIpLimiter` itself.** It is `ratelimit.ts:83-86`,
`POLL_VOTE_IP_DAILY_LIMIT ?? 75` — seventy-five attempts per IP per day — and its own comment
at `:79-82` records why that number is loose: it is a *secondary* net, the *primary* protection
is a per-browser "already voted" cookie, and the threshold is deliberately generous so shared
NAT (a workplace, a university, a shared Wi-Fi) does not collide with it.

**The subscribe form inherits neither of the two layers that made 75 safe.** The cookie cannot
transfer — one signup per browser would refuse the second person in a household or an office —
and Turnstile is gone (A11). Reusing that function would take a threshold tuned for generosity
and make it the outermost control on a **mail-sending** endpoint, with only a honeypot beside
it that the poll code itself scopes to simple bots. 75 confirmation attempts a day from one
address is not a bound anyone would choose here deliberately.

So: a **separate `subscribeIpLimiter`, built from the same `getOrCreate` factory**, with its
own env-tunable constant. The source plan's figures were set when Turnstile still stood in
front; with Turnstile gone they tighten if anything, never loosen toward 75.

| Route | GET | POST | Limiter |
|---|---|---|---|
| `feliratkozas` | — | 3/IP/hour and 20/IP/day | `subscribeIpHourLimiter()` (`SUBSCRIBE_IP_HOURLY_LIMIT ?? 3`), `subscribeIpLimiter()` (`SUBSCRIBE_IP_DAILY_LIMIT ?? 20`) |
| `megerosites` | 240/IP/hour | 5 per **token id**/hour, plus 60/IP/hour | `subscribePageLimiter`, `confirmTokenLimiter()`, `confirmIpLimiter()` |
| `leiratkozas` | 240/IP/hour | 5 per **token id**/hour, plus 60/IP/hour | same three |

The per-token key is required because a shared corporate egress address defeats a per-address
key (FR-046).

#### The stale comment at `ratelimit.ts:82` — fix it while implementing FR-093

The last sentence of the `pollVoteIpLimiter` comment still reads:

> A tényleges bot-védelmet a Turnstile adja, nem ez a szám.

Commit `d5f66a9` (2026-08-31) removed Turnstile from the voting flow and left that line
behind. It is now false on `main`, and it is false in the most damaging direction: the next
reader — including the reviewer of this feature — is told a control is protecting them that no
longer exists.

Rewrite it to what is **true now for the poll**: the browser cookie is the primary control, the
IP threshold is the secondary net, and **since `d5f66a9` there is no third layer**. Do not let
the rewrite imply the poll is as protected as it was. It is not, and that is the maintainer's
accepted trade — recorded in A11 and in the poll route's own step-4 comment — not something to
paper over. Add one sentence pointing at `subscribeIpLimiter` and saying it is deliberately
separate and deliberately tighter.

#### Order of operations — cheapest first (FR-095)

**`feliratkozas` POST:**

1. **Honeypot** — before every other check and **before any database read or write**.
2. **Network-address thresholds** — hourly, then daily.
3. **Zod** — address format; the section list against `SUBSCRIPTION_SECTIONS`; the cadence.
4. **Role-address and disposable-domain refusal** (FR-045). Still no database work.
5. `hashSubscriberEmail(raw)` — `sha256(raw.trim().toLowerCase())`.
6. Suppression check on the tombstone.
7. An already-**active** row: update `sections` and `cadence` **in place**, send nothing
   (FR-090).
8. A **pending** row inside `CONFIRM_COOLDOWN_MINUTES` of its `confirmLastSentAt`: return
   without sending (FR-090). The per-address cap of `CONFIRM_MAX_SENDS` is **not** checked here
   — it is checked inside the confirmation sender's transaction (FR-038), because only there is
   it atomic with the increment. Checking it in the route as well would be a second, racy copy
   of a control FR-096 makes primary.
9. Otherwise insert, writing `emailEnc` via `encryptPii`, `emailHash`, `sections`, `cadence`,
   `consentTextVersion` from `CONSENT_TEXT_VERSION`, and `signupIpHash`.
10. **Enqueue** the confirmation job. It reserves ledger budget and increments
    `confirmSentCount` **in one transaction** (FR-038), or the cap of 3 is racy.
11. Count signups from this `signupIpHash` in the last hour; over `SIGNUP_BURST_THRESHOLD`,
    ping the editor chat (FR-079). **This ships here, with the form, not in Phase 8** — with no
    challenge widget it is the only signal that tells a human a bot run is under way. It uses
    its own hourly marker, **not** the health check's daily one (FR-075, FR-079), or one stall
    condition would suppress the abuse signal for the rest of the day.
12. Audit row with the address redacted (FR-091).
13. **The same 201 from every branch** (FR-043).

Residual, stated honestly rather than hidden (A10): the tombstone branch is one SELECT and the
new-subscriber branch is a SELECT, an INSERT and an enqueue. Keeping the network call off the
request path narrows the timing oracle without making it constant-time.

**The cadence choice, and why the form does not offer one.** FR-032 lets a reader "choose a
cadence" and sets weekly as the default; A6 defers the daily-versus-weekly decision and keeps
both in the data model. Those two combine badly on a form: `digest-draft` runs on `5 7 * * 1`
only, so a subscriber stored as `daily` matches no digest the sender ever builds, receives
nothing, and triggers no health condition. Until a daily draft schedule exists, the column
keeps its `weekly` default, the route accepts only `weekly`, and the form states the cadence
rather than asking for it. Adding daily later costs a schedule and a form control, and no
migration.

**`megerosites` POST:** rate limit → parse token → `sha256` → look up by `confirmTokenHash` →
reject if null or expired → set `confirmedAt`, `confirmedIpHash`, `status = 'active'`, null
`confirmTokenHash` → audit row.

**`leiratkozas` POST:** rate limit → verify the HMAC, the kid must resolve → set
`status = 'unsubscribed'`, `unsubscribedAt`, `purgePiiAt = now() + PURGE_DAYS` → audit row.
Idempotent (FR-085).

#### Every reader state

The wording is settled in the spec's Reader-facing states table and is not re-decided here.
Two behaviours behind it are plan decisions:

- **"Küldj újat" resets `confirmSentCount` to 0** when the previous token expired unused
  (FR-037). Without the reset, the cap of 3 collides with the 24-hour expiry and locks out
  anyone who reads their mail the following evening.
- **With `RESEND_API_KEY` unset the POST returns a distinct paused response, not a fake 201**
  (FR-044). The uniform-201 rule exists to prevent an enumeration oracle; that rationale does
  not apply when the whole channel is off, and returning success to a reader who will never get
  mail is a lie.

All reader copy is Hungarian and is drafted under the `hungarian-copy` skill.

---

### Phase 7 — The email wrapper, the provider webhook and the digest

#### T — Add a Resend row to `app/docs/log-retention.md`, and a check to the audit script

**This is a task, not a precondition.** Precondition P3 sets the provider's send-log retention
once, at account creation. A one-time act has no ongoing enforcement: a later reconfiguration, a
tier change or a new team would silently undo it. `app/docs/log-retention.md` is not
documentation — every row carries a **Verified-by** mechanism, and the deploy-time audit
(`app/scripts/audit-log-retention.ts`, run once per deploy, **failure aborts the deploy**)
consumes it. Only a row there puts the setting under recurring check.

**The row:**

| Platform | Setting | Configured | Verified-by |
|----------|---------|-----------|-------------|
| Resend send logs | Account → Settings → data retention | ≤7 days | `RESEND_LOG_RETENTION_DAYS_DECLARED` env var + dated screenshot SHA, stored beside the Sentry row's screenshot in `app/docs/` |

**Why a declared value and not an API read.** Better Stack's row can be checked over its API
because its `GET /api/v1/sources` returns `attributes.retention_days`. **Resend's public API has
no equivalent field** — checked 2026-09-01 against the API reference: its resource groups are
Emails, Broadcasts, Automations, Events, Templates, Contacts, Contact Properties, Segments,
Topics, Domains, Logs, API Keys, Suppressions, OAuth and Webhooks, with no account-settings or
retention resource, and `GET https://api.resend.com/logs` returns only `id`, `created_at`,
`endpoint`, `method`, `response_status` and `user_agent`. So Resend falls in the same class as
Vercel and Inngest: hand-verified, recorded in a `*_DECLARED` env var, evidenced by a dated
screenshot SHA. **Re-check at implementation time** — if the provider has since exposed the
field, prefer the API read, which is the stronger mechanism.

**The code:** add `checkResend()` to `app/scripts/audit-log-retention.ts`, shaped exactly like
`checkInngest()` — read `RESEND_LOG_RETENTION_DAYS_DECLARED`, compare against `MAX_DAYS = 7`,
return `OK` / `DRIFT` / `SKIPPED`, and add it to the `Promise.all` in `main()`. The file's
existing rule carries over unchanged: `SKIPPED` is an acceptable degraded mode for local dev,
**never for a production deploy**.

**Ordering.** This task lands with the rest of Phase 7, but P3's retention setting must already
be in place — see PR-2. The row records a setting that exists; it does not create one.

#### `packages/shared/src/email.ts`

Built on the `slack.ts` model: native `fetch` to `POST https://api.resend.com/emails/batch`
(maximum 100 per call), env-gated on `RESEND_API_KEY`, **never throws**, returns
`{ sent, failed, error? }` (FR-047). No SDK, no new dependency.

`unsubscribeHeaders(token)` is a **separate pure function**, because the exact spelling of
`List-Unsubscribe-Post: List-Unsubscribe=One-Click` is load-bearing for Gmail and needs its own
test:

```
List-Unsubscribe: <https://…/hirlevel/leiratkozas?t=…>, <mailto:leiratkozas@…?subject=unsubscribe>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

Templates are Hungarian, plain-text-first with an HTML twin, each carrying the unsubscribe link
and a footer naming the controller.

Add `"./email"` to the `exports` map (Phase 2).

#### `app/apps/web/app/api/webhooks/resend/route.ts` (FR-055)

Verify the **Svix** signature with `node:crypto` over `${id}.${timestamp}.${body}` plus a
±5-minute window. **No `svix` dependency.** Read the raw body with `await req.text()` **first**,
before any parse, or the signed bytes are not the bytes that arrived.

State machine: a hard bounce → `bounced`; a soft bounce → suppress at 3
(`bounceCount >= 3`); a **spam complaint → terminal** (`complained`, never reversed). Look the
row up by `hashSubscriberEmail(payload.to)` — the same canonicalisation as the subscribe route
(FR-082). **Never persist the raw address.**

#### The budget, resolved (FR-048 to FR-054)

Resend's free tier is **100/day and 3,000/month**.

- `SUBSCRIBE_CONFIRM_RESERVE = 10` is the digest's set-aside for confirmations.
  `SUBSCRIBE_CONFIRM_DAILY_CAP = 50` is the hard stop on confirmations themselves.
- `remaining = min(DIGEST_DAILY_SEND_CAP, RESEND_DAILY_LIMIT − reservedCount[today] − SUBSCRIBE_CONFIRM_RESERVE)`
  — reading the constants, never a literal → **at most 90 a day**.
- **The daily cap binds; the monthly one does not.** 90 × 31 = 2,790, under 3,000. The monthly
  ceiling could be crossed only by consuming the full 100 every day of a 31-day month. The
  monthly sum is evaluated **per send batch**, not per digest, so a `sending` digest that
  crosses a month boundary is handled (FR-053).
- **Real capacity is about 270 recipients per weekly digest**, not 630: the send resumes for at
  most `DIGEST_RESUME_DAYS = 3` at 90 a day. Crossing it **pings the maintainer** rather than
  degrading into permanent partial sends (FR-054).
- **All dates come from the database's `current_date`** (FR-050). The schedule is Budapest and
  the provider quota resets UTC; one clock has to win, and this is it.
- `pg_advisory_xact_lock` wraps the draft → send transition so only one sender runs for a
  digest (FR-049). Follow the constitution's own idiom from Principle V: the magic number is a
  named constant in **one** file — add `SUBSCRIPTION_DIGEST_LOCK` beside `KPI_ROLLUP_LOCK` in
  `app/packages/db/src/locks.ts`.
- **Reconciliation is owned by the Phase 8 health step**: once a day it compares the ledger
  row's `reservedCount` against that same row's `sentCount` and pings on a gap over 10
  (FR-076). This is what `EmailSendLedger.sentCount` exists for; it is never used to bound
  capacity, and the comparison never reaches across to `Digest.sentCount`, which omits
  confirmations. That is the only way a reservation leak is ever detected.

The reserve and release SQL is in [`data-model.md`](./data-model.md).

#### The digest

**Short id** (FR-073): `randomBytes(6).toString('base64url')` → 8 characters, so `dg:a:{code}`
is 13 bytes against Telegram's 64-byte `callback_data` limit. The existing
`a:wc:{personId}.{articleId}` (`webhook/route.ts:575`) is the tight one, which is why
`WATCHLIST_ID_MAX = 22` is pinned by a test over `WATCH_LIST`. **Never put a uuid in new
`callback_data`.**

**Query**: one select over `SubscriberAlert` in the window with `revokedAt IS NULL`, re-filtered
at send (FR-061). Per-recipient filtering happens in application code on section membership and
`occurredAt > lastDigestCursorAt` (FR-062). **Exclude subscribers whose `confirmedAt` is later
than `Digest.draftedAt`** (FR-060) — a null cursor would otherwise deliver the entire frozen
set to a brand-new reader. **A digest send selects no `pending` row** (FR-094), and a test
proves it.

**Floor** (FR-057): `buildDigestDraft()` returns `null` unless it holds `DIGEST_MIN_ITEMS = 3`
items, **or** any `watchlist_removal` or `court_verdict`, **or** `DIGEST_REENGAGE_DAYS = 21`
have passed since the last send. When the injected spend gate refuses, it falls back to a
template body with a note that the summary was skipped, and **never returns `null` for a budget
reason** (FR-058). The spend gate is a constructor argument, so the test injects a refusing one.

**Review, not veto**: `dg:a` approve, `dg:x` discard, `dg:r` regenerate, capped at
`DIGEST_MAX_REGEN = 1` (FR-056).

#### The reply seam, which does not exist yet — and now has a second obstacle

The editor may reply to the approval message with corrected text (FR-068). Four rules, and the
fourth is new since the source plan was written.

1. **Store.** `digest-draft` writes `telegramMessageId` from `sendTelegramMessage`'s return
   (`telegram.ts:34-35`). **`dg:r` overwrites it** (FR-068), or a reply to the old message still
   matches.

2. **Match.** Extend the `TelegramUpdate` type at `webhook/route.ts:211-220`. Today its
   **`message`** member is only:

   ```ts
   message?: { chat: { id: number }; text?: string };
   ```

   It cannot carry the match. Add `message_id: number` and
   `reply_to_message?: { message_id: number }`. (The **`callback_query.message`** member at
   `:215` already has `message_id`; only the plain-message member is missing it.)

3. **Order — before `firstUrl`.** Put the corrected-text branch **before** the
   `firstUrl(msg.text)` call at `webhook/route.ts:707` (FR-069). **This ordering is a bug fix,
   not a style choice.** URL detection deliberately runs first — the comment at `:701-706`
   records a 2026-07-13 mis-parse where a slug containing "visszavonas" was read as a revoke
   command — and a corrected digest body *contains links to the site*. Leaving the order alone
   means an editor pasting a corrected digest gets it ingested as a news tip and answered with
   a five-button review keyboard.

4. **Order — also before the Social Post Outbox edit branch.** *Not in the source plan; this
   branch arrived on `main` after it was written.* `webhook/route.ts:653-698` already holds a
   text-reply branch that runs before `firstUrl`: while any `SocialPostOutbox` row has
   `pendingEdit` not null, **any** incoming text is consumed as that row's caption or image
   text. It matches on "the newest row with `pendingEdit` set" and does **not** look at
   `reply_to_message`. An editor who replies with corrected digest text while a social-post
   edit is pending would have the digest text silently saved as a Facebook caption.

   The digest branch matches on `reply_to_message.message_id`, which is exact, so **the exact
   match runs first**: insert the corrected-text branch immediately after the chat whitelist at
   `:642-645` and before the `pendingEdit` lookup at `:653`. A reply that matches no digest
   falls straight through to the existing `pendingEdit` and URL handling, unchanged (FR-070).

**Miss and late.** A reply matching no digest falls through unchanged, so genuine tips are not
swallowed (FR-070). A reply whose digest has left `awaiting_approval` gets a Hungarian "ez a
hírlevél már elment / már el lett vetve" and mutates nothing (FR-071). A corrected-text reply
**does** consume `regenCount`, on the same budget as `dg:r` — one rewrite, whichever mechanism
(FR-072).

#### Sending

`ORDER BY "lastDigestSentAt" NULLS FIRST, id` so the same tail is not last every week
(FR-063). `lastDigestSentAt` and `lastDigestCursorAt = Digest.periodEnd` are written **per
successful recipient**, not per batch (FR-064). A remainder moves the digest to `sending`,
resumed for at most `DIGEST_RESUME_DAYS` counted from `approvedAt`, after which the remainder
drops with a maintainer ping. A digest arriving on day three says so in its first line
(FR-067).

**A discard does not advance `lastDigestCursorAt`**, so the period is not lost (FR-065).
`expired` at `DIGEST_APPROVAL_EXPIRY_HOURS` applies only to `awaiting_approval`, **never** to
`sending` (FR-066), and `digest-send` performs that scan **before it does anything else**.

#### Scheduling

**The criterion, stated once, because a list invites the next author to over-generalise it:**

> Use `createBypassGuardedFunction` when the trigger is **cron alone**. Hand-roll the same
> guard when the function **also takes an event**.

The helper's `config` is `{ id, name, cron }` and it passes `{ cron: config.cron }` — one cron
trigger, no event, no array (`detector-runner.ts:24-40`). A function built with it can therefore
only ever fire on its schedule. The four functions here fall out of the criterion:

| Function | Trigger | Shape |
|---|---|---|
| `digest-draft` | cron alone | `createBypassGuardedFunction` |
| `digest-send` | `digest.send` event **and** cron | hand-rolled, `sync-facebook-posts.ts:239-247` shape |
| `subscriber-confirm-send` | `subscriber.confirm-send` event | hand-rolled, plain `inngest.createFunction` |
| `flush-alerts`, `subscription-health` | — | no Inngest twin at all; cron routes only |

**Why `digest-send` cannot be cron-only.** The editor taps `dg:a`, which sets
`status = 'approved'`; a cron-only sender then picks it up on its next scheduled run. An
approval at 10:00 would wait until the next morning, which to the editor is indistinguishable
from the button not working — and the health check would not catch it either, because its
24-hour condition is on `awaiting_approval` and the row has already left that state. Silent in
both directions, which is the failure mode this whole feature is designed against.

So the `dg:a` branch **emits `digest.send`** and answers the callback immediately. It does
**not** call `runDigestSendCore` inline: the webhook flushing a handful of Telegram posts inline
is fine, but a send to hundreds of recipients inside a callback handler risks the request timing
out while Telegram waits, and a timeout mid-send with ledger reservations already taken is
exactly the leak the Phase 8 reconcile exists to detect. The cron trigger stays, and catches
resumes and anything the event missed.

The editor needs feedback on the tap regardless of when the send runs. The `dg:a` branch keeps
the existing branch shape — `answerCallbackQuery`, then `editMessageReplyMarkup` to strip the
buttons and append an outcome line — with **"Kimehet — kiküldés folyamatban."** as that line.

**Every new event MUST be declared in the `Events` type at
`app/apps/web/src/inngest/client.ts`**, which is the typed source for `inngest.send`. Declare an
event only together with the function that consumes it; an event with no listener fires nothing
and looks like a working trigger.

`app/apps/web/src/inngest/functions/digest-draft.ts` uses the repo's
existing helper, **`createBypassGuardedFunction`**, defined at
`app/apps/web/src/inngest/lib/detector-runner.ts:24` and already used by all five article
detectors (`detect-resignations.ts:319`, `detect-verdicts.ts:344`, `detect-media-closures.ts:224`,
`detect-asset-recoveries.ts:232`, `detect-criminal-complaints.ts:243`). Its real signature:

```ts
export function createBypassGuardedFunction(
  config: { id: string; name: string; cron: string },
  core: (args: { step: BypassStep; logger?: BypassLogger }) => Promise<unknown>,
)
```

So each new function is two exports — the plain `…Core` body, and the guarded Inngest function:

```ts
export async function runDigestDraftCore({ step, logger }: { step: BypassStep; logger?: BypassLogger }) { … }

export const digestDraft = createBypassGuardedFunction(
  { id: 'digest-draft', name: 'Digest draft', cron: 'TZ=Europe/Budapest 5 7 * * 1' },
  runDigestDraftCore,
);
```

**Why the helper and not a hand-rolled guard, for `digest-draft`.** This is the established
house idiom for a **cron-only** Inngest function. Open-coding an `isBypassActive()` early return
would make it look deliberately different from five existing ones for no recoverable reason.

**What the helper already does, so do not repeat it in the `…Core` body:** it calls
`inngest.createFunction` with `concurrency: 1`; it performs the `isBypassActive()` check itself,
logs `"<id>: skipped — PIPELINE_BYPASS_INNGEST active, Vercel cron owns this run"` and returns
`{ skipped: 'inngest_bypass_active' }`; and it applies the `step as unknown as BypassStep` cast
that reconciles Inngest's `step` with the narrower `BypassStep` interface. The `…Core` body sees
a plain `{ step, logger }` and knows nothing about the bypass.

**Its one limit:** `config` takes a single `cron` string, so the helper fits a cron-only
function. A function that also takes an event cannot use it — which is why
`sync-facebook-posts.ts:239-247` (triggered by both `facebook.sync` and a cron) is hand-rolled.
`digest-send.ts` and `subscriber-confirm-send.ts` take events, so both are hand-rolled in that
same shape:

```ts
export const digestSend = inngest.createFunction(
  { id: 'digest-send', name: 'Digest send', concurrency: 1 },
  [{ event: 'digest.send' }, { cron: 'TZ=Europe/Budapest 5 7 * * 1' }],
  async ({ step, logger }) => {
    if (isBypassActive()) {
      logger?.info?.('digest-send: skipped — PIPELINE_BYPASS_INNGEST active, Vercel cron owns this run');
      return { skipped: 'inngest_bypass_active' };
    }
    return runDigestSendCore({ step: step as unknown as BypassStep, logger });
  },
);
```

Register all three new functions in `app/apps/web/src/inngest/index.ts` (91 lines, the `functions`
array begins at `:45`). `app/apps/web/app/api/cron/digest/route.ts` sits behind
`verifyCronRequest`, returns `{ skipped: 'bypass_not_active' }` when `isBypassActive()` is false,
and otherwise calls the exported `…Core` bodies with `makeBypassStep(name)` and `bypassLogger` —
exactly as `app/apps/web/app/api/cron/pipeline/route.ts:50-56` does for its seven steps. Add the
schedule to `subscriptions.yml`.

The two guards together — the helper's on the Inngest side, the route's on the Vercel side — are
what keep the work running **exactly once** per tick when both callers are live. That is the same
rule `cron-bypass.ts:15-20` states for the existing seven.

`flush-alerts` and `subscription-health` have **no Inngest twin** — they are cron routes only, so
the helper does not apply to them.

---

### Phase 8 — Health, and the GDPR pass

#### Why the watchdog is part of the feature

An unflushed row keeps `channelSentAt IS NULL` and the reader never learns the site published.
Sentry and Better Stack see thrown errors; **neither sees "nothing happened"**. The repository
learned this once already: `app/packages/db/src/llm-api-failure-alert.ts` exists because LLM
API failures were silent from 2026-07-12 until the maintainer noticed by hand on 2026-08-23 —
six weeks — and its own file header says so.

#### `app/apps/web/app/api/cron/subscription-health/route.ts`

Behind `verifyCronRequest`, called by `subscriptions.yml` (FR-074).

**Not hosted on `gdpr-retention-sweep.ts`.** That file is a bare `inngest.createFunction` with
no Actions and no Vercel caller, running on the scheduler that `src/lib/cron-bypass.ts:1-21`
records as having blown its quota three times, with mass "Invalid signature" 401s as the live
symptom. A watchdog for a silent-failure feature must not sit on the least reliable runner in
the repository.

It keeps the heartbeat and the daily ping marker in **two separate columns of the same row**,
and that separation is load-bearing. Every run upserts `lastRunAt`
(`ON CONFLICT (day) DO UPDATE`). A run that actually fires then claims the day's ping with
`UPDATE … SET "alertedAt" = now() WHERE day = current_date AND "alertedAt" IS NULL RETURNING day`,
and sends the Telegram message **only when that returns a row** — at most one ping a day
(FR-075). A single `DO NOTHING` marker cannot serve both: the unconditional heartbeat write
would claim the row first and the ping would never fire again that day. `lastReason` is
therefore nullable. The helper lives in `app/packages/db/src/subscription-health-alert.ts`; it
borrows the *shape* of `llm-api-failure-alert.ts:42-47`, not its single-statement form. It is a
**separate table** from `LlmApiFailureAlert`, because one row per day in a shared table would
let an LLM alert suppress a subscription alert.

It fires when **any** of these hold (FR-076):

| Condition | Threshold |
|---|---|
| The oldest `channelSentAt IS NULL` row is too old | `HEALTH_FLUSH_HOURS = 2` — **suppressed entirely while `TELEGRAM_PUBLIC_CHANNEL_ID` is unset** (FR-077), or the kill switch pings daily for as long as it is on |
| A `Digest` has sat `awaiting_approval` too long | `HEALTH_APPROVAL_HOURS = 24` |
| The last `sent` digest is older than cadence + 2 days | — |
| `EmailSendLedger.reservedCount` exceeds the same row's `sentCount` by more than 10 | the reservation-leak reconcile. **Both sides come from the ledger**, never from `Digest.sentCount` — the ledger's reservations include confirmations, which no `Digest` row ever counts, so a cross-table comparison fires every day the site gets signups. |
| **The heartbeat is stale** — the route has not run | `HEALTH_HEARTBEAT_HOURS = 26` |
| A `pending` subscriber older than `CONFIRM_EXPIRY_HOURS` with `confirmSentCount = 0` | the enqueued confirmation never sent. Beyond FR-076's five, because a stopped confirmation sender is invisible to all of them and is the silent failure closest to the reader. |

**The heartbeat is the only condition that catches the watchdog itself stopping** (FR-078), and
it must therefore not depend on the scheduler that runs the other four. It is a stored
timestamp the route writes on every run and compares against on the next — read as
`MAX("lastRunAt")` across all rows, never today's row alone, because the 26-hour threshold
deliberately spans a day boundary. When Actions stops
firing, the *next* run — whenever it happens, including a manual `workflow_dispatch` — reports
the gap. This is not theoretical: GitHub disables scheduled workflows after 60 days of
repository inactivity.

#### The abuse controls, and which of them are load-bearing

FR-096 promotes three from backstop to primary bound, because removing the challenge widget
removed the layer that used to stand in front of them. **No later stage may weaken any of the
three on the grounds that another layer covers it. No other layer covers it.**

1. **One confirmation message per address, ever** — unique `emailHash`, a
   `CONFIRM_COOLDOWN_MINUTES` cooldown, a cap of `CONFIRM_MAX_SENDS`, reset only on
   expiry-unused (FR-037).
2. **A hard global daily cap on confirmations** — `SUBSCRIBE_CONFIRM_DAILY_CAP = 50`, counted
   across every address, reserved ahead of the digest (FR-052).
3. **No reader-supplied text in a confirmation message. No name field on the form** (FR-080).
   This is what stops the confirmation message being used to carry an attacker's words to a
   third party.

Behind them: the honeypot (Phase 6), the per-address thresholds (Phase 6), the role-address and
disposable-domain refusal, the tombstone refusal, and the signup-burst ping (Phase 6).

**Double opt-in is what actually blocks the attack** (FR-094). A `pending` subscriber receives
**nothing** except its own confirmation message. No digest, no channel content, no other mail
is ever addressed to a row that is not `active`. So an attacker who submits other people's
addresses cannot make the site send those people bulk mail; the worst outcome is the bounded
set of confirmation messages that controls 1 and 2 cap at 50 a day, from a domain with no
sending reputation, with the editor pinged while it happens.

#### GDPR

- A **new pass in `app/apps/web/src/inngest/functions/gdpr-retention-sweep.ts`** named
  `subscriber-pii-purge`, added as a `step.run` alongside the existing `pii-purge` (`:34`),
  `orphan-scan` (`:81`), `stale-digest` (`:100`) and `partition-retention` (`:130`). **Note the
  name collision**: the existing `stale-digest` step is about the *detection digest*
  (`src/lib/detection-digest.ts`), nothing to do with this feature's `Digest` table. Do not
  extend it; add a separate step, and say so in a comment so the next reader does not merge
  them.
- The pass nulls `emailEnc`, `signupIpHash`, `confirmedIpHash` and `confirmTokenHash`, and
  **keeps `emailHash`, `status` and `consentTextVersion`** — the suppression marker and the
  Article 7(1) record (FR-086). The migration comment says so too.
- Unsubscription sets `purgePiiAt = now() + PURGE_DAYS` (30) (FR-085).
- `POST /api/admin/subscribers/erase` calls `hashSubscriberEmail`, sets `purgePiiAt = now()`,
  and writes an audit row with the address redacted (FR-087).
- `/hirlevel` and `/adatvedelem` state what is stored **including the IP hash**, the legal
  basis, the retention period and the erasure route (FR-084, FR-088). `signupIpHash` is
  pseudonymised personal data under Article 4(5), not anonymous data.
- **Do not** repair the pre-existing DSR gap. `app/apps/web/app/api/admin/dsr/route.ts` hashes the
  un-normalised address, so its hash space stays separate from `hashSubscriberEmail`'s. The
  spec puts it out of scope.

---

## Verification

### Automated — Vitest, `vi.mock('server-only')`, pure helpers, Inngest never executed

| # | Assertion | Requirement |
|---|---|---|
| V1 | An editor button from a foreign chat performs zero database calls; and with `TELEGRAM_CHAT_ID` unset, every button performs zero | FR-005 |
| V2 | `ALERT_ON_EDITOR_CONFIRM` is exactly `{asset_recovery, watchlist_removal}` | FR-008, FR-016 |
| V3 | Every `WATCH_LIST` id is ≤ `WATCHLIST_ID_MAX`; `Buffer.byteLength('dg:a:' + code) <= 64` | FR-073 |
| V4 | HMAC round-trip; a tampered token rejects; unequal lengths are guarded; no time expiry; a `_PREVIOUS` kid verifies; **an unknown kid rejects** | FR-039, FR-040 |
| V5 | `hashSubscriberEmail` normalises case and surrounding whitespace | FR-082 |
| V6 | `buildAlertDedupeKey` keys `watchlist_removal` on the person id and everything else on the record id | FR-015 |
| V7 | `buildDigestDraft` returns null below the floor, and **never** on a budget refusal (spend gate injected) | FR-057, FR-058 |
| V8 | `recordSubscriberAlert` returns normally when the injected db rejects the insert | FR-013 |
| V9 | `flushSubscriberAlerts` returns `{sent: 0}` with the channel id unset, and leaves every `channelSentAt` NULL | FR-022 |
| V10 | Both GET routes return byte-identical bodies for a valid, an expired and an invented token, apart from the nonce | FR-035 |
| V11 | `SECTION_LABELS_HU` covers six sections; every key of `TARGET_LABELS_HU` and of `DETECTOR_LABELS_HU` has a counterpart in it | FR-009 |
| V12 | Svix verification passes and fails on a fixture, and rejects a timestamp outside ±5 minutes | FR-055 |
| V13 | The subscribe route with a filled honeypot performs **zero** database calls and returns the generic failure text | FR-089, FR-095 |
| V14 | The digest recipient query selects no `pending`, `unsubscribed`, `bounced` or `complained` row | FR-094 |
| V15 | `subscribeIpLimiter` is exported from `ratelimit.ts` and the subscribe route imports **it**, not `pollVoteIpLimiter` | FR-093 |
| V16 | The corrected-text reply branch is evaluated before both `firstUrl` and the `pendingEdit` lookup | FR-069, FR-070 |
| V17 | Every message `digest-send` passes to `sendBatch` carries the RFC 8058 header set with both an `https:` and a `mailto:` value | FR-042, constitution v2.0.0 Principle III |

### Needs a live database — manual only

The dedupe unique index under a real race; confirmation-token expiry and single use; the
ledger's concurrent-reservation behaviour under two senders.

### Manual, against local Supabase

The numbered script is in [`quickstart.md`](./quickstart.md). Fifteen steps, of which four are
the ones that catch a silent failure: run two flushes concurrently and confirm exactly one
posts each row; GET the confirm link twice and then POST and confirm it still works; approve a
watchlist removal via `a:wc:` and confirm **one** alert, not two; and unset
`TELEGRAM_PUBLIC_CHANNEL_ID` and confirm the flush no-ops **and the health check stays quiet**.

**Step 15 comes before any real send**: mail one digest to a Gmail address and an Outlook
address and confirm inbox placement. It is last in the list and first in importance, because
delivery is the one-way step.

**Step 15 is itself a real send.** It writes a real recipient address into the provider's send
logs, so P3's ≤7-day retention setting must already be configured before this step runs — not
after it. See PR-2 → "P3's retention sub-condition".

### Chain

`pnpm lint → pnpm typecheck → pnpm test → pnpm build`, **run from `app/` across the whole
workspace** — this feature adds Vitest suites to `@korr/shared` (T056) and `@korr/db` (T058),
which a `--filter @korr/web` chain would not run — then browser verification of `/hirlevel`,
`/hirlevel/megerosites`, `/hirlevel/leiratkozas` and the home-page section at 375 px and
1440 px.

---

## Open items carried forward

Nothing in the spec lacks a mechanism. Three items are recorded for the maintainer rather than
for `/speckit.tasks`:

1. ~~**The constitution amendment for Resend** must land before Phase 7 merges.~~ **Landed
   2026-09-01 as constitution v2.0.0.** Nothing here is outstanding.
2. **This branch must be brought up to date with `main`** before implementation starts, or
   FR-089, FR-093, FR-095 and half of FR-068 have nothing to reuse.
3. **Set the provider's send-log retention to ≤7 days when the Resend account is created**
   (precondition P3), before any send including the inbox-placement test. If the plan in use
   does not permit configuring retention, that is a choice between a paid tier and a different
   provider, and it must be made **before the first send**, not after.
