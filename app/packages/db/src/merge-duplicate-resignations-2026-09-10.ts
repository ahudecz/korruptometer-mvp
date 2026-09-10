/**
 * Egyszeri, kézi takarítás a PoliticalResignation táblán — user által
 * jelzett duplikáció (Mike Ferenc), 2026-09-10, + a teljes tábla
 * átvizsgálásakor talált 1 további, ugyanabból a hibaosztályból eredő,
 * korábbi duplikátum (Csányi Sándor).
 *
 * Gyökérok: a 2026-08-23-i intézmény-guard (isDuplicate(), Lázár János-eset)
 * túlkorrigált. Két lap ugyanazt a lemondást MÁS intézmény-megnevezéssel
 * írhatja le, és sem a normalizált egyenlőség, sem a részstring-tartalmazás
 * nem hidalja át a különbséget:
 *
 *   "Nemzeti Reorganizációs Nonprofit Kft. (NRN)"  vs.  "állami felszámoló"
 *   "…Egyetemért Alapítvány"                       vs.  "…Egyetem alapítványa"
 *
 * → a második cikk új sort szúrt be. A kódoldali fix (azonos név + azonos
 * resignationDate = azonos esemény, az intézmény szövegezésétől függetlenül)
 * ugyanennek a commitnak a része, l. review.ts sameEventDayClause. Ez a
 * script csak a MÁR élesben lévő két sort takarítja.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';
import { assertWriteTarget } from './guard';

const PROD_URL = process.env.PROD_DATABASE_URL;
if (!PROD_URL) throw new Error('PROD_DATABASE_URL not set');
process.env.DATABASE_URL = PROD_URL;

type Merge = {
  keepId: string;
  deleteId: string;
  keepDescription?: string; // ha adjuk, felülírja a megmaradó sor description-jét
};

const MERGES: Merge[] = [
  {
    // Mike Ferenc (felmentés, 2026-09-09) — a Telex-sor marad: konkrétan
    // megnevezi az intézményt (NRN) és a tisztséget (felügyelőbizottsági
    // elnök), szemben a HVG-sor általánosabb "állami felszámoló" /
    // "felszámoló" párosával. A HVG-forrás átvezetve.
    // A description eddig szó-limites vágás miatt félbemaradt
    // ("…Nonprofit Kft. felügyelőbizottsági"), most befejezett mondat.
    keepId: '82b47ed2-b6ab-4e97-9e1d-f2251f2dcf61',
    deleteId: 'aead90af-63f1-4349-8266-1d678af66de0',
    keepDescription: 'Felmentették az NRN felügyelőbizottsági elnöki tisztségéből',
  },
  {
    // Csányi Sándor (lemondás, 2026-06-30) — a 08-03-i sor marad: az
    // intézmény-mezője MINDKÉT alapítványt megnevezi (Soproni Egyetemért +
    // MATE), a 09-01-i sor csak a MATE-t, tehát részhalmaz. A második
    // Telex-cikk forrásként átvezetve; a description mostantól mindkét
    // alapítványra utal, nem csak a sopronira.
    keepId: '3ae43b6f-fe5b-42e7-ad7d-60298c2f3dad',
    deleteId: 'f08b99bd-cfd9-40b4-a0c8-f9bf1617ce74',
    keepDescription: 'Lemondott két egyetemi alapítvány éléről',
  },
];

async function main() {
  assertWriteTarget('merge-duplicate-resignations-2026-09-10');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  for (const m of MERGES) {
    const [dup] = await sql`
      SELECT "sourceUrls", "sourceNames" FROM "PoliticalResignation" WHERE id = ${m.deleteId}
    `;
    if (!dup) {
      console.log('Nincs ilyen duplikátum sor (már törölve?):', m.deleteId);
      continue;
    }
    const dupUrl = dup.sourceUrls?.[0] as string | undefined;
    const dupName = dup.sourceNames?.[0] as string | undefined;

    if (dupUrl) {
      await sql`
        UPDATE "PoliticalResignation"
        SET "sourceUrls" = array_append("sourceUrls", ${dupUrl}),
            "sourceNames" = array_append("sourceNames", ${dupName ?? null}),
            "description" = COALESCE(${m.keepDescription ?? null}, description)
        WHERE id = ${m.keepId}
      `;
    } else if (m.keepDescription) {
      await sql`UPDATE "PoliticalResignation" SET "description" = ${m.keepDescription} WHERE id = ${m.keepId}`;
    }

    const deleted = await sql`DELETE FROM "PoliticalResignation" WHERE id = ${m.deleteId} RETURNING id, name`;
    console.log('Törölve (egyesítve):', deleted[0]?.id, deleted[0]?.name, '→ megtartva:', m.keepId);
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
