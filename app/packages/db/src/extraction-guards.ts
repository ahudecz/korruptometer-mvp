/**
 * KINYERÉS-ŐRÖK — determinisztikus, LLM nélküli ellenőrzések a detektorok
 * kimenetén, közvetlenül a beszúrás előtt.
 *
 * 2026-09-16, a folyamatjavaslat 1–3. pontja. A közös tanulság mind a három
 * mögött ugyanaz, amit a verdict-gate.ts fejléce is rögzít: egy prompt-mondat
 * VALÓSZÍNŰSÉGET mozgat, nem garanciát ad. Ami ellen determinisztikusan
 * védekezni lehet, azt kódban kell elkapni, a prompt MELLETT, nem helyette.
 *
 * Mind a három őr ugyanazt a szerződést tartja: sosem EMEL (approved-ból nem
 * lesz több), csak emberi jóváhagyásra küld. A "pending" itt olcsó: a
 * Telegram-jóváhagyás amúgy is működő, napi használatban lévő útvonal.
 *
 * Tiszta függvények, nincs DB- és hálózati hívás — ezért unit-tesztelhetők,
 * és mindkét beszúró útvonal (cron-detektor + Telegram-beküldés) hívhatja
 * őket, l. [[project-two-insert-paths-guard-gap]].
 */

