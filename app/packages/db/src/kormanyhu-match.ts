/**
 * Pure matching helpers for the kormany.hu/atlathato/feljelentes napi
 * egyeztetéshez (sync-kormanyhu-complaints.ts). Két jelből dolgozik, mert
 * egyik önmagában nem elég:
 *
 * 1) Szó-átfedés a névben/leírásban — a legtöbb esetet lefedi (pl. "Egyiptomi
 *    Államvasutak... vasúti kocsi" ⟷ "Dunakeszi Járműjavító — egyiptomi
 *    vasúti kocsik").
 * 2) Forrás-URL slug-átfedés — 2026-08-30-án derült ki: a hivatalos
 *    "Kismotor-megrendelés" tétel forrás-URL-je egy "jatekmotor"-os 24.hu
 *    cikkre mutat, miközben nálunk "Játékmotor-beszerzések" néven szerepelt
 *    ugyanez az ügy — a NÉV-szavak ("kismotor" vs "játékmotor") egyáltalán
 *    nem fedik egymást, de az URL slug igen. Enélkül ez a valós egyezés
 *    kimaradt volna, és egy felesleges duplikátum jött volna létre.
 *
 * Egyik jel sem tökéletes — egy tisztán szemantikai átfedés (pl. Fauszt
 * Zoltán cégei ⟷ Kréta/Neptun/Poszeidon ügye, ahol sem a szavak, sem az
 * URL-ek nem fedik egymást) itt sem lesz felismerve. Ez tudatos kompromisszum:
 * LLM-hívás nélkül (a napi Anthropic-keretre nulla hatás, l.
 * feedback-llm-cost-isolation memória) ez a legjobb, amit egyszerű
 * string-egyeztetéssel el lehet érni — a maradék eseteket a napi Telegram-
 * összefoglaló teszi láthatóvá (l. sync-kormanyhu-complaints.ts), ahol a
 * user egy pillantással ki tudja szűrni, ha valami mégis duplikátum lett.
 */

function normalizeWords(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.split(' ').filter((w) => w.length > 3);
}

// Prefix-tolerant equality, NOT exact — magyar toldalékok (kocsi/kocsik) és
// összetett szavak (exim/eximbank) miatt az exact-match túl szigorú lenne
// (2026-08-30, mért: 0.25 pontszám exact-matchcsel egy VALÓS egyezésre,
// ami a duplikátum-védelem szempontjából használhatatlanul alacsony).
function wordsOverlap(a: string, b: string): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 4 && longer.startsWith(shorter);
}

/** Az official szöveg szavainak hányad része fedezhető fel a candidate szövegében. */
export function textMatchScore(officialText: string, candidateText: string): number {
  const a = normalizeWords(officialText);
  const b = normalizeWords(candidateText);
  if (a.length === 0) return 0;
  let hits = 0;
  for (const w of a) if (b.some((cw) => wordsOverlap(w, cw))) hits++;
  return hits / a.length;
}

/** Ugyanaz, de URL-slugokra — a path szegmenseket szóként kezeli. */
export function urlSlugMatchScore(officialUrl: string, candidateUrls: string[]): number {
  let officialPath: string;
  try {
    officialPath = decodeURIComponent(new URL(officialUrl).pathname);
  } catch {
    officialPath = officialUrl;
  }
  const officialWords = normalizeWords(officialPath.replace(/[/_-]/g, ' '));
  if (officialWords.length === 0) return 0;

  let best = 0;
  for (const candidateUrl of candidateUrls) {
    let candidatePath: string;
    try {
      candidatePath = decodeURIComponent(new URL(candidateUrl).pathname);
    } catch {
      candidatePath = candidateUrl;
    }
    const candidateWords = normalizeWords(candidatePath.replace(/[/_-]/g, ' '));
    let hits = 0;
    for (const w of officialWords) if (candidateWords.some((cw) => wordsOverlap(w, cw))) hits++;
    best = Math.max(best, hits / officialWords.length);
  }
  return best;
}

export const TEXT_MATCH_THRESHOLD = 0.3;
export const URL_MATCH_THRESHOLD = 0.4;

export function isLikelyMatch(
  officialText: string,
  officialUrl: string,
  candidateText: string,
  candidateUrls: string[],
): boolean {
  return (
    textMatchScore(officialText, candidateText) >= TEXT_MATCH_THRESHOLD ||
    urlSlugMatchScore(officialUrl, candidateUrls) >= URL_MATCH_THRESHOLD
  );
}

/** True, ha a bejelentő megnevezése kormányzati/minisztériumi jellegű —
 *  csak ilyen sorokat egyeztetünk a kormany.hu oldallal (harmadik felek
 *  feljelentéseit — Hadházy Ákos, Transparency International, ÁSZ stb. —
 *  nem érinti, l. project-kormanyhu-official-source memória). */
export function looksGovernmentFiled(filerName: string): boolean {
  const n = filerName.toLowerCase();
  return (
    n.includes('minisztérium') ||
    n.includes('miniszterelnökség') ||
    n === 'kormány' ||
    n === 'a kormány' ||
    n.includes('tisza-kormány')
  );
}

/** A kormany.hu oldal szabad szöveges státusza a mi enumunkra fordítva.
 *  Sorrend számít: a "nincs adat/infó" ág MEGELŐZI a "nyomozó" kulcsszó-
 *  keresést, mert "nincs információ A NYOMOZÓ SZERV eljárásáról" magát a
 *  "nyomozó" szót tartalmazza, holott épp az ELLENKEZŐJÉT állítja. */
export function mapOfficialStatus(
  officialStatus: string | null,
): 'feljelentés' | 'nyomozás' | 'vádemelés' | 'ítélet' | 'elutasítva' {
  if (!officialStatus) return 'feljelentés';
  const s = officialStatus.toLowerCase();
  if (s.includes('nincs adat') || s.includes('nincs információ')) return 'feljelentés';
  if (s.includes('nem indult')) return 'elutasítva';
  if (s.includes('vádemel') || s.includes('vádat emel')) return 'vádemelés';
  if (s.includes('ítélet')) return 'ítélet';
  if (s.includes('nyomozás') || s.includes('nyomozást') || s.includes('elrendel') || s.includes('büntetőeljárás')) return 'nyomozás';
  return 'feljelentés';
}
