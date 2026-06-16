# Implementation Plan: Investigation Engine

**Branch**: `002-investigation-engine` | **Date**: 2026-05-15 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `specs/002-investigation-engine/spec.md`

## Summary

A layered, agent-assisted pipeline turns the ~33 k ingested Hungarian corruption articles into reviewer-grade investigation case files. The engine extracts atomic claims per article (Slice A), clusters claims into investigations (Slice B), attaches free-tier external evidence (Slices C–E), runs declarative red-flag rules and a bounded hypothesis agent (Slices G–H), benchmarks amounts against comparable cohorts (Slice F), scores cases on two transparent axes (Slice I), and gates promotion to journalist / prosecutor / public tiers behind server-side predicates plus a CODEOWNERS-protected, env-flagged public-tier render path (Slices J–K).

**Technical approach** (resolved in [./research.md](./research.md)): a single Next.js 15 + Inngest app on the inbox-to-action stack (Supabase Postgres, Drizzle, Anthropic Haiku 4.5, Vercel). All claim/cluster/xref/agent/score/promote workflows are Inngest functions; the admin surface is added under `apps/web/app/admin/(authed)/investigations/`. The hypothesis loop is bounded in code — not in prompt — by three caps (≤ 8 tool calls, ≤ 50 k tokens, ≤ 90 s wall clock). Paid registries (OPTEN, deep-ownership) are never called by the pipeline; the "escalate" button is a lead with manual paste-back. The public-tier render path stays off behind `PUBLIC_TIER_ENABLED=false` + counsel-approved redaction policy + CODEOWNERS — three independent gates per FR-033.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node 20 (existing repo pin).
**Primary Dependencies**: Next.js 15 (App Router), Inngest 3.x, Drizzle ORM 0.36, `@anthropic-ai/sdk` (Haiku 4.5), `cheerio` / `fast-xml-parser` (existing in `@korr/scrapers`), `@upstash/ratelimit` (existing, used for the admin-API floor).
**Storage**: Supabase Postgres (Cloud) — existing `pgcrypto`, `pg_trgm`, `unaccent` extensions; one additive raw-SQL migration (`0011_investigation_engine.sql`).
**Testing**: Vitest (unit + Inngest function tests, existing convention), Playwright + axe (admin UI accessibility on the new `/admin/investigations` routes).
**Target Platform**: Vercel-hosted web app + Inngest Cloud functions; Supabase Postgres; Sentry observability; Better Stack alerts. No mobile.
**Project Type**: Web service inside the existing Next.js monorepo (constitution Principle III). No new packages — extends `@korr/db`, `@korr/web`, `@korr/scrapers`, `@korr/shared`.
**Performance Goals**: p95 ≤ 2 s for the admin case page (SC-001). Backlog drains in ~24–30 h at `EXTRACTION_CONCURRENCY=2` (spec Assumption). Hypothesis loop terminates inside its caps for 100 % of runs (SC-012).
**Constraints**: Daily LLM spend ceiling enforced by code (FR-005). Per-source-system fetch concurrency = 1, per-host gate ≥ 2 s (FR-016). Optimistic concurrency on every state-changing investigation write (FR-031c).
**Scale/Scope**: ~33 k existing articles, growing by hundreds per day. New schema: 10 tables, 14 enums. New admin routes: ≈ 6 pages + 14 API endpoints. New Inngest functions: 11.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The current constitution (`v1.0.0`) is the Korruptométer constitution that covers Phases 1–4 of the original product roadmap. This feature is an additive layer over Phase 2's admin surface; it does NOT push Phases 1–4 forward. The relevant principles:

| Principle | Status | Notes |
|---|---|---|
| **I. Trust Posture Above Convenience** | ✅ | Public-tier render gate (FR-032/033) layers env flag + CODEOWNERS + counsel policy doc on top of the existing Phase-2 trust controls. WebAuthn step-up applies to every reviewer action route. No claim text, evidence quote, or party name reaches a public route while the flag is off (SC-009). |
| **II. Phased Shippability** | ✅ | The feature ships as 11 independently demoable slices (A through K, plus Slice F benchmarks). Each slice has its own Independent Test in the spec. No slice depends on another's UI to be useful. |
| **III. Single Next.js App on the Inbox-to-Action Stack** | ✅ | All code lives under `app/apps/web/` and the existing four workspace packages (`@korr/db`, `@korr/web`, `@korr/scrapers`, `@korr/shared`). No new package. No Redis used as a queue (only as the existing `@upstash/ratelimit` floor). Anthropic SDK already in repo. |
| **IV. Data Minimization & GDPR Retention by Default** | ✅ with one new pattern called out | Claims store a verbatim quote (paragraph-level citation from the article body), which is allowed because (a) the source article is already stored as `excerpt` + URL, (b) the quote is a paragraph-level citation, not the body, and (c) the quote ships only to the admin tier until the FR-032/033 gates pass. `NewsArticle.body` continues to NOT be stored. DSR cascade (FR-035) hard-deletes claim rows naming the subject; investigation rows anonymize but stay so audit-log refs resolve. `AuditLog` reuse (no new audit table) keeps the 24-month partitioned retention. |
| **V. Eventual-Consistency on KPIs; Web Request Path Never Recomputes** | ✅ | Score recompute is event-driven via Inngest. Public-tier promotion does an atomic case-write inside a single Postgres transaction (FR-028) — this is an *admin write path*, not a web request path, so Principle V does not bind. The post-commit `revalidateTag('stats')` happens outside the transaction. |
| **VI. Edge-First Reads, Rate-Limited Writes, Verified-Human Path** | ✅ | All new endpoints are `/api/admin/*` and inherit the existing admin-API auth + WebAuthn step-up + rate-limit floor. No new public read paths in this feature. |
| **VII. Two-Step Destructive Migrations & Editor-Decision Preservation** | ✅ | The migration is additive (`CREATE TABLE`/`CREATE TYPE`/`CREATE INDEX` only) — the two-step rule does not bind, but the migration still ships in its own PR ahead of the code that depends on its shape. Editor-decision preservation: `Investigation.summary` is reviewer-edited and the score / clustering jobs MUST NOT stomp it; clustering does not write `summary` at all, and the scoring job only touches `quantityScore`/`qualityScore`. The `InvestigationArticleLink.role` field is reviewer-editable in future Slice-B follow-ups and the clusterer MUST treat reviewer-set values as authoritative — equivalent to `linkOverridden` on `NewsArticle.relatedCaseId`. |

