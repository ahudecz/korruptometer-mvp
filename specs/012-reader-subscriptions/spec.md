# Feature Specification: Reader subscriptions — public Telegram channel and email digest

**Feature Branch**: `012-reader-subscriptions`
**Created**: 2026-09-01
**Status**: Draft
**Input**: User description: "Readers of the Hungarian corruption-tracking site can follow a public Telegram channel and/or subscribe by email to a per-section digest, with every subscriber-facing alert gated on a human editor's action."

## Context

The site cannot tell a reader when it publishes something new. The existing Telegram
integration is not a reader channel. It writes to one private editor chat and carries
Approve/Reject buttons. There are no subscribers and no opt-in anywhere in the product.

This feature adds both reader channels. It also closes one live gap found while mapping the
work: a Telegram button press does not check which chat it came from, and this feature is
about to put the same bot in front of a public audience.

Every irreversible surface in this feature is a silent one. A duplicate public post, a
delivered email and a flush that quietly stopped all fail without an error. The
requirements below therefore state failure behaviour, not only success behaviour.

**The six sections**: `resignation`, `media_closure`, `court_verdict`,
`criminal_complaint`, `asset_recovery`, `watchlist_removal`.

---

## Preconditions

**These are not tasks. No agent can perform them. They MUST NOT become numbered
functional requirements, and no later stage may emit them as work items.**

| # | Action | Owner | Blocks |
|---|---|---|---|
| P2 | Create the public Telegram channel, add the bot as an administrator, record the channel id | Owner: maintainer (manual, outside the repo) | Public channel delivery (FR-020…FR-031) |
| P3 | Create the email provider account and the sending domain. **AMENDED 2026-09-03.** The original wording required the provider's send-log retention to be set to 7 days or less before any send, and said to bring the matter back to the maintainer if the plan could not configure it. That is what happened: Resend keeps 30 days on Free, Pro and Scale alike and exposes no retention setting; only Enterprise is "Flexible" (verified on resend.com/pricing, 2026-09-03). The maintainer chose to accept 30 days rather than change provider or buy Enterprise. So: create the account and the sending domain `mail.kegyencjarat.hu`, set `RESEND_LOG_RETENTION_DAYS_DECLARED=30`, and make sure `/adatvedelem` states 30 days. No retention step remains to perform in the provider's dashboard | Owner: maintainer (manual, outside the repo) | Email delivery (FR-047…FR-055) |
| P4 | Publish the DKIM records and the subdomain SPF record; publish a DMARC record at `p=none` | Owner: maintainer (manual, outside the repo) | Email delivery (FR-047…FR-055) |

**P1 and P5 are withdrawn** as of 2026-09-01. They set, and then restored, a Cloudflare
Turnstile server secret. This feature uses no Turnstile (assumption A11), and the public tip
form is out of scope. P1 blocked nothing. P5 blocked FR-004 only, which is withdrawn with it.
The two identifiers are not reused, so the remaining numbering stays traceable.

DNS propagation has a lead time. P2, P3 and P4 start in parallel with the first code work.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editor buttons check their origin (Priority: P1)

An editor button press in Telegram only acts when it comes from the editor chat, so the bot
can safely enter a public channel later.

**Why this priority**: This feature puts the existing editor bot in front of a public
audience for the first time. The button handler does not check the originating chat today.
That window closes before any reader-facing work ships.

**Independent Test**: Press an editor button from a chat that is not the editor chat and see
that nothing changes in the database. Then unset the editor chat id and see that no button
press changes anything.

**Acceptance Scenarios**:

1. **Given** a button press whose originating chat is not the configured editor chat, **When** the bot handles it, **Then** no record is created, changed or deleted, and the bot answers without acting.
2. **Given** the editor chat id is not configured, **When** any button press arrives, **Then** no record is created, changed or deleted.

---

### User Story 2 - A reader follows the public Telegram channel (Priority: P1)

A reader joins one public Telegram channel. Every newly published item in the six sections
appears there as a short plain-text message with a link. The reader needs no account, gives
no personal data, and receives every section.

**Why this priority**: This is the whole reader promise with no personal data, no email
provider and no consent record. It ships on its own, before any email work.

**Independent Test**: Publish one item in each section through its normal editorial path.
Confirm one channel message per item, each with a working link, and no duplicates.

**Acceptance Scenarios**:

1. **Given** an editor approves a pending resignation, **When** the alert flush next runs, **Then** the public channel carries exactly one message for it, with a link to the matching page.
2. **Given** a detector publishes a court verdict automatically, **When** the flush runs, **Then** the channel carries one message, and the editor had at least the flush interval to revert it.
3. **Given** an asset recovery is published automatically, **When** no editor has acted on it, **Then** no channel message appears; the message appears only after the editor confirms it.
4. **Given** an editor confirms a manual watchlist removal, **When** the flush runs, **Then** exactly one message appears for that person, and the paired resignation record produces no second message.
5. **Given** an editor reverts or deletes a published item before the flush, **When** the flush runs, **Then** no message appears for it.
6. **Given** two flush runs overlap, **When** both select the same unsent rows, **Then** each row is posted exactly once.
7. **Given** the public channel id is not configured, **When** the flush runs, **Then** it posts nothing, marks nothing as sent, and reports zero messages sent.

