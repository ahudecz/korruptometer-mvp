import { sql } from 'drizzle-orm';

import { GALERIA } from './galeria-config';
import { WATCH_LIST } from './watchlist-config';
import { PERSON_ROLLUPS } from './person-rollup-config';
import { PERSON_PHOTOS } from './case-detail-config';

// Featured on the "Kiemelt személyek" strip — the 12 biggest, best-documented
// person rollups by corrected (excludeIds-adjusted) total damage, per the
// 2026-07-08 ranking audit (which also caught and excluded several
// misattributed/macro-figure scandalKeys — see person-rollup-config.ts).
// Order here is a fallback; actual display order is by live total (desc),
// computed in getFeaturedPeople().
export const FEATURED_ROLLUP_SLUGS = [
  'meszaros-lorinc', 'balasy-gyula', 'tiborcz-istvan', 'orban-viktor',
  'rogan-antal', 'lazar-janos', 'szijj-laszlo', 'lezsak-sandor',
  'hernadi-zsolt', 'szijjarto-peter', 'palkovics-laszlo', 'matolcsy-gyorgy',
];

export type FeaturedPerson = {
  slug: string;
  name: string;
  total: bigint;
  caseCount: number;
  photoUrl: string | null;
};

type Executable = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

/**
 * Live "Érintett közpénz" total per featured person, respecting each
 * rollup's excludeIds (duplicates/misattributed scandalKeys) so the number
 * shown here always matches what the rollup page itself reports. Photo
 * lookup follows the same GALERIA → WATCH_LIST → PERSON_PHOTOS fallback
 * chain as the person-rollup page.
 */
export async function getFeaturedPeople(db: Executable): Promise<FeaturedPerson[]> {
  const featuredConfigs = FEATURED_ROLLUP_SLUGS
    .map((s) => PERSON_ROLLUPS.find((p) => p.slug === s))
    .filter((p): p is (typeof PERSON_ROLLUPS)[number] => p != null);

  const people = await Promise.all(
    featuredConfigs.map(async (cfg) => {
      const excluded = cfg.excludeIds ?? [];
      const totalRows = (await db.execute(sql`
        SELECT COALESCE(SUM(damage_huf), 0)::text AS total, count(*)::int AS n
        FROM "ScandalCatalog"
        WHERE person = ${cfg.personName}
          ${excluded.length > 0 ? sql`AND id NOT IN (${sql.join(excluded.map((v) => sql`${v}`), sql`, `)})` : sql``}
      `)) as unknown as Array<{ total: string; n: number }>;

      const galeriaEntry = GALERIA.find((g) => g.name === cfg.personName);
      const watchEntry = WATCH_LIST.find((w) => w.name === cfg.personName);
      const photoEntry = PERSON_PHOTOS[cfg.personName];

      return {
        slug: cfg.slug,
        name: cfg.personName,
        total: BigInt(totalRows[0]?.total ?? '0'),
        caseCount: totalRows[0]?.n ?? 0,
        photoUrl: galeriaEntry?.photoUrl ?? watchEntry?.photoUrl ?? photoEntry?.photoUrl ?? null,
      };
    }),
  );

  return people.sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0));
}
