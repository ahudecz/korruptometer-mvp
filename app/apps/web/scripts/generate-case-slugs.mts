/**
 * Ügyoldal-URL átnevezési tábla generálása — l. app/_home/case-slugs.ts.
 *
 * Futtatás (az app/ mappából):
 *   pnpm exec tsx apps/web/scripts/generate-case-slugs.mts <inspect-results.json> [--reset]
 *
 * Az első argumentum a Search Console URL-vizsgálat eredménye
 * ({ "<teljes URL>": { coverage: "Submitted and indexed" | … } }). Ebből
 * derül ki, melyik ügyoldal indexelt: a JÓ URL-ű indexelt oldalakhoz nem
 * nyúlunk, minden mást átnevezhetünk. Ami a vizsgálatból hiányzik, azt
 * óvatosságból indexeltnek vesszük.
 *
 * Az éles ScandalCatalog-ból olvas (csak SELECT), és a MEGJELENŐ címből
 * (szerkesztői override → különben cleanTitle(name)) képzi az új slugot.
 * A már meglévő bejegyzéseket MEGTARTJA: egyszer kiadott URL-t nem
 * változtatunk újra (a Google és a külső linkek már arra mutatnak). A
 * `--reset` csak élesítés előtt használható, amíg a tábla még sehol nincs kint.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';
import { config } from 'dotenv';

import * as cfgNs from '../app/_home/case-detail-config';
import * as slugsNs from '../app/_home/case-slugs';
import * as rollupNs from '../app/_home/person-rollup-config';
import type { SlugSource } from '../app/_home/case-slugs';

// A web csomag CJS-ként fordul, ezért ESM-ből a named exportok a
// `default` alatt érkeznek — mindkét alakot kezeljük.
const unwrap = <T,>(ns: T): T => ((ns as { default?: T }).default ?? ns);
const { cleanTitle, getCaseDisplayTitle, RETIRED_SCANDAL_IDS } = unwrap(cfgNs);
const { buildSlugOverrides, stripAccents } = unwrap(slugsNs);
const { PERSON_ROLLUPS } = unwrap(rollupNs);

const [inspectPath, ...flags] = process.argv.slice(2);
if (!inspectPath) throw new Error('Add meg a Search Console URL-vizsgálat JSON-ját első argumentumként.');

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env.local') });
const url = process.env.PROD_DATABASE_URL;
if (!url) throw new Error('Hiányzik a PROD_DATABASE_URL az app/.env.local fájlból.');

const OUT = resolve(here, '../app/_home/case-slug-overrides.generated.json');

const inspect = JSON.parse(readFileSync(inspectPath, 'utf8')) as Record<string, { coverage?: string }>;
const statusBySlug = new Map<string, string | undefined>();
for (const [u, v] of Object.entries(inspect)) {
  const m = /\/adatbazis\/([^/?#]+)$/.exec(u);
  if (m) statusBySlug.set(decodeURIComponent(m[1]!), v.coverage);
}

const sql = postgres(url, { prepare: false, max: 1 });
try {
  const rows = await sql<{ id: string; name: string; person: string | null; institution: string | null }[]>`
    SELECT id, name, person, institution FROM "ScandalCatalog"
  `;
  const retired = new Set(RETIRED_SCANDAL_IDS);
  const sources: SlugSource[] = rows
    .filter((r) => !retired.has(r.id))
    .map((r) => ({ ...r, title: getCaseDisplayTitle(r.id) ?? cleanTitle(r.name, r.id) }));

  const indexedIds = new Set(
    sources
      .filter((r) => {
        const status = statusBySlug.get(stripAccents(r.id));
        return status === undefined || status === 'Submitted and indexed';
      })
      .map((r) => r.id),
  );
  const misattributedIds = new Set(PERSON_ROLLUPS.flatMap((p) => p.excludeIds ?? []));

  const existing = flags.includes('--reset')
    ? {}
    : (JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, string>);
  const fresh = buildSlugOverrides(sources, { indexedIds, misattributedIds });
  const merged: Record<string, string> = { ...fresh, ...existing };
  const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);

  console.log(
    `${sources.length} ügy, ebből ${indexedIds.size} indexelt; ${Object.keys(fresh).length} átnevezés, ${Object.keys(sorted).length} bejegyzés a táblában.`,
  );
  for (const [id, slug] of Object.entries(sorted)) {
    console.log(`${indexedIds.has(id) ? 'IDX' : '   '}  ${id}  →  ${slug}`);
  }
} finally {
  await sql.end();
}