---

### User Story 3 - A reader subscribes by email to the sections they choose (Priority: P2)

A reader gives an email address, ticks the sections they care about, and confirms the
address from a message in their inbox. They can leave at any time from any message, in one
click. Every page and message is in Hungarian.

**Why this priority**: Email carries per-section choice, which the single Telegram channel
cannot. It also carries personal data, a consent record and an unrecallable delivery, so it
follows the channel rather than leading.

**Independent Test**: Subscribe with a test address, confirm from the message, then
unsubscribe from a message link. Check that the stored address is encrypted, that the
consent record is present, and that no page changed any stored value on a plain page view.
Then submit once with the hidden honeypot field filled and see the request refused with no
database write.

**Acceptance Scenarios**:

1. **Given** a reader submits the form with a valid address and at least one section, **When** the request succeeds, **Then** the reader is `pending`, one confirmation message is sent, and the response is the same one every branch returns.
2. **Given** an address that is already subscribed, or one that was erased, **When** the reader submits it again, **Then** the response is indistinguishable from the new-subscriber response, and no second confirmation message is sent to an erased address.
3. **Given** a corporate mail scanner opens every link in the confirmation message, **When** it issues those plain page requests, **Then** no stored value changes and the reader's own confirmation still works afterwards.
4. **Given** a confirmation link that is valid, one that has expired, and one that is invented, **When** each is opened, **Then** the three pages are byte-identical apart from the form nonce.
5. **Given** a reader whose confirmation link has expired, **When** they ask for a new one, **Then** a new link is sent and the send counter resets to zero.
6. **Given** a confirmed reader, **When** they open an unsubscribe link and confirm it, **Then** they stop receiving messages, and repeating the action changes nothing further.
7. **Given** the email provider key is not configured, **When** a reader submits the form, **Then** the reader is told in Hungarian that subscription is paused, and the response is not a false success.
8. **Given** a submission whose hidden honeypot field carries any text, **When** the server handles it, **Then** it is rejected before any database read or write, and the failure text is the one an invalid submission returns.
9. **Given** a run that submits many addresses the owners never asked for, **When** the day's confirmation cap is reached, **Then** no further confirmation message is sent that day, no address receives anything but its one confirmation message, and the editor receives the signup-burst notification.

---

### User Story 4 - An editor approves every digest before it goes out (Priority: P2)

Before any digest reaches a single inbox, the editor receives the draft in Telegram. The
editor approves it, discards it, asks for one regeneration, or replies with corrected text.
Nothing is sent without that action.

**Why this priority**: A delivered email cannot be recalled. Human approval is the only
control that works on a one-way channel, so it is a condition of email shipping at all.

**Independent Test**: Build a draft, discard it, and confirm no message is sent and no
reader's position moves. Build a second draft, reply with corrected text, approve it, and
confirm the corrected text is what arrives.

**Acceptance Scenarios**:

1. **Given** a draft digest awaiting approval, **When** the editor approves it, **Then** it is sent only to subscribers who chose at least one of its sections.
2. **Given** the same draft, **When** the editor discards it, **Then** nothing is sent and every subscriber's position in the timeline is unchanged, so the period is not lost.
3. **Given** the same draft, **When** the editor asks for a regeneration, **Then** a new body is produced once; a second regeneration request is refused.
4. **Given** the editor replies to the approval message with corrected text that contains a link to the site, **When** the bot handles the reply, **Then** the text becomes the digest body and the bot does not treat the link as a news tip.
5. **Given** a reply to an approval message whose digest is already sent or discarded, **When** the bot handles it, **Then** it answers in Hungarian that the digest has gone, and changes nothing.
6. **Given** a reply that matches no digest, **When** the bot handles it, **Then** the existing tip and revert handling runs unchanged.
7. **Given** an item revoked between drafting and sending, **When** the digest is sent, **Then** that item is not in any delivered message.
8. **Given** a draft that no editor has answered for 48 hours, **When** the sender next runs, **Then** the draft is marked expired and never sent.

---

### User Story 5 - The maintainer learns when the alerts stop (Priority: P3)

Nothing about this feature throws an error when it stops working. The maintainer receives at
most one Telegram message a day when alerts, approvals, digests or the watchdog itself have
stalled.

**Why this priority**: The repository already learned this lesson once: a failure class ran
silently for six weeks and was found by hand. A watchdog is worth less than the feature, and
more than nothing.

**Independent Test**: Leave one alert unsent past the staleness threshold and confirm one
ping. Leave a second one and confirm no second ping the same day. Stop the watchdog and
confirm the stale-heartbeat condition fires when it next runs.

**Acceptance Scenarios**:

1. **Given** the oldest unsent alert is older than the flush staleness threshold, **When** the health check runs, **Then** the editor chat receives one message naming the reason.
2. **Given** a condition already pinged today, **When** the health check runs again, **Then** it sends no second message that day.
3. **Given** the public channel id is not configured, **When** unsent alerts accumulate, **Then** the health check sends no message about them.
4. **Given** the health check has not run for longer than the heartbeat threshold, **When** it next runs, **Then** it reports the gap.
5. **Given** the day's reserved email budget exceeds the day's recorded sends by more than ten, **When** the health check runs, **Then** it reports the gap.

