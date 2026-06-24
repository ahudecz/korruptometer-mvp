# Data Model: Make.com Facebook → SocialPost automatizáció

**Phase**: 1 — Design  
**Feature**: specs/002-make-facebook-social-feed/spec.md  
**Date**: 2026-06-24

---

## Meglévő entitás: SocialPost

A tábla már létezik (`0014_social_posts.sql`). Csak egy mezővel bővül.

### Jelenlegi séma

```sql
"SocialPost" (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "authorName"  text NOT NULL,
  "authorHandle" text,
  platform      text NOT NULL DEFAULT 'facebook',
  "postUrl"     text NOT NULL,
  content       text NOT NULL,
  "postedAt"    timestamptz,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
)
```

### Módosítás (0016_social_post_hidden.sql)

```sql
-- FR-005: hidden mező hozzáadása
ALTER TABLE "SocialPost"
  ADD COLUMN "hidden" boolean NOT NULL DEFAULT false;

-- FR-008: duplikátum védelem postUrl alapján
ALTER TABLE "SocialPost"
  ADD CONSTRAINT "SocialPost_postUrl_unique" UNIQUE ("postUrl");
```

### Frissített Drizzle schema (packages/db/src/schema.ts)

```typescript
export const socialPosts = pgTable(
  'SocialPost',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    authorName: text('authorName').notNull(),
    authorHandle: text('authorHandle'),
    platform: text('platform').notNull().default('facebook'),
    postUrl: text('postUrl').notNull().unique(),   // + UNIQUE
    content: text('content').notNull(),
    imageUrl: text('imageUrl'),                    // már kezelve van a UI-ban, de hiányzik a sémából
    postedAt: timestamp('postedAt', { withTimezone: true }),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    hidden: boolean('hidden').notNull().default(false),  // ÚJ
  },
  (t) => ({
    postedAtIdx: index('SocialPost_postedAt_idx').on(t.postedAt),
  }),
);
```

> **Megjegyzés**: az `imageUrl` mező eddig nem szerepelt a Drizzle sémában, de a `social-feed-client.tsx` már használja (`post.imageUrl`). A séma frissítésekor ezt is hozzá kell adni.

---

## Entitások és mezők Make.com-oldalon

Make.com a Supabase REST API-n keresztül tölti fel a posztokat. A Make.com HTTP modul body-ja:

| Mező | Forrás (Make.com) | Megjegyzés |
|------|--------------------|------------|
| `authorName` | FB oldal neve (manuálisan beállítva route-ban) | pl. `"Vastagbőr"` |
| `authorHandle` | FB oldal handle | pl. `"@vastagbor"` |
| `platform` | konstans `"facebook"` | |
| `postUrl` | `{{1.permalink_url}}` | duplikátum védelem alapja |
| `content` | `{{1.message}}` | szöveg tartalom |
| `imageUrl` | `{{1.full_picture}}` vagy videó thumbnail | ha nincs kép: null |
| `postedAt` | `{{1.created_time}}` | ISO 8601 |

---

## Validáció és korlátozások

- `postUrl` UNIQUE → duplikátum insert-et a DB szinten rejti el (`Prefer: resolution=ignore-duplicates`)
- `content` NOT NULL → ha a poszt csak linket tartalmaz szöveg nélkül, a Make.com `message` mező üres string lehet; kezelhető fallback-kel Make.com-ban (pl. `{{ifempty(1.message; "[kép/link]")}}`)
- `imageUrl` nullable → szöveges poszt esetén null, nem jelenik meg a kártyán

---

## State transitions

```
[beérkező poszt]
   ↓ Make.com insert (hidden = false)
[megjelenik a weboldalon]
   ↓ admin hidden = true
[rejtett — weboldal nem mutatja]
   ↓ admin hidden = false
[újra látható]
```

Törlés nincs a scope-ban — admin csak elrejteni/visszaállítani tud.
