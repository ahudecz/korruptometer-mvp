/**
 * Egyetlen kapu MINDEN CourtVerdict-beszúrás elé.
 *
 * Miért külön modul (2026-09-15, user report):
 *
 * A "Jellinek Dániel, Szivek Norbert" és a "Tiborcz István üzlettársa /
 * J. D. és Sz. N." sorok élesbe kerültek, pedig mindkét ember MÁR szerepelt
 * a táblában a saját, nevesített sorával. A gyökérok nem az volt, hogy a
 * dedup rosszul illesztett — hanem hogy két különböző beszúró útvonal van
 * (`detect-verdicts.ts` a cronban és `telegram-review-actions.ts` a kézi
 * beküldésnél), és minden korábbi védőháló-javítás csak az egyikbe került
 * bele, vagy egyáltalán nem jutott élesre. Ezért NE a hívó oldalakon
 * szaporodjanak az if-ek: minden új szabály ide jön, és mindkét út ezt a
 * függvényt hívja.
 *
 * Három, egymástól független jelet néz:
 *
 * 1. GYŰJTŐNÉV / MONOGRAM. A `personName` egyetlen embert azonosít. Ha
 *    monogramot tartalmaz ("J. D. és Sz. N.") vagy "/"-rel több alanyt fűz
 *    össze, az sosem valódi név → eldobjuk. Ha két teljes nevet fűz össze
 *    vesszővel vagy "és"-sel ("Jellinek Dániel, Szivek Norbert"), az
 *    információt tartalmaz, ezért nem dobjuk el, csak emberi jóváhagyásra
 *    küldjük.
 *
 * 2. FORRÁS-URL ÚJRAHASZNÁLÁS. Név-független, determinisztikus jel: ha
 *    ugyanaz a cikk-URL már szerepel egy meglévő sor `sourceUrls` tömbjében,
 *    akkor abból a cikkből már született sor. A 2026-09-15-i duplikátum
 *    URL-je bitre azonos volt a két nevesített soron már meglévő HVG-linkkel
 *    — ez a jel önmagában megfogta volna. NEM dobunk el (egy cikk jogosan
 *    szólhat két emberről), csak jóváhagyásra küldünk.
 *
 * 3. TÖREDÉK-NÉV EGYEZÉS. A normalizált név bármelyik irányban részhalmaza
 *    egy meglévő sor nevének. Ez fogja meg azt is, amikor a gyűjtőnév
 *    TARTALMAZZA a már felvett egyéni nevet.
 *
 * A kapu sosem emel: `approved`-ból csinálhat `pending`-et vagy `discard`-ot,
 * fordítva soha.
 */
import { sql } from 'drizzle-orm';
import { normalizeName } from './watchlist';

type Executable = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

export type VerdictGateVerdict = 'ok' | 'flag' | 'discard';

/**
 * Diszkriminált unió, szándékosan: így a fordító kényszeríti ki, hogy az
 * ELDOBÁS ok-kódja a `CheckReason`-ben is létező érték legyen (a
 * DetectionCheck naplóba az megy be), a jelzés-ágé viszont ne kelljen hogy
 * ott is szerepeljen. Enélkül a hívó oldalon egy tág union csúszna a
 * `markChecked({ reason })` paraméterébe — ezt a hibát egy típusprobe kapta
 * el 2026-09-15-én, mielőtt élesbe ment volna.
 */
export type GateConflict = { id: string; personName: string };

export type VerdictGateResult =
  | { verdict: 'ok' }
  | { verdict: 'discard'; reason: 'initials_name' }
  | {
      verdict: 'flag';
      reason: 'multi_person_name' | 'source_url_reused' | 'fragment_name_match';
      /** Emberi olvasásra: mivel ütközik, hogy a Telegram-üzenet meg tudja mutatni. */
      conflictsWith?: GateConflict | null;
      /**
       * MINDEN megtalált ütközés, nem csak az első.
       *
       * 2026-09-17, user report: a „Jellinek Dániel, Szivek Norberta, és
       * további gyanúsítottak" sor jóváhagyásra ment (a kapu tehát jelzett),
       * de a Telegram-üzenet egyetlen szóval sem árulta el, hogy MINDKÉT
       * nevesített ember külön, már jóváhagyott sorral szerepel a táblában.
       * A user a cikkben szereplő három új, ismeretlen gyanúsított miatt
       * hagyta jóvá — helyesen, a látott információ alapján. A hiba nem a
       * szűrésben volt, hanem abban, hogy a szűrés eredménye nem jutott el
       * odáig, ahol dönteni kell róla.
       */
      conflicts?: GateConflict[];
    };

