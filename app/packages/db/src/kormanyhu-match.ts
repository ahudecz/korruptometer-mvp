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

// Generikus korrupciós-ügy/hivatali bürokrata szavak, amik szinte MINDEN
// kormany.hu-tételben és a mi leírásainkban is előfordulnak — 2026-08-30-án
// derült ki élesben, hogy ezek önmagukban átbillenthetik a küszöböt teljesen
// FÜGGETLEN ügyek között (pl. "Kárpát-medencei Tehetséggondozó... állami
// támogatás" ⟷ "FTC Fradiváros-projekt... állami támogatás felhasználása" —
// a KONKRÉT, megkülönböztető szavak (kárpát, medencei, tehetséggondozó,
// fradiváros) egyáltalán nem fedték egymást, mégis a küszöb fölé került a
// két generikus szó (állami, támogatás) miatt). A lista már de-ékezetesített
// formában van, mert normalizeWords az NFD-bontás után ASCII-ra redukál.
// Csak SZÓTÖVEK — a szűrés maga prefix-tudatos (l. wordsOverlap), tehát nem
// kell minden toldalékos alakot felsorolni (pl. "beszerzes" a "beszerzése"/
// "beszerzések"/"beszerzései"-t is kiszűri). "beszerzes" 2026-08-30-án derült
// ki: a "Gondosóra program" hivatalos tétel 3 szavas leírása ("A
// jelzőkészülék-program beszerzése.") a "beszerzése" szón keresztül
// tévesen az OMSZ mentőjármű-sorral matchelt ("mentőjármű-beszerzések"),
// noha a két ügynek semmi köze egymáshoz — mindkettő csak "valamit
// beszereztek" közös, ami a korrupciós-ügy doménben túl általános ahhoz,
// hogy megkülönböztető jel legyen.
const STOPWORD_ROOTS = [
  'allami', 'tamogatas', 'miniszterium', 'miniszterelnokseg',
  'feljelentes', 'miatt', 'ugyeben', 'ugyben', 'ugyet', 'ugye',
  'forint', 'milliard', 'millio',
  'kormany', 'atlathato', 'oldala', 'szerint',
  'gyanu', 'visszaeles', 'hutlen', 'kezeles', 'hivatali',
  'nemzeti', 'magyar', 'szolgalat', 'kozpenz',
  'program', 'projekt', 'tett', 'tette', 'tettek',
  'beszerzes', 'kapcsolatos', 'kapcsolatban', 'erintett',
];

function normalizeWords(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.split(' ').filter((w) => w.length > 3 && !STOPWORD_ROOTS.some((root) => wordsOverlap(root, w)));
}

// Prefix-tolerant equality, NOT exact — magyar toldalékok (kocsi/kocsik) és
// összetett szavak (exim/eximbank) miatt az exact-match túl szigorú lenne
// (2026-08-30, mért: 0.25 pontszám exact-matchcsel egy VALÓS egyezésre,
// ami a duplikátum-védelem szempontjából használhatatlanul alacsony).
// (normalizeWords fentebb hívja ezt — function hoisting miatt ez rendben van.)
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

// Az átláthatósági LISTAOLDAL saját URL-je — kb. a hivatalos tételek fele
// (amihez nincs konkrét kormany.hu/hirek/... cikk) ide esik vissza
// (sourceUrl), és a mi soraink jó része is EZT az URL-t kapta forrásként a
// korábbi kézi egyeztetéskor, ha nem volt konkrét cikk. Ha ezt path-szó-
// egyezésnek engednénk számítani, MINDEN ilyen tétel MINDEN ilyen sorral
// "egyezne" (2026-08-30-i hiba: "Gondosóra program" ellopta az OMSZ-sor
// helyét, mert mindkettő ugyanerre az URL-re mutatott) — a listaoldal saját
// URL-je nulla megkülönböztető jel, nem tartalmaz semmit a konkrét ügyről.
const GENERIC_LISTING_PATH = '/atlathato/feljelentes';

function isGenericListingPath(path: string): boolean {
  return path.replace(/\/+$/, '').toLowerCase() === GENERIC_LISTING_PATH;
}

