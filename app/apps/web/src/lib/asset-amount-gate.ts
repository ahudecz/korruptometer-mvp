import 'server-only';
import { sql } from 'drizzle-orm';

import { lookupAmount, parseHufAmounts, type SourceText } from '@korr/db';
import { fetchArticleBodyTransient } from '@korr/scrapers';

import { getDb } from '@/lib/db';
import { sendTelegramMessage, type InlineKeyboardMarkup } from '@/lib/telegram';

/**
 * ÖSSZEG-KAPU A VAGYONVISSZASZERZÉS-SOROKHOZ.
 *
 * User szabály, 2026-09-21: pénzügyi sor nem születhet szám nélkül, és ha a
 * cikkből hiányzik, akkor se a szerkesztő keresgéljen — előbb a rendszer
 * nézze végig a cikkek TELJES szövegét, és csak ha úgy sincs meg, akkor
 * kérdezzen, GOMBOKKAL: „szerinted szöveges válaszokat fejben tartok?
 * építsd meg a gombokat."
 *
 * Miért külön modul: két beszúró útvonal van (a cron-detektor és a
 * Telegram-beküldés), és a projekt tanulsága szerint minden ilyen szabály,
 * ami csak az egyikbe kerül bele, előbb-utóbb kilyukad a másikon
 * ([[project-two-insert-paths-guard-gap]]). Ezért a keresés, az üzenet és a
 * gombok is EGY helyen élnek.
 */

/** Hány kapcsolódó cikk törzsét töltjük le legfeljebb. */
const MAX_ARTICLES = 4;

/**
 * A hiányzó összeg megkeresése a cikkek teljes szövegéből.
 *
 * 1. a forráscikk törzse, 2. az ugyanarról az ügyről szóló cikkek törzse.
 * A választás a money-lookup.ts szabályai szerint történik (forint, a
 * kár/visszafizetés kulcsszavak közelében, a devizás alakok nélkül).
 */
export async function lookupMissingAmountFt(
  caseLabel: string,
  primaryUrl: string | null,
): Promise<{ ft: number; raw: string; url: string } | null> {
  const db = getDb();
  // Az ügycímke leghosszabb szavai adják a keresőkulcsot — ugyanaz a
  // cikkhalmaz, ami az ügyoldal „Kapcsolódó hírek" blokkjában is megjelenik.
  const key = caseLabel
    .split(/\s+/)
    .filter((w) => w.length > 5)
    .slice(0, 2)
    .join(' ')
    .toLowerCase();

  const related = key
    ? ((await db.execute(sql`
        SELECT "sourceUrl" FROM "NewsArticle"
        WHERE lower(unaccent(headline || ' ' || excerpt)) LIKE '%' || unaccent(${key}) || '%'
        ORDER BY "publishedAt" DESC
        LIMIT ${MAX_ARTICLES}
      `)) as unknown as Array<{ sourceUrl: string }>)
    : [];

  const urls = [primaryUrl, ...related.map((r) => r.sourceUrl)]
    .filter((u): u is string => Boolean(u))
    .filter((u, i, all) => all.indexOf(u) === i)
    .slice(0, MAX_ARTICLES + 1);

  const sources: SourceText[] = [];
  for (const url of urls) {
    sources.push({ url, text: await fetchArticleBodyTransient(url) });
  }
  const found = lookupAmount(sources);
  return found.found ? { ft: found.ft, raw: found.raw, url: found.url } : null;
}

/**
 * A szerkesztő által BEGÉPELT összeg értelmezése.
 *
 * Azért nem a money-lookup parserét hívjuk közvetlenül, mert ott a „forint"
 * vagy „Ft" szó kötelező (cikkszövegben az a megbízható jel). Egy válaszban
 * viszont a „126 milliárd" a természetes alak — itt tehát a mértékegység
 * elhagyható, de a puszta szám is elfogadott („126000000000").
 */
export function parseAmountReply(text: string): number | null {
  const t = (text ?? '').trim();
  if (!t) return null;

  // A `\s` a JS-ben a nem törhető szóközt (U+00A0) is lefedi, ezért nem kell
  // külön felsorolni — a szövegbe illesztett literál NBSP ráadásul
  // lint-hibát adott (no-irregular-whitespace).
  const withUnit = t.match(/(\d[\d\s.,]*)\s*(ezer|milli[óo]|milli[áa]rd|billi[óo])/iu);
  if (withUnit) {
    const n = Number((withUnit[1] ?? '').replace(/[\s.]/g, '').replace(',', '.'));
    const mult: Record<string, number> = {
      ezer: 1e3, millió: 1e6, millio: 1e6, milliárd: 1e9, milliard: 1e9, billió: 1e12, billio: 1e12,
    };
    const m = mult[(withUnit[2] ?? '').toLowerCase()];
    if (Number.isFinite(n) && n > 0 && m) return Math.round(n * m);
  }

  const viaCorpusParser = parseHufAmounts(t)[0];
  if (viaCorpusParser) return Math.round(viaCorpusParser.ft);

  const plain = Number(t.replace(/[\s.]/g, '').replace(',', '.'));
  return Number.isFinite(plain) && plain > 0 ? Math.round(plain) : null;
}

/** A gombok callback-adata: `am:<kód>:<articleId>`. */
export const AMOUNT_CALLBACK_PREFIX = 'am';

/**
 * A kérdés, gombokkal. A szövegben SZÁNDÉKOSAN benne marad a cikk URL-je: a
 * „Beírom az összeget" ág a válaszüzenetből ebből azonosítja vissza a cikket,
 * így nem kell se új tábla, se új oszlop a függő kérdés tárolásához.
 */
export async function notifyMissingAmount(input: {
  caseLabel: string;
  articleId: string;
  articleUrl: string | null;
  triedUrls?: readonly string[];
}): Promise<void> {
  const { caseLabel, articleId, articleUrl } = input;
  const text = [
    '⚠️ VAGYONVISSZASZERZÉS — NINCS ÖSSZEG, a sor NEM jött létre',
    caseLabel,
    'Végignéztem a forráscikk és a kapcsolódó cikkek teljes szövegét, egyikben sem találtam forintösszeget.',
    articleUrl ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: '✍️ Beírom az összeget', callback_data: `${AMOUNT_CALLBACK_PREFIX}:w:${articleId}` }],
      [{ text: '📤 Mehet szám nélkül', callback_data: `${AMOUNT_CALLBACK_PREFIX}:n:${articleId}` }],
      [{ text: '📰 Csak hírbe', callback_data: `n:x:${articleId}` }],
      [{ text: '🗑️ Elvetés', callback_data: `${AMOUNT_CALLBACK_PREFIX}:x:${articleId}` }],
    ],
  };

  await sendTelegramMessage(text, keyboard);
}