---

### User Story 6 - A reader controls and removes their data (Priority: P3)

A reader can read what the site stores about them, on what legal basis, for how long, and how
to have it erased. When they unsubscribe, the personal data is removed on a stated schedule
and only the proof of past consent remains.

**Why this priority**: The feature collects personal data. The obligations attach the moment
the first address is stored, so they ship with the email work, not after it.

**Independent Test**: Subscribe, unsubscribe, run the retention pass with the clock advanced,
and confirm the address and the network-address hashes are gone while the consent record and
the suppression marker remain.

**Acceptance Scenarios**:

1. **Given** a reader on the subscription page, **When** they read it, **Then** it names the stored data including the network-address hash, the legal basis, the retention period and the erasure route.
2. **Given** a reader who unsubscribes, **When** the retention period passes and the purge runs, **Then** the address, the network-address hashes and the confirmation token are removed.
3. **Given** the same reader after the purge, **When** the record is read, **Then** the suppression marker, the status and the consent-text version are still present.
4. **Given** an erasure request for an address, **When** the maintainer runs the erase action, **Then** the record is scheduled for immediate purge and an audit record is written without the address in it.
5. **Given** an erased address, **When** anyone submits it to the subscription form again, **Then** no confirmation message is sent and the reader sees the Hungarian message for an address that cannot be subscribed.

---

### Edge Cases

- A corporate mail scanner opens every link in a message before the reader does.
- A reader reads their mail the next evening, after the confirmation link has expired.
- Two scheduled flush runs overlap, or one crashes half-way through a batch.
- The messaging service refuses further posts for rate reasons in the middle of a batch.
- The public channel id is removed as a kill switch while unsent alerts exist.
- The email provider key is removed while subscribers keep arriving.
- An item is revoked after the digest was drafted but before it was sent.
- An item is revoked after the digest was delivered. This is not recoverable.
- A reader confirms their address between the drafting and the sending of a digest.
- A send batch crosses a calendar month boundary.
- The audience is larger than three days of sending capacity.
- One person's watchlist removal is detected, reverted, then detected again.
- The editor's corrected digest text contains links to the site.
- The unsubscribe signing key is rotated while old messages sit in inboxes.
- A signed link presents a key identifier that no key matches.
- A recipient marks a digest as spam, or their mailbox rejects it repeatedly.
- The scheduled workflow is disabled automatically after a long period of repository inactivity.

## Requirements *(mandatory)*

### Functional Requirements

#### Editor button authorisation

- **FR-001 to FR-004**: Withdrawn on 2026-09-01. They specified a Cloudflare Turnstile challenge on the public tip form, its production hardening, its site key and its deploy order. This feature uses no Turnstile (assumption A11), and the tip form is out of scope (see Non-Goals). The four identifiers are not reused, so the numbering of every surviving requirement stays traceable.
- **FR-005**: A Telegram button press MUST perform no database change unless its originating chat identifier equals the configured editor chat identifier. When that identifier is unset, every button press MUST perform no database change.

#### Section vocabulary and language

- **FR-006**: The system MUST support exactly six subscription sections: resignation, media closure, court verdict, criminal complaint, asset recovery, watchlist removal.
- **FR-007**: One shared list MUST be the only source of the six section names. The validation schema, the storage enumeration, the form controls and the section-to-page map MUST all derive from it. No other file may spell a section name as a literal.
- **FR-008**: The one permitted carve-out is the editor-confirm gate set (FR-016), which is typed against a different three-value union. A test MUST pin its contents.
- **FR-009**: One shared map MUST hold the Hungarian reader-facing section names. The two existing editor-facing label maps MUST NOT be re-derived from it, because their wording differs and changing it would silently rewrite existing editor notifications. A test MUST assert that every key of each editor map has a counterpart in the reader map.
- **FR-010**: Every reader-facing string in this feature MUST be Hungarian: form labels, page copy, result states, message subjects, message bodies, footers and error text.
- **FR-011**: Reader-facing pages MUST use the project's existing design tokens. They MUST bind labels to controls, group the section checkboxes in a fieldset with a legend, and announce result states to assistive technology. The honeypot field of FR-089 MUST be hidden from assistive technology as well as from sight, so no screen-reader user ever fills it.

#### Alert recording and the human gate

- **FR-012**: The system MUST record one alert row when an item is newly published in any of the six sections, carrying the section, the source record identifier, a deduplication key, a title, a detail line, a link and the time of the event.
- **FR-013**: The alert recorder MUST return normally when the database rejects the insert. A test with an injected failing database MUST prove it never throws and never fails the caller's step.
- **FR-014**: The alert recorder MUST perform no messaging-service network call on the caller's path.
- **FR-015**: The deduplication key MUST be the section and the record identifier, except for watchlist removals, which MUST key on the person. Recording the same key twice MUST be a no-op.
- **FR-016**: Asset recoveries and watchlist removals MUST alert only after an editor action. The gate set MUST contain exactly those two sections.
- **FR-017**: A watchlist removal confirmed by the editor MUST produce exactly one alert, keyed on the person. The paired resignation record MUST produce no second alert.
- **FR-018**: Alerts MUST be recorded at each of the six publication points: the three detector auto-publish paths, the editor approve path, the editor auto-publish confirm path, and the manual watchlist-removal confirm path.
- **FR-019**: Reverting or deleting a published item MUST revoke its alert, through both deletion paths. A revoked alert MUST NOT be posted to the channel if it is still unsent, and MUST NOT appear in any digest.

