# Contract: Make.com → Supabase REST API

**Interface**: HTTP POST a Supabase REST végpontra  
**Direction**: Make.com (writer) → Supabase PostgREST (receiver)

---

## Endpoint

```
POST https://<SUPABASE_PROJECT_REF>.supabase.co/rest/v1/SocialPost
```

## Headers

```
apikey:        <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
Content-Type:  application/json
Prefer:        resolution=ignore-duplicates,return=minimal
```

- `resolution=ignore-duplicates` → ha `postUrl` már létezik, az insert csendesen ignorálva van (duplikátum védelem)
- `return=minimal` → üres body a válaszban, olcsóbb Make.com operation

## Request body

```json
{
  "authorName":   "Vastagbőr",
  "authorHandle": "@vastagbor",
  "platform":     "facebook",
  "postUrl":      "https://www.facebook.com/vastagbor/posts/1234567890",
  "content":      "A poszt szövege...",
  "imageUrl":     "https://...",
  "postedAt":     "2026-06-24T10:00:00+02:00",
  "hidden":       false
}
```

| Mező | Típus | Kötelező | Megjegyzés |
|------|-------|----------|-----------|
| `authorName` | string | ✅ | FB oldal neve |
| `authorHandle` | string | ❌ | `@handle` formátum |
| `platform` | string | ✅ | mindig `"facebook"` |
| `postUrl` | string | ✅ | UNIQUE — duplikátum védelem alapja |
| `content` | string | ✅ | Üres string is elfogadott (link-only poszt) |
| `imageUrl` | string | ❌ | null ha nincs kép/thumbnail |
| `postedAt` | ISO 8601 | ❌ | FB `created_time` |
| `hidden` | boolean | ❌ | default: false |

## Válasz

- **201 Created** — sikeres insert
- **200 OK + üres body** — duplikátum, ignorálva (`ignore-duplicates`)
- **4xx** — hiba (pl. hiányzó kötelező mező, auth hiba)

---

## Contract: Admin toggle API

**Interface**: HTTP POST a Next.js admin API-ra  
**Used by**: `HiddenToggle` kliens komponens

```
POST /api/admin/social-posts/{id}/hidden
```

**Auth**: Supabase session cookie (requireAdmin middleware)  
**Body**: üres  
**Response**: `{ "hidden": boolean }` — az új érték  
**Side effect**: `router.refresh()` a kliens oldalon
