# Research — Reader subscriptions

**Feature**: `012-reader-subscriptions` | **Date**: 2026-09-01
**Status of unknowns**: none open. Every value the spec names is settled below.

This document records the decisions that would otherwise be re-litigated during
implementation, with what was rejected and why. The source implementation plan survived three
adversarial review rounds against the real codebase; where a decision came from there, the
verified anchor is given.

---

## R1 — The public alert channel is Telegram, not SMS

**Decision**: one public Telegram channel, all six sections, plain text.

**Rationale**: no phone number is ever stored, so the feature adds no new personal-data class
on its channel half. The bot, the token and the send helper already exist
(`app/apps/web/src/lib/telegram.ts`). Spec assumptions A4 and A5.

**Alternatives rejected**: SMS — stores a phone number, costs money per message, and needs a
provider that the constitution's locked stack does not contain. Per-section Telegram
filtering — would need one channel per section or a bot with per-user state; per-section choice
is what the email half is for.

---

## R2 — The email provider is Resend, called over native `fetch`

**Decision**: Resend, `POST https://api.resend.com/emails/batch`, at most 100 addresses a call,
no SDK.

**Rationale**: the free tier (100/day, 3,000/month) covers the real audience with the caps in
place. Batch send means one call per digest wave. The `slack.ts` module in the same package is
the working precedent for an env-gated, never-throwing `fetch` wrapper.

**Alternatives rejected**: the `resend` npm SDK — a new dependency for one POST and one header
set. Self-hosted SMTP — owning IP reputation, DKIM signing and bounce parsing is far more code
and far more risk. Supabase Auth's mailer — it sends magic links to editors, not bulk mail to
readers, and has no bounce webhook.

**Known cost, recorded honestly — and now settled**: constitution v1.0.0 named Resend in
Principle III's forbidden-substitutions list. **The constitution was amended on 2026-09-01,
v1.0.0 → v2.0.0 (MAJOR — the constitution's own versioning policy grades a Principle III stack
substitution as MAJOR).** The amendment removed Resend from the forbidden list and added
**Email: Resend** to the locked-in services, with binding constraints: sending only, never a
queue or a data store; the sending domain must be the subdomain `mail.kegyencjarat.hu`, never
the apex; RFC 8058 one-click unsubscribe headers with both an `https:` and a `mailto:` value on
every bulk send; subscriber addresses encrypted at rest and decrypted only at the moment a
message is addressed, with no plaintext address in a log line or an audit-record detail field;
and the free-tier caps (100/day, 3,000/month) enforced in the application by the shared
reservation ledger, never assumed of the provider. Nothing is outstanding. See plan.md →
Complexity Tracking.

---

## R3 — No third-party challenge widget anywhere in this feature

**Decision**: no Cloudflare Turnstile, no alternative widget. Spec assumption A11.

**Rationale**: commit `d5f66a9` (2026-08-31) removed Turnstile from the voting flow at the
maintainer's explicit request. The site key's Cloudflare-side domain allowlist failed
unreliably under real traffic, real voters were refused, and the maintainer holds no API access
to fix the allowlist. A control that refuses real readers for a reason the maintainer cannot
fix is worse than no control.

**What replaces it**: the voting flow's surviving stack, minus the one layer that cannot
transfer.

| Poll's layer | Transfers to subscribe? |
|---|---|
| Honeypot, checked first | **Yes** — FR-089 |
| Per-IP daily threshold from the shared factory | **Yes, but with its own limiter** — FR-093, and see R4 |
| One-vote-per-browser cookie | **No.** It enforces one action per browser, which would refuse the second person in a household or an office. |
| Turnstile | Removed from both |

The poll code itself calls the cookie its *primary* protection. Losing it means the subscribe
form has a genuinely thinner front door than the poll had, which is exactly why FR-094 (double
opt-in) and FR-096 (the three promoted controls) carry the real bound.

---

## R4 — A separate `subscribeIpLimiter`, not `pollVoteIpLimiter`

**Decision**: declare `subscribeIpLimiter()` and `subscribeIpHourLimiter()` in
`app/packages/shared/src/ratelimit.ts` using the same module-private `getOrCreate` factory
(`:58-62`). Defaults 20/IP/day and 3/IP/hour, both env-tunable.