#### Public channel delivery

- **FR-020**: One public Telegram channel MUST carry all six sections. Per-section filtering is an email-only capability.
- **FR-021**: Channel messages MUST be plain text with no message formatting mode and no inline keyboard. The channel sender MUST be structurally unable to attach buttons, so an approve/reject keyboard cannot reach a public audience.
- **FR-022**: When the public channel identifier is unset, the flush MUST post nothing, mark no row as sent, leave every row available for a later run, and report zero messages sent. This is the channel kill switch.
- **FR-023**: The flush MUST claim each row atomically before it posts. Two concurrent runs MUST post each row exactly once.
- **FR-024**: A crash between the claim and the post MUST lose that alert rather than post it twice. A missed alert is recoverable; a duplicate public post is not.
- **FR-025**: The flush MUST also run under a scheduling concurrency group that does not cancel a run in progress.
- **FR-026**: The flush MUST process at most `FLUSH_BATCH_SIZE` rows per run and pause between messages. The messaging rate ceiling MUST be a named constant, `TELEGRAM_CHANNEL_RATE`, not a literal.
- **FR-027**: A rate refusal from the messaging service MUST stop the run. The next scheduled run MUST resume from the unsent rows.
- **FR-028**: The flush MUST run on its own schedule, at `FLUSH_CRON`, from a scheduler outside the existing detection pipeline. Appending it to that pipeline is forbidden, because its last step is the one most likely to be truncated by the pipeline time budget.
- **FR-029**: The scheduled workflow MUST live where the platform actually reads workflows. A workflow placed where the platform never reads it is a silent no-fire, which is this feature's signature failure mode.
- **FR-030**: Each message MUST link to the page for its section. Four sections have no detail page and MUST link to their list page with the matching anchor.
- **FR-031**: Court verdicts and criminal complaints share one list page with no separate anchor, so the message text MUST state which of the two it is.

#### Subscription, confirmation and unsubscription

- **FR-032**: A reader MUST be able to give an email address, choose one or more sections, and choose a cadence. The default cadence is weekly.
- **FR-033**: A subscription MUST NOT become active until the reader confirms it from a message sent to that address.
- **FR-034**: No plain page request in this feature may change stored data. A test MUST assert that every subscriber field is identical before and after a plain request to the confirmation page and to the unsubscription page.
- **FR-035**: The confirmation page and the unsubscription page MUST render byte-identical responses for a valid token, an expired token and an invented token, apart from the form nonce. Validity is revealed only after the reader submits the form.
- **FR-036**: A confirmation token MUST be single-use and MUST expire after `CONFIRM_EXPIRY_HOURS`.
- **FR-037**: At most `CONFIRM_MAX_SENDS` confirmation messages may go to one address, with a cooldown of `CONFIRM_COOLDOWN_MINUTES` between them. The counter MUST reset to zero when the reader asks for a new link after the previous one expired unused.
- **FR-038**: The counter increment and the daily budget reservation MUST happen in one transaction, or the cap is unenforceable under concurrency.
- **FR-039**: Unsubscription links MUST be signed with a keyed message authentication code. The signed payload MUST carry a format version, a key identifier and the subscriber identifier. Verification MUST select the key by that identifier, check the length, and compare in constant time. An unknown key identifier MUST be rejected. Verification MUST NOT try every key in turn.
- **FR-040**: A previous signing key MUST verify but never sign. A key already used in a delivered message MUST NOT be removed while any inbox may still hold it. The signature MUST NOT carry a time expiry, because a delivered message must stay usable.
- **FR-041**: The signing key MUST be a distinct secret from the personal-data encryption key, with a distinct rotation schedule.
- **FR-042**: Every message MUST carry one-click unsubscription headers and a link a reader can click. The header set MUST include a mail address value alongside the web address, because scanners cannot trigger a mail address and major providers expect it.
- **FR-043**: The subscription request MUST return the same response for a new address, an already active address and an erased address, so the form cannot be used to test whether an address is subscribed.
- **FR-044**: When the email provider key is unset, the subscription request MUST return a distinct paused response and the reader MUST see the Hungarian paused message. Returning a false success to a reader who will never receive mail is forbidden.
- **FR-045**: The system MUST refuse role addresses, disposable domains and any address whose suppression marker exists.
- **FR-046**: Rate limits MUST be applied per route and per verb: the subscription request at 3 per network address per hour and 20 per day; the confirmation and unsubscription page requests at 240 per network address per hour; their submissions at 5 per token per hour plus 60 per network address per hour. The per-token key is required, because a shared corporate egress address defeats a network-address key.
- **FR-089**: The subscription form MUST render a hidden honeypot field, and the subscription route MUST check it. Both halves are new work; neither exists today. The field MUST be hidden from sight and from assistive technology, and MUST NOT be one a password manager or a browser autofill would complete. The route MUST run that check first, before every other check and before any database read or write, and MUST reject a filled field with the same generic Hungarian failure text an invalid submission returns, so a bot learns nothing about which check refused it. The check MUST reuse the shared honeypot helper the poll vote route already calls, not a second implementation of the same test. This layer excludes simple bots only. It is the cheapest check, not the bound on abuse; FR-052 states the bound.
- **FR-090**: A submission for an already active address MUST update that reader's sections and cadence in place and send no confirmation message. A submission for a pending address still inside the cooldown MUST send no message. Both MUST return the uniform response of FR-043.
- **FR-091**: The subscription, confirmation and unsubscription actions MUST each write an audit record. No audit record may contain the address in readable form.
- **FR-092**: The site MUST offer three entry points to subscription: a numbered section on the home page placed after the existing tip call to action, a dedicated subscription page, and a footer link.
- **FR-093**: The daily per-network-address threshold on the subscription request (FR-046) MUST be produced by the shared rate-limit module's own factory and exported from that module as a named limiter, in the same shape as the existing poll-vote limiter. A route MUST NOT build a bespoke limiter, because the factory is module-private and only it carries the in-memory fallback for an unconfigured store, so a bespoke limiter would silently fail open in any environment without that store. The threshold MUST be a named, environment-tunable setting whose default is the FR-046 daily figure.
- **FR-094**: Double opt-in is the primary control against address relay abuse, and the specification MUST be read that way. A `pending` subscriber MUST receive nothing except its own confirmation message. No digest, no channel content and no other mail may be addressed to a row that is not `active`. A test MUST prove that a digest send selects no `pending` row. An attacker who submits other people's addresses therefore cannot make the system send those people bulk mail; the worst outcome is the bounded set of confirmation messages that FR-037 and FR-052 cap.
- **FR-095**: The subscription request MUST run its checks cheapest first: the honeypot (FR-089), then the network-address thresholds (FR-046 and FR-093), then the address format, the role-address refusal and the disposable-domain refusal (FR-045), and only then any database read or write. A request the honeypot rejects MUST cause no database work at all.
- **FR-096**: Removing the third-party challenge (A11) promotes three existing controls from backstop to primary bound. They are the per-address-hash confirmation cap and cooldown (FR-037), the global daily confirmation cap (FR-052), and the rule that no reader-supplied text reaches a confirmation message (FR-080). No later stage may weaken any of the three on the grounds that another layer covers it. No other layer covers it.

