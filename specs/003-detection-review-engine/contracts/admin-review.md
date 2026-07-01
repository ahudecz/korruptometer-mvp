# Contract: Admin Review Interface & Detector Status

## 1. Detector → status (belső szerződés)

Közös döntő függvény (`@korr/db/src/review.ts`):

```
decideStatus(confidence: number, isWatchlist: boolean):
  'approved' | 'pending' | 'discard'

  isWatchlist === true            → 'pending'        // FR-006, bármilyen confidence
  confidence >= 0.90              → 'approved'        // FR-003
  confidence >= 0.70              → 'pending'         // FR-004
  egyébként                       → 'discard'         // FR-005
```

Dedup őr (a beszúrás előtt, minden detektorban):

```
isDuplicate(table, name, withinDays = 30): boolean
  // true, ha létezik sor azonos normalizeName(name)-mel az ablakban,
  // BÁRMELY reviewStatus mellett (approved | pending | rejected)
```

A detektor beszúrási szabálya:
1. `status = decideStatus(conf, isWatchlistPerson(name))`
2. ha `status === 'discard'` → nincs beszúrás
3. ha `isDuplicate(...)` → nincs beszúrás (FR-009, FR-011)
4. egyébként `INSERT ... reviewStatus = status`

## 2. Admin review oldal — `/admin/(authed)/review`

**Olvasás (oldalbetöltés):** a 3 táblából a `reviewStatus = 'pending'` sorok, típus szerint csoportosítva, mindegyiknél: kiolvasott mezők + forráscikk-hivatkozás (ahol van) + megbízhatóság (ha tárolt) + dátum.

**Műveletek (szerver-action, csak admin-szerep):**

| Action | Bemenet | Hatás |
|---|---|---|
| `approveDetection` | `{ table: 'resignation'|'closure'|'verdict', id }` | `reviewStatus = 'approved'`; `revalidate` a publikus oldal(ak)on |
| `rejectDetection` | `{ table, id }` | `reviewStatus = 'rejected'`; nem jelenik meg; dedup blokkolja az újra-létrehozást |

**Előfeltételek:** a hívó a meglévő `(authed)` admin-szerep birtokában (Supabase auth + Editor-allowlist). Ismeretlen `id`/`table` → 404/hiba, nincs státuszváltozás.

## 3. Publikus olvasás szerződése

Minden publikus lekérdezés (`lemondasok`, `megszunt`, `birosagi-iteletek`, nyitó számlálók+listák, `api/resignations`) `WHERE reviewStatus = 'approved'` szűrőt alkalmaz. A nyitóoldali számlálók is csak `approved` sorokat számolnak (a szám és a lista egyezzen).

## 4. Elfogadási kritériumok leképezése (a spec acceptance scenarióiból)

| Scenario | Ellenőrzés |
|---|---|
| 0.82 → pending, nem publikus | `decideStatus(0.82,false)==='pending'`; a sor nem jön vissza a publikus query-ben |
| pending + Elfogad → approved + publikus | `approveDetection` után `reviewStatus='approved'` és megjelenik |
| pending + Eldob → rejected + nem tér vissza | `rejectDetection` után `rejected`; detektor-újrafuttatás dedup miatt nem hoz létre újat |
| 0.93 nem-watchlist → approved + publikus | `decideStatus(0.93,false)==='approved'` |
| 0.95 watchlist → pending | `decideStatus(0.95,true)==='pending'` |
| 0.64 → eldobás | `decideStatus(0.64,*)==='discard'` |
| „Kovács Zoltán" kétszer → 1 sor | `isDuplicate` true a 2. találatra |
