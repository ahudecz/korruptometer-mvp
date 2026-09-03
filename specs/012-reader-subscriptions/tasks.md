# Tasks: Reader subscriptions — public Telegram channel and email digest

**Feature**: `012-reader-subscriptions`
**Input**: Design documents from `/specs/012-reader-subscriptions/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`

**Tests**: Test tasks are included. The spec and plan both name a required automated suite
(plan.md → Verification, V1–V16; the `C*` and `E*` tables in `contracts/`), so tests are part of
the work, not an option.

**Organisation**: Tasks follow the **plan's phase dependency graph**, not the requirement
numbering. Each phase carries the `[US#]` label of the user story it delivers.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — a different file, no dependency on an incomplete task
- **[Story]**: `[US1]`…`[US6]`, mapping to the six user stories in `spec.md`
- Every task names an exact file path

## Path conventions

The pnpm + Turborepo workspace root is `app/`. Paths below are absolute from the **repository**
root, so `app/` appears in them. Three of these paths are traps and are stated in full every
time they occur:

| Path | Why it is stated in full |
|---|---|
| `.github/workflows/` — **repository root** | `app/.github/workflows/ci.yml` exists and GitHub **never reads it**. A schedule placed there is a silent no-fire (FR-029). |
| `app/apps/web/src/lib/poll-validation.ts` | `checkHoneypot` lives here, inside `apps/web`, **not** in `@korr/shared`. Import it in place. **Do not move it** (research.md → R5). |
| `app/apps/web/src/inngest/functions/` | Every Inngest job file. There is no separate worker package (constitution Principle III). |

---

## ⛔ Blocking prerequisite — the maintainer's, not an agent's

### PR-1 — Bring this branch up to date with `main` before ANY task below starts

`012-reader-subscriptions` is based on `fe2630b`. `origin/main` is **22 commits ahead** and holds
the code this feature is required to reuse:

| Mandated for reuse | Lives at (on `origin/main`) | On this branch? |
|---|---|---|
| `checkHoneypot` (FR-089) | `app/apps/web/src/lib/poll-validation.ts:11-16` | **No** |
| The poll's post-Turnstile control stack (A11) | `app/apps/web/app/api/poll/vote/route.ts` | **No** |
| `pollVoteIpLimiter`, the shape to copy (FR-093) | `app/packages/shared/src/ratelimit.ts:79-86` | **No** |
| `callback_query.message.message_id` (FR-068) | `app/apps/web/app/api/telegram/webhook/route.ts:215` | **No** |
| The `SocialPostOutbox` `pendingEdit` branch (FR-069/FR-070) | `app/apps/web/app/api/telegram/webhook/route.ts:653-698` | **No** |

`app/apps/web/app/api/telegram/webhook/route.ts` is **1086 lines on this branch and 1287 on
`origin/main`**. **Every `file:line` anchor in this document is stated against `origin/main`.**

**No agent merges or rebases this branch.** A merge is the maintainer's call. Until it lands,
FR-089, FR-093, FR-095 and the `message_id` half of FR-068 have nothing to reuse, and every line
anchor below points at code the working tree does not contain.

---

## ⛔ Preconditions — performed by the maintainer, by hand, outside the repository

**These are NOT tasks. No task may be generated for them, and no agent may attempt them.** An
agent that tries will fail, and will then either block or report a success that did not happen.

| # | Action | Owner | Blocks |
|---|---|---|---|
| **P2** | Create the public Telegram channel, add the bot as an administrator, record the channel id | maintainer (manual) | Phase 4, Phase 5 |
| **P3** | Create the Resend account and the sending domain — **and set the provider's send-log retention to ≤ 7 days at account creation, before any send whatsoever, including the inbox-placement test**. If the tier in use cannot configure retention at all, stop and take it back to the maintainer as a choice between a paid tier and a different provider; after the first send that choice is already made | maintainer (manual) | Phase 7 |
| **P4** | Publish the DKIM records and the subdomain SPF record; publish DMARC at `p=none` | maintainer (manual) | Phase 7 |

P1 and P5 of the source plan are **withdrawn** with Turnstile (A11). Their identifiers are not
reused.

DNS has lead time. P2, P3 and P4 run in parallel with Phase 1 and cost no task.

**P3 has an ongoing half that IS a task**: the row in `app/docs/log-retention.md` and the
`checkResend()` addition to `app/scripts/audit-log-retention.ts` — T076 and T077. A precondition
is a one-time act with no enforcement; only the audit row puts it under recurring check.

---

## Dependency graph — taken from `plan.md`, not from requirement order

```
1  (origin guard — closes a live window, ships alone, no dependency)
2  (env + shared constants + exports map; P2/P3/P4 run in parallel from day one)
 └─ 3  (schema + migration 0053)
     ├─ 4 → 5     (channel, outbox, seam, gate, flush + workflow)  ← independently shippable
     └─ 6 → 7     (subscribe, provider, digest)
                   └─ 8  (health watchdog + GDPR)
```

**The two branches after Phase 3 are genuinely independent.** Phases 4–5 deliver the entire
channel promise with no personal data, no provider, no consent record and no unrecallable step.
Phases 6–7 deliver email. Neither entangles the other, and with two people they run at the same
time.

**Phase 8 hangs off Phase 7, not off Phase 3.** Four of the six conditions the route evaluates —
the five FR-076 conditions plus the sixth it adds beyond them — only become real once the digest
and the confirmation sender exist: a draft stuck at `awaiting_approval`, a last `sent` digest older
than its cadence, the ledger reconcile comparing `reservedCount` against the same ledger row's
`sentCount`, and a subscriber left `pending` with no confirmation ever sent. The GDPR pass joins Phase 8 for
the same reason: it purges columns that only carry data once Phase 6 writes them.

**One stated exception**: FR-079's signup-burst editor ping ships in **Phase 6, with the form**
(T041), never in Phase 8. With no challenge widget it is the only signal that tells a human a bot
run is under way.

---

## Phase 1: The `callback_query` origin guard (User Story 1, Priority P1) 🎯 ships first, alone

**Goal**: an editor button press acts only when it comes from the editor chat, so the same bot
can safely enter a public channel in Phase 4.

**Independent test**: press an editor button from a chat that is not the editor chat and see that
nothing in the database changes; then unset `TELEGRAM_CHAT_ID` and see that no button press
changes anything.

- [ ] T001 [US1] Add the chat-origin guard to the `callback_query` handler in `app/apps/web/app/api/telegram/webhook/route.ts`, immediately after the `if (!cq?.data || !cq.message)` early return at `:773-775`: read `process.env.TELEGRAM_CHAT_ID` into `allowedChatId` first, then `if (!allowedChatId || String(cq.message.chat.id) !== allowedChatId) return NextResponse.json({ ok: true });`. The `!allowedChatId` clause is load-bearing, not decoration — comparing against `process.env.TELEGRAM_CHAT_ID` directly compares against `undefined` when the variable is unset, which is always unequal and silently bricks every editor button with no way to tell why. This guard covers `v`, `k`, `d`, `a`, `r`, `n`, `s`, `a:wc:` and the `dg:*` set added in Phase 7 (FR-005).
- [ ] T002 [US1] Route-handler test in `app/apps/web/tests/api/telegram-webhook-origin-guard.test.ts` with `vi.mock('server-only')` and a stubbed `getDb()` that records every call: a button press whose `cq.message.chat.id` differs from `TELEGRAM_CHAT_ID` performs **zero** `getDb()` calls; with `TELEGRAM_CHAT_ID` unset, **every** button press performs zero (V1, FR-005).

**Checkpoint**: Phase 1 is complete and shippable on its own. It has no dependency on any other
phase and closes a window that is live today.

---

## Phase 2: Environment, shared constants and the exports map (Foundational — blocks Phases 3–8)

**Purpose**: the single section list FR-007 demands, the export entries without which the build
fails, and the environment variables every later phase reads.

**⚠️ No Phase 3–8 task may begin until this phase is complete.**

- [ ] T003 Create `app/packages/shared/src/sections.ts` exporting `SUBSCRIPTION_SECTIONS` (`['resignation','media_closure','court_verdict','criminal_complaint','asset_recovery','watchlist_removal'] as const`, in that storage order), the derived `SubscriptionSection` type, `SECTION_LABELS_HU`, `SECTION_URLS` and `CONSENT_TEXT_VERSION = '2026-09-01'`. It lives in `@korr/shared` and not in `@korr/db`, because the subscribe form is `'use client'` and `@korr/db`'s entry point is the Drizzle client. This file is the **only** place a section name is spelled (FR-007). `SECTION_URLS`: `resignation → /lemondasok`, `watchlist_removal → /lemondosok`, `media_closure → /megszunt`, `court_verdict → /birosagi-iteletek#birosagi-iteletek`, `criminal_complaint → /birosagi-iteletek`, `asset_recovery → /visszaszerzett-vagyon`. Only `resignation` has a detail page; `/birosagi-iteletek` carries exactly one anchor, on the verdict section (`app/apps/web/app/birosagi-iteletek/page.tsx:123`), which is why FR-031 makes the message text state which of the two it is. Hungarian labels drafted under the `hungarian-copy` skill (FR-006, FR-007).
- [ ] T004 [P] Add `"./sections": "./src/sections.ts"` to the `exports` map in `app/packages/shared/package.json`. The map has fourteen explicit entries and **no wildcard**, so an undeclared import fails at build time with no other symptom. (`"./email"` is added in T055, with the file it points at.)
- [ ] T005 [P] Re-export `sections` from `app/packages/shared/src/index.ts`, matching that file's existing habit.
- [ ] T006 [P] Change `TARGET_LABELS_HU` from `const` to `export const` in `app/apps/web/src/lib/notify-auto-publish.ts:31`. A two-character edit that changes no behaviour, needed so the FR-009 pinning test can read the map at runtime. **Do not re-derive this map from `SECTION_LABELS_HU`** — its wording is the editor's own notification text (`watchlist_removal` reads "Lemondásra felszólított — mandátum megszűnt"), and re-deriving would silently rewrite live editor messages as a side effect of a newsletter feature.
- [ ] T007 [P] Change `DETECTOR_LABELS_HU` from `const` to `export const` in `app/apps/web/src/lib/notify.ts:34`, for the same reason and under the same prohibition.
- [ ] T008 Pinning test in `app/apps/web/tests/lib/section-labels.test.ts`: `SECTION_LABELS_HU` covers exactly the six sections, and **every key** of `TARGET_LABELS_HU` and of `DETECTOR_LABELS_HU` has a counterpart in it. Derive the key sets from the objects at runtime, never from the TypeScript type — a type pins nothing at runtime (V11, FR-009).
- [ ] T009 [P] Add the new variables to `app/.env.example`: `TELEGRAM_PUBLIC_CHANNEL_ID`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`, `RESEND_LOG_RETENTION_DAYS_DECLARED=7`, `SUBSCRIBER_LINK_SECRET`, `SUBSCRIBER_LINK_SECRET_PREVIOUS`, `DIGEST_DAILY_SEND_CAP=90`, `SUBSCRIBE_CONFIRM_DAILY_CAP=50`, `SUBSCRIBE_CONFIRM_RESERVE=10`, `DIGEST_MIN_ITEMS=3`, `SUBSCRIBE_IP_DAILY_LIMIT=20`, `SUBSCRIBE_IP_HOURLY_LIMIT=3`, `NEXT_PUBLIC_SITE_URL`. In the same edit close three pre-existing gaps found while checking: the file declares `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` and `PII_ENC_KEY` at `:38-40` but declares **no** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` or `CRON_SECRET`, all three of which the running system already requires. Add them, empty. **Add no `NEXT_PUBLIC_TURNSTILE_SITE_KEY`** — Turnstile is withdrawn (A11), and a public site key for a widget that will never render is a trap for the next reader. **Add no `FLUSH_INTERVAL_MINUTES`** — the schedule lives only in the workflow, and a setting that cannot change behaviour is a trap.
- [ ] T010 [P] Add the same variable list to the `## Environment` section of `/home/attilah/Coding/corruption-tracker/CLAUDE.md`, under the existing groups.

