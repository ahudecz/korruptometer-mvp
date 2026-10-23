/**
 * Egyszeri, kézi Telegram-jóváhagyási poszt-jelölt — user kérés, 2026-10-23.
 *
 * Matolcsy György letartóztatása (egy hónap, nem jogerős). Az automata
 * check-social-triggers.ts csak az ÚJONNAN létrehozott CourtVerdict-sorokat
 * nézi (createdAt > since); Matolcsy sora okt. 21-én pending-ként jött létre,
 * és később lett jóváhagyva/frissítve, ezért az automatika sosem posztolta.
 * Külön triggerType ('court_verdict_update'), ugyanúgy Telegram-gombos
 * jóváhagyásra megy, SOSEM posztol közvetlenül.
 */
import React from 'react';
(globalThis as unknown as { React: typeof React }).React = React;
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

const PROD_URL = process.env.PROD_DATABASE_URL;
if (!PROD_URL) throw new Error('PROD_DATABASE_URL not set');
process.env.DATABASE_URL = PROD_URL;

import { getDb, schema } from '../src/lib/db';
import { renderBreakingImage } from '../src/lib/social-image';
import { breakingCaption } from '../src/lib/social-caption';
import { sendTelegramPhoto } from '../src/lib/telegram';
import { approvalKeyboard } from '../src/inngest/functions/check-social-triggers';
import { telegramPreview } from '../src/lib/social-copy-variety';
import { and, eq } from 'drizzle-orm';

const VERDICT_ID = '166fdd90-96d8-4215-8712-72288795b6c1';

async function main() {
  const db = getDb();

  // Ha a sor már bent van, de a Telegram-üzenet nem ment ki (pl. 1024
  // karakteres feliratkorlát), csak az üzenetet küldjük újra.
  const [existing] = await db
    .select({ id: schema.socialPostOutbox.id, caption: schema.socialPostOutbox.caption, imagePng: schema.socialPostOutbox.imagePng, telegramMessageId: schema.socialPostOutbox.telegramMessageId })
    .from(schema.socialPostOutbox)
    .where(and(eq(schema.socialPostOutbox.triggerType, 'court_verdict_update'), eq(schema.socialPostOutbox.triggerRefId, VERDICT_ID)));
  if (existing) {
    if (existing.telegramMessageId) {
      console.log('Már van poszt-jelölt és Telegram-üzenet:', existing.id);
      return;
    }
    const msgId = await sendTelegramPhoto(
      Buffer.from(existing.imagePng, 'base64'),
      telegramPreview('📢 Új Facebook-poszt-jelölt (kézi, Matolcsy letartóztatása)', existing.caption),
      approvalKeyboard(existing.id),
    );
    if (msgId) await db.update(schema.socialPostOutbox).set({ telegramMessageId: msgId }).where(eq(schema.socialPostOutbox.id, existing.id));
    console.log('Telegram újraküldve:', existing.id, '— sent:', !!msgId);
    return;
  }

  const kicker = 'LETARTÓZTATVA';
  const headline = 'Egy hónapra letartóztatták Matolcsy Györgyöt!';
  const imageHeadline = 'Matolcsy György: egy hónapra letartóztatva';
  const imageDetail = 'Nem jogerős — fellebbezett';

  const whatHappened = [
    'A volt jegybankelnök egy hónapra rács mögé kerül: a nyomozási bíró 2026. október 23-án, csaknem kilencórás ülés után elrendelte a letartóztatását. A bíróság szerint fennáll a szökés, a tanúk befolyásolásának és a bűnismétlésnek a veszélye, és külföldön lehet ismeretlen vagyona.',
    'A gyanú: különösen jelentős vagyoni hátrányt okozó gazdasági csalás és hamis magánokirat felhasználása. Matolcsy a bíróság szóvivője szerint nem ismerte el a felelősségét. A döntés nem jogerős, fellebbezett.',
  ].join('\n\n');

  const bullets = [
    '30 millió forint óvadékot ajánlott a védelem — a bíró elutasította.',
    'Vele együtt egy hónapra letartóztatták Sándor Tamás ügyvédet, Matolcsy Ádám cégeinek állandó jogi képviselőjét, és Valkó Mihályt, a Quartz Befektetési Alapkezelő vezérigazgatóját.',
    'Matolcsy Ádámot és Stofa Györgyöt elfogatóparancs alapján körözik.',
    '266 milliárd forint közpénz került az MNB-alapítványokba — a mostani gyanú ezek közül egy jegybankelnöki megbízatás végén kötött értékpapír-kölcsönszerződésre vonatkozik.',
  ];

  const whyItMatters = 'Másfél éve folyik a nyomozás az MNB-alapítványok ügyében — most került először rács mögé a volt jegybankelnök.';

  const image = await renderBreakingImage({ kicker, headline: imageHeadline, detail: imageDetail });
  const caption = breakingCaption(kicker, headline, whatHappened, '/ugyek/mnb-botrany', undefined, whyItMatters, bullets);

  const [inserted] = await db
    .insert(schema.socialPostOutbox)
    .values({
      triggerType: 'court_verdict_update',
      triggerRefId: VERDICT_ID,
      milestoneValueFt: null,
      headline,
      caption,
      imagePng: image.toString('base64'),
      imageText: imageDetail,
      kicker,
      status: 'pending_approval',
    })
    .returning({ id: schema.socialPostOutbox.id });
  if (!inserted) throw new Error('Insert failed');

  const messageId = await sendTelegramPhoto(
    image,
    telegramPreview('📢 Új Facebook-poszt-jelölt (kézi, Matolcsy letartóztatása)', caption),
    approvalKeyboard(inserted.id),
  );
  if (messageId) {
    await db.update(schema.socialPostOutbox).set({ telegramMessageId: messageId }).where(eq(schema.socialPostOutbox.id, inserted.id));
  }
  console.log('Queued outbox row:', inserted.id, '— Telegram message sent:', !!messageId);
  console.log('\n--- CAPTION ---\n' + caption);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
