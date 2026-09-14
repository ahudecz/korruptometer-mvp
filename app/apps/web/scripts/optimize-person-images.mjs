// Egyszeri (és újrafuttatható) képoptimalizáló a /images/persons mappára.
//
// Miért kellett: a nyitóoldal 19 MB-ot töltött le, gyakorlatilag kizárólag
// ezekből a fájlokból — 52 db PNG, átlag 1,1 MB, 1344x768-as natív
// felbontással, miközben a watchlist-rács 320x320-ban jeleníti meg őket.
//
// Amit csinál: minden képhez legenerál egy 900px széles WebP változatot
// (~20 KB). Az eredeti PNG-ket SZÁNDÉKOSAN nem törli és nem írja felül:
// így ha valahol kimaradt egy hivatkozás átírása, az nem 404-el, csak nem
// gyorsul. Idempotens — újrafuttatva csak a hiányzó/elavult .webp-eket írja.
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, parse } from 'node:path';
import sharp from 'sharp';

const DIR = new URL('../public/images/persons/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const WIDTH = 900;
const QUALITY = 82;

const sources = readdirSync(DIR).filter(f => /\.(png|jpe?g)$/i.test(f));
let before = 0, after = 0, written = 0, skipped = 0;

for (const file of sources) {
  const src = join(DIR, file);
  const out = join(DIR, parse(file).name + '.webp');
  const srcStat = statSync(src);
  before += srcStat.size;

  if (existsSync(out) && statSync(out).mtimeMs >= srcStat.mtimeMs) {
    after += statSync(out).size;
    skipped++;
    continue;
  }

  await sharp(src)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(out);

  after += statSync(out).size;
  written++;
}

const mb = b => (b / 1048576).toFixed(1) + ' MB';
console.log(`${sources.length} forráskép — ${written} konvertálva, ${skipped} változatlan`);
console.log(`eredeti: ${mb(before)}  →  webp: ${mb(after)}  (${(before / after).toFixed(1)}x)`);