**Checkpoint**: the section list, the export entries and the environment template are in place.
Phase 3 can begin.

---

## Phase 3: Schema and migration `0053` (Foundational — blocks Phases 4–8)

**Purpose**: the five tables, the four enums and the advisory-lock key that both branches need.

**⚠️ Both branches (4→5 and 6→7) are blocked on this phase.**

- [ ] T011 Append four pg enums and five tables to the bottom of `app/packages/db/src/schema.ts` (the file is 1757 lines). Enums: `subscription_section` (six members, **generated from `SUBSCRIPTION_SECTIONS`** so the enum and the form cannot drift), `subscriber_status` (`pending`, `active`, `unsubscribed`, `bounced`, `complained`), `digest_cadence` (`daily`, `weekly`), `digest_status` (`awaiting_approval`, `approved`, `sending`, `sent`, `discarded`, `expired` — **no `draft` member**; a digest is `awaiting_approval` from the moment it exists). Tables `Subscriber`, `SubscriberAlert`, `Digest`, `EmailSendLedger`, `SubscriptionHealthAlert`, column for column and index for index as specified in `data-model.md`. **One deliberate override of `data-model.md` for `SubscriptionHealthAlert`**, because the table as drawn there silences the watchdog: `lastReason` is **nullable**, not `NOT NULL`, and a fourth column `alertedAt timestamptz` is added. The heartbeat (`lastRunAt`) and the once-a-day ping marker (`alertedAt`) must be two independent fields on the row, or the unconditional heartbeat write claims the day's row and the `ON CONFLICT (day) DO NOTHING` ping never fires again that day. Member order is storage order and is **not** alphabetised (FR-006).
- [ ] T012 Write `app/supabase/migrations/0053_reader_subscriptions.sql` matching T011 exactly. `0053` is the next free number (`app/supabase/migrations/` holds `0048`–`0052`). **Applied by hand**, like `0048`–`0052` — `supabase migration up` does not work in this repo. **No `-- ROLLBACK` block**: none of the 58 existing migrations has one, and `app/docs/migrations.md:65` documents roll-forward-or-restore as the policy instead. The header carries the two Hungarian paragraphs verbatim from `data-model.md` → "Migration header": the A8 price of the enum (a seventh section costs **two migrations, forever**, because `ALTER TYPE … ADD VALUE` cannot run in the same transaction as a use of the new value) and the FR-086 note that the retention pass deliberately keeps `emailHash`, `status` and `consentTextVersion`. Add a third Hungarian header paragraph recording why `SubscriptionHealthAlert` carries both `lastRunAt` and `alertedAt`: a szívverés minden futásnál íródik, a napi egyszeri riasztás-jelölő viszont csak akkor, amikor tényleg ment üzenet — egy mezőben a kettő kioltaná egymást. Purely additive — five tables, four enums, no drop, no rename, no `NOT NULL` on a backfilled column (constitution Principle VII).
- [ ] T013 [P] Add `export const SUBSCRIPTION_DIGEST_LOCK = <a fresh, previously unused BigInt>;` beside `KPI_ROLLUP_LOCK` in `app/packages/db/src/locks.ts`, following that file's own header rule. Constitution Principle V: the magic number lives in exactly one file.

**Checkpoint**: schema ready. **Phases 4–5 and Phases 6–7 can now proceed in parallel.**

---

## Phase 4: The public channel sender and the alert outbox (User Story 2, Priority P1)

**Goal**: every newly published item in the six sections becomes one outbox row, and one module
can post plain text to a public channel with no structural way to attach a button.

**Independent test**: record an alert, run the flush, and see one plain-text channel message with
a working link; unset `TELEGRAM_PUBLIC_CHANNEL_ID` and see zero posts with every row still
claimable.

- [ ] T014 [US2] Extract `sendTelegramMessageTo(chatId: string, text: string, replyMarkup?: InlineKeyboardMarkup): Promise<number | null>` in `app/apps/web/src/lib/telegram.ts`, and make the existing `sendTelegramMessage(text, replyMarkup?)` (`:22-36`) a delegate that passes `process.env.TELEGRAM_CHAT_ID`. **`replyMarkup` is argument 2 at roughly 40 call sites**, so a third parameter on the existing function would be a trap; the new function takes the chat id first. **Preserve the existing `return result.message_id ?? null` (`:34-35`) through the delegate** — the Phase 7 digest reply seam depends on it.
- [ ] T015 [US2] Create `app/apps/web/src/lib/telegram-public.ts` exporting `sendPublicChannelMessage(text: string): Promise<number | null>`. It reads `TELEGRAM_PUBLIC_CHANNEL_ID` and, **when unset, returns `null` without a network call — the working kill switch** (FR-022). It **takes no `replyMarkup` parameter at all**, so an approve/reject keyboard is structurally unable to reach a public audience (FR-021). Plain text, no `parse_mode`. Declare `TELEGRAM_CHANNEL_RATE = 20` (per minute) here as a named constant, never a literal (FR-026, FR-020).
- [ ] T016 [P] [US2] Create `app/apps/web/src/lib/notify-subscribers.ts` with `recordSubscriberAlert(input)`, `revokeSubscriberAlert(dedupeKey)`, and the two pure exported helpers `buildAlertDedupeKey(section, id)` and `formatAlertMessageHu(row)`. Same contract as `notify-auto-publish.ts`: **returns normally when the database rejects the insert, and never fails a caller's step** (FR-013), and performs **no Telegram network call on the caller's path** (FR-014). `recordSubscriberAlert` is one `insert(...).onConflictDoNothing({ target: dedupeKey })`. `revokeSubscriberAlert` sets `revokedAt = now()` where it is still null. `buildAlertDedupeKey` returns `${section}:${entityId}` **except for `watchlist_removal`, which keys on the person id** (FR-015). For `watchlist_removal` the stored `entityId` column is **the person id too**, not the removal row id — the column is `NOT NULL` and the dedupe key is derived from it, so the two must agree or a revert cannot rebuild the key that was written. T028 and T029 both pass the person id. `formatAlertMessageHu` builds the plain-text body from `SECTION_LABELS_HU`, `title`, `detail` and `SECTION_URLS`, and **states which of verdict or complaint it is**, because both link to `/birosagi-iteletek` and only the verdict section has an anchor (FR-030, FR-031). Hungarian copy drafted under the `hungarian-copy` skill (FR-012).
- [ ] T017 [US2] Add `flushSubscriberAlerts({ max = FLUSH_BATCH_SIZE })` returning `{ sent, remaining }` to `app/apps/web/src/lib/notify-subscribers.ts`, with `FLUSH_BATCH_SIZE = 20` declared there. Order, and it is the order that matters: (1) `TELEGRAM_PUBLIC_CHANNEL_ID` unset → return `{ sent: 0, remaining: 0, paused: true }` **before any statement runs**, so every `channelSentAt` stays NULL (FR-022); (2) loop at most `max` times, and on each pass **claim exactly one row** with the `data-model.md` statement at `LIMIT 1`; (3) **post that row**, then pause to stay under `TELEGRAM_CHANNEL_RATE` before the next pass; (4) a **429** from Telegram breaks the loop, and every row not yet claimed is still `channelSentAt IS NULL`, so the next scheduled run resumes from them (FR-027). **Claim one, post one — never claim the batch and then post it.** A batch claim marks all twenty rows sent and then loses every row after the failure point: up to nineteen alerts gone with no error, where FR-024 bounds the loss at **one** ("MUST lose *that* alert"). The per-row claim keeps the atomic-claim guarantee of FR-023 intact — two concurrent runs still cannot select the same row, because `FOR UPDATE SKIP LOCKED` is per statement — while making the crash-and-refusal loss exactly the one alert FR-024 allows. `channelSentAt` is written **by the statement that selects the row, never by a later `UPDATE`** (FR-023) — the deliberate trade FR-024 records: a missed alert is recoverable by the next publication, a duplicate public post is not recallable at all.
- [ ] T018 [P] [US2] Test in `app/apps/web/tests/lib/telegram-public.test.ts`: with `TELEGRAM_PUBLIC_CHANNEL_ID` unset, `sendPublicChannelMessage` returns `null` and performs no `fetch`; the exported function's arity admits no `replyMarkup` argument (FR-021, FR-022).
- [ ] T019 [P] [US2] Tests in `app/apps/web/tests/lib/notify-subscribers.test.ts`: `buildAlertDedupeKey` keys `watchlist_removal` on the person id and everything else on the record id (V6); `recordSubscriberAlert` returns normally when the injected database rejects the insert, and never throws (V8); `flushSubscriberAlerts` returns `{ sent: 0 }` with the channel id unset and issues **no** UPDATE, leaving every `channelSentAt` NULL (V9, C2); `formatAlertMessageHu` names verdict versus complaint distinctly and emits the right URL per section (FR-030, FR-031).

**Checkpoint**: the outbox and the channel sender exist and are unit-tested. Nothing writes to
the outbox yet — that is Phase 5.

---

## Phase 5: The editor-confirm gate, the six call sites, the flush route and the workflow (User Story 2, Priority P1)

**Goal**: complete User Story 2 — publication writes an alert, revocation revokes it, and a
schedule GitHub actually reads posts it.

**Independent test**: publish one item through each of the six paths, run the flush, and see one
message per item with no duplicates; revert one before the flush and see no message for it.

