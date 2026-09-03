# Contract — the Telegram surface

**Feature**: `012-reader-subscriptions`
**File**: `app/apps/web/app/api/telegram/webhook/route.ts`
**All line numbers are against `origin/main`** (1287 lines). This branch's copy is 1086 lines
and does not contain the code below. See plan.md → Prerequisites.

Two channels exist after this feature. They are separate modules and separate chat ids, and
crossing them is structurally impossible, not merely discouraged.

| | Editor chat | Public channel |
|---|---|---|
| Env var | `TELEGRAM_CHAT_ID` | `TELEGRAM_PUBLIC_CHANNEL_ID` |
| Module | `src/lib/telegram.ts` | `src/lib/telegram-public.ts` |
| Buttons | Yes — `replyMarkup` is argument 2 | **No `replyMarkup` parameter exists** |
| Formatting | as today | plain text, no `parse_mode` |
| Unset behaviour | as today | silent no-op — the kill switch (FR-022) |

---

## 1. The origin guard (FR-005) — ships first, alone

**Where**: immediately after the `if (!cq?.data || !cq.message)` early return at `:773-775`.

```ts
const allowedChatId = process.env.TELEGRAM_CHAT_ID;
if (!allowedChatId || String(cq.message.chat.id) !== allowedChatId) {
  return NextResponse.json({ ok: true });
}
```

**Why the `!allowedChatId` clause is not decoration**: comparing
`String(cq.message.chat.id) !== process.env.TELEGRAM_CHAT_ID` compares against `undefined` when
the variable is unset — always unequal — which silently bricks **every** editor button. The
guard must refuse loudly in code and quietly on the wire, which is what returning `{ ok: true }`
does.

**What it covers**: every existing button — `v` and `k` (hard-deletes, `:787`), `d`, `a`, `r`,
`n`, `s` (posts to Facebook), `a:wc:` — plus the `dg:*` set this feature adds, which **sends
email to the whole list**.

**Today's whitelist is not this**: the existing check at `:642-645` sits **inside**
`if (update?.message)` and guards plain text messages only. The `callback_query` handler
beginning at `:772` has no equivalent. It is safe today only because the bot posts keyboards
nowhere else. Phase 4 puts the same bot in a public channel.

**Contract test**: a button press whose `cq.message.chat.id` differs from `TELEGRAM_CHAT_ID`
performs **zero** `getDb()` calls; with `TELEGRAM_CHAT_ID` unset, **every** button press
performs zero.

---

## 2. The public channel sender

`app/apps/web/src/lib/telegram.ts` gains:

```ts
export async function sendTelegramMessageTo(
  chatId: string,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<number | null>
```

and `sendTelegramMessage(text, replyMarkup?)` becomes a delegate passing
`process.env.TELEGRAM_CHAT_ID`. **`replyMarkup` is argument 2 at roughly 40 call sites**, so a
third parameter on the existing function would be a trap; the new function takes the chat id
first.

Preserve the existing return of `result.message_id ?? null` (`telegram.ts:34-35`) through the
delegate — the digest reply seam depends on it.

`app/apps/web/src/lib/telegram-public.ts` is new:

```ts
export async function sendPublicChannelMessage(text: string): Promise<number | null>
```

- Reads `TELEGRAM_PUBLIC_CHANNEL_ID`. **Unset → returns `null` without a network call.**
- **Takes no `replyMarkup` parameter at all**, so an approve/reject keyboard cannot
  structurally reach a public audience (FR-021).
- Plain text. No `parse_mode`.
- `TELEGRAM_CHANNEL_RATE = 20/min` — the flush pauses between messages to stay under it.

---

## 3. The alert-recording call sites (FR-018)

Six. Every one calls `recordSubscriberAlert()` from
`app/apps/web/src/lib/notify-subscribers.ts`, which **never throws and performs no Telegram
I/O on the caller's path** (FR-013, FR-014).

| # | Where | Sections |
|---|---|---|
| 1 | `src/inngest/functions/detect-verdicts.ts:307` (auto-publish; insert at `:246`) | `court_verdict` |
| 2 | `src/inngest/functions/detect-resignations.ts`, after the insert at `:226` | `resignation` |
| 3 | `detect-media-closures.ts:159` and `detect-criminal-complaints.ts:147` (the inserts) | `media_closure`, `criminal_complaint` |
| 4 | `webhook/route.ts`, the `a` approve branch, via `outcome.recordId` / `outcome.recordIds` (`:617`, `:1264`) | five of six |
| 5 | `webhook/route.ts:787`, the `v`/`k` branch — **only the `k` press**, guarded by `ALERT_ON_EDITOR_CONFIRM` | `asset_recovery`, `watchlist_removal` |
| 6 | `webhook/route.ts:1036`, the `a:wc:` branch — `applyWatchlistRemoval(...)` — **ungated** | `watchlist_removal` |

