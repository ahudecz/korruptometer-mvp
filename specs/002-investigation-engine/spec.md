# Feature Specification: Investigation Engine

**Feature Branch**: `002-investigation-engine`
**Created**: 2026-05-15
**Status**: Draft
**Input**: User description: "Investigation Engine — a layered, agent-assisted pipeline that takes already-ingested Hungarian corruption-related articles and produces reviewer-grade investigation case files. The engine extracts atomic claims from articles, clusters them into investigations, pulls external evidence from free public registries, runs rule-based red-flag and benchmark engines, lets a bounded LLM hypothesis agent search wider and test theories, and scores each investigation on two axes (quantity of independent signals × quality of the highest-grade evidence). Human reviewers gate every promotion to journalist, prosecutor, or public disclosure tiers. Nothing is fabricated — every numerical claim and every signal traces back to a stored external record with fetch URL and timestamp. FOIA drafting and paid registry lookups inside the automatic pipeline are out of scope; paid lookups exist only as a reviewer-triggered manual escalation."

## Clarifications

### Session 2026-05-15

- Q: Do reviewer / operator / counsel need to be distinct runtime roles in the admin permission model? → A: Single admin role at runtime; audit log records the acting reviewer per action. Counsel is a CODEOWNERS-only control at dev time, not a runtime role. Operator is just a reviewer with the "escalate" button (no separate auth).
- Q: What is the investigation status lifecycle (set of allowed values)? → A: Three statuses — `new` (auto from clustering), `dismissed` (reviewer explicitly closed, no merit), `merged` (manually merged into another investigation; row stays for audit). Orthogonal to disclosure tier.
- Q: What does promotion to the journalist and prosecutor tiers actually deliver? → A: Tier is metadata + a filterable view inside the admin UI. Reviewers hand off out-of-band (Signal / email / phone); the system sends no automated notifications and builds no journalist-facing or prosecutor-facing surface. Only the public tier writes an externally-rendered artifact (the wanted-poster case row), and only when its feature flag is on.
- Q: How are concurrent reviewer edits on the same investigation reconciled? → A: Optimistic concurrency on the investigation row: every state-changing write sends the client's last-known `updatedAt`, and the server returns 409 (reload prompt in the UI) if the row has advanced. Lead rows are naturally isolated and need no extra control.
- Q: How are "high-mention" investigations ranked for the nightly external-record refresh? → A: Rank by count of articles attached to the investigation (descending), tiebreak on the oldest external-record `fetchedAt` (ascending). Process the top N per night where N is env-tunable (default 100). Independent of `quantityScore`, so the prioritizer works in Slice C/D before scoring (Slice I) ships.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Structured claims for every article (Priority: P1)

A reviewer opens any article that has been ingested into the system (news outlet or K-Monitor curated dataset) and sees a panel that lists every atomic corruption claim the article contains: alleged amount, mechanism (overpricing / no-bid / kickback / amendment inflation / phantom service / related party / other), the parties named (people + entities + their roles), a verbatim evidence quote, and a re-verifiable source URL with a paragraph-level locator into the article. Re-opening the article tomorrow shows the same claims with no extra processing cost; if the extraction logic is updated, both the old and new claim sets are visible side by side so reviewers can diff them.

**Why this priority**: Nothing else in the engine works without structured claims. Today reviewers must read each article body to find the amount, the mechanism, and who is named — this story removes that friction and produces the canonical data every later slice consumes. It is also the only slice that touches LLM cost in the steady-state pipeline, so it carries the spend controls the rest of the system depends on.

**Independent Test**: Ingest a single article, wait for the per-article extraction to complete, open the admin article viewer, and confirm the claim panel renders N ≥ 0 claims each with a non-empty evidence quote and source URL. Re-trigger extraction for the same article and confirm no new claims are written and no LLM cost is incurred. The reviewer gets immediate value (no more body-reading) without any other slice shipping.

**Acceptance Scenarios**:

1. **Given** an ingested article containing two distinct allegations against two different officials, **When** the extraction completes, **Then** two `article_claims` are visible on the article admin page, each with its own party list, mechanism, and evidence quote.
2. **Given** an article that has already been extracted under the current extractor version, **When** extraction is re-triggered for it, **Then** zero new claim rows are written and the day's recorded LLM spend does not change.
3. **Given** the operator bumps the extractor version (prompt or schema change), **When** extraction is re-triggered for the same article, **Then** a new set of claims appears under the new version and the old set remains visible for comparison.
4. **Given** today's recorded LLM spend has reached the configured ceiling, **When** the next article-extraction job fires, **Then** the job pauses without calling the LLM and an operator-visible signal flags the ceiling as hit.
5. **Given** the parent article row is deleted (K-Monitor re-snapshot drops it), **When** the orphan-cleanup job runs, **Then** its claim rows are removed.

---

### User Story 2 - Investigation queue with clustered claims (Priority: P2)

A reviewer opens the admin "Investigations" queue (the new primary entry point, listed before the legacy K-Monitor person-candidates queue) and sees one row per real-world case rather than one row per article. Each row aggregates every claim that names the same party (or set of parties) within a comparable amount range and a comparable time window. Clicking a row opens an investigation detail page with all of its source articles, all of its claims, and a summary. When the same claim could plausibly belong to two existing investigations, the system declines to auto-merge and instead surfaces a "needs reviewer" lead that the reviewer resolves with a decision form.

**Why this priority**: A flat list of articles, each with its own claim panel, does not scale to the ~33 k-article backlog. Clustering claims into cases is what turns the extractor's output into reviewable work. This slice converts raw signal into a triage surface and gives the reviewer a queue ordered by case importance instead of by article ingest time.

**Independent Test**: Seed three articles that all name the same official with amounts in the same band within 90 days. Wait for clustering. Confirm a single investigation row exists with all three articles attached. Then add a fourth article whose only named party also matches an unrelated investigation. Confirm the system writes a "needs reviewer" lead instead of merging.

**Acceptance Scenarios**:

1. **Given** three claims naming the same official with amounts inside a 2× band and within ±180 days of each other, **When** clustering runs, **Then** they appear as one investigation row with all three articles in its source list.
2. **Given** a new claim with no recorded amount and only one matching name on an existing investigation, **When** clustering runs, **Then** the claim does NOT join the investigation (the unknown-amount path requires ≥2 distinct name overlaps and a tighter ±90-day window).
3. **Given** a claim that could plausibly belong to two existing investigations, **When** clustering runs, **Then** a `needs_reviewer` lead is created and neither investigation is auto-merged.
4. **Given** the reviewer is on the admin home, **When** they look at the tab order, **Then** "Investigations" appears before the legacy "K-Monitor persons" queue.

---

### User Story 3 - External evidence & benchmark deviations on the case page (Priority: P3)

