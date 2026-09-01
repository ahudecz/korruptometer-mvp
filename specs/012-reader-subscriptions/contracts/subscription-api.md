# Contract — the subscription API

**Feature**: `012-reader-subscriptions`
**Routes**: `app/apps/web/app/api/hirlevel/{feliratkozas,megerosites,leiratkozas}/route.ts`
**Runtime**: `nodejs`. `export const dynamic = 'force-dynamic'`.

Every response body is Hungarian. Every route returns JSON except the two GET page routes,
which are React pages under `app/apps/web/app/hirlevel/`.

**Two rules bind every route here.** No GET mutates (FR-034). No response distinguishes a known
address from an unknown one (FR-043), except the paused response (FR-044), which is about the
channel and not about the address.

---

## `POST /api/hirlevel/feliratkozas`

### Request

```jsonc
{
  "email":    "olvaso@example.hu",          // required
  "sections": ["resignation", "court_verdict"], // required, ≥1, from SUBSCRIPTION_SECTIONS
  "cadence":  "weekly",                     // optional, "daily" | "weekly", default "weekly"
  "website":  ""                            // the honeypot. MUST be empty.
}
```

`website` is the honeypot field name. It is deliberately not `email`, `name`, `tel` or any other
name a password manager or browser autofill recognises (FR-089).

### Check order — cheapest first, no database work before step 4 (FR-095)

| # | Check | On failure |
|---|---|---|
| 1 | **Honeypot** — `checkHoneypot(body.website)` from `@/lib/poll-validation` | `400 { error: "A beküldés nem sikerült." }` — the same generic text an invalid submission returns. **Zero database calls.** |
| 2 | `subscribeIpHourLimiter()` — `SUBSCRIBE_IP_HOURLY_LIMIT ?? 3` per hour, key `subh:{ip}` | `429 { error: "Túl sok feliratkozási kísérlet erről a hálózatról. Próbáld újra később." }` |
| 3 | `subscribeIpLimiter()` — `SUBSCRIBE_IP_DAILY_LIMIT ?? 20` per day, key `subd:{ip}` | `429`, same shape |
| 4 | Zod — address shape, `sections` non-empty and each member in `SUBSCRIPTION_SECTIONS`, `cadence` in `digest_cadence` | `400 { error: "A beküldés nem sikerült." }` |
| 5 | Role-address refusal (`info@`, `admin@`, `postmaster@`, `noreply@`, …) and disposable-domain refusal (FR-045) | `400`, same generic text |
| 6 | `RESEND_API_KEY` unset → **the paused branch** (FR-044) | `503 { paused: true, message: "A feliratkozás átmenetileg szünetel." }` — a distinct response, **not** a false 201 |

Steps 1–5 perform **no database read and no database write**. A request the honeypot rejects
does no database work at all.

### Then, in order

7. `emailHash = hashSubscriberEmail(email)` — `sha256(email.trim().toLowerCase())`.
8. Look the row up by `emailHash`.
   - **Erased tombstone** (`purgePiiAt` passed, `emailEnc IS NULL`) → return the uniform 201.
     Send nothing (FR-045, User Story 6 scenario 5). The reader who reaches the confirmation
     page for an erased address sees "Ezt a címet nem tudjuk feliratkoztatni."
   - **`active`** → update `sections` and `cadence` **in place**. Send nothing. Uniform 201
     (FR-090).
   - **`pending` inside `CONFIRM_COOLDOWN_MINUTES`** → send nothing. Uniform 201 (FR-090).
   - **`complained`** → send nothing. Uniform 201.
9. Otherwise insert or revive, writing `emailEnc` (`encryptPii`), `emailHash`, `sections`,
   `cadence`, `consentTextVersion = CONSENT_TEXT_VERSION`, `signupIpHash`, `status = 'pending'`.
10. **Enqueue** the confirmation job. It reserves ledger budget and increments
    `confirmSentCount` **in one transaction** (FR-038). No provider call happens on the request
    path.
11. Count signups sharing this `signupIpHash` in the last hour. Over `SIGNUP_BURST_THRESHOLD`
    (10), ping the editor chat (FR-079). Its own hourly marker — **never** the health check's
    daily one.
