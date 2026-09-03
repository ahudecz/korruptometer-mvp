import 'server-only';

import { randomBytes } from 'node:crypto';

import { SECTION_LABELS_HU, type SubscriptionSection } from '@korr/shared/sections';

/**
 * 012-reader-subscriptions — az összefoglaló piszkozatának felépítése
 * (FR-056…FR-059, FR-073).
 *
 * TISZTA függvény: az adatbázis-olvasás és a költségkapu is ARGUMENTUMKÉNT
 * érkezik, hogy a teszt egy elutasító kaput tudjon beinjektálni. Ez az egyetlen
 * módja, hogy az FR-058 bizonyítható legyen — "a költségvetési elutasítás SOHA
 * nem nyomhat el egy összefoglalót".
 */

/** Ennyi tétel alatt nem épül piszkozat, kivéve a lentebbi két felmentést. */
export const DIGEST_MIN_ITEMS = Number(process.env.DIGEST_MIN_ITEMS ?? 3);
/** Ennyi nap után a padló akkor is felold, ha kevés a tétel. */
export const DIGEST_REENGAGE_DAYS = 21;
/** Egy összefoglaló EGYSZER generálható újra (FR-056, FR-072). */
export const DIGEST_MAX_REGEN = 1;
/**
 * A gomb-adatba kerülő rövid azonosító hossza.
 *
 * `randomBytes(6).toString('base64url')` → 8 karakter, tehát a `dg:a:{code}`
 * 13 bájt a Telegram 64 bájtos `callback_data` korlátjából. ÚJ gomb-adatba
 * SOHA nem kerül teljes rekord-azonosító.
 */
export const DIGEST_CODE_CHARS = 8;
/**
 * A meglévő legszorosabb eset: `a:wc:{personId}.{articleId}`. Egy rögzítő
 * teszt szegezi le, hogy a `WATCH_LIST` egyetlen azonosítója sem hosszabb.
 */
export const WATCHLIST_ID_MAX = 22;

/** A hat szekcióból bármelyik kettő önmagában felment a padló alól (FR-057). */
const FLOOR_EXEMPT_SECTIONS: ReadonlySet<SubscriptionSection> = new Set([
  'watchlist_removal',
  'court_verdict',
]);

export type DigestItem = {
  id: string;
  section: SubscriptionSection;
  title: string;
  detail: string | null;
  url: string;
  occurredAt: Date;
};

/**
 * A költségkapu. `allowed: false` esetén a piszkozat sablonos törzzsel készül
 * el, egy megjegyzéssel arról, hogy az összegzés elmaradt — de ELKÉSZÜL.
 */
export type SpendGate = () => Promise<{ allowed: boolean }>;

/** Az összefoglaló szövegét előállító, opcionális nyelvi modell. */
export type SummaryWriter = (items: DigestItem[]) => Promise<string | null>;

export type DigestDraft = {
  code: string;
  cadence: 'weekly';
  periodStart: Date;
  periodEnd: Date;
  alertIds: string[];
  subjectHu: string;
  bodyHtml: string;
  bodyText: string;
};

/**
 * A jóváhagyó üzenet gombjai.
 *
 * Itt van, és nem a `digest-draft.ts`-ben, mert a Telegram-webhook route is
 * használja az újragenerálás után — az pedig nem importálhat Inngest-függvényt
 * tartalmazó modult, mert az `inngest.createFunction` már a modul betöltésekor
 * lefutna egy kérés útvonalán.
 */
export function approvalKeyboard(code: string): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  return {
    inline_keyboard: [
      [
        { text: '✅ Kimehet', callback_data: `dg:a:${code}` },
        { text: '🗑️ Elvetem', callback_data: `dg:x:${code}` },
      ],
      [{ text: '🔄 Újragenerálás', callback_data: `dg:r:${code}` }],
    ],
  };
}

/** Új, nyolc karakteres rövid azonosító. */
export function newDigestCode(): string {
  return randomBytes(6).toString('base64url');
}

/**
 * Nyit-e a padló (FR-057)?
 *
 * Három feltétel, bármelyik elég: elég sok tétel; VAGY van köztük
 * tisztségviselő-eltávolítás vagy bírósági ítélet; VAGY eltelt
 * `DIGEST_REENGAGE_DAYS` az utolsó küldés óta.
 */
export function passesFloor(items: DigestItem[], lastSentAt: Date | null, now: Date): boolean {
  if (items.length === 0) return false;
  if (items.length >= DIGEST_MIN_ITEMS) return true;
  if (items.some((i) => FLOOR_EXEMPT_SECTIONS.has(i.section))) return true;
  if (!lastSentAt) return true;
  const days = (now.getTime() - lastSentAt.getTime()) / (24 * 60 * 60_000);
  return days >= DIGEST_REENGAGE_DAYS;
}

