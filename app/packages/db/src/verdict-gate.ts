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
export type VerdictGateResult =
  | { verdict: 'ok' }
  | { verdict: 'discard'; reason: 'initials_name' }
  | {
      verdict: 'flag';
      reason: 'multi_person_name' | 'source_url_reused' | 'fragment_name_match';
      /** Emberi olvasásra: mivel ütközik, hogy a Telegram-üzenet meg tudja mutatni. */
      conflictsWith?: { id: string; personName: string } | null;
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
export async function findVerdictByNameFragment(
  db: Executable,
  name: string,
): Promise<{ id: string; personName: string } | null> {
  const key = normalizeName(name);
  if (!key || key.length < 4) return null;
  const rows = (await db.execute(sql`
    SELECT id, "personName" FROM "CourtVerdict"
    WHERE "personName" IS NOT NULL AND length(trim("personName")) > 0
      AND (
        trim(regexp_replace(lower(unaccent(trim("personName"))), '[^a-z0-9]+', ' ', 'g')) LIKE '%' || ${key} || '%'
        OR ${key} LIKE '%' || trim(regexp_replace(lower(unaccent(trim("personName"))), '[^a-z0-9]+', ' ', 'g')) || '%'
      )
    LIMIT 1
  `)) as unknown as Array<{ id: string; personName: string }>;
  return rows[0] ?? null;
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
  if (isMultiPersonName(input.personName)) {
    return { verdict: 'flag', reason: 'multi_person_name' };
  }
  if (input.sourceUrl) {
    const bySource = await findRowBySourceUrl(db, table, input.sourceUrl);
    if (bySource) {
      return { verdict: 'flag', reason: 'source_url_reused', conflictsWith: bySource };
    }
  }
  if (GATE_TABLES[table].fragmentMatch) {
    const byFragment = await findVerdictByNameFragment(db, input.personName);
    if (byFragment) {
      return { verdict: 'flag', reason: 'fragment_name_match', conflictsWith: byFragment };
    }
  }
  return { verdict: 'ok' };
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