#### Email delivery and budget

- **FR-047**: The email sender MUST never throw. It MUST report the number sent and the number failed, and it MUST do nothing when its key is unset.
- **FR-048**: The system MUST reserve daily send budget before it sends, and MUST release the reservation when a batch is refused or fails. Remaining capacity MUST be computed from reservations, never from completed sends, because only reservations bound concurrent senders.
- **FR-049**: Only one sender may run at a time for a given digest.
- **FR-050**: All budget dates MUST come from one clock — the database's own date — because the schedule and the provider quota use different time zones.
- **FR-051**: Daily digest capacity MUST be `min(DIGEST_DAILY_SEND_CAP, RESEND_DAILY_LIMIT − reserved today − SUBSCRIBE_CONFIRM_RESERVE)`, read from the named constants, giving at most 90 sends a day. `SUBSCRIBE_CONFIRM_RESERVE` appears here as a budget set-aside. It is also one half of a security bound; FR-052 states the other half and governs both.
- **FR-052**: `SUBSCRIBE_CONFIRM_DAILY_CAP` is the blast radius of a successful bot run against the subscription form, and MUST be treated as a security bound, not as a throughput setting. Confirmation messages MUST share one global daily cap of `SUBSCRIBE_CONFIRM_DAILY_CAP`, counted across every address, and MUST hold their own set-aside of `SUBSCRIBE_CONFIRM_RESERVE` inside the daily total. A bot that defeats the honeypot (FR-089) and the network-address thresholds (FR-046, FR-093) can therefore cost at most 50 unsolicited confirmation messages in one day, sent from a domain with no sending reputation, before the cap stops it and the signup-burst ping of FR-079 reaches the editor. **Raising this number raises the blast radius by the same amount.** No later stage may raise it for capacity reasons. A capacity problem is solved by raising `DIGEST_DAILY_SEND_CAP` or the provider tier, never by raising this cap.
- **FR-053**: The monthly provider limit MUST be evaluated per send batch, not per digest, so a send that crosses a month boundary is handled correctly.
- **FR-054**: A digest whose audience exceeds `DIGEST_RESUME_DAYS` of daily capacity MUST notify the maintainer rather than degrade into permanent partial sends. Real capacity is about 270 recipients per weekly digest.
- **FR-055**: The delivery webhook MUST verify the provider's signature over the raw request body within a five-minute window, using the platform's own cryptography, with no new dependency. A hard bounce MUST set the bounced status; a soft bounce MUST suppress after three; a spam complaint MUST be terminal. Lookup MUST use the address hash. The raw address MUST NOT be stored by the webhook.

#### Digest content and editor review

