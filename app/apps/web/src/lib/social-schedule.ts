/**
 * Ütemezett Facebook-poszt kiküldés — időpont-számítás.
 *
 * user kérés, 2026-09-11: "olyat tudsz, hogy egyben jönnek telegramra, hogy ne
 * kelljen velük baszakodnom külön, de pár óra csúsztatással küldöd ki akkor is,
 * ha egyben hagyom jóvá?"
 *
 * A jóváhagyás (egyesével VAGY a "Mind jóváhagyom" gombbal) mostantól nem
 * posztol azonnal, hanem IDŐPONTOT AD a sornak (`SocialPostOutbox.scheduledFor`,
 * status='approved'), és a /api/cron/publish-scheduled-social viszi ki, amikor
 * esedékes. A user választása szerint:
 *   - az ELSŐ esedékes poszt azonnal megy (a slot a múltban/most van),
 *   - minden továbbit GAP_HOURS (3 óra) választ el,
 *   - 22:00–08:00 között (Europe/Budapest) SOSE megy ki poszt — ami oda esne,
 *     átcsúszik a következő reggel 8-ra.
 *
 * Itt szándékosan nincs DB-hozzáférés és nincs Date.now() — minden bemenet
 * paraméter, hogy a DST-t és az éjszakai sávot tesztelni lehessen
 * (l. social-schedule.test.ts).
 */

export const GAP_HOURS = 3;
export const QUIET_START_HOUR = 22; // 22:00-tól
export const QUIET_END_HOUR = 8; // 08:00-ig
export const TZ = 'Europe/Budapest';

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Egy UTC-pillanat óra/perc/nap bontása budapesti idő szerint. */
export function localParts(d: Date): LocalParts {
  const parts = Object.fromEntries(
    FORMATTER.formatToParts(d)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;
  // A 24:00 alakot (néhány ICU-verzió éjfélre ezt adja) 0-ra normalizáljuk.
  const hour = parts.hour === 24 ? 0 : (parts.hour ?? 0);
  return {
    year: parts.year ?? 1970,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/** Budapesti idő → UTC eltolás (ms) az adott pillanatban. Nyáron +2h, télen +1h. */
function tzOffsetMs(d: Date): number {
  const p = localParts(d);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - d.getTime();
}

/**
 * Egy budapesti falióra-időpontból UTC Date. Kétlépéses közelítés, mert az
 * eltolás maga is a keresett pillanattól függ (DST-váltás napján számít).
 */
function fromLocal(year: number, month: number, day: number, hour: number): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, 0, 0);
  let guess = new Date(naiveUtc);
  for (let i = 0; i < 2; i++) {
    guess = new Date(naiveUtc - tzOffsetMs(guess));
  }
  return guess;
}

export function isQuietHour(d: Date): boolean {
  const { hour } = localParts(d);
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/**
 * Ha az időpont az éjszakai tiltott sávba esik, a következő reggel 8:00-ra
 * (budapesti idő) tolja. Egyébként változatlanul adja vissza.
 */
export function shiftOutOfQuietHours(d: Date): Date {
  if (!isQuietHour(d)) return d;
  const p = localParts(d);
  if (p.hour < QUIET_END_HOUR) {
    // Hajnal — ugyanaznap reggel 8.
    return fromLocal(p.year, p.month, p.day, QUIET_END_HOUR);
  }
  // Este 22 után — másnap reggel 8. A Date.UTC normalizálja a hónapfordulót.
  const nextDay = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return fromLocal(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate(), QUIET_END_HOUR);
}

/**
 * A következő szabad posztolási idősáv.
 *
 * @param now         a jelenlegi pillanat
 * @param lastSlot    a legutóbb kiosztott (vagy már kiposztolt) időpont, ha van
 * @param gapHours    kötelező szünet két poszt között
 *
 * Ha nincs korábbi poszt, vagy az már régen volt, a visszaadott időpont MOST —
 * ilyenkor a publikáló cron a legközelebbi futásán rögtön kiviszi (a user
 * választása: "az első azonnal, a többi csúsztatva").
 */
export function nextPostSlot(now: Date, lastSlot: Date | null, gapHours: number = GAP_HOURS): Date {
  const earliest = lastSlot ? new Date(lastSlot.getTime() + gapHours * 60 * 60 * 1000) : now;
  const base = earliest.getTime() < now.getTime() ? now : earliest;
  return shiftOutOfQuietHours(base);
}

/**
 * Egy egészben jóváhagyott köteg időpontjai: az elsőt a `lastSlot` szabja meg,
 * onnantól mindegyik az előzőtől számított gapHours múlva, az éjszakai sávot
 * mindig átugorva. A visszaadott tömb hossza mindig `count`.
 */
export function scheduleBatch(now: Date, lastSlot: Date | null, count: number, gapHours: number = GAP_HOURS): Date[] {
  const out: Date[] = [];
  let prev = lastSlot;
  for (let i = 0; i < count; i++) {
    const slot = nextPostSlot(now, prev, gapHours);
    out.push(slot);
    prev = slot;
  }
  return out;
}

const HU_TIME = new Intl.DateTimeFormat('hu-HU', {
  timeZone: TZ,
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Telegram-visszajelzéshez: "szept. 11. 14:00" alakú, budapesti idő. */
export function formatSlot(d: Date): string {
  return HU_TIME.format(d);
}