A reviewer opens an investigation detail page and, on demand, runs cross-reference. The system fans out to the free public registries it knows about (TED, EKR, Közbeszerzési Értesítő, palyazat.gov.hu, e-cégjegyzék, OpenCorporates, Integritás Hatóság, OLAF, KSH STADAT, Eurostat, K-Monitor own datasets, Átlátszó, web archive) and attaches one external record per match — each with its source URL, fetch timestamp, and full payload. For dimensions the engine knows (e.g., HUF per square metre for school / hospital construction, HUF per kilometre for road / rail, HUF per megawatt for solar), the benchmark engine computes p10 / p50 / p90 over a comparable cohort and flags the case's amounts as outliers when they fall outside the band. Reviewers never wait on a paid-service call: paid lookups (OPTEN, deep ownership) are a separate reviewer-triggered "escalate" action that an operator runs by hand and writes back as an external record.

**Why this priority**: Claims by themselves are unverified. External evidence is what turns a claim into a defensible lead. This slice is the bridge between "this article alleges X" and "an EU register confirms a contract of Y to that contractor for Z". It also delivers the first benchmark deviation signals, which feed the red-flag engine and the scoring axis.

**Independent Test**: On a seeded investigation that has at least one named contractor and an alleged contract amount, trigger cross-reference and confirm at least one external record is attached with a valid source URL and a fetch timestamp inside the last 30 days. If the case's amount and dimension match a known benchmark, confirm a deviation flag is displayed with the cohort size and the p10/p50/p90 numbers visible.

**Acceptance Scenarios**:

1. **Given** an investigation whose primary contractor exists in TED, **When** cross-reference runs, **Then** at least one external record is attached with `sourceSystem='TED'` and a `fetchedAt` within the last 30 days, and the source URL opens the original record.
2. **Given** an investigation with a construction contract priced at HUF X per square metre that exceeds the p90 of comparable contracts, **When** the benchmark engine runs, **Then** the case page shows a deviation flag with X, p10, p50, p90, and the cohort size n.
3. **Given** an external record older than 30 days, **When** the nightly batch runs, **Then** the record is refreshed and its `fetchedAt` advances; the previous payload is replaced.
4. **Given** the reviewer clicks "Escalate deep ownership lookup", **When** the operator returns a result, **Then** it is written back to the investigation as a new external record with full provenance — the automatic pipeline never blocks waiting on it.

---

### User Story 4 - Red-flag rules and a bounded hypothesis agent (Priority: P3)

A reviewer on an investigation detail page sees the results of a declarative red-flag rule engine: each rule (single-bidder award, contract amendment greater than 20 %, related-party award, contractor founded less than six months before the contract, single-source dominance, etc.) is listed with a pass / fail / not-applicable verdict, a plain-Hungarian observation, and a link to the supporting external records. Separately, the reviewer can press a "Run hypothesis loop" button which spawns a bounded agent (≤ 8 tool calls, ≤ 50 000 input + output tokens, ≤ 90 seconds wall clock) that reads from the cached external records first, only falling through to a live adapter when no row exists inside the freshness window. The agent can search wider for the same case, compute additional benchmarks, and propose testable hypotheses ("if overpricing, the contractor's other contracts should show a pattern") and verify them against the same adapters. When a cap fires, the agent writes a `needs_reviewer` lead explaining which cap stopped it; it never auto-resumes on a schedule.

**Why this priority**: Rules give reviewers an auditable, explainable signal. The agent loop adds investigative depth that would be impractical to encode declaratively — but only inside hard bounds so the cost and the runtime stay predictable. Without rules + loop, the engine produces a passive list of evidence; with them, it produces leads.

**Independent Test**: Run the red-flag engine on a seeded investigation with a single-bidder contract and confirm the "single bidder" rule fires with an explanation. Trigger the hypothesis loop once and confirm it terminates inside the caps and writes either findings or a clearly-explained cap-hit lead. Confirm no rule output references machine-learning scores or opaque numbers — every verdict has a plain-Hungarian observation.

**Acceptance Scenarios**:

1. **Given** an investigation whose linked TED record shows one bidder, **When** the rules engine runs, **Then** the "single bidder" rule fires with a `fail` verdict, a Hungarian observation, and a link to the TED record.
2. **Given** an investigation with stale external records, **When** the hypothesis loop runs, **Then** it reads from the cache first; if the cache is empty it calls the live adapter at most once per `(sourceSystem, externalId)` and never twice per source per run.
3. **Given** the hypothesis loop hits any of the three caps (tool calls, tokens, wall clock), **When** it terminates, **Then** an `investigation_leads` row is written with `kind='hypothesis'`, `status='open'`, `createdBy='agent'`, and a `finding` that names which cap fired.
4. **Given** a rule's verdict is rendered to the reviewer, **When** the reviewer reads it, **Then** the explanation is in plain Hungarian, names the rule, and points at the supporting external records — no opaque score.

---

### User Story 5 - Two-axis scoring with transparent components (Priority: P4)

A reviewer sees each investigation scored on two **separate** axes:

- a quantity score (weighted count of independent signals — distinct external sources plus distinct red-flag rules of medium-or-higher severity, with a staleness decay for evidence older than 540 days), and
- a quality score (the ordinal of the highest evidence grade present, on the scale rumor < opinion press < opposition politician < investigative journalism < prosecutor statement < audit report < court document).

Both components are displayed; there is no single opaque "corruption score". Tier-promotion actions become visible only when the predicate for that tier passes — the reviewer is never offered an action they cannot legally perform.

**Why this priority**: A single number conceals the trade-off between "many weak signals" and "one strong signal", which is exactly the trade-off that determines whether a case is journalist-grade or prosecutor-grade. Surfacing the components makes the gate auditable and survives external scrutiny. This slice also encodes the promotion floors that Slice J's actions enforce.

**Independent Test**: Seed an investigation with two distinct registries corroborating the same amount (high quantity) and only opinion-press evidence (low quality). Confirm the page renders quantity ≥ 2 and quality at the opinion-press tier. Confirm the "promote to journalist" action is hidden because the quality floor (`investigative_journalism`) is not met. Bump one source up to an audit report and confirm the action appears.

**Acceptance Scenarios**:

1. **Given** an investigation with two corroborating external records from distinct source systems and one medium-severity red-flag rule firing, **When** the score is computed, **Then** `quantityScore` reflects the weighted independent-signal count and `qualityScore` reflects the highest evidence grade present.
2. **Given** an investigation with `quantityScore=1`, **When** the reviewer opens it, **Then** no tier-promotion action is visible (all tiers require `quantityScore ≥ 2`).
3. **Given** an investigation with sufficient quantity but `qualityScore` below the `investigative_journalism` ordinal, **When** the reviewer opens it, **Then** the "promote to journalist" action is hidden.
4. **Given** an investigation has an external record from `TED`, `EKR`, `palyazat`, `integritás` or `olaf` with `relevance='corroborates'`, plus `quantityScore ≥ 3` and `qualityScore ≥ audit_report`, **When** the reviewer opens it, **Then** the "promote to public" action is visible.
5. **Given** an external record is 600 days old, **When** scoring runs, **Then** it contributes 0.5× to `quantityScore` instead of 1.0×.

