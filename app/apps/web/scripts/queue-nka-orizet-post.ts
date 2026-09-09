/**
 * Egyszeri, kézi Facebook-poszt-jelölt az NKA/Fásy-ügy őrizetbe vételeiről —
 * user kérés, 2026-09-09.
 *
 * ELŐZMÉNY: az automata breaking-poszt 2026-09-08-án még "Ismeretlen két
 * személy" néven ment ki, mert akkor még nem volt nevük. A nevek azóta
 * megvannak (l. merge-unknown-person-verdicts-2026-09-09.ts), de az
 * automata EGYSZER posztol egy CourtVerdict sorról (triggerRefId-dedup),
 * ezért a frissítést kézzel kell kiküldeni.
 *
 * Egy korábbi kézi kísérlet (outbox 640a233c) MEGSÉRTETTE a briefet: nyers
 * karakter-vágással csonkolta a szöveget. Ez a script azt a sort
 * elutasítottra állítja, és a brief (docs/facebook-content-brief.md)
 * szerint megírt, CSONKÍTATLAN posztot küld helyette.
 *
 * A poszt szövege kézzel írt és a forráshoz (CourtVerdict.summary +
 * hvg.hu/444.hu/hang.hu cikkek) hitelesített — nincs LLM-hívás, nincs
 * automatikus rövidítés. SOSE posztol közvetlenül: Telegram-jóváhagyásra
 * megy, mint minden más jelölt.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
// A worktree-ben nincs .env.local (gitignore-olt), ezért a fő repo
// másolatából olvassuk — ugyanaz a PROD_DATABASE_URL / Telegram-kulcs.
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: 'C:/Users/bbmar/Documents/korruptometer-mvp/app/.env.local' });
loadEnv({ path: resolve(__dirname, '../../../.env') });

const PROD_URL = process.env.PROD_DATABASE_URL;
if (!PROD_URL) throw new Error('PROD_DATABASE_URL not set');
process.env.DATABASE_URL = PROD_URL;

import { eq } from 'drizzle-orm';
import { getDb, schema } from '../src/lib/db';
import { renderBreakingImage } from '../src/lib/social-image';
import { breakingCaption } from '../src/lib/social-caption';
import { sendTelegramPhoto } from '../src/lib/telegram';
import { approvalKeyboard } from '../src/inngest/functions/check-social-triggers';

const VERDICT_ID = '26f6d0db-b2b4-48c8-b823-0663855197a3';
const BAD_OUTBOX_ID = '640a233c-a40d-4a16-9679-c982d7f5686a';

// Brief 11. pont — a forrás "őrizetbe vette" / "letartóztatást
// kezdeményeztek" megfogalmazást használ. NEM írhatjuk, hogy
// "letartóztatva", és végképp nem, hogy "elítélték".
const KICKER = 'ŐRIZETBE VÉVE';

// Brief 8. pont — a képre 3–7 szó. NÉV/ESEMÉNY forma, a poszt hookjával azonos állítás.
const HEADLINE = 'Megvan, kiket vett őrizetbe a NAV';
const IMAGE_DETAIL = 'NKA-botrány: több mint 80 millió Ft';

// Brief 3. és 6. pont — a teljes tényállás, csonkítás nélkül: minden név,
// összeg, cég, státusz és a "feltehetően" fenntartás is benne van.
const BODY = [
  'A NAV két embert vett őrizetbe az NKA-botrányban.',
  '',
  'Az egyikük Szabó Sándor, a Munkácsy Art Kft. tulajdonos-ügyvezetője. A cégén keresztül közel 56 millió forintért bízott meg Fásy családhoz köthető cégeket egy dokumentumfilm elkészítésével.',
  '',
  'A másik őrizetbe vett egy nő — feltehetően Fásyné Gurzó Mária, egy érintett cég tulajdonosa, de ezt a forráscikkek nem állítják tényként. A gyanú szerint egy másik cég ügyvezetőjeként fiktív számlákkal leplezte, hogy a több mint 80 millió forintos NKA/NKTK-támogatásból a film nem készült el.',
  '',
  'Vagyis: közpénzből megrendelt dokumentumfilm, ami nem készült el — a számlák viszont megvoltak.',
].join('\n');

const CTA = '👉 Nézd meg az ügy részleteit a Kegyencjáraton.';

async function main() {
  const db = getDb();

  const [verdict] = await db
    .select({ id: schema.courtVerdicts.id, personName: schema.courtVerdicts.personName, verdictType: schema.courtVerdicts.verdictType })
    .from(schema.courtVerdicts)
    .where(eq(schema.courtVerdicts.id, VERDICT_ID));
  if (!verdict) throw new Error(`CourtVerdict ${VERDICT_ID} nem található`);
  console.log('Forrás-sor:', verdict.personName, '|', verdict.verdictType);

  // A briefet sértő, csonkolt korábbi jelölt kivezetése.
  const rejected = await db
    .update(schema.socialPostOutbox)
    .set({ status: 'rejected' })
    .where(eq(schema.socialPostOutbox.id, BAD_OUTBOX_ID))
    .returning({ id: schema.socialPostOutbox.id, status: schema.socialPostOutbox.status });
  console.log('Régi (csonkolt) jelölt elutasítva:', rejected[0]?.id ?? 'nem található', rejected[0]?.status ?? '');

  const image = await renderBreakingImage({ kicker: KICKER, headline: HEADLINE, detail: IMAGE_DETAIL });
  const caption = breakingCaption(KICKER, HEADLINE, BODY, '/birosagi-iteletek', CTA);

  console.log('\n──────── CAPTION ────────\n' + caption + '\n─────────────────────────\n');

  const [inserted] = await db
    .insert(schema.socialPostOutbox)
    .values({
      triggerType: 'court_verdict_update',
      triggerRefId: verdict.id,
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
    `📢 Új Facebook-poszt-jelölt (kézi, NKA — brief szerint újraírva)\n\n${caption}`,
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
