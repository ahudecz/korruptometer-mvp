# Quickstart: Make.com Facebook → SocialPost automatizáció

**Cél**: Figyelt Facebook oldalak posztjai automatikusan bekerülnek a Korruptométer social feed szekciójába.

---

## 1. DB migráció futtatása

```bash
# A projektgyökérből
cd app
npx tsx packages/db/src/run-migration.ts
# VAGY közvetlen SQL Supabase Studio-ban:
ALTER TABLE "SocialPost" ADD COLUMN "hidden" boolean NOT NULL DEFAULT false;
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_postUrl_unique" UNIQUE ("postUrl");
```

> Ellenőrzés: Supabase Studio → Table Editor → SocialPost → `hidden` oszlop megjelenik, alapértéke `false`.

---

## 2. Make.com scenario felállítása

### Szükséges Make.com modul-sorrend

```
[Facebook] Watch Posts → [HTTP] Make a Request (Supabase REST API)
```

### Lépésről lépésre

1. Make.com → **Scenarios** → **Create a new scenario**
2. **Trigger modul**: Keresés: `Facebook Pages` → `Watch Posts`
   - Page ID: a figyelt FB oldal numerikus ID-ja
   - Limit: 10 (max posztok per futás)
3. **+** gomb → `HTTP` → `Make a Request`
   - URL: `https://<SUPABASE_REF>.supabase.co/rest/v1/SocialPost`
   - Method: `POST`
   - Headers:
     - `apikey`: `<SUPABASE_ANON_KEY>`
     - `Authorization`: `Bearer <SUPABASE_SERVICE_ROLE_KEY>`
     - `Content-Type`: `application/json`
     - `Prefer`: `resolution=ignore-duplicates,return=minimal`
   - Body type: `Raw` / `JSON`
   - Body:
     ```json
     {
       "authorName": "Vastagbőr",
       "platform": "facebook",
       "postUrl": "{{1.permalink_url}}",
       "content": "{{ifempty(1.message; \"[kép/link]\")}}",
       "imageUrl": "{{1.full_picture}}",
       "postedAt": "{{1.created_time}}"
     }
     ```
4. Scheduling: **Every 15 minutes**
5. **Save** → **Run once** (tesztfutás)

### Több FB oldal hozzáadása

A scenario-ban a `Watch Posts` trigger jobb klikk → **Clone route** → átírni az új oldal Page ID-ját és `authorName`-et. Elég 5 perc.

---

## 3. Kód módosítások deployálása

A következő fájlok változnak (részletek a tasks.md-ben):

| Fájl | Módosítás |
|------|-----------|
| `app/packages/db/src/schema.ts` | `hidden` + `imageUrl` mező hozzáadása, `postUrl` unique |
| `app/supabase/migrations/0016_social_post_hidden.sql` | SQL migráció fájl |
| `app/apps/web/app/_home/social-feed.tsx` | `.eq('hidden', false)` filter |
| `app/apps/web/app/_home/social-feed-client.tsx` | `.eq('hidden', false)` filter load more-ban |
| `app/apps/web/app/admin/(authed)/social-posts/page.tsx` | Új admin oldal |
| `app/apps/web/app/admin/(authed)/social-posts/hidden-toggle.tsx` | Toggle komponens |
| `app/apps/web/app/api/admin/social-posts/[id]/hidden/route.ts` | Toggle API |
| `app/apps/web/app/admin/(authed)/admin-tabs.tsx` | Új tab: "Social posztok" |

---

## 4. Tesztelés

1. **Automatikus poszt beérkezése**: Tegyél közzé egy teszposztot a figyelt FB oldalon. Várj max 15 percet. Ellenőrzés: Supabase Studio → SocialPost tábla → új sor.
2. **Megjelenés a weboldalon**: `http://localhost:3000` → social feed szekció → megjelenik az új poszt.
3. **Elrejtés adminból**: `/admin/social-posts` → `Elrejtés` gomb → weboldal frissítés → poszt eltűnik.
4. **Duplikátum teszt**: Futtasd le a Make.com scenario-t kézzel kétszer. Ellenőrzés: a SocialPost táblában nem keletkezett duplikátum sor.

---

## 5. Supabase értékek (hol találod)

- **SUPABASE_REF**: Supabase projekt → Settings → General → Reference ID
- **SUPABASE_ANON_KEY**: Settings → API → Project API keys → `anon public`
- **SUPABASE_SERVICE_ROLE_KEY**: Settings → API → Project API keys → `service_role` (titkos — csak Make.com-ban add meg, ne commitold)