- [ ] T020 [US2] Declare `export const ALERT_ON_EDITOR_CONFIRM: ReadonlySet<AutoPublishTarget> = new Set(['asset_recovery', 'watchlist_removal']);` in `app/apps/web/src/lib/notify-auto-publish.ts`, beside the `AutoPublishTarget` union at `:19`. That union is `'court_verdict' | 'asset_recovery' | 'watchlist_removal'` — a different, three-value type from `SubscriptionSection`. This is the **one** carve-out FR-008 permits from FR-007 (FR-016).
- [ ] T021 [P] [US2] Pinning test in `app/apps/web/tests/lib/alert-on-editor-confirm.test.ts`: the set is exactly `{asset_recovery, watchlist_removal}` — assert both membership and size, so an added member fails (V2, FR-008, FR-016).
- [ ] T022 [P] [US2] Call site 1 — record a `court_verdict` alert in `app/apps/web/src/inngest/functions/detect-verdicts.ts:307` on the auto-publish path (the insert is at `:246`). Court verdicts are **not** gated (A2): the revert window is the flush interval, because a detector insert does not flush inline, and a delayed scheduled run only lengthens that window, which is the safe direction (FR-018).
- [ ] T023 [P] [US2] Call site 2 — record a `resignation` alert in `app/apps/web/src/inngest/functions/detect-resignations.ts`, after the insert at `:226` (FR-018).
- [ ] T024 [P] [US2] Call site 3a — record a `media_closure` alert at the insert in `app/apps/web/src/inngest/functions/detect-media-closures.ts:159` (FR-018).
- [ ] T025 [P] [US2] Call site 3b — record a `criminal_complaint` alert at the insert in `app/apps/web/src/inngest/functions/detect-criminal-complaints.ts:147` (FR-018).
- [ ] T026 [US2] Call site 4 — record alerts in the `a` approve branch of `app/apps/web/app/api/telegram/webhook/route.ts`, via `outcome.recordId` / `outcome.recordIds` (see `:617` and `:1264`). It covers **five** of six sections, not six: `watchlist_removal` is absent from both `DETECTOR_PROCESSORS` (`app/apps/web/src/lib/telegram-review-actions.ts:614`, exclusion comment at `:624`) and `setPendingStatus` (`webhook/route.ts:459`) (FR-018).
- [ ] T027 [US2] Call site 5 — record an alert in the `v`/`k` branch of `app/apps/web/app/api/telegram/webhook/route.ts:787`, **guarded by `ALERT_ON_EDITOR_CONFIRM`** so only the `k` ("✅ OK, marad") press alerts, covering `asset_recovery` and `watchlist_removal` (FR-016). **Not call sites**: `detect-asset-recoveries.ts:169` and `detect-watchlist-removals.ts:169` — both notify on an automatic insert, and FR-016 says those two sections alert only after an editor acts (FR-018).
- [ ] T028 [US2] Call site 6 — record a `watchlist_removal` alert in the `a:wc:` branch of `app/apps/web/app/api/telegram/webhook/route.ts:1036`, at the `applyWatchlistRemoval(person, article, checked.check)` call, **ungated**. **This is the highest-value fix in the phase**: `applyWatchlistRemoval` (`app/apps/web/src/lib/telegram-review-actions.ts:690`) calls no `notifyAutoPublished`, is not in `DETECTOR_PROCESSORS`, and is not a detector insert, so call sites 1–5 all miss it while it writes two live rows. It is ungated because the `a:wc:` button press **is** the human gate (A1). **One** alert, keyed on the person; the paired resignation row produces **none** (FR-017, FR-018).
- [ ] T029 [US2] Wire `revokeSubscriberAlert()` into **both** delete paths (FR-019). Path 1 — the `v` branch at `app/apps/web/app/api/telegram/webhook/route.ts:790`, whose delete at `:810` **already returns the person id** via `.returning({ personId, sourceUrl })`; reuse it. Path 2 — `deleteByCode()` at `app/apps/web/app/api/telegram/webhook/route.ts:201-209`, which returns nothing today: **add `.returning({ personId: schema.watchlistRemovals.personId })` to its watchlist branch**, then build the dedupe key from it. The `watchlist_removal` key needs the **person** id, not the row id, because `applyWatchlistRemoval` uses `onConflictDoUpdate({ target: personId })` — a re-tap or a revert-then-redetect would otherwise alert twice for one person (FR-015).
- [ ] T030 [US2] Create `app/apps/web/app/api/cron/flush-alerts/route.ts` with `export const dynamic = 'force-dynamic'`, `runtime = 'nodejs'`, `maxDuration = 300`. **60 seconds is not enough and the arithmetic is not close**: `FLUSH_BATCH_SIZE = 20` messages paced at `TELEGRAM_CHANNEL_RATE = 20/min` is nineteen 3-second pauses ≈ 57 s before a single network round trip is counted. A 60-second ceiling kills the run mid-batch, and a truncated flush is silent — no error, no log, no retry — which is the same failure FR-028 rejects the pipeline route for. `subscriptions.yml` already allows it: its `curl` uses `-m 280`. The route sits behind `verifyCronRequest` from `app/apps/web/src/lib/cron-bypass.ts:67-71` (`Boolean(secret) && authHeader === 'Bearer ' + secret`), returning 401 without it. It calls `flushSubscriberAlerts({ max: FLUSH_BATCH_SIZE })` and responds `{ sent, remaining, paused }`. Match the four existing routes under `app/apps/web/app/api/cron/`. **It is NOT appended to `app/apps/web/app/api/cron/pipeline/route.ts`** (FR-028): that route runs seven sequential steps — a scraper plus six LLM detectors — under `maxDuration = 300` with no per-step budget, so a flush appended last is the step most likely to be silently truncated, and silent truncation is this feature's signature failure mode. `flush-alerts` has **no Inngest twin**; it is a cron route only.
- [ ] T031 [P] [US2] Create `/home/attilah/Coding/corruption-tracker/.github/workflows/subscriptions.yml` — **at the REPOSITORY ROOT**, never at `app/.github/workflows/`, which GitHub never reads (FR-029). Copy `.github/workflows/hourly-pipeline.yml` exactly: same `curl` shape, same `Authorization: Bearer ${{ secrets.CRON_SECRET }}` header, same non-200 `::error::` exit, same base URL `https://www.kegyencjarat.hu`. `CRON_SECRET` is an existing repository secret; no new secret is needed. Create it here with **the flush job only** — the digest schedule lands in T073 and the health schedule in T080, so Phases 4–5 ship complete. Include `on.schedule` with `- cron: '*/15 * * * *'` (FLUSH_CRON) and a **`workflow_dispatch` that can reach every endpoint**, not only the flush:

  ```yaml
  on:
    schedule:
      - cron: '*/15 * * * *'        # FLUSH_CRON
    workflow_dispatch:
      inputs:
        target:
          description: 'Melyik cron-végpontot hívjuk'
          type: choice
          options: [flush-alerts, digest, subscription-health]
          default: flush-alerts
  ```

  **This is load-bearing for FR-078**, not convenience: the heartbeat is the only condition that detects the watchdog stopping, and the recovery story is that *the next run, including a manual dispatch, reports the gap*. A dispatch hard-wired to `flush-alerts` can never run the health route, so that recovery path would not exist. Also create the `case` dispatch block here, with one schedule arm plus the dispatch arm, so T073 and T080 have an arm to add to:

  ```bash
  case "${{ github.event.schedule }}" in
    '*/15 * * * *') path=/api/cron/flush-alerts ;;
    *)              path=/api/cron/${{ inputs.target || 'flush-alerts' }} ;;
  esac
  ```

  Add a concurrency block **keyed on the schedule, not on the file**:

  ```yaml
  concurrency:
    group: subscriptions-${{ github.event.schedule || github.event.inputs.target || 'dispatch' }}
    cancel-in-progress: false
  ```

  `cancel-in-progress: false` is one of the two required defences against a duplicate public post (FR-025); the database claim in T017 is the other. **The group must carry the schedule.** A workflow-level `group: subscriptions-flush` would put the 15-minute flush, the weekly digest and the daily health check in one queue: GitHub keeps one running plus one pending per group and cancels the older pending run, so a digest or health run that lands while a flush is in flight is cancelled by the next flush tick within 15 minutes — a silent no-fire of both the mailing and the watchdog, which is the FR-029 failure class arriving through the FR-025 defence. Carry the Hungarian header comment from `contracts/cron-endpoints.md` explaining why the file is at the root.
- [ ] T032 [P] [US2] Repository-shape test in `app/apps/web/tests/lib/workflow-location.test.ts`: `.github/workflows/subscriptions.yml` exists at the repository root and **no** `subscriptions.yml` exists under `app/.github/workflows/`. This test exists because the failure is otherwise completely invisible — no error, no log, no run (C12, FR-029).
- [ ] T033 [P] [US2] Route test in `app/apps/web/tests/api/cron-flush-alerts.test.ts`: the route returns 401 without the `Authorization: Bearer $CRON_SECRET` header (C1), and with `TELEGRAM_PUBLIC_CHANNEL_ID` unset returns `{ sent: 0 }` and issues no UPDATE (C2).
- [ ] T033a [P] [US2] Test in `app/apps/web/tests/api/telegram-webhook-revoke.test.ts`: the `v` branch revokes the alert built from the `personId` its delete already returns, and `deleteByCode()`'s watchlist branch revokes using the `personId` added to its `.returning()` in T029; a revoked row is excluded by the flush claim predicate and by the digest's send-time re-filter (FR-019, FR-061). Revocation is the only thing standing between a reverted item and an unrecallable public post, and it is currently covered by manual step 11 alone.

**Checkpoint**: **User Story 2 is complete and independently shippable.** The channel promise
works end to end with no personal data, no email provider, no consent record and no unrecallable
step. Deploy here if you want the channel before the email half.

---

## Phase 6: Subscribe, confirm, unsubscribe (User Story 3, Priority P2)

**Goal**: a reader gives an address, picks sections, and can leave from any message in one click.
Every page and message is Hungarian, no plain page request mutates, and the abuse controls that
replace the removed challenge widget are in place.

**Independent test**: subscribe with a test address, confirm from the message, unsubscribe from a
link; check the stored address is encrypted, the consent record is present, and no plain page view
changed a stored value; then submit once with the honeypot filled and see it refused with no
database write.

**Note on this phase's scope.** The subscribe route **enqueues** the confirmation job; the job
itself and the email wrapper it needs land in Phase 7 (T054, T060). Phase 6 alone is therefore
shippable **only with `RESEND_API_KEY` unset**, which is exactly the paused state FR-044 specifies
— the reader is told in Hungarian that subscription is paused, and no false success is returned.