**Rationale**: `pollVoteIpLimiter` (`ratelimit.ts:83-86`) is
`POLL_VOTE_IP_DAILY_LIMIT ?? 75`. Its own comment (`:79-82`) says the number is *deliberately
generous* so shared NAT does not collide with it, because it is only a secondary net behind a
per-browser cookie and Turnstile. The subscribe form inherits **neither** of those two layers.
Reusing that function would take a threshold tuned for generosity and make it the outermost
control on a mail-sending endpoint. 75 confirmation attempts a day from one address is not a
bound anyone would choose here.

**Why the factory and not a bespoke limiter**: `getOrCreate` is module-private and is the only
path that carries the in-memory fallback for an environment with no Upstash configured
(`:39-56`). A limiter built inside a route would silently fail open in every local and preview
environment. FR-093 states this.

**Side finding, to fix while implementing FR-093**: the last line of the `pollVoteIpLimiter`
comment still reads "A tényleges bot-védelmet a Turnstile adja, nem ez a szám" — the real bot
protection comes from Turnstile, not this number. `d5f66a9` left it behind and it is now false
on `main`. Rewrite it to what is true now for the poll: the cookie is primary, the IP threshold
is secondary, and since `d5f66a9` there is no third layer. Do not imply the poll is as
protected as it was.

---

## R5 — `checkHoneypot` is reused in place, not moved

**Decision**: `import { checkHoneypot } from '@/lib/poll-validation';` in the subscribe route.

**Rationale**: the helper is `app/apps/web/src/lib/poll-validation.ts:11-16`, inside
`apps/web`, not in `@korr/shared`. The subscribe route is also in `apps/web`, so it can import
it directly. FR-089's word "shared" means one implementation, not one package.

**Alternative rejected**: moving it to `@korr/shared`. That would edit the poll vote route,
which is outside this feature's scope, for no functional gain and one more exports-map entry.

---

## R6 — Hiding the honeypot: off-screen, not `display: none`

**Decision**: absolute off-screen positioning, plus `aria-hidden="true"`, `tabindex="-1"`,
`autocomplete="off"`, and a field name (`website`) that no password manager treats as an
address, a name or a phone number.

**Rationale**: `display: none` alone fails in both directions. Some bots skip display-none
inputs, so the trap does not catch them. Some password managers and browser autofill engines
complete hidden fields anyway, so a real reader gets refused with a message that tells them
nothing. Off-screen positioning keeps the field fillable by a naive bot while `tabindex="-1"`
and `aria-hidden` keep every human out of it — which is the accessibility obligation FR-011
inherited when the challenge frame went away.

---

## R7 — Double opt-in is the real anti-relay control

**Decision**: nothing but its own confirmation message is ever addressed to a row that is not
`active`. A test proves the digest recipient query selects no `pending` row.

**Rationale**: FR-094. The attack this feature must not enable is "submit someone else's
address and make the site mail them". Double opt-in reduces that to a bounded set of
confirmation messages, capped by FR-037 per address and FR-052 globally at 50 a day, from a
domain with no sending reputation, with the FR-079 editor ping firing while it happens.

**Consequence for FR-052**: `SUBSCRIBE_CONFIRM_DAILY_CAP` is a security bound, not a throughput
setting. Raising it raises the blast radius by the same amount. A capacity problem is solved by
raising `DIGEST_DAILY_SEND_CAP` or the provider tier.

---

## R8 — `sections` as a pg-enum array, not `text[]`

**Decision**: `subscription_section[]`, generated from `SUBSCRIPTION_SECTIONS` in
`@korr/shared/sections`.

**Rationale**: FR-007 makes one list the only source of the six names. An enum makes the
database refuse a seventh name the shared list does not carry, which a `text[]` cannot.

**Cost, recorded in the migration header per A8**: a seventh section costs **two migrations,
forever**, because `ALTER TYPE … ADD VALUE` cannot run in the same transaction as a use of the
new value.

**Precedent broken, knowingly**: `text[]` at `app/packages/db/src/schema.ts:92`, `:199`, `:202`,
`:1374`. Signed off under A3. There is a `uuid(...).array()` precedent at `:1048`, so the array
shape itself is not new to the schema.

