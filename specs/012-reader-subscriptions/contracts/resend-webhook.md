# Contract — the email sender and the delivery webhook

**Feature**: `012-reader-subscriptions`
**Files**: `app/packages/shared/src/email.ts`, `app/apps/web/app/api/webhooks/resend/route.ts`

**No new npm dependency.** Native `fetch` to send; `node:crypto` to verify. The `resend` SDK
and the `svix` package are both deliberately not installed.

**Constitution note — settled, nothing outstanding.** Resend was on Principle III's
forbidden-substitutions list in constitution v1.0.0. **The amendment landed on 2026-09-01:
v1.0.0 → v2.0.0 (MAJOR, per the constitution's own versioning policy for a Principle III stack
substitution).** Resend is now a locked-in service — **Email: Resend** — and the constraints
below are binding constitution text, not this contract's preferences:

| Binding constraint (constitution v2.0.0, Principle III) | Where this contract meets it |
|---|---|
| Send path only. Never a queue, a scheduler or a data store; the subscriber list of record lives in Postgres | `sendBatch` is one `fetch` to `/emails/batch`. State lives in `Subscriber` and the reservation ledger |
| The sending domain MUST be the subdomain `mail.kegyencjarat.hu`, **never the apex** — the apex domain's existing mail forwarding and sending reputation must be unaffected | `RESEND_FROM` is set to a `@mail.kegyencjarat.hu` address, e.g. `Kegyencjárat <hirlevel@mail.kegyencjarat.hu>`. An apex `from` is a configuration defect, not a preference |
| Every bulk send MUST carry RFC 8058 one-click headers — `List-Unsubscribe` with **both** an `https:` and a `mailto:` value, plus `List-Unsubscribe-Post: List-Unsubscribe=One-Click` | `unsubscribeHeaders`, below, and contract test E3 |
| Addresses encrypted at rest, decrypted **only at the moment a message is addressed**; a plaintext address MUST NOT reach a log line or an audit-record detail field | `emailEnc` / `encryptPii`; the webhook looks rows up by `hashSubscriberEmail`, never by the raw address (FR-081, FR-091) |
| The free-tier caps (100/day, 3,000/month) MUST be enforced **in the application** by a shared reservation ledger keyed on the database's `current_date` — never assumed of the provider | "The budget" section below; `remaining` reads `reservedCount`, and the clock is the database's `current_date` |

---

## `packages/shared/src/email.ts`

Modelled on `packages/shared/src/slack.ts`: env-gated, never throws, returns a result object.

```ts
export type SendResult = { sent: number; failed: number; error?: string };

export async function sendBatch(
  messages: Array<{
    to: string;
    subject: string;
    text: string;
    html: string;
    headers: Record<string, string>;
  }>,
): Promise<SendResult>;

export function unsubscribeHeaders(token: string): Record<string, string>;
```

### `sendBatch`

- `POST https://api.resend.com/emails/batch`, `Authorization: Bearer ${RESEND_API_KEY}`.
- **At most 100 messages per call.** The caller chunks.
- `from` comes from `RESEND_FROM`.
- **`RESEND_API_KEY` unset → returns `{ sent: 0, failed: 0 }` without a network call** (FR-047).
- **Never throws.** A network failure, a non-2xx, or a malformed response all return
  `{ sent: 0, failed: messages.length, error }`. The caller releases its ledger reservation on
  a non-zero `failed`.

Add `"./email": "./src/email.ts"` to the `exports` map in `app/packages/shared/package.json`.
The map has fourteen explicit entries and **no wildcard**, so the import fails at build without
it.

### `unsubscribeHeaders` — a separate pure function

The exact spelling is load-bearing for Gmail, so it gets its own function and its own test
(FR-042):