- [ ] T034 [US3] Create `app/apps/web/src/lib/subscriber-crypto.ts` with `hashSubscriberEmail(raw)` = `sha256(raw.trim().toLowerCase())` — **one canonicalisation**, used by the subscribe route, the erase route and the provider webhook (FR-082) — plus `signUnsubToken(subscriberId)` and `verifyUnsubToken(token)`, and the three confirmation constants the route and the sender both need: `CONFIRM_EXPIRY_HOURS = 24`, `CONFIRM_COOLDOWN_MINUTES = 15` and `CONFIRM_MAX_SENDS = 3`. They live here rather than in the route, because `feliratkozas/route.ts` reads the cooldown while `subscriber-confirm-send.ts` enforces the cap, and neither may import the other. Signed bytes are the UTF-8 of `unsub:v1:{kid}:{subscriberId}` and nothing else: no URL, no query string, no trailing newline. Token is `base64url(payload) + "." + base64url(hmacSha256(secret, payload))`. Verification splits on the **last** `.`, decodes, parses the kid from the payload's third field, selects **that** key (`SUBSCRIBER_LINK_SECRET` signs and verifies; `SUBSCRIBER_LINK_SECRET_PREVIOUS` verifies only), length-checks both MAC buffers, then `crypto.timingSafeEqual`. **An unknown kid rejects — never fall through to trying every key** (FR-039). **No time expiry in the signature** (FR-040): a delivered message must stay usable for as long as it sits in an inbox. `SUBSCRIBER_LINK_SECRET` is a **distinct secret from `PII_ENC_KEY`** with a distinct rotation schedule (FR-041) — deliberately **not** the `INTERNAL_REVALIDATE_SECRET ?? PII_ENC_KEY` fallback pattern used at `app/apps/web/app/api/admin/submissions/[id]/audit-pii-read/route.ts`, because a fallback that silently reuses the encryption key as a signing key defeats FR-041.
- [ ] T035 [US3] Add the address-refusal helper to `app/apps/web/src/lib/subscriber-crypto.ts`: a pure exported predicate refusing role addresses (`info@`, `admin@`, `postmaster@`, `noreply@`, …) and disposable domains (FR-045). It works on the input, never on a stored column — `emailDomain` was dropped from the source design because it had no reader (research.md → R18).
- [ ] T036 [US3] Declare and export five new limiters from `app/packages/shared/src/ratelimit.ts`, each built from the module-private `getOrCreate` factory at `:58-62`: `subscribeIpHourLimiter()` (prefix `subh`, `SUBSCRIBE_IP_HOURLY_LIMIT ?? 3` per hour), `subscribeIpLimiter()` (prefix `subd`, `SUBSCRIBE_IP_DAILY_LIMIT ?? 20` per day), `confirmTokenLimiter()` (prefix `cfmt`, 5 per **token id** per hour), `confirmIpLimiter()` (prefix `cfmi`, 60 per IP per hour) and `subscribePageLimiter` (prefix `subpg`, 240 per IP per hour). **A route must not build a bespoke limiter**: the factory is module-private and is the only path carrying the in-memory fallback for an environment with no Upstash (`:39-56`), so a bespoke limiter would silently fail open in every local and preview environment (FR-093). **Do not import `pollVoteIpLimiter`** — it is `POLL_VOTE_IP_DAILY_LIMIT ?? 75` at `:83-86`, seventy-five attempts per IP per day, deliberately loose because the poll's *primary* control is a per-browser cookie and the threshold must not collide with shared NAT. The subscribe form inherits neither that cookie nor Turnstile, so reusing it would make a threshold tuned for generosity the outermost control on a **mail-sending** endpoint. The per-token key is required because a shared corporate egress address defeats a per-address key (FR-046).
- [ ] T037 [US3] Fix the now-false comment on `pollVoteIpLimiter` at `app/packages/shared/src/ratelimit.ts:79-82`. Its last sentence still reads "A tényleges bot-védelmet a Turnstile adja, nem ez a szám." Commit `d5f66a9` (2026-08-31) removed Turnstile from the voting flow and left the line behind, so it is false on `main` in the most damaging direction — the next reader, including this feature's reviewer, is told a control is protecting them that no longer exists. Rewrite it to what is true now for the poll: the browser cookie is the primary control, the IP threshold is the secondary net, and **since `d5f66a9` there is no third layer**. **Do not let the rewrite imply the poll is as protected as it was.** It is not, and that is the maintainer's accepted trade (A11), not something to paper over. Add one sentence pointing at `subscribeIpLimiter` and saying it is deliberately separate and deliberately tighter. Hungarian comment, under the `hungarian-copy` skill. This task has no FR of its own; it is mandated by `plan.md` → the section "The stale comment at `ratelimit.ts:82` — fix it while implementing FR-093", and it is in scope because T036 edits the same file for FR-093.
- [ ] T038 [US3] Tests in `app/apps/web/tests/lib/subscriber-crypto.test.ts`: HMAC round-trip; a tampered payload rejects; a tampered MAC rejects; unequal MAC lengths are guarded before `timingSafeEqual`; a `_PREVIOUS` kid verifies; **an unknown kid rejects and no other key is tried**; no time expiry is enforced (V4, FR-039, FR-040). `hashSubscriberEmail` normalises case and surrounding whitespace (V5, FR-082). The refusal predicate refuses a role address and a disposable domain and admits an ordinary one (FR-045).
- [ ] T039 [P] [US3] Declare `'subscriber.confirm-send': { data: { subscriberId: string } }` in the `Events` type in `app/apps/web/src/inngest/client.ts`. That type is the typed source for `inngest.send`, and an undeclared event will not typecheck. Its consumer lands in T060, **one phase later**, which is the single exception to the rule T059 states. It is safe only while `RESEND_API_KEY` is unset, because T040's paused branch returns 503 before the enqueue. Setting that key with Phase 7 unshipped produces a 201 and no mail — a silent success — so the key stays unset until T060 ships.
- [ ] T040 [US3] Create `app/apps/web/app/api/hirlevel/feliratkozas/route.ts` (POST, `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`) in the **cheapest-first order FR-095 mandates**: (1) `checkHoneypot(body.website)` imported **in place** from `app/apps/web/src/lib/poll-validation.ts` — **do not move that helper into `@korr/shared`**; "shared" in FR-089 means one implementation, not one package, and moving it would edit the poll vote route, which is not this feature's to change (research.md → R5). A filled honeypot returns `400 { error: "A beküldés nem sikerült." }` — the **same generic text an invalid submission returns**, so a bot learns nothing about which check refused it — with **zero database calls**. (2) `subscribeIpHourLimiter()`, then (3) `subscribeIpLimiter()`, each `429`. (4) Zod: address shape, `sections` non-empty with every member in `SUBSCRIPTION_SECTIONS`, `cadence` **restricted to `'weekly'`** — the enum carries `daily` because A6 keeps the data model open, but the only draft schedule is `5 7 * * 1`, so a `daily` row would match no digest the sender ever builds and that reader would receive nothing, for ever, with no error and no health condition to catch it. Accept `'weekly'`, or accept an absent field and default it. **A `daily` value is rejected with the ordinary validation failure until a daily draft schedule exists.** (5) The role-address and disposable-domain refusal from T035. (6) `RESEND_API_KEY` unset → `503 { paused: true, message: "A feliratkozás átmenetileg szünetel." }` — a distinct response, **never** a false 201 (FR-044). Steps 1–6 perform **no database read and no database write**. Then: (7) `hashSubscriberEmail`; (8) look up by `emailHash` and branch — an erased tombstone sends nothing, an `active` row updates `sections` and `cadence` **in place** and sends nothing (FR-090), a `pending` row inside `CONFIRM_COOLDOWN_MINUTES` of its `confirmLastSentAt` sends nothing (FR-090) — that column is written by the confirmation sender (T060), and the cooldown is measured from it, never from `createdAt`, a `complained` row sends nothing; (9) otherwise insert or revive, writing `emailEnc` via `encryptPii` (`app/packages/shared/src/encryption.ts:24`), `emailHash`, `sections`, `cadence`, `consentTextVersion = CONSENT_TEXT_VERSION`, `signupIpHash`, `status = 'pending'`; (10) `inngest.send({ name: 'subscriber.confirm-send', data: { subscriberId } })` — **no provider call on the request path**; (12) an `AuditLog` row with `action = 'subscriber.subscribe'`, `entityType = 'Subscriber'` and `detail = { sections, cadence, emailHashPrefix }` — **no address in readable form** (FR-091). Every non-paused branch returns the **same** `201 { ok: true, message: "Elküldtük a megerősítő levelet. Nézd meg a postaládád." }` (FR-043). Residual, stated and not hidden (A10): the tombstone branch is one SELECT and the new branch is a SELECT, an INSERT and an enqueue, so keeping the network call off the request path narrows the timing oracle without making the route constant-time. Import `CONFIRM_COOLDOWN_MINUTES` and `CONFIRM_MAX_SENDS` from `app/apps/web/src/lib/subscriber-crypto.ts` (T034). Declare `SIGNUP_BURST_THRESHOLD = 10` here as a named constant (FR-032, FR-033).
- [ ] T041 [US3] Add step 11, the signup-burst editor ping, to `app/apps/web/app/api/hirlevel/feliratkozas/route.ts`: count subscriptions sharing this `signupIpHash` in the last hour and, over `SIGNUP_BURST_THRESHOLD = 10`, ping the editor chat (FR-079). **It ships here, with the form, not in Phase 8** — with no challenge widget it is the only signal that tells a human a bot run is under way. It uses **its own hourly marker and never the health check's daily one** (FR-075, FR-079), or one stall condition would suppress the abuse signal for the rest of that day. The plan does not settle the marker's mechanism: use a one-per-hour limiter keyed `burst:{signupIpHash}` from the same `getOrCreate` factory as T036, which adds no table and reuses the in-memory fallback; record the choice in a code comment.
- [ ] T042 [US3] Create `app/apps/web/app/api/hirlevel/megerosites/route.ts` with GET and POST. **The GET mutates nothing, ever** (FR-034), and is rate-limited by `subscribePageLimiter`. The POST order: `confirmTokenLimiter()`, `confirmIpLimiter()`, `sha256(token)`, look up by `confirmTokenHash`, reject when the hash is null, unknown or `confirmTokenExpiresAt` has passed, then set `confirmedAt = now()`, `confirmedIpHash`, `status = 'active'` and `confirmTokenHash = NULL` (single use, FR-036), then an `AuditLog` row `action = 'subscriber.confirm'`. Responses exactly as the table in `contracts/subscription-api.md`, with **unknown or tampered identical to expired**. **Why the GET must not mutate**: SafeLinks, Proofpoint and Mimecast GET every link on delivery, so a single-use token consumed on GET is burned before the reader ever clicks, and the `CONFIRM_MAX_SENDS` cap then locks that address out permanently and silently (FR-033, FR-083).
- [ ] T043 [US3] Create `app/apps/web/app/api/hirlevel/megerosites/ujra/route.ts` (POST) for "Küldj újat", reachable only from the expired state and sharing the `confirmIpLimiter` budget. It **resets `confirmSentCount` to 0** when the previous token expired unused, then enqueues a new confirmation (FR-037). Without the reset the cap of 3 collides with the 24-hour expiry and locks out anyone who reads their mail the following evening.
- [ ] T044 [US3] Create `app/apps/web/app/api/hirlevel/leiratkozas/route.ts` with GET and POST. **The GET mutates nothing, ever** (FR-034), rate-limited by `subscribePageLimiter`. **RFC 8058 does not protect this route** — 8058 covers only the `List-Unsubscribe-Post` header URL, never the body link a human clicks. The POST accepts **both** caller shapes, the reader's `{ "t": "<token>" }` from the page form and the mail client's one-click POST carrying the token in the query string with a `List-Unsubscribe=One-Click` body. Order: `confirmTokenLimiter()`, `confirmIpLimiter()`, `verifyUnsubToken(t)` with an unknown kid rejecting, then `status = 'unsubscribed'`, `unsubscribedAt = now()`, `purgePiiAt = now() + PURGE_DAYS` (30, declared here as a named constant) (FR-085), then an `AuditLog` row `action = 'subscriber.unsubscribe'`. **Idempotent**: a second POST changes nothing further and returns the same body (SC-006).
- [ ] T045 [US3] Create `app/apps/web/app/hirlevel/page.tsx` — the dedicated subscription page (FR-092). Tesla tokens only, no editorial or dossier aesthetic. It renders the form: section checkboxes in a `fieldset` with a `legend`, every label bound with `htmlFor`, `aria-live` on the result region (FR-011), **no name field and no free-text field of any kind** (FR-080, FR-096 — this is what stops a confirmation message carrying an attacker's words to a third party) and **no cadence control**: the copy states the digest is weekly (FR-032's default). Offering a `daily` option the schedule never serves would promise a reader a mailing that cannot arrive. It carries the honeypot of T048. It states **what is stored including the network-address hash**, the legal basis, the retention period and the erasure route (FR-084, FR-088). All copy Hungarian, drafted under the `hungarian-copy` skill (FR-032). **Not `[P]`**: it renders the honeypot markup created in T048, so it follows T048.
- [ ] T046 [P] [US3] Create `app/apps/web/app/hirlevel/megerosites/page.tsx`. It renders **byte-identically for a valid, an expired and an invented token, apart from the form nonce** (FR-035): "Erősítsd meg a feliratkozásod." with a POST button. Validity is revealed only after the POST.
- [ ] T047 [P] [US3] Create `app/apps/web/app/hirlevel/leiratkozas/page.tsx`, byte-identical across the three token cases apart from the nonce (FR-035): "Biztosan leiratkozol?" with a POST button.
- [ ] T048 [P] [US3] Create `app/apps/web/app/_home/newsletter-cta.tsx` — `'use client'`, in the `newsletter-cta-*` class namespace. It carries the honeypot exactly as specified: `<div class="newsletter-cta-hp" aria-hidden="true">` containing `<label for="nl-website">Weboldal</label>` and `<input id="nl-website" name="website" type="text" tabindex="-1" autocomplete="off" />`. All four controls are required and none is optional: **off-screen positioning rather than `display:none`** (some bots skip display-none inputs), `aria-hidden="true"` so no screen reader ever announces it (FR-011), `tabindex="-1"` so no keyboard user can tab into it and fail the check, and `autocomplete="off"` with a field name no password manager recognises — `website` is safe, `email`, `name` and `tel` are not (FR-089, research.md → R6).
- [ ] T049 [US3] Add the `newsletter-cta-*` tokens to `app/apps/web/app/globals.css`, Tesla tokens only, including `.newsletter-cta-hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }`.
- [ ] T050 [US3] Add a numbered section rendering `<NewsletterCta />` to `app/apps/web/app/page.tsx`, placed **after** the existing `submission-cta.tsx` block (FR-092). Do not edit the `submission-assurance` block or its "Az IP-címedet nem rögzítjük" promise — that claim is scoped to the tip form, and this feature adds no claim that contradicts it.
- [ ] T051 [P] [US3] Add a `/hirlevel` link to `app/apps/web/app/site-footer.tsx` (FR-092, the third entry point).
- [ ] T052 [P] [US3] Route tests in `app/apps/web/tests/api/hirlevel-feliratkozas.test.ts`: a filled honeypot performs **zero** database calls and returns the generic Hungarian failure text (V13, FR-089, FR-095); the route imports `subscribeIpLimiter` from `@korr/shared/ratelimit` and **not** `pollVoteIpLimiter` (V15, FR-093); the new-address, already-active and erased-tombstone branches return byte-identical 201 bodies (FR-043, FR-090); with `RESEND_API_KEY` unset the route returns the 503 paused body and not a 201 (FR-044); the `subscriber.subscribe` audit row's `detail` contains no address in readable form — only `sections`, `cadence` and `emailHashPrefix` — asserted against a captured insert (FR-091, FR-081, constitution v2.0.0 Principle III); the eleventh subscription sharing one `signupIpHash` within an hour pings the editor chat exactly once and the tenth does not (FR-079) — FR-079 calls this a named detection control and, with no challenge widget, the only signal that a bot run is under way, so it carries a test rather than only a code path.
- [ ] T053 [P] [US3] Route and page tests in `app/apps/web/tests/api/hirlevel-token-pages.test.ts`: a GET on `megerosites` and on `leiratkozas` issues **zero** write statements, asserted on a stubbed `getDb()` that records every call — the same shape as T002. Comparing a real row before and after needs a live Postgres and is manual step 4 (T090); this task proves the route never reaches a write in the first place, which is the stronger claim (FR-034); both GETs return byte-identical bodies for a valid, an expired and an invented token apart from the nonce (V10, FR-035); a replayed confirm POST is rejected — asserted against a stubbed database whose second lookup returns the row with `confirmTokenHash` already NULL, which is the single-process half of FR-036. **The two-process race stays on the manual list (T091)** and this task does not duplicate it; a second unsubscribe POST changes nothing further and returns the same body (SC-006); the `subscriber.confirm` and `subscriber.unsubscribe` audit rows likewise carry no address in readable form (FR-091).

