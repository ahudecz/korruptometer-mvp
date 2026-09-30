/**
 * Forrás-ellenőrzött ügyek elavult URL-jeinek cseréje — l. app/_home/case-slugs.ts.
 *
 * Futtatás (az app/ mappából):
 *   pnpm exec tsx apps/web/scripts/refresh-audited-slugs.mts [--write]
 *
 * A slug-tábla a forrás-ellenőrzés ELŐTTI címekből készült, így sok URL-ben
 * olyan személynév vagy állítás maradt, amelyet az ellenőrzés kivett a címből
 * (pl. hamis „felelős"). Itt csak azokat az ellenőrzött (CASE_AUDIT, nem
 * törölt) ügyeket nevezzük át, amelyek jelenlegi slugjában van legalább egy
 * 4+ betűs, számot nem tartalmazó szó, ami sem a megjelenő címben, sem az
 * összefoglalóban nem szerepel. Az új slug a megjelenő címből és a (már
 * javított) személymezőből készül; a régi slug a
 * case-slug-superseded.generated.json-ba kerül, így 308-cal átirányít.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';
import { config } from 'dotenv';

import * as cfgNs from '../app/_home/case-detail-config';
import * as slugsNs from '../app/_home/case-slugs';
import * as auditNs from '../app/_home/case-audit';

const unwrap = <T,>(ns: T): T => ((ns as { default?: T }).default ?? ns);
const { cleanTitle, getCaseDisplayTitle } = unwrap(cfgNs);
const { buildCaseSlug, slugPerson, stripAccents } = unwrap(slugsNs);
const { CASE_AUDIT } = unwrap(auditNs);

const write = process.argv.includes('--write');
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env.local') });
const url = process.env.PROD_DATABASE_URL;
if (!url) throw new Error('Hiányzik a PROD_DATABASE_URL az app/.env.local fájlból.');

const OVERRIDES = resolve(here, '../app/_home/case-slug-overrides.generated.json');
const SUPERSEDED = resolve(here, '../app/_home/case-slug-superseded.generated.json');
const overrides = JSON.parse(readFileSync(OVERRIDES, 'utf8')) as Record<string, string>;
const superseded = JSON.parse(readFileSync(SUPERSEDED, 'utf8')) as Record<string, string>;

const MANUAL = new Set([
  'forró-krisztián-sk-kampanya', 'mager-penzmotas', 'borkai-gyor-szol-ugy', 'oroszhaza-kezilabda-botrany',
  'somlai-budavar-lakasok', 'tasnadiborotelefonugye', 'tiborcz-fovam-ter', 'tiborcz-csaladi-vezetoi-poziciok',
]);
const words = (s: string) => stripAccents(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const sql = postgres(url, { prepare: false, max: 1 });
try {
  const rows = await sql<{ id: string; name: string; summary: string | null; person: string | null; institution: string | null }[]>`
    SELECT id, name, summary, person, institution FROM "ScandalCatalog"
  `;
  const taken = new Set<string>([...Object.values(overrides), ...rows.map((r) => stripAccents(r.id)), ...Object.keys(superseded)]);
  // Személynév-szavak: a katalógus összes személymezője + a CASE_AUDIT jegyzetekben
  // „Felelős: X Y" alakban kivett nevek. Csak az ilyen elavult szó indokol cserét.
  const nameWords = new Set<string>();
  for (const r of rows) for (const w of words(r.person ?? '')) if (w.length >= 3) nameWords.add(w);
  for (const e of Object.values(CASE_AUDIT)) {
    for (const m of e.note.matchAll(/Felelős: ([A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+(?: [A-ZÁÉÍÓÖŐÚÜŰ][\p{L}.-]+){1,2})/gu)) {
      for (const w of words(m[1]!)) if (w.length >= 3) nameWords.add(w);
    }
  }
  let n = 0;
  for (const r of rows) {
    const audit = CASE_AUDIT[r.id];
    const old = overrides[r.id];
    if (!audit || audit.verdict === 'removed' || !old) continue;
    // Kézzel, tartalmi okból már átírt slugok (case-slugs.ts SUPERSEDED) — nem nyúlunk hozzájuk.
    if (MANUAL.has(r.id)) continue;
    const title = getCaseDisplayTitle(r.id) ?? cleanTitle(r.name, r.id);
    const text = new Set(words(`${title} ${r.summary ?? ''}`));
    const textList = [...text];
    const present = (w: string) => text.has(w) || textList.some((t) => t.length >= 4 && (t.startsWith(w) || w.startsWith(t)));
    const stale = old.split('-').filter((w) => w.length >= 3 && nameWords.has(w) && !present(w));
    if (stale.length === 0) continue;
    const base = buildCaseSlug(title, slugPerson({ id: r.id, title, name: r.name, person: r.person, institution: r.institution }, { indexedIds: new Set(), misattributedIds: new Set() }));
    const trimmed = base.split('-').slice(0, 9).join('-');
    let slug = trimmed;
    for (let i = 2; taken.has(slug) && slug !== old; i++) slug = `${trimmed.split('-').slice(0, 8).join('-')}-${i}`;
    if (slug === old) continue;
    taken.add(slug);
    superseded[old] = r.id;
    overrides[r.id] = slug;
    n++;
    console.log(`${r.id}\n   ${old}  →  ${slug}   (elavult: ${stale.join(', ')})`);
  }
  console.log(`${n} slug cserélve.`);
  if (write) {
    const sort = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
    writeFileSync(OVERRIDES, `${JSON.stringify(sort(overrides), null, 2)}\n`);
    writeFileSync(SUPERSEDED, `${JSON.stringify(sort(superseded), null, 2)}\n`);
  }
} finally {
  await sql.end();
}
