/**
 * Ügyoldal-URL-ek (/adatbazis/<slug>) — javítás és SEO-átnevezés.
 *
 * 2026-09-29: az URL eddig a ScandalCatalog.id ékezet nélküli alakja volt,
 * az id-t viszont egy LLM generálta, és ~290 ügynél hibás lett: elgépelés
 * (`garancsi-kazino`, `matolcsy-mnb-szazmilyardok`, `mager-penzmotas`),
 * értelmetlen szó (`semjen-hun-ren-kutatok-kekvastias`), vagy mást állít,
 * mint az ügy címe. Az id-hez NEM nyúlunk (Investigation.scandalKey,
 * CASE_OVERRIDES, generált tartalom, feljelentések relatedCaseIds mind rá
 * hivatkozik) — csak az URL-t cseréljük:
 *
 *   id ──caseSlug()──▶ URL-slug        (minden link, canonical, sitemap)
 *   URL-slug ──caseIdFromSlug()──▶ id  (az [id] oldal feloldása)
 *
 * A régi slug 308-cal átirányít az újra — l. adatbazis/[id]/page.tsx.
 * Az átnevezési tábla: case-slug-overrides.generated.json, amit a
 * scripts/generate-case-slugs.mts állít elő a ténylegesen megjelenő címből.
 */
import overrides from './case-slug-overrides.generated.json';

const OVERRIDES = overrides as Record<string, string>;
const REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(OVERRIDES).map(([id, slug]) => [slug, id]),
);

/** Ékezetek nélkül (NFD + kombináló jelek törlése) — a korábbi toAsciiId(). */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Az ügy kanonikus URL-slugja (kódolatlan). Minden /adatbazis/ link ezt használja. */
export function caseSlug(id: string): string {
  return OVERRIDES[id] ?? stripAccents(id);
}

/** A teljes, kódolt útvonal: `/adatbazis/<slug>`. */
export function caseHref(id: string): string {
  return `/adatbazis/${encodeURIComponent(caseSlug(id))}`;
}

/** Egy átnevezett slugból visszaadja az ügy id-jét; más slugra null. */
export function caseIdFromSlug(slug: string): string | null {
  return REVERSE[slug] ?? null;
}

// ── Generáláshoz (scripts/generate-case-slugs.mts + teszt) ─────────────────

/** Az URL-ben semmit nem mondó szavak — a címből kimaradnak. */
const FILLER = new Set(['ugy', 'ugye', 'ugyei', 'ugylete', 'ugyelete', 'es', 'a', 'az']);
const MAX_TITLE_WORDS = 5;