/**
 * Két vagy több monogram-token ("J. D.", "Sz. N.") — soha nem valódi,
 * publikálható személynév. Egyetlen középső monogram ("Nagy J. Péter")
 * viszont lehet valódi, ezért kettő az alsó határ.
 */
export function hasInitialsTokens(name: string): boolean {
  const tokens = name.match(/(?:^|[\s(])[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]?\.(?=$|[\s,)])/g) ?? [];
  // A rövidített megszólítások/címek ("Dr.", "Id.", "Ifj.", "Özv.", "Prof.")
  // alakilag monogramnak látszanak, de nem azok — enélkül egy "Dr. Kovács P.
  // Béla" tévesen gyűjtőnévnek minősülne és elveszne.
  const HONORIFICS = new Set(['dr', 'id', 'ifj', 'özv', 'prof', 'özvegy']);
  const initials = tokens.filter((t) => !HONORIFICS.has(t.trim().replace(/[.()]/g, '').toLowerCase()));
  return initials.length >= 2;
}

/**
 * A név több alanyt fűz össze: "/" elválasztóval, vagy vesszővel/"és"-sel
 * két olyan részre, amelyek MINDKETTEN önálló, legalább kéttagú névnek
 * néznek ki. A kéttagúság-feltétel fontos: "Szivek Norbert, az MNV volt
 * vezérigazgatója" NEM két ember, csak név + pozíció, azt nem akarjuk
 * eltalálni.
 */