12. `AuditLog` row: `action = 'subscriber.subscribe'`, `entityType = 'Subscriber'`,
    `entityId = <subscriber id>`, `detail = { sections, cadence, emailHashPrefix }`.
    **No address in readable form** (FR-091).

### Response — identical from every non-paused branch

```
201 { "ok": true, "message": "Elküldtük a megerősítő levelet. Nézd meg a postaládád." }
```

**Residual, stated not hidden** (A10): the tombstone branch is one SELECT and the new branch is
a SELECT, an INSERT and an enqueue. Keeping the provider call off the request path narrows the
timing oracle. It does not make the route constant-time.

### Rate-limit keys

| Limiter | Prefix | Default | Env |
|---|---|---|---|
| `subscribeIpHourLimiter()` | `subh` | 3 / 1 h | `SUBSCRIBE_IP_HOURLY_LIMIT` |
| `subscribeIpLimiter()` | `subd` | 20 / 1 d | `SUBSCRIBE_IP_DAILY_LIMIT` |

Both are declared in `app/packages/shared/src/ratelimit.ts` via the module-private `getOrCreate`
factory (`:58-62`), which is the only path carrying the in-memory fallback for an environment
with no Upstash. **Neither is `pollVoteIpLimiter`** — see research.md → R4.

---

## `GET /api/hirlevel/megerosites?t=<token>` — and the page at `/hirlevel/megerosites`

**Mutates nothing.** Ever (FR-034).

Renders the same page for a valid token, an expired token and an invented token —
**byte-identical apart from the form nonce** (FR-035):

> Erősítsd meg a feliratkozásod.

with a POST button. Validity is revealed only after the reader submits.

Rate limit: `subscribePageLimiter` — 240 / IP / hour, prefix `subpg`.

**Why**: SafeLinks, Proofpoint and Mimecast GET every link on delivery. A single-use token
consumed on GET is burned before the reader clicks, and the `CONFIRM_MAX_SENDS` cap then locks
that address out permanently and silently.

## `POST /api/hirlevel/megerosites`

### Request

```jsonc
{ "t": "<the token from the query string>" }
```

### Order

1. `confirmTokenLimiter()` — 5 per **token id** per hour, prefix `cfmt`. The per-token key is
   required because a shared corporate egress address defeats a per-address key (FR-046).
2. `confirmIpLimiter()` — 60 / IP / hour, prefix `cfmi`.
3. `sha256(token)`; look up by `confirmTokenHash`.
4. Reject when the hash is null, unknown, or `confirmTokenExpiresAt` has passed.
5. Set `confirmedAt = now()`, `confirmedIpHash`, `status = 'active'`, `confirmTokenHash = NULL`
   (single use, FR-036).
6. `AuditLog`: `action = 'subscriber.confirm'`.

### Responses

| Case | Body |
|---|---|
| Confirmed | `200 { "state": "confirmed", "message": "Kész. Mostantól kapsz értesítést." }` |
| Already active | `200 { "state": "already", "message": "Ez a feliratkozás már aktív." }` |
| Expired | `200 { "state": "expired", "message": "Ez a link lejárt.", "resend": true }` |
| Unknown or tampered | **Identical to expired** |
| Erased address | `200 { "state": "erased", "message": "Ezt a címet nem tudjuk feliratkoztatni." }` |

## `POST /api/hirlevel/megerosites/ujra` — "Küldj újat"

Reachable only from the expired state. **Resets `confirmSentCount` to 0** when the previous
token expired unused (FR-037), then enqueues a new confirmation. Without the reset, the cap of
3 collides with the 24-hour expiry and locks out anyone who reads their mail the following
evening.

Shares the `confirmIpLimiter` budget.

---

## `GET /api/hirlevel/leiratkozas?t=<token>` — and the page at `/hirlevel/leiratkozas`

**Mutates nothing.** Ever (FR-034). Byte-identical for valid, expired and invented tokens apart
from the nonce (FR-035).

> Biztosan leiratkozol?

with a POST button. Rate limit: `subscribePageLimiter`, 240 / IP / hour.

**RFC 8058 does not protect this route.** 8058 covers only the `List-Unsubscribe-Post` header
URL, never the body link a human clicks.

## `POST /api/hirlevel/leiratkozas`

Two callers, one handler.

