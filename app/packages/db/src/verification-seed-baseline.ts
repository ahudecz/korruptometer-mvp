/**
 * 010-post-publish-verification — one-off baseline seed.
 *
 * Every VerificationTarget.getCandidates() query (verification-targets.ts)
 * treats "no terminal VerificationCheck row yet" as "never checked, please
 * verify now". Run against a fresh `VerificationCheck` table (before this
 * script), that is true for EVERY row ever published across the 5 target
 * tables — the very first hourly run would queue years of historical data
 * for LLM re-verification, burning the $1/day budget for days before
 * reaching steady state.
 *
 * This script writes one 'ok' VerificationCheck row (verificationMethod:
 * 'baseline_seed') for every existing, non-rejected row in each target
 * table, dated `now()`. Since getCandidates() only re-queues a row once its
 * own updatedAt/createdAt moves PAST the latest terminal checkedAt, seeding
 * "checked right now" means only genuinely NEW or EDITED rows (from this
 * point forward) become verification candidates — exactly the "post-publish"
 * scope the feature was designed for, not a retroactive full-history sweep.
 *
 * Idempotent: skips any row that already has a VerificationCheck (of any
 * outcome), so a second run only seeds rows inserted since the first run —
 * safe to re-run before the feature goes live if new data lands in between.
 *
 * Run once, MANUALLY, before verify-published-records first goes live:
 *   ALLOW_PROD_WRITE=1 npm run verification-seed-baseline -w @korr/db
 *
 * Always targets PROD_DATABASE_URL (like load-kmdb-to-prod.ts) — seeding a
 * disposable local dev DB would be pointless, this only matters for live.
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

type SeedTarget = {
  /** Matches VerificationCheck.targetTable — see verification-targets.ts. */
  slug: string;
  /** Actual SQL table name. */
  table: string;
  /** 'true' when the table has no reviewStatus column (AssetRecovery). */
  hasReviewStatus: boolean;
};

const SEED_TARGETS: SeedTarget[] = [
  { slug: 'political_resignation', table: 'PoliticalResignation', hasReviewStatus: true },
  { slug: 'court_verdict', table: 'CourtVerdict', hasReviewStatus: true },
  { slug: 'media_closure', table: 'MediaClosure', hasReviewStatus: true },
  { slug: 'asset_recovery', table: 'AssetRecovery', hasReviewStatus: false },
  { slug: 'criminal_complaint', table: 'CriminalComplaint', hasReviewStatus: true },
];

async function main() {
  assertWriteTarget('verification-seed-baseline');
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  for (const target of SEED_TARGETS) {
    // Mirrors each VerificationTarget.getCandidates() WHERE clause exactly
    // (verification-targets.ts) minus the updatedAt watermark — this IS the
    // watermark's very first value. target.slug/table are fixed internal
    // constants (SEED_TARGETS above), never user input, so plain string
    // interpolation into the identifier/literal positions here is safe.
    const reviewClause = target.hasReviewStatus ? `AND t."reviewStatus" != 'rejected'` : '';

    const result = await conn.unsafe(`
      INSERT INTO "VerificationCheck" ("targetTable", "targetId", "outcome", "verificationMethod", "summary")
      SELECT '${target.slug}', t."id", 'ok', 'baseline_seed', 'Alapállapot — a funkció bevezetése előtt publikált sor, nincs visszamenőleges ellenőrzés.'
      FROM "${target.table}" t
      WHERE NOT EXISTS (
        SELECT 1 FROM "VerificationCheck" vc
        WHERE vc."targetTable" = '${target.slug}' AND vc."targetId" = t."id"
      )
      ${reviewClause}
      RETURNING "targetId"
    `);

    console.log(`${target.slug}: ${result.length} sor seedelve.`);
  }

  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
