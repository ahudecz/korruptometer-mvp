# Research: NVVH-szavazás — Az első 5 ügy

Nincs feloldatlan `NEEDS CLARIFICATION` a Technical Contextben — az alábbi döntések a meglévő stack és a spec követelményei alapján egyértelműek voltak, de a választás indoklását itt rögzítjük.

## 1. Bot-védelem elsődleges mechanizmusa: cookie, nem IP

**Decision**: Az "egy ember, egy szavazat" szabály elsődleges betartatója egy aláírt, hosszú lejáratú (pl. 1 éves), httpOnly, csak erre a szavazásra érvényes cookie (`poll_011_voted=1`, aláírva egy szerver-oldali titokkal a hamisítás ellen). Az IP-alapú Upstash rate-limit **csak** másodlagos, tömeges-visszaélés elleni védőháló, nagyvonalú küszöbbel (50-100/IP/nap).

**Rationale**: A user explicit elvárása, hogy egy megosztott hálózatról (munkahely, ahol körbeküldik a linket) mindenki tudjon szavazni. Az IP mint elsődleges azonosító ezt lehetetlenné tenné. A cookie böngészőnkénti, nem hálózatonkénti — pontosan ezt oldja meg.

**Alternatives considered**:
- *IP mint egyedüli azonosító* — elutasítva, mert kizárná a shared-NAT mögötti valódi felhasználókat (explicit user-elvárás ez ellen).
- *Fiókos/bejelentkezős azonosítás* — elutasítva, mert a Constitution nem tervez self-service auth-ot ehhez a use case-hez, és a súrlódás megölné a virális részvételt.
- *Böngésző-fingerprint (canvas/audio fingerprinting)* — elutasítva, adatvédelmi és jogi kockázat (agresszívebb nyomkövetés, mint amit a projekt máshol alkalmaz), és könnyen megkerülhető privát módban.

## 2. Nyers IP nem kerül adatbázisba

**Decision**: Az IP-alapú rate-limit kulcsa (`poll-vote:{ip}`) kizárólag Upstash Redis-ben él, saját 24 órás TTL-lel. A Postgres `PollVote` táblában nincs semmilyen IP-oszlop, hash-elt sem.

**Rationale**: Constitution IV (adatminimalizálás) — ha a rate-limit-kulcs önmagában elég a védelemhez, felesleges egy második, tartós adatbázis-nyomot is létrehozni. Ez szigorúbb, mint a `/bejelentes` mintája (ami már eleve nem tárol nyers IP-t, csak CDN-logban, ≤7 napig) — itt még azt a CDN-szintű nyomot sem kell kiegészíteni saját táblával.

**Alternatives considered**: hash-elt IP tárolása a `PollVote` sorban (napi só + SHA-256) — elutasítva, mert az Upstash-kulcs már ugyanazt a célt szolgálja, TTL-lel, tartós tárolás nélkül; a kettő közül az egyik felesleges lenne.

## 3. Eredmény-olvasás gyorsítótárazása

**Decision**: `GET /api/poll` egy indexelt `GROUP BY` aggregációt futtat, `Cache-Control: public, s-maxage=30, stale-while-revalidate=120` fejléccel, és `revalidateTag('poll-results')` hívással minden sikeres szavazat után (a `POST /api/poll/vote` route-ból).

**Rationale**: Constitution V szellemében (a web request path nem futtat szinkron, drága újraszámítást minden olvasásnál) — de a szavazatszám nagyságrendje (várhatóan százas-ezres tétel, nem millió) nem indokolja a teljes `KpiSnapshot`-mintájú, advisory-lockos, Inngest-ütemezett rollupot. Egy egyszerű indexelt `COUNT ... GROUP BY optionId` elég gyors ahhoz, hogy közvetlenül fusson, csak edge-cache mögé kerül, hogy ne minden kattintás hívja meg szinkron.

**Alternatives considered**: Teljes `PollTally` materializált nézet + Inngest-ütemezett rollup, a `ScandalCatalog`/`KpiSnapshot` mintájára — elutasítva mint túlméretezett erre a volumenre; ha a szavazás váratlanul nagyon nagy forgalmat kap, ez egy később hozzáadható optimalizáció, nem MVP-blokkoló.

## 4. Szavazat-adatmodell: 1 sor a szavazásért, kapcsolótábla a választott opciókhoz

**Decision**: `PollVote` (1 sor/szavazás-beküldés) + `PollVoteSelection` (1 sor/kiválasztott opció, 1-5 sor szavazásonként) — nem egyetlen JSON-tömb oszlop a kiválasztott opció-azonosítókkal.

**Rationale**: Relációs kapcsolótábla indexelhető közvetlenül `optionId` szerint a `GROUP BY` aggregációhoz (2. és 3. pont), és követi a repó meglévő mintáját (pl. `ArticleClaim`, `SignalContribution` — mindig külön sor, nem JSON-tömb, ha aggregálni kell rajta).

**Alternatives considered**: `selectedOptionIds: text[]` oszlop a `PollVote`-on — egyszerűbb írásnál, de az aggregációhoz `unnest()`-elni kellene minden olvasásnál, ami rontja a 3. pontban vállalt gyors, indexelt olvasást.

## 5. Megosztási előnézet (OG-kép)

**Decision**: Next.js beépített `opengraph-image.tsx` (ImageResponse API) a `/szavazas` route alatt — statikus, build-time generált kép, nem dinamikus per-eredmény kép.

**Rationale**: A meglévő stack már Next.js 15 App Router-t használ, natívan támogatja ezt új dependency nélkül. Dinamikus (élő eredményt mutató) OG-kép szép-lenne-de-MVP-n-túlmutat — a statikus, kérdést-bemutató kép is teljesíti az SC-005 sikerkritériumot (egyedi cím+kép megosztáskor).

**Alternatives considered**: Külső képgeneráló szolgáltatás — elutasítva, Constitution III tiltja az új külső szolgáltatás bevezetését szükségtelenül.
