import 'server-only';

import { and, eq, isNull, sql } from 'drizzle-orm';

import {
  SECTION_LABELS_HU,
  SECTION_URLS,
  type SubscriptionSection,
} from '@korr/shared/sections';

import { getDb, schema } from '@/lib/db';
import {
  isPublicChannelConfigured,
  sendPublicChannelMessage,
  TELEGRAM_CHANNEL_MIN_GAP_MS,
  TelegramRateLimitError,
} from '@/lib/telegram-public';

/**
 * 012-reader-subscriptions — az olvasói riasztások postaládája (FR-012…FR-027).
 *
 * Ugyanaz a szerződés, mint a notify-auto-publish.ts-é: a rögzítő SOHA nem dob,
 * és soha nem bukhat el tőle a hívó lépése (FR-013). A hívó útvonalán NINCS
 * Telegram-hálózathívás (FR-014) — a posztolás az ütemezett flush dolga.
 */

/** Egy flush-futás legfeljebb ennyi sort dolgoz fel (FR-026). */
export const FLUSH_BATCH_SIZE = 20;

export type SubscriberAlertInput = {
  section: SubscriptionSection;
  /**
   * A rekord azonosítója — KIVÉVE a `watchlist_removal`-t, ahol ez a SZEMÉLY
   * azonosítója. Az oszlop NOT NULL, és a dedup-kulcs belőle származik, ezért
   * a kettőnek egyeznie kell: visszavonáskor a kulcsot ebből építjük újra.
   */
  entityId: string;
  title: string;
  detail?: string | null;
  /**
   * A tétel linkje. Elhagyva a szekció listaoldalára esik vissza
   * (`SECTION_URLS`) — a hat szekcióból ötnek nincs is részletes aloldala.
   */
  url?: string;
  occurredAt?: Date;
};

/**
 * FR-015 — `${section}:${entityId}`, kivéve a `watchlist_removal`-t, ami a
 * személyre kulcsol. Az `applyWatchlistRemoval()` `onConflictDoUpdate({ target:
 * personId })`-ot használ, így egy újra-megnyomás vagy egy visszavonás-majd-
 * újradetektálás különben kétszer riasztana ugyanarra a személyre.
 */
export function buildAlertDedupeKey(section: SubscriptionSection, entityId: string): string {
  if (section === 'watchlist_removal') return `watchlist_removal:person:${entityId}`;
  return `${section}:${entityId}`;
}

export type AlertRow = {
  section: SubscriptionSection;
  title: string;
  detail?: string | null;
  url?: string | null;
};

function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.kegyencjarat.hu').replace(/\/+$/, '');
}

/** Egy relatív útvonalból teljes URL; egy már teljes URL-t változatlanul hagy. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${siteBaseUrl()}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

/**
 * A csatorna-üzenet sima szövege (FR-030, FR-031).
 *
 * A bírósági ítélet és a feljelentés UGYANARRA az oldalra mutat, és csak az
 * ítélet-szekciónak van horgonya — ezért a SZÖVEGNEK kell megmondania,
 * melyikről van szó. Ezt a `SECTION_LABELS_HU` első sora adja meg.
 */
export function formatAlertMessageHu(row: AlertRow): string {
  const label = SECTION_LABELS_HU[row.section];
  const link = absoluteUrl(row.url?.trim() || SECTION_URLS[row.section]);
  return [
    `${label} — új bejegyzés`,
    row.title,
    row.detail?.trim() ? row.detail.trim() : null,
    link,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Egy postaláda-sor rögzítése. Egyetlen beszúrás, `onConflictDoNothing` a
 * dedup-kulcson: ugyanaz a kulcs kétszer nem művelet (FR-015).
 *
 * SOHA nem dob (FR-013), és nem hív Telegramot (FR-014).
 */
export async function recordSubscriberAlert(input: SubscriberAlertInput): Promise<void> {
  try {
    const dedupeKey = buildAlertDedupeKey(input.section, input.entityId);
    await getDb()
      .insert(schema.subscriberAlerts)
      .values({
        section: input.section,
        entityId: input.entityId,
        dedupeKey,
        title: input.title,
        detail: input.detail ?? null,
        url: absoluteUrl(input.url?.trim() || SECTION_URLS[input.section]),
        occurredAt: input.occurredAt ?? new Date(),
      })
      .onConflictDoNothing({ target: schema.subscriberAlerts.dedupeKey });
  } catch (err) {
    // A hívó lépése ettől SOHA nem bukhat el (FR-013).
    console.error('[notify-subscribers] recordSubscriberAlert failed (non-fatal):', err);
  }
}

/**
 * Visszavonás (FR-019). Egy még ki nem posztolt sor ezután nem kerül a
 * csatornára, és egyetlen összefoglalóban sem jelenik meg — a küldés
 * újraszűr a `revokedAt IS NULL`-ra (FR-061).
 *
 * Egy MÁR kiposztolt csatorna-üzenetet ez nem tud visszavonni, egy már
 * kézbesített e-mailt pedig semmi.
 */
export async function revokeSubscriberAlert(
  section: SubscriptionSection,
  entityId: string,
): Promise<void> {
  try {
    const dedupeKey = buildAlertDedupeKey(section, entityId);
    await getDb()
      .update(schema.subscriberAlerts)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.subscriberAlerts.dedupeKey, dedupeKey),
          isNull(schema.subscriberAlerts.revokedAt),
        ),
      );
  } catch (err) {
    console.error('[notify-subscribers] revokeSubscriberAlert failed (non-fatal):', err);
  }
}