export function isMultiPersonName(name: string): boolean {
  const trimmed = name.trim();
  if (/\s\/\s/.test(trimmed)) return true;

  const parts = trimmed.split(/\s*,\s*|\s+és\s+/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return false;

  const looksLikeFullName = (p: string) => {
    const words = p.split(/\s+/);
    if (words.length < 2 || words.length > 4) return false;
    return words.every((w) => /^[A-ZÁÉÍÓÖŐÚÜŰ][\wáéíóöőúüűÁÉÍÓÖŐÚÜŰ.-]*$/.test(w));
  };
  return parts.filter(looksLikeFullName).length >= 2;
}

/**
 * Melyik táblát védjük, és melyik oszlop hordozza a nevet.
 *
 * `fragmentMatch`: a töredék-név egyezést csak ott kapcsoljuk be, ahol a
 * névoszlop TÉNYLEG egy személyt azonosít. A `CriminalComplaint.targetName`
 * gyakran ügy-címke ("NKA-botrány"), ami szándékosan ismétlődik több soron —
 * ott a töredék-egyezés tömegesen, hamisan jelezne, és a meglévő
 * `findExistingComplaint()` (összeg- és bejelentő-egyeztetéssel) amúgy is
 * sokkal pontosabb. A név-alaki és a forrás-URL jel viszont ott is érvényes.
 */
const GATE_TABLES = {
  CourtVerdict: { nameColumn: 'personName', fragmentMatch: true },
  CriminalComplaint: { nameColumn: 'targetName', fragmentMatch: false },
} as const;

export type GateTable = keyof typeof GATE_TABLES;

/** Létezik-e már sor az adott táblában, amely EBBŐL a cikkből született. */
export async function findRowBySourceUrl(
  db: Executable,
  table: GateTable,
  sourceUrl: string,
): Promise<{ id: string; personName: string } | null> {
  if (!sourceUrl.trim()) return null;
  const rows = (await db.execute(sql`
    SELECT id, ${sql.identifier(GATE_TABLES[table].nameColumn)} AS "personName"
    FROM ${sql.identifier(table)}
    WHERE ${sourceUrl} = ANY("sourceUrls")
    LIMIT 1
  `)) as unknown as Array<{ id: string; personName: string }>;
  return rows[0] ?? null;
}

/**
 * A normalizált név bármelyik irányban részhalmaza egy meglévő sorénak.
 * Az SQL oldal ugyanazt a normalizálást végzi, mint a JS `normalizeName()`
 * (lower + unaccent + írásjel→szóköz), hogy a két oldal ne csússzon szét.
 *
 * Élesben ellenőrizve 2026-09-15-én: a "Jellinek Dániel, Szivek Norbert"
 * kulcsra megtalálja a "Jellinek Dániel" sort (a `key LIKE '%' || existing
 * || '%'` ág illeszt).
 */
export async function findVerdictsByNameFragment(
  db: Executable,
  name: string,
  limit = 5,
): Promise<GateConflict[]> {
  const key = normalizeName(name);
  if (!key || key.length < 4) return [];
  const rows = (await db.execute(sql`
    SELECT id, "personName" FROM "CourtVerdict"
    WHERE "personName" IS NOT NULL AND length(trim("personName")) > 0
      AND (
        trim(regexp_replace(lower(unaccent(trim("personName"))), '[^a-z0-9]+', ' ', 'g')) LIKE '%' || ${key} || '%'
        OR ${key} LIKE '%' || trim(regexp_replace(lower(unaccent(trim("personName"))), '[^a-z0-9]+', ' ', 'g')) || '%'
      )
    LIMIT ${limit}
  `)) as unknown as GateConflict[];
  return rows;
}

/** Visszafelé kompatibilis alak: az első találat vagy null. */
export async function findVerdictByNameFragment(
  db: Executable,
  name: string,
): Promise<GateConflict | null> {
  const rows = await findVerdictsByNameFragment(db, name, 1);
  return rows[0] ?? null;
}

/**
 * Egy gyűjtőnév önálló, teljes névnek látszó darabjai.
 *
 * Miért kell külön: a töredék-egyezés a TELJES sztringgel dolgozik, ami
 * szerencsés esetben illeszt ("…Jellinek Dániel…" LIKE), de nem garantáltan.
 * Ha a gyűjtőnévben elgépelt alak van — a 2026-09-17-i sorban „Szivek
 * Norberta" szerepelt a „Szivek Norbert" helyett —, a teljes sztringre futó
 * illesztés a másik nevet még megtalálja, az elgépeltet viszont csak akkor,
 * ha darabonként is keresünk. Ezért minden darabra külön lefuttatjuk.
 */
export function splitPersonNames(name: string): string[] {
  return name
    .trim()
    .split(/\s*,\s*|\s+és\s+/i)
    .map((p) => p.trim())
    .filter((p) => {
      const words = p.split(/\s+/);
      if (words.length < 2 || words.length > 4) return false;
      return words.every((w) => /^[A-ZÁÉÍÓÖŐÚÜŰ][\wáéíóöőúüűÁÉÍÓÖŐÚÜŰ.-]*$/.test(w));
    });
}

/**
 * A kapu. MINDEN CourtVerdict-beszúrás előtt le kell futnia — a cron-
 * detektorban és a Telegram-beküldésnél egyaránt.
 *
 * `skipDbChecks`-et akkor adj át, ha a hívó már megállapította, hogy ez egy
 * MEGLÉVŐ sor frissítése (findExistingVerdict talált egyezést): ilyenkor a
 * forrás-URL és a töredék-név egyezés nem duplikátum-jel, hanem maga a
 * keresett sor.
 */
export async function gateRowInsert(
  db: Executable,
  table: GateTable,
  input: { personName: string; sourceUrl?: string | null },
): Promise<VerdictGateResult> {
  if (hasInitialsTokens(input.personName)) {
    return { verdict: 'discard', reason: 'initials_name' };
  }

  // 2026-09-17 — ELŐBB gyűjtünk, aztán döntünk. Korábban az első jel
  // azonnal visszatért, és mivel a gyűjtőnév-vizsgálat áll elöl, a
  // duplikátum-keresés a legfontosabb esetben (gyűjtőnév, amely már felvett
  // embereket sorol fel) EL SEM INDULT. A jelzés így tartalom nélkül ment a
  // jóváhagyóhoz: „átnézendő", de hogy mivel ütközik, arról egy szó sem.
  const conflicts: GateConflict[] = [];
  const seen = new Set<string>();
  const add = (rows: GateConflict[]) => {
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      conflicts.push(r);
    }
  };

  if (input.sourceUrl) {
    const bySource = await findRowBySourceUrl(db, table, input.sourceUrl);
    if (bySource) add([bySource]);
  }
  const sourceReused = conflicts.length > 0;

  if (GATE_TABLES[table].fragmentMatch) {
    add(await findVerdictsByNameFragment(db, input.personName));
    // A gyűjtőnév darabjai külön is — l. splitPersonNames().
    for (const part of splitPersonNames(input.personName)) {
      add(await findVerdictsByNameFragment(db, part));
    }
  }

  const multiPerson = isMultiPersonName(input.personName);
  const reason = multiPerson
    ? ('multi_person_name' as const)
    : sourceReused
      ? ('source_url_reused' as const)
      : ('fragment_name_match' as const);

  if (!multiPerson && conflicts.length === 0) return { verdict: 'ok' };
  return {
    verdict: 'flag',
    reason,
    conflictsWith: conflicts[0] ?? null,
    conflicts,
  };
}