- **FR-056**: No digest may be sent without an editor action. The editor MUST be able to approve, discard, or request one regeneration, capped at `DIGEST_MAX_REGEN`.
- **FR-057**: A draft MUST NOT be built unless it holds at least `DIGEST_MIN_ITEMS` items, or holds any watchlist removal or court verdict, or `DIGEST_REENGAGE_DAYS` have passed since the last send.
- **FR-058**: When the language-model spend gate refuses, the draft MUST fall back to a template body carrying a note that the summary was skipped. A budget refusal MUST NEVER suppress a digest. A test with an injected refusing spend gate MUST prove it.
- **FR-059**: The draft time MUST be rewritten on every regeneration, because it decides which subscribers are excluded as too new. A stale draft time would silently change the audience between two approval messages.
- **FR-060**: Subscribers who confirmed after the draft time MUST be excluded from that digest, or a reader with no prior position would receive the entire frozen set.
- **FR-061**: The item list MUST be re-filtered for revocations at send time, because the list is frozen at draft time.
- **FR-062**: Each recipient MUST receive only items in their chosen sections that occurred after their own last position.
- **FR-063**: Recipients MUST be ordered so that the least recently served come first, so the same tail is not last every time.
- **FR-064**: Each recipient's last-sent time and position MUST be written per successful send, not per batch.
- **FR-065**: A discarded digest MUST NOT advance any reader's position, so the period is not lost.
- **FR-066**: A draft awaiting approval for more than `DIGEST_APPROVAL_EXPIRY_HOURS` MUST be marked expired by the sender before it does anything else. Expiry MUST NEVER apply to a digest already sending.
- **FR-067**: A digest that arrives on a later resume day MUST say so in its first line.
- **FR-068**: The editor MUST be able to reply to the approval message with corrected text, which becomes the digest body. Matching MUST use the stored approval message identifier, and a regeneration MUST overwrite that identifier.
- **FR-069**: The corrected-text branch MUST be evaluated before the link-detection branch. A corrected digest body contains links to the site, and the existing order would ingest such a reply as a news tip and answer the editor with a review keyboard.
- **FR-070**: A reply that matches no digest MUST fall through to the existing link and revert handling unchanged, so genuine tips are not swallowed.
- **FR-071**: A reply whose digest has left the awaiting-approval state MUST answer in Hungarian that the digest has already been sent or discarded, and MUST change nothing.
- **FR-072**: A corrected-text reply MUST consume the same single regeneration budget as a regeneration request.
- **FR-073**: Digest identifiers used in button data MUST be `DIGEST_CODE_CHARS` characters long. No new button data may carry a full record identifier. A test MUST assert that every existing watchlist identifier is at most `WATCHLIST_ID_MAX` characters and that the new button data fits the platform limit.

#### Health and abuse monitoring

- **FR-074**: A health check MUST run on its own schedule, from the same reliable scheduler as the flush, and MUST NOT be hosted on the least reliable scheduler in the repository.
- **FR-075**: The health check MUST send at most one message a day, recorded in its own daily marker. It MUST NOT share a marker with any other alerting feature, or one alert class would suppress the other.
- **FR-076**: The health check MUST fire when any of these hold: the oldest unsent alert is older than `HEALTH_FLUSH_HOURS`; a digest has awaited approval longer than `HEALTH_APPROVAL_HOURS`; the last sent digest is older than the cadence plus two days; the day's reservations exceed the day's recorded sends by more than ten; or the check itself has not run for `HEALTH_HEARTBEAT_HOURS`.
- **FR-077**: The unsent-alert condition MUST be suppressed while the public channel identifier is unset, or the kill switch would produce a daily message for as long as it is on.
- **FR-078**: The heartbeat condition is the only thing that detects the watchdog itself stopping. It MUST be independent of the scheduler that runs the other checks.
- **FR-079**: The system MUST notify the editor when more than ten subscriptions arrive from one network-address hash within an hour. This is a named detection control, not a convenience. With no third-party challenge on the form (A11), this ping is the only signal that tells a human a bot run is under way, so it MUST ship with the subscription form rather than after it, and it MUST NOT share the health check's daily marker (FR-075), or one stall condition would suppress the abuse signal for the rest of that day.
- **FR-080**: Confirmation messages MUST contain no reader-supplied text. The subscription form MUST NOT collect a name or any other free-text field. This is what stops the confirmation message being used to carry an attacker's words to a third party, and it is a primary anti-relay control (FR-096), not a simplification.

#### Personal data, consent and erasure

- **FR-081**: The email address MUST be stored encrypted at rest with the existing personal-data encryption helper, and decrypted only when a message is addressed. It MUST NEVER be written to a log or to an audit record's detail.
- **FR-082**: One canonicalisation MUST produce the address hash — trimmed and lowercased — and the subscription route, the erasure route and the delivery webhook MUST all use it.
- **FR-083**: The system MUST record the consent proof: the confirmation time, the hashed network address at confirmation, and the version of the consent text shown.
- **FR-084**: The network-address hash MUST be treated as personal data. It MUST appear in the privacy page, in the retention rule and in the erasure path.
- **FR-085**: Unsubscription MUST schedule the personal-data purge for `PURGE_DAYS` days later.
- **FR-086**: The retention pass MUST remove the encrypted address, the network-address hashes and the confirmation token. It MUST keep the address hash, the status and the consent-text version, which are the suppression marker and the consent record.
- **FR-087**: The maintainer MUST be able to erase one address on request. The erasure MUST schedule an immediate purge and write an audit record with the address redacted.
- **FR-088**: The subscription page and the privacy page MUST state what is stored including the network-address hash, the legal basis, the retention period and the erasure route.