---

## R9 — Claim-then-post, not post-then-mark

**Decision**: one `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING …` sets
`channelSentAt` and selects the rows in the same statement. Post afterwards.

**Rationale**: FR-023, FR-024. Two overlapping runs would both select `channelSentAt IS NULL`
and both post, and a duplicate public post cannot be recalled. Claiming first means a crash
between the claim and the post **loses** an alert instead of duplicating one. That is the
deliberate trade: a missed alert is recoverable by the next publication.

**Second defence, also required**: a workflow `concurrency` group with
`cancel-in-progress: false`, so a long run is not killed mid-batch by the next tick.

---

## R10 — The workflow lives at the repository root

**Decision**: `/.github/workflows/subscriptions.yml`.

**Rationale**: GitHub Actions loads workflows only from `.github/workflows/` at the repository
root. `app/.github/workflows/ci.yml` exists and holds CI, and **GitHub never reads it**.
Putting a schedule there is a silent no-fire, which is this feature's signature failure mode
(FR-029).

**Verified precedent**: the repository root already holds `.github/workflows/hourly-pipeline.yml`
and `.github/workflows/daily-video-health-check.yml`, both live. `hourly-pipeline.yml` is the
shape to copy — a `curl` with `Authorization: Bearer ${{ secrets.CRON_SECRET }}` against
`https://www.kegyencjarat.hu`, failing the job on any non-200.

---

## R11 — The flush does not ride the existing pipeline

**Decision**: its own cron route, `app/apps/web/app/api/cron/flush-alerts/route.ts`.

**Rationale**: FR-028. `app/apps/web/app/api/cron/pipeline/route.ts` runs seven sequential
steps — a scraper plus six LLM detectors — under `maxDuration = 300` with no per-step budget. A
flush appended last is the step most likely to be silently truncated.

---

## R12 — The watchdog is not hosted on the Inngest sweep

**Decision**: `app/apps/web/app/api/cron/subscription-health/route.ts`, called by Actions
behind `verifyCronRequest`.

**Rationale**: FR-074. `gdpr-retention-sweep.ts` is a bare `inngest.createFunction` with no
Actions and no Vercel caller, on the scheduler that `app/apps/web/src/lib/cron-bypass.ts:1-21`
records as having blown its quota three times, with mass "Invalid signature" 401s as the live
symptom. A watchdog for a silent-failure feature must not sit on the least reliable runner in
the repository.

**Precedent for the once-a-day marker**: `app/packages/db/src/llm-api-failure-alert.ts:42-47` —
`INSERT … ON CONFLICT (day) DO NOTHING RETURNING day`, then send only if a row came back. That
module exists because LLM API failures ran silently from 2026-07-12 to 2026-08-23.

**Why a separate table**: FR-075. One row per day in `LlmApiFailureAlert` would let an LLM alert
suppress a subscription alert for the rest of that day.

---

## R13 — The heartbeat is the only self-check

**Decision**: the health route stores its own last-run timestamp and reports a gap over
`HEALTH_HEARTBEAT_HOURS = 26` on its next run, whenever that is — including a manual
`workflow_dispatch`.

**Rationale**: FR-078. Every other condition assumes the route runs. GitHub disables scheduled
workflows after 60 days of repository inactivity, silently. Nothing else in the design notices.

---

## R14 — Signed unsubscribe links: kid-selected HMAC, no time expiry

**Decision**: payload `unsub:v1:{kid}:{subscriberId}`, token
`base64url(payload).base64url(hmacSha256(secret, payload))`, key selected by the kid parsed out
of the payload, `timingSafeEqual` after a length check, unknown kid rejects.

**Rationale**: FR-039 to FR-041. Trying every key in turn turns an unknown kid into a timing
signal and defeats the point of having a kid. No time expiry, because a delivered message must
stay usable for as long as it sits in an inbox (FR-040), which is also why a `_PREVIOUS` key is
never removed while any inbox may hold it.

