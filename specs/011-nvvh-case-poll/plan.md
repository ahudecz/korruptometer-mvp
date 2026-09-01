# Implementation Plan: NVVH-szavazás — Az első 5 ügy

**Branch**: `011-nvvh-case-poll` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-nvvh-case-poll/spec.md`

## Summary

Egy kérdéses, multiple-choice (1-5 opció) közösségi szavazás — "Mi legyen a Nemzeti Vagyonvisszaszerzési és Védelmi Hivatal első 5 ügye?" — 30 kurátorolt korrupciós ügy közül. Önálló, megosztható aloldal + főoldali kártya; kártya-alapú opciók lenyíló részletekkel és forráslinkkel; eredmény-nézet kormany.hu-stílusú vízszintes csíkokkal. Anonim részvétel: hosszú lejáratú "már szavaztál" cookie az elsődleges védelem, Upstash IP-rate-limit (nagyvonalú, shared-NAT-barát) és Cloudflare Turnstile a bot-védelem, nyers IP nem tárolódik tartósan. A teljes megvalósítás a meglévő stack-en belül marad — nincs új külső szolgáltatás, a Turnstile- és rate-limit-rétegek a `/bejelentes` űrlapnál már bevált megosztott segédfüggvényeket (`@korr/shared/turnstile`, `@korr/shared/ratelimit`) bővítik ki.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node 20 (meglévő repó-pin)
**Primary Dependencies**: Next.js 15 (App Router), Drizzle ORM 0.36, `@upstash/ratelimit` + `@upstash/redis` (meglévő, `@korr/shared/ratelimit` bővítése), Cloudflare Turnstile (meglévő `@korr/shared/turnstile`), `@korr/shared/format` (`fmtFt`)
**Storage**: Supabase Postgres (Cloud) — 3 új tábla (`PollQuestion`, `PollOption`, `PollVote`); nyers IP nem kerül adatbázisba, csak az Upstash rate-limit kulcsban (TTL-lel lejáró, nem tartós)
**Testing**: Vitest (unit — szavazat-validáció, rate-limit-küszöbök, eredmény-aggregáció), Playwright + axe (a11y a `/szavazas` és a főoldali kártya oldalakon)
**Target Platform**: Web (Vercel), elsődlegesen mobil (375px-től felfelé, érintéses vezérlés)
**Project Type**: Web application — meglévő Next.js monorepo bővítése (nincs új app/szolgáltatás)
**Performance Goals**: Az eredmény-olvasás edge-cache mögött fut (`s-maxage` + `revalidateTag`), a szavazat-beküldés a meglévő `k6`-os burst-teszt mintája szerint terhelhető (100 RPS, Postgres-pool nem telítődik)
**Constraints**: mobil-first, vízszintes görgetés nélkül olvasható 30 opció; nyers IP nem tárolható tartósan (Constitution IV); a web request path nem futtathat szinkron aggregáció-újraszámítást minden olvasásnál (Constitution V mintája)
**Scale/Scope**: 1 aktív szavazás, 30 opció, 2 új publikus route (`/szavazas`, `POST /api/poll/vote`), 1 új főoldali kártya-komponens

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Elv | Értékelés | Indoklás |
|---|---|---|
| I. Trust Posture | N/A | Nincs bejelentő-oldali PII-gyűjtés; a szavazás anonim, nincs `reporterEmailEnc`-szerű mező. |
| II. Phased Shippability | ✅ Pass | Önálló, demózható szelet: szavazás + eredmény + megosztható oldal + bot-védelem egy release-ben, nem entangled más fázissal. |
| III. Single Next.js App / Stack | ✅ Pass | Kizárólag meglévő szolgáltatások: Supabase Postgres, Drizzle, Upstash (csak rate-limit), Turnstile, Vercel. Nincs új külső szolgáltatás, nincs Redis-queue-ként való (mis)use. |
| IV. Data Minimization & GDPR | ✅ Pass (design constraint) | A `PollVote` tábla nem tartalmaz nyers IP-t vagy más azonosító PII-t; az IP-alapú rate-limit kizárólag az Upstash kulcsban él, ami saját TTL-lel jár le — nincs tartós, adatbázisbeli IP-nyom. A "már szavaztál" jelző egy aláírt, anonim böngésző-cookie, nem személyazonosító. |
| V. Eventual Consistency olvasásnál | ✅ Pass (design constraint) | Az eredmény-endpoint cache-elt (`s-maxage` + `revalidateTag('poll-results')`), a tag minden sikeres szavazat után invalidálódik — a request path nem futtat szinkron `COUNT`/`GROUP BY`-t minden olvasásnál. |
| VI. Edge-First Reads, Rate-Limited Writes, Verified-Human Path | ✅ Pass | `GET /api/poll` publikus, cache-elt. `POST /api/poll/vote`: Turnstile-ellenőrzés + IP-alapú napi limit (50-100/nap, nagyvonalú a shared-NAT miatt) + honeypot mező — ugyanaz a réteges védelem, mint a `POST /api/submissions`-nél, csak a küszöbök nagyvonalúbbak, mert itt nincs fájlfeltöltési kockázat. |
| VII. Two-Step Destructive Migrations | N/A (nem releváns most) | A migráció kizárólag additív (3 új tábla, nincs drop/rename/NOT NULL-backfill) — egy lépésben mehet. |
| Locale / `fmtFt` | ✅ Pass | Az opció-kártyák összegei a meglévő `fmtFt`-t használják (`@korr/shared/format`), nem `Intl.NumberFormat({notation:'compact'})`-ot. |
| Accessibility | ✅ Pass (design constraint) | A `/szavazas` oldal bekerül a Playwright + axe accessibility-suite-ba a meglévő oldalak mellé. |

Nincs feloldatlan gate-ütközés, nincs szükség Complexity Tracking indoklásra.

## Project Structure

### Documentation (this feature)

```text
specs/011-nvvh-case-poll/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── poll-api.md
└── tasks.md              # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
app/packages/db/src/
├── schema.ts                       # + pollQuestions, pollOptions, pollVotes (Drizzle tábladefiníciók)
└── seed-nvvh-poll.ts               # egyszeri seed script a 30 kurátorolt opcióhoz (idempotens, onConflictDoNothing)

