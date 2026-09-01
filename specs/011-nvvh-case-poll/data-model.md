# Data Model: NVVH-szavazás — Az első 5 ügy

A spec Key Entities szekciójának (`Szavazás`, `Opció`, `Szavazat`, `Eredmény-összesítés`) konkrét, Drizzle-sémára fordítható modellje. Elnevezési konvenció a meglévő `schema.ts`-t követi (PascalCase táblanév, camelCase oszlopnév, `uuid().defaultRandom()` elsődleges kulcs, `timestamp({withTimezone:true}).defaultNow()`).

## PollQuestion

Az egy darab aktív (jelenleg: pontosan 1) szavazás-kérdés.

| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `id` | uuid, PK | |
| `slug` | text, unique | pl. `nvvh-elso-5-ugye` — ez adja a `/szavazas` (vagy `/szavazas/[slug]`) URL-t |
| `questionText` | text | "Mi legyen a Nemzeti Vagyonvisszaszerzési és Védelmi Hivatal első 5 ügye?" |
| `minSelect` | integer, default 1 | FR-005 |
| `maxSelect` | integer, default 5 | FR-005 |
| `status` | enum(`open`, `closed`) | Edge case: lezárás után az eredmény-nézet marad elérhető, új szavazat nem |
| `createdAt` | timestamptz | |
| `closedAt` | timestamptz, nullable | |

**Validation**: `minSelect <= maxSelect`, mindkettő `>= 1` — DB-szintű `check` constraint, a template `DamageEstimate_totals_nonneg` mintájára.

## PollOption

Egy kiválasztható ügy (a kutatási alaplista 30 tétele + a jövőben szerkeszthető további tételek).

| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `id` | uuid, PK | |
| `pollQuestionId` | uuid, FK → PollQuestion | |
| `displayOrder` | integer | a kutatási lista véglegesített sorrendje (1-22 konkrét ügy, utána a "Terület"-tagek) |
| `title` | text | pl. "MNB-alapítványok / Matolcsy-kör / Pallas Athéné" |
| `shortDescription` | text | a kártyán alapból látszó 1-2 mondat |
| `longDescription` | text, nullable | a lenyíló "Részletek" szövege |
| `amountHuf` | bigint, nullable | NULL = nincs konkrét összeg (FR-003) — a UI ilyenkor mindig "Nincs konkrét összeg"-et ír ki, sosem 0-t vagy üres mezőt |
| `amountLabel` | text, nullable | ember-olvasható változat (pl. "~270 Mrd Ft", "441 eset / 66 cég") — külön mező az `amountHuf`-tól, mert nem minden összeg egyetlen Ft-szám (lásd a kutatási listát) |
| `sourceUrl` | text | legalább 1 kötelező (FR-004) |
| `sourceOutlet` | text | pl. "444", "Telex", "Átlátszó" — a kártyán megjelenő forrásnév |
| `isAreaNotCase` | boolean, default false | a "Terület" tag — ezek sorolódnak a lista végére (FR szerint tájékoztató jellegű csoportosítás) |
| `touchesEuFunds` | boolean, default false | az "EU" tag |
| `alreadyReported` | boolean, default false | a "Kiemelt" tag ("már van eljárás, ez nem kizáró ok") |
| `createdAt` | timestamptz | |

**Validation**: `sourceUrl` NOT NULL és nem üres string (minden opciónak kell legalább 1 forrás — FR-004).

## PollVote

Egy beküldés — az anonim "ki szavazott" egység, amihez a cookie-ellenőrzés köthető (de a cookie maga nem kerül ebbe a táblába, csak egy visszafejthetetlen `voteToken`).

| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `id` | uuid, PK | ez az érték kerül (aláírva) a "már szavaztál" cookie-ba |
| `pollQuestionId` | uuid, FK → PollQuestion | |
| `votedAt` | timestamptz | |

**Explicit nem tartalmazza**: IP-cím (sem nyers, sem hash-elt — lásd research.md #2), semmilyen személyes azonosító.

## PollVoteSelection

Kapcsolótábla — melyik szavazás melyik opció(ka)t választotta.

| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `pollVoteId` | uuid, FK → PollVote, ON DELETE CASCADE | |
| `pollOptionId` | uuid, FK → PollOption | |

**Primary key**: (`pollVoteId`, `pollOptionId`) összetett kulcs — ez garantálja, hogy egy szavazáson belül egy opció csak egyszer szerepelhet.

**Validation (alkalmazás-szintű, a beszúrás előtt)**: az egy `pollVoteId`-hoz tartozó sorok száma `minSelect` és `maxSelect` között kell legyen (FR-005) — ezt a `POST /api/poll/vote` route ellenőrzi egy tranzakción belül, mielőtt a `PollVote` + `PollVoteSelection` sorokat beszúrja.

## Indexek

- `PollOption(pollQuestionId, displayOrder)` — a kártyalista renderelési sorrendjéhez.
- `PollVoteSelection(pollOptionId)` — az eredmény-aggregációs `GROUP BY optionId` lekérdezéshez (research.md #3).
- `PollVote(pollQuestionId, votedAt)` — az esetleges "hányan szavaztak eddig" élő számlálóhoz a főoldali kártyán.

## Eredmény-összesítés (nem saját tábla, live query)

```sql
SELECT po.id, po.title, count(DISTINCT pvs."pollVoteId") AS votes
FROM "PollOption" po
LEFT JOIN "PollVoteSelection" pvs ON pvs."pollOptionId" = po.id
WHERE po."pollQuestionId" = $1
GROUP BY po.id
ORDER BY votes DESC;
```

Ez a `GET /api/poll` válasza — cache-elve, ahogy a research.md #3 leírja, nem minden kérésnél újraszámolva a felhasználó szeme láttára, de nem is külön materializált tábla (arra ennél a volumennél nincs szükség).