type ClaimedRow = {
  id: string;
  section: SubscriptionSection;
  title: string;
  detail: string | null;
  url: string;
};

/**
 * EGY sort foglal le és ad vissza, atomikusan (FR-023).
 *
 * A `channelSentAt`-et az a MONDAT írja, amelyik a sort kiválasztja — soha nem
 * egy későbbi UPDATE. Két párhuzamos futás így ugyanazt a sort nem viheti el,
 * mert a `FOR UPDATE SKIP LOCKED` mondatonként érvényes.
 */
async function claimOneAlert(db: ReturnType<typeof getDb>): Promise<ClaimedRow | null> {
  const rows = (await db.execute(sql`
    UPDATE "SubscriberAlert"
       SET "channelSentAt" = now()
     WHERE id IN (
       SELECT id FROM "SubscriberAlert"
        WHERE "channelSentAt" IS NULL AND "revokedAt" IS NULL
        ORDER BY "occurredAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
    RETURNING id, section, title, detail, url, "occurredAt"
  `)) as unknown as ClaimedRow[];
  return rows[0] ?? null;
}

async function countUnsent(db: ReturnType<typeof getDb>): Promise<number> {
  const rows = (await db.execute(sql`
    SELECT count(*)::int AS n FROM "SubscriberAlert"
     WHERE "channelSentAt" IS NULL AND "revokedAt" IS NULL
  `)) as unknown as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type FlushResult = { sent: number; remaining: number; paused?: true; rateLimited?: true };

/**
 * A postaláda ürítése a nyilvános csatornára.
 *
 * A SORREND itt a lényeg:
 *
 * 1. `TELEGRAM_PUBLIC_CHANNEL_ID` nincs beállítva → `{ sent: 0, paused: true }`,
 *    MIELŐTT bármelyik mondat lefutna. Egyetlen `channelSentAt` sem íródik, minden
 *    sor megmarad egy későbbi futásra (FR-022) — ez a kikapcsoló.
 * 2. Legfeljebb `max` kör, körönként PONTOSAN EGY sor lefoglalása.
 * 3. A lefoglalt sor kiposztolása, majd szünet a percenkénti korlát alatt maradáshoz.
 * 4. Egy 429 megállítja a futást. Minden le nem foglalt sor `channelSentAt IS NULL`
 *    marad, így a következő ütemezett futás onnan folytatja (FR-027).
 *
 * "Foglalj egyet, posztold ki" — SOHA nem "foglald le a húszat, aztán posztold".
 * A kötegelt foglalás mind a húsz sort elküldöttnek jelölné, majd a hibaponttól
 * kezdve mindet elveszítené: tizenkilenccel többet, mint amennyit az FR-024
 * megenged ("azt a riasztást" veszíti el, egyet).
 */
export async function flushSubscriberAlerts(
  opts: { max?: number } = {},
): Promise<FlushResult> {
  if (!isPublicChannelConfigured()) {
    return { sent: 0, remaining: 0, paused: true };
  }

  const max = opts.max ?? FLUSH_BATCH_SIZE;
  const db = getDb();
  let sent = 0;

  for (let i = 0; i < max; i += 1) {
    const row = await claimOneAlert(db);
    if (!row) break;
    try {
      await sendPublicChannelMessage(formatAlertMessageHu(row));
      sent += 1;
    } catch (err) {
      if (err instanceof TelegramRateLimitError) {
        return { sent, remaining: await countUnsent(db), rateLimited: true };
      }
      // Bármely más hiba is megállítja a futást: a már lefoglalt sor elveszik
      // (FR-024 ezt engedi), a többi érintetlen marad.
      console.error('[notify-subscribers] channel post failed:', err);
      return { sent, remaining: await countUnsent(db) };
    }
    if (i < max - 1) await sleep(TELEGRAM_CHANNEL_MIN_GAP_MS);
  }

  return { sent, remaining: await countUnsent(db) };
}

/**
 * Egy publikált rekord olvasónak való címe és részletsora, a saját táblájából.
 *
 * A Telegram-webhook jóváhagyó ágainak csak a rekord azonosítója van a
 * kezében, cím nélkül — ez a függvény olvassa vissza. `null`-t ad, ha a sor
 * időközben eltűnt; a hívó ilyenkor egyszerűen nem rögzít riasztást.
 */
export async function loadAlertSubject(
  section: SubscriptionSection,
  recordId: string,
): Promise<{ title: string; detail: string | null } | null> {
  try {
    const db = getDb();
    if (section === 'resignation') {
      const [row] = await db
        .select({
          name: schema.politicalResignations.name,
          position: schema.politicalResignations.position,
          institution: schema.politicalResignations.institution,
        })
        .from(schema.politicalResignations)
        .where(eq(schema.politicalResignations.id, recordId))
        .limit(1);
      return row
        ? { title: row.name, detail: [row.position, row.institution].filter(Boolean).join(' — ') || null }
        : null;
    }
    if (section === 'media_closure') {
      const [row] = await db
        .select({ name: schema.mediaClosures.name, eventType: schema.mediaClosures.eventType })
        .from(schema.mediaClosures)
        .where(eq(schema.mediaClosures.id, recordId))
        .limit(1);
      return row ? { title: row.name, detail: row.eventType ?? null } : null;
    }
    if (section === 'court_verdict') {
      const [row] = await db
        .select({
          personName: schema.courtVerdicts.personName,
          verdictType: schema.courtVerdicts.verdictType,
          sentenceLabel: schema.courtVerdicts.sentenceLabel,
        })
        .from(schema.courtVerdicts)
        .where(eq(schema.courtVerdicts.id, recordId))
        .limit(1);
      return row
        ? {
            title: row.personName,
            detail: [row.verdictType, row.sentenceLabel].filter(Boolean).join(' — ') || null,
          }
        : null;
    }
    if (section === 'criminal_complaint') {
      const [row] = await db
        .select({
          targetName: schema.criminalComplaints.targetName,
          filerName: schema.criminalComplaints.filerName,
          amountLabel: schema.criminalComplaints.amountLabel,
        })
        .from(schema.criminalComplaints)
        .where(eq(schema.criminalComplaints.id, recordId))
        .limit(1);
      return row
        ? {
            title: row.targetName,
            detail: [row.filerName, row.amountLabel].filter(Boolean).join(' — ') || null,
          }
        : null;
    }
    if (section === 'asset_recovery') {
      const [row] = await db
        .select({
          caseLabel: schema.assetRecoveries.caseLabel,
          description: schema.assetRecoveries.description,
        })
        .from(schema.assetRecoveries)
        .where(eq(schema.assetRecoveries.id, recordId))
        .limit(1);
      return row ? { title: row.caseLabel, detail: row.description ?? null } : null;
    }
    // watchlist_removal: a hívó a SZEMÉLY azonosítóját ismeri, a nevet a
    // WATCH_LIST adja — ezért ezt a szekciót a hívó tölti ki, nem ez a függvény.
    return null;
  } catch (err) {
    console.error('[notify-subscribers] loadAlertSubject failed (non-fatal):', err);
    return null;
  }
}

/**
 * Egy jóváhagyási kimenetből származó rekordokat rögzíti riasztásként.
 *
 * A `ProcessOutcome` egy vagy több sort adhat vissza (`inserted`, `updated`,
 * `inserted_multi`), és a hívónak nincs címe egyikhez sem — a címet a
 * `loadAlertSubject` olvassa vissza.
 */
export async function recordAlertsForRecordIds(
  section: SubscriptionSection,
  recordIds: readonly string[],
): Promise<void> {
  for (const recordId of recordIds) {
    const subject = await loadAlertSubject(section, recordId);
    if (!subject) continue;
    await recordSubscriberAlert({
      section,
      entityId: recordId,
      title: subject.title,
      detail: subject.detail,
      url: section === 'resignation' ? `/lemondasok/${recordId}` : undefined,
    });
  }
}