**Separate from `PII_ENC_KEY`** (FR-041), with a separate rotation schedule. Deliberately
**not** the `INTERNAL_REVALIDATE_SECRET ?? PII_ENC_KEY` fallback used at
`app/apps/web/app/api/admin/submissions/[id]/audit-pii-read/route.ts`, which would silently reuse the encryption
key as a signing key.

---

## R15 — No plain page request mutates

**Decision**: GET renders; POST acts. On both `megerosites` and `leiratkozas`.

**Rationale**: FR-034, FR-035. Corporate scanners (SafeLinks, Proofpoint, Mimecast) GET every
link on delivery. A single-use token consumed on GET is burned before the reader clicks, and the
`CONFIRM_MAX_SENDS` cap then locks that address out permanently and silently.

**RFC 8058 does not save unsubscribe**: it covers only the `List-Unsubscribe-Post` header URL,
never the body link a human clicks. Hence a `mailto:` value alongside the `https:` one — a
scanner cannot trigger a mailto, and Gmail expects it (FR-042).

---

## R16 — Provider webhook signature: `node:crypto`, no `svix` package

**Decision**: verify the Svix scheme by hand — HMAC-SHA256 over `${id}.${timestamp}.${body}`,
constant-time compare, ±5-minute timestamp window. Read the raw body with `await req.text()`
before any parse.

**Rationale**: FR-055 forbids a new dependency, and the scheme is four lines of `node:crypto`.
Parsing before reading the raw body would sign different bytes than arrived.

---

## R17 — One clock: the database's `current_date`

**Decision**: every budget date comes from Postgres, never from Node.

**Rationale**: FR-050. The Actions schedule is expressed in UTC, the editorial rhythm is
Budapest, and the provider's quota resets UTC. One of them has to win for the ledger's day key
to be coherent, and the database is the only participant every writer already talks to.

---

## R18 — `emailDomain` and four other columns are dropped from the source design

**Decision**: `Subscriber.emailDomain`, `SubscriberAlert.entityType`,
`SubscriberAlert.sourceUrl`, `Digest.recipientCount` are **not** created; `digest_status` has no
`draft` member.

**Rationale**: none has a reader. Disposable-domain rejection happens on the input, not on a
stored column. `section` carries the entity type, and the channel message is built from
`title`, `detail` and `url`. `draft` is never entered — a digest is `awaiting_approval` from the
moment it exists.

---

## R19 — The corrected-text reply branch runs before two other branches, not one

**Decision**: insert the digest reply branch immediately after the chat whitelist at
`app/apps/web/app/api/telegram/webhook/route.ts:642-645`, before **both** the Social Post
Outbox `pendingEdit` lookup (`:653-698`) and the `firstUrl` call (`:707`).

**Rationale**: FR-069 names the `firstUrl` ordering, because a corrected digest body contains
links and the existing order would ingest the reply as a news tip. The `pendingEdit` branch is
newer and the source plan did not know about it: while any `SocialPostOutbox` row has
`pendingEdit` set, **any** incoming text is consumed as that row's caption or image text, with
no `reply_to_message` check at all. An editor replying with corrected digest text during a
pending social-post edit would have it silently saved as a Facebook caption.

The digest branch matches on `reply_to_message.message_id`, which is exact, so the exact match
goes first and a non-match falls straight through to both existing behaviours unchanged
(FR-070).

---

## R20 — Two editor label maps are pinned, never re-derived

**Decision**: `SECTION_LABELS_HU` is the reader-facing source. `TARGET_LABELS_HU`
(`app/apps/web/src/lib/notify-auto-publish.ts:31`) and `DETECTOR_LABELS_HU`
(`app/apps/web/src/lib/notify.ts:34`) stay as they are, and a pinning test asserts every key of
each has a counterpart in `SECTION_LABELS_HU`.

**Rationale**: FR-009. Those are editor-facing strings. `watchlist_removal` reads "Lemondásra
felszólított — mandátum megszűnt" there, which is the editor's own notification wording.
Re-deriving would silently rewrite live editor messages as a side effect of a newsletter
feature.

**Implementation note found while checking**: both maps are declared `const`, not exported. The
test cannot read them today. Change both to `export const` — a two-character edit that changes
no behaviour. Deriving the key set from the TypeScript type instead would pin nothing at
runtime.
