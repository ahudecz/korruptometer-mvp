# Quickstart: NVVH-szavazás

## Helyi felfuttatás

```bash
# a repó meglévő bootstrap-mintája (lásd constitution.md)
cd app
pnpm dlx supabase start          # lokál Postgres + Auth + Storage
pnpm install
pnpm --filter @korr/db migrate   # felviszi a 00NN_poll.sql migrációt
pnpm --filter @korr/db exec tsx src/seed-nvvh-poll.ts   # 30 opció betöltése (idempotens)
pnpm dev
```

Nyisd meg: `http://localhost:3000/szavazas`

## Turnstile helyi teszthez

`.env.local`-ban a Cloudflare "mindig sikeres" teszt-secret (`1x0000000000000000000000000000000AA`) — ugyanaz a minta, mint a `/bejelentes` űrlapnál, lásd `@korr/shared/turnstile`. Így lokálban Turnstile-widget nélkül is végig lehet menni a szavazás-folyamaton.

## Kézi végigfutási teszt (a spec User Story 1-4 lefedésére)

1. **Szavazat leadása (US1)**: nyisd meg inkognitó ablakban, válassz ki 3 opciót, erősítsd meg → sikeres visszajelzés.
2. **5 fölötti kiválasztás (US1 edge case)**: próbálj 6. opciót is kiválasztani → a UI nem engedi, jelzi a limitet.
3. **Eredmények (US2)**: az "Eredmények" nézetben a csíkok csökkenő szavazatarány szerint jelennek meg, a saját választásod kiemelve.
4. **Ismételt szavazás (US4)**: frissítsd az oldalt ugyanabban az inkognitó-ablakban → az eredmény-nézet jön a szavazóform helyett.
5. **Megosztás (US3)**: a `/szavazas` URL-t egy OG-preview-tesztelőben (pl. a közösségi platform saját "link preview" nézete) ellenőrizve egyedi cím + kép jelenik meg.
6. **"Nincs konkrét összeg" (US1 edge case)**: keress meg egy "Terület"-tagelt opciót (pl. Nemzeti Földügyek) → az összeg helyén szó szerint "Nincs konkrét összeg" áll.

## Terhelés/abúzus-teszt (kapcsolódik: SC-004, SC-006)

A meglévő `k6`-os minta (`scripts/cases-burst.js`) analógiájára egy `scripts/poll-vote-burst.js` script — 10 000 gyors, egymást követő `POST /api/poll/vote` hívás azonos IP-ről, Turnstile-token nélkül: az elvárt eredmény, hogy a kérések elakadnak a Turnstile-lépésen, 0 szavazat kerül be az adatbázisba. Ez a script a `/speckit.tasks` fázisban kerül létrehozásra.
