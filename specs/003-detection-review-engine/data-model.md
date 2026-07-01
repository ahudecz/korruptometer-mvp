# Phase 1 Data Model: Detection Review Engine

## Új enum

```
review_status = 'approved' | 'pending' | 'rejected'
```

## Módosított táblák

A három detektor-tábla mindegyike egy új oszlopot kap. Minden más mező változatlan.

### PoliticalResignation
| Mező | Típus | Megjegyzés |
|---|---|---|
| `reviewStatus` | `review_status` NOT NULL DEFAULT `'approved'` | ÚJ. Index: `PoliticalResignation_reviewStatus_idx` |

### MediaClosure
| Mező | Típus | Megjegyzés |
|---|---|---|
| `reviewStatus` | `review_status` NOT NULL DEFAULT `'approved'` | ÚJ. Index a `pending`-szűréshez |

### CourtVerdict
| Mező | Típus | Megjegyzés |
|---|---|---|
| `reviewStatus` | `review_status` NOT NULL DEFAULT `'approved'` | ÚJ. Index a `pending`-szűréshez |

> A `DEFAULT 'approved'` szándékos: a meglévő élő sorok és a jövőbeni ≥0.90 auto-publikált sorok is approved-ok. A detektor a `pending`/`rejected` értéket **kifejezetten** állítja be, amikor kell.

## Állapotátmenetek

```
            ┌──────────── detektor: conf ≥ 0.90 ÉS nem-watchlist ───────────┐
            │                                                               ▼
 (új elem) ─┤── detektor: 0.70 ≤ conf < 0.90  VAGY  watchlist ──▶ pending ──┤── szerkesztő: Elfogad ─▶ approved
            │                                                       │
            └── detektor: conf < 0.70 ──▶ (eldobás, nincs sor)      └────────── szerkesztő: Eldob ───▶ rejected
```

- `approved` → a nyilvános oldalon látszik.
- `pending` → csak az admin review-soron látszik.
- `rejected` → sehol nem látszik; a dedup figyeli (nem jön létre újra).
- A státusz a detektor-újrafuttatáskor **nem** változik (csak a szerkesztő vagy az első beszúrás állítja).

## Validációs / üzleti szabályok (a spec FR-jeiből)

| Szabály | Forrás |
|---|---|
| conf ≥ 0.90 ÉS nem-watchlist → `approved` | FR-003 |
| 0.70 ≤ conf < 0.90 → `pending` | FR-004 |
| conf < 0.70 → nincs sor | FR-005 |
| watchlist személy → mindig `pending` | FR-006 |
| publikus oldal csak `approved` | FR-002 |
| meglévő sorok → `approved` (migráció) | FR-010 |
| `rejected` nem hozható létre újra (dedup minden státusz ellen, 30 nap) | FR-009, FR-011 |
| `reviewStatus` megőrzött újrafuttatáskor/migrációkor | FR-012 |

## Watchlist (referenciaadat, nem DB-tábla)

`WATCHLIST_PERSONS` = a 8 „lemondásra felszólított" + a 10 galéria-személy egyesített, normalizált névlistája (`@korr/db/src/watchlist.ts`). Csak olvasott referencia a döntéshez; nem perzisztált új entitás.

## Dedup-kulcs

`normalizeName(name)` = `lower(trim(unaccent(name)))`, írásjelek nélkül. Egyezés: azonos `normalizeName` a 30 napos ablakban, bármely `reviewStatus` mellett, intézménytől függetlenül.
