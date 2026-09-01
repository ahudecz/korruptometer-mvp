# API Contract: Szavazás

## `GET /api/poll`

Publikus, cache-elt olvasás — a kérdés, az összes opció és az aktuális eredmény-összesítés.

**Cache**: `Cache-Control: public, s-maxage=30, stale-while-revalidate=120` — a `revalidateTag('poll-results')` invalidálja új szavazatnál (lásd research.md #3).

**Response 200**:
```json
{
  "question": {
    "slug": "nvvh-elso-5-ugye",
    "text": "Mi legyen a Nemzeti Vagyonvisszaszerzési és Védelmi Hivatal első 5 ügye?",
    "minSelect": 1,
    "maxSelect": 5,
    "status": "open"
  },
  "totalVotes": 2341,
  "options": [
    {
      "id": "uuid",
      "title": "MNB-alapítványok / Matolcsy-kör / Pallas Athéné",
      "shortDescription": "...",
      "longDescription": "...",
      "amountLabel": "~270 Mrd Ft",
      "sourceUrl": "https://444.hu/...",
      "sourceOutlet": "444",
      "tags": { "alreadyReported": true, "touchesEuFunds": false, "isAreaNotCase": false },
      "votes": 812,
      "sharePct": 34.7
    }
  ]
}
```

**Megjegyzés**: `votes`/`sharePct` mindig jelen van (0, ha még nincs szavazat — Edge Case: üres állapot, nem hiba). Az `options` tömb sorrendje az eredmény-nézetben `votes` szerint csökkenő (FR-008); a szavazó-nézet a `displayOrder` szerinti (kurált) sorrendet használja — ezt a kliens dönti el, ugyanabból a payloadból.

## `POST /api/poll/vote`

**Request** (JSON body):
```json
{
  "questionSlug": "nvvh-elso-5-ugye",
  "optionIds": ["uuid1", "uuid2", "uuid3"],
  "turnstileToken": "...",
  "honeypot": ""
}
```

**Szerver-oldali validáció, ebben a sorrendben** (a korai kilépés olcsóbb, mint a drága lépések):

1. `honeypot` mező nem üres → 400, szavazat nem rögzül (FR-014).
2. "Már szavaztál" cookie jelen van ehhez a `questionSlug`-hoz → 409, a válasz jelzi, hogy már szavazott (FR-011).
3. IP-alapú napi rate-limit (`pollVoteIpLimiter`, 50-100/nap) → 429, ha túllépve (FR-012).
4. Turnstile-token ellenőrzés szerver-oldalon → 403, ha sikertelen (FR-013).
5. `optionIds.length` a kérdés `minSelect`-`maxSelect` tartományában, minden id létező, a kérdéshez tartozó opció → 400, ha nem (FR-005).
6. Tranzakción belül: `PollVote` sor beszúrása + `PollVoteSelection` sorok (1 tranzakció, hogy ne maradjon félkész szavazat).
7. `revalidateTag('poll-results')` hívás.
8. Válasz: 201, `Set-Cookie: poll_nvvh-elso-5-ugye_voted=<aláírt PollVote.id>; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`.

**Response 201**:
```json
{ "success": true, "voteId": "uuid" }
```

**Hiba-válaszok** — mindegyik emberi, konkrét üzenettel (a `/bejelentes` route mintája szerint, ld. `app/apps/web/app/api/submissions/route.ts`), sosem csupasz 500:
- 409 `{ "error": "Ezzel a böngészővel már szavaztál ezen a kérdésen." }`
- 429 `{ "error": "Túl sok szavazat érkezett erről a hálózatról ma. Próbáld újra holnap." }`
- 403 `{ "error": "A bot-ellenőrzés nem sikerült. Frissítsd az oldalt, és próbáld újra." }`
- 400 `{ "error": "1 és 5 közötti számú ügyet kell kiválasztanod." }`
