import { readFileSync } from 'fs';
import postgres from 'postgres';

const sql = postgres('postgresql://postgres:SPORTwavez80@127.0.0.1:5432/nextjs_db', { prepare: false });
const gen = JSON.parse(readFileSync('apps/web/app/_home/case-content.generated.json', 'utf8'));

// DB-ből lekérjük az összes érintett eset nevét
const keys = Object.keys(gen);
const rows = await sql`
  SELECT id, name, person, institution FROM "ScandalCatalog" WHERE id = ANY(${keys})
`;
const dbMap = Object.fromEntries(rows.map(r => [r.id, r]));

console.log(`\n=== GENERATED JSON vs DB ELLENŐRZÉS (${keys.length} eset) ===\n`);
console.log('Formátum: KEY | DB név | Generált cím | Gyanús?\n');
console.log('─'.repeat(120));

const suspicious = [];

for (const key of keys) {
  const entry = gen[key];
  const db = dbMap[key];
  if (!db) {
    console.log(`⚠ NINCS DB: ${key}`);
    continue;
  }

  const genTitle = entry.title ?? entry.filesKey ?? '(nincs cím)';
  const dbName = db.name;

  // Heurisztika: a kulcs szavai szerepelnek-e a generált tartalomban?
  // A kulcsból kivesszük a számokat és általános szavakat
  const keyWords = key.split('-').filter(w =>
    w.length > 4 &&
    !['korrupcios','korrupcio','botrany','ugyelete','szerzodesi','tamogatas','megbizas','biznisz','ugyelete'].includes(w)
  );

  const contentText = [
    genTitle,
    ...(entry.blocks ?? []).filter(b => b.type === 'text').map(b => b.content ?? ''),
  ].join(' ').toLowerCase();

  const dbLower = dbName.toLowerCase();
  const genLower = genTitle.toLowerCase();

  // Főbb kulcsszavak közül hány szerepel a generált szövegben
  const matchCount = keyWords.filter(w => contentText.includes(w)).length;
  const isSuspicious = keyWords.length > 0 && matchCount === 0;

  // Ellenőrizzük, hogy a generált cím és a DB név "összhangban" van-e
  // (legalább egy közös érdemi szó)
  const dbWords = dbLower.split(/[\s\-]+/).filter(w => w.length > 4);
  const genWords = genLower.split(/[\s\-]+/).filter(w => w.length > 4);
  const titleOverlap = dbWords.some(w => genWords.includes(w));

  const marker = isSuspicious ? '⚠ GYANÚS' : (titleOverlap ? '✓' : '? check');

  if (isSuspicious || !titleOverlap) {
    suspicious.push({ key, dbName, genTitle, keyWords, matchCount });
    console.log(`${marker} | ${key}`);
    console.log(`        DB:  "${dbName}"`);
    console.log(`        GEN: "${genTitle}"`);
    console.log(`        Kulcsszavak: [${keyWords.join(', ')}] → ${matchCount} egyezés a szövegben`);
    console.log();
  }
}

console.log(`\n=== ÖSSZEFOGLALÓ ===`);
console.log(`Gyanús/eltérő esetek: ${suspicious.length} / ${keys.length}`);
if (suspicious.length > 0) {
  console.log('\nGyanús kulcsok:');
  suspicious.forEach(s => console.log(`  - ${s.key}`));
}

await sql.end();