1. **The reader**, from the page form: `{ "t": "<token>" }`.
2. **The mail client**, one-click, from the `List-Unsubscribe-Post` header URL. The header URL
   carries the token in its query string and the body is
   `List-Unsubscribe=One-Click` — accept both shapes.

### Order

1. `confirmTokenLimiter()` (5 per token id per hour) and `confirmIpLimiter()` (60 / IP / hour).
2. `verifyUnsubToken(t)` — see the signed-link format below. **An unknown kid rejects.**
3. Set `status = 'unsubscribed'`, `unsubscribedAt = now()`,
   `purgePiiAt = now() + PURGE_DAYS` (30 days) (FR-085).
4. `AuditLog`: `action = 'subscriber.unsubscribe'`.

**Idempotent.** A second POST changes nothing further and returns the same body (FR-006 of the
success criteria, SC-006).

### Response

```
200 { "state": "unsubscribed", "message": "Leiratkoztál. Bármikor visszatérhetsz." }
```

Identical for an already-unsubscribed row.

---

## The signed unsubscribe link (FR-039 to FR-041)

**Signed bytes**: the UTF-8 of `unsub:v1:{kid}:{subscriberId}`, and nothing else. No URL, no
query string, no trailing newline.

**Token**:

```
base64url(payload) "." base64url(hmacSha256(secret, payload))
```

The MAC is 32 raw bytes → 43 base64url characters. A typical token is about 110 characters.

**URL**: `${NEXT_PUBLIC_SITE_URL}/hirlevel/leiratkozas?t=<token>`

**Verification**, in order:

1. Split on the **last** `.`; base64url-decode both halves.
2. Parse the kid out of the decoded payload's third field.
3. Select **that** key. `SUBSCRIBER_LINK_SECRET` (which also signs) or
   `SUBSCRIBER_LINK_SECRET_PREVIOUS` (which verifies only).
4. **An unknown kid rejects. Never fall through to trying every key.**
5. Length-check both MAC buffers, then `crypto.timingSafeEqual`.
6. **No time expiry** (FR-040). A delivered message must stay usable for as long as it sits in
   an inbox.

**Rotation**: copy the current value into `_PREVIOUS`, set a new `kid:secret`, deploy. Never
remove a `_PREVIOUS` while any inbox may hold a message signed with it.

`SUBSCRIBER_LINK_SECRET` is a distinct secret from `PII_ENC_KEY`, with a distinct rotation
schedule (FR-041). Deliberately **not** the `INTERNAL_REVALIDATE_SECRET ?? PII_ENC_KEY` fallback
used at `app/apps/web/app/api/admin/submissions/[id]/audit-pii-read/route.ts`.

---

## `POST /api/admin/subscribers/erase`

Admin-authenticated, matching the existing `app/apps/web/app/api/admin/**` pattern.

```jsonc
{ "email": "olvaso@example.hu" }
```

Calls `hashSubscriberEmail`, sets `purgePiiAt = now()`, writes an `AuditLog` row with
`action = 'subscriber.erase'` and the address **redacted** (FR-087, FR-091). The next retention
sweep nulls `emailEnc`, `signupIpHash`, `confirmedIpHash` and `confirmTokenHash`, and keeps
`emailHash`, `status` and `consentTextVersion` (FR-086).

Response: `200 { "ok": true, "scheduled": true }`. Identical whether or not the address existed.

---

## Every reader-facing state

Settled by the spec. Reproduced here so the route author does not invent a variant.

| State | Hungarian copy | Reader action |
|---|---|---|
| Confirmation page, any token | "Erősítsd meg a feliratkozásod." | Submit button |
| Confirmed | "Kész. Mostantól kapsz értesítést." | — |
| Already confirmed | "Ez a feliratkozás már aktív." | — |
| Expired token | "Ez a link lejárt." | "Küldj újat" |
| Unknown or tampered token | Identical to the expired state | "Küldj újat" |
| Unsubscription page | "Biztosan leiratkozol?" | Submit button |
| Unsubscribed, or already | "Leiratkoztál. Bármikor visszatérhetsz." | — |
| Confirmation after erasure | "Ezt a címet nem tudjuk feliratkoztatni." | Contact link |
| Email paused | "A feliratkozás átmenetileg szünetel." | — |
