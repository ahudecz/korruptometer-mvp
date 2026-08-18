/**
 * Egyszeri, kézi takarítás — user report, 2026-08-18: "kétszer került be
 * Orbán social médiásának a feljelentése".
 *
 * Ugyanaz az ügy (Orbán Viktor közösségi médiás tartalomgyártása — Triton
 * Communications / Kaminski Fanny, ~4,2 milliárd Ft) két külön sorként
 * jött be, mert a detektor filerName-egyeztetése nem ismerte fel, hogy a
 * "Miniszterelnökség" (új sor, 2026-08-17, nyomozás-fejlemény) ugyanaz a
 * feljelentő, mint a "Miniszterelnökség (Ruff Bálint)" (kanonikus sor,
 * 2026-08-11, eredeti feljelentés) — l. review.ts isSameComplainant(), és a
 * korábbi 2026-08-13-i takarítás (merge-duplicate-complaints-2026-08-13.ts)
 * ugyanerre a mintára.
 *
 * A második sor NEM tiszta duplikáció: valódi fejleményt hordoz (a
 * feljelentésből nyomozás lett, 24.hu 2026-08-17). Ezért nem egyszerű
 * törlés — a kanonikus sor kapja meg a "nyomozás" állapotot és az új
 * forrást, a második (még pending) sor pedig törlődik.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';
import { assertWriteTarget } from './guard';

const PROD_URL = process.env.PROD_DATABASE_URL;
if (!PROD_URL) throw new Error('PROD_DATABASE_URL not set');
process.env.DATABASE_URL = PROD_URL;

const KEEP_ID = '3c225754-fa47-4d3f-8748-4925d19b521f';
const DELETE_ID = '88092e93-79bc-45d3-9c19-1f5c0b57d332';

async function main() {
  assertWriteTarget('merge-duplicate-complaints-2026-08-18');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const [dup] = await sql`SELECT "sourceUrls", "sourceNames", "sourceHeadlines", "sourceDates", status FROM "CriminalComplaint" WHERE id = ${DELETE_ID}`;
  if (!dup) throw new Error('Duplicate row not found — already deleted?');

  await sql`
    UPDATE "CriminalComplaint"
    SET status = 'nyomozás',
        "sourceUrls" = array_cat("sourceUrls", ${dup.sourceUrls}),
        "sourceNames" = array_cat("sourceNames", ${dup.sourceNames}),
        "sourceHeadlines" = array_cat("sourceHeadlines", ${dup.sourceHeadlines}),
        "sourceDates" = array_cat("sourceDates", ${dup.sourceDates}),
        "updatedAt" = now()
    WHERE id = ${KEEP_ID}
  `;
  console.log('Frissítve (kanonikus sor, status -> nyomozás, forrás hozzáfűzve):', KEEP_ID);

  const deleted = await sql`DELETE FROM "CriminalComplaint" WHERE id = ${DELETE_ID} RETURNING id, "targetName"`;
  console.log('Törölve (duplikátum):', deleted[0]);

  const [final] = await sql`SELECT id, "targetName", status, "sourceUrls" FROM "CriminalComplaint" WHERE id = ${KEEP_ID}`;
  console.log('Végállapot:', final);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