function words(s: string): string[] {
  return stripAccents(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Cím → kötőjeles szólista, legfeljebb `max` szó. */
export function slugify(title: string, max = 8): string {
  return words(title).slice(0, max).join('-');
}

/**
 * Ha a cím már megnevezi, miről szól az ügy (eljárás vagy bűncselekmény-
 * típus), a „botrany" nem tesz hozzá semmit — ilyenkor elmarad. Szótő-
 * egyezés, hogy a ragozott alakokat is elkapja (csalas, csalasi, csalasugye).
 */
const DESCRIPTIVE_STEMS = [
  'botrany', 'mutyi', 'per', 'perek', 'nyomozas', 'feljelentes', 'itelet', 'vademeles', 'vizsgalat',
  'csalas', 'sikkasztas', 'penzmosas', 'vesztegetes', 'kenopenz', 'hutlen', 'visszaeles',
  'kartell', 'hamisitas', 'megvesztegetes', 'befolyas',
];

/**
 * Az új URL: `[személy]-<a cím lényege, max 5 szó>[-botrany]`.
 * 2026-09-29, user: a személynevekre és a „botrány" szóra (≈12 000
 * keresés/hó) sokan keresnek — de csak ott, ahol logikus. A személy csak
 * biztos érintettnél kerül bele (l. slugPerson), a „botrany" csak akkor, ha
 * a cím még nem nevezi meg az ügy jellegét (l. DESCRIPTIVE_STEMS).
 */
export function buildCaseSlug(title: string, person: string | null): string {
  // A zárójeles pontosítás (`Kovács Ákos (énekes)`, `Nagy István (Fidesz)`)
  // nem része a névnek.
  const personWords = person ? words(person.replace(/\([^)]*\)/g, ' ')) : [];
  const personSet = new Set(personWords);
  const titleWords = words(title)
    .filter((w) => !FILLER.has(w) && !personSet.has(w))
    .slice(0, MAX_TITLE_WORDS);
  const parts = [...personWords, ...titleWords];
  const descriptive = words(title).some((w) => DESCRIPTIVE_STEMS.some((s) => w === s || (s.length >= 5 && w.startsWith(s))));
  if (!descriptive) parts.push('botrany');
  return parts.join('-');
}

/**
 * Hibás-e egy ügy jelenlegi URL-je? Hibás, ha
 *  - szóközt vagy nagybetűt tartalmaz, vagy
 *  - van benne legalább 4 betűs, számot nem tartalmazó szó, ami SEHOL nem
 *    fordul elő az ügyek címeiben (`corpus`), és nem is ragozott/csonka
 *    alakja egy ottani szónak (közös, legalább 5 betűs szótő).
 * Az utóbbi szűri ki az ártalmatlan ragozási eltéréseket (`moszkva` a
 * „Moszkvai" címnél), miközben elkapja az elgépelést (`kazino` ≠ `kaszino`)
 * és a tartalomtól idegen szót (`kekvastias`).
 */
export function isBadSlug(id: string, corpus: ReadonlySet<string>): boolean {
  if (/\s|[A-Z]/.test(id)) return true;
  const corpusList = [...corpus].filter((w) => w.length >= 5);
  for (const t of stripAccents(id).split('-')) {
    if (t.length < 4 || /\d/.test(t) || corpus.has(t)) continue;
    const related = corpusList.some(
      (w) => (w.startsWith(t) || t.startsWith(w)) && Math.abs(w.length - t.length) <= 3 && Math.min(w.length, t.length) >= 5,
    );
    if (!related) return true;
  }
  return false;
}

export type SlugSource = { id: string; title: string; name: string; person: string | null; institution: string | null };

export type SlugOptions = {
  /** A Google-ben már indexelt ügyek id-jei — ezek JÓ URL-jéhez nem nyúlunk. */
  indexedIds: ReadonlySet<string>;
  /** Ügyek, ahol a `person` mező bizonyítottan téves (person-rollup excludeIds). */
  misattributedIds: ReadonlySet<string>;
};

/**
 * A személynév csak akkor kerül az URL-be, ha az ügy CÍME is említi
 * (vezetéknév), és az ügy nincs a bizonyítottan félreattribuált listán.
 * A `person` mező önmagában nem elég: néha a feltárót tartalmazza (Hadházy
 * Ákos egy általa leleplezett ügynél), néha egy másik NER-szereplőt (a
 * Szijjártó-jachtügynél Mészáros Lőrincet) — egy név + „botrany" URL-ben
 * ez valótlan állítás lenne.
 */
export function slugPerson(r: SlugSource, opts: SlugOptions): string | null {
  if (!r.person || opts.misattributedIds.has(r.id)) return null;
  const surname = words(r.person)[0];
  return surname && words(`${r.title} ${r.name}`).includes(surname) ? r.person : null;
}

/**
 * Átnevezési tábla. Átnevezzük:
 *  - a hibás URL-ű ügyeket (indexelt-e, mindegy — a régi URL 308-cal
 *    átirányít, a Google átviszi), és
 *  - minden még NEM indexelt ügyet, hogy név + „botrany" kerüljön bele
 *    (nincs mit veszíteni rajta).
 * Ütközésnél `-2`, `-3`… utótag.
 */
export function buildSlugOverrides(rows: readonly SlugSource[], opts: SlugOptions): Record<string, string> {
  const corpus = new Set<string>();
  for (const r of rows) {
    for (const w of words(`${r.name} ${r.title} ${r.person ?? ''} ${r.institution ?? ''}`)) corpus.add(w);
  }

  const rename = rows.filter((r) => isBadSlug(r.id, corpus) || !opts.indexedIds.has(r.id));
  const renameIds = new Set(rename.map((r) => r.id));
  const taken = new Set(rows.filter((r) => !renameIds.has(r.id)).map((r) => stripAccents(r.id)));

  const out: Record<string, string> = {};
  for (const r of [...rename].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const base = buildCaseSlug(r.title || r.name, slugPerson(r, opts));
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);
    if (slug !== stripAccents(r.id)) out[r.id] = slug;
  }
  return out;
}