Site 4 covers five and not six because `watchlist_removal` is absent from both
`DETECTOR_PROCESSORS` (`src/lib/telegram-review-actions.ts:614`, exclusion comment at `:624`)
and `setPendingStatus` (`webhook/route.ts:459`).

**Site 6 is the highest-value one.** `applyWatchlistRemoval`
(`src/lib/telegram-review-actions.ts:690`) calls no `notifyAutoPublished`, is not in
`DETECTOR_PROCESSORS`, and is not a detector insert — so sites 1–5 all miss it while it writes
two live rows. Ungated, because the `a:wc:` press **is** the human gate (A1). One alert, keyed
on the **person**; none for the paired resignation row (FR-017).

**Not call sites**: `detect-asset-recoveries.ts:169` and `detect-watchlist-removals.ts:169`.
Both notify on an automatic insert, and FR-016 says those two sections alert only after an
editor acts.

### The gate

```ts
export const ALERT_ON_EDITOR_CONFIRM: ReadonlySet<AutoPublishTarget> =
  new Set(['asset_recovery', 'watchlist_removal']);
```

`AutoPublishTarget` is `'court_verdict' | 'asset_recovery' | 'watchlist_removal'`
(`src/lib/notify-auto-publish.ts:19`) — a different, three-value union from
`SubscriptionSection`. This is the one carve-out FR-008 permits from FR-007, and a pinning test
asserts the set is exactly those two members.

---

## 4. Revocation (FR-019)

`revokeSubscriberAlert(dedupeKey)` is wired into **both** delete paths.

| Path | Where | Person id available? |
|---|---|---|
| `v` — "Visszavonás" on an auto-published row | `webhook/route.ts:790`, deletes at `:810` | **Yes** — `.returning({ personId, sourceUrl })` already exists at `:810`. Reuse it. |
| `deleteByCode` — the `d` / `td:` deletes | `webhook/route.ts:201-209` | **No.** Add `.returning({ personId: schema.watchlistRemovals.personId })` to the watchlist branch. |

For `watchlist_removal` the dedupe key needs the **person** id, not the row id, because
`applyWatchlistRemoval` uses `onConflictDoUpdate({ target: personId })` — a re-tap or a
revert-then-redetect would otherwise alert twice for one person (FR-015).

| Channel | Can `revokedAt` undo it? |
|---|---|
| The next digest | Yes — the send re-filters `revokedAt IS NULL` (FR-061) |
| An unflushed channel post | Yes — the claim predicate excludes revoked rows |
| An already-posted channel message | Only by a correction post |
| **Email already delivered** | **No. Unrecallable.** |

---

## 5. The digest callbacks

Three new `callback_data` codes. All are ≤ 13 bytes against Telegram's 64-byte limit.

| Code | Effect |
|---|---|
| `dg:a:{code}` | Approve. `status = 'approved'`, `approvedAt = now()`, then **`inngest.send({ name: 'digest.send' })`** and answer the callback immediately. **Never call `runDigestSendCore` inline** — a send to hundreds of recipients inside a callback handler risks a request timeout while Telegram waits, and a timeout with ledger reservations already taken is the leak case the health reconcile exists to detect. Waiting for the cron instead would leave an approval sitting unsent until the next morning, which the editor cannot tell apart from a broken button. Keep the existing branch shape — `answerCallbackQuery`, then `editMessageReplyMarkup` to strip the buttons and append the outcome line **"Kimehet — kiküldés folyamatban."** |
| `dg:x:{code}` | Discard. `status = 'discarded'`. **No reader's `lastDigestCursorAt` advances**, so the period is not lost (FR-065). |
| `dg:r:{code}` | Regenerate, capped at `DIGEST_MAX_REGEN = 1`. Rewrites `bodyHtml`, `bodyText`, `subjectHu`, **`draftedAt`** and **`telegramMessageId`**; increments `regenCount`. |

`{code}` is `randomBytes(6).toString('base64url')` → `DIGEST_CODE_CHARS = 8` characters
(FR-073). **Never put a uuid in new `callback_data`.** The tight existing case is
`a:wc:{personId}.{articleId}` at `:575`, which is why `WATCHLIST_ID_MAX = 22` is pinned by a
test over `WATCH_LIST`.

`draftedAt` is rewritten on `dg:r` because it decides which subscribers are excluded as too new
(FR-059). `telegramMessageId` is rewritten because a reply to the superseded message must stop
matching (FR-068).