**Non-mechanisms (called out so they don't sneak in)**:

- **No new runtime role** (FR-031a). Every authenticated admin is the single `reviewer` role; "operator" and "counsel" are workflow duties, not auth roles. No new permission middleware, no role-claim in the JWT, no role-gated route. Accountability is the per-action `AuditLog.actorEditorId` field plus CODEOWNERS for counsel-sensitive code paths.
- **No notification dispatch** (FR-031b). Journalist and prosecutor tiers are metadata + a filterable view inside the admin UI only. No email, webhook, push, Slack, or SMS function ships in this feature; the handoff to a specific journalist or prosecutor is the reviewer's out-of-band responsibility. The only externally-rendered artifact is the public-tier wanted-poster case row, and only when the FR-033 gates pass.

**Other constitutional constraints exercised**:

- **Locale.** Admin UI continues English shell, Hungarian source content. Red-flag observations are in Hungarian (FR-019). Existing `fmtFt` formatter is used for any HUF rendering.
- **Accessibility.** Playwright + axe added on the new `/admin/investigations` and `/admin/investigations/[id]` routes; CI fails on serious/critical violations.
- **Security headers / CSP.** No new external origins introduced for the admin path (Anthropic is server-side only); CSP is unchanged.
- **Backups & restore drills.** Investigation tables are part of the same Supabase project — PITR + restore-drill cadence applies as-is.
- **Scraping ethics.** Free-tier registry adapters use the existing `Korruptometer-Bot/1.0` UA, per-host 2-s gate, per-source-system concurrency-1 (FR-016).

**No violations to justify in the Complexity Tracking table.**

## Project Structure

### Documentation (this feature)

```text
specs/002-investigation-engine/
├── plan.md              # This file
├── spec.md              # Feature specification (already authored)
├── research.md          # Phase 0 — resolved technical decisions
├── data-model.md        # Phase 1 — entities, indexes, lifecycle
├── quickstart.md        # Phase 1 — local dev walkthrough
├── contracts/
│   ├── admin-investigations.md   # HTTP API contract
│   └── inngest-events.md         # Inngest event + function contract
├── checklists/
│   └── requirements.md           # Spec-quality checklist (existing)
└── tasks.md             # Phase 2 — generated by /speckit.tasks (NOT in this PR)
```

### Source Code (repository root)

```text
app/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── admin/(authed)/
│       │   │   ├── admin-tabs.tsx                # EDIT — add Investigations tab before kmonitor-persons
│       │   │   └── investigations/                # NEW — admin UI
│       │   │       ├── page.tsx                   # queue
│       │   │       ├── [id]/
│       │   │       │   ├── page.tsx               # detail
│       │   │       │   ├── claims-panel.tsx
│       │   │       │   ├── external-records-panel.tsx
│       │   │       │   ├── redflags-panel.tsx
│       │   │       │   ├── leads-panel.tsx
│       │   │       │   ├── benchmarks-panel.tsx
│       │   │       │   ├── history-panel.tsx
│       │   │       │   └── action-bar.tsx
│       │   │       └── filters.tsx
│       │   └── api/admin/investigations/          # NEW — HTTP contracts/admin-investigations.md
│       │       ├── route.ts                       # GET list
│       │       ├── [id]/
│       │       │   ├── route.ts                   # GET detail
│       │       │   ├── status/route.ts
│       │       │   ├── summary/route.ts
│       │       │   ├── xref/route.ts
│       │       │   ├── redflags/route.ts
│       │       │   ├── hypothesis-loop/route.ts
│       │       │   ├── escalate/route.ts
│       │       │   ├── external-records/route.ts
│       │       │   ├── promote/route.ts
│       │       │   └── depromote/route.ts
│       │       ├── leads/[leadId]/resolve/route.ts
│       │       └── llm-usage/route.ts
│       ├── src/
│       │   ├── inngest/
│       │   │   ├── functions/                    # NEW — 11 Inngest functions
│       │   │   │   ├── investigation-extract-claims.ts
│       │   │   │   ├── investigation-cluster.ts
│       │   │   │   ├── investigation-xref.ts
│       │   │   │   ├── investigation-benchmarks-compute.ts
│       │   │   │   ├── investigation-redflags.ts
│       │   │   │   ├── investigation-hypothesis-loop.ts
│       │   │   │   ├── investigation-score.ts
│       │   │   │   ├── investigation-promote-public.ts
│       │   │   │   ├── investigation-anonymize-dsr.ts
│       │   │   │   ├── investigation-refresh-stale-external.ts
│       │   │   │   └── investigation-orphan-cleanup.ts
│       │   │   └── index.ts                      # EDIT — register new functions
│       │   └── lib/
│       │       ├── investigation/                # NEW — pure helpers
│       │       │   ├── cluster.ts                #   clustering predicates (FR-008/FR-009)
│       │       │   ├── extractor-version.ts      #   {model}@{promptHash8}
│       │       │   ├── normalize-name.ts         #   reuse existing helper
│       │       │   ├── redflag-rules.ts          #   declarative rules
│       │       │   ├── benchmarks.ts             #   dimension registry + cohort SQL
│       │       │   ├── score.ts                  #   FR-024 computation
│       │       │   └── concurrency.ts            #   optimistic-concurrency helper
│       │       └── public-render/                # NEW — gated module (CODEOWNERS-protected)
│       │           └── (no code lands until FR-033 gates pass)
│       └── tests/
│           ├── inngest/                          # NEW — Inngest function unit tests
│           └── api/admin/investigations/          # NEW — route tests
├── packages/
│   ├── db/
│   │   └── src/
│   │       └── schema.ts                         # EDIT — append 10 tables + enums + types
│   ├── scrapers/
│   │   └── src/
│   │       └── adapters/                         # NEW — one file per source system
│   │           ├── types.ts
│   │           ├── ted.ts
│   │           ├── ekr.ts
│   │           ├── ke.ts
│   │           ├── palyazat.ts
│   │           ├── ecegjegyzek.ts
│   │           ├── opencorporates.ts
│   │           ├── integritas.ts
│   │           ├── olaf.ts
│   │           ├── ksh.ts
│   │           ├── eurostat.ts
│   │           ├── kmonitor-adapter.ts
│   │           ├── atlatszo.ts
│   │           └── webarchive.ts
│   └── shared/
│       └── src/
│           └── investigation.ts                  # NEW — DTOs shared between web ↔ admin
└── supabase/
    └── migrations/
        └── 0011_investigation_engine.sql         # NEW — additive schema
```

**Structure Decision**: Single Next.js app on the inbox-to-action stack (constitution Principle III). All new code lives inside the existing four workspace packages — no new package is introduced. The admin UI follows the existing `apps/web/app/admin/(authed)/` convention; the API routes follow the existing `apps/web/app/api/admin/` convention; Inngest functions follow the existing `apps/web/src/inngest/functions/` convention. The only new directory at the package root is `apps/web/src/lib/investigation/` for pure helpers, mirroring how `lib/admin/` and `lib/sealed-box/` are organized today.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None. Constitution Check passes on every principle without exception. The feature is additive (new tables, new routes, new Inngest functions, one edit to `admin-tabs.tsx`); no schema is dropped or renamed; no destructive migration ships; no new infrastructure is introduced.

---

## Re-evaluation after Phase 1 design

Re-checked the Constitution against the Phase 1 artifacts ([data-model.md](./data-model.md), [contracts/admin-investigations.md](./contracts/admin-investigations.md), [contracts/inngest-events.md](./contracts/inngest-events.md)):

| Concern raised during Phase 1 design | Resolution |
|---|---|
| Public-tier promotion's atomic-write (FR-028) wraps multiple DML statements in one transaction inside an admin route — does this conflict with Principle V? | No. Principle V binds the *web request path* (anonymous GET of `/api/stats` and similar). Admin POSTs to `/api/admin/investigations/:id/promote` are admin mutations and are explicitly allowed to do synchronous work (the existing `/api/admin/cases` mutations do the same). The `revalidateTag` call happens after commit, outside the transaction. |
| Hypothesis loop uses Anthropic tool-use inside an Inngest function — does this violate "no opaque scores" (FR-020)? | No. The loop writes `InvestigationLead` rows with explicit `kind`, `question`, `finding`, and (when a cap fires) `capFired`. No score is produced. The rule engine (Slice G) is fully declarative and its `observationHu` is mandatory (FR-019/020). |
| `ArticleClaim.evidenceQuote` stores a verbatim quote — is that compatible with Principle IV's `NewsArticle.body` ban? | Yes. The ban is on storing the full body. Storing one paragraph-level citation per claim (with locator + URL back to the source) is the minimum needed to satisfy FR-036 ("every numerical claim must carry a re-verifiable source URL and a locator"). Quotes ship to admin tier only until the FR-032/033 gates pass. |
| The new Investigations queue tab edits `admin-tabs.tsx` — does that risk breaking the existing K-Monitor persons workflow? | No. The edit is purely additive (insert one `<TabLink>` before the existing one). Existing routes and behaviour are untouched. |
| `RedFlagCheck.supportingRecordIds` is a `uuid[]` without a foreign key — does that violate referential integrity? | Intentional. Postgres array columns can't carry per-element FKs; the references are validated at write time and the orphan janitor (`investigation.orphan-cleanup`, nightly) cleans stale ids. Same trade-off the existing `KMonitorPersonCandidate.sampleArticles` jsonb uses. |
| `InvestigationLead.actorEditorId` paired-nullability check — does it scale across DSR deletion of editors? | Yes. The FK is `ON DELETE SET NULL`, so editor deletion nulls the field; the paired CHECK constraint allows null when `createdBy ≠ 'reviewer'`. We leave existing reviewer-created leads with `actorEditorId = null` post-DSR-of-an-editor, which is acceptable (audit-log still resolves via `AuditLog.actorEditorId` and partitioned 24-month retention). |

**Result**: Constitution Check still passes post-design. No new complexity-tracking entries needed.

---

## Generated artifacts

- [research.md](./research.md) — Phase 0
- [data-model.md](./data-model.md) — Phase 1
- [contracts/admin-investigations.md](./contracts/admin-investigations.md) — Phase 1
- [contracts/inngest-events.md](./contracts/inngest-events.md) — Phase 1
- [quickstart.md](./quickstart.md) — Phase 1

Next step: `/speckit.tasks` generates `tasks.md`. This planning command stops here.

---

## Addendum 2026-05-19 — Damage→Evidence Spine

**Spec section**: [./spec.md](./spec.md) §"Addendum 2026-05-19 — Damage→Evidence Spine" (US-7/US-8/US-9, FR-039..FR-058, SC-013..SC-020).

### Summary (addendum)

The Slice A–K engine produces the correct data but its reviewer surface does not answer (1) "how much HUF did this cost the state?", (2) "what evidence and math back that number?", (3) "what should I do next?". This addendum adds a thin data layer (`DamageEstimate`, `SignalContribution`, `InvestigationJobState`) plus a redesigned detail-page surface (damage panel, auditable score table, real-time pipeline panel, next-step banner, central error translator) so every damage forint is traceable to a paragraph, every quantity-score number is an auditable sum, and every async action shows its state without a reload.

**Technical approach**: additive only. One new migration (`0012_damage_evidence_spine.sql`), one new Inngest function (`investigation-damage-recompute`), four new admin API endpoints (job-state poll, damage-estimate read, signal-contribution read, error-translator surface test fixture), and a redesigned detail page rendered **above** the existing panels during Phase 2 of the addendum's migration so the old surface keeps working for one sprint. No package additions; everything fits the existing four workspace packages.

### Technical Context (addendum)

**New dependencies**: none. All math is Postgres + TS. SSE for job-state streaming uses the existing `EventSource`-compatible Next.js route convention; no library added.
**New tables**: `DamageEstimate` (1 row per investigation, `components` jsonb), `SignalContribution` (N rows per investigation), `InvestigationJobState` (1 row per `(investigationId, jobKind)`). All additive.
**New Inngest functions**: `investigation.damage-recompute` (debounced ≤ 30 s, triggered by claim/external-record/red-flag/benchmark changes).
**Performance**: damage recompute target p95 ≤ 2 s per investigation; job-state poll endpoint p95 ≤ 100 ms (it's a single indexed read).
**Scale**: ~33 k investigations × ≤ 6 components each = ~200 k component rows in `components` jsonb; ~5 SignalContribution rows on average per investigation = ~165 k rows. Trivial for Postgres.
**Constraints**: every state mutation that feeds `DamageEstimate` must enqueue exactly one debounce-keyed `damage-recompute` event (FR-048); the debounce key is `investigationId` so concurrent inputs collapse into one recompute.

### Constitution Check (addendum)

Re-checked against `v1.0.0`:

| Principle | Status | Notes |
|---|---|---|
| **I. Trust Posture Above Convenience** | ✅ | Damage figures shown on public-tier surfaces are gated through the same FR-032/033 chain; counsel signs off on the precise-vs-rounded rendering rule (spec Assumption addendum). Heuristic citations (OECD, WB) are stored alongside the figure they justify; no number ships without its source string. |
| **II. Phased Shippability** | ✅ | Ships as three independently demoable user stories (US-7 damage, US-8 score, US-9 job-state+UX). Phase 1 of the migration is data-only and demoable in isolation (backfill + invariant assertion). |
| **III. Single Next.js App on the Inbox-to-Action Stack** | ✅ | All code lives under `app/apps/web/` and the existing four workspace packages. No new package. No new infra. One new Inngest function. |
| **IV. Data Minimization & GDPR Retention by Default** | ✅ | `DamageEstimate.components` jsonb stores **derived** facts (formula string, input IDs, citation, low/high HUF) — no new personal data. `SignalContribution` stores references to existing source rows. `InvestigationJobState` stores no personal data. DSR cascade does not need to touch the new tables: anonymizing an investigation through FR-034/035 leaves the derived totals in place because they are aggregated from already-anonymized inputs. |
| **V. Eventual-Consistency on KPIs; Web Request Path Never Recomputes** | ✅ | Damage recompute is event-driven via Inngest with a 30 s debounce. The queue KPI page reads cached `DamageEstimate.totalLowHuf`/`totalHighHuf` columns — never recomputes inline. |
| **VI. Edge-First Reads, Rate-Limited Writes, Verified-Human Path** | ✅ | All new endpoints are `/api/admin/*` and inherit the existing admin-API auth + WebAuthn step-up + rate-limit floor. The job-state poll endpoint is a GET with a small payload; existing rate-limit floor is enough. |
| **VII. Two-Step Destructive Migrations & Editor-Decision Preservation** | ✅ | Migration `0012` is `CREATE TABLE`/`CREATE TYPE`/`CREATE INDEX` only — additive, no two-step needed. Editor-decision preservation: reviewer-edited `Investigation.summary` and reviewer-set `InvestigationArticleLink.role` are untouched; the new tables only write derived data. |

**No new runtime role** (FR-031a holds). **No notification dispatch** (FR-031b holds). **No new external origin** (heuristic citation URLs are stored as static strings, not fetched at render time).

**Result**: Constitution Check passes on every principle without exception. No complexity-tracking entries needed.

### Project Structure (addendum)

```text
specs/002-investigation-engine/
└── (spec.md, plan.md, tasks.md — all amended in place; no new file)

app/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── admin/(authed)/investigations/
│       │   │   ├── page.tsx                     # EDIT — queue KPI uses DamageEstimate totals (FR-049)
│       │   │   └── [id]/
│       │   │       ├── page.tsx                 # EDIT — render damage panel + signal table + pipeline above existing panels (Phase 2)
│       │   │       ├── damage-panel.tsx         # NEW
│       │   │       ├── signal-table.tsx         # NEW — replaces the opaque score bar
│       │   │       ├── pipeline-panel.tsx      # NEW — replaces the binary checklist
│       │   │       ├── next-step-banner.tsx    # NEW
│       │   │       └── (existing panels untouched in Phase 2; cross-link badges added in Phase 4)
│       │   └── api/admin/investigations/
│       │       ├── [id]/
│       │       │   ├── damage-estimate/route.ts # NEW — GET
│       │       │   ├── signal-contributions/route.ts # NEW — GET
│       │       │   └── job-state/route.ts       # NEW — GET (SSE-or-poll)
│       │       └── route.ts                     # EDIT — list KPI uses DamageEstimate
│       ├── src/
│       │   ├── inngest/
│       │   │   ├── functions/
│       │   │   │   └── investigation-damage-recompute.ts # NEW
│       │   │   └── index.ts                              # EDIT — register the new function + the InvestigationJobState writers
│       │   └── lib/
│       │       └── investigation/
│       │           ├── damage.ts                # NEW — pure helpers: per-mechanism formulas (FR-041..FR-045), dedup (FR-046), cap (FR-047)
│       │           ├── damage-citations.ts      # NEW — frozen citation strings (OECD 2022, WB government corruption study)
│       │           ├── signal-contributions.ts  # NEW — pure helpers: derive rows from existing FR-022/023 inputs
│       │           ├── job-state.ts             # NEW — pure helpers: state transitions + Hungarian summaries
│       │           ├── next-step.ts             # NEW — pure: priority selector (FR-055)
│       │           └── i18n-errors.ts           # NEW — central Hungarian translator (FR-056)
│       └── tests/
│           ├── inngest/
│           │   └── investigation-damage-recompute.test.ts # NEW
│           ├── lib/
│           │   ├── damage.test.ts               # NEW — covers every formula + dedup + cap
│           │   ├── signal-contributions.test.ts # NEW — invariant `Σ = quantityScore ± 0.01`
│           │   ├── next-step.test.ts            # NEW — priority order coverage
│           │   └── i18n-errors.test.ts          # NEW — snapshot over the error fixture set
│           └── api/admin/investigations/
│               ├── damage-estimate.test.ts      # NEW
│               ├── signal-contributions.test.ts # NEW
│               └── job-state.test.ts            # NEW
└── supabase/
    └── migrations/
        └── 0012_damage_evidence_spine.sql       # NEW — additive
```

**Structure Decision (addendum)**: still single Next.js app on the inbox-to-action stack. Every new file fits an existing directory convention; no new top-level directory is introduced. The migration ships in its own PR ahead of the application code (Principle VII).

### Re-evaluation after addendum design

| Concern | Resolution |
|---|---|
| Storing OECD/WB heuristic ranges as code constants — does that drift from the published source? | Each citation is frozen as a `{ studyId, range, sourceUrl, lastVerifiedAt }` tuple in `damage-citations.ts`, with the dated `// last-verified: 2026-05-19` comment pattern. A nightly placeholder job pings the source URL and emits a Sentry breadcrumb on 4xx/5xx so drift is caught. |
| Job-state polling vs SSE — does either violate Principle V (web request path never recomputes)? | The poll endpoint reads a single indexed row from `InvestigationJobState` and is admin-only. No recomputation occurs on read. SSE is preferred when behind Vercel; polling at 2 s cadence is the documented fallback. |
| Debounced `damage-recompute` vs synchronous compute — what happens to the queue KPI if it reads pre-recompute totals? | Acceptable; the KPI is documented as eventually consistent (Principle V binds it). The detail page renders a `recomputing…` badge so reviewers do not act on stale totals. |
| Cap-priority (`overpricing > amendment > kickback > no_bid > phantom_service`) is a normative choice. Counsel sign-off needed? | The default is documented in spec Assumption addendum and audit-logged on every cap application. Counsel approves the order before the public-tier render path (FR-033) consumes any damage range. |
| FR-049 deprecation of the legacy queue KPI — does removing the legacy code path conflict with Principle VII? | No; the deprecation only removes UI rendering and the legacy SQL. The underlying `ArticleClaim.allegedAmountHuf` column stays in the schema and keeps being written. |
| FR-051 invariant assertion (`quantityScore = Σ effectiveWeight ± 0.01`) — what if it ever drifts? | Drift surfaces as a Sentry breadcrumb on render plus a `score_invariant_drift` lead written by the recompute function. Failure mode is non-blocking (the page still renders the table and the headline number); the breadcrumb tells the on-call engineer to investigate. |

**Result**: Constitution Check still passes post-addendum design. No new complexity-tracking entries.