function groupBySection(items: DigestItem[]): Array<[SubscriptionSection, DigestItem[]]> {
  const bySection = new Map<SubscriptionSection, DigestItem[]>();
  for (const item of items) {
    const list = bySection.get(item.section) ?? [];
    list.push(item);
    bySection.set(item.section, list);
  }
  return [...bySection.entries()];
}

const SKIPPED_SUMMARY_NOTE =
  'Az összegzés ezúttal elmaradt — a lista alatta hiánytalan.';

/** A sablonos, nyelvi modell nélküli törzs. Ez soha nem bukhat el. */
export function renderTemplateBody(
  items: DigestItem[],
  opts: { summary?: string | null; resumeDay?: number; unsubscribeUrl?: string } = {},
): { text: string; html: string } {
  const textLines: string[] = [];
  const htmlParts: string[] = [];

  if (opts.resumeDay && opts.resumeDay > 1) {
    // FR-067 — egy később érkező részlet MEGMONDJA magáról, hogy késve jött.
    const line = `Ez a levél a heti összefoglaló ${opts.resumeDay}. napi részlete — a küldés több napra oszlik.`;
    textLines.push(line, '');
    htmlParts.push(`<p><em>${line}</em></p>`);
  }

  if (opts.summary === null) {
    textLines.push(SKIPPED_SUMMARY_NOTE, '');
    htmlParts.push(`<p><em>${SKIPPED_SUMMARY_NOTE}</em></p>`);
  } else if (opts.summary) {
    textLines.push(opts.summary, '');
    htmlParts.push(`<p>${opts.summary}</p>`);
  }

  for (const [section, sectionItems] of groupBySection(items)) {
    const label = SECTION_LABELS_HU[section];
    textLines.push(label.toUpperCase(), '');
    htmlParts.push(`<h2>${label}</h2>`, '<ul>');
    for (const item of sectionItems) {
      const detail = item.detail?.trim() ? ` — ${item.detail.trim()}` : '';
      textLines.push(`· ${item.title}${detail}`, `  ${item.url}`);
      htmlParts.push(`<li><a href="${item.url}">${item.title}</a>${detail}</li>`);
    }
    textLines.push('');
    htmlParts.push('</ul>');
  }

  if (opts.unsubscribeUrl) {
    textLines.push('—', `Leiratkozás: ${opts.unsubscribeUrl}`, 'Kegyencjárat · hello@kegyencjarat.hu');
    htmlParts.push(
      '<hr />',
      `<p style="color:#5c5e62;font-size:13px"><a href="${opts.unsubscribeUrl}">Leiratkozás</a> · `
        + 'Kegyencjárat · <a href="mailto:hello@kegyencjarat.hu">hello@kegyencjarat.hu</a></p>',
    );
  }

  return { text: textLines.join('\n'), html: htmlParts.join('\n') };
}

/** A tárgy sora. Nem tartalmaz olvasótól származó szöveget. */
export function digestSubject(items: DigestItem[], periodEnd: Date): string {
  const date = periodEnd.toISOString().slice(0, 10);
  return `Kegyencjárat — ${items.length} új tétel (${date})`;
}

/**
 * A piszkozat felépítése, vagy `null`, ha a padló nem nyit.
 *
 * ⚠️ A KÖLTSÉGKAPU ELUTASÍTÁSA SOHA NEM AD `null`-T (FR-058). Elutasításkor a
 * törzs sablonos lesz, egy megjegyzéssel, hogy az összegzés elmaradt — az
 * összefoglaló KIMEGY. Ezt egy beinjektált, elutasító kapuval mért teszt
 * bizonyítja.
 */
export async function buildDigestDraft(input: {
  items: DigestItem[];
  periodStart: Date;
  periodEnd: Date;
  lastSentAt: Date | null;
  now?: Date;
  spendGate?: SpendGate;
  writeSummary?: SummaryWriter;
}): Promise<DigestDraft | null> {
  const now = input.now ?? new Date();
  const items = [...input.items].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  if (!passesFloor(items, input.lastSentAt, now)) return null;

  let summary: string | null = null;
  const gate = input.spendGate;
  const allowed = gate ? (await gate()).allowed : true;
  if (allowed && input.writeSummary) {
    try {
      summary = await input.writeSummary(items);
    } catch {
      // Egy modellhiba sem nyomhat el egy összefoglalót.
      summary = null;
    }
  }

  const { text, html } = renderTemplateBody(items, { summary });

  return {
    code: newDigestCode(),
    cadence: 'weekly',
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    alertIds: items.map((i) => i.id),
    subjectHu: digestSubject(items, input.periodEnd),
    bodyHtml: html,
    bodyText: text,
  };
}