/** Ugyanaz, de URL-slugokra — a path szegmenseket szóként kezeli. */
export function urlSlugMatchScore(officialUrl: string, candidateUrls: string[]): number {
  let officialPath: string;
  try {
    officialPath = decodeURIComponent(new URL(officialUrl).pathname);
  } catch {
    officialPath = officialUrl;
  }
  if (isGenericListingPath(officialPath)) return 0;
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
    if (isGenericListingPath(candidatePath)) continue;
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

/** Egy összemérhető "hányszorosa a küszöbnek" pontszám a NÉV+leírás hármas
 *  jelből (név-név, teljes szöveg, URL-slug) — a legerősebb számít.
 *
 *  A NÉV-CSAK összevetés külön jelként kell, mert a leírás gyakran sokkal
 *  hosszabb és narratívabb, mint a név (pl. a kormany.hu saját hírcikkei
 *  részletesen indokolnak), ami HÍGÍTJA a szó-átfedés arányt egy egyébként
 *  egyértelmű egyezésnél is (2026-08-30, mért: "Egyiptomi Államvasutak..."
 *  ⟷ "Dunakeszi Járműjavító — egyiptomi vasúti kocsik" — csak név alapján
 *  0.57, teljes szöveggel higítva 0.29, a küszöb (0.3) alatt). A teljes
 *  szöveges összevetés viszont ott segít, ahol a NÉV önmagában túl rövid/
 *  generikus (pl. "Gondosóra program" — a leírásban lévő "jelzőkészülék"
 *  szó adja a megkülönböztető jelet). Egyik jel sem tökéletes, ezért mindig
 *  a legerősebbet vesszük, sose csak az egyiket. */
// Utolsó, durva védőháló: ha a hivatalos név szó szerint (kis/nagybetűtől
// eltekintve) részstringje a mi sorunk nevének, vagy fordítva. Kell, mert
// van olyan hivatalos név (pl. "Támogatással visszaélés"), ami KIZÁRÓLAG a
// STOPWORD_ROOTS-listás generikus korrupciós-doménszavakból áll — a
// normalizeWords mindent kiszűr belőle, a szó-alapú pontszám ezért
// garantáltan 0 marad, MÉG A NÉV NÉV szerinti EGYEZÉSE ESETÉN IS. E nélkül
// ez az egy tétel minden nap újra beszúrásra kerülne (2026-08-30-án derült
// ki, kézi futtatáskor). A hosszküszöb (8 karakter) védi ki, hogy egy
// rövid, félrevezető részlet (pl. "Kft.") ne okozzon véletlen egyezést.
function nameSubstringMatch(officialName: string, candidateName: string): boolean {
  const a = officialName.trim().toLowerCase();
  const b = candidateName.trim().toLowerCase();
  if (a.length < 8 || b.length < 8) return false;
  return b.includes(a) || a.includes(b);
}

export function matchStrength(
  official: { name: string; description: string; url: string },
  candidate: { name: string; description: string; urls: string[] },
): number {
  const nameStrength = textMatchScore(official.name, candidate.name) / TEXT_MATCH_THRESHOLD;
  const fullText = `${official.name} ${official.description}`;
  const candidateFullText = `${candidate.name} ${candidate.description}`;
  const fullStrength = textMatchScore(fullText, candidateFullText) / TEXT_MATCH_THRESHOLD;
  const urlStrength = urlSlugMatchScore(official.url, candidate.urls) / URL_MATCH_THRESHOLD;
  const substringStrength = nameSubstringMatch(official.name, candidate.name) ? 1 : 0;
  return Math.max(nameStrength, fullStrength, urlStrength, substringStrength);
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
 *  "nyomozó" szót tartalmazza, holott épp az ELLENKEZŐJÉT állítja.
 *
 *  "nem indult [nyomozás]" korábban 'elutasítva'-ra volt fordítva — ez hibás
 *  volt (user report, 2026-08-30, Tartalom Előkészítő Osztály-ügy): a "még
 *  nem indult nyomozás" azt jelenti, hogy a feljelentés megtörtént és
 *  folyamatban/függőben van, NEM azt, hogy elutasították. Az 'elutasítva'
 *  státuszhoz explicit elutasítást jelző szó kell (pl. "elutasította",
 *  "elévült", "nem alapos a gyanú") — ilyet a kormany.hu oldal jelenleg nem
 *  használ, ezért itt nincs is rá ág; ha felbukkanna, itt kell felvenni. */
export function mapOfficialStatus(
  officialStatus: string | null,
): 'feljelentés' | 'nyomozás' | 'vádemelés' | 'ítélet' | 'elutasítva' {
  if (!officialStatus) return 'feljelentés';
  const s = officialStatus.toLowerCase();
  if (s.includes('nincs adat') || s.includes('nincs információ')) return 'feljelentés';
  // "nyomozás még nem indult" a "nyomozás" szót is tartalmazza — ennek is meg
  // kell előznie az általános 'nyomozás' kulcsszó-ágat lentebb, különben oda
  // esne, holott épp azt állítja, hogy MÉG NEM indult semmi.
  if (s.includes('nem indult')) return 'feljelentés';
  if (s.includes('elutasította') || s.includes('elévült') || s.includes('nem alapos')) return 'elutasítva';
  if (s.includes('vádemel') || s.includes('vádat emel')) return 'vádemelés';
  if (s.includes('ítélet')) return 'ítélet';
  if (s.includes('nyomozás') || s.includes('nyomozást') || s.includes('elrendel') || s.includes('büntetőeljárás')) return 'nyomozás';
  return 'feljelentés';
}
