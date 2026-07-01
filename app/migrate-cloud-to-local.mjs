/**
 * One-off: pull case data from cloud Supabase (service-role REST) into the local
 * Postgres dev DB. Password-free. Run with:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 node --dns-result-order=ipv4first migrate-cloud-to-local.mjs
 *
 * Local TLS verify is disabled because a TLS-intercepting AV/proxy on this
 * machine breaks Node's chain validation (the OS stack works fine). This only
 * affects this one-off local pull.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
const pick = (n) => (env.match(new RegExp('^' + n + '\\s*=\\s*"?([^"\\n]+)"?', 'm')) || [])[1]?.trim();

const SB_URL = pick('NEXT_PUBLIC_SUPABASE_URL');
const SB_KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
const LOCAL = pick('DATABASE_URL');
if (!SB_URL || !SB_KEY || !LOCAL) { console.error('❌ Hiányzó env.'); process.exit(1); }
if (/supabase\.co/.test(LOCAL)) { console.error('❌ DATABASE_URL cloudra mutat — a lokálnak kell lennie!'); process.exit(1); }

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const sql = postgres(LOCAL, { prepare: false, max: 1, onnotice: () => {} });

// Parent → child order.
const TABLES = [
  'Source', 'OffenceTypeRef', 'NewsArticle', 'Investigation', 'DamageEstimate',
  'InvestigationArticleLink',
  // KMonitor* tables are NOT exposed to PostgREST yet — see specs quickstart.
  // 'KMonitorArticle', 'KMonitorPersonCandidate', 'KMonitorPersonArticle',
];

async function colMeta(table) {
  const rows = await sql`
    SELECT column_name, data_type, udt_name, is_generated
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${table}
    ORDER BY ordinal_position`;
  return rows;
}

async function pullAll(table) {
  const page = 1000;
  let from = 0, out = [];
  for (;;) {
    const { data, error } = await sb.from(table).select('*').range(from, from + page - 1);
    if (error) throw new Error(`${table} pull: ${error.message}`);
    out.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return out;
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function arrayLit(v, udt) {
  const elt = udt.replace(/^_/, ''); // _text -> text
  if (!Array.isArray(v) || v.length === 0) return `'{}'::"${elt}"[]`;
  const els = v.map((e) => (e === null ? 'NULL' : typeof e === 'number' || typeof e === 'boolean' ? String(e) : q(e)));
  return `ARRAY[${els.join(',')}]::"${elt}"[]`;
}

function lit(v, c) {
  if (v === null || v === undefined) return 'NULL';
  if (c.data_type === 'jsonb' || c.data_type === 'json') return `${q(JSON.stringify(v))}::jsonb`;
  if (c.data_type === 'ARRAY') return arrayLit(v, c.udt_name);
  if (c.data_type === 'USER-DEFINED') return `${q(v)}::"${c.udt_name}"`;
  if (c.data_type === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  return q(v);
}

function buildInsert(table, cols, row) {
  const usable = cols.filter((c) => c.is_generated !== 'ALWAYS');
  const names = usable.map((c) => `"${c.column_name}"`).join(',');
  const values = usable.map((c) => lit(row[c.column_name], c)).join(',');
  return { text: `INSERT INTO "${table}" (${names}) VALUES (${values})`, vals: [] };
}

async function main() {
  console.log('Lokál cél:', LOCAL.replace(/:[^:@]*@/, ':***@'));
  console.log('Cloud forrás:', SB_URL, '\n');

  // Pull everything first (so we fail before truncating).
  const data = {}, metas = {};
  for (const t of TABLES) {
    metas[t] = await colMeta(t);
    if (metas[t].length === 0) { console.log(`⚠️  ${t}: nincs lokál tábla — kihagyom`); continue; }
    process.stdout.write(`pull ${t} … `);
    data[t] = await pullAll(t);
    console.log(`${data[t].length} sor`);
  }

  const truncList = TABLES.filter((t) => data[t]).map((t) => `"${t}"`).join(',');
  console.log(`\nbetöltés (FK ideiglenesen ki)…`);
  await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL session_replication_role = replica`);
    await tx.unsafe(`TRUNCATE ${truncList} CASCADE`);
    for (const t of TABLES) {
      const rows = data[t];
      if (!rows || rows.length === 0) { console.log(`  ${t}: 0`); continue; }
      let n = 0;
      for (const row of rows) {
        const { text, vals } = buildInsert(t, metas[t], row);
        try {
          await tx.unsafe(text);
        } catch (err) {
          console.error(`\n  HIBA ${t} sornál:`, err.message);
          console.error('   SQL:', text.slice(0, 400));
          throw err;
        }
        n++;
      }
      console.log(`  ${t}: ${n}`);
    }
  });

  const sc = await sql`SELECT count(*)::int c FROM "ScandalCatalog"`;
  console.log(`\n✅ Kész. ScandalCatalog (view): ${sc[0].c} ügy`);
  const top = await sql`SELECT name, damage_huf FROM "ScandalCatalog" ORDER BY damage_huf DESC LIMIT 5`;
  for (const r of top) console.log(`   ${(Number(r.damage_huf)/1e9).toFixed(0).padStart(5)} Mrd · ${r.name?.slice(0,50)}`);
  await sql.end();
}

main().catch(async (e) => { console.error('\n❌', e.message); await sql.end(); process.exit(1); });
