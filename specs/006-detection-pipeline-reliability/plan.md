# Implementation Plan: Detekciós pipeline megbízhatóság és felügyelet

**Branch**: `006-detection-pipeline-reliability` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-detection-pipeline-reliability/spec.md`

## Summary

A 003-detection-review-engine négy LLM-detektora (lemondás, médiamegszűnés, bírósági ítélet/előzetes, vagyonvisszaszerzés) ma egy rögzített 2 órás görgő időablakban vizsgálja a cikkeket. Egy átmeneti hiba (LLM API-kiesés, kredit/keret kifogyás) a jelöltet némán és véglegesen elveszíti, amint kicsúszik az ablakból — nincs nyom, nincs újrapróbálkozás. Ez a terv egy közös **`DetectionCheck`** naplótáblát vezet be: minden (cikk, detektor-típus) párhoz pontosan egy sor íródik, de **csak valódi (nem-átmeneti) döntés után** — siker esetén `outcome='inserted'`, jogos eldobás esetén `outcome='discarded'` + konkrét `reason`. Egy LLM-hiba NEM ír sort, így a cikk a következő futáson automatikusan újra jelöltté válik. A 4 detektor lekérdezése a rögzített időablak helyett "még nincs `DetectionCheck` sor erre a (cikk, típus) párra, és a cikk a 7 napos backlog-ablakon belül van" szűrésre vált. Ugyanez a tábla szolgálja az indoklás-auditot (FR-005) és a havi admin-összefoglaló (FR-006) alapját. Egy külön, csatorna-független `notifyReviewNeeded()` hívási pont jelzi az új pending/majdnem-bekerült eseteket — ma no-op/log-only, később (Telegram) bekötve a detektor-logika módosítása nélkül.

A meglévő 003-as küszöb-logika (`decideStatus`, 0.90/0.70, kiemelt személyek, `isDuplicate`) **egyáltalán nem változik** — ez a terv kizárólag a "mit vizsgálunk" és "mi látható belőle" réteget érinti.

## Technical Context

**Language/Version**: TypeScript 5.6 / Node 20 (repo pin)
**Primary Dependencies**: Next.js 15 (App Router), Drizzle ORM 0.36, Inngest 3.x, a meglévő kapcsolható LLM-réteg (`@korr/db/llm`)
**Storage**: Supabase Postgres — ÚJ tábla: `DetectionCheck` (tisztán additív, nincs meglévő oszlop-módosítás). Migráció: raw-SQL `app/supabase/migrations/` alatt (köv. szám: `0032`)
**Testing**: vitest (meglévő `@korr/db` és web tesztkeret)
**Target Platform**: Vercel (web + Inngest endpoint), Inngest Cloud cron
**Project Type**: Web application — egyetlen Next.js app monorepóban (`app/apps/web` + `app/packages/*`)
**Performance Goals**: a detektálás aszinkron (Inngest cron, óránként); a havi admin-digest alacsony forgalmú, néhány megtekintés/hónap. Nincs szigorú latencia-cél.
**Constraints**: a `DetectionCheck` írás csak valódi (nem-átmeneti) döntés után történhet (FR-002); a backlog-lekérdezés max. 7 napra korlátozott (FR-003/FR-010, nem a teljes archívum); a meglévő 003-as döntési küszöbök bit-for-bit változatlanok maradnak (FR-009); a `notifyReviewNeeded` hiánya/hibája NEM állíthatja meg egy detektor-futást (FR-008)
**Scale/Scope**: 1 új tábla, 4 érintett detektor-függvény, 1 új admin-oldal (havi digest), 1 új lib-modul (notify), napi néhány tucat detektálási jelölt

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Trust Posture Above Convenience (NON-NEGOTIABLE)** — ✅ Ez a terv a bizalmi kaput NEM lazítja (a döntési küszöbök változatlanok, FR-009); kifejezetten a kapu **megbízhatóságát** erősíti — egy átmeneti infrastruktúra-hiba ne okozzon néma, végleges adatvesztést egy egyébként helyes találatnál.
- **II. Phased Shippability** — ✅ A Phase 3 (scraper/detektor) szelet megbízhatósági rétege, önállóan deployolható; nem keveredik más fázissal.
- **III. Single Next.js App on the Inbox-to-Action Stack** — ✅ Új Drizzle tábla + raw-SQL migráció a meglévő mintában, ugyanaz az Inngest-endpoint. **Nincs új szolgáltatás** — a notifikációs csatorna (Telegram) explicit NEM kerül bekötésre ebben a körben, csak egy interfész-pont készül (lásd Assumptions); a spec.md korábban mérlegelt Resend-opciót a user elvetette, és az egyébként is ütközne a III. elv tiltólistájával ("Stack substitutions ... Resend ... MUST NOT be reintroduced").
- **IV. Data Minimization & GDPR** — ✅ Nincs új PII; a `DetectionCheck.extractedName` ugyanaz a közszereplő-név, ami ma is a PoliticalResignation/MediaClosure/CourtVerdict táblákban tárolódik. Nincs `NewsArticle.body` (a detektorok továbbra is csak `headline`+`excerpt`-et kapják).
- **V. Eventual-Consistency on KPIs** — N/A közvetlenül (ez a funkció nem érinti a `KpiSnapshot`-ot); a havi digest saját, alacsony-forgalmú admin-olvasás, nem a nyilvános request-úton.
- **VI. Edge-First Reads, Rate-Limited Writes, Verified-Human Path** — ✅ A havi digest a meglévő `(authed)` admin alatt él, nem nyilvános végpont, nincs új rate-limit igény.
- **VII. Two-Step Destructive Migrations & Editor-Decision Preservation** — ✅ A `0032` migráció **tisztán additív** (új tábla, új idegen kulcs, nincs meglévő oszlop törlése/átnevezése/NOT NULL-ozása) — a kétlépcsős szabály itt nem alkalmazandó, mert nincs destruktív elem. A szerkesztői döntés megőrzése (approved/rejected) a 003-as réteg felelőssége marad, ezt a terv nem érinti.

**Eredmény: minden kapu PASS, indoklandó sértés nincs → Complexity Tracking üres.**

## Phase 0 — Research (döntések, külön research.md nélkül)

- **Egy közös tábla négy detektorhoz, nem 4 külön oszlop a NewsArticle-ön.** Egy `DetectionCheck(articleId, detectorType)` join-tábla elkerüli, hogy minden jövőbeli detektor egy újabb `NewsArticle` migrációt igényeljen, és egyben az audit-naplót (FR-005) is szolgálja — nincs szükség két külön táblára.
- **A backlog-ablak 7 nap, nem korlátlan.** Elég hosszú, hogy egy több napos API-kiesést (mint a LangDock/Anthropic incidens) túléljen, elég rövid, hogy élesítéskor ne induljon el a teljes történeti archívum újrafeldolgozása (FR-010).
- **A "majdnem bekerült" sáv (0.50–0.6999) kód-konstans, nem új env var.** A review.ts kemény 0.70-es küszöbét (003) nem módosítja; a sáv finomhangolásához elég egy konstans-módosítás, nem igényel deploy-on túli konfigurációt egyelőre.
- **A notifikációs csatorna (Telegram) tudatosan halasztott.** A `notifyReviewNeeded()` interfész-kontraktus most készül el, a tényleges adapter (bot token, csoport ID) egy KÉSŐBBI, önálló változtatásban kerül be — ez a terv nem blokkolódik rajta (US4, P4, lásd spec.md).
- **Resend/email elvetve.** A user explicit elvetette, és egyébként is ütközne a III. alkotmányos elvvel (Resend a tiltott stack-helyettesítők listáján).

## Phase 1 — Data Model (séma-változás, külön data-model.md nélkül)

### `DetectionCheck` (ÚJ tábla)

| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `id` | uuid PK | `defaultRandom()` |
| `articleId` | uuid, FK → `NewsArticle.id` (`onDelete: cascade`) | |
| `detectorType` | text | `'resignation' \| 'media_closure' \| 'court_verdict' \| 'asset_recovery'` |
| `outcome` | text | `'inserted' \| 'discarded'` |
| `reason` | text, nullable | `'low_confidence' \| 'not_applicable' \| 'duplicate' \| 'missing_fields' \| 'llm_error'` — csak `discarded`-nál releváns; **fontos**: `llm_error` esetén ez a sor SOSEM íródik (lásd lent), a mező csak a másik három ok-kód tárolására szolgál |
| `extractedName` | text, nullable | a modell által kinyert név, ha volt |
| `confidence` | real, nullable | a modell megbízhatósági pontszáma, ha volt |
| `checkedAt` | timestamp with tz, NOT NULL, default now() | |

Egyedi kényszer: `UNIQUE (articleId, detectorType)` — ez a "már ellenőrizve" jelző maga; `ON CONFLICT DO NOTHING` az írásnál (idempotens, versenyhelyzet-biztos).

**Kritikus szabály (FR-002)**: egy LLM-hívás hibája esetén a `markChecked()` hívás **KIMARAD** — a cikk emiatt "nem ellenőrzöttnek" számít, és a következő futás újra jelöltnek látja. A `reason='llm_error'` érték a típusban szerepel dokumentációs céllal (ha valaha mégis loggolni akarnánk egy hiba-eseményt magát, külön, nem a `DetectionCheck`-be), de a fő szabály: **hiba → nincs `DetectionCheck` sor**.

### Lekérdezés-csere minden detektorban

Régi: `WHERE publishedAt >= now() - interval '2 hours'`
Új: `WHERE publishedAt >= now() - interval '7 days' AND NOT EXISTS (SELECT 1 FROM "DetectionCheck" dc WHERE dc."articleId" = "NewsArticle".id AND dc."detectorType" = '<típus>')`

## Project Structure

### Documentation (this feature)

```text
specs/006-detection-pipeline-reliability/
├── spec.md
├── plan.md    # Ez a fájl (Phase 0 research + Phase 1 data-model beágyazva)
└── tasks.md   # Következő lépés
```

### Source Code (repository root)

```text
app/
├── packages/db/src/
│   ├── schema.ts                       # + detectionChecks tábla (uniq index articleId+detectorType)
│   ├── detection-check.ts              # ÚJ: DetectorType, BACKLOG_DAYS, markChecked(), loadUncheckedArticles()
│   └── detection-check.test.ts         # ÚJ: unit tesztek
├── supabase/migrations/
│   └── 0032_detection_check_log.sql    # ÚJ: tisztán additív (CREATE TABLE + index + FK)
└── apps/web/
    ├── src/
    │   ├── lib/notify.ts               # ÚJ: notifyReviewNeeded() — no-op/log stub ma
    │   └── inngest/functions/
    │       ├── detect-resignations.ts       # időablak → loadUncheckedArticles + markChecked
    │       ├── detect-media-closures.ts     # ua.
    │       ├── detect-verdicts.ts           # ua.
    │       └── detect-asset-recoveries.ts   # ua.
    └── app/admin/(authed)/
        ├── admin-tabs.tsx               # + "Havi összefoglaló" fül
        └── detection-digest/
            └── page.tsx                 # ÚJ: hónap-választó, approved/pending/majdnem-eldobott listák
```

**Structure Decision**: Web application (meglévő monorepo). A nyomkövetési/audit logika a `@korr/db` csomagba kerül (a 4 detektor mind onnan importál, konzisztensen a 003-as `review.ts` mintával), a migráció a meglévő raw-SQL mintába, a havi digest a meglévő `admin/(authed)` mintába.

## Complexity Tracking

> Nincs alkotmánysértés — a táblázat üres.
