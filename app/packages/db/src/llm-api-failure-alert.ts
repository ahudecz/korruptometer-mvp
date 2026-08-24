/**
 * Telegram-riasztás, amikor egy TÉNYLEGES Anthropic API-hívás hibázik
 * (halott kulcs, elfogyott kredit, kvóta-túllépés, hálózati hiba stb.) —
 * NEM ugyanaz, mint a llm-budget-alert.ts: az a mi ÖNKÉNT vállalt napi
 * költséglimitünk elérésekor fut (a hívás el sem indul, $0 költség), ez
 * pedig akkor, amikor a hívás TÉNYLEGESEN elindult és hibával tért vissza.
 * 2026-07-12 óta ismert tünet (kredit kifogyás) — eddig teljesen csendben,
 * csak console.error-ral, senki nem vette észre, amíg a user manuálisan
 * nem ellenőrizte a lemondás-listát (2026-08-23-i eset).
 *
 * Idempotens naponta egyszer, ugyanaz a minta, mint llm-budget-alert.ts-nél
 * (LlmApiFailureAlert(day) PRIMARY KEY + ON CONFLICT DO NOTHING RETURNING).
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
    console.error('[llm-api-failure-alert] Telegram send failed (non-fatal):', err);
  }
}

export async function maybeSendApiFailureAlert(
  db: Executable,
  day: string,
  errorMessage: string,
): Promise<void> {
  const inserted = (await db.execute(sql`
    INSERT INTO "LlmApiFailureAlert" (day, "lastError") VALUES (${day}, ${errorMessage})
    ON CONFLICT (day) DO NOTHING
    RETURNING day
  `)) as unknown as unknown[];
  if (inserted.length === 0) return; // ma már ment riasztás

  await sendTelegramAlert(
    '🔴 Korruptométer: az Anthropic API hívás HIBÁZIK.\n\n'
    + `Hiba: ${errorMessage}\n\n`
    + 'Ez NEM a napi költséglimit — ez egy tényleges API-hiba (leggyakoribb ok: '
    + 'elfogyott a kredit console.anthropic.com-on, vagy hibás/lejárt a kulcs). '
    + 'Amíg ez fennáll, minden AI-alapú detektor (lemondás, ítélet, feljelentés, '
    + 'vagyonvisszaszerzés, médiamegszűnés, watchlist) csendben leáll — a cikkek '
    + 'gyűjtése megy tovább, de semmi nem kerül fel automatikusan az oldalra.',
  );
}
