/**
 * Egyszeri takarítás — user döntés, 2026-09-16: „azok nem fognak már soha
 * kikerülni, ha tudod, akkor töröld is a telegramomból."
 *
 * Előzmény: a Facebook-poszt-generátor ma átépült a content brief szerkezetére
 * (l. 8519875). A már MEGÉPÜLT, jóváhagyásra váró outbox-sorok viszont a RÉGI
 * szöveggel ülnek ott — a kódváltozás nem írja újra őket. Ha a user
 * jóváhagyná bármelyiket, a régi, briefnek nem megfelelő szöveg menne ki.
 * Köztük két konkrétan hibás is:
 *   - „📄 <UNKNOWN> feljelentést tett: …" (a forrás-sor azóta törölve)
 *   - „Letartóztatták Fásy Ádám feleségét" (a ma megépített viszonyszó-őr
 *     esete)
 *
 * Amit csinál:
 *   1. minden `pending_approval` sorhoz, aminek van telegramMessageId-je,
 *      meghívja a Telegram deleteMessage-t (a bot a saját üzeneteit
 *      törölheti); a sikertelen törlés NEM állítja meg a futást, csak
 *      naplózza — egy régi üzenet törlését a Telegram megtagadhatja;
 *   2. törli a `pending_approval` outbox-sorokat.
 *
 * FONTOS mellékhatás, szándékos: a friss (24 órán belüli) forrás-rekordok
 * ezzel újra jelöltté válnak, és a következő órás körben ÚJRAÉPÜLNEK — már az
 * új, brief szerinti szöveggel. A régebbiek kiestek a lookback-ablakból, azok
 * egyszerűen eltűnnek (a user szerint amúgy sem mennének ki soha).
 *
 * A `posted` és `rejected` sorokat NEM bántja (előbbi élő poszt, utóbbi
 * duplikátum-védelem).
 *
 * Idempotens: újrafuttatva 0 sort érint.
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

const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;

async function deleteTelegramMessage(messageId: number): Promise<string> {
  if (!BOT || !CHAT) return 'kihagyva (nincs bot token/chat id)';
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT}/deleteMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, message_id: messageId }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    return data?.ok ? 'törölve' : `sikertelen: ${data?.description ?? res.status}`;
  } catch (e) {
    return `hiba: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function main() {
  assertWriteTarget('purge-stale-social-outbox-2026-09-16');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const pending = await sql<Array<{ id: string; triggerType: string; headline: string; telegramMessageId: number | null }>>`
    SELECT id, "triggerType", "headline", "telegramMessageId"
    FROM "SocialPostOutbox" WHERE status = 'pending_approval'
    ORDER BY "createdAt" DESC
  `;
  console.log(`Jóváhagyásra váró sorok: ${pending.length}`);
  if (pending.length === 0) { await sql.end(); return; }

  let tgOk = 0;
  for (const row of pending) {
    if (row.telegramMessageId == null) {
      console.log(` - [${row.triggerType}] ${row.headline.slice(0, 50)} — nincs Telegram-üzenet`);
      continue;
    }
    const result = await deleteTelegramMessage(row.telegramMessageId);
    if (result === 'törölve') tgOk += 1;
    console.log(` - [${row.triggerType}] ${row.headline.slice(0, 50)} — Telegram: ${result}`);
  }

  const deleted = await sql`
    DELETE FROM "SocialPostOutbox" WHERE status = 'pending_approval' RETURNING id
  `;
  console.log(`\nTelegram-üzenet törölve: ${tgOk}/${pending.length}`);
  console.log(`Outbox-sor törölve: ${deleted.length}`);

  const left = await sql`SELECT status, count(*)::int AS n FROM "SocialPostOutbox" GROUP BY status`;
  console.log('Maradék:', left.map((r) => `${r.status}=${r.n}`).join(', '));
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