**Checkpoint**: the reader-facing surfaces exist and no plain page request mutates. **Nothing is
sent yet** — the confirmation sender is T060. **Leave `RESEND_API_KEY` unset until T060 ships.**
Setting it while the consumer of `subscriber.confirm-send` does not exist makes the route return
its ordinary 201 while the event falls on the floor: the reader is told to check their inbox and
nothing was ever sent. Do not put this in front of production readers
before T086 updates `/adatvedelem`, or the privacy page will not describe data the form is
already collecting (FR-088).

---

## Phase 7: The email wrapper, the provider webhook and the digest (User Stories 3 and 4, Priority P2)

**Goal**: complete User Story 3 by actually sending, and deliver User Story 4 — no digest reaches
a single inbox without an editor's approve, discard, regenerate or corrected-text reply.

**Independent test**: build a draft, discard it, and confirm nothing was sent and no reader's
position moved; build a second, reply with corrected text containing a site link, approve it, and
confirm the corrected text is what arrives and that the reply was not ingested as a news tip.

**⚠️ Precondition P3 must already be satisfied before the first send of any kind**, the
inbox-placement test included. See the preconditions block above.

### The Inngest trigger criterion — state the rule, not the list

> Use `createBypassGuardedFunction` when the trigger is **cron alone**. Hand-roll the same guard
> when the function **also takes an event**.

The helper at `app/apps/web/src/inngest/lib/detector-runner.ts:24-40` takes
`config: { id, name, cron }` and passes `{ cron: config.cron }` to `inngest.createFunction` — one
cron trigger, no event, no array. A function built with it can therefore **only** fire on its
schedule. Write the criterion into the code comments, not the list; a list invites the next
author to repeat the generalisation, which is an easy trap here because the only two hand-rolled
functions in the repository are the two that take events.

| Function | Trigger | Shape |
|---|---|---|
| `digest-draft` | cron alone | `createBypassGuardedFunction` |
| `digest-send` | `digest.send` event **and** cron | hand-rolled, `sync-facebook-posts.ts:239-247` shape |
| `subscriber-confirm-send` | `subscriber.confirm-send` event | hand-rolled, plain `inngest.createFunction` |
| `flush-alerts`, `subscription-health` | — | no Inngest twin at all; cron routes only |