---

## 6. The corrected-text reply seam — three edits, in this order

This seam does not exist. It is built, not reused.

### 6a. The type cannot carry the match today

`webhook/route.ts:211-220`:

```ts
type TelegramUpdate = {
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number; text?: string; caption?: string };
  };
  message?: {
    chat: { id: number };
    text?: string;                          // ← no message_id, no reply_to_message
  };
};
```

Add to the **`message`** member (the `callback_query.message` member at `:215` already has
`message_id`):

```ts
  message?: {
    chat: { id: number };
    message_id: number;
    reply_to_message?: { message_id: number };
    text?: string;
  };
```

### 6b. Where the branch goes — before **two** existing branches, not one

Insert immediately after the chat whitelist at `:642-645`, and therefore **before both** of
these:

| Existing branch | Where | What it would do to a corrected digest |
|---|---|---|
| The Social Post Outbox `pendingEdit` handler | `:653-698` | While any `SocialPostOutbox` row has `pendingEdit` set, **any** incoming text is consumed as that row's caption or image text. It matches on "the newest row with `pendingEdit` set" and never looks at `reply_to_message`. The editor's digest text would be silently saved as a Facebook caption. |
| `firstUrl(msg.text)` | `:707` | A corrected digest body contains links to the site. The reply would be ingested as a news tip and answered with a five-button review keyboard. |

**FR-069 names the second. The first is newer than the source plan and is the same class of
bug.** The digest branch matches on `reply_to_message.message_id`, which is exact, so the exact
match runs first and everything else keeps its current order behind it.

**Do not reorder the two existing branches relative to each other.** The `firstUrl`-first
ordering is deliberate and carries its own comment at `:701-706`, recording a 2026-07-13
mis-parse where a URL slug containing "visszavonas" was read as a revoke command.

### 6c. Behaviour

```ts
if (msg.reply_to_message) {
  const digest = await findDigestByTelegramMessageId(msg.reply_to_message.message_id);
  if (digest) {
    if (digest.status !== 'awaiting_approval') {
      // FR-071 — answer and mutate nothing
      await sendTelegramMessage('Ez a hírlevél már elment, vagy el lett vetve.');
      return NextResponse.json({ ok: true });
    }
    if (digest.regenCount >= DIGEST_MAX_REGEN) {
      await sendTelegramMessage('Ehhez a hírlevélhez már felhasználtad az egy átírást.');
      return NextResponse.json({ ok: true });
    }
    // FR-072 — a corrected-text reply consumes the SAME single budget as dg:r
    await applyCorrectedDigestBody(digest, msg.text);
    return NextResponse.json({ ok: true });
  }
  // FR-070 — no match: fall through, unchanged, to pendingEdit and firstUrl
}
```

| Case | Behaviour | Requirement |
|---|---|---|
| Reply matches a digest awaiting approval | The text becomes the body; `regenCount` +1 | FR-068, FR-072 |
| Reply matches a `sent` or `discarded` digest | Hungarian "már elment / el lett vetve"; **mutates nothing** | FR-071 |
| Reply matches no digest | Falls through to `pendingEdit`, then `firstUrl`, both unchanged | FR-070 |
| Reply body contains links to the site | Never reaches `firstUrl` | FR-069 |

---

## 7. Message shapes

### A public channel post

Plain text, no formatting mode, no buttons:

```
⚖️ Bírósági ítélet — {title}

{detail}

{url}
```

Verdicts and complaints share `/birosagi-iteletek`, which carries exactly one anchor,
`id="birosagi-iteletek"` on the verdict section (`app/apps/web/app/birosagi-iteletek/page.tsx:123`).
The complaint list on the same page has none, **so the message text must state which of the two
it is** (FR-031). The link cannot.

| Section | URL |
|---|---|
| `resignation` | `/lemondasok` (the only section with a detail page — `app/lemondasok/[id]/`) |
| `watchlist_removal` | `/lemondosok` |
| `media_closure` | `/megszunt` |
| `court_verdict` | `/birosagi-iteletek#birosagi-iteletek` |
| `criminal_complaint` | `/birosagi-iteletek` |
| `asset_recovery` | `/visszaszerzett-vagyon` |

### The digest approval message, to the editor chat

Carries the three `dg:*` buttons and the drafted body. Its `message_id` is stored in
`Digest.telegramMessageId`, which is what the reply seam matches on.

### A health ping, to the editor chat

Plain `fetch` to the Bot API, matching
`app/packages/db/src/llm-api-failure-alert.ts:24-36` — no import of the web app's telegram
module, so the alert works even if that module is what broke.
