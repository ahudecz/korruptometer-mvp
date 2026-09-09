/** Csak RENDER + mentés fájlba — semmit nem küld ki, semmit nem ír a DB-be.
 *  Azért van, hogy a képet MEGNÉZZÜK, mielőtt jóváhagyásra menne (user
 *  report, 2026-09-09: a képen csonka mondat volt, amit a karakterszám
 *  ellenőrzése nem mutatott meg — csak a kép ránézésre). */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: 'C:/Users/bbmar/Documents/korruptometer-mvp/app/.env.local' });
process.env.DATABASE_URL = process.env.PROD_DATABASE_URL;

import { writeFileSync } from 'node:fs';
import { getDb, schema } from '../src/lib/db';
import { renderBreakingImage } from '../src/lib/social-image';
import { imageDetailLine } from '../src/lib/social-copy-variety';

const OUT = 'C:/Users/bbmar/AppData/Local/Temp/claude/C--Users-bbmar-Documents-korruptometer-mvp/8a5c36ea-cc9d-476f-9137-d23112ccc519/scratchpad/preview-quiz.png';

async function main() {
  const db = getDb();
  const [quiz] = await db
    .select({ title: schema.quizzes.title, intro: schema.quizzes.intro })
    .from(schema.quizzes)
    .limit(1);
  if (!quiz) throw new Error('nincs kvíz');

  const imageDetail = imageDetailLine(quiz.intro);
  console.log('headline:', quiz.title);
  console.log('kepre kerulo also sor:', imageDetail === undefined ? '(NINCS — a cim maga a hook)' : imageDetail);

  const png = await renderBreakingImage({ kicker: 'KVÍZ', headline: quiz.title, detail: imageDetail });
  writeFileSync(OUT, png);
  console.log('mentve:', OUT);
  process.exit(0);
}
main();
