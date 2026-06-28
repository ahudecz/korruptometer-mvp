# Quickstart: Detection Review Engine

## Mit csinál

A hírekből detektált események csak akkor kerülnek a nyilvános oldalra, ha vagy nagyon biztosak (≥0.90, nem-kiemelt személy), vagy a szerkesztő jóváhagyta őket. Minden más a `/admin/review` soron várakozik.

## Helyi kipróbálás (a megvalósítás után)

1. **Migráció**: `cd app && pnpm --filter @korr/db db:migrate` (a `0030_detection_review_status.sql` lefut; a meglévő sorok `approved`-ok maradnak).
2. **Env**: `app/.env.local`-ban legyen `LLM_API_KEY` (LangDock) — a detektorok így hívnak modellt. Modell: `LLM_MODEL=gpt-5-chat-latest` (alap).
3. **Detektálás futtatása**: a meglévő `detect-now` script (vagy az Inngest dev cron) lefuttatja a detektorokat a friss híreken.
4. **Ellenőrzés**:
   - Nyitóoldal / `/lemondasok` / `/megszunt` / `/birosagi-iteletek`: csak `approved` sorok látszanak.
   - `/admin/review`: a `pending` sorok listája, „Elfogad" / „Eldob" gombokkal.
   - Egy ≥0.90, nem-kiemelt találat azonnal a publikus oldalon; egy 0.70–0.90 közötti, vagy bármilyen watchlist-személyes a review-soron.

## Smoke-teszt forgatókönyv (a P1 MVP igazolása)

1. Adj a rendszernek egy egyértelmű, nem-kiemelt eseményt tartalmazó hírt (pl. „Kirúgták X-et a Y-tól") → jelenjen meg a publikus oldalon (ha ≥0.90), vagy a review-soron (ha 0.70–0.90).
2. Adj egy kiemelt személyt érintő hírt (pl. Sulyok/Polt) → MINDIG a review-soron legyen, sose auto-publikáljon.
3. A review-soron nyomj „Eldob"-ot egy hibás találaton → tűnjön el, és a detektor újrafuttatása se hozza vissza.
4. Nyomj „Elfogad"-ot egy jón → jelenjen meg a publikus oldalon.

## Éles bekapcsolás (deploy)

1. Migráció a production DB-n.
2. Kód deploy (Vercel).
3. **Csak ezután**: `LLM_API_KEY` + `LLM_MODEL` beállítása a Vercel production env-ben → a cron-detektorok elkezdenek `pending`/`approved` sorokat termelni a fenti szabályok szerint. (A kulcs kitétele előtt a detektorok csendben nem csinálnak semmit — így sosem megy ki jóváhagyatlan adat.)