- [ ] T054 [US3] Create `app/packages/shared/src/email.ts`, modelled on `app/packages/shared/src/slack.ts`: `sendBatch(messages)` posting to `https://api.resend.com/emails/batch` with `Authorization: Bearer ${RESEND_API_KEY}`, **at most 100 messages per call** (the caller chunks), `from` from `RESEND_FROM`. **`RESEND_API_KEY` unset → returns `{ sent: 0, failed: 0 }` without a network call** (FR-047). **It never throws**: a network failure, a non-2xx or a malformed response all return `{ sent: 0, failed: messages.length, error }`. Also export `unsubscribeHeaders(token)` as a **separate pure function**, because the exact spelling is load-bearing for Gmail: `List-Unsubscribe: <https://…/hirlevel/leiratkozas?t=…>, <mailto:leiratkozas@…?subject=unsubscribe>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. **The `mailto:` value is required, not optional** — a corporate scanner cannot trigger a mailto, and Gmail expects one alongside the web address (FR-042). Declare `RESEND_DAILY_LIMIT = 100` and `RESEND_MONTHLY_LIMIT = 3000` here. Add the Hungarian templates, **plain-text-first with an HTML twin**, each carrying the unsubscribe link and a footer naming the controller, with **no reader-supplied text anywhere in a confirmation message** (FR-080). **No new npm dependency**: no `resend` SDK, no `svix` package. `RESEND_FROM` must be a `@mail.kegyencjarat.hu` address — **never the apex domain**. Enforce it rather than stating it: export `assertSendingDomain(from: string)` and call it once at module load, returning the `{ sent: 0, failed: n, error: 'apex_from' }` shape (never throwing, FR-047) if the address is not on the `mail.` subdomain. An apex `from` damages the apex domain's mail reputation, is invisible until it has, and is a Principle III violation exactly as Redis-as-a-queue is (constitution v2.0.0).
- [ ] T055 [US3] Add `"./email": "./src/email.ts"` to the `exports` map in `app/packages/shared/package.json`. The map has no wildcard, so the import fails at build without it.
- [ ] T056 [P] [US3] Tests in `app/packages/shared/src/email.test.ts`: `sendBatch` with `RESEND_API_KEY` unset returns `{ sent: 0, failed: 0 }` and performs no `fetch` (E1); it never throws on a network rejection, a 500 or a malformed body, and returns a non-zero `failed` (E2); `unsubscribeHeaders` emits `List-Unsubscribe-Post: List-Unsubscribe=One-Click` exactly and a `mailto:` value alongside the `https:` one (E3, FR-042); `sendBatch` refuses and sends nothing when `RESEND_FROM` is on the apex domain rather than `mail.kegyencjarat.hu` (constitution v2.0.0, Principle III).
- [ ] T057 [US3] Create `app/packages/db/src/email-send-ledger.ts` with `reserveSendBudget(n)`, `releaseSendBudget(n)`, `recordSent(n)` and `monthlyRemaining()` = `RESEND_MONTHLY_LIMIT − (SELECT COALESCE(SUM("sentCount"), 0) FROM "EmailSendLedger" WHERE day >= date_trunc('month', current_date))`. FR-053 requires this **per send batch**, not per digest, so a `sending` digest that crosses a month boundary sees the new month's budget on its next batch. The month boundary comes from the database's `current_date` like every other date here (FR-050). The constitution makes the 3,000/month cap an application obligation, not a provider one. The reserve, release and record statements come from `data-model.md` verbatim. The reserve is `INSERT … VALUES (current_date, $1) ON CONFLICT (day) DO UPDATE SET "reservedCount" = "EmailSendLedger"."reservedCount" + EXCLUDED."reservedCount" … RETURNING "reservedCount"` — **the `RETURNING` is what makes the reservation atomic under concurrency**: the caller learns its post-increment total and gives back anything above the cap in the same request. **The release is not optional**: without it, one failed batch permanently reduces the day's capacity. **All dates come from the database's own `current_date`** (FR-050) — the Actions schedule is UTC, the editorial rhythm is Budapest and the provider quota resets UTC, so one clock has to win. The file sits in `@korr/db` beside `llm-api-failure-alert.ts`, which is the house location for a db-side helper; the plan names the SQL but not the file, so record that choice in a header comment.
- [ ] T058 [P] [US3] Tests in `app/packages/db/src/email-send-ledger.test.ts` with an injected database: the capacity expression is `min(DIGEST_DAILY_SEND_CAP, RESEND_DAILY_LIMIT − reservedCount − SUBSCRIBE_CONFIRM_RESERVE)` read from the named constants and never a literal, so `reservedCount = 20` gives `min(90, 100 − 20 − 10) = 70` (E7, FR-051); **`remaining` reads `reservedCount` and never `sentCount`**, because only reservations bound concurrent senders (E7, FR-048); a failed batch releases exactly what it reserved and `reservedCount` returns to its pre-call value (E8); `monthlyRemaining()` sums `sentCount` from `date_trunc('month', current_date)` only, so a batch on the 1st does not carry the previous month's total (FR-053).
- [ ] T059 [P] [US3] Declare `'digest.send': { data: { digestId: string } }` in the `Events` type in `app/apps/web/src/inngest/client.ts`, together with its consumer in T067. **Declare an event only when a function consumes it** — an event with no listener fires nothing and looks like a working trigger. `digest-draft` stays cron-only via the helper, so it takes no event.
- [ ] T060 [US3] Create `app/apps/web/src/inngest/functions/subscriber-confirm-send.ts` — event-triggered on `subscriber.confirm-send`, so a plain `inngest.createFunction` with the bypass guard hand-rolled in the `sync-facebook-posts.ts:239-247` shape, per the criterion above. It generates the confirmation token, stores its `sha256` in `confirmTokenHash` with `confirmTokenExpiresAt = now() + CONFIRM_EXPIRY_HOURS`, **inside one transaction** (FR-038 — separate statements make the caps racy and therefore unenforceable): reads `confirmSentCount`, **refuses and returns without sending when it is already `>= CONFIRM_MAX_SENDS` (3)** — this is the per-address half of FR-037 and FR-096 names it a primary bound, so it is enforced here and nowhere else — then increments `confirmSentCount`, **writes `confirmLastSentAt = now()`** (the column the subscribe route's `CONFIRM_COOLDOWN_MINUTES` branch reads; without this write the cooldown reads NULL for ever and never fires), and reserves ledger budget. It also refuses past `SUBSCRIBE_CONFIRM_DAILY_CAP = 50` counted **across every address**, holds `SUBSCRIBE_CONFIRM_RESERVE = 10` inside the daily total, then `decryptPii(emailEnc)` (`app/packages/shared/src/encryption.ts:32`) and `sendBatch`. **Then settle the ledger, which FR-048 requires and no other task does for this path**: on a successful send call `recordSent(1)`; on a `sendBatch` result with `failed > 0` call `releaseSendBudget(1)`. Without the release, every failed confirmation permanently removes one send from the day's capacity and leaves a reservation the Phase 8 reconcile will later report as a leak — the leak is real, and it is created here. Import `CONFIRM_MAX_SENDS` and `CONFIRM_COOLDOWN_MINUTES` from `app/apps/web/src/lib/subscriber-crypto.ts` — **they move there in T034 and are no longer declared in the subscribe route**, because the route reads the cooldown and this function enforces the cap, and an Inngest function importing a constant out of a route file is a circular-import trap. Declare `SUBSCRIBE_CONFIRM_DAILY_CAP` and `SUBSCRIBE_CONFIRM_RESERVE` here, and put this sentence in the file beside `SUBSCRIBE_CONFIRM_DAILY_CAP`: **it is a security bound, not a throughput setting — it is the blast radius of a bot run, and raising it raises the blast radius by exactly the same amount; a capacity problem is solved by raising `DIGEST_DAILY_SEND_CAP` or the provider tier, never this** (FR-052, FR-096). The decrypted address is used only to address the message: never logged, never placed in an `AuditLog.detail` (FR-081).
- [ ] T061 [P] [US3] Test in `app/apps/web/tests/inngest/subscriber-confirm-send.test.ts` calling the exported core body directly, never executing the Inngest function: the daily cap refuses the 51st confirmation of a day; the counter increment and the reservation are issued in one transaction; a `pending` subscriber receives its confirmation message and **nothing else** (FR-038, FR-052, FR-094); the 4th confirmation for one address is refused because `confirmSentCount` has reached `CONFIRM_MAX_SENDS`, and the refusal reserves no ledger budget (FR-037, FR-096); a successful send writes `confirmLastSentAt` in the same transaction (C1b).
- [ ] T062 [US3] Create `app/apps/web/app/api/webhooks/resend/route.ts` (POST, `runtime = 'nodejs'`), **unauthenticated by design — the signature is the authentication**. Verify the Svix scheme by hand with `node:crypto` and **no `svix` dependency**: `const raw = await req.text()` **FIRST, before any parse** — parsing before reading means signing different bytes than arrived, and this is the single most common way this verification is got wrong. Then a ±5-minute window on `svix-timestamp`, `secret = base64decode(RESEND_WEBHOOK_SECRET.replace(/^whsec_/, ''))`, `expected = base64(hmacSha256(secret, ${id}.${timestamp}.${raw}))`, and any space-separated `v1,<sig>` entry matching under `timingSafeEqual` after a length check. `RESEND_WEBHOOK_SECRET` unset → **400, never accept unverified**. Only after verification, `JSON.parse(raw)`. Bounce state machine, looked up by `hashSubscriberEmail(payload.data.to)` — the same canonicalisation as the subscribe route (FR-082) — and **never persisting the raw address**: a hard bounce sets `bounced`; a soft bounce increments `bounceCount`, **writes `lastBounceAt = now()`**, and suppresses at `>= 3`; a hard bounce also writes `lastBounceAt`. `data-model.md` gives that column no reader — it is kept as the operator's evidence when a maintainer asks why an address was suppressed, and it is the one column here whose only consumer is a human running a query. Say so in a comment, or the next reader will delete it as dead. A spam complaint sets `complained`, **terminal and never reversed**; delivered, sent and anything else are ignored with `200 { ok: true }`. An unknown `emailHash` is a no-op with `200 { ok: true }`, so the webhook reveals nothing about which addresses are on the list. Add a code comment recording the back-out trap: **the webhook keeps accepting posts after `RESEND_API_KEY` is unset** — the key gates sending, not receiving — so a back-out must also disable the webhook at the provider, or bounce events keep mutating `Subscriber` rows for a channel that is off.
- [ ] T063 [P] [US3] Tests in `app/apps/web/tests/api/webhooks-resend.test.ts`: verification passes on a known-good fixture and fails on a tampered body, a tampered signature and a timestamp outside ±5 minutes (E4, V12, FR-055); the raw body is read before parsing, asserted with a fixture whose JSON re-serialises differently than it arrived (E5); a complaint sets `complained` and a later delivered event does not clear it (E6).
- [ ] T064 [US4] Create `app/apps/web/src/lib/digest-build.ts` exporting the **pure** `buildDigestDraft()` with the spend gate injected as a constructor argument, plus the constants `DIGEST_MIN_ITEMS = 3` (env-overridable via `DIGEST_MIN_ITEMS`), `DIGEST_REENGAGE_DAYS = 21`, `DIGEST_MAX_REGEN = 1`, `DIGEST_CODE_CHARS = 8` and `WATCHLIST_ID_MAX = 22`. It returns `null` or the **complete** draft record, and the return type names every column the insert needs: `{ cadence, periodStart, periodEnd, alertIds, subjectHu, bodyHtml, bodyText, code }`. Name them explicitly — `cadence`, `periodStart`, `periodEnd`, `subjectHu`, `bodyHtml` and `bodyText` are all `NOT NULL` in the schema, and a return shape that omits one produces an insert that fails at run time on the first Monday. `cadence` is `'weekly'`, the only cadence any schedule serves (see A11 / FR-032); `periodStart` is the previous digest's `periodEnd` or, when there is none, `now() − 7 days`; `periodEnd` is `now()` at draft time. **The floor** (FR-057): it returns `null` unless the window holds `DIGEST_MIN_ITEMS` items, **or** any `watchlist_removal` or `court_verdict`, **or** `DIGEST_REENGAGE_DAYS` have passed since the last send. **When the injected spend gate refuses**, it falls back to a template body carrying a note that the summary was skipped, and **never returns `null` for a budget reason** (FR-058). The short code is `randomBytes(6).toString('base64url')` → 8 characters, so `dg:a:{code}` is 13 bytes against Telegram's 64-byte `callback_data` limit. **Never put a uuid in new `callback_data`** (FR-073). The item query is one select over `SubscriberAlert` in the window with `revokedAt IS NULL`.
- [ ] T065 [P] [US4] Tests in `app/apps/web/tests/lib/digest-build.test.ts`: `buildDigestDraft` returns `null` below the floor, and **never** on a budget refusal with an injected refusing spend gate (V7, FR-057, FR-058); every `WATCH_LIST` id is at most `WATCHLIST_ID_MAX = 22` characters and `Buffer.byteLength('dg:a:' + code) <= 64` (V3, FR-073) — the tight existing case is `a:wc:{personId}.{articleId}` at `app/apps/web/app/api/telegram/webhook/route.ts:575`, which is why this pinning test exists.
- [ ] T066 [US4] Create `app/apps/web/src/inngest/functions/digest-draft.ts` with the exported plain `runDigestDraftCore({ step, logger })` body and `export const digestDraft = createBypassGuardedFunction({ id: 'digest-draft', name: 'Digest draft', cron: 'TZ=Europe/Budapest 5 7 * * 1' }, runDigestDraftCore)` — **cron alone, so the helper applies**. Do not repeat inside the core body what the helper already does: it sets `concurrency: 1`, performs the `isBypassActive()` check, logs `"digest-draft: skipped — PIPELINE_BYPASS_INNGEST active, Vercel cron owns this run"`, returns `{ skipped: 'inngest_bypass_active' }`, and applies the `step as unknown as BypassStep` cast. The core calls `buildDigestDraft()`, inserts the `Digest` naming **every** column the schema requires — `status = 'awaiting_approval'`, `draftedAt = now()`, `cadence`, `periodStart`, `periodEnd`, `alertIds` (frozen), `subjectHu`, `bodyHtml`, `bodyText` and the short `code`, the last nine taken straight from `buildDigestDraft()`'s return. All are `NOT NULL`; `periodEnd` is the value later written into every recipient's `lastDigestCursorAt`, so a wrong or missing value here silently changes what every subscriber sees next week, then sends the approval message to the **editor chat** carrying the three `dg:*` buttons, and **stores the returned `message_id` in `telegramMessageId`** (FR-068) from `sendTelegramMessage`'s existing return (`app/apps/web/src/lib/telegram.ts:34-35`).
- [ ] T067 [US4] Create `app/apps/web/src/inngest/functions/digest-send.ts` with the exported plain `runDigestSendCore({ step, logger })` body and a **hand-rolled** guard in the `sync-facebook-posts.ts:239-247` shape, with **both** triggers: `[{ event: 'digest.send' }, { cron: 'TZ=Europe/Budapest 5 7 * * 1' }]`. **It must not be cron-only**: the editor taps `dg:a`, which sets `status = 'approved'`, and a cron-only sender picks it up on its next scheduled run — an approval at 10:00 would wait until the next morning, which the editor cannot tell apart from a broken button, and the health check would not catch it either because its 24-hour condition is on `awaiting_approval` and the row has already left that state. Body order: (1) **before anything else**, scan for `awaiting_approval` digests older than `DIGEST_APPROVAL_EXPIRY_HOURS = 48` and mark them `expired`; **expiry never applies to a digest already `sending`** (FR-066). (2) `pg_advisory_xact_lock(SUBSCRIPTION_DIGEST_LOCK)` around the draft → send transition, so only one sender runs for a digest (FR-049). (3) Compute `remaining` from `reservedCount`, never `sentCount` (FR-048, FR-051), calling `monthlyRemaining()` from `@korr/db` **once per send batch and never once per digest**, and taking `min(remaining, monthlyRemaining())` as the batch size, so a `sending` digest that crosses a month boundary picks up the new month's budget (FR-053). (4) Select recipients: `status = 'active'` **only, never `pending`** (FR-094), matching `cadence`, `confirmedAt <= Digest.draftedAt` (FR-060 — a null cursor would otherwise deliver the entire frozen set to a brand-new reader), `ORDER BY "lastDigestSentAt" NULLS FIRST, id` so the same tail is not last every week (FR-063). (5) Re-filter `alertIds` for `revokedAt IS NULL`, because the list is frozen at draft time (FR-061). (6) Per recipient keep only items in their `sections` that occurred after their own `lastDigestCursorAt` (FR-062); a recipient left with nothing is skipped and their cursor still advances. (7) Reserve, `decryptPii(emailEnc)`, chunk at 100, send with `unsubscribeHeaders`. (8) **Per successful recipient, not per batch**, write `lastDigestSentAt = now()` and `lastDigestCursorAt = Digest.periodEnd` (FR-064). (9) Increment `Digest.sentCount` and the ledger's `sentCount` by the delivered count, and release any unused reservation. **When no recipient remains, complete the digest: `status = 'sent'`, `sentAt = now()`.** Nothing else in the feature writes either, and the health check's cadence-staleness condition reads both (`the last 'sent' digest is older than cadence plus two days`, FR-076) — a digest that never reaches `sent` makes that condition either permanently silent or permanently loud. The `sending` state of step 10 is the *incomplete* case only. (10) A remainder moves the digest to `sending`, resumed for at most `DIGEST_RESUME_DAYS = 3` counted from `approvedAt`; past that the remainder drops and **the maintainer is pinged rather than the send degrading into a permanent partial** (FR-054). A digest arriving on a resume day **says so in its first line** (FR-067). Declare `DIGEST_APPROVAL_EXPIRY_HOURS`, `DIGEST_RESUME_DAYS` and `DIGEST_DAILY_SEND_CAP = 90` here.
- [ ] T068 [US4] Register `digestDraft`, `digestSend` and `subscriberConfirmSend` in the `functions` array in `app/apps/web/src/inngest/index.ts` (91 lines; the array begins at `:45`), with their imports at the top.
- [ ] T069 [US4] Create `app/apps/web/app/api/cron/digest/route.ts` behind `verifyCronRequest`, returning `{ skipped: 'bypass_not_active' }` when `isBypassActive()` (`app/apps/web/src/lib/cron-bypass.ts:62`) is false, and otherwise calling `runDigestSendCore` and then `runDigestDraftCore` — **send first**, so the expiry scan runs before any drafting — with `makeBypassStep(name)` (`:34`) and `bypassLogger` (`:56`), exactly as `app/apps/web/app/api/cron/pipeline/route.ts:50-56` does for its seven steps. Respond `{ expired, drafted, sent, remaining, status }`. The two guards together — the function's own and the route's — are what keep the work running **exactly once** per tick when both callers are live (`cron-bypass.ts:15-20`).
- [ ] T070 [US4] Add the three digest callback branches to `app/apps/web/app/api/telegram/webhook/route.ts`, inside the handler the T001 origin guard now protects. `dg:a:{code}` → `status = 'approved'`, `approvedAt = now()`, then **`inngest.send({ name: 'digest.send', … })`**; **never call `runDigestSendCore` inline** — a send to hundreds of recipients inside a callback handler risks the request timing out while Telegram waits, and a timeout mid-send with ledger reservations already taken is exactly the leak the T079 reconcile exists to detect. `dg:x:{code}` → `status = 'discarded'`, and **no reader's `lastDigestCursorAt` advances**, so the period is not lost (FR-065). `dg:r:{code}` → regenerate, capped at `DIGEST_MAX_REGEN = 1`, rewriting `bodyHtml`, `bodyText`, `subjectHu`, **`draftedAt`** (FR-059 — it decides which subscribers are excluded as too new, and leaving it stale would silently change the audience between two approval messages) and **`telegramMessageId`** (FR-068 — or a reply to the superseded message still matches), incrementing `regenCount`. Every branch keeps the existing shape: `answerCallbackQuery`, then `editMessageReplyMarkup` to strip the buttons and append the outcome line — **"Kimehet — kiküldés folyamatban."** for `dg:a`, so the message does not sit looking unhandled while the work is queued. Hungarian copy under the `hungarian-copy` skill (FR-056).
- [ ] T071 [US4] Extend the `TelegramUpdate` type at `app/apps/web/app/api/telegram/webhook/route.ts:211-220`: add `message_id: number` and `reply_to_message?: { message_id: number }` to the **`message`** member. Today that member is only `{ chat: { id: number }; text?: string }` and cannot carry the match. The **`callback_query.message`** member at `:215` already has `message_id`; only the plain-message member is missing it.
- [ ] T072 [US4] Add the corrected-text reply branch to `app/apps/web/app/api/telegram/webhook/route.ts`, **immediately after the chat whitelist at `:642-645`** and therefore **before two existing branches, not one**. (a) Before the Social Post Outbox `pendingEdit` handler at `:653-698`: while any `SocialPostOutbox` row has `pendingEdit` set, **any** incoming text is consumed as that row's caption or image text — it matches on "the newest row with `pendingEdit` set" and never looks at `reply_to_message` — so an editor replying with corrected digest text during a pending social edit would have it silently saved as a Facebook caption. (b) Before `firstUrl(msg.text)` at `:707`: a corrected digest body contains links to the site, so the reply would be ingested as a news tip and answered with a five-button review keyboard (FR-069). **Do not reorder the two existing branches relative to each other** — the `firstUrl`-first ordering is deliberate and carries its own comment at `:701-706` recording a 2026-07-13 mis-parse where a slug containing "visszavonas" was read as a revoke command. The new branch matches on `reply_to_message.message_id`, which is exact, so it runs first and everything else keeps its current order behind it. Add `findDigestByTelegramMessageId()` and `applyCorrectedDigestBody()`. Behaviour: a match awaiting approval takes the text as the body and consumes **the same single regeneration budget as `dg:r`** (FR-072); a match that has left `awaiting_approval` answers "Ez a hírlevél már elment, vagy el lett vetve." and **mutates nothing** (FR-071); a reply matching no digest **falls straight through unchanged**, so genuine tips are not swallowed (FR-070).
- [ ] T073 [P] [US4] Add the digest schedule to `/home/attilah/Coding/corruption-tracker/.github/workflows/subscriptions.yml` — **repository root** — as `- cron: '5 7 * * 1'` with its `case` arm routing to `/api/cron/digest`.
- [ ] T074 [P] [US4] Tests in `app/apps/web/tests/inngest/digest-send.test.ts`, calling the exported core body directly and never executing the Inngest function: a 49-hour-old `awaiting_approval` draft is expired **before any other work**, and a `sending` digest is never expired (C5, FR-066); the recipient query's predicate is `status = 'active'` and admits no other status — asserted on the captured query rather than on a result set, since an injected database returns whatever the stub was given (C6, V14, FR-094); a subscriber whose `confirmedAt` is later than `draftedAt` is excluded (C7, FR-060); a discard leaves every `lastDigestCursorAt` unchanged (C8, FR-065); **every message object handed to `sendBatch` carries the `List-Unsubscribe` header with both an `https:` and a `mailto:` value and the exact `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, with a token that verifies for that recipient** — asserted on the captured `sendBatch` argument, not on `unsubscribeHeaders` in isolation, which E3 already covers. Constitution v2.0.0 Principle III makes these headers binding on **every bulk send**; a refactor that drops the argument passes every other test in this suite (FR-042).
- [ ] T075 [P] [US4] Test in `app/apps/web/tests/api/telegram-webhook-digest-reply.test.ts`: the corrected-text reply branch is evaluated **before both** the `pendingEdit` lookup and `firstUrl` — assert with a `SocialPostOutbox` row whose `pendingEdit` is set **and** a reply body containing a site URL, and confirm neither branch consumed it (V16, FR-069, FR-070).
- [ ] T076 [P] [US3] Add the Resend row to the table in `app/docs/log-retention.md`: `| Resend send logs | Account → Settings → data retention | ≤7 days | RESEND_LOG_RETENTION_DAYS_DECLARED env var + dated screenshot SHA, stored beside the Sentry row's screenshot in app/docs/ |`. **This is a task, not a precondition.** P3 sets the retention once, at account creation; a one-time act has no ongoing enforcement, and a later reconfiguration, a tier change or a new team would silently undo it. Every row in that file carries a Verified-by mechanism the deploy-time audit consumes, and **failure aborts the deploy** — only a row there puts the setting under recurring check.
- [ ] T077 [US3] Add `checkResend()` to `app/scripts/audit-log-retention.ts`, shaped **exactly** like the existing `checkInngest()`: read `RESEND_LOG_RETENTION_DAYS_DECLARED`, compare against `MAX_DAYS = 7`, return `OK` / `DRIFT` / `SKIPPED`, and add it to the `Promise.all` in `main()`. The file's existing rule carries over unchanged: `SKIPPED` is an acceptable degraded mode for local development, **never for a production deploy**. A declared value is used rather than an API read because **Resend's public API exposes no retention field** — checked 2026-09-01: its resource groups are Emails, Broadcasts, Automations, Events, Templates, Contacts, Contact Properties, Segments, Topics, Domains, Logs, API Keys, Suppressions, OAuth and Webhooks, with no account-settings or retention resource, and `GET https://api.resend.com/logs` returns only `id`, `created_at`, `endpoint`, `method`, `response_status` and `user_agent`. **Re-check at implementation time**: if the provider has since exposed the field, prefer the API read, which is the stronger mechanism.

