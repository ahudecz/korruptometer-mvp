import postgres from 'postgres';
const sql = postgres('postgresql://postgres:SPORTwavez80@127.0.0.1:5432/nextjs_db', { prepare: false });
const rows = await sql`SELECT id, name, person, damage_huf, article_count FROM "ScandalCatalog" WHERE person ILIKE '%orbán viktor%' ORDER BY damage_huf DESC LIMIT 20`;
for (const r of rows) {
  console.log(`${r.id}`);
  console.log(`  név: "${r.name}"`);
  console.log(`  kár: ${r.damage_huf} Ft | cikkek: ${r.article_count}`);
}
await sql.end();