/** CourtVerdict-beszúrás kapuja. */
export function gateVerdictInsert(
  db: Executable,
  input: { personName: string; sourceUrl?: string | null },
): Promise<VerdictGateResult> {
  return gateRowInsert(db, 'CourtVerdict', input);
}

/**
 * CriminalComplaint-beszúrás kapuja. A `personName` mezőbe a `targetName`
 * megy (a feljelentés tárgya) — l. GATE_TABLES.
 */
export function gateComplaintInsert(
  db: Executable,
  input: { personName: string; sourceUrl?: string | null },
): Promise<VerdictGateResult> {
  return gateRowInsert(db, 'CriminalComplaint', input);
}

/**
 * FOGVATARTÁS-JEL: kell-e valós fogvatartás egy 'előzetesben' minősítéshez.
 *
 * 2026-09-16, user report: "Pilz Tamás nincs előzetesben, ha valakit
 * kihallgatnak, attól még nem kerül előzetesbe."
 *
 * Az élesre kiment sor (7c275b15) ezt írta ki magáról:
 *   verdictType   = 'előzetesben'
 *   sentenceLabel = 'kihallgatás'
 * Az egyetlen forrás (24.hu, "RTL: Kihallgatták Tuzson Bence volt
 * államtitkárát…") kizárólag gyanúsítotti kihallgatásról szólt. A sor a saját
 * címkéjével CÁFOLTA a saját típusát — ezt egy determinisztikus ellenőrzés
 * elkapja, LLM nélkül.
 *
 * Miért nem elég a prompt: a SYSTEM_PROMPT már eddig is tiltotta ("Ne jelöld,
 * ha csak nyomozás folyik"), mégis átment. Egy prompt-mondat valószínűséget
 * mozgat, nem garanciát ad; ez a függvény garancia.
 *
 * A szabály POZITÍV bizonyítékot követel: 'előzetesben' csak akkor maradhat,
 * ha a szöveg valahol fogvatartásról ír. Kihallgatás, gyanúsítás, beidézés,
 * házkutatás önmagában NEM fogvatartás → a típus 'egyéb'-re esik vissza, ami a
 * VerdictList.tsx-ben (0 év büntetéssel) "ELJÁRÁS ALATT" badge-et ad. A sor
 * tehát nem vész el, csak a szakasza lesz igaz.
 *
 * 2026-09-16 user döntés: az ŐRIZETBE VÉTEL fogvatartásnak számít, tehát
 * megtartja az 'előzetesben' típust — bár jogilag az őrizet (max 72 óra) még
 * nem előzetes letartóztatás, a fogvatartás ténye ugyanaz. A szűkítés csak a
 * tényleges fogvatartás NÉLKÜLI eseteket célozza.
 */
