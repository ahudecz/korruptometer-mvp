import { and, desc, eq, like, or, type SQL } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

/**
 * Egy ügy kényszerintézkedései a KÖZÖS CourtVerdict táblából — ugyanabból,
 * amiből a /birosagi-iteletek ("Börtönben van-e?") oldal dolgozik.
 *
 * Miért így (user kérés, 2026-09-15): ne két kézzel karbantartott lista
 * legyen. Ha egy új NKA-s letartóztatás bekerül a CourtVerdict táblába (a
 * detektor vagy a Telegram-jóváhagyás útján), akkor AUTOMATIKUSAN megjelenik
 * a "Börtönben van-e?" oldalon ÉS az ügy SEO-aloldalán is.
 */
export type CaseDetentionRow = {
  id: string;
  personName: string;
  position: string;
  verdictType: string;
  verdictDate: Date;
  crimes: string[];
  court: string;
  sourceName: string | null;
  sourceUrl: string | null;
};

/**
 * FIGYELEM — a csupa nagybetűs rövidítéseket (NKA, MNB) kis-nagybetű
 * ÉRZÉKENY LIKE-kal kell keresni, nem ILIKE-kal: az "NKA" ILIKE-kal
 * beletalál a "munka", "munkát", "utazásunkat" szavakba is, mert a magyar
 * -unk/-unka toldalék épp erre végződik. Ugyanaz a hibaosztály, amit az
 * /ugyek/[id]/page.tsx matchKeyword() függvénye is kezel — ott van a
 * részletes magyarázat.
 */
function acronymMatch(column: Parameters<typeof like>[0], kw: string): SQL {
  return like(column, `%${kw}%`);
}

export async function loadCaseDetentions(opts: {
  /** CourtVerdict.personUgyId — a kanonikus kapcsolat az ügyhöz. */
  ugyId: string;
  /** Biztonsági háló azokra a sorokra, amelyekre a detektor nem tette rá az
   *  ügy-azonosítót (2026-09-15-én 9-ből 1 ilyen volt). Csupa nagybetűs
   *  rövidítés legyen. */
  acronym?: string;
}): Promise<CaseDetentionRow[]> {
  const db = getDb();
  const v = schema.courtVerdicts;

  const conds: SQL[] = [eq(v.personUgyId, opts.ugyId)];
  if (opts.acronym) {
    conds.push(acronymMatch(v.summary, opts.acronym));
    conds.push(acronymMatch(v.position, opts.acronym));
    conds.push(acronymMatch(v.personName, opts.acronym));
  }

  try {
    const rows = await db
      .select({
        id: v.id,
        personName: v.personName,
        position: v.position,
        verdictType: v.verdictType,
        verdictDate: v.verdictDate,
        crimes: v.crimes,
        court: v.court,
        sourceNames: v.sourceNames,
        sourceUrls: v.sourceUrls,
      })
      .from(v)
      // Csak a jóváhagyott sorok — ugyanaz a szűrő, mint a /birosagi-iteletek
      // oldalon; a 'pending' sorok ott sem látszanak (2026-09-15-én pont egy
      // duplikált Fásyné-sor várt jóváhagyásra).
      .where(and(eq(v.reviewStatus, 'approved'), or(...conds)))
      .orderBy(desc(v.verdictDate));

    return rows.map((r) => ({
      id: r.id,
      personName: r.personName,
      position: r.position,
      verdictType: r.verdictType,
      verdictDate: r.verdictDate,
      crimes: r.crimes,
      court: r.court,
      sourceName: r.sourceNames[0] ?? null,
      sourceUrl: r.sourceUrls[0] ?? null,
    }));
  } catch {
    // Egy DB-kiesés miatt ne essen szét az egész oldal — a táblázat
    // kimarad, a cikk marad. (Ugyanaz a minta, mint a sitemap.ts-ben.)
    return [];
  }
}

/** A /birosagi-iteletek verdict-stats.ts RELEASED_TYPES listájával azonos. */
const RELEASED = ['szabadlábra helyezve', 'eljárás megszűnt', 'felmentve'];

export function isStillDetained(verdictType: string): boolean {
  return !RELEASED.includes(verdictType);
}
