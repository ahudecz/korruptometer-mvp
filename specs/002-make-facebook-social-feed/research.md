# Research: Make.com Facebook → SocialPost automatizáció

**Phase**: 0 — Research  
**Feature**: specs/002-make-facebook-social-feed/spec.md  
**Date**: 2026-06-24

---

## Make.com Facebook modul képességei

**Decision**: Make.com "Watch Posts" trigger a Facebook Pages modulból — ez az ajánlott megoldás.

**Findings**:
- A Make.com Facebook modulja 15 perces polling intervallumon tud figyelni nyilvános oldalakat
- A `Watch Posts` trigger az oldal ID-ja alapján figyeli az oldalt; a kimenet tartalmazza: `message` (szöveg), `created_time`, `permalink_url`, `full_picture` (kép URL), `attachments` (videó esetén thumbnail URL is elérhető)
- Videó esetén `attachments.data[0].media.source` a lejátszási URL, `attachments.data[0].media.image.src` a thumbnail — ezt kell `imageUrl`-ként tárolni
- Több oldal figyeléséhez több route (párhuzamos útvonal) kell ugyanabban a scenarioba, vagy külön scenariok oldalanként
- A Make.com ingyenes csomagja 1 000 operation/hónap — 10 poszt/nap × 30 nap × 2 modul = ~600 op/hónap, tehát belefér
- Duplikátum-védelem: Make.com `Created Time`-ot tárol az utolsó feldolgozáshoz, de Supabase oldalon is szükséges `postUrl` unique constraint

**Rationale**: Polling választása (webhook helyett) → Facebook nem kínál valós idejű webhook-ot publikus oldalakhoz ingyenesen. Make.com polling az egyetlen életképes olcsó megoldás.

**Alternatives considered**:
- Webhooks: csak Messenger/Page subscribe API-val, app review szükséges → túl bonyolult
- Zapier: drágább, ugyanolyan polling alapú
- Saját scraper (Playwright): hosting kell, maintenance terhes → nem kell

---

## Supabase REST API Make.com-ból

**Decision**: Make.com HTTP modul → Supabase REST API (`POST /rest/v1/SocialPost`).

**Findings**:
- Supabase REST API-t a Make.com "HTTP" modulon keresztül lehet hívni
- Headers: `apikey: SUPABASE_ANON_KEY`, `Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY`, `Content-Type: application/json`, `Prefer: return=minimal`
- Duplikátum: `Prefer: resolution=ignore-duplicates` + `postUrl` UNIQUE constraint → idempotens insert
- Service role key szükséges (anon key nem tud insertálni ha RLS van), de Make.com-ban secret-ként tárolható

**Rationale**: Nincs szükség külön API endpoint-ra — a Supabase REST API közvetlenül hívható Make.com-ból, ez a legegyszerűbb integráció.

**Alternatives considered**:
- Egyedi Next.js API endpoint (`POST /api/social-posts`): extra fejlesztés és autentikáció kell → felesleges overhead
- Supabase Realtime: csak olvasáshoz, írásra nem alkalmas

---

## `hidden` mező migráció

**Decision**: Drizzle schema módosítás + SQL migráció fájl hozzáadása.

**Findings**:
- A `SocialPost` tábla jelenleg nincs `hidden` mezővel (schema.ts:704-719)
- Drizzle ORM-ben: `hidden: boolean('hidden').notNull().default(false)` → minden meglévő sor `false`-t kap
- SQL migráció: `ALTER TABLE "SocialPost" ADD COLUMN "hidden" boolean NOT NULL DEFAULT false;`
- A `social-feed.tsx` és `social-feed-client.tsx` lekérdezésekbe `.eq('hidden', false)` filter kell
- Drizzle-ben: `.where(eq(schema.socialPosts.hidden, false))`

**Rationale**: Boolean + DEFAULT false → visszafelé kompatibilis, meglévő posztok mind láthatók maradnak.

---

## Figyelt FB oldalak konfigurációja

**Decision**: Make.com scenarion belül konfigurált, nem DB tábla.

**Findings**:
- SC-004 szerint új oldal hozzáadása ≤ 5 perc legyen, fejlesztő nélkül
- A Make.com "Watch Posts" triggerbe az oldal nevét és ID-ját lehet beírni; route hozzáadása a scenarion belül 2-3 perc
- DB tábla kellett volna ha a Make.com oldalanként lekérdezné; de Make.com-ban route cloning egyszerűbb
- Egyszerűbb: minden FB oldalhoz egy route a Make.com scenarioba

**Rationale**: YAGNI — DB tábla csak akkor kell ha admin UI-on szeretnénk kezelni az oldallistát. A spec SC-004-et (5 perces hozzáadás) Make.com-ban is teljesíti.

---

## Admin UI minta

**Decision**: Az existing `FeaturedToggle` + `/api/admin/news/[id]/featured` mintájára: `HiddenToggle` + `/api/admin/social-posts/[id]/hidden`.

**Findings**:
- A `FeaturedToggle` kliens komponens `POST` kéréssel vált, majd `router.refresh()`-sel frissít — pontosan ez a minta kell
- Admin tab: `{ href: '/admin/social-posts', label: 'Social posztok' }` hozzáadása az `admin-tabs.tsx`-hez
- Új admin oldal: `/admin/(authed)/social-posts/page.tsx` — listázza a posztokat createdAt desc sorrendben, minden sornál toggle gomb
