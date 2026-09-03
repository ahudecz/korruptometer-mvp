# corruption-tracker (korruptométer) — Development Guidelines

> Generic rules live in `~/.claude/CLAUDE.md`. This file is project-specific only.
> `## Active Technologies` and `## Recent Changes` are auto-maintained by speckit
> (`.specify/scripts/bash/update-agent-context.sh`) — leave them to the tool. All other
> sections are hand-maintained and survive speckit regeneration.

## Tech Stack

- **Language/runtime:** TypeScript 5.6, Node ≥20
- **Monorepo:** pnpm 10 workspaces + Turborepo (`app/` is the workspace root)
- **Web app:** Next.js 15 (App Router) — `@korr/web` in `app/apps/web`
- **Packages:** `@korr/db` (Drizzle ORM 0.36 / Postgres), `@korr/scrapers` (`cheerio`, `fast-xml-parser`), `@korr/shared`, `@korr/ui`
- **Background jobs:** Inngest 3.x
- **AI:** `@anthropic-ai/sdk` (Haiku 4.5 for extraction/hypothesis)
- **Infra:** Supabase (DB + storage), Upstash Redis (rate limit), Sentry, Better Stack
- **Test runner:** Vitest 2; E2E via Playwright

## Commands

> The real codebase is under `app/`. The repo root has a stray `package-lock.json` — **ignore it**; always work from `app/` with **pnpm**, never npm.

```bash
cd app
pnpm install

# whole monorepo (via turbo)
pnpm dev            # all dev servers, parallel (web on :3000)
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# web app only (fastest inner loop) — preferred for validation
pnpm --filter @korr/web run dev        # next dev on :3000
pnpm --filter @korr/web run lint
pnpm --filter @korr/web run typecheck  # tsc --noEmit
pnpm --filter @korr/web run test       # vitest run
pnpm --filter @korr/web run test:e2e   # playwright
```

Validation chain (per global rules): `lint → typecheck → test → build → browser verify`.

## Project Structure

```text
app/                      # pnpm + turbo workspace root (do all work here)
  apps/web/               # @korr/web — Next.js 15 App Router
  packages/
    db/                   # @korr/db — Drizzle schema, migrations, KMDB import
    scrapers/             # @korr/scrapers — cheerio / fast-xml-parser ingest
    shared/               # @korr/shared
    ui/                   # @korr/ui — design system
  docs/                   # runbooks (deploy-ops, migrations, dsr, log-retention…)
supabase/                 # Supabase project config
specs/                    # speckit feature specs (002-investigation-engine, …)
prototypes/01-tesla/      # Tesla design tokens — source of truth for UI styling
```

## Key Files

- `app/apps/web/app/` — App Router routes/pages
- `app/apps/web/src/inngest/functions/` — background job definitions
- `app/packages/db/` — Drizzle schema + migrations (see `app/docs/migrations.md`)
- `app/turbo.json`, `app/pnpm-workspace.yaml`, `app/vitest.config.ts` — build/test config
- `app/docs/deploy-ops-runbook.md` — deploy/ops procedures

## Constitution

- **No editorial / dossier / newsroom aesthetic.** Re-skin a proven UI pattern using the **Tesla design tokens** in `prototypes/01-tesla`. (See user memory `feedback_no_editorial_aesthetic`.)
- Case Catalog classifies the corpus into deduped **cases** over Investigations; entity-resolution key = **person + institution**. Pilot scope = K-Monitor, 2025+, with amount.
- Defensive-by-default: triple-state every async view (loading / error+retry / empty); filter soft deletes (`deletedAt IS NULL`); validate at boundaries.

## Gotchas

- **`app/` nesting:** the project root looks empty-ish; the actual app and `package.json` are one level down in `app/`. `cd app` first.
- **pnpm only.** A leftover root `package-lock.json` will mislead npm into the wrong tree. Use `pnpm` from `app/`.
- **speckit-managed sections:** don't hand-edit `## Active Technologies` / `## Recent Changes` — they're regenerated.
- LLM cost is capped (`LLM_DAILY_CEILING_HUF`); extraction/hypothesis concurrency and token limits are env-tunable — don't hardcode.

## Environment

