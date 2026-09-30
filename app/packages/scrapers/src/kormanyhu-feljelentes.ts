import * as cheerio from 'cheerio';
import { httpGet } from './http';

/**
 * kormany.hu/atlathato/feljelentes — a kormány (minisztériumok) saját maguk
 * által tett feljelentéseinek hivatalos, önbevallású listája. User döntés,
 * 2026-08-30: ez az elsődleges forrás a /birosagi-iteletek Feljelentések
 * szekciójában szereplő KORMÁNYZATI bejelentőjű sorokra — a számoknak
 * szóról szóra, számról számra egyezniük kell (l. project-kormanyhu-
 * official-source memória).
 *
 * Nincs API/JSON állapot-blob, mint a kormanyhu.ts hír-adapternél — ez egy
 * kézzel épített, statikus (nem Angular-hidratált) HTML oldal, minden sor
 * egy `<div class="row" data-n="..." data-m="..." ...>` elem, adat-
 * attribútumokban. robots.txt csak a /publicapi-t tiltja (2026-08-30-án
 * ellenőrizve) — ez a statikus oldal nincs tiltva.
 *
 * Direkt HTML-attribútum-parse, NINCS benne LLM-hívás — a napi Anthropic-
 * keretre nulla hatással van (l. feedback-llm-cost-isolation memória).
 */

export type KormanyHuComplaint = {
  name: string;
  ministry: string;
  /** Ft-ban, egész szám; null, ha az oldal nem közöl összeget. */
  amountFt: bigint | null;
  /** Az oldal saját megjelenítési formátuma, pl. "640 milliárd Ft", "825 millió Ft"; null, ha nincs összeg. */
  amountLabel: string | null;
  /** ISO (YYYY-MM-DD), vagy null, ha az oldal "nincs adat"-ot ír. */
  filedDateIso: string | null;
  crimeTypes: string | null;
  status: string | null;
  description: string;
  /** A konkrét kormany.hu/hirek/... cikk, ha van; egyébként az átláthatósági oldal maga. */
  sourceUrl: string;
};

const ATLATHATO_URL = 'https://kormany.hu/atlathato/feljelentes';

function parseAmountFt(rawValue: string, unit: string): bigint {
  const num = parseFloat(rawValue.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(num)) return 0n;
  const multiplier = unit.toLowerCase().startsWith('mrd') ? 1_000_000_000 : 1_000_000;
  return BigInt(Math.round(num * multiplier));
}

function formatAmountLabel(rawValue: string, unit: string): string {
  const unitLabel = unit.toLowerCase().startsWith('mrd') ? 'milliárd Ft' : 'millió Ft';
  return `${rawValue} ${unitLabel}`;
}

// "2026. 07. 23." -> "2026-07-23". Bármi más (pl. "a feljelentés
// időpontjáról nincs adat") -> null.
function parseFiledDate(raw: string): string | null {
  const m = raw.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
}

/** Egy sor, amit nem tudtunk feldolgozni — sosem dobjuk el csendben, a sync Telegramon jelzi. */
export type KormanyHuSkippedRow = { name: string; reason: string };

export type KormanyHuFeljelentesPage = {
  items: KormanyHuComplaint[];
  skipped: KormanyHuSkippedRow[];
  /** Az oldal fejlécében közölt ügyszám ("... 37 ügyben tettek feljelentést"), vagy null, ha nem találjuk. */
  declaredTotal: number | null;
};

// 2026-09-30: a Kovács Katalin Kajak-Kenu Akadémia sorát (nincs összeg, mert
// "a vagyoni hátrány még közelítőleg sem állapítható meg") az összeg-kötelező
// feltétel csendben eldobta, így nálunk 31 ügy volt a kormany.hu 32 sora
// helyett. Összeg nélküli sor érvényes (a feljelentés-táblában 16 ilyen van);
// ami tényleg feldolgozhatatlan, az a `skipped` listába kerül, nem tűnik el.
export function parseKormanyHuFeljelentesPageWithMeta(html: string): KormanyHuFeljelentesPage {
  const $ = cheerio.load(html);
  const out: KormanyHuComplaint[] = [];
  const skipped: KormanyHuSkippedRow[] = [];

  $('.row[data-n]').each((_, el) => {
    const $el = $(el);
    const name = $el.attr('data-n')?.trim();
    const ministry = $el.attr('data-m')?.trim();
    const rawValue = $el.attr('data-v')?.trim();
    const unit = $el.attr('data-unit')?.trim();
    if (!name || !ministry) {
      skipped.push({ name: name || '(név nélkül)', reason: !name ? 'hiányzik a név' : 'hiányzik a minisztérium' });
      return;
    }
    const hasAmount = Boolean(rawValue && unit);

    const description = $el.attr('data-x')?.trim() || name;
    const crimeTypes = $el.attr('data-g')?.trim() || null;
    const status = $el.attr('data-s')?.trim() || null;
    const filedDateRaw = $el.attr('data-d')?.trim() ?? '';

    const caseLink = $el.find('a.case-link').attr('href')?.trim();

    out.push({
      name,
      ministry,
      amountFt: hasAmount ? parseAmountFt(rawValue!, unit!) : null,
      amountLabel: hasAmount ? formatAmountLabel(rawValue!, unit!) : null,
      filedDateIso: parseFiledDate(filedDateRaw),
      crimeTypes,
      status,
      description,
      sourceUrl: caseLink && caseLink.length > 0 ? caseLink : ATLATHATO_URL,
    });
  });

  const text = $('body').text().replace(/\s+/g, ' ');
  const total = text.match(/(\d+)\s+ügyben tettek feljelentést/);
  const declaredTotal = total ? Number(total[1]) : null;

  return { items: out, skipped, declaredTotal };
}

export function parseKormanyHuFeljelentesPage(html: string): KormanyHuComplaint[] {
  return parseKormanyHuFeljelentesPageWithMeta(html).items;
}

export async function fetchKormanyHuFeljelentesPage(): Promise<KormanyHuFeljelentesPage> {
  const html = await httpGet(ATLATHATO_URL);
  return parseKormanyHuFeljelentesPageWithMeta(html);
}

export async function fetchKormanyHuComplaints(): Promise<KormanyHuComplaint[]> {
  return (await fetchKormanyHuFeljelentesPage()).items;
}
