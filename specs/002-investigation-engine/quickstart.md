# Quickstart: Investigation Engine

**Branch**: `002-investigation-engine` | **Spec**: [spec.md](./spec.md)

This quickstart walks the engine end-to-end on a local dev box. It assumes the existing Korruptométer bootstrap is already done (see `app/README.md` once present, or constitution Principle III's "Local dev bootstrap" block).

Time to first end-to-end signal: ≈ 15 min on a warm laptop.

---

## 1. Prerequisites

- Existing local bootstrap green: `pnpm install`, Supabase Docker stack up, `pnpm --filter @korr/db migrate && pnpm --filter @korr/db seed`, `pnpm dev` running.
- `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` in a second terminal.
- An ingested article corpus — either the seed cases plus a handful of `NewsArticle` rows, or a small slice of the K-Monitor harvester output.

---

## 2. Environment variables

Add these to `app/.env.local` (and document them in `app/.env.example`):

```
# --- Slice A: claim extraction ---
ANTHROPIC_API_KEY=sk-ant-...
INVESTIGATION_EXTRACTOR_MODEL=claude-haiku-4-5
INVESTIGATION_EXTRACTOR_PROMPT_VERSION=v1
LLM_DAILY_CEILING_HUF=50000     # local dev — production sets ~200000
EXTRACTION_CONCURRENCY=2

# --- Slice H: hypothesis loop caps (FR-021) ---
HYPOTHESIS_CONCURRENCY=2
HYPOTHESIS_MAX_TOOL_CALLS=8
HYPOTHESIS_MAX_TOKENS=50000
HYPOTHESIS_MAX_WALL_MS=90000
HYPOTHESIS_MODEL=claude-haiku-4-5

# --- Slice F: nightly refresh prioritization (FR-015) ---
REFRESH_STALE_TOP_N=100

# --- Slice K: public-tier render gate (FR-032/FR-033) ---
PUBLIC_TIER_ENABLED=false       # MUST stay false in every environment until counsel signs off
```

`LLM_DAILY_CEILING_HUF` is intentionally tiny on dev so the kill switch fires during smoke testing — see step 7.

---

## 3. Run the migration

```bash
pnpm --filter @korr/db db:generate   # regenerates drizzle artifacts from schema.ts
pnpm dlx supabase db push            # applies app/supabase/migrations/0011_investigation_engine.sql
```

Smoke check:

```bash
pnpm dlx supabase db psql -c "\d \"ArticleClaim\""
pnpm dlx supabase db psql -c "\d \"Investigation\""
```

Both tables should exist with the columns documented in [data-model.md](./data-model.md).

---

## 4. Slice A — extract claims for one article

```bash
# fire the Inngest event manually
curl -X POST http://localhost:8288/e/dev-key \
  -H 'content-type: application/json' \
  -d '{
    "name": "investigation.article.ingested",
    "data": { "articleSource": "news", "articleId": "<a-real-NewsArticle-id>" }
  }'
```

In the Inngest dashboard (`http://localhost:8288`) you should see `investigation.extract-claims` run, then emit `investigation.claims.extracted`.

Verify:

```sql
SELECT id, "mechanism", "allegedAmountHuf", "amountBasis",
       jsonb_array_length(parties) AS party_count,
       "extractorVersion"
FROM "ArticleClaim"
WHERE "articleSource" = 'news' AND "articleId" = '<id>';
```

Re-fire the same event — confirm no new rows appear and `DailyLlmUsage."callCount"` does not advance (FR-002).

---

## 5. Slice B — clustering and the Investigations queue

The `investigation.cluster` function triggers automatically on `investigation.claims.extracted`. Open `/admin/investigations` in the browser. You should see:

- A new tab labelled "Investigations" appears before "K-Monitor persons".
- One row per investigation, ordered by `recent`.

Seed three articles naming the same official with amounts in a 2× band within 90 days, re-fire ingest events for each, and confirm the queue collapses to one row with `articleCount = 3`.

Then seed a fourth article whose only named party matches an unrelated investigation. Confirm a `cluster_ambiguous` lead row appears under the lead list of the original investigation — no auto-merge.

---

## 6. Slice C–F — cross-reference and benchmarks

Open the new investigation in the admin (`/admin/investigations/:id`), click **"Run cross-reference"**. The UI returns immediately; the Inngest dashboard shows `investigation.xref` fanning out one step per source system (TED, EKR, …).

For the dev environment, point each adapter at its public sandbox / archive mirror (configured per-adapter file). Within a few seconds, `ExternalRecord` rows should appear under the case.

For a contract dimension we know how to benchmark (e.g., HUF/m² for hospital construction), click **"Run benchmarks"** and confirm a deviation flag with `n`, `p10/p50/p90`, and the cohort spec is shown.

---

## 7. Daily kill switch smoke test (FR-005)

Set `LLM_DAILY_CEILING_HUF=10` (ten forint) and re-fire `investigation.article.ingested`. The function should:

1. Read `DailyLlmUsage` for today.
2. See `estimatedHufSpend >= ceiling`.
3. Emit `investigation.extraction.paused` (visible in Sentry breadcrumb stream and the Inngest dashboard).
4. Return without calling Anthropic.

Reset `LLM_DAILY_CEILING_HUF` to `50000` for the rest of the walkthrough.

---

## 8. Slice G — red flags

Click **"Run red-flag rules"** on an investigation whose TED record carries a single bidder. The page renders the rule list with `single_bidder` showing `verdict: fail`, a Hungarian observation, and a link to the supporting `ExternalRecord`.

Confirm no rule output contains an opaque score (FR-020).

---

## 9. Slice H — hypothesis loop

Click **"Run hypothesis loop"**. Within ≤ 90 s the run terminates:

- If the agent found something: one or more `InvestigationLead` rows with `kind='hypothesis'` and a `finding`.
- If a cap fired: an `InvestigationLead` with `capFired` set to one of `tool_calls`, `tokens`, `wall_clock` and a Hungarian explanation.

Try clicking the button twice in rapid succession — the second click should fail with `409 loop_in_flight`.

---

## 10. Slice I — scoring

Visible immediately on the case page. With one TED corroboration and one medium-severity red flag, expect:

- `quantityScore ≈ 2.00`
- `qualityScore = investigative_journalism` (or whatever the highest grade present is)

Open a second investigation with a 600-day-old external record. Confirm its contribution is `0.5×` (FR-024 staleness decay).

---

## 11. Slice J — tier promotion

On a case where the predicate passes (`quantityScore ≥ 2`, `qualityScore ≥ investigative_journalism`), click **"Promote to journalist"**.

- Tier flips to `journalist`.
- The case appears in the journalist-tier filtered view.
- An `AuditLog` row with `action='investigation.tier.promoted.journalist'` is written.
- No email/webhook is dispatched (FR-031b).

On a case where the predicate does NOT pass, confirm the promotion button is **not visible** (FR-027).

Try to promote a case to public while `PUBLIC_TIER_ENABLED=false`. The promotion still succeeds (an internal `Case` row is created) but visiting any public-tier route while the flag is off returns 404 — verify by hitting `/galeria/<case-id>` in an incognito tab.

---

## 12. Optimistic-concurrency smoke test (FR-031c)

In two browser windows, open the same investigation. In window A, change the summary and save. In window B (which still has the stale `updatedAt`), try to dismiss the investigation. The request fails with `409 stale` and the UI prompts a reload.

---

## 13. DSR anonymization smoke test (FR-034, FR-035)

Trigger the DSR workflow for a person named on an investigation. After the next nightly retention sweep (or by manually firing `investigation.dsr.deletion.upheld`):

- `Investigation.primaryPersonName = '[redacted]'`, `primaryPersonNormalized = NULL`.
- Every `ArticleClaim` row referencing the subject is gone.
- The investigation row stays so its audit-log references resolve.

---

## 14. Validation chain

After implementing each slice, run the standard chain:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Browser verification per `~/.claude/CLAUDE.md` ("Validation Loop"): exercise the admin UI for each slice through the steps above. Take per-scenario PASS/FAIL/NOT TESTED notes (constitution-equivalent) before marking the slice complete.

---

## 15. Damage estimate walkthrough (US-7, addendum 2026-05-19)

Open a case that already has external records and at least one failing red flag.

- The **Kárbecslés** panel renders **above** the claims/external-records panels (Migration phase 2).
- The hero shows a HUF range (`X..Y Mrd Ft`) + a confidence chip (`alacsony`/`közepes`/`magas`).
- One row per `DamageComponent` is collapsible. Each row carries: mechanism label, method label, Hungarian formula, citation (when applicable), and a clickable list of contributing claim / external-record / benchmark anchors.
- Click a claim link in a damage row → the page scrolls to that claim card in the **Állítások** panel; the card now wears a `🔗 hozzájárul: <mechanism> (<low>–<high> Mrd Ft)` badge.
- Trigger a fresh cross-reference. Within ~30 s the damage panel updates without a manual reload — the debounced `investigation.damage-recompute` Inngest function picks up the change.

PASS / FAIL / NOT TESTED per row above.

---

## 16. Auditable score table (US-8, addendum 2026-05-19)

Same case.

- The **Mennyiségi pont** panel is now a four-column table (Jelzés / Súly / Staleness / Eff.). The opaque score bar from before is gone.
- The headline number above the table equals `Investigation.quantityScore`.
- The `Σ effektív` row matches the headline within ±0.01. If it ever drifts, a red `signal-drift` alert is shown; the page must not silently swallow the drift (SC-016).
- Rows with `staleness × < 1.00` carry an inline footnote.
- Each failing red flag's row in the **Vörös zászlók** panel wears a `súly: X.XX → eff. Y.YY` badge linking back to the signal table.

PASS / FAIL / NOT TESTED per row above.

---

## 17. Job state + next-step banner (US-9, addendum 2026-05-19)

Same case, then trigger a cross-reference from the action bar.

- The **Folyamat** panel flips the matching row to `fut` within ~3 s and to `kész` or `hiba` within ~30 s **without** a manual reload (SSE-driven; falls back to 2 s polling when the stream drops). (SC-017)
- The **next-step banner** above the action bar shows at most one line. Force a job to fail (e.g., kill the Inngest dev runner mid-flight) and confirm the banner shows the Hungarian translation of the error code with an "Újrapróbálás" CTA — no raw HTTP status, no English verb (SC-018).
- Hover any of the three promotion buttons (Újságírói, Ügyészi, Publikálás): a Hungarian tooltip explains the preconditions in plain language (FR-057).
- Every error string on the page passes through `tError()` — confirm by inspecting the rendered DOM: no `http_409`, no `predicate_failed`, no English noun (T151).

PASS / FAIL / NOT TESTED per row above.
