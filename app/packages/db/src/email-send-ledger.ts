/**
 * 012-reader-subscriptions — a napi küldési keret nyilvántartása (FR-048…FR-053).
 *
 * SZÁMLÁLÓ, nem jelölő. Egy sor egy naptári nap, és a `day` MINDIG az
 * adatbázis `current_date`-je (FR-050): az Actions ütemezés UTC, a szerkesztői
 * ritmus budapesti, a szolgáltatói kvóta UTC — egy órának nyernie kell.
 *
 * A `remaining` a `reservedCount`-ot olvassa, SOHA nem a `sentCount`-ot
 * (FR-048): csak a FOGLALÁS korlátozza a párhuzamos küldőket. A `sentCount`
 * kizárólag azért létezik, hogy a napi egészség-ellenőrzés észrevehessen egy
 * foglalás-szivárgást — ez az egyetlen módja, hogy az valaha kiderüljön.
 */
import { sql } from 'drizzle-orm';

import { RESEND_DAILY_LIMIT, RESEND_MONTHLY_LIMIT } from '@korr/shared/email';

type Executable = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

/** Egy nap alatt legfeljebb ennyi ÖSSZEFOGLALÓ mehet ki. */
export const DIGEST_DAILY_SEND_CAP = Number(process.env.DIGEST_DAILY_SEND_CAP ?? 90);

/**
 * A megerősítő levelek félretett kerete a napi összegen belül.
 *
 * Ez a szám a másik felével együtt BIZTONSÁGI korlát, nem átbocsátási
 * beállítás — lásd `SUBSCRIBE_CONFIRM_DAILY_CAP` a
 * `subscriber-confirm-send.ts`-ben.
 */
export const SUBSCRIBE_CONFIRM_RESERVE = Number(process.env.SUBSCRIBE_CONFIRM_RESERVE ?? 10);

/**
 * A mai nap még kiadható összefoglaló-kerete (FR-051).
 *
 * min(DIGEST_DAILY_SEND_CAP, RESEND_DAILY_LIMIT − reservedCount − SUBSCRIBE_CONFIRM_RESERVE)
 */
export async function remainingDigestCapacity(db: Executable): Promise<number> {
  const rows = (await db.execute(sql`
    SELECT "reservedCount" FROM "EmailSendLedger" WHERE day = current_date
  `)) as unknown as Array<{ reservedCount: number }>;
  const reserved = rows[0]?.reservedCount ?? 0;
  return Math.max(
    0,
    Math.min(DIGEST_DAILY_SEND_CAP, RESEND_DAILY_LIMIT - reserved - SUBSCRIBE_CONFIRM_RESERVE),
  );
}

/**
 * Keretfoglalás küldés ELŐTT.
 *
 * A `RETURNING` teszi a foglalást atomivá: a hívó megtudja a saját növelés
 * UTÁNI összeget, és ugyanabban a kérésben adja vissza, ami a korlát fölé ment.
 *
 * A visszaadott érték az, amennyit TÉNYLEGESEN lefoglalt — ez lehet kevesebb a
 * kértnél, és lehet nulla.
 */
export async function reserveSendBudget(db: Executable, want: number): Promise<number> {
  if (want <= 0) return 0;

  const rows = (await db.execute(sql`
    INSERT INTO "EmailSendLedger" (day, "reservedCount")
    VALUES (current_date, ${want})
    ON CONFLICT (day) DO UPDATE
       SET "reservedCount" = "EmailSendLedger"."reservedCount" + EXCLUDED."reservedCount",
           "updatedAt"     = now()
    RETURNING "reservedCount"
  `)) as unknown as Array<{ reservedCount: number }>;

  const afterIncrement = rows[0]?.reservedCount ?? want;
  const ceiling = Math.min(
    DIGEST_DAILY_SEND_CAP + SUBSCRIBE_CONFIRM_RESERVE,
    RESEND_DAILY_LIMIT,
  );
  const over = afterIncrement - ceiling;
  if (over <= 0) return want;

  // A korlát fölötti részt UGYANEBBEN a kérésben adjuk vissza.
  const giveBack = Math.min(over, want);
  await releaseSendBudget(db, giveBack);
  return want - giveBack;
}

/**
 * A foglalás visszaadása egy elutasított vagy elbukott köteg után.
 *
 * E NÉLKÜL egy elbukott köteg VÉGLEG csökkentené a nap kapacitását. Ez az a
 * csökkentés, ami a szivárgást átmenetivé teszi.
 */
export async function releaseSendBudget(db: Executable, n: number): Promise<void> {
  if (n <= 0) return;
  await db.execute(sql`
    UPDATE "EmailSendLedger"
       SET "reservedCount" = GREATEST(0, "reservedCount" - ${n}),
           "updatedAt"     = now()
     WHERE day = current_date
  `);
}

/** Egy sikeres köteg után a ténylegesen kézbesített darabszám. */
export async function recordSent(db: Executable, n: number): Promise<void> {
  if (n <= 0) return;
  await db.execute(sql`
    UPDATE "EmailSendLedger"
       SET "sentCount" = "sentCount" + ${n},
           "updatedAt" = now()
     WHERE day = current_date
  `);
}

/**
 * A hónap még hátralévő kerete (FR-053).
 *
 * KÖTEGENKÉNT értékelendő, nem összefoglalónként: egy `sending` állapotú
 * összefoglaló átléphet egy hónaphatárt.
 */
export async function monthlyRemaining(db: Executable): Promise<number> {
  const rows = (await db.execute(sql`
    SELECT COALESCE(SUM("sentCount"), 0)::int AS n
      FROM "EmailSendLedger"
     WHERE day >= date_trunc('month', current_date)::date
  `)) as unknown as Array<{ n: number }>;
  return Math.max(0, RESEND_MONTHLY_LIMIT - (rows[0]?.n ?? 0));
}

/** A mai sor, a napi egyeztetéshez (FR-076). */
export async function todaysLedger(
  db: Executable,
): Promise<{ reservedCount: number; sentCount: number } | null> {
  const rows = (await db.execute(sql`
    SELECT "reservedCount", "sentCount" FROM "EmailSendLedger" WHERE day = current_date
  `)) as unknown as Array<{ reservedCount: number; sentCount: number }>;
  return rows[0] ?? null;
}