### Named constants

These values are settled. Requirements reference them by name, and no code may spell them
as literals.

| Constant | Value |
|---|---|
| `FLUSH_CRON` | every 15 minutes |
| `FLUSH_BATCH_SIZE` | 20 |
| `TELEGRAM_CHANNEL_RATE` | 20 per minute |
| `DIGEST_MIN_ITEMS` | 3 |
| `DIGEST_REENGAGE_DAYS` | 21 |
| `DIGEST_APPROVAL_EXPIRY_HOURS` | 48 |
| `DIGEST_RESUME_DAYS` | 3 |
| `DIGEST_MAX_REGEN` | 1 |
| `DIGEST_CODE_CHARS` | 8 |
| `WATCHLIST_ID_MAX` | 22 |
| `CONFIRM_EXPIRY_HOURS` | 24 |
| `CONFIRM_COOLDOWN_MINUTES` | 15 |
| `CONFIRM_MAX_SENDS` | 3 |
| `SUBSCRIBE_CONFIRM_DAILY_CAP` | 50 |
| `SUBSCRIBE_CONFIRM_RESERVE` | 10 |
| `DIGEST_DAILY_SEND_CAP` | 90 |
| `RESEND_DAILY_LIMIT` | 100 |
| `RESEND_MONTHLY_LIMIT` | 3000 |
| `PURGE_DAYS` | 30 |
| `HEALTH_FLUSH_HOURS` | 2 |
| `HEALTH_APPROVAL_HOURS` | 24 |
| `HEALTH_HEARTBEAT_HOURS` | 26 |

The flush interval has no environment override. The schedule lives only in the workflow, and
a setting that cannot change behaviour is a trap.

`SUBSCRIBE_CONFIRM_DAILY_CAP` is a security bound, not a throughput setting. FR-052 states
what raising it costs.

### Reader-facing states

Every state below MUST have Hungarian copy. The wording is settled.

| State | Hungarian copy | Reader action |
|---|---|---|
| Confirmation page, any token | "Erősítsd meg a feliratkozásod." | Submit button |
| Confirmed | "Kész. Mostantól kapsz értesítést." | — |
| Already confirmed | "Ez a feliratkozás már aktív." | — |
| Expired token | "Ez a link lejárt." | "Küldj újat" |
| Unknown or tampered token | Identical to the expired state | "Küldj újat" |
| Unsubscription page | "Biztosan leiratkozol?" | Submit button |
| Unsubscribed, or already unsubscribed | "Leiratkoztál. Bármikor visszatérhetsz." | — |
| Confirmation after erasure | "Ezt a címet nem tudjuk feliratkoztatni." | Contact link |
| Email paused | "A feliratkozás átmenetileg szünetel." | — |

### Key Entities

- **Subscriber**: one reader's email subscription. Holds the encrypted address, the address hash used as the unique key and the suppression marker, the chosen sections, the cadence, the status (pending, active, unsubscribed, bounced, complained), the confirmation token hash and its expiry, the confirmation send count and cooldown time, the consent proof, the last-sent time, the reader's position in the timeline, the signup and confirmation network-address hashes, the bounce counters and the purge date.
- **SubscriberAlert**: one published item worth telling readers about. Holds the section, the source record identifier, a unique deduplication key, the title, the detail line, the link, the time of the event, the time it was claimed for the channel, and the time it was revoked.
- **Digest**: one drafted mailing awaiting an editor. Holds a short code used in button data, the cadence, the status (awaiting approval, approved, sending, sent, discarded, expired), the period covered, the frozen list of alert identifiers, the draft time, the Hungarian subject and body, the approval message identifier, the regeneration count, the approval time, the send time and the send count.
- **EmailSendLedger**: one row per calendar day. Holds the reserved count, the sent count and the update time. It is a counter, not a marker.
- **SubscriptionHealthAlert**: one row per calendar day, holding the reason last reported. It exists so at most one health message is sent a day, and it is separate from every other alerting marker.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Withdrawn on 2026-09-01. It measured the public tip form's production rejection rate. The tip form is out of scope (see Non-Goals). The identifier is not reused.
- **SC-002**: A reader who follows the public channel receives one message for every newly published item in the six sections, within 15 minutes of publication for automatic items and within 15 minutes of the editor's action for gated ones.
- **SC-003**: Zero duplicate public messages are posted for one item, including under two overlapping runs.
- **SC-004**: Zero subscriber-facing messages for asset recoveries or watchlist removals go out without a preceding editor action.
- **SC-005**: A reader can go from the subscription form to a confirmed subscription in under two minutes, using only the form and one message.
- **SC-006**: A reader can stop receiving messages in one click from any message, and the same click twice changes nothing further.
- **SC-007**: Zero digests are delivered without an editor approval action.
- **SC-008**: Plain page views of confirmation and unsubscription links change zero stored values, so a mail scanner opening every link cannot lock a reader out.
- **SC-009**: A valid, an expired and an invented token produce responses that a reader cannot tell apart before submitting, so the pages leak no information about whether an address is subscribed.
- **SC-010**: Daily email sends never exceed 90 for digests and 50 for confirmations, and the monthly total stays under 3000.
- **SC-011**: A weekly digest reaches an audience of up to about 270 recipients within three days of approval. A larger audience produces a maintainer notification, never a silent partial send.
- **SC-012**: Every stall condition produces at most one maintainer message a day, and a stall of the watchdog itself is reported within 26 hours.
- **SC-013**: After the retention period, zero unsubscribed readers retain an address or a network-address hash, and 100 percent retain the consent record needed as proof.
- **SC-014**: 100 percent of reader-facing strings are Hungarian.
- **SC-015**: The first digest reaches the inbox, not the spam folder, at both major consumer providers tested before any real send.
- **SC-016**: Zero unconfirmed addresses receive any message other than their own confirmation message, and no day produces more than 50 confirmation messages in total. An address someone else submitted therefore receives at most the capped confirmation set, never a digest.

