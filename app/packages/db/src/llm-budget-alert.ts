/**
 * Telegram-riasztás, amikor a napi LLM-költséglimit elfogy.
 *
 * Nincs `import 'server-only'` — ezt a fájlt sima tsx-szkriptek (pl.
 * detect-now.ts) is elérik llm.ts-en keresztül, azok kívül futnak a
 * Next.js szerver-kontextuson, ott az a guard hibát dobna.
 *
 * Idempotens naponta egyszer: az LlmBudgetAlert(day) tábla PRIMARY KEY-e
 * garantálja, hogy egy nap alatt akárhányszor is fut le ez a függvény
 * (minden refuse-olt hívás újra meglátja, hogy spent >= ceiling), a
 * ténylegesen elküldött Telegram-üzenet csak egy legyen. A hívónak a napi
 * advisory lock alatt kell futtatnia (l. llm.ts, llm-spend.ts) — külön
 * zárolás itt nincs, nem is kell.
 */
import { sql } from 'drizzle-orm';

type Executable = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

function telegramApiBase(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return token ? `https://api.telegram.org/bot${token}` : null;
}

async function sendTelegramAlert(text: string): Promise<void> {
  const base = telegramApiBase();
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!base || !chatId) return; // nincs provisioning — csendes no-op, mint telegram.ts-ben
  try {
    await fetch(`${base}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    // A riasztás sikertelensége sose dobja el a hívó tranzakciót — a
    // budget-refusal döntés már megtörtént, ez csak egy best-effort értesítés.
    console.error('[llm-budget-alert] Telegram send failed (non-fatal):', err);
  }
}

export async function maybeSendBudgetAlert(
  tx: Executable,
  day: string,
  spentUsd: number,
  ceilingUsd: number,
): Promise<void> {
  const inserted = (await tx.execute(sql`
    INSERT INTO "LlmBudgetAlert" (day) VALUES (${day})
    ON CONFLICT (day) DO NOTHING
    RETURNING day
  `)) as unknown as unknown[];
  if (inserted.length === 0) return; // ma már ment riasztás — ez itt egy ismételt refuse

  await sendTelegramAlert(
    `⚠️ Korruptométer: elérte a napi LLM-költséglimitet ($${spentUsd.toFixed(2)} / $${ceilingUsd.toFixed(2)}).\n\n`
    + 'A mai nap hátralévő részében a bizonytalan cikkek/detektorhívások automatikusan kimaradnak '
    + '(fail-closed — nem téved rá a szitesre semmi ellenőrizetlen), amíg a keret éjfélkor '
    + '(Europe/Budapest) nem resetel.',
  );
}