app/supabase/migrations/
└── 00NN_poll.sql                   # additív migráció: 3 új tábla + indexek

app/packages/shared/src/
├── ratelimit.ts                    # + pollVoteIpLimiter (50-100/nap, meglévő getOrCreate mintával)
└── format.ts                       # (meglévő fmtFt újrahasznosítva, nincs módosítás)

app/apps/web/app/
├── szavazas/
│   ├── page.tsx                    # dedikált, megosztható aloldal — OG-image, szavazó + eredmény nézet
│   ├── opengraph-image.tsx         # egyedi OG-kép a megosztáshoz
│   └── _components/
│       ├── poll-question.tsx       # kérdés + "1-5 választható" instrukció
│       ├── option-card.tsx         # kártya: cím, leírás, összeg-badge, lenyíló részletek+forráslink
│       ├── vote-form.tsx           # kliens-komponens: kiválasztás (max 5) + honeypot + Turnstile widget + "okézás"
│       └── result-bars.tsx         # kormany.hu-stílusú vízszintes csík-lista, szavazatarány szerint
├── _home/
│   └── poll-card.tsx               # főoldali kiemelt kártya, élő részvételi számmal
└── api/
    └── poll/
        ├── route.ts                # GET — eredmény-összesítés, edge-cache-elt
        └── vote/
            └── route.ts            # POST — Turnstile + rate-limit + honeypot + cookie-set

app/apps/web/tests/
├── e2e/
│   └── poll-vote-happy-path.spec.ts
└── unit/
    └── poll-vote-validation.test.ts
```

**Structure Decision**: Meglévő monorepo bővítése, nincs új package/app. A szavazás egy önálló route-csoport (`app/szavazas/`) a meglévő `app/_home/` mintája szerint (kártya-komponens ugyanabban a mappában, mint a többi főoldali kártya), az API pedig a meglévő `app/api/*` konvenciót követi (lásd `app/api/submissions/route.ts` mintáját a rate-limit + Turnstile bekötésre).

## Complexity Tracking

*Nincs kitöltendő tétel — a Constitution Check minden pontja megfelelt indoklás nélkül is.*