/** Ékezet- és írásjel-tűrő normalizálás összehasonlításhoz. */
function norm(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[„”«»’'`"]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// ───────────────────────────────────────────────────────────────────────────
// 1. BIZONYÍTÉK-IDÉZET
// ───────────────────────────────────────────────────────────────────────────

/**
 * A detektorok mostantól egy szó szerinti idézetet is kérnek a modelltől
 * arról a mondatról, ami az állítást alátámasztja. Ha ez az idézet NEM
 * szerepel abban a cikkben, amit a modell látott, akkor a modell nem a
 * cikkből dolgozott.
 *
 * Előzmény: a 2026-09-08-i Fásy/NKA-eset, ahol egy CourtVerdict sor dátuma
 * hallucinált volt (aug. 26. a valós szept. 7. helyett), és a personName egy
 * olyan emberre állt, akit a cikk csak a házastársán keresztül említett
 * (l. [[project-fasy-nka-hallucinated-date-2026-09-08]]). Egyik hibát sem
 * lehetett a KIMENETBŐL megállapítani — a forrásszöveghez képest viszont
 * mindkettő azonnal látszik.
 *
 * Az egyezés szándékosan megengedő (normalizált részstring, illetve szó-
 * szintű fedés), mert a modell néha elhagy egy közbevetést vagy máshova tesz
 * egy vesszőt. A cél nem a szó szerinti hűség kikényszerítése, hanem a
 * TELJESEN kitalált idézet elkapása.
 */
export const EVIDENCE_MIN_WORD_OVERLAP = 0.6;

/** Adott-e a modell egyáltalán érdemi idézetet. */
export function hasEvidenceQuote(quote: string | null | undefined): boolean {
  return norm(quote ?? '').length >= 12;
}

export function evidenceQuoteSupported(
  quote: string | null | undefined,
  articleText: string,
): boolean {
  const q = norm(quote ?? '');
  const a = norm(articleText);
  // Üres/túl rövid idézet nem bizonyíték, de nem is cáfolat — ilyenkor nem
  // buktatunk, hogy egy fukar modell-válasz ne küldjön MINDEN sort
  // jóváhagyásra. A hiányzó idézet külön jel, l. hasEvidenceQuote().
  if (q.length < 12 || a.length === 0) return true;
  if (a.includes(q)) return true;

  const qWords = q.split(' ').filter((w) => w.length > 3);
  if (qWords.length === 0) return true;
  const hits = qWords.filter((w) => a.includes(w)).length;
  return hits / qWords.length >= EVIDENCE_MIN_WORD_OVERLAP;
}

// ───────────────────────────────────────────────────────────────────────────
// 2. VISZONYSZÓ-ŐR
// ───────────────────────────────────────────────────────────────────────────

/**
 * Ha a cikk egy nevet KIZÁRÓLAG viszonyszóval említ — "X felesége",
 * "X üzlettársa", "X kabinetfőnöke" —, akkor a hír nem X-ről szól, hanem a
 * hozzá tartozó másik emberről. A 2026-09-08-i eset pontosan ez volt: egy
 * CourtVerdict sor "Fásy Ádám" néven futott, holott csak a felesége
 * kapcsolódott az ügyhöz.
 *
 * A szabály: megkeressük a név MINDEN előfordulását, és megnézzük, hogy
 * mindegyiket közvetlenül viszonyszó követi-e. Ha a cikkben akár egyszer is
 * önállóan szerepel a név, akkor tényleg róla is szól, és nincs miért
 * jóváhagyásra küldeni.
 *
 * TÖVEK, nem teljes szóalakok. A birtokos szerkezet tovább ragozódik, és
 * ilyenkor a tővégi magánhangzó nyúlik: "felesége" → "feleségét". A teljes
 * szóalakra illesztve az őr NÉMÁN sosem talált volna (a teszt írása közben
 * derült ki, élesben észrevétlen maradt volna) — a tő + tetszőleges toldalék
 * viszont mindkét alakot elkapja.
 *
 * A lista a norm()-on is átmegy, hogy a dekomponált (NFD) ékezetes bemenet se
 * csúszhasson el tőle.
 *
 * Szándékosan nincs köztük túl általános tő (pl. "pár", ami a "pártja" szóra
 * is illeszkedne). A téves találat kockázata amúgy alacsony: a tőnek
 * KÖZVETLENÜL a név után kell állnia.
 */
const RELATIONAL_NOUNS = [
  'feleség', 'férj', 'házastárs', 'élettárs', 'nej', 'özvegy',
  'üzlettárs', 'testvér', 'báty', 'öccs', 'nővér', 'húg',
  'fia', 'lány', 'apj', 'anyj', 'édesapj', 'édesanyj', 'szülei',
  'vej', 'meny', 'após', 'anyós', 'sógor', 'unokatestvér', 'rokon',
  'kabinetfőnök', 'munkatárs', 'helyettes', 'tanácsadó', 'ügyvéd',
  'barát', 'barátnő', 'stróman', 'bizalmas', 'szóvivő',
].map(norm);

export function isRelationalOnlyMention(name: string, articleText: string): boolean {
  const n = norm(name);
  const a = norm(articleText);
  if (n.length < 4 || !a.includes(n)) return false;

  let from = 0;
  for (;;) {
    const i = a.indexOf(n, from);
    if (i < 0) break;
    // A birtokos szerkezetben a név ragozódhat ("Fásy Ádám felesége"), ezért
    // a név után legfeljebb egy rövid toldalék + elválasztó fér bele,
    // mielőtt a viszonyszót keressük.
    const after = a.slice(i + n.length, i + n.length + 40);
    // A norm() minden whitespace-t egyetlen szóközre húz, ezért itt elég a
    // szóköz/vessző karakterosztály. Szándékosan NINCS benne backslash-
    // escape: a `\s` template literalben visszaesik sima "s"-re, és a
    // szabály némán sosem illeszkedik (ezen bukott el először).
    // A viszonyszó elé beékelődhet névelő és időjelző ("Hankó Balázs egykori
    // kabinetfőnökét") — enélkül a leggyakoribb valós megfogalmazás kiesne.
    const followedByRelation = RELATIONAL_NOUNS.some((r) =>
      new RegExp(`^[a-záéíóöőúüű]{0,4}[ ,]+(a |az )?((egykori|volt|korábbi|jelenlegi|néhai|leendő) )?${r}`).test(after),
    );
    if (!followedByRelation) return false; // van önálló említés
    from = i + n.length;
  }
  return true;
}

// ───────────────────────────────────────────────────────────────────────────
// 3. "ISMERETLEN TETTES" SZABÁLY
// ───────────────────────────────────────────────────────────────────────────

/**
 * A magyar büntetőeljárásban a feljelentés gyakran ISMERETLEN TETTES ELLEN
 * történik — ez nem hiányos adat, hanem maga a tény. A baj akkor van, ha a
 * modell ilyenkor mégis nevesít valakit: a cikkben szereplő, gyanúba
 * keverhető szereplőt teszi be célpontnak, és így egy konkrét emberre száll
 * rá egy olyan feljelentés, ami kifejezetten NEM ellene szól.
 *
 * A szabály kétirányú:
 *   - ha a cikk ismeretlen tettesről ír, a célpont nem lehet személynév →
 *     emberi jóváhagyásra megy (nem dobjuk el: az ügy-címke, pl.
 *     "NKA-botrány", teljesen jogos célpont ilyenkor);
 *   - a puszta "ismeretlen" mint célpont-név viszont placeholder, azt az
 *     isPlaceholderName() dobja el (detection-check.ts).
 */
/** Szövegrészletek, nem regexek — hogy a norm() (és így az NFC) rájuk is fusson. */
const UNKNOWN_PERPETRATOR_PHRASES = [
  'ismeretlen tettes',
  'ismeretlen elkövet',
  'ismeretlen személy ellen',
  'ismeretlenek ellen',
].map(norm);

export function mentionsUnknownPerpetrator(articleText: string): boolean {
  const a = norm(articleText);
  return UNKNOWN_PERPETRATOR_PHRASES.some((p) => a.includes(p));
}

/**
 * Személynévnek látszik-e a célpont. Két-négy nagybetűvel kezdődő szó,
 * intézményre/ügyre utaló szó nélkül. Szándékosan konzervatív: ami
 * bizonytalan, azt NEM minősítjük személynévnek, tehát nem is buktatjuk.
 */
const NON_PERSON_HINTS = [
  'botrány', 'ügy', 'zrt', 'kft', 'bt.', 'nyrt', 'alapítvány', 'hivatal',
  'minisztérium', 'önkormányzat', 'egyesület', 'párt', 'intézet', 'bank',
  'kórház', 'egyetem', 'iskola', 'tanács', 'bizottság', 'ügynökség',
  'vállalat', 'csoport', 'holding', 'központ', 'szövetség', 'kamara',
].map(norm);

// ───────────────────────────────────────────────────────────────────────────
// RAGOZÁS-VISSZAFEJTÉSI HIBA
// ───────────────────────────────────────────────────────────────────────────

/**
 * A modell rosszul fejtette vissza a magyar ragot a névről.
 *
 * 2026-09-17, user report: „a norberta az mi a pöcs, ilyen hiba hogy mehet át?"
 * Az élesre ment sor „Szivek Norberta" néven futott. A forráscikkben végig
 * TÁRGYESETBEN szerepel a név — „kihallgatásra idézte Szivek Norbertet és
 * Jellinek Dánielt" —, a modellnek tehát alanyesetre kellett visszafejtenie.
 * „Dánielt" → „Dániel" sikerült, „Norbertet" → „Norberta" nem: a szóvégi
 * ragot nem levágta, hanem lecserélte. Ugyanez a hibaosztály gyártotta
 * ugyanabban a sorban az „Ismeretlen bírósága" mezőt is.
 *
 * Miért nem elég a prompt: a ragozás visszafejtése generálási lépés, nem
 * szabálykövetés — egy „alanyesetben add meg" mondat itt is csak
 * valószínűséget mozgat. Determinisztikusan viszont pontosan elkapható,
 * mert a HELYES visszafejtés mindig PREFIXE a cikkbeli alaknak
 * („Norbertet".startsWith("Norbert")), a hibás pedig nem, miközben a közös
 * előtag hosszú marad.
 *
 * Szándékosan NEM dob el és nem javít magától: a javasolt alakot adja vissza,
 * hogy a jóváhagyó üzenet meg tudja mutatni. Kitalálni a helyes nevet
 * ugyanaz a hiba lenne, mint amit elkapni akarunk.
 */
export type MisinflectedName = {
  /** Amit a modell adott: „Szivek Norberta". */
  extracted: string;
  /** Ami a cikkben áll: „Szivek Norbertet". */
  inArticle: string;
  /** A közös előtag — nagy eséllyel a helyes alak: „Szivek Norbert". */
  suggested: string;
};

/** A leghosszabb közös előtag hossza két szó között. */
function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

/**
 * Egyetlen név(rész) ellenőrzése a cikk szövegében.
 *
 * Csak akkor jelez, ha MINDKETTŐ igaz:
 *   - a cikkben a vezetéknév után álló egyik szó sem kezdődik a kinyert
 *     keresztnévvel (tehát nem sima ragozott alak), ÉS
 *   - valamelyik ilyen szóval legalább 4 karakteres közös előtagja van.
 *
 * Ha a név egyáltalán nem szerepel a szövegben, NEM jelez: a kivonat gyakran
 * rövidebb, mint a cikk, és egy „nincs benne" jelzés tömegesen, hamisan
 * riasztana. Ez az őr szűk és nagy pontosságú, nem általános névellenőrző.
 */
export function findMisinflectedName(
  name: string,
  articleText: string,
): MisinflectedName | null {
  const text = norm(articleText);
  if (!text) return null;

  const words = name.trim().split(/\s+/);
  if (words.length < 2) return null;
  const surname = norm(words[words.length - 2] ?? '');
  const given = norm(words[words.length - 1] ?? '');
  if (surname.length < 3 || given.length < 4) return null;

  // A cikkben a vezetéknév után közvetlenül álló szavak.
  const following: string[] = [];
  const re = new RegExp(`${surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+([\\p{L}]+)`, 'gu');
  for (const m of text.matchAll(re)) following.push(m[1]!);
  if (following.length === 0) return null;

  // Helyes visszafejtés: valamelyik cikkbeli alak a kinyert névvel kezdődik.
  if (following.some((w) => w.startsWith(given))) return null;

  let best: { word: string; len: number } | null = null;
  for (const w of following) {
    const len = commonPrefixLength(w, given);
    if (len >= 4 && (best === null || len > best.len)) best = { word: w, len };
  }
  if (!best) return null;

  // A `norm()` kisbetűsít, a visszaadott alakok viszont emberi szemnek
  // mennek (Telegram-üzenet), ezért a kezdőbetűt visszaállítjuk.
  const cap = (w: string) => (w ? w[0]!.toUpperCase() + w.slice(1) : w);
  const original = words.slice(0, -1).join(' ');
  return {
    extracted: name.trim(),
    inArticle: `${original} ${cap(best.word)}`,
    suggested: `${original} ${cap(given.slice(0, best.len))}`,
  };
}

export function looksLikePersonName(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const lower = norm(v);
  if (NON_PERSON_HINTS.some((h) => lower.includes(h))) return false;
  const words = v.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-ZÁÉÍÓÖŐÚÜŰ][\wáéíóöőúüűÁÉÍÓÖŐÚÜŰ.-]*$/.test(w));
}

/**
 * Ellentmond-e a nevesített célpont az "ismeretlen tettes" megfogalmazásnak.
 * Igaz esetén a sor emberi jóváhagyásra megy.
 */
export function namedTargetContradictsUnknownPerpetrator(
  targetName: string,
  articleText: string,
): boolean {
  return mentionsUnknownPerpetrator(articleText) && looksLikePersonName(targetName);
}
