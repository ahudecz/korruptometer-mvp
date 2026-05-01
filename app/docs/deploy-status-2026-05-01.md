# Deploy status — 2026-05-01

Snapshot of what's been provisioned for Korruptométer's first production
deploy and what remains. Source of truth for the next deploy session.

## Live URLs

| Resource | URL |
|----------|-----|
| GitHub repo | https://github.com/ahudecz/korruptometer-mvp (private, default branch `main`) |
| Vercel project | https://vercel.com/attilas-projects-55bd7268/korruptometer |
| Production deploy | https://korruptometer.vercel.app |
| Auto-deploy on | every push to `main` |

`/hamarosan` works ✓ (no DB needed). Every other page returns
`Application error: server-side exception` because no `DATABASE_URL` is set
yet — see "Blocked" below.

## Provisioned (this session)

| # | Step | State |
|---|------|-------|
| Repo | private GitHub repo `ahudecz/korruptometer-mvp` | ✓ |
| Repo | `001-korruptometer-mvp` + `main` branches pushed | ✓ |
| Vercel | project `korruptometer` created via `vercel link` | ✓ |
| Vercel | project linked to GitHub repo, auto-deploy on `main` | ✓ |
| Vercel | `rootDirectory = app/apps/web`, monorepo install/build commands set | ✓ |
| Vercel | 11 env vars × 2 envs = 22 set (locally-generated secrets + defaults) | ✓ |
| Build | force-dynamic added to 8 DB-touching routes so build doesn't need `DATABASE_URL` | ✓ |
| Build | first successful production deploy at sha `36ab6c2` | ✓ |
| Robots | T243 — robots.txt audit for all 5 outlets, all feed paths allowed | ✓ |
| Secrets | `PII_ENC_KEY`, `INTERNAL_REVALIDATE_SECRET`, `CI_DBSTAT_TOKEN`, db-password generated locally at `/tmp/korr-prod-secrets.txt` | ✓ |

## Vercel env vars set

```
PII_ENC_KEY                          (32B base64, generated locally)
INTERNAL_REVALIDATE_SECRET           (32B hex, generated locally)
CI_DBSTAT_TOKEN                      (32B hex, generated locally)
SUPABASE_STORAGE_BUCKET_SUBMISSIONS  submissions
SUPABASE_STORAGE_BUCKET_PUBLIC       public-assets
BOOTSTRAP_ADMIN_EMAIL                ahudecz@gmail.com
SUBMISSIONS_SEALED_BOX_ENABLED       false
LINK_AUTO_THRESHOLD                  0.55
LINK_REVIEW_THRESHOLD                0.40
LINK_AGGREGATOR_CONCURRENCY          4
SEALED_BOX_ROW_BUDGET_BYTES          1048576
```

All set for both `production` and `preview` environments.

## Blocked

| # | Vendor | Why blocked | Resolution |
|---|--------|-------------|------------|
| 1 | **Supabase** | `ahudecz's Org` is at the 2-active-free-projects cap (5 existing projects) | Pause one of `culture-compass` / `diageo-insight-spark` / `FINANCE-PLANNER` / `po-toolkit` / `inbox-to-action` in the dashboard, OR upgrade the org to Pro. Then re-run `npx supabase projects create korruptometer --org-id ejagogcdbrymkppgszqc --region eu-west-1 --db-password "$(grep DB_PASS /tmp/korr-prod-secrets.txt \| cut -d= -f2-)"` |
| 2 | **Inngest** | Free tier has only one production env, owned by konvenient. Reusing keys would route Korruptométer events into konvenient's dashboard | Decision needed: (a) reuse konvenient's prod env (mixed observability) or (b) wait for a new env when budget allows |
| 3 | **Sentry** | Open org is `konvenient` — its DSN routes to konvenient's project | Decision needed: same trade-off as Inngest |
| 4 | **Cloudflare Turnstile** | Site widget needs a "site name" + domain whitelist click | One dashboard click — ready to do this whenever you're at the keyboard |
| 5 | **Cloudmersive** | No account | Sign up free tier, paste API key |
| 6 | **Slack incoming webhook** | No webhook URL provisioned in the editor channel | One dashboard click in the Slack workspace |
| 7 | **Upstash Redis** | No account | Sign up, create REST DB |
| 8 | **Better Stack** | No account | Sign up, create 6 monitors per `app/docs/observability.md` |

## Resume sequence (after Supabase block resolved)

```sh
# 1. Create Supabase project
export SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' /home/attilah/Coding/inbox_to_action/.env.local | cut -d= -f2-)
export DB_PASS=$(grep '^DB_PASS=' /tmp/korr-prod-secrets.txt | cut -d= -f2-)
npx supabase projects create korruptometer --org-id ejagogcdbrymkppgszqc --region eu-west-1 --db-password "$DB_PASS"

# 2. Capture the new project ref → REF
# 3. Link locally
npx supabase link --project-ref REF
npx supabase db push   # applies app/supabase/migrations/0001..0010

# 4. Pull the env vars to Vercel
NEXT_PUBLIC_SUPABASE_URL=https://REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from dashboard, Project Settings → API>
SUPABASE_SERVICE_ROLE_KEY=<same>
DATABASE_URL=postgresql://postgres.REF:$DB_PASS@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres.REF:$DB_PASS@aws-0-eu-west-1.pooler.supabase.com:5432/postgres

# 5. Push env vars (loop pattern from this session)

# 6. Seed
DATABASE_URL=$DIRECT_URL pnpm --filter @korr/db db:seed

# 7. Trigger Vercel redeploy (auto-fires on next push)
git commit --allow-empty -m "chore: trigger redeploy after Supabase wiring" && git push
```

## What's still in-scope for a working MVP after Supabase

The deploy URL will go from "Application error" to working public site once
DATABASE_URL is set. To unblock:

* **Submissions (US 5–9):** Cloudflare Turnstile + Cloudmersive + Slack webhook + Upstash + Inngest decision.
* **Scrapers (US 10–14):** Inngest decision + Sentry decision + Better Stack.
* **Sealed-box (US 15–19):** Optional — flag stays off until ready.

For the **read-only public MVP**, only Supabase is required. Everything
else is Phase-2+ and can land later.