const DETENTION_MARKERS = [
  'letartóztat', 'letartoztat',
  'előzetesbe', 'előzetesben', 'elozetesbe', 'elozetesben',
  'őrizet', 'orizet',
  'fogva tart', 'fogvatart', 'fogdá', 'fogda',
  'bv-intézet', 'bv intézet', 'börtönbe', 'rács mög', 'bilincs',
  'kényszerintézkedés',
] as const;

/** Van-e a szövegben bármi, ami tényleges fogvatartásra utal. */
export function hasDetentionSignal(...parts: Array<string | null | undefined>): boolean {
  const text = parts.filter(Boolean).join(' ').normalize('NFC').toLowerCase();
  if (!text.trim()) return false;
  return DETENTION_MARKERS.some((m) => text.includes(m));
}

/**
 * Visszaminősíti az 'előzetesben' típust 'egyéb'-re, ha a cikkben és a
 * kinyert mezőkben sehol nincs fogvatartás-jel. Minden más típust
 * változatlanul enged át — a kapu sosem emel, csak csökkent.
 *
 * MINDEN CourtVerdict írás előtt le kell futnia (INSERT és lifecycle-UPDATE
 * egyaránt), közvetlenül a coerceVerdictType() után, mindkét beszúró
 * útvonalon — l. a fájl fejlécében a két-útvonalas tanulságot.
 */
export function coercePretrialClaim<T extends string>(
  verdictType: T,
  evidence: {
    sentenceLabel?: string | null;
    summary?: string | null;
    headline?: string | null;
    excerpt?: string | null;
  },
): T | 'egyéb' {
  if (verdictType !== 'előzetesben') return verdictType;
  const ok = hasDetentionSignal(
    evidence.sentenceLabel,
    evidence.summary,
    evidence.headline,
    evidence.excerpt,
  );
  return ok ? verdictType : 'egyéb';
}


/**
 * BÜNTETÉS CSAK ÍTÉLETHEZ.
 *
 * 2026-09-17, user report: „volánbusz másik 5 gyanúsítottja — milyen 5 év?"
 * Az élesre ment sor ezt írta magáról:
 *   verdictType   = 'egyéb'          (gyanúsítotti kihallgatás, nincs ítélet)
 *   sentenceYears = 5                (a listán „5 ÉV"-ként jelent meg)
 *
 * A forráscikkben két „öt" is van: „öt embert hallgatott ki gyanúsítottként"
 * és az ügy „öt éve húzódó" jellege. Hogy a modell melyikből vette, nem
 * rekonstruálható — de nem is kell: büntetés-évet KIZÁRÓLAG ítélet hordozhat.
 * A nyolc típus közül csak az 'elsőfokú' és a 'jogerős' ilyen; a
 * gyanúsítás, a vádemelés, az előzetes, a szabadlábra helyezés, a
 * megszüntetés és a felmentés definíció szerint nem.
 *
 * Ez tehát determinisztikusan eldönthető, LLM nélkül — ugyanaz a logika, mint
 * a coercePretrialClaim()-nél: a kapu sosem emel, csak nullázza azt, aminek
 * ott nem lehet értéke. A sor nem vész el, csak nem állít büntetést.
 *
 * MINDEN CourtVerdict-írás előtt le kell futnia (INSERT és lifecycle-UPDATE
 * egyaránt), mindkét beszúró útvonalon.
 */
const SENTENCEABLE_VERDICT_TYPES = new Set(['elsőfokú', 'jogerős']);

export function coerceSentenceToVerdictType(
  verdictType: string,
  sentence: { sentenceYears?: number | null; sentenceMonths?: number | null },
): { sentenceYears: number; sentenceMonths: number | null } {
  if (SENTENCEABLE_VERDICT_TYPES.has(verdictType)) {
    return {
      sentenceYears: sentence.sentenceYears ?? 0,
      sentenceMonths: typeof sentence.sentenceMonths === 'number' ? sentence.sentenceMonths : null,
    };
  }
  return { sentenceYears: 0, sentenceMonths: null };
}