```
List-Unsubscribe: <https://www.kegyencjarat.hu/hirlevel/leiratkozas?t=TOKEN>, <mailto:leiratkozas@kegyencjarat.hu?subject=unsubscribe>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

**The `mailto:` value is required, not optional.** A corporate scanner cannot trigger a mailto,
and Gmail expects one alongside the web address. RFC 8058 covers only the
`List-Unsubscribe-Post` URL — never the body link a human clicks — which is why the body link
must additionally be GET-safe (see `subscription-api.md`).

### Templates

Hungarian, **plain-text-first with an HTML twin**. Each carries the unsubscribe link and a
footer naming the controller. **No reader-supplied text ever appears in a confirmation
message** (FR-080) — the form collects no name and no free-text field, which is what stops the
confirmation message being used to carry an attacker's words to a third party.

---

## The budget (FR-048 to FR-054)

```
remaining = min(
  DIGEST_DAILY_SEND_CAP,            // 90
  RESEND_DAILY_LIMIT                // 100
    − reservedCount[current_date]
    − SUBSCRIBE_CONFIRM_RESERVE     // 10
)
```

Read from the named constants, never a literal. **`remaining` reads `reservedCount`, never
`sentCount`** — only reservations bound concurrent senders (FR-048).

| Rule | Detail |
|---|---|
| Reserve before sending | `INSERT … ON CONFLICT (day) DO UPDATE … RETURNING "reservedCount"` — see data-model.md |
| Release on refusal or failure | `UPDATE … SET "reservedCount" = "reservedCount" − $1` — without it, one failed batch permanently reduces the day's capacity |
| One clock | The database's `current_date`, always (FR-050). The Actions schedule is UTC, the editorial rhythm is Budapest, the provider quota resets UTC. |
| Monthly ceiling | Evaluated **per send batch**, not per digest, so a `sending` digest crossing a month boundary is handled (FR-053) |
| The daily cap binds; the monthly does not | 90 × 31 = 2,790, under `RESEND_MONTHLY_LIMIT` 3,000 |
| Confirmations | Their own global daily cap, `SUBSCRIBE_CONFIRM_DAILY_CAP = 50`, counted across every address, holding a `SUBSCRIBE_CONFIRM_RESERVE = 10` set-aside inside the daily total (FR-052) |
| Real audience ceiling | ≈ 270 per weekly digest — 90 a day for `DIGEST_RESUME_DAYS = 3`. Crossing it **pings the maintainer** rather than degrading into permanent partial sends (FR-054). |

**`SUBSCRIBE_CONFIRM_DAILY_CAP` is a security bound, not a throughput setting.** It is the
blast radius of a bot run that defeats the honeypot and the per-address thresholds: at most 50
unsolicited confirmation messages in one day, from a domain with no sending reputation, before
the cap stops it and the FR-079 burst ping reaches the editor. **Raising it raises the blast
radius by the same amount.** A capacity problem is solved by raising `DIGEST_DAILY_SEND_CAP` or
the provider tier, never this. That sentence goes in the code, beside the constant.

---

## `POST /api/webhooks/resend`

`export const runtime = 'nodejs'`. **Unauthenticated by design** — the signature is the
authentication.

### Verification — Svix scheme, by hand (FR-055)

```ts
const raw = await req.text();                 // FIRST. Before any parse.
const id        = req.headers.get('svix-id');
const timestamp = req.headers.get('svix-timestamp');
const sigHeader = req.headers.get('svix-signature');   // "v1,<b64> v1,<b64> …"

// 1. ±5-minute window on `timestamp`, or reject.
// 2. secret = base64decode(RESEND_WEBHOOK_SECRET.replace(/^whsec_/, ''))
// 3. expected = base64(hmacSha256(secret, `${id}.${timestamp}.${raw}`))
// 4. Any space-separated "v1,<sig>" entry matching `expected` under
//    timingSafeEqual (after a length check) passes. Otherwise 400.
```

**Read the raw body first.** Parsing before reading it means signing different bytes than
arrived. This is the single most common way this verification is got wrong.

Only after verification: `JSON.parse(raw)`.

### The bounce state machine

Look the row up by `hashSubscriberEmail(payload.data.to)` — the same canonicalisation as the
subscribe route (FR-082). **Never persist the raw address.**

| Provider event | Effect on `Subscriber` |
|---|---|
| `email.bounced`, hard | `status = 'bounced'`, `lastBounceAt = now()` |
| `email.bounced`, soft | `bounceCount += 1`, `lastBounceAt = now()`; at `bounceCount >= 3` → `status = 'bounced'` |
| `email.complained` | `status = 'complained'`. **Terminal. Never reversed.** |
| `email.delivered`, `email.sent`, anything else | Ignored. `200 { ok: true }`. |

An unknown `emailHash` is a no-op with `200 { ok: true }` — the webhook reveals nothing about
which addresses are on the list.

### Responses

| Case | Status |
|---|---|
| Verified and handled | `200 { "ok": true }` |
| Verified, unknown address | `200 { "ok": true }` |
| Missing header, bad signature, stale timestamp | `400` |
| `RESEND_WEBHOOK_SECRET` unset | `400` — refuse, never accept unverified |

### Back-out note

**The webhook still accepts posts after `RESEND_API_KEY` is unset.** The key gates sending, not
receiving. When email is backed out, **disable the webhook at the provider too**, or bounce
events keep mutating `Subscriber` rows for a channel that is off. This row is in plan.md →
Rollback and is repeated here because it is the one an implementer reading only this file would
miss.

---

## Contract tests

| # | Assertion |
|---|---|
| E1 | `sendBatch` with `RESEND_API_KEY` unset returns `{sent: 0, failed: 0}` and performs no `fetch` |
| E2 | `sendBatch` never throws on a network rejection, a 500, or a malformed body; it returns non-zero `failed` |
| E3 | `unsubscribeHeaders` emits `List-Unsubscribe-Post: List-Unsubscribe=One-Click` exactly, and a `mailto:` value alongside the `https:` one |
| E4 | Svix verification passes on a known-good fixture and fails on a tampered body, a tampered signature, and a timestamp outside ±5 minutes |
| E5 | The webhook reads the raw body before parsing — asserted by a fixture whose JSON re-serialises differently than it arrived |
| E6 | A complaint sets `complained` and a later delivered event does not clear it |
| E7 | Capacity math: with `reservedCount = 20`, `remaining` is `min(90, 100 − 20 − 10) = 70` |
| E8 | A failed batch releases exactly what it reserved — `reservedCount` returns to its pre-call value |