**Checkpoint**: **User Stories 3 and 4 are complete.** Email is live end to end with an editor
approval in front of every send.

---

## Phase 8: The health watchdog and the GDPR pass (User Stories 5 and 6, Priority P3)

**Goal**: the maintainer learns when the alerts stop, and a reader can see, control and remove
their data.

**Independent test**: leave one alert unsent past the staleness threshold and see one ping; leave
a second and see no second ping that day; stop the watchdog and see the stale-heartbeat condition
fire when it next runs. Separately: subscribe, unsubscribe, run the retention pass with the clock
advanced, and see the address and the network-address hashes gone while the consent record and the
suppression marker remain.

**Why this hangs off Phase 7 and not Phase 3**: four of the six health conditions do not exist
until the digest and the confirmation sender do, and the purge nulls columns that only carry data
once Phase 6 writes them.

- [ ] T078 [US5] Create `app/packages/db/src/subscription-health-alert.ts` exporting `maybeSendHealthAlert(reason)`, borrowing the *shape* of `app/packages/db/src/llm-api-failure-alert.ts:42-47` and not its single-statement form: two statements, and the split between them is the whole point. **The heartbeat upsert, called on every run whether or not anything fired**: `INSERT INTO "SubscriptionHealthAlert" (day, "lastRunAt") VALUES (current_date, now()) ON CONFLICT (day) DO UPDATE SET "lastRunAt" = now();`. **The ping claim, called only when a condition fired**: `UPDATE "SubscriptionHealthAlert" SET "alertedAt" = now(), "lastReason" = $1 WHERE day = current_date AND "alertedAt" IS NULL RETURNING day;` — send the Telegram message **only when that returns a row**, which is what makes it at most one ping a day (FR-075). Export both as `recordHealthHeartbeat()` and `maybeSendHealthAlert(reason)`. **Do not merge them into one upsert**: a single row claimed by the heartbeat would make the ping claim conflict on every run, and the watchdog would go permanently quiet on its first healthy day — the failure this table exists to prevent, reproduced inside it. The ping is a **plain `fetch` to the Bot API**, copying `llm-api-failure-alert.ts:24-36`, and **does not import the web app's telegram module**, so the alert still works when that module is what broke. It is a **separate table** from `LlmApiFailureAlert` (FR-075): one row per day in a shared table would let an LLM alert suppress a subscription alert for the rest of that day, and a six-week silence of exactly that kind — 2026-07-12 to 2026-08-23, found by hand — is why `LlmApiFailureAlert` exists at all.
- [ ] T079 [US5] Create `app/apps/web/app/api/cron/subscription-health/route.ts` behind `verifyCronRequest`, in this order: (1) read the previous heartbeat with `SELECT MAX("lastRunAt") FROM "SubscriptionHealthAlert"` — **across every row, never `WHERE day = current_date`**: `HEALTH_HEARTBEAT_HOURS = 26` spans a day boundary, so the previous run is normally in yesterday's row, and a today-only read returns NULL on the first run of every day; (2) evaluate the six conditions — the five FR-076 conditions listed below plus the sixth this route adds beyond them; (3) call `recordHealthHeartbeat()` **unconditionally**, whether or not anything fired — otherwise a healthy stretch looks identical to a stopped watchdog. It writes `lastRunAt` only and never touches `alertedAt`, so it cannot consume the day's ping; (4) if anything fired, call `maybeSendHealthAlert`. The five conditions (FR-076): the oldest `channelSentAt IS NULL AND revokedAt IS NULL` row older than `HEALTH_FLUSH_HOURS = 2`, **suppressed entirely while `TELEGRAM_PUBLIC_CHANNEL_ID` is unset** (FR-077, or the kill switch pings daily for as long as it is on, and a kill switch that pings daily is one nobody leaves on); a `Digest` sitting `awaiting_approval` longer than `HEALTH_APPROVAL_HOURS = 24`; the last `sent` digest older than cadence plus two days; `EmailSendLedger.reservedCount` for `current_date` exceeding **the same row's `sentCount`** by more than 10, which is **the only way a reservation leak is ever detected**. **Both figures must come from the ledger.** Comparing against `SUM(Digest.sentCount)` counts digest deliveries only, while `reservedCount` also carries every confirmation reservation — up to `SUBSCRIBE_CONFIRM_DAILY_CAP = 50` a day — so the gap would exceed 10 on any ordinary signup day and ping the editor daily for a leak that is not there. A watchdog that cries wolf every day is one the maintainer turns off, which returns the feature to the six-week silence that produced `LlmApiFailureAlert`. And the heartbeat stale past `HEALTH_HEARTBEAT_HOURS = 26`, which is **the only condition that catches the watchdog itself stopping** (FR-078) and must therefore not depend on the scheduler that runs the other four — GitHub disables scheduled workflows after 60 days of repository inactivity, silently, with no signal reaching the application. A **sixth** condition, not in FR-076 and added because it closes the last silent surface nearest the reader: any `Subscriber` that has been `pending` for longer than `CONFIRM_EXPIRY_HOURS` with `confirmSentCount = 0` — its confirmation was enqueued and never sent. If `subscriber-confirm-send` stops, none of the other five conditions notices: no alert is stale, no digest is stuck, the heartbeat is fine, and the ledger balances. The reader simply never hears back. Declare it beside the other thresholds and name it in the ping reason. Declare the three thresholds here. **Not hosted on `gdpr-retention-sweep.ts`** (FR-074): that file is a bare `inngest.createFunction` with no Actions and no Vercel caller, on the scheduler `app/apps/web/src/lib/cron-bypass.ts:1-21` records as having blown its quota three times with mass "Invalid signature" 401s as the live symptom, and a watchdog for a silent-failure feature must not sit on the least reliable runner in the repository. Respond `{ fired, pinged, heartbeatGapHours }`.
- [ ] T080 [P] [US5] Add the health schedule to `/home/attilah/Coding/corruption-tracker/.github/workflows/subscriptions.yml` — **repository root** — as `- cron: '20 6 * * *'` with its `case` arm routing to `/api/cron/subscription-health`. The `subscription-health` option already exists in the `workflow_dispatch` choice input created in T031; confirm a manual dispatch with `target: subscription-health` actually reaches `/api/cron/subscription-health`, because that dispatch is the documented recovery path for the stale-heartbeat condition (FR-078).
- [ ] T081 [P] [US5] Tests in `app/apps/web/tests/api/cron-subscription-health.test.ts`: the route returns 401 without the cron header (C1); it writes `lastRunAt` on a run where nothing fired (C9, FR-078); two firing conditions on the same day produce exactly one Telegram send (C10, FR-075); condition 1 does not fire while `TELEGRAM_PUBLIC_CHANNEL_ID` is unset, even with stale rows present (C11, FR-077); and the sequence that neither C9 nor C10 catches on its own: a first run where **nothing** fires (heartbeat written), then a second run the same day where a condition **does** fire — exactly one Telegram send must occur. Then a third firing run the same day — no further send (C9 + C10 combined, D1); a `pending` row older than `CONFIRM_EXPIRY_HOURS` with `confirmSentCount = 0` fires the sixth condition, and one with `confirmSentCount = 1` does not (C4).
- [ ] T082 [US6] Add a new `step.run('subscriber-pii-purge', …)` pass to `app/apps/web/src/inngest/functions/gdpr-retention-sweep.ts`, alongside the existing `pii-purge` (`:34`), `orphan-scan` (`:81`), `stale-digest` (`:100`) and `partition-retention` (`:130`). It nulls `emailEnc`, `signupIpHash`, `confirmedIpHash` and `confirmTokenHash` where `purgePiiAt` has passed — driven by an **exported** `SUBSCRIBER_PII_PURGE_COLUMNS` array, so T083 can assert the list rather than re-deriving it and so a column added later to the table cannot be quietly omitted from the purge — and **keeps `emailHash`, `status` and `consentTextVersion`** — the suppression marker and the Article 7(1) consent record (FR-086). **Note the name collision in a code comment**: the existing `stale-digest` step is about the *detection digest* (`app/apps/web/src/lib/detection-digest.ts`) and has nothing to do with this feature's `Digest` table; do not extend it, and say so, so the next reader does not merge them.
- [ ] T083 [P] [US6] Test in `app/apps/web/tests/inngest/subscriber-pii-purge.test.ts` over the pass's exported column list: exactly `emailEnc`, `signupIpHash`, `confirmedIpHash` and `confirmTokenHash` are nulled, and `emailHash`, `status` and `consentTextVersion` are **not** in the nulled set (FR-086). The behaviour against a real row with a real clock goes on the manual list — see Phase 9.
- [ ] T084 [US6] Create `app/apps/web/app/api/admin/subscribers/erase/route.ts` (POST), admin-authenticated in the existing `app/apps/web/app/api/admin/**` pattern. It calls `hashSubscriberEmail`, sets `purgePiiAt = now()`, and writes an `AuditLog` row `action = 'subscriber.erase'` with the address **redacted** (FR-087, FR-091). Response `200 { ok: true, scheduled: true }`, **identical whether or not the address existed**. **Do not repair the pre-existing DSR gap**: `app/apps/web/app/api/admin/dsr/route.ts` hashes the un-normalised address, so its hash space stays separate from `hashSubscriberEmail`'s, and the spec puts that repair out of scope.
- [ ] T085 [P] [US6] Test in `app/apps/web/tests/api/admin/subscribers-erase.test.ts`: the audit row carries no address in readable form; the response is identical for a known and an unknown address; `purgePiiAt` is set to now for a known address (FR-087, FR-091).
- [ ] T086 [US6] Update `app/apps/web/app/adatvedelem/page.tsx` to state what this feature stores **including the network-address hash**, the legal basis, the retention period and the erasure route (FR-084, FR-088). `signupIpHash` is pseudonymised personal data under Article 4(5), **not** anonymous data, and must be named as stored. Hungarian copy under the `hungarian-copy` skill. **This is the Phase 6 checkpoint's blocker**: the subscription form must not face production readers before this lands.