Config lives in `app/apps/web/.env.local`; template at `app/.env.example`. Groups:

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET_*`, `DATABASE_URL`, `DIRECT_URL`
- **Anthropic / LLM:** `ANTHROPIC_API_KEY`, `HYPOTHESIS_*`, `INVESTIGATION_EXTRACTOR_*`, `KMDB_LLM_*`, `LLM_DAILY_CEILING_HUF`
- **Inngest:** `INNGEST_DEV`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- **Upstash / rate limit:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SUBMISSION_RATE_*`
- **Auth / security:** `WEBAUTHN_*`, `TURNSTILE_*`, `PII_ENC_KEY`, `BOOTSTRAP_ADMIN_EMAIL`
- **Observability:** `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `BETTER_STACK_TOKEN`, `SLACK_EDITOR_WEBHOOK`
- **Telegram / cron (already required by the running system):** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`
- **Reader subscriptions (012):** `TELEGRAM_PUBLIC_CHANNEL_ID` (unset = public-channel kill switch), `NEXT_PUBLIC_TELEGRAM_CHANNEL_URL` (the reader-facing `t.me` link; unset = the Telegram card is hidden), `RESEND_API_KEY` (unset = email paused), `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`, `RESEND_LOG_RETENTION_DAYS_DECLARED`, `SUBSCRIBER_LINK_SECRET` and `SUBSCRIBER_LINK_SECRET_PREVIOUS` (both `kid:secret`; the second verifies only, and is a different secret from `PII_ENC_KEY`), `DIGEST_DAILY_SEND_CAP`, `SUBSCRIBE_CONFIRM_DAILY_CAP` (a security bound — raising it raises the blast radius of a bot run), `SUBSCRIBE_CONFIRM_RESERVE`, `DIGEST_MIN_ITEMS`, `SUBSCRIBE_IP_DAILY_LIMIT`, `SUBSCRIBE_IP_HOURLY_LIMIT`, `NEXT_PUBLIC_SITE_URL`

## Ask Before You...

- Change DB schema / migrations / seeds (`@korr/db`) — see `app/docs/migrations.md`.
- Switch the AI provider or model, or raise LLM cost ceilings/concurrency.
- Touch auth, WebAuthn, Turnstile, PII encryption, or rate-limit floors.
- Alter the validation pipeline, `turbo.json`, or CI/CD config.
- Run git push / rebase / reset on the user's behalf.

## Active Technologies
- TypeScript 5.6 on Node 20 (repo pin) + Next.js 15 App Router, Drizzle ORM 0.36, Inngest 3.x, (012-reader-subscriptions)
- Supabase Postgres. Five new tables, four new pg enums, one hand-applied raw-SQL (012-reader-subscriptions)

- TypeScript 5.6 on Node 20 (existing repo pin). + Next.js 15 (App Router), Inngest 3.x, Drizzle ORM 0.36, `@anthropic-ai/sdk` (Haiku 4.5), `cheerio` / `fast-xml-parser` (existing in `@korr/scrapers`), `@upstash/ratelimit` (existing, used for the admin-API floor). (002-investigation-engine)
- Make.com (external service) + `@supabase/supabase-js` — `SocialPost` table for the Facebook social feed. (002-make-facebook-social-feed)

## Recent Changes

- 002-make-facebook-social-feed: Added TypeScript / Next.js 15 (App Router), Node 20 + Drizzle ORM, `@supabase/supabase-js`, Make.com (external service); `SocialPost` table extension.
- 002-investigation-engine: Added TypeScript 5.6 on Node 20 (existing repo pin). + Next.js 15 (App Router), Inngest 3.x, Drizzle ORM 0.36, `@anthropic-ai/sdk` (Haiku 4.5), `cheerio` / `fast-xml-parser` (existing in `@korr/scrapers`), `@upstash/ratelimit` (existing, used for the admin-API floor).

<!-- MANUAL ADDITIONS START -->

---

# Team Working Agreement

> Verbatim clone of the maintainer's global `~/.claude/CLAUDE.md`, checked in so every
> coworker's Claude Code follows the same practices. The `## References`, `## Port Registry`,
> and `## UX Validation Sprint` pointers below resolve to `~/.claude/...` on the maintainer's
> machine only — for coworkers those paths won't exist (see note at the end of this file).

# Global Claude Instructions

## Core Practices

### No New Markdown Files
Do not create any new markdown files (including `*_SUMMARY.md`, `*_FIX.md`, docs, READMEs, etc.) unless explicitly requested by the user. Use git commits and existing files.

