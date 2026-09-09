import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';
import { assertWriteTarget } from './guard';

/**
 * A `summary_stats` tartalék-poszt korábban a teljes "CourtVerdict" tábla
 * `count(*)`-át címkézte "jogerős/elsőfokú ítélet"-nek, holott a sorok
 * túlnyomó része előzetes letartóztatás / kiengedés — jóváhagyott elsőfokú
 * vagy jogerős ítélet 2026-09-09-én NULLA volt. Egy ilyen poszt már ki is
 * ment (30d49d04, "21 jogerős/elsőfokú ítélet"), egy pedig még
 * jóváhagyásra várt ugyanezzel a hamis állítással.
 *
 * A generátor javítva (check-social-triggers.ts → partitionVerdicts), de a
 * MÁR SORBAN ÁLLÓ sor szövege/képe befagyott, azt a javítás nem írja át —
 * ezért kell kézzel kivenni, hogy egy Telegram-jóváhagyás ne küldje ki.
 */
const OUTBOX_ID = '910ee603-d8e1-45a2-af8b-c456ee4fc13d';

async function main() {
  assertWriteTarget('delete-false-verdict-summary-post-2026-09-09');
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const rows = await conn`
    DELETE FROM "SocialPostOutbox"
    WHERE id = ${OUTBOX_ID} AND status = 'pending_approval'
    RETURNING id, "triggerType", status, "imageText"
  `;

  if (rows.length === 0) {
    console.log(`⚠️  Nem található (vagy már nem pending_approval): ${OUTBOX_ID}`);
  } else {
    console.log(`✅ Törölve: ${rows[0]?.id} (${rows[0]?.triggerType})`);
    console.log(`   volt: ${rows[0]?.imageText}`);
  }

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
