/**
 * Egyszeri, kézi javítás a CourtVerdict táblán — Volánbusz/túlárazott
 * buszbeszerzés ügy, 2026-09-15 (user report a /birosagi-iteletek oldalról).
 *
 * Három hiba egyszerre:
 *
 * 1) DUPLIKÁTUM. A "Magyar Nemzeti Vagyonkezelő Zrt. egykori vezérigazgató"
 *    nevű anonim sor (24.hu, 09-10) ÉS a "Szivek Norbert" sor (Telex, 09-10)
 *    UGYANAZ a személy — Szivek Norbert az MNV egykori vezérigazgatója
 *    (megerősítve: HVG 2026-09-15). Az anonim sort töröljük, a forrását
 *    beolvasztjuk a nevesített sorba.
 *
 * 2) TÉVES POZÍCIÓ. A Jellinek Dániel-sor pozíciója "milliárdos, Nemzeti
 *    Vagyonkezelő volt vezetője" volt — ez a két gyanúsított összemosása.
 *    Jellinek Dániel magánbefektető, Tiborcz István üzlettársa; az MNV-t
 *    Szivek vezette.
 *
 * 3) STÁTUSZ. Mindkét sor rossz szakaszban állt: Jellineké 'vádemelés'
 *    (holott vádemelés nem történt, csak gyanúsítotti kihallgatás),
 *    Sziveké 'egyéb' — utóbbi a listában a "0 ÉV" ítélet-badge-et kapta,
 *    holott nincs ítélet. 2026-09-15-én a Központi Nyomozó Főügyészség a
 *    négy gyanúsított közül hármat őrizetbe vett; a KNYF nevet nem közölt,
 *    a két nevet Magyar Péter miniszterelnök mondta ki a parlamentben.
 *    Mindkét sor 'előzetesben'-be kerül (a tábla CHECK-constraintje nem
 *    ismer külön 'őrizetben' értéket — a pontosítás a summary-ben van).
 *
 * Idempotens: a forrás-hozzáfűzés és a törlés is újrafuttatható.
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

const DUP_ID = '33599279-be51-4baf-9f1c-fbaf674c55a5'; // anonim MNV-vezérigazgató
const SZIVEK_ID = 'c8e6b99b-cd13-4201-a624-b550b41309e0';
const JELLINEK_ID = 'b1b7b7a6-1e42-49f2-a534-d5f134a91c7f';

const HVG_URL = 'https://hvg.hu/itthon/20260915_orizetbe-vetel-ugyeszseg-volanbusz-korrupcio';
const HVG_HEADLINE = 'Három embert őrizetbe vett az ügyészség a túlárazott Volán-buszok ügyében';
const DUP_URL =
  'https://24.hu/belfold/2026/09/10/nni-tularazott-buszbeszerzes-gyanusitott-magyar-nemzeti-vagyonkezelo-vezerigazgato';
const DUP_HEADLINE =
  'Túlárazott buszbeszerzések: meggyanúsították a Magyar Nemzeti Vagyonkezelő Zrt. egykori vezérigazgatóját is';

const SZIVEK_SUMMARY =
  'Szivek Norbertet, a Magyar Nemzeti Vagyonkezelő egykori vezérigazgatóját 2026. szeptember 10-én ' +
  'gyanúsítottként hallgatták ki a Volán-buszok túlárazása ügyében, hűtlen kezelés és pénzmosás gyanújával. ' +
  'Szeptember 15-én a Központi Nyomozó Főügyészség összehangolt akcióban a négy gyanúsított közül hármat ' +
  'őrizetbe vett; a főügyészség nevet nem közölt, az ő előállításáról Magyar Péter miniszterelnök beszélt a ' +
  'parlamentben. Vádemelés nem történt, a letartóztatásról bíróság dönt.';

const JELLINEK_SUMMARY =
  'Jellinek Dániel milliárdos üzletembert, Tiborcz István üzlettársát gyanúsítottként hallgatták ki a ' +
  'Volánbusz Zrt. buszbeszerzéseihez kapcsolódó, milliárdos vesztegetési ügyben. 2026. szeptember 15-én a ' +
  'Központi Nyomozó Főügyészség a négy gyanúsított közül hármat őrizetbe vett; a főügyészség nevet nem közölt, ' +
  'az ő előállításáról Magyar Péter miniszterelnök beszélt a parlamentben. Vádemelés nem történt, ítélet nem született.';

async function main() {
  assertWriteTarget('fix-volanbusz-custody-2026-09-15');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  // 1) Duplikátum: az anonim sor forrásának beolvasztása Szivekbe, majd törlés.
  const dup = await sql`SELECT id FROM "CourtVerdict" WHERE id = ${DUP_ID}`;
  if (dup.length > 0) {
    await sql`
      UPDATE "CourtVerdict" SET
        "sourceUrls"      = CASE WHEN ${DUP_URL} = ANY("sourceUrls") THEN "sourceUrls"
                                 ELSE "sourceUrls" || ${DUP_URL}::text END,
        "sourceNames"     = CASE WHEN ${DUP_URL} = ANY("sourceUrls") THEN "sourceNames"
                                 ELSE "sourceNames" || '24.hu'::text END,
        "sourceHeadlines" = CASE WHEN ${DUP_URL} = ANY("sourceUrls") THEN "sourceHeadlines"
                                 ELSE "sourceHeadlines" || ${DUP_HEADLINE}::text END,
        "sourceDates"     = CASE WHEN ${DUP_URL} = ANY("sourceUrls") THEN "sourceDates"
                                 ELSE "sourceDates" || '2026-09-10'::text END
      WHERE id = ${SZIVEK_ID}
    `;
    await sql`DELETE FROM "CourtVerdict" WHERE id = ${DUP_ID}`;
    console.log('Duplikátum (anonim MNV-vezérigazgató) törölve, forrása Szivekhez fűzve.');
  } else {
    console.log('Duplikátum már nincs meg — kihagyva.');
  }

  // 2) Szivek Norbert — őrizetbe vétel
  const szivek = await sql`
    UPDATE "CourtVerdict" SET
      "verdictType"   = 'előzetesben',
      "verdictDate"   = '2026-09-15T00:00:00Z',
      "sentenceLabel" = 'őrizetbe véve',
      court           = 'Központi Nyomozó Főügyészség',
      summary         = ${SZIVEK_SUMMARY},
      description     = 'Szivek Norbert őrizetben a Volánbusz-ügyben',
      "sourceUrls"      = CASE WHEN ${HVG_URL} = ANY("sourceUrls") THEN "sourceUrls"
                               ELSE "sourceUrls" || ${HVG_URL}::text END,
      "sourceNames"     = CASE WHEN ${HVG_URL} = ANY("sourceUrls") THEN "sourceNames"
                               ELSE "sourceNames" || 'HVG'::text END,
      "sourceHeadlines" = CASE WHEN ${HVG_URL} = ANY("sourceUrls") THEN "sourceHeadlines"
                               ELSE "sourceHeadlines" || ${HVG_HEADLINE}::text END,
      "sourceDates"     = CASE WHEN ${HVG_URL} = ANY("sourceUrls") THEN "sourceDates"
                               ELSE "sourceDates" || '2026-09-15'::text END,
      "updatedAt"     = now()
    WHERE id = ${SZIVEK_ID}
    RETURNING "personName", position, "verdictType", "verdictDate", "sentenceLabel", description, "sourceNames"
  `;
  console.log('Szivek:', szivek[0]);

  // 3) Jellinek Dániel — pozíció-javítás + őrizetbe vétel
  const jellinek = await sql`
    UPDATE "CourtVerdict" SET
      position        = 'milliárdos üzletember, Tiborcz István üzlettársa',
      crimes          = ARRAY['korrupciós bűncselekmény', 'vesztegetés']::text[],
      "verdictType"   = 'előzetesben',
      "verdictDate"   = '2026-09-15T00:00:00Z',
      "sentenceLabel" = 'őrizetbe véve',
      court           = 'Központi Nyomozó Főügyészség',
      summary         = ${JELLINEK_SUMMARY},
      description     = 'Jellinek Dániel őrizetben a Volánbusz-ügyben',
      "sourceUrls"      = CASE WHEN ${HVG_URL} = ANY("sourceUrls") THEN "sourceUrls"
                               ELSE "sourceUrls" || ${HVG_URL}::text END,
      "sourceNames"     = CASE WHEN ${HVG_URL} = ANY("sourceUrls") THEN "sourceNames"
                               ELSE "sourceNames" || 'HVG'::text END,
      "sourceHeadlines" = CASE WHEN ${HVG_URL} = ANY("sourceUrls") THEN "sourceHeadlines"
                               ELSE "sourceHeadlines" || ${HVG_HEADLINE}::text END,
      "sourceDates"     = CASE WHEN ${HVG_URL} = ANY("sourceUrls") THEN "sourceDates"
                               ELSE "sourceDates" || '2026-09-15'::text END,
      "updatedAt"     = now()
    WHERE id = ${JELLINEK_ID}
    RETURNING "personName", position, "verdictType", "verdictDate", "sentenceLabel", description, "sourceNames"
  `;
  console.log('Jellinek:', jellinek[0]);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