## Assumptions

These are settled maintainer choices with their rationale. They are assertions, not open
questions, and no later stage may reopen them.

- **A1**: Watchlist removals alert on the editor's manual confirm action. That button press is the human gate. Manual removals never produce an auto-publish confirmation message, so gating on that message would mean they never alert at all.
- **A2**: Court verdicts alert without an extra gate. The revert window is the flush interval, because detector inserts do not flush inline. A delayed scheduled run only lengthens that window, which is the safe direction.
- **A3**: The five required sign-offs are granted: the new email provider and the DNS records that change how the domain sends; the five new tables; a section enumeration stored as a database enumeration array rather than the text-array house precedent; the new rate limiters; and the new scheduled workflow at the repository root.
- **A4**: Phone alerts use a public Telegram channel. No phone number is ever stored, so no message service is used.
- **A5**: One channel carries every section. Per-section filtering is email-only.
- **A6**: The daily-versus-weekly cadence choice is deferred. The data model supports both and weekly is the default.
- **A7**: The email provider's free tier is 100 messages a day and 3000 a month. The daily cap binds; the monthly one does not, because 90 a day for 31 days is 2790.
- **A8**: A seventh section costs two migrations, because the section list is a database enumeration. The migration header records that price.
- **A9**: Migrations in this repository are applied by hand and contain no rollback block. Recovery is roll-forward or restore. See the note below.
- **A10**: The uniform subscription response narrows a timing side channel but does not remove it. The suppressed branch performs one read, and the new-subscriber branch performs a read, a write and a queued job. This residual is accepted and stated, not hidden.
- **A11**: This feature uses no Cloudflare Turnstile, and no other third-party challenge widget, on any surface. Decided 2026-09-01. The precedent is commit `d5f66a9` of 2026-08-31, which removed Turnstile from the voting flow at the maintainer's explicit request: the site key's Cloudflare-side domain allowlist failed unreliably under real traffic, real voters were refused, and the maintainer holds no API access to configure the allowlist. A control that refuses real readers for a reason the maintainer cannot fix is worse than no control. The subscription form reuses the voting flow's surviving stack instead — a honeypot checked first (FR-089), then a per-network-address daily threshold built from the shared factory (FR-093) — on top of the double opt-in that blocks the real attack (FR-094). The voting flow's third layer, a one-vote-per-browser cookie, does not transfer: it enforces one action per browser, which would refuse a second person in the same household or office. That layer is the one the poll code itself calls primary, so removing Turnstile leaves the subscription form with a genuinely thinner front door. FR-096 names the three controls that now carry the bound.

## Dependencies

- The three preconditions above (P2, P3 and P4), each owned by the maintainer.
- The existing personal-data encryption helper and its key.
- The existing editor Telegram bot and chat.
- The existing detection pipeline and editor review paths, which are the six alert trigger points.
- The existing rate-limit module, which must export the new limiters, because its factory is module-private and a route cannot call it.
- The existing shared package's explicit export map, which has no wildcard, so each new shared module must be declared in it or the build fails.

## Deferred to plan.md

Rollback belongs in the implementation plan, not here. It MUST be carried into `plan.md` in
stage 2, with these points intact: recovery is roll-forward to the previous database branch
or a restore from the nightly snapshot, recorded in the restore-drill log; removing the new
tables after data exists is a separate change; a restore is a data-protection event, because
it destroys consent evidence for readers who confirmed after the snapshot while their address
still exists in the provider's logs; and delivered email and posted channel messages cannot
be undone by any restore.

## Non-Goals (Out of Scope)

- **The public tip form.** It rejects every whistleblower submission in production today, because the client sends a fixed placeholder challenge token. This feature does not repair it, does not depend on it, and touches neither the tip-form component nor the submissions API. How the tip form is protected is a separate maintainer decision, taken separately.
- **Cloudflare Turnstile, and any other third-party challenge widget**, on any surface of this feature. See assumption A11 for the decision and its cause.
- Text messages, and any storage of a phone number.
- Per-section filtering on the Telegram channel.
- Podcasts, news articles and social posts as subscription sections. Podcasts are gated on a view threshold and would need alert points that are not the insert.
- Repairing the pre-existing data-subject-request erasure gap. Its address hash is not canonicalised, so its hash space stays separate from this feature's.
- Moving the stray root migration file, and renumbering the duplicated migration prefixes.
- Choosing daily versus weekly cadence, and any paid email tier.
- The dead cost-ceiling entry in CLAUDE.md, reported to the maintainer separately.
