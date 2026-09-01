# Contract — the scheduled endpoints and the workflow

**Feature**: `012-reader-subscriptions`
**Workflow**: `/.github/workflows/subscriptions.yml` — **at the repository root**
**Routes**: `app/apps/web/app/api/cron/{flush-alerts,digest,subscription-health}/route.ts`

---

## Where the workflow lives, and why it is not next to CI

**`/.github/workflows/subscriptions.yml`, at the REPOSITORY ROOT.**

`app/.github/workflows/ci.yml` exists and holds the CI pipeline. **GitHub never reads it.**
Actions loads workflows only from `.github/workflows/` at the repository root. A schedule placed
in the `app/` copy is a **silent no-fire** — no error, no log, no run — which is this feature's
signature failure mode (FR-029).

The repository root already proves the pattern: `.github/workflows/hourly-pipeline.yml` and
`.github/workflows/daily-video-health-check.yml` are the live schedules. Copy
`hourly-pipeline.yml` exactly.

### The file

```yaml
name: Reader subscriptions (flush / digest / health)

# 012-reader-subscriptions. A hourly-pipeline.yml mintájára: a Vercel
# /api/cron/* route-okat hívja CRON_SECRET-tel, nem az Inngesten keresztül.
# A repo GYÖKERÉBEN kell lennie — az app/.github/workflows/ könyvtárat a
# GitHub SOHA nem olvassa, oda téve a workflow némán soha nem futna le.

on:
  schedule:
    - cron: '*/15 * * * *'        # FLUSH_CRON — flush-alerts
    - cron: '5 7 * * 1'           # digest draft, hétfő
    - cron: '20 6 * * *'          # subscription-health, naponta
  workflow_dispatch: {}

concurrency:
  group: subscriptions-flush
  cancel-in-progress: false        # FR-025 — egy futó flush-t SOHA nem ölünk meg

jobs:
  call:
    runs-on: ubuntu-latest
    steps:
      - name: Call the endpoint for this schedule
        run: |
          set -e
          case "${{ github.event.schedule }}" in
            '*/15 * * * *') path=/api/cron/flush-alerts ;;
            '5 7 * * 1')    path=/api/cron/digest ;;
            '20 6 * * *')   path=/api/cron/subscription-health ;;
            *)              path=/api/cron/flush-alerts ;;   # workflow_dispatch
          esac
          http_code=$(curl -sS -m 280 -o /tmp/response.json -w '%{http_code}' \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "https://www.kegyencjarat.hu${path}")
          echo "HTTP status: $http_code"
          cat /tmp/response.json
          echo ""
          if [ "$http_code" != "200" ]; then
            echo "::error::${path} returned HTTP $http_code"
            exit 1
          fi
```

`CRON_SECRET` is an existing repository secret, already used by `hourly-pipeline.yml`. No new
secret is needed.

**`concurrency` with `cancel-in-progress: false`** is one of the two required defences against a
duplicate public post (FR-025). The other is the database claim.

**One thing the workflow cannot do**, and the reason the health route has a heartbeat: GitHub
disables scheduled workflows after 60 days of repository inactivity, silently, with no signal
reaching the application.

---

## All three routes share this shape

```ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  …
}
```

`verifyCronRequest` is `app/apps/web/src/lib/cron-bypass.ts:67-71` —
`Boolean(secret) && authHeader === 'Bearer ' + secret`. The four existing routes under
`app/apps/web/app/api/cron/` are the pattern to match.

The `…Core` bodies are exported separately, and the Inngest side is guarded either by the repo's
existing helper or by the same guard hand-rolled. **The criterion, not a list:**

> Use `createBypassGuardedFunction` when the trigger is **cron alone**. Hand-roll the same guard
> when the function **also takes an event**.

The helper is `app/apps/web/src/inngest/lib/detector-runner.ts:24-40`. Its `config` is
`{ id, name, cron }` and it passes `{ cron: config.cron }` — one cron trigger, no event, no
array — so a function built with it can only ever fire on its schedule. It wraps
`inngest.createFunction` with `concurrency: 1`, performs the `isBypassActive()` check itself,
returns `{ skipped: 'inngest_bypass_active' }` with a log line when the bypass is on, and applies
the `step as unknown as BypassStep` cast, so the `…Core` body carries no bypass machinery.

| Function | Trigger | Shape |
|---|---|---|
| `digest-draft` | cron alone | `createBypassGuardedFunction` |
| `digest-send` | `digest.send` event **and** cron | hand-rolled, `sync-facebook-posts.ts:239-247` shape |
| `subscriber-confirm-send` | `subscriber.confirm-send` event | hand-rolled, plain `inngest.createFunction` |
| `flush-alerts`, `subscription-health` | — | no Inngest twin; cron routes only |

