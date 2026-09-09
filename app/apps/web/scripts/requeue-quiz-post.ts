/**
 * A kvíz-poszt újraküldése a brief szerint — user kérés, 2026-09-09.
 *
 * Az automata (msg 347) még a régi kóddal készült: 220 karakternél nyersen
 * elvágta a 244 karakteres kvíz-introt ("10 kérdés — …", elveszett a "nagy
 * meglepetések, kezdjük!"), és ugyanaz a levágott szöveg ment a képre is.
 * Az a jelölt elutasítva; ez a script a javított úton építi újra:
 * a caption a TELJES introt kapja, a képre csak egy rövid sor kerül
 * (brief 6., 7-8. pont).
 *
 * A QUIZ_COOLDOWN_DAYS (2 nap) miatt az automata magától nem küldené újra
 * ma — ezért egyszeri, kézi futtatás. Telegram-jóváhagyásra megy, mint minden.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: 'C:/Users/bbmar/Documents/korruptometer-mvp/app/.env.local' });

const PROD_URL = process.env.PROD_DATABASE_URL;
if (!PROD_URL) throw new Error('PROD_DATABASE_URL not set');
process.env.DATABASE_URL = PROD_URL;

import { eq } from 'drizzle-orm';
import { getDb, schema } from '../src/lib/db';
import { renderBreakingImage } from '../src/lib/social-image';
import { breakingCaption } from '../src/lib/social-caption';
import { sendTelegramPhoto } from '../src/lib/telegram';
import { hookFor, truncateAtWordBoundary, IMAGE_DETAIL_MAX_CHARS, telegramPreview } from '../src/lib/social-copy-variety';
import { approvalKeyboard } from '../src/inngest/functions/check-social-triggers';

async function main() {
  const db = getDb();
  const [quiz] = await db
    .select({ id: schema.quizzes.id, slug: schema.quizzes.slug, title: schema.quizzes.title, intro: schema.quizzes.intro })
    .from(schema.quizzes)
    .limit(1);
  if (!quiz) throw new Error('nincs kvíz');

  const kicker = 'KVÍZ';
  const headline = quiz.title;
  // Brief 6. pont: a caption a TELJES introt kapja, vágás nélkül.
  const detail = quiz.intro;
  // Brief 8. pont: a képre rövid sor, szóhatáron vágva — sose szó közepén.
  const imageDetail = truncateAtWordBoundary(quiz.intro, IMAGE_DETAIL_MAX_CHARS);
  const hookLine = hookFor('quiz_highlight', quiz.id);

  const image = await renderBreakingImage({ kicker, headline, detail: imageDetail });
  const caption = breakingCaption(kicker, headline, detail, `/kviz/${quiz.slug}`, '🧠 Töltsd ki, és nézd meg, hányat tudtál!', hookLine);
  console.log('KÉPRE:', imageDetail);
  console.log('\n──────── CAPTION ────────\n' + caption + '\n─────────────────────────');

  const [inserted] = await db
    .insert(schema.socialPostOutbox)
    .values({
      triggerType: 'quiz_highlight',
      triggerRefId: quiz.id,
      milestoneValueFt: null,
      headline,
      caption,
      imagePng: image.toString('base64'),
      imageText: imageDetail ?? '',
      kicker,
      status: 'pending_approval',
    })
    .returning({ id: schema.socialPostOutbox.id });
  if (!inserted) throw new Error('insert failed');

  const messageId = await sendTelegramPhoto(
    image,
    telegramPreview('📢 Új Facebook-poszt-jelölt (kvíz — brief szerint újraírva)', caption),
    approvalKeyboard(inserted.id),
  );
  if (messageId) {
    await db.update(schema.socialPostOutbox).set({ telegramMessageId: messageId }).where(eq(schema.socialPostOutbox.id, inserted.id));
  }
  console.log('Új kvíz-jelölt:', inserted.id, '| Telegram message_id:', messageId);
}

main().catch((e) => { console.error(e); process.exit(1); });