### Task Checklist First
Before starting any non-trivial work, always create a task checklist using `TaskCreate`. Break the work into discrete steps, then work through them one by one — marking each in-progress before starting and completed when done. This applies to multi-step coding tasks, bug fixes with multiple files, feature implementations, and UX reviews.

### Implement, Don't Explain
Write code directly. Do not teach the user how to code or explain what you plan to do at length. Code and validation are the deliverables, not commentary.

### Concise Responses
Keep all summaries and explanations brief. Prioritize code output and validation results over prose.

### Behavioral Rules
- **Answer questions before acting.** When the user asks a question, answer it and wait for instructions. Don't interpret a question as implicit permission to go fix things.
- **Think before answering.** Don't pattern-match to a familiar heuristic. Stop and reason about the specific situation first.
- **Scope check before implementation.** If your interpretation requires creating new files, adding navigation, or restructuring parent components — STOP. State your interpretation and ask for confirmation. Never expand scope silently.
- **Verify before admitting fault.** When challenged, check the implementation before responding. Don't default to "I'm wrong." False self-criticism wastes time and erodes trust.
- **Don't ask permission to start approved work.** After a plan is approved, start executing immediately. No "should I begin?" or "ready to start?" — just code.
- **Log test results per scenario.** Never summarize as "tests passed." Maintain per-scenario PASS/FAIL/NOT TESTED verdicts with evidence. Call out untested scenarios explicitly.

### Validation Loop
Run the project's validation chain after every meaningful change. The standard sequence is:
```
lint → typecheck → test → build → browser verify
```
Adapt to the project's actual scripts (e.g., `npm run lint && npx tsc --noEmit && npm run test && npm run build`).

**Browser verification is MANDATORY** for any change that affects the running application. Use the `/browser` skill — it routes to the right tool automatically and includes exemption rules, fallback logic, and reporting protocol.

### Honesty Protocol

Applies to all status reporting — UX reviews, task completion, test results, feature verification.

| Status | Meaning |
|--------|---------|
| PASS | Tested and verified with evidence (screenshot, log, API response, command output) |
| PARTIAL | Some works — explain what doesn't |
| FAIL | Tested and broken — show the evidence |
| NOT TESTED | Couldn't test — explain why |
| BLOCKED | Missing prerequisite |

- **Never mark PASS without execution evidence**
- **Distinguish "UI exists" vs "functionality works"**
- Every PASS needs proof: screenshot, log, API response, or command output

### Ask Before You...
- Change DB schema, migrations, or seeds
- Add new dependencies or infrastructure
- Modify core systems (auth, permissions, shared types, state management, design tokens)
- Alter validation pipelines or CI/CD configs
- Run git operations (push, rebase, reset) on behalf of the user

### Representation vs Reality
Codebase artifacts (files, configs, migrations, docs) describe intent — not current state. Never make factual claims about deployed systems, running processes, database state, or production configuration based solely on repo contents. Ground truth requires direct verification: query the live system or check the deployment.

### Defensive Programming
- Guard every optional value with `?.` and `??`
- Guard arrays with `?? []`
- Triple-state every async view: loading, error + retry, empty
- Filter soft deletes on every query (`deletedAt IS NULL`)
- Validate at system boundaries (user input, external APIs), trust internal code

## References (loaded on demand)
- **PLATFORM.yaml** — see `~/.claude/references/platform-yaml.md`
- **Project CLAUDE.md template** — see `~/.claude/references/project-claude-md-requirements.md`
- **Token optimization** — see `~/.claude/references/token-optimization.md`
- **Memory maintenance** — see `~/.claude/references/memory-maintenance.md`

## Port Registry

Cross-project port allocations are in `~/.claude/references/port-registry.md`. Check it before assigning new ports to avoid conflicts.

## UX Validation Sprint

When asked to run a UX validation sprint / UX review / E2E UX test, follow the full process in `~/.claude/references/ux-validation-sprint.md`.

---

> **Note for coworkers:** the four `~/.claude/references/*` pointers, the Port Registry, and the
> UX Validation Sprint reference above live on the maintainer's machine and are **not** in this
> repo. Treat them as optional. If the team wants those to resolve, ask the maintainer to copy the
> referenced files into the repo (e.g. under `docs/ai/`) and update the paths.

<!-- MANUAL ADDITIONS END -->