**Checkpoint**: all six user stories are complete.

---

## Phase 9: Validation, browser verification and the manual script

**Purpose**: the checks that cannot be automated, kept separate from the automated suite exactly
as `plan.md` → Verification separates them.

- [ ] T087 Run the validation chain from `app/` **across the workspace, not only the web app**: `pnpm lint`, then `pnpm typecheck`, then `pnpm test`, then `pnpm build` (Turborepo fans each out to `@korr/web`, `@korr/shared` and `@korr/db`). **`--filter @korr/web` is not sufficient for this feature**: T056 lives in `@korr/shared` and T058 in `@korr/db`, so a web-only filter silently skips the capacity-math test (E7, FR-051), the reservation-release test (E8, FR-048) and the RFC 8058 header test (E3, FR-042) — three checks on constitution-binding behaviour. If a per-package loop is faster for the inner loop, it must still name all three packages. Log a per-command verdict with its output tail. Never collapse to "tests passed".
- [ ] T088 Browser verification at **375 px and 1440 px** of `/`, `/hirlevel`, `/hirlevel/megerosites`, `/hirlevel/leiratkozas` and `/adatvedelem`, using the `claude-in-chrome` skill (launch with the `run` skill first if needed). Check the accessibility contract on the form specifically: the section checkboxes in a `fieldset` with a `legend`, every label bound with `htmlFor`, `aria-live` on the result region, and **the honeypot absent from the accessibility tree and unreachable by Tab** (FR-011). Also confirm SC-014 on those five pages: every visible string, including every error and empty state, is Hungarian. Trigger each result state rather than reading the happy path only — the paused response, the expired token and the generic submission failure are the three most likely to ship in English (FR-010, SC-014).
- [ ] T089 Apply `app/supabase/migrations/0053_reader_subscriptions.sql` **by hand** to local Supabase (`psql "$DIRECT_URL" -f …`) and confirm the four enums and five tables exist, per `quickstart.md` § 2. Applying it to any live database is the maintainer's call, not an agent's.
- [ ] T090 Run the fifteen-step manual script in `quickstart.md`, logging **PASS / FAIL / NOT TESTED per step with its evidence**. The four marked ★ are the ones that catch a silent failure and are the ones to run if time is short: run two flushes concurrently and confirm each row posts exactly once (step 12); GET the confirmation link twice then POST and confirm it still works (step 4); approve a manual watchlist removal via `a:wc:` and confirm **one** alert, not two (step 10); GET the unsubscribe link and confirm nothing changes, then POST, then exercise the one-click header (step 15). Finish with the kill-switch check: unset `TELEGRAM_PUBLIC_CHANNEL_ID` with unsent alerts present, run the flush and the health check, and confirm the flush no-ops, the rows are retained, **and the health check does not ping** (FR-077).
- [ ] T091 The verifications that need a live Postgres and cannot be covered by Vitest — run against local Supabase, never in CI, and log a verdict each: the `SubscriberAlert_dedupeKey_uq` index under a real concurrent double-insert; confirmation-token expiry and single use across two processes; the `EmailSendLedger` reserve statement under two concurrent senders, where both must see a correct post-increment `reservedCount` from their own `RETURNING`; and `pg_advisory_xact_lock(SUBSCRIPTION_DIGEST_LOCK)` actually serialising two senders. **Then, and only after precondition P3's ≤7-day send-log retention is confirmed set**, send one digest to a Gmail address and an Outlook address and confirm inbox placement rather than the spam folder (SC-015). **That step is itself a real send** — it writes a real recipient address into the provider's logs, which no retention setting applied afterwards will delete — and a delivered message cannot be recalled by any mechanism in this feature. It is last in the list and first in importance.

---

## Dependencies and execution order

### Phase dependencies

- **Phase 1** — no dependency. Ships alone, first, because it closes a window that is live today.
- **Phase 2** — no dependency on Phase 1. Blocks Phases 3–8.
- **Phase 3** — depends on Phase 2. Blocks both branches.
- **Phase 4 → Phase 5** — depend on Phase 3. **Independent of Phases 6–8.**
- **Phase 6 → Phase 7** — depend on Phase 3. **Independent of Phases 4–5.**
- **Phase 8** — depends on Phase 7, not on Phase 3.
- **Phase 9** — depends on whichever phases are being shipped.

### User story dependencies

- **US1** (Phase 1) — independent of everything. It is the prerequisite in spirit for US2, because it is what makes putting the bot in a public channel safe.
- **US2** (Phases 4–5) — depends on Phases 2–3 only. Independently shippable and independently testable.
- **US3** (Phases 6–7) — depends on Phases 2–3 only. Its email half needs preconditions P3 and P4.
- **US4** (Phase 7) — builds on US3's provider work; not separable from it.
- **US5** and **US6** (Phase 8) — depend on Phase 7 for two health conditions and for the columns the purge clears.

### Parallel opportunities

**The largest one is structural**: after Phase 3, the branch `4 → 5` and the branch `6 → 7` are
genuinely independent and can be worked at the same time by two people. Phases 4–5 touch the
channel, the outbox and the workflow; Phases 6–7 touch the reader pages, the provider and the
digest. The only file both branches edit is
`app/apps/web/app/api/telegram/webhook/route.ts` — T026–T029 in Phase 5 against T070–T072 in
Phase 7 — so co-ordinate on that one file, or land Phase 5's webhook edits first.

Tasks marked `[P]` within a phase:

| Phase | Parallel tasks |
|---|---|
| 2 | T004, T005 (after T003); T006, T007; T009, T010 |
| 3 | T013 |
| 4 | T016 (with T014/T015); T018, T019 |
| 5 | T021, T022, T023, T024, T025; T031, T032, T033, T033a |
| 6 | T039; T046, T047, T048 (T045 follows T048); T051; T052, T053 |
| 7 | T056; T058; T059; T061; T063; T065; T073; T074, T075; T076 |
| 8 | T080, T081; T083; T085 |

Not marked `[P]`, and deliberately: **T026, T027, T028, T029, T070, T071, T072 all edit
`app/apps/web/app/api/telegram/webhook/route.ts`**, and **T016 and T017 both edit
`app/apps/web/src/lib/notify-subscribers.ts`**, and **T034 and T035 both edit
`app/apps/web/src/lib/subscriber-crypto.ts`**, and **T036 and T037 both edit
`app/packages/shared/src/ratelimit.ts`**. Two further same-file pairs are marked `[P]` and are
safe **only because their phases are sequential**: **T039 and T059** both edit
`app/apps/web/src/inngest/client.ts`, and **T073 and T080** both edit the repository-root
`.github/workflows/subscriptions.yml` (which T031 creates). Never run either pair concurrently
across a phase boundary.

### Parallel example — Phase 5's four detector call sites

```bash
Task: "Record a court_verdict alert in app/apps/web/src/inngest/functions/detect-verdicts.ts:307"
Task: "Record a resignation alert in app/apps/web/src/inngest/functions/detect-resignations.ts after :226"
Task: "Record a media_closure alert in app/apps/web/src/inngest/functions/detect-media-closures.ts:159"
Task: "Record a criminal_complaint alert in app/apps/web/src/inngest/functions/detect-criminal-complaints.ts:147"
```

---

## Implementation strategy

### MVP first

1. **Phase 1** — the origin guard. Two tasks, and it ships on its own.
2. **Phase 2 + Phase 3** — the shared list, the exports, the schema.
3. **Phases 4 + 5** — User Story 2, the whole channel promise.
4. **STOP and VALIDATE**: run T087, T088 and the channel half of T090.
5. Deploy. The site can now tell readers it published, with no personal data anywhere in the path.

### Incremental delivery

1. Phase 1 → deploy. The window closes.
2. Phases 2–3 → foundation ready.
3. Phases 4–5 → **deploy the channel (MVP)**. No provider, no consent record, no unrecallable step.
4. Phases 6–7 → deploy email, with `RESEND_API_KEY` unset until P3 and P4 are confirmed done and T091's inbox-placement check has passed.
5. Phase 8 → deploy the watchdog and the GDPR pass. **T086 must ship before the form faces production readers.**

### Parallel team strategy

With two people, after Phase 3: one takes `4 → 5`, the other takes `6 → 7 → 8`. They meet on
`app/apps/web/app/api/telegram/webhook/route.ts`; land Phase 5's edits there first.

---

## Test separation — automated versus manual

**Automated (Vitest 2, `vi.mock('server-only')`, pure exported helpers, Inngest functions never
executed — their `…Core` bodies are called directly):** T002, T008, T018, T019, T021, T032, T033, T033a,
T038, T052, T053, T056, T058, T061, T063, T065, T074, T075, T081, T083, T085. Playwright covers
the two reader pages under `app/apps/web/tests/e2e/`.

**Manual, because it needs a live Postgres or a live provider** — T089, T090, T091. Nothing on
this list may be turned into a Vitest task: the dedupe index under a real race, token expiry and
single use across two processes, the ledger's concurrent-reservation behaviour under two senders,
the advisory lock actually serialising, and any real send.

---

## Notes

- `[P]` means a different file with no dependency on an incomplete task.
- Every `file:line` anchor in this document is stated against **`origin/main`**, per PR-1.
- All reader-facing and editor-facing Hungarian copy is drafted under the `hungarian-copy` skill. Hungarian text is outside the ASD-STE100 English standard.
- Every async reader view is triple-stated: loading, error with retry, empty. Every query filters soft deletes. Every optional value is guarded with `?.` and `??`, and every array with `?? []`.
- Nothing in this feature throws. That is deliberate, and it is why Phase 8 is part of the feature rather than an operational extra: Sentry and Better Stack see thrown errors, and **neither sees "nothing happened"**.
- Commit after each task or logical group. Do not commit, push, rebase or merge on the maintainer's behalf.
