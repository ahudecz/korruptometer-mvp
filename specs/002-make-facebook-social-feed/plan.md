# Implementation Plan: Make.com Facebook → SocialPost automatizáció

**Branch**: `002-make-facebook-social-feed` | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/002-make-facebook-social-feed/spec.md`

## Summary

A Make.com Facebook polling scenario 15 percenként lekérdezi a figyelt FB oldalak posztjait és HTTP POST-tal beírja a Supabase `SocialPost` táblába. A weboldal a meglévő social feed szekciót egészíti ki `hidden` szűrővel; az admin felületen egy új "Social posztok" tab ad lehetőséget posztok elrejtésére/visszaállítására. A DB-ben `hidden boolean DEFAULT false` mező + `postUrl UNIQUE` constraint kerül hozzáadásra.

## Technical Context

**Language/Version**: TypeScript / Next.js 15 (App Router), Node 20  
**Primary Dependencies**: Drizzle ORM, @supabase/supabase-js, Make.com (külső service)  
**Storage**: Supabase PostgreSQL — `SocialPost` tábla bővítése  
**Testing**: Vitest (unit), manuális Make.com tesztfutás  
**Target Platform**: Vercel (web), Supabase Cloud (DB), Make.com (automatizáció)  
**Project Type**: web-service + külső no-code integráció  
**Performance Goals**: max 15 perc latencia poszt megjelenéséig  
**Constraints**: Make.com ingyenes csomag ~1000 op/hónap (becslés: ~600 op/hónap belefér)  
**Scale/Scope**: ~5-20 poszt/nap, néhány figyelt FB oldal

## Constitution Check

### Érintett elvek

**Principle II (Phased Shippability)**: Ez a feature Phase 3 (scrapers + aggregator) logikájába illeszkedik — külső forrásból érkező tartalom automatizálása. Nem érinti Phase 1 (read-only) vagy Phase 2 (submissions/admin security) scope-ját. ✅

**Principle III (Single Next.js App)**: Nincs külön service; a Make.com egy külső no-code tool ami közvetlenül Supabase REST API-t hív — nem a Next.js app-ot terheli. A Make.com nem minősül "apps/worker" csomagnak, mert nem a repo-ban fut. ✅

**Principle IV (Data Minimization)**: A `SocialPost` tábla csak nyilvános Facebook posztok metaadatait tárolja (szöveg, URL, kép URL, dátum). Nincs reporter PII, nincs `body` teljes szöveg tárolás aggály (ez nem NewsArticle). A posztok publikusak. ✅

**Principle VII (Two-Step Migrations)**: A `hidden` mező hozzáadása `NOT NULL DEFAULT false` — ez nem destructive migration (ADD COLUMN + backfill egylépéses, biztonságos). A `postUrl UNIQUE` constraint csak akkor problémás ha vannak duplikátumok; a meglévő adaton ellenőrizni kell. ✅ (clean, egy lépés elegendő)

### Gates

- [ ] **Meglévő postUrl duplikátum ellenőrzés** a DB-n — ha van, cleanup script kell migration előtt
- [ ] `imageUrl` mező hozzáadása a Drizzle sémához (már használt a UI-ban, de hiányzott a sémából)

## Project Structure

### Documentation (this feature)

```text
specs/002-make-facebook-social-feed/
├── plan.md              ← ez a fájl
├── research.md          ← Phase 0 kimenet ✅
├── data-model.md        ← Phase 1 kimenet ✅
├── quickstart.md        ← Phase 1 kimenet ✅
├── contracts/
│   └── make-to-supabase.md   ← Phase 1 kimenet ✅
└── tasks.md             ← Phase 2 kimenet (/speckit-tasks parancs)
```

### Source Code

```text
app/
├── packages/db/src/
│   └── schema.ts                          # hidden + imageUrl mező, postUrl unique
├── supabase/migrations/
│   └── 0016_social_post_hidden.sql        # ADD COLUMN hidden, ADD CONSTRAINT unique
└── apps/web/app/
    ├── _home/
    │   ├── social-feed.tsx                # .eq('hidden', false) filter szerver oldalon
    │   └── social-feed-client.tsx         # .eq('hidden', false) filter load more-ban
    └── admin/(authed)/
        ├── admin-tabs.tsx                 # + "Social posztok" tab
        ├── social-posts/
        │   ├── page.tsx                   # poszt lista hidden toggle-lel
        │   └── hidden-toggle.tsx          # kliens komponens (FeaturedToggle minta)
        └── api/admin/social-posts/
            └── [id]/hidden/route.ts       # POST → toggle hidden
```

**Structure Decision**: Single Next.js app, meglévő admin minta (`FeaturedToggle`) újrafelhasználva. Nincs új package, nincs új service.

## Complexity Tracking

Nincs constitution violation — a feature egyszerű bővítés meglévő mintákon belül.
