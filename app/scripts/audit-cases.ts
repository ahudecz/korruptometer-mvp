/**
 * Diagnosztikai script: ScandalCatalog összes esetének átnézése
 * Futtatás: npx tsx scripts/audit-cases.ts
 */
import postgres from 'postgres';

const DATABASE_URL = 'postgresql://postgres:SPORTwavez80@127.0.0.1:5432/nextjs_db';

type Case = {
  id: string;
  name: string;
  person: string | null;
  institution: string | null;
  damage_huf: string;
  article_count: number;
};

function cleanTitle(name: string): string {
  return name.replace(/^[\d\s.,–-]+/, '').trim();
}

function flags(c: Case): string[] {
  const issues: string[] = [];
  const nameLower = c.name.toLowerCase();

  // 1. A name-ben benne van a személy neve → cím + alcím redundáns/zavaró
  if (c.person) {
    const parts = c.person.toLowerCase().split(/\s+/);
    const matchCount = parts.filter((p) => p.length > 3 && nameLower.includes(p)).length;
    if (matchCount >= 2) {
      issues.push(`SZEMÉLY_A_NÉVBEN ("${c.person}")`);
    }
  }

  // 2. Az intézmény mező hiányzik de van személy
  if (!c.institution && c.person) {
    issues.push('HIÁNYZÓ_INTÉZMÉNY');
  }

  // 3. Kár értéke gyanúsan kerek szám a névből (artifact)
  const numInName = c.name.match(/\d{3,}/);
  if (numInName) {
    issues.push(`SZÁM_A_NÉVBEN (${numInName[0]})`);
  }

  // 4. Rendkívül rövid tisztított cím (valószínűleg értelmetlen maradék)
  const cleaned = cleanTitle(c.name);
  if (cleaned.length < 10) {
    issues.push(`RÖVID_CÍM ("${cleaned}")`);
  }

  // 5. Duplikált tartalom: intézmény és személy ugyanaz (pl. "Rogán Antal · Rogán Antal")
  if (c.person && c.institution && c.person === c.institution) {
    issues.push('SZEMÉLY=INTÉZMÉNY_DUPLIKÁT');
  }

  return issues;
}

async function main() {
  const sql = postgres(DATABASE_URL, { prepare: false });

  const rows = await sql<Case[]>`
    SELECT id, name, person, institution, damage_huf::text, article_count
    FROM "ScandalCatalog"
    ORDER BY damage_huf DESC, id ASC
    LIMIT 938
  `;

  console.log(`\n=== KORRUPTOMÉTER ESETDIAGNOSZTIKA (${rows.length} eset) ===\n`);

  const flagged = rows.map((c) => ({ ...c, issues: flags(c) })).filter((c) => c.issues.length > 0);

  console.log(`Megjelölt esetek: ${flagged.length} / ${rows.length}\n`);
  console.log('─'.repeat(100));

  // Csoportosítás probléma szerint
  const byIssue: Record<string, typeof flagged> = {};
  for (const c of flagged) {
    for (const issue of c.issues) {
      const key = issue.split(' ')[0]!;
      byIssue[key] ??= [];
      byIssue[key]!.push(c);
    }
  }

  for (const [issueType, cases] of Object.entries(byIssue)) {
    console.log(`\n### ${issueType} (${cases.length} eset)\n`);
    for (const c of cases.slice(0, 20)) {
      const dmg = BigInt(c.damage_huf);
      const dmgStr = dmg > 0n ? `${(dmg / 1_000_000_000n).toString()} Mrd` : '—';
      console.log(`  ${c.id}`);
      console.log(`    név: "${c.name}"`);
      console.log(`    személy: ${c.person ?? '—'} | intézmény: ${c.institution ?? '—'} | kár: ${dmgStr}`);
      console.log(`    hibák: ${c.issues.join(', ')}`);
      console.log();
    }
    if (cases.length > 20) console.log(`  ... és még ${cases.length - 20} eset\n`);
  }

  // Top 50 eset kár szerint — független a flagektől
  console.log('\n=== TOP 50 LEGKÁROSABB ESET (kár szerint) ===\n');
  for (const c of rows.slice(0, 50)) {
    const dmg = BigInt(c.damage_huf);
    const dmgStr = dmg > 0n ? `${(dmg / 1_000_000_000n).toString()} Mrd` : '—';
    const issueList = flags(c);
    const marker = issueList.length > 0 ? ' ⚠' : '';
    console.log(`${marker} ${c.id}`);
    console.log(`   "${c.name}"`);
    console.log(`   ${c.person ?? '—'} · ${c.institution ?? '—'} | kár: ${dmgStr} | cikkek: ${c.article_count}`);
    if (issueList.length > 0) console.log(`   → ${issueList.join(', ')}`);
    console.log();
  }

  await sql.end();
}

main().catch(console.error);