```ts
export async function runDigestDraftCore({ step, logger }: { step: BypassStep; logger?: BypassLogger }) { … }

export const digestDraft = createBypassGuardedFunction(
  { id: 'digest-draft', name: 'Digest draft', cron: 'TZ=Europe/Budapest 5 7 * * 1' },
  runDigestDraftCore,
);

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

**`digest-send` must not be cron-only.** The editor taps `dg:a`, which sets
`status = 'approved'`. A cron-only sender picks that up on its next scheduled run, so an
approval at 10:00 waits until the next morning — indistinguishable, to the editor, from the
button not working. The health check would not catch it either: its 24-hour condition is on
`awaiting_approval`, and the row has already left that state.

So the `dg:a` branch **emits `digest.send`** and answers the callback immediately. It does
**not** call `runDigestSendCore` inline — a send to hundreds of recipients inside a callback
handler risks the request timing out while Telegram waits, and a timeout mid-send with ledger
reservations already taken is precisely the leak the health reconcile exists to detect. The cron
trigger stays, and catches resumes and anything the event missed.

**Every new event MUST be declared in the `Events` type at
`app/apps/web/src/inngest/client.ts`**, the typed source for `inngest.send`. Declare an event
only together with the function that consumes it; an event with no listener fires nothing and
looks like a working trigger.

The cron route calls the same `…Core` with `makeBypassStep(name)` and `bypassLogger`, exactly as
`app/apps/web/app/api/cron/pipeline/route.ts:50-56` does for its seven steps, after returning
`{ skipped: 'bypass_not_active' }` when `isBypassActive()` is false. The two guards together —
the helper's and the route's — are what make the work run **exactly once** per tick when both
callers are live (`cron-bypass.ts:15-20`).

`flush-alerts` and `subscription-health` have no Inngest twin; they are cron routes only, so the
helper does not apply to them.

---

## `GET /api/cron/flush-alerts`

Calls `flushSubscriberAlerts({ max: FLUSH_BATCH_SIZE })`.

### Order — the claim comes before the post

1. **`TELEGRAM_PUBLIC_CHANNEL_ID` unset → return `{ sent: 0, remaining: 0, paused: true }`
   immediately.** No claim statement runs, so every `channelSentAt` stays NULL and every row is
   available to a later run (FR-022). This is the kill switch.
2. **Claim** up to `FLUSH_BATCH_SIZE` (20) rows in one statement — the
   `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING …` in data-model.md.
3. **Post** the returned rows, pausing between messages to stay under
   `TELEGRAM_CHANNEL_RATE` (20/min).
4. A **429** from Telegram **stops the run**. The next scheduled run resumes from the unsent
   rows (FR-027).

**Claim-then-post means a crash between the two loses an alert rather than duplicating one**
(FR-024). That is the deliberate trade: a missed alert is recoverable by the next publication;
a duplicate public post is not recallable at all.

### Response

```jsonc
200 { "sent": 7, "remaining": 0, "paused": false }
```

### Why this is not appended to the existing pipeline

`app/apps/web/app/api/cron/pipeline/route.ts` runs seven sequential steps — a scraper plus six
LLM detectors — under `maxDuration = 300` with no per-step budget. A flush appended last is the
step most likely to be silently truncated (FR-028).

---

## `GET /api/cron/digest`

Two Inngest functions behind one route, in this order.

### 1. `digest-send` runs first, and expires before anything else

**Before any send, and before the draft step**, scan for `awaiting_approval` digests older than
`DIGEST_APPROVAL_EXPIRY_HOURS` (48) and mark them `expired` (FR-066). **Expiry never applies to
a digest already `sending`.**

Then, for an `approved` or `sending` digest:

1. `pg_advisory_xact_lock(SUBSCRIPTION_DIGEST_LOCK)` — one sender at a time (FR-049). The
   constant lives beside `KPI_ROLLUP_LOCK` in `app/packages/db/src/locks.ts`, per constitution
   Principle V.
2. Compute `remaining` from `reservedCount`, never `sentCount` (FR-048, FR-051).
3. Select recipients: `status = 'active'` **only** — never `pending` (FR-094) —
   `cadence` matching, `confirmedAt <= Digest.draftedAt` (FR-060),
   `ORDER BY "lastDigestSentAt" NULLS FIRST, id` (FR-063).
4. Re-filter `alertIds` for `revokedAt IS NULL` (FR-061).
5. Per recipient, keep only items in their `sections` that occurred after their own
   `lastDigestCursorAt` (FR-062). A recipient left with nothing is skipped, and their cursor
   still advances.
6. Reserve, `decryptPii(emailEnc)`, chunk at 100, send.
7. **Per successful recipient**, write `lastDigestSentAt = now()` and
   `lastDigestCursorAt = Digest.periodEnd` (FR-064). Not per batch.
8. Increment `Digest.sentCount` and `EmailSendLedger.sentCount` by the delivered count. Release
   any unused reservation.
9. A remainder moves the digest to `sending`, resumed for at most `DIGEST_RESUME_DAYS` (3) from
   `approvedAt`. Past that the remainder drops and the maintainer is pinged (FR-054). A digest
   arriving on a resume day says so in its first line (FR-067).

### 2. `digest-draft`

1. `buildDigestDraft()` returns `null` unless the window holds `DIGEST_MIN_ITEMS` (3) items,
   **or** any `watchlist_removal` or `court_verdict`, **or** `DIGEST_REENGAGE_DAYS` (21) have
   passed since the last send (FR-057).
2. When the **injected** spend gate refuses, fall back to a template body with a note that the
   summary was skipped. **A budget refusal never returns `null`** (FR-058). The gate is a
   constructor argument so the test can inject a refusing one.
3. Insert the `Digest` with `status = 'awaiting_approval'`, `draftedAt = now()`, `alertIds`
   frozen, `code = randomBytes(6).toString('base64url')`.
4. Send the approval message to the **editor chat** with the three `dg:*` buttons, and store its
   returned `message_id` in `telegramMessageId` (FR-068).

### Response

```jsonc
200 { "expired": 0, "drafted": 1, "sent": 42, "remaining": 0, "status": "sending" }
```

---

## `GET /api/cron/subscription-health`

**Not hosted on `gdpr-retention-sweep.ts`** (FR-074). That file is a bare
`inngest.createFunction` with no Actions and no Vercel caller, on the scheduler that
`app/apps/web/src/lib/cron-bypass.ts:1-21` records as having blown its quota three times, with
mass "Invalid signature" 401s as the live symptom. A watchdog for a silent-failure feature must
not sit on the least reliable runner in the repository.

### Order

1. **Read the previous `lastRunAt`** from `SubscriptionHealthAlert` *before* writing the new
   one. The heartbeat condition compares against the previous value.
2. Evaluate the five conditions (FR-076).
3. **Write `lastRunAt = now()` unconditionally**, whether or not anything fired — otherwise a
   healthy stretch looks identical to a stopped watchdog.
4. If any condition fired: `INSERT … ON CONFLICT (day) DO NOTHING RETURNING day`, and send the
   Telegram message **only when a row comes back** — at most one ping a day (FR-075).

### The five conditions

| # | Condition | Threshold | Note |
|---|---|---|---|
| 1 | The oldest `channelSentAt IS NULL AND revokedAt IS NULL` row is older than | `HEALTH_FLUSH_HOURS` = 2 | **Suppressed entirely while `TELEGRAM_PUBLIC_CHANNEL_ID` is unset** (FR-077), or the kill switch pings daily for as long as it is on |
| 2 | A `Digest` has sat `awaiting_approval` longer than | `HEALTH_APPROVAL_HOURS` = 24 | |
| 3 | The last `sent` digest is older than | cadence + 2 days | |
| 4 | `EmailSendLedger.reservedCount[today]` exceeds the day's `SUM(Digest.sentCount)` by more than | 10 | The reservation-leak reconcile. **The only way a leak is ever detected.** |
| 5 | **The heartbeat is stale** — the route has not run for | `HEALTH_HEARTBEAT_HOURS` = 26 | **The only condition that catches the watchdog itself stopping** (FR-078). It must not depend on the scheduler that runs conditions 1–4; when Actions stops firing, the next run — including a manual `workflow_dispatch` — reports the gap. |

### The ping

A plain `fetch` to the Bot API from `app/packages/db/src/subscription-health-alert.ts`, copying
`app/packages/db/src/llm-api-failure-alert.ts:24-36`. **It does not import the web app's
telegram module**, so the alert still works when that module is what broke.

**A separate table from `LlmApiFailureAlert`** (FR-075). One row per day in a shared table would
let an LLM alert suppress a subscription alert for the rest of that day — and a six-week silence
of exactly that kind is why `LlmApiFailureAlert` exists at all.

### Response

```jsonc
200 { "fired": ["stale-flush"], "pinged": true, "heartbeatGapHours": 0.3 }
```

---

## Contract tests

| # | Assertion | Requirement |
|---|---|---|
| C1 | Every route returns 401 without the `Authorization: Bearer $CRON_SECRET` header | — |
| C2 | `flush-alerts` with `TELEGRAM_PUBLIC_CHANNEL_ID` unset returns `{sent: 0}` and issues **no** UPDATE | FR-022 |
| C3 | Two concurrent `flush-alerts` calls against the same unsent rows post each row exactly once | FR-023 |
| C4 | A Telegram 429 mid-batch stops the run; the unposted rows keep `channelSentAt` set from the claim, and the loss is one batch, not a duplicate | FR-024, FR-027 |
| C5 | `digest-send` expires a 49-hour-old `awaiting_approval` draft before any other work, and never expires a `sending` one | FR-066 |
| C6 | The recipient query returns no `pending`, `unsubscribed`, `bounced` or `complained` row | FR-094 |
| C7 | A subscriber whose `confirmedAt` is later than `draftedAt` is excluded | FR-060 |
| C8 | A discard leaves every `lastDigestCursorAt` unchanged | FR-065 |
| C9 | `subscription-health` writes `lastRunAt` on a run where nothing fired | FR-078 |
| C10 | Two firing conditions on the same day produce exactly one Telegram send | FR-075 |
| C11 | Condition 1 does not fire while `TELEGRAM_PUBLIC_CHANNEL_ID` is unset, even with stale rows present | FR-077 |
| C12 | The workflow file exists at `/.github/workflows/subscriptions.yml` and **not** under `app/` — a repository-shape test, because the failure is otherwise invisible | FR-029 |
