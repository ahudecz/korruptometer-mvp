import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';
import { assertWriteTarget } from './guard';

/**
 * 2026-09-01 user report: Polt Péter alkotmánybírósági elnöki mandátuma
 * éjfélkor (2026-09-01 00:00) automatikusan megszűnt — a júliusban elfogadott
 * 17. Alaptörvény-módosítás szerint az alkotmánybírói megbízatás megszűnik a
 * 70. életév betöltésével, amit Polt (és 3 másik alkotmánybíró: Haszonicsné
 * Ádám Mária, Juhász Miklós, Lomnici Zoltán) ma ért el. Czine Ágnes lett az
 * AB alelnöke. Ez egy HÓNAPOKKAL ELŐRE ISMERT, időzített esemény volt (l. a
 * 2026-07-27-i "Bárki véleményezheti, hogyan válasszák meg Polt Péter
 * utódját" c. cikket), nem hirtelen botrány — a detect-watchlist-removals.ts
 * cron (6 óránként fut, 2 független forrást vár a NewsArticle táblából) még
 * nem kapcsolta be, mert a scraper eddig csak 1 cikket (24.hu) hozott be a
 * tényleges távozásról. Kézzel futtatva a "protokollt": web-kereséssel
 * megerősítve legalább 6 független, elismert forrás (Telex, Index, HVG,
 * Economx, Ugytudjuk, Infostart) — messze a MIN_DISTINCT_SOURCES=2 fölött —,
 * ezért a WatchlistRemoval + PoliticalResignation dual-insert (l.
 * feedback-watchlist-dual-insert.md memória) most kézzel pótolva.
 *
 * removalType/resignationType='felmentés': automatikus, törvényi okból
 * (életkor) megszűnő megbízatás — nem lemondás, nem hirtelen kirúgás.
 * Ugyanaz a minta, mint Koltay András NMHH-elnöki felmentése (l. az ottani
 * PoliticalResignation sor: resignationType 'felmentés', pinned true).
 */
async function main() {
  assertWriteTarget('manual-watchlist-removal-2026-09-01-polt');
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  // 2026-09-01 közben kiderült: a cikk-alapú detect-resignations detektor
  // KÖZBEN már felvette (24.hu forrásból), DE mivel Polt Péter WATCHLIST_PERSON
  // (CALLED_TO_RESIGN), a decideStatus() szabály szerint SOSEM auto-publikál —
  // mindig 'pending'-ben landol, emberi jóváhagyásra várva (l. review.ts
  // decideStatus komment: "a watchlist person NEVER auto-publishes"). Ez a
  // VALÓDI oka annak, hogy "nem történt semmi": a sor MÁR OTT ÜL a review
  // queue-ban, csak senki nem hagyta jóvá. A WatchlistRemoval tábla (ami a
  // WATCH_LIST-kártyát/homepage-grid-et vezérli) viszont továbbra is ÜRES —
  // az a 2-forrásos cron még nem érte el a küszöböt (a DB-ben eddig csak 1
  // scrapelt cikk volt). Ezért itt: (1) a MEGLÉVŐ pending sort hagyjuk jóvá
  // (nem duplázunk), gazdagítva a forrásokkal; (2) a hiányzó WatchlistRemoval
  // sort pótoljuk.
  const existingResignation = await conn<{ id: string }[]>`
    SELECT id FROM "PoliticalResignation" WHERE name = 'Polt Péter' AND "resignationDate" = '2026-09-01'
  `;

  const sourceUrls = [
    'https://telex.hu/belfold/2026/09/01/alkotmanybirosag-polt-peter-elnok-megbizas-lejart-70-ev',
    'https://index.hu/belfold/2026/09/01/alkotmanybirosag-polt-peter-elnok-tavozas-alaptorveny-modositas',
    'https://24.hu/belfold/2026/09/01/polt-peter-tavozott-alkotmanybirosagg-lejart-mandatumok',
  ];
  const sourceNames = ['Telex', 'Index', '24.hu'];
  const sourceHeadline = 'Polt Péter és három másik alkotmánybíró megbízása is lejárt az alaptörvény-módosítás miatt';
  const lead = 'A 17. Alaptörvény-módosítás szerint az alkotmánybírói megbízatás megszűnik a 70. életév betöltésével — ezt Polt Péter (és három másik alkotmánybíró) ma érte el, mandátumuk automatikusan lejárt. Czine Ágnes lett az AB alelnöke.';

  const existingRemoval = await conn`SELECT id FROM "WatchlistRemoval" WHERE "personId" = 'polt-peter'`;
  if (existingRemoval.length === 0) {
    const [removalRow] = await conn`
      INSERT INTO "WatchlistRemoval" ("personId", "removalType", "sourceHeadline", "sourceName", "sourceUrl", "sourceDateLabel", "lead")
      VALUES ('polt-peter', 'removed', ${sourceHeadline}, 'Telex', ${sourceUrls[0]}, '2026. szept. 1.', ${lead})
      RETURNING id
    `;
    console.log(`✅ WatchlistRemoval beszúrva: ${removalRow!.id}`);
  } else {
    console.log('⏭️  WatchlistRemoval már létezett, kihagyva.');
  }

  if (existingResignation.length > 0) {
    const id = existingResignation[0]!.id;
    await conn`
      UPDATE "PoliticalResignation"
      SET "reviewStatus" = 'approved',
          position = 'Alkotmánybíróság elnöke',
          description = 'Alkotmánybírósági posztjából felmentve',
          "sourceUrls" = ${sourceUrls},
          "sourceNames" = ${sourceNames},
          "updatedAt" = now()
      WHERE id = ${id}
    `;
    console.log(`✅ PoliticalResignation jóváhagyva és gazdagítva (id ${id}) — nem duplikáltam.`);
  } else {
    const [resignationRow] = await conn`
      INSERT INTO "PoliticalResignation"
        (name, position, institution, "resignationType", "resignationDate", description, sector, pinned, "sourceUrls", "sourceNames", "reviewStatus")
      VALUES (
        'Polt Péter', 'Alkotmánybíróság elnöke', 'Alkotmánybíróság', 'felmentés', '2026-09-01',
        'Alkotmánybírósági posztjából felmentve', 'hatóságok, hivatalok, állami cégek', true,
        ${sourceUrls}, ${sourceNames}, 'approved'
      )
      RETURNING id
    `;
    console.log(`✅ PoliticalResignation beszúrva: ${resignationRow!.id}`);
  }

  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
