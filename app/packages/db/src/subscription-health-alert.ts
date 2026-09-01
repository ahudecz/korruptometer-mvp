/**
 * 012-reader-subscriptions — a feliratkozási egészség-ellenőrzés napi jelölője
 * és szívverése (FR-075, FR-078).
 *
 * KÉT MEZŐ, EGY SOR, és a szétválasztás teherviselő:
 *
 * - `lastRunAt` a SZÍVVERÉS. Minden futásnál íródik, akkor is, ha semmi baj
 *   nincs — különben egy egészséges időszak megkülönböztethetetlen lenne egy
 *   leállt őrkutyától.
 * - `alertedAt` a NAPI EGYSZERI riasztás-jelölő. Csak akkor íródik, amikor
 *   tényleg ment üzenet.
 *
 * Egy `DO NOTHING` jelölő nem tudja mindkettőt kiszolgálni: a feltétel nélküli
 * szívverés-írás elfoglalná a nap sorát, és a riasztás aznap soha többé nem
 * tüzelne. Ezért `lastReason` NULLOZHATÓ.
 *
 * KÜLÖN TÁBLA a `LlmApiFailureAlert`-től (FR-075): egy közös táblában egy
 * LLM-riasztás elnyomná az egész napra a feliratkozási riasztást, és épp az a
 * hathetes csend, ami a `LlmApiFailureAlert`-et létrehozta, az a hiba, ami
 * ellen ez a tábla készült.
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
  if (!base || !chatId) return; // nincs provisioning — csendes no-op
  try {
    await fetch(`${base}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error('[subscription-health-alert] Telegram send failed (non-fatal):', err);
  }
}

/**
 * A SZÍVVERÉS. Minden futásnál, feltétel nélkül.
 *
 * A `MAX("lastRunAt")` MINDEN soron olvasandó, sosem csak a mai soron: a 26
 * órás küszöb szándékosan átnyúlik egy napváltáson.
 */
export async function recordHealthRun(db: Executable): Promise<Date | null> {
  const previous = (await db.execute(sql`
    SELECT MAX("lastRunAt") AS "lastRunAt" FROM "SubscriptionHealthAlert"
  `)) as unknown as Array<{ lastRunAt: Date | string | null }>;

  await db.execute(sql`
    INSERT INTO "SubscriptionHealthAlert" (day, "lastRunAt")
    VALUES (current_date, now())
    ON CONFLICT (day) DO UPDATE SET "lastRunAt" = now()
  `);

  const raw = previous[0]?.lastRunAt ?? null;
  if (!raw) return null;
  return raw instanceof Date ? raw : new Date(raw);
}

/**
 * A napi egyszeri riasztás.
 *
 * A nap jelölőjét egy FELTÉTELES UPDATE foglalja le. Az üzenet CSAK akkor megy
 * ki, ha az visszaad egy sort — így két egyszerre tüzelő feltétel is pontosan
 * egy üzenetet eredményez.
 */
export async function maybeSendHealthAlert(db: Executable, reason: string): Promise<boolean> {
  const claimed = (await db.execute(sql`
    UPDATE "SubscriptionHealthAlert"
       SET "alertedAt" = now(), "lastReason" = ${reason}
     WHERE day = current_date AND "alertedAt" IS NULL
    RETURNING day
  `)) as unknown as unknown[];
  if (claimed.length === 0) return false; // ma már ment riasztás

  await sendTelegramAlert(
    '🔴 Korruptométer: az olvasói értesítések elakadtak.\n\n'
    + `Ok: ${reason}\n\n`
    + 'Ez a feature semmilyen hibát nem dob, amikor leáll — a Sentry és a Better Stack '
    + 'a kivételeket látja, azt nem, hogy "nem történt semmi". Ez az üzenet az egyetlen jel.',
  );
  return true;
}