---

### User Story 6 - Disclosure-tier promotion with legal gates (Priority: P4)

A reviewer can promote an investigation to one of four disclosure tiers: internal (default), journalist, prosecutor, or public. Promotion writes are atomic; on public-tier promotion the engine creates a wanted-poster-style public case row, populates its dependents, refreshes the per-jurisdiction rollup, and links the investigation to the new case. Public-tier rendering is gated end-to-end by an environment flag that ships off in every environment; legal counsel must have reviewed and signed off on the redaction policy, the redaction-related source files must be CODEOWNERS-protected, and the flag must be flipped before any name reaches a public route. Depromoting a public case soft-deletes it and preserves the audit trail; a subsequent re-promotion creates a new case id, and reviewers can see both ids in the investigation's history panel.

**Why this priority**: Promotion is the only path by which engine output reaches external audiences (journalists, prosecutors, public). Mis-promotion has reputational and legal consequences that the rest of the engine cannot recover from. The slice exists primarily to enforce that promotion is impossible without a passing predicate, a counsel-approved policy, and a deliberate flag flip.

**Independent Test**: On an investigation whose predicate passes for journalist tier (quantity ≥ 2, quality ≥ investigative journalism), click "promote to journalist" and confirm the tier flips, the audit log records the action with the reviewer's identity, and the investigation appears in the admin's journalist-tier filtered view. Confirm no email or webhook is dispatched on the tier flip (the handoff is the reviewer's out-of-band responsibility). Confirm that with the public-tier feature flag off, no public route renders any claim text or quote even for cases promoted to public.

**Acceptance Scenarios**:

1. **Given** an investigation whose predicate for the journalist tier passes, **When** the reviewer clicks "promote to journalist", **Then** the tier changes, the audit log records the action with the reviewer's identity, the timestamp, and the prior tier, the case becomes visible in the admin's journalist-tier filtered view, and no email, webhook, or other automated outbound notification is dispatched.
2. **Given** an investigation whose predicate for the public tier passes, **When** promotion runs, **Then** a new public case row plus its dependents are written and the per-jurisdiction rollup refreshes — either all four writes succeed or none commit (no half-written case).
3. **Given** an investigation already linked to a public case, **When** the reviewer attempts to promote again, **Then** the action is rejected and the UI surfaces "already promoted to case <id>".
4. **Given** a public case is depromoted, **When** the same investigation is later re-promoted, **Then** a new public case row is created with a fresh id and both ids appear in the investigation history panel.
5. **Given** the public-tier feature flag is off, **When** any anonymous user visits a public-tier route, **Then** no claim text, no quote, and no party name from a promoted investigation is rendered.
6. **Given** counsel has not approved the redaction policy and the CODEOWNERS pattern for redaction files is not in place, **When** a developer attempts to merge code that introduces a public-tier render path, **Then** the merge is blocked by CODEOWNERS.

---

### Edge Cases

- **Article with zero extractable claims** — the article still records an idempotency marker for the current extractor version so re-fires do not call the LLM, and the article admin page shows "no claims extracted".
- **Same allegation appears in both news and K-Monitor sources** — claims keep their `articleSource` and remain distinguishable; clustering may merge them into one investigation, but each claim row retains its provenance back to its own article.
- **Claim with null amount and a common surname** (e.g., "Kovács László") — the unknown-amount clustering path requires ≥ 2 distinct name overlaps and a tighter ±90-day window, preventing spurious merges into unrelated cases.
- **External adapter is down or rate-limiting** — the hypothesis loop still runs over cached external records; missing fresh data is reported as a `needs_reviewer` lead, not as a silent failure.
- **Daily LLM spend ceiling reached** — extraction queue pauses for the rest of the day; existing claims remain readable; queue resumes the next day with no manual intervention.
- **K-Monitor re-snapshot drops an article** — the orphan-cleanup job removes its claim rows; investigations that lose all their claims still exist but read as empty (reviewer can decide to close them).
- **Extractor version bumped** — both old and new claim sets are retained per article, so reviewers can diff outputs; clustering and scoring read from the current version only.
- **Hypothesis loop triggered on a case with no external records yet** — the agent terminates inside the bounds and writes a cap-hit lead with `finding = "no external records to read; run cross-reference first"`.
- **Subject-access deletion arrives for a person named across multiple investigations** — claim rows referencing that person are deleted; each affected investigation row is anonymized (names replaced with `[redacted]`; `primaryPersonId` cleared) but the row stays so audit-log references remain resolvable.
- **Promotion predicate becomes false between page load and click** — the server-side action re-checks the predicate at click time and rejects the promotion if it no longer passes; the UI surfaces "score no longer meets promotion floor".
- **Public case depromoted then re-promoted** — the old public case row is soft-deleted (not hard-deleted) to preserve trigram history and audit trail; the new promotion creates a fresh case id; both ids appear in the investigation history panel.
- **Reviewer is the same person who escalated a paid lookup** — when the paid result returns, the audit log records both the escalation request and the writeback as separate events.
- **Janitor runs while extraction is in flight** — orphan cleanup ignores rows whose parent article was deleted after extraction started this hour, falling back to safe deletion on the next nightly run.
- **Two reviewers edit the same investigation concurrently** — the second write is rejected by the server's optimistic-concurrency check (stale `updatedAt`); the UI prompts the second reviewer to reload, see the change the first reviewer made, and re-submit if still relevant. No silent overwrite.

## Requirements *(mandatory)*

### Functional Requirements

**Claim extraction (Slice A)**

- **FR-001**: System MUST extract zero or more atomic claims per ingested article (from both the news source and the K-Monitor source), each claim carrying an alleged HUF amount with an indicator of whether that amount was stated, computed, or estimated; a corruption mechanism category; a parties list (people + entities + roles); a verbatim evidence quote; a canonical source URL; and a paragraph-level locator into the article.
- **FR-002**: System MUST be idempotent at the article level: re-running extraction for the same article under the current extractor version MUST NOT write new claim rows and MUST NOT incur LLM cost.
- **FR-003**: System MUST retain claim rows from prior extractor versions when the extractor version is bumped, so reviewers can compare prompt / schema / model changes side by side.
- **FR-004**: System MUST record per-call LLM telemetry (model, input tokens, output tokens, estimated HUF spend) for every claim-extraction call and aggregate it as a per-day spend total readable in an admin view.
- **FR-005**: System MUST refuse to call the LLM when today's recorded HUF spend has reached the configured ceiling, and MUST pause the extraction queue with an operator-visible signal until the next day.
- **FR-006**: System MUST cascade-delete claim rows when their parent article is removed (the polymorphic article reference is enforced by a janitor, not a foreign key).
- **FR-007**: System MUST instrument every extraction call with an error breadcrumb that names the article source, article id, and extractor version, so LLM failures are diagnosable from the observability backend without copying source text.

**Clustering & investigations (Slice B)**

- **FR-008**: System MUST cluster a new claim into an existing investigation when (a) at least one normalized party name overlaps with a claim already in the investigation, (b) both claim amounts (when present) agree within a 2× band — defined as `max(a, b) / min(a, b) ≤ 2` (i.e., the larger amount is at most twice the smaller; if either amount is zero, the band fails) — and (c) the claim's article date falls within ±180 days of any existing claim on the investigation.
- **FR-009**: System MUST tighten the clustering predicate for the unknown-amount path (incoming claim's amount is null AND no existing claim on the candidate investigation carries an amount) by requiring ≥ 2 distinct normalized-name overlaps and a ±90-day window.
- **FR-010**: System MUST decline to auto-merge when a new claim matches more than one existing investigation, and MUST create a "needs reviewer" lead the reviewer resolves manually.
- **FR-011**: System MUST create a new investigation with `status='new'` when a claim matches zero existing investigations.
- **FR-011a**: System MUST support exactly three investigation statuses, orthogonal to disclosure tier: `new` (default, set by clustering), `dismissed` (reviewer explicitly closed because the case has no merit; row remains for audit and is hidden from the active queue by default), and `merged` (manually merged into another investigation; the row remains for audit and carries a `mergedIntoId` pointer to the target investigation). Status changes MUST be reviewer actions logged in the audit log; the clustering job MUST NOT auto-transition a status away from `new`.
- **FR-012**: System MUST surface an "Investigations" queue as the reviewer's primary entry point, ordered before the legacy person-candidates queue, while keeping the legacy queue available for backwards compatibility.

**External evidence & benchmarks (Slices C–F)**

- **FR-013**: System MUST attach external records to investigations with full provenance — canonical URL, fetch timestamp, fetch hash, raw payload, and the source system identifier — so every signal is re-verifiable from the case page.
- **FR-014**: System MUST NOT call any paid registry inside the automatic pipeline; paid lookups MUST be reachable only via a reviewer-triggered "escalate" action whose result is written back manually by the operator as a new external record with the same provenance fields.
- **FR-015**: System MUST refresh external records on a nightly batch when they exceed the per-source staleness threshold (e.g., 30 days for procurement registries). The batch MUST rank candidate investigations by the count of articles attached to each (descending), with a tiebreak on the oldest external-record `fetchedAt` (ascending), and MUST process the top N where N is an environment-tunable integer (default 100). The ranker MUST be independent of `quantityScore` so that the nightly batch is operable before the scoring slice (FR-024) ships.
- **FR-016**: System MUST enforce per-source-system fetch concurrency of 1 (no parallel calls to the same registry) and a per-host 2-second gate, so the engine remains a polite fetcher.
- **FR-017**: System MUST compute p10 / p50 / p90 benchmarks over comparable cohorts for the supported dimensions, and MUST flag investigation amounts as outliers when they fall outside the cohort band; the cohort spec, hash, sample size n, and computed timestamp MUST be visible to the reviewer.
- **FR-018**: System MUST treat the set of benchmark dimensions as a constrained list; adding a new dimension is a code change reviewed in PR, not free-text input.

**Red flags & hypothesis loop (Slices G–H)**

- **FR-019**: System MUST evaluate a declarative set of red-flag rules per investigation, each rule producing a pass / fail / not-applicable verdict with a plain-Hungarian observation and links to the supporting external records.
- **FR-020**: System MUST never expose a red-flag verdict that lacks an auditable explanation; opaque scores from machine-learning models MUST NOT appear as rule output.
- **FR-021**: System MUST support a reviewer-triggered hypothesis loop bounded by ≤ 8 tool calls, ≤ 50 000 combined input + output tokens, and ≤ 90 seconds wall clock per run.
- **FR-022**: System MUST read from cached external records first inside the hypothesis loop, only falling through to a live adapter when no row exists inside the adapter's freshness window, and MUST never call the same `(source system, external id)` twice in one run.
- **FR-023**: System MUST write a `needs_reviewer` lead naming the cap that fired when the hypothesis loop terminates against a bound, and MUST NOT auto-resume that loop on a schedule.

**Scoring & promotion (Slices I–J)**

- **FR-024**: System MUST score each investigation on two independent axes: a quantity score (weighted count of independent signals: distinct source systems plus distinct red-flag rules of medium-or-higher severity, with a 0.5× staleness decay for evidence older than 540 days) and a quality score (the ordinal of the highest evidence grade present on the scale rumor < opinion press < opposition politician < investigative journalism < prosecutor statement < audit report < court document).
- **FR-025**: System MUST display both component scores; aggregating them into a single number for the reviewer UI is prohibited.
- **FR-026**: System MUST gate disclosure-tier promotion behind the following predicates, evaluated server-side at click time:
  - Journalist: `quantityScore ≥ 2` AND `qualityScore ≥ investigative_journalism`.
  - Prosecutor: `quantityScore ≥ 3` AND `qualityScore ≥ audit_report`.
  - Public: `quantityScore ≥ 3` AND `qualityScore ≥ audit_report` AND at least one external record from an official source system (`TED`, `EKR`, `palyazat`, `integritás`, or `olaf`) with `relevance='corroborates'`.
- **FR-027**: System MUST hide promotion actions for tiers whose predicates do not pass; reviewers MUST NOT be offered an action they cannot complete.
- **FR-028**: System MUST execute public-tier promotion writes atomically — the public case row, its person-link dependents, the per-jurisdiction rollup refresh, and the investigation→case link MUST all commit together or none commit.
- **FR-029**: System MUST reject a second promotion attempt on an investigation already linked to a public case (idempotency guard); the UI MUST surface "already promoted to case <id>".
- **FR-030**: System MUST treat depromotion as a soft delete on the public case; a subsequent re-promotion MUST create a new public case id while keeping the prior soft-deleted row visible in the investigation history panel.
- **FR-031**: System MUST log every reviewer state-changing action in the existing audit log (extraction kill-switch override is exempt because it is an env change, not a UI action).
- **FR-031a**: System MUST treat every authenticated admin user as a single `reviewer` runtime role; no separate `operator` or `counsel` runtime role exists. The "escalate deep ownership lookup" action and the paid-result writeback are available to any reviewer, and accountability is enforced through the per-action audit-log actor field. Counsel approval for legal-sensitive code paths is enforced as a CODEOWNERS gate at code-review time, not as a runtime permission.
- **FR-031b**: System MUST treat the `journalist` and `prosecutor` disclosure tiers as metadata-only signals plus a filterable view inside the admin UI; no journalist-facing or prosecutor-facing surface is built in this feature and no automated outbound notification (email, webhook, push) is dispatched on tier change. Handoff to a specific journalist or prosecutor is the reviewer's out-of-band responsibility. Only the `public` tier produces an externally-rendered artifact (the wanted-poster case row), and only when the `public` feature flag from FR-033 is on.
- **FR-031c**: System MUST apply optimistic concurrency control to every state-changing write on the investigation row (status change, tier promotion, summary edit, manual merge). The client MUST submit its last-known `updatedAt` (or equivalent row version) with the write; the server MUST reject the write with a conflict response when the stored value has advanced, and the UI MUST surface a reload prompt rather than retrying silently. Lead rows are naturally isolated (each lead has its own row) and require no additional control.

**Legal & retention (Slices A + K)**

- **FR-032**: System MUST keep claim data (party names and verbatim evidence quotes) on the internal admin tier only until the public-tier feature flag is flipped; the flag MUST default off in every environment.
- **FR-033**: System MUST require, before public-tier render code can be merged, (a) a counsel-approved redaction policy committed in the repository, (b) CODEOWNERS protection on the redaction-related source files and the public-tier render path so a counsel reviewer must approve any change, and (c) the public-tier feature flag wired but off.
- **FR-034**: System MUST anonymize but not delete an investigation row when a subject-access deletion request for one of its named persons is upheld — names in the summary and primary entity name MUST be redacted, the primary person link MUST be cleared, but the row MUST remain so audit-log references stay resolvable.
- **FR-035**: System MUST hard-delete every `ArticleClaim` row whose `parties` JSON names a subject for whom a subject-access deletion request has been upheld. (Parent-article cascade is covered separately by FR-006.)

**Provenance & integrity**

- **FR-036**: System MUST never store a claim amount or evidence quote that does not also carry a re-verifiable source URL and an article-level locator; a claim missing either MUST be rejected by the extractor and surfaced as a parse failure.
- **FR-037**: System MUST never store an external record without its source URL, fetch timestamp, and fetch hash.
- **FR-038**: System MUST present every numerical claim and every red-flag verdict in the reviewer UI with at least one link to its underlying source artifact; a claim or verdict without a link MUST NOT render.

### Key Entities

- **Article**: An ingested article from one of two sources — a news outlet or the K-Monitor curated dataset. Existing entity; investigations consume it but do not modify it.
- **Article Claim**: One atomic corruption allegation extracted from an article. An article carries N claims (N ≥ 0). Each claim has a claim ordinal within its article, an alleged HUF amount with a stated/computed/estimated indicator, a mechanism category, a parties list (people + entities + roles), a verbatim evidence quote, a source URL, a locator into the article, the extracting model and confidence, and the extractor version under which it was produced. Uniqueness is `(article source, article id, claim ordinal, extractor version)`.
- **Investigation**: A cluster of claims that describe the same real-world case. An investigation has a status (one of `new` / `dismissed` / `merged` — see FR-011a; `merged` rows carry a `mergedIntoId` pointing at the surviving investigation), an optional primary person and primary entity name, a summary, a quantity score, a quality score, a disclosure tier (internal / journalist / prosecutor / public), and — once promoted to public — a link to its public case row.
- **Investigation Article Link**: Joins an investigation to the articles whose claims fed it, with a role indicator.
- **External Record**: A single piece of external evidence attached to an investigation. Each record names a source system (TED, EKR, KE, palyazat, e-cégjegyzék, OpenCorporates, Integritás, OLAF, KSH, Eurostat, K-Monitor, Átlátszó, web archive), an external id, a canonical URL, a fetch timestamp, a fetch hash, a record type, a raw payload, and a relevance indicator (corroborates / contradicts / context / benchmark / null).
- **Red-Flag Check**: One rule evaluated against one investigation. Carries a rule id, a severity (low / medium / high / critical), a verdict (pass / fail / not-applicable), a plain-Hungarian observation, and references to the external records that informed the verdict.
- **Investigation Lead**: A hypothesis or search lead, either agent-generated or reviewer-noted. Carries a kind (hypothesis / search lead), a question, a status (open / tested / resolved / rejected), what it was tested against, its finding, and the actor that created it (agent or reviewer).
- **Benchmark**: A cohort of comparable contracts with computed p10 / p50 / p90 and sample size n. Each benchmark names a dimension (e.g., HUF per square metre for hospital construction), a cohort specification, a deterministic cohort hash (the upsert key, so re-opens deduplicate), the percentiles, the sample size, and the records that formed the cohort.
- **Daily LLM Usage**: Per-day, per-model aggregate of input tokens, output tokens, and estimated HUF spend, used to enforce the daily kill switch and to render the spend admin view.
- **Audit Log Entry**: One reviewer or system action with actor, timestamp, action name, and target entity reference. Existing entity; extended to cover every new state-changing action introduced by this feature.
- **Public Case**: Existing entity (the wanted-poster surface). Investigations promoted to the public tier write a new public case row and link to it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can open the admin viewer for any ingested article and see all of its extracted claims within 2 seconds of page load (p95).
- **SC-002**: A newly ingested article has its claims visible in the admin viewer within 10 minutes of ingest under normal queue depth.
- **SC-003**: Re-extracting an already-extracted article under the same extractor version writes zero new claim rows and incurs zero additional LLM cost (measured per-day across all such re-fires).
- **SC-004**: Daily LLM extraction spend never exceeds the configured ceiling on any calendar day; the kill switch pauses the queue before the next call that would breach it.
- **SC-005**: 95 % of investigations with at least one extracted contract amount have at least one external evidence record attached within 24 hours of the reviewer first opening the case.
- **SC-006**: A reviewer can complete an end-to-end investigation review (open queue → read claims → read evidence → run hypothesis loop → read score → choose tier) in under 15 minutes for a typical case. **(Post-launch UX outcome metric — observed in production after Slice K ships; not a CI-enforced gate. "Typical" = a case carrying 2–4 attached articles, 3–8 external records, and one fired red-flag rule.)**
- **SC-007**: 100 % of claims and external records rendered to the reviewer carry a clickable source URL and a fetch timestamp; the engine refuses to render any item missing either.
- **SC-008**: 100 % of disclosure-tier promotions satisfy the relevant predicate at the moment the action is taken; the server rejects any promotion whose predicate failed between page load and click.
- **SC-009**: Zero claim text, zero evidence quote, and zero party name from a promoted investigation is rendered on any public route while the public-tier feature flag is off.
- **SC-010**: An upheld subject-access deletion request results in anonymization of every affected investigation and removal of its associated claim rows within one nightly retention sweep (≤ 24 hours).
- **SC-011**: Every red-flag verdict shown to a reviewer carries a plain-Hungarian observation and at least one link to the supporting external record; zero verdicts render as opaque scores.
- **SC-012**: The hypothesis loop terminates inside its caps (≤ 8 tool calls, ≤ 50 000 tokens, ≤ 90 seconds wall clock) for 100 % of runs; cap-bound terminations are recorded as `needs_reviewer` leads with the cap named.

## Assumptions

- The reviewer audience is a small set of admin users in the existing admin app; **no new runtime role model is introduced** (see FR-031a). Every authenticated admin user is a `reviewer`; "operator" and "counsel" are workflow duties performed by reviewers (paid-lookup writeback) or by code-review gates (CODEOWNERS), not separate auth roles.
- The admin UI continues in its current language conventions (English shell, Hungarian source content); no new localization layer is added for the engine's admin surfaces.
- The article ingestion pipelines (news scrapers, K-Monitor harvester) keep their existing cadences and produce articles in the same shape this feature reads.
- The free-tier registries enumerated above (TED, EKR, Közbeszerzési Értesítő, palyazat.gov.hu, e-cégjegyzék free tier, OpenCorporates free tier, Integritás Hatóság, OLAF, KSH STADAT, Eurostat, K-Monitor own datasets) remain reachable on their current URLs; adapters carry a dated "last-verified" comment so URL drift is caught.
- Paid registries (OPTEN, the deep-ownership tier of company APIs) are out of the automatic pipeline. They are reachable only via a manual escalation that a single named operator runs on demand; an SLA for that operator's turnaround is agreed before the escalate button ships.
- FOIA drafting (automatic generation of freedom-of-information letters) is explicitly out of scope for this feature.
- Beneficial-ownership register access is treated as not available in EU post-CJEU C-37/20; the engine relies on company-registry and OpenCorporates data instead.
- The existing audit log captures all new state-changing actions; no parallel logging mechanism is introduced.
- The existing person-aggregate layer (K-Monitor person candidates with LLM tightening) keeps running alongside the new engine; both layers feed investigation creation independently.
- The existing public-tier surface (the wanted-poster cases) is unchanged until the legal gate passes and Slice K ships. Promotion writes a new public case row plus dependents; no public-tier code is exercised before the feature flag is flipped.
- The realistic per-article extraction latency on the chosen LLM is 4–6 seconds for typical article sizes; the ~33 000-article backlog drains in ~24–30 hours at concurrency 2, not the optimistic 14 hours assumed in early planning.
- The backlog is drained in two phases: a sampled 1 000-article subset first, then the full backlog only after one full day of observed spend stays at or below the daily ceiling.
- Per-host fetch politeness (2-second gate) and per-source-system concurrency-1 keep the engine compliant with each registry's terms of use; if any registry publishes a stricter limit, the adapter for that registry adopts it.

---

## Addendum 2026-05-19 — Damage→Evidence Spine

### Why this addendum

The Slice A–K engine produces the correct underlying data (claims, external records, benchmarks, red flags, score) but its reviewer surface does not answer the three questions a reviewer needs answered to act on an investigation:

1. **What is the estimated damage to the Hungarian state, in HUF?**
2. **What evidence and calculation back that number?**
3. **What should I, the reviewer, do next?**

Concrete gaps observed against the shipped 002 surface:

- The queue's "Becsült kár" KPI is `SUM(ArticleClaim.allegedAmountHuf)` across all investigations — double-counts overlapping claims, mixes mechanisms, ignores `ExternalRecord.valueHuf` and benchmark cohorts entirely.
- The Benchmarks panel renders p10/p50/p90 deviation flags but never translates a deviation into a HUF damage figure.
- `Investigation.quantityScore` renders as a 0–10 bar with no breakdown of contributing signals, which is exactly the kind of opaque score FR-020 forbids for red-flag verdicts.
- Claims, external records, and benchmarks render in separate panels with no cross-linking; a reviewer cannot trace any forint figure to a paragraph.
- Async reviewer actions (cross-reference, hypothesis loop, benchmarks) fire and silently `router.refresh()`. There is no progress indicator, no job-state surface, and raw HTTP codes (`http_500`, `loop_in_flight`, `stale`) reach the UI.
- A new reviewer has no canonical "do this next" guidance.

This addendum restructures the investigation detail surface around a single **damage → evidence → math → action** spine, and adds the data layer required to make every damage forint traceable.

### User Story 7 — Damage estimate with a traceable formula (Priority: P2)

A reviewer opens an investigation and sees, as the dominant number on the page, a HUF damage **range** (low–high) with a confidence indicator and a per-mechanism breakdown. Each component of the breakdown shows its method (`benchmark_deviation` / `claim_consolidation` / `amendment_delta` / `industry_estimate`), a Hungarian formula string, and a list of clickable inputs (claim, external record, benchmark cohort) so any line in the breakdown can be drilled to its supporting evidence.

**Why this priority**: Without this, the engine's headline output is unusable — a reviewer who has to decide promote vs dismiss in three minutes cannot do so from a bare `quantityScore`. This is the single highest-leverage change to make Slice A–K useful for its intended audience.

**Independent Test**: Open any investigation that has at least one `ArticleClaim` with an alleged amount, or any investigation that has both an `ExternalRecord` with `valueHuf` and a matching benchmark cohort with `n ≥ 10`. Confirm a damage range renders in the hero, the breakdown lists at least one component with a formula string, and every input link opens the underlying record.

**Acceptance Scenarios**:

1. **Given** an investigation with one TED record (`valueHuf = 56 000 000 000`, dimension m², quantity 4 000) and a benchmark cohort with `p10 = 7 000 000`, `p50 = 8 000 000`, `p90 = 9 500 000` HUF/m² and `n = 47`, **When** the detail page renders, **Then** an overpricing component shows `low = max(0, 56Bn − 9.5M × 4 000) = 18Bn Ft` and `high = max(0, 56Bn − 7M × 4 000) = 28Bn Ft`, with the formula string and the three input links present.
2. **Given** an investigation whose only signals are a `single_bidder` red flag (fail) on a contract worth 10Bn Ft, **When** the page renders, **Then** a no-bid component appears with `low = 500M Ft`, `high = 1.5Bn Ft`, citation = OECD 2022 single-bidder premium, and a link back to the `RedFlagCheck` row.
3. **Given** an investigation whose damage components reference the same `ExternalRecord` and would sum-of-highs to more than `contract_value`, **When** the estimate is computed, **Then** the lowest-priority component is capped so the sum equals `contract_value` and a Hungarian note records the cap in the component's `notes` field.
4. **Given** a benchmark cohort with `n < 10`, **When** the estimate is computed, **Then** no `benchmark_deviation` component is emitted, and an `InvestigationLead` of kind `cohort_too_thin` is written instead.

### User Story 8 — Auditable quantity score (Priority: P2)

A reviewer expands the score panel on any investigation and sees a row per contributing signal — external record, red flag, claim corroboration, benchmark deviation — with its base weight, staleness multiplier, effective weight, and a link back to the source record. The sum of `effectiveWeight` over the rows equals `Investigation.quantityScore` within ±0.01. The score is never rendered as a standalone bar without the underlying table being one click away.

**Why this priority**: FR-020 already forbids opaque scoring for red-flag verdicts. The same standard must apply to the quantity score itself; otherwise the headline number cannot be defended in front of counsel or in front of a journalist who challenges the editorial.

**Independent Test**: Open any investigation with a non-zero `quantityScore`, expand the score panel, sum the visible `effectiveWeight` column, and confirm it equals the headline score within ±0.01.

**Acceptance Scenarios**:

1. **Given** an investigation with two external records (TED, EKR) and one failing red flag (`single_bidder`), **When** the score panel renders, **Then** three rows appear with their base weights from FR-022/023 and a staleness multiplier of 1.00 each, and the sum equals `quantityScore`.
2. **Given** an investigation whose newest external record is 600 days old, **When** the score panel renders, **Then** the row's `stalenessMultiplier` is `0.5` per FR-024 and a footnote explains the decay.

### User Story 9 — Real-time pipeline state and next-step guidance (Priority: P3)

A reviewer clicks a pipeline action (cross-reference, red flags, hypothesis loop, benchmarks) and the corresponding pipeline row immediately transitions to a `running` state with a started-at timestamp; the row transitions to `done` (with a one-line Hungarian summary and elapsed time) or `failed` (with a Hungarian remediation message) when the underlying Inngest run completes, without the reviewer needing to reload. Above the panels, a single next-step banner names the highest-priority action the investigation needs.

**Why this priority**: Reviewers cannot triage 5–20 cases per shift if every async action requires guessing whether it succeeded. The banner removes the "what do I do next?" tax for new reviewers.

**Independent Test**: Trigger any of the four jobs from the detail page; confirm the pipeline panel shows `running` within 3 s of the click; confirm it shows `done` or `failed` after the Inngest run completes, without a manual refresh.

**Acceptance Scenarios**:

1. **Given** a fresh investigation with no `ExternalRecord` rows, **When** the detail page renders, **Then** the next-step banner reads `"Még nincs cross-reference. Futtasd, hogy TED/EKR rekordokat húzhassunk a nyomozáshoz."` and exposes the cross-reference button.
2. **Given** an investigation whose cross-reference Inngest run is in flight, **When** the page is open, **Then** the pipeline row for `Cross-reference` shows `⏳ fut` and the started-at timestamp; on completion the row flips to `✓ kész` with a summary like `"4 új rekord, 8.3 s"`.
3. **Given** an investigation whose hypothesis loop run failed with a token-cap, **When** the page renders, **Then** the row shows `✗ hiba` with the Hungarian remediation `"Token-keret elfogyott (50 000). Vágd szűkebbre a kérdést, vagy várd meg a nightly refresh-t."`, and the action button offers a retry.

### Edge cases (addendum)

- A claim names an amount that conflicts with the matching `ExternalRecord.valueHuf` (e.g. article says "56 milliárd" but the TED record reads 48Bn): the consolidation prefers the external record and records the conflict as an `InvestigationLead` of kind `claim_record_conflict`.
- A benchmark cohort exists but its time window does not overlap the contract's award year by ≥ 50 %: cohort is treated as not present (no component emitted, `cohort_window_drift` lead written instead).
- All inputs to a damage component are stale (> 365 d): the component still renders, but its confidence is forced to `low` and a "stale inputs" footnote is shown.
- A reviewer reopens the detail page while `damage_recompute` is mid-flight: the hero shows the previous estimate with a `recomputing…` badge; the new estimate replaces it without a full page reload on completion.

### Functional Requirements (addendum)

**Damage estimation**

- **FR-039**: System MUST compute and persist a `DamageEstimate` row per investigation, holding `totalLowHuf`, `totalHighHuf`, `confidence` (`low`/`medium`/`high`), a `components` array, a `computedAt` timestamp, and an `inputsHash` covering the IDs of every claim, external record, red flag, and benchmark cohort that fed the estimate.
- **FR-040**: System MUST emit a `DamageComponent` per evidenced mechanism on an investigation, where each component carries (`mechanism`, `lowHuf`, `highHuf`, `method`, `inputs.claimIds[]`, `inputs.externalRecordIds[]`, `inputs.benchmarkCohortId?`, `inputs.formula` as Hungarian human-readable text, `inputs.citation?`, `notes`).
- **FR-041**: System MUST compute `benchmark_deviation` overpricing components as `low = max(0, value − p90 × quantity)`, `high = max(0, value − p10 × quantity)` and MUST suppress the component when the cohort's `n < 10`, emitting a `cohort_too_thin` lead instead.
- **FR-042**: System MUST compute `amendment_delta` components as `mid = Σ amendment_increase`, `low = mid × 0.80`, `high = mid × 1.20` whenever a TED record carries ≥ 1 value-increasing amendment.
- **FR-043**: System MUST compute `industry_estimate` components for `single_bidder` / `no_bid` red flags as `low = contract_value × 0.05`, `high = contract_value × 0.15` and cite the OECD 2022 single-bidder premium study in `inputs.citation`.
- **FR-044**: System MUST compute `industry_estimate` components for `related_party` red flags as `low = contract_value × 0.05`, `high = contract_value × 0.15` and cite the World Bank government-corruption study in `inputs.citation`.
- **FR-045**: System MUST compute `claim_consolidation` components for `phantom_service` claims as `low = min(claim.allegedAmountHuf, contract_value or +∞)`, `high = max(claim.allegedAmountHuf over consolidated claims)`; without a contract anchor, multiply by `0.7` and `1.3` respectively.
- **FR-046**: System MUST deduplicate claims naming the same monetary fact (same vendor, same year, amounts within ±20 %) into a single claim-group whose amount is taken from the highest-confidence claim — never summed.
- **FR-047**: System MUST cap any set of damage components that reference the same `ExternalRecord` so the sum of their `highHuf` does not exceed that record's `valueHuf`; the cap MUST be applied to the lowest-priority component first, where the priority order is `overpricing > amendment_inflation > kickback > no_bid > phantom_service`.
- **FR-048**: System MUST recompute `DamageEstimate` within 30 s of any change to its inputs (claim insert/update/delete, external-record insert/update, red-flag verdict change, benchmark cohort update); the recompute MUST be debounced and SHOULD short-circuit when `inputsHash` is unchanged.
- **FR-049**: System MUST replace the queue-level "Becsült kár" KPI computation with `SUM(DamageEstimate.totalLowHuf)..SUM(DamageEstimate.totalHighHuf)`; the legacy `SUM(ArticleClaim.allegedAmountHuf)` MUST NOT be rendered to reviewers after Phase 3 of this addendum.

**Auditable scoring**

- **FR-050**: System MUST persist a `SignalContribution` row per signal that contributes to `Investigation.quantityScore`, carrying (`sourceKind`, `sourceId`, `baseWeight`, `stalenessMultiplier`, `effectiveWeight`, `addedAt`).
- **FR-051**: System MUST maintain the invariant `Investigation.quantityScore = Σ SignalContribution.effectiveWeight ± 0.01`; any drift MUST surface as a Sentry breadcrumb on the next render.
- **FR-052**: System MUST render the score panel as a table of `SignalContribution` rows with at least the columns (Jelzés / Súly / Staleness / Eff.) and a visible SUM; the score MUST NOT be rendered as a standalone bar without the table being one expansion away on the same page.

**Job state & UX**

- **FR-053**: System MUST persist an `InvestigationJobState` row per (`investigationId`, `jobKind`) with (`state` in {`idle`/`running`/`done`/`failed`}, `startedAt`, `finishedAt`, `inngestRunId`, `summary`, `errorMessage`); reviewer-triggered Inngest functions MUST write these rows inside `step.run` blocks at start and end.
- **FR-054**: System MUST expose `InvestigationJobState` to the detail page via a polling endpoint (≤ 2 s cadence while any job is `running`); the pipeline panel MUST reflect state changes within 3 s of the underlying state write.
- **FR-055**: System MUST render at most one next-step banner per detail page, picked by the priority order: (1) active `failed` job → (2) stale external record > 365 d → (3) missing cross-reference → (4) missing red flags → (5) tier-promotion predicate newly passes → (6) no banner.
- **FR-056**: System MUST NOT render any raw HTTP status code, English error name, or internal error code (e.g. `http_500`, `loop_in_flight`, `stale`) to a reviewer; every such code MUST be translated through a central Hungarian translator before display, and a snapshot test MUST guard the surface.
- **FR-057**: System MUST attach a hover-card to each tier-promotion button explaining the actual runtime consequence (e.g. journalist promotion: appears in the journalist-filtered view, no email or webhook is sent per FR-031b, the action is audit-logged) so reviewers do not promote under a wrong mental model.
- **FR-058**: System MUST cross-link evidence panels with damage components: each `ArticleClaim`, `ExternalRecord`, `BenchmarkResult`, and `RedFlagCheck` row that contributes to a `DamageComponent` MUST render a badge naming the component and linking to it; each `RedFlagCheck` row that contributes to a `SignalContribution` MUST render its `effectiveWeight`.

### Key Entities (addendum)

- **Damage Estimate**: One row per investigation summarising the total estimated damage. Carries `totalLowHuf`, `totalHighHuf`, a confidence indicator, an array of `DamageComponent` objects, a `computedAt` timestamp, and an `inputsHash` so unchanged inputs can short-circuit the recompute.
- **Damage Component**: One mechanism-scoped slice of a `DamageEstimate`. Carries the mechanism, a (low, high) HUF range, a computation method, a list of input record IDs (claims, external records, benchmark cohort), a Hungarian formula string, an optional citation, and a Hungarian notes string.
- **Signal Contribution**: One contribution to `Investigation.quantityScore`. Carries the source kind (external record / red flag / claim corroboration / benchmark deviation), the source record ID, the base weight, the staleness multiplier, the effective weight, and the timestamp it was added.
- **Investigation Job State**: The state of one async reviewer-triggered Inngest job for one investigation. Carries job kind, state, start/finish timestamps, the Inngest run ID, a Hungarian one-line summary, and a Hungarian-translated error message when applicable.

### Success Criteria (addendum)

- **SC-013**: Every investigation that has at least one `ArticleClaim` with an alleged amount, or at least one `ExternalRecord` with `valueHuf` and a matching benchmark cohort (`n ≥ 10`), renders a non-empty `DamageEstimate` hero with a low–high range and a confidence indicator.
- **SC-014**: Every `DamageComponent` rendered to a reviewer carries a Hungarian formula string and at least one clickable input link (claim, external record, or benchmark cohort).
- **SC-015**: The queue-level "Becsült kár" KPI is computed from per-investigation `DamageEstimate` totals; the legacy raw-claim sum is not rendered to reviewers after Phase 3 of this addendum.
- **SC-016**: For every investigation with a non-zero `quantityScore`, the score panel surfaces a `SignalContribution` table whose `effectiveWeight` column sums to the headline score within ±0.01.
- **SC-017**: The detail page reflects a job-state change (`running` → `done`/`failed`) within 3 s of the underlying state write, with no manual reload required by the reviewer.
- **SC-018**: Zero raw HTTP status codes and zero English error strings reach the reviewer surface (enforced by a snapshot test over the error fixture set).
- **SC-019**: At most one next-step banner renders per detail page; the chosen banner matches the documented priority order in 100 % of test fixtures.
- **SC-020**: For every set of `DamageComponent`s referencing the same `ExternalRecord`, the sum of `highHuf` is ≤ `ExternalRecord.valueHuf`.

### Assumptions (addendum)

- The OECD 2022 single-bidder premium range (5–15 %) and the World Bank government-corruption kickback range (5–15 %) are acceptable defaults for the industry-estimate components; counsel approves embedding these citations alongside any tier of disclosure that exposes the damage range.
- The cohort floor `n ≥ 10` is acceptable for the first cut; a future tightening to `n ≥ 20` is allowed once the cohort backfill reaches steady state.
- The mechanism cap-priority `overpricing > amendment_inflation > kickback > no_bid > phantom_service` is acceptable for the first cut; revisions require an entry in the addendum's clarifications section.
- The damage-recompute job runs asynchronously with a debounce ≤ 30 s; reviewers tolerate a brief `recomputing…` badge in exchange for non-blocking writes elsewhere.
- The public-tier rendering rules for the damage range (precise vs rounded to nagyságrend) are deferred to counsel; the default until counsel rules otherwise is "round to the nearest `Mrd Ft` for public-tier surfaces, full precision for internal/journalist/prosecutor".

### Open questions (addendum)

- Final form of the heuristic citations: do we publish the OECD and World Bank source URLs in `inputs.citation`, or only the study name? Counsel sign-off pending.
- Cohort-window drift threshold: 50 % overlap with the contract's award year is the proposed cut-off; revisit after the first 50 cohorts are backfilled.
- Whether `damage_recompute` should run synchronously inside the same Inngest step that wrote its input record (simpler, but couples write latency to damage-math latency) or remain a debounced follow-up job (current proposal).
- Whether counsel pre-approves each new `DamageComponent.method` before it ships, or only the public-tier rendering of those methods.

### Migration phasing

- **Phase 1 — data, zero UI risk**: add `DamageEstimate`, `DamageComponent` (jsonb), `SignalContribution`, `InvestigationJobState` tables; backfill `SignalContribution` from existing scoring inputs and assert the invariant against `Investigation.quantityScore`; compute `DamageEstimate` for every existing investigation as a one-shot Inngest job.
- **Phase 2 — dual-render**: render the new damage panel, score table, pipeline panel, and next-step banner **above** the existing detail-page panels for one sprint; collect reviewer feedback.
- **Phase 3 — deprecate**: replace the queue `Becsült kár` KPI with the new investigation-total sum; remove the opaque score bar; remove the legacy raw-claim KPI computation path.
- **Phase 4 — polish**: harden job-state streaming, finalise next-step priority ordering, add cross-link badges across all evidence panels, complete the central Hungarian error translator and its snapshot test.
