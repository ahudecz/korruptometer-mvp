# Implementation Plan: Telegram jóváhagyó bot a detekciós review-hoz

**Branch**: `008-telegram-review-bot` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-telegram-review-bot/spec.md`

## Summary

A `006-detection-pipeline-reliability`-ben elkészült `notifyReviewNeeded()`
eddig log-only stub volt (nincs bekötött csatorna). Ma bekötöttük egy
Telegram bothoz (`@kegyencjarat_bot`) sima szöveges üzenetküldésre. Ez a
terv interaktívvá teszi: minden üzenet kap egy cikk-linket + Jóváhagyom/
Elutasítom gombot; egy új webhook végpont (`/api/telegram/webhook`)
fogadja a gombnyomásokat, és ténylegesen végrehajtja a döntést az
adatbázisban — a `pending` esetnél a már beszúrt sor `reviewStatus`-át
állítja (a meglévő admin-review logikát újrahasználva), a `near_miss`
esetnél újra lefuttatja az adott detektor kinyerő-logikáját és beszúrja.
Jóváhagyás után a rendszer a másik 3 detektor-kategóriát is megvizsgálja
ugyanazon a cikken (a saját, meglévő kinyerő-függvényeikkel és
küszöbeikkel), és automatikusan felveszi, ha a normál auto-publikálási
küszöböt átlépi.

Nincs séma-változás — a meglévő `DetectionCheck`, a 3 `reviewStatus`-os
tábla és `NewsArticle` minden szükséges adatot tartalmaz.

## Technical Context

**Language/Version**: TypeScript 5.6 / Node 20 (repo pin)
**Primary Dependencies**: Next.js 15 (App Router), Drizzle ORM 0.36,
Inngest 3.x (a 4 meglévő detektor-függvény újrahasználva), Telegram Bot API
(natív `fetch`, nincs SDK-függőség)
**Storage**: Supabase Postgres — nincs migráció, tisztán a meglévő táblákra
épül (`DetectionCheck`, `PoliticalResignation`, `MediaClosure`,
`CourtVerdict`, `AssetRecovery`, `NewsArticle`)
**Testing**: vitest (meglévő keret) — a webhook route unit-tesztelhető a
callback-parse és a secret-header-ellenőrzés szintjén; a tényleges DB-írás
integrációs teszt a meglévő detektor-tesztek mintáját követi
**Target Platform**: Vercel (a webhook egy sima App Router route handler,
nem Inngest-függvény — a Telegram gombnyomás szinkron, gyors válasz kell,
nincs szükség Inngest durable-step-re)
**Project Type**: Web application — egyetlen Next.js app monorepóban
**Performance Goals**: néhány gombnyomás/nap, nincs teljesítmény-cél; a
webhook válaszidejének a Telegram ~ 60 mp-es válasz-timeout-ján belül
KELL maradnia (bőven elég egy szinkron DB-írás + 1-3 LLM-hívás)
**Constraints**: nincs új szolgáltatás (Constitution III); a webhook
titkosított header nélkül semmilyen DB-hatást nem végezhet (FR-009); a
kereszt-kategória vizsgálat a meglévő küszöb-logikát bit-for-bit
változatlanul KELL hívja (FR-011)
**Scale/Scope**: 1 új route, 1 új lib-modul, 4 érintett detektor-fájl
(csak a `notifyReviewNeeded` hívás bővítése), 1 bővített típus

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Trust Posture Above Convenience** — N/A közvetlenül (nincs
  whistleblower-facing szöveg ebben a körben); a jóváhagyott találatok
  továbbra is a meglévő "Sajtójelentések alapján... ártatlanság vélelme"
  keretben jelennek meg a publikus oldalakon, ezt a terv nem érinti.
- **II. Phased Shippability** — ✅ Önálló, a Phase 3 (scraper/detektor)
  rétegre épülő szelet, más fázissal nem keveredik.
- **III. Single Next.js App on the Inbox-to-Action Stack** — ✅ A webhook
  egy sima `apps/web/app/api/telegram/webhook/route.ts` route handler a
  MEGLÉVŐ appban — nincs új szolgáltatás, nincs külön deploy-cél. A
  Telegram Bot API natív `fetch`-csel hívva, nincs új SDK-függőség.
- **IV. Data Minimization & GDPR** — ✅ Nincs új PII-tárolás; a Telegram
  chat_id/bot token platform secret (Vercel env), nem kerül adatbázisba. A
  detektorok továbbra is csak `headline`+`excerpt`-et használnak, a
  `NewsArticle.body`-tilalom (Principle IV) érintetlen.
- **V. Eventual-Consistency on KPIs** — N/A, ez a funkció nem érinti a
  `KpiSnapshot`-ot.
- **VI. Edge-First Reads, Rate-Limited Writes, Verified-Human Path** — ✅
  A webhook nem publikus olvasó végpont; írásvédelme a Telegram
  `secret_token` header-ellenőrzés (FR-009), ami a "verified-human path"
  elvének felel meg más eszközzel (a "human" itt a szerkesztő Telegram-
  fiókja, nem egy Turnstile-ellenőrzött látogató). Nincs Upstash
  rate-limit hozzáadva ehhez a végponthoz — indoklás: a hívó fél kizárólag
  a Telegram szervere lehet (secret_token garantálja), nem nyilvánosan
  elérhető write-path.
- **VII. Two-Step Destructive Migrations & Editor-Decision Preservation**
  — ✅ Nincs migráció (additív, kód-only változás). Az "Editor-decision
  preservation" elve itt analóg módon érvényesül: egy Telegram-jóváhagyás
  ugyanúgy explicit szerkesztői döntés, mint egy admin-felületi kattintás
  — a meglévő `setStatus()`-mintát hívja, nem kerüli meg.

**Eredmény: minden kapu PASS, indoklandó sértés nincs → Complexity Tracking üres.**

## Phase 0 — Research (döntések)

- **Webhook, nem polling.** Vercel szerverless — nincs hosszan élő
  process, ami `getUpdates`-et pollozna. A Telegram `setWebhook` +
  `secret_token` a helyes, dokumentált minta szerverless környezetben.
- **Nincs új SDK.** A Telegram Bot API HTTP-alapú, natív `fetch`-csel
  triviálisan hívható (`notify.ts` már ezt csinálja szöveges üzenetre) —
  egy npm-csomag (pl. `node-telegram-bot-api`) polling-központú és
  feleslegesen nagy súlyt adna egy pár endpoint-híváshoz.
- **A kereszt-kategória vizsgálat a MEGLÉVŐ 4 kinyerő-függvényt hívja
  újra, nem új promptot.** Konzisztencia a rendes cron-nal, nincs új
  promptmérnökségi kockázat, nincs extra karbantartási felület.
- **Nincs új tábla a "pending Telegram-akció" tárolására.** A callback_data
  (Telegram 64 byte-os limitje) elfér egy `{action}:{detectorKód}:{uuid}`
  stringben — az `articleId`/`recordId` közvetlen átadása a `notify.ts`
  eseményén keresztül elegendő, nincs szükség köztes lookup-táblára.
- **`markChecked()` nem újrahasználható a force-insert utáni audit-
  frissítésre** (`ON CONFLICT DO NOTHING` csendben no-op-olna a már
  létező `discarded` sor felett) — a webhook egy dedikált, explicit
  `UPDATE "DetectionCheck" SET outcome='inserted', reason=NULL WHERE
  articleId=... AND detectorType=...` hívást használ helyette.

## Phase 1 — Interfész-változások (séma-változás nélkül)

### `ReviewNeededEvent` bővítés (`apps/web/src/lib/notify.ts`)

| Mező | Típus | Megjegyzés |
|---|---|---|
| `articleId` | `string` | ÚJ, mindig kitöltött — `NewsArticle.id` |
| `recordId` | `string \| undefined` | ÚJ, csak `pending`-nél — a már beszúrt sor id-je |

### Callback-data formátum

`{action}:{detectorKód}:{id}` — `action`: `a` (approve) / `r` (reject);
`detectorKód`: `r`=resignation, `m`=media_closure, `c`=court_verdict,
`x`=asset_recovery; `id`: `recordId` (pending) vagy `articleId`
(near_miss). Max hossz jóval a Telegram 64 byte-os limitje alatt.

### Webhook válasz-kontraktus

Minden Telegram `callback_query`-re KÖTELEZŐ `answerCallbackQuery`
(különben a kliens gomb "pörög" a felhasználónál); sikeres feldolgozás
után `editMessageReplyMarkup` az eredeti üzenet gombjainak eltávolítására.

## Verifikáció

1. `npx tsc --noEmit -p apps/web/tsconfig.json` tisztán fusson le.
2. Hiányzó/hibás `X-Telegram-Bot-Api-Secret-Token` header → 401, nincs
   DB-hatás (SC-003).
3. Manuális teszt: valódi Telegram-üzenet mindkét gombja ténylegesen
   módosítja az adatbázist, a gombok eltűnnek utána.
4. Kereszt-kategória teszt egy tudatosan két témát érintő cikkel (SC-002).
5. `/lemondasok`, `/megszunt`, `/birosagi-iteletek` azonnal mutatja a
   jóváhagyott elemet (meglévő `revalidatePath`).