/**
 * ŐRIZET-JEL (letartóztatás nélkül).
 *
 * 2026-09-16, user kérés: "figyelje a híreket, ha kiengednek olyat aki csak
 * őrizetben van, akkor frissüljön az adat."
 *
 * A két fogvatartási forma élettartama gyökeresen más:
 *   - ŐRIZET: legfeljebb 72 óra. Utána vagy a bíróság rendel el
 *     letartóztatást, vagy az illető KISZABADUL. Egy 'előzetesben' sor tehát
 *     72 óra után szinte biztosan elavult — akkor is, ha egyetlen cikk sem
 *     írt a kiengedésről (a szabadon bocsátás sokkal ritkábban hír, mint az
 *     elfogás).
 *   - LETARTÓZTATÁS: hónapokig tart, meghosszabbítható; itt a hallgatás
 *     nem jelent semmit.
 *
 * Ez a függvény azt mondja meg, hogy egy sor kizárólag őrizetre hivatkozik-e.
 * A check-custody-expiry.ts ezekre a sorokra figyel: ha 72 óra + ráhagyás
 * eltelt és nem jött frissítés, emberi ellenőrzésre küldi. Szándékosan NEM
 * írja át magától 'szabadlábra helyezve'-re: a kiengedés tény, nem
 * következtetés — kitalálni ugyanaz a hiba lenne, mint amit a
 * coercePretrialClaim() az ellenkező irányban javít.
 */
const ARREST_MARKERS = ['letartóztat', 'letartoztat'] as const;

export function isCustodyOnly(...parts: Array<string | null | undefined>): boolean {
  const text = parts.filter(Boolean).join(' ').normalize('NFC').toLowerCase();
  if (!text.includes('őrizet') && !text.includes('orizet')) return false;
  // "a letartóztatásról bíróság dönt" / "letartóztatást kezdeményeztek" —
  // ezek még NEM elrendelt letartóztatások, de a szó szerepel a szövegben.
  // A jövő idejű/indítványozó alakokat kivágjuk, mielőtt a jelenlétet nézzük;
  // enélkül pont a 2026-09-15-i Volánbusz-sorok (amelyek a kérdéses esetek)
  // esnének ki a figyelésből.
  const withoutPending = text
    .replace(/letartóztatás[a-záéíóöőúüű]*\s*(ról|ről)\s+(a\s+)?bíróság\s+dönt/g, '')
    .replace(/letartóztatás[a-záéíóöőúüű]*\s+(kezdeményez|indítványoz)[a-záéíóöőúüű]*/g, '');
  return !ARREST_MARKERS.some((m) => withoutPending.includes(m));
}

/**
 * Az őrizet törvényi maximuma 72 óra. A ráhagyás azért kell, mert a
 * CourtVerdict.verdictDate gyakran a CIKK napja, nem az őrizetbe vétel órája,
 * és a letartóztatásról szóló bírósági döntés híre is csúszhat egy napot —
 * enélkül a figyelő a 72. órában, még a döntés híre előtt riasztana.
 */
export const CUSTODY_MAX_HOURS = 72;
export const CUSTODY_GRACE_HOURS = 24;

export type CustodyRow = {
  id: string;
  personName: string;
  sentenceLabel: string | null;
  summary: string;
  verdictDate: Date | string;
  sourceUrls: string[];
};

/** Eltelt-e a 72 óra + ráhagyás a sor dátuma óta. */
export function isCustodyExpired(verdictDate: Date | string, now: Date = new Date()): boolean {
  const d = verdictDate instanceof Date ? verdictDate : new Date(verdictDate);
  if (Number.isNaN(d.getTime())) return false;
  const hours = (now.getTime() - d.getTime()) / 3_600_000;
  return hours >= CUSTODY_MAX_HOURS + CUSTODY_GRACE_HOURS;
}

/**
 * Melyik 'előzetesben' sorokat kell emberi ellenőrzésre küldeni: kizárólag
 * őrizetre hivatkoznak ÉS letelt a 72 óra + ráhagyás. Az elrendelt
 * letartóztatás sosem kerül ide, akármilyen régi — az hónapokig tart.
 * L. check-custody-expiry.ts.
 */
export function selectExpiredCustodyRows<T extends CustodyRow>(rows: T[], now: Date = new Date()): T[] {
  return rows.filter(
    (r) => isCustodyOnly(r.sentenceLabel, r.summary) && isCustodyExpired(r.verdictDate, now),
  );
}
