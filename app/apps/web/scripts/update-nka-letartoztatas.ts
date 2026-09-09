/**
 * NKA/Fásy-ügy — a tényállás 2026-09-09-én tovább lépett, user jelzés
 * alapján (Molnár Áron videója a vezetőszáras előállításról), több
 * független forrásból megerősítve (telex.hu, penzcentrum.hu,
 * kecskemet365.hu, hvg.hu).
 *
 * AMI VÁLTOZOTT a DB-ben tárolt (09-08-i) állapothoz képest:
 *  - A nő személye MEGERŐSÍTVE: Fásyné Gurzó Mária, Fásy Ádám felesége —
 *    a korábbi "feltehetően" fenntartás már nem indokolt.
 *  - A jogi státusz ERŐSÖDÖTT: őrizetbe vétel → a Kecskeméti Járásbíróság
 *    szerdán MINDKETTŐJÜKET egy hónapra LETARTÓZTATTA. (A verdictType
 *    marad 'előzetesben' — a séma ezt használja az előzetes
 *    letartóztatásra is, l. court-verdict-detect.ts.)
 *  - Pontos összegek: 82,55 M Ft (NKA 790-es keret, 1-2. epizód) +
 *    89,9 M Ft (Hankó Balázs miniszteri 447-es kerete, 3-4. rész).
 *
 * A poszt-szöveg a docs/facebook-content-brief.md szerint készült
 * (11. pont: a jogi státusz most már tényszerűen "letartóztatás", mert a
 * bíróság elrendelte — ezt a források egybehangzóan írják).
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: 'C:/Users/bbmar/Documents/korruptometer-mvp/app/.env.local' });

const PROD_URL = process.env.PROD_DATABASE_URL;
if (!PROD_URL) throw new Error('PROD_DATABASE_URL not set');
process.env.DATABASE_URL = PROD_URL;

import { eq, sql } from 'drizzle-orm';
import { getDb, schema } from '../src/lib/db';
import { renderBreakingImage } from '../src/lib/social-image';
import { breakingCaption } from '../src/lib/social-caption';
import { sendTelegramPhoto } from '../src/lib/telegram';
import { telegramPreview } from '../src/lib/social-copy-variety';
import { approvalKeyboard } from '../src/inngest/functions/check-social-triggers';

const VERDICT_ID = '26f6d0db-b2b4-48c8-b823-0663855197a3';
const OUTDATED_OUTBOX_MSG = 348; // a ma 12:26-kor kiküldött, azóta elavult jelölt

const PERSON_NAME = 'Szabó Sándor és Fásyné Gurzó Mária';
const SUMMARY =
  'A Kecskeméti Járásbíróság 2026. szeptember 9-én egy hónapra letartóztatta Fásyné Gurzó Máriát, Fásy Ádám feleségét, ' +
  'és Szabó Sándort, a Munkácsy Art Kft. tulajdonos-ügyvezetőjét — a szökés és az elrejtőzés, az eljárás befolyásolása ' +
  'és a bűnismétlés veszélye miatt. A gyanúsítás bűnszövetségben elkövetett költségvetési csalás és hamis magánokirat ' +
  'felhasználása: a gyanú szerint fiktív számlákkal igazolták, hogy határidőre elkészült a „Kéz, szív, lélek – magyar ' +
  'kortárs művészek nyomában" című dokumentumfilm első két része. Az első két epizódra 82,55 millió forint érkezett az ' +
  'NKA 790-es keretéből, a 3–4. részre további 89,9 millió forint Hankó Balázs miniszteri 447-es keretéből; ebből több ' +
  'mint 56 millió forintot Fásy családhoz köthető cégek kaptak. Fásynét vezetőszáron kísérték be a bíróságra. Az ' +
  'NKA-botrányban eddig kilenc emberrel szemben rendeltek el kényszerintézkedést: négyen letartóztatásban, öten ' +
  'bűnügyi felügyelet alatt vannak.';

const TELEX_URL = 'https://telex.hu/belfold/2026/09/09/nka-botrany-fasy-dokumentumfilm-letartoztatas-birosag';
const TELEX_HEADLINE = 'NKA-botrány: letartóztatták Fásy Ádám feleségét';

// ── A poszt (brief 3., 6., 8., 11. pont) ────────────────────────────────
const KICKER = 'LETARTÓZTATVA';
const HEADLINE = 'Letartóztatták Fásy Ádám feleségét';
const IMAGE_DETAIL = 'Szabó Sándorral együtt, egy hónapra';
const BODY = [
  'A Kecskeméti Járásbíróság szerdán egy hónapra letartóztatta Fásyné Gurzó Máriát és Szabó Sándort, a Munkácsy Art Kft. tulajdonos-ügyvezetőjét. Fásy Ádám feleségét vezetőszáron kísérték be a bíróságra.',
  '',
  'Az indok: a szökés és az elrejtőzés, az eljárás befolyásolása és a bűnismétlés veszélye. A gyanúsítás bűnszövetségben elkövetett költségvetési csalás és hamis magánokirat felhasználása — a gyanú szerint fiktív számlákkal igazolták, hogy határidőre elkészült a „Kéz, szív, lélek – magyar kortárs művészek nyomában" című dokumentumfilm első két része.',
  '',
  'A pénz: 82,55 millió forint az NKA 790-es keretéből az első két epizódra, majd további 89,9 millió forint Hankó Balázs miniszteri 447-es keretéből a 3–4. részre. Ebből több mint 56 millió forint jutott Fásy családhoz köthető cégekhez.',
  '',
  'Az NKA-botrányban eddig kilenc emberrel szemben rendeltek el kényszerintézkedést: négyen letartóztatásban, öten bűnügyi felügyelet alatt vannak.',
].join('\n');
const CTA = '👉 Nézd meg az ügy részleteit a Kegyencjáraton.';

async function main() {
  const db = getDb();

  // 1. A CourtVerdict sor frissítése a megerősített tényekre.
  await db.execute(sql`
    UPDATE "CourtVerdict"
    SET "personName" = ${PERSON_NAME},
        "summary" = ${SUMMARY},
        "sourceUrls" = array_append("sourceUrls", ${TELEX_URL}),
        "sourceNames" = array_append("sourceNames", ${'Telex'}),
        "sourceHeadlines" = array_append("sourceHeadlines", ${TELEX_HEADLINE}),
        "sourceDates" = array_append("sourceDates", ${'2026-09-09'}),
        "updatedAt" = now()
    WHERE id = ${VERDICT_ID}
      AND NOT (${TELEX_URL} = ANY("sourceUrls"))
  `);
  const [row] = await db
    .select({ personName: schema.courtVerdicts.personName, verdictType: schema.courtVerdicts.verdictType })
    .from(schema.courtVerdicts)
    .where(eq(schema.courtVerdicts.id, VERDICT_ID));
  console.log('CourtVerdict frissítve:', row?.personName, '|', row?.verdictType);

  // 2. Az elavult ("őrizetbe véve" / "feltehetően") jelölt kivezetése.
  const outdated = await db
    .update(schema.socialPostOutbox)
    .set({ status: 'rejected' })
    .where(eq(schema.socialPostOutbox.telegramMessageId, OUTDATED_OUTBOX_MSG))
    .returning({ id: schema.socialPostOutbox.id });
  console.log('Elavult jelölt elutasítva:', outdated[0]?.id ?? 'nem található');

  // 3. Az új, megerősített tényállású poszt.
  const image = await renderBreakingImage({ kicker: KICKER, headline: HEADLINE, detail: IMAGE_DETAIL });
  const caption = breakingCaption(KICKER, HEADLINE, BODY, '/birosagi-iteletek', CTA);
  console.log('\n──────── CAPTION (' + caption.length + ' karakter) ────────\n' + caption + '\n───────────────\n');

  const [inserted] = await db
    .insert(schema.socialPostOutbox)
    .values({
      triggerType: 'court_verdict_update',
      triggerRefId: VERDICT_ID,
      milestoneValueFt: null,
      headline: HEADLINE,
      caption,
      imagePng: image.toString('base64'),
      imageText: IMAGE_DETAIL,
      kicker: KICKER,
      status: 'pending_approval',
    })
    .returning({ id: schema.socialPostOutbox.id });
  if (!inserted) throw new Error('Insert failed');

  const messageId = await sendTelegramPhoto(
    image,
    telegramPreview('📢 Új Facebook-poszt-jelölt (NKA — mai letartóztatás)', caption),
    approvalKeyboard(inserted.id),
  );
  if (messageId) {
    await db.update(schema.socialPostOutbox).set({ telegramMessageId: messageId }).where(eq(schema.socialPostOutbox.id, inserted.id));
  }
  console.log('Új jelölt:', inserted.id, '| Telegram message_id:', messageId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
