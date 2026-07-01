import 'server-only';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';

/**
 * Constrained dimension registry (research.md §5, FR-017 / FR-018).
 *
 * Adding a new dimension is a code change reviewed in PR — never
 * reviewer-entered. Each dimension has a name, a record-type filter,
 * and a way to compute the per-record value (the amount that gets
 * compared to p10/p50/p90).
 *
 * The `applies(record)` predicate tells the engine whether a given
 * ExternalRecord can be classified into this dimension's cohort.
 */
export type Dimension = {
  name: string;
  /** Record-type values that participate in this dimension's cohort. */
  recordTypes: string[];
  /** Source systems that contribute records to this cohort. */
  sourceSystems: string[];
  /** Field path inside `rawPayload` to read the per-record amount from. */
  amountPath: string[];
  /** Optional record-type-specific predicate string for human display. */
  description: string;
};

export const DIMENSIONS: Dimension[] = [
  {
    name: 'huf_per_sqm_hospital',
    recordTypes: ['contract_notice'],
    sourceSystems: ['TED', 'EKR', 'KE'],
    amountPath: ['hufPerSqm'],
    description: 'Kórház-építés / felújítás HUF / m² benchmarkok',
  },
  {
    name: 'huf_per_km_road',
    recordTypes: ['contract_notice'],
    sourceSystems: ['TED', 'EKR', 'KE'],
    amountPath: ['hufPerKm'],
    description: 'Útépítés HUF / km benchmarkok',
  },
  {
    name: 'huf_per_mw_solar',
    recordTypes: ['contract_notice'],
    sourceSystems: ['TED', 'EKR', 'palyazat'],
    amountPath: ['hufPerMw'],
    description: 'Naperőmű HUF / MW benchmarkok',
  },
  {
    name: 'huf_per_seat_school',
    recordTypes: ['contract_notice'],
    sourceSystems: ['TED', 'EKR', 'KE'],
    amountPath: ['hufPerSeat'],
    description: 'Iskola-építés HUF / férőhely benchmarkok',
  },
];

export type CohortSpec = {
  dimension: string;
  recordTypes: string[];
  sourceSystems: string[];
  amountPath: string[];
};

export function specForDimension(d: Dimension): CohortSpec {
  return {
    dimension: d.name,
    recordTypes: d.recordTypes,
    sourceSystems: d.sourceSystems,
    amountPath: d.amountPath,
  };
}

export function cohortHash(spec: CohortSpec): string {
  return createHash('sha256').update(JSON.stringify(spec)).digest('hex');
}

export type Percentiles = {
  cohortHash: string;
  dimension: string;
  cohortSpec: CohortSpec;
  p10: string;
  p50: string;
  p90: string;
  n: number;
  memberRecordIds: string[];
};

/**
 * Compute a cohort's p10/p50/p90 against ExternalRecord rows whose
 * `relevance = 'benchmark'` and whose `(sourceSystem, recordType)` match
 * the dimension. Reads the per-record amount from
 * `rawPayload #>> amountPath` cast to numeric.
 */
export async function computeCohort(d: Dimension): Promise<Percentiles | null> {
  const db = getDb();
  const spec = specForDimension(d);
  const ch = cohortHash(spec);

  // PostgreSQL jsonb #>> takes a text[] path. We build the array literal
  // from the dimension's amountPath.
  const pathArrLiteral =
    'ARRAY['
    + d.amountPath.map((p) => `'${p.replace(/'/g, "''")}'`).join(', ')
    + ']::text[]';
  const sourceSystemsLiteral =
    'ARRAY['
    + d.sourceSystems.map((s) => `'${s.replace(/'/g, "''")}'`).join(', ')
    + ']::text[]';
  const recordTypesLiteral =
    'ARRAY['
    + d.recordTypes.map((r) => `'${r.replace(/'/g, "''")}'`).join(', ')
    + ']::text[]';

  const rows = (await db.execute(sql`
    WITH cohort AS (
      SELECT id,
             ((raw_payload #>> ${sql.raw(pathArrLiteral)})::numeric) AS value
        FROM (
          SELECT id, "rawPayload" AS raw_payload, "sourceSystem", "recordType", relevance
            FROM "ExternalRecord"
        ) er
       WHERE er.relevance = 'benchmark'
         AND er."sourceSystem"::text = ANY(${sql.raw(sourceSystemsLiteral)})
         AND er."recordType" = ANY(${sql.raw(recordTypesLiteral)})
         AND er.raw_payload #>> ${sql.raw(pathArrLiteral)} IS NOT NULL
    )
    SELECT COUNT(*)::int                            AS n,
           percentile_cont(0.10) WITHIN GROUP (ORDER BY value)::text AS p10,
           percentile_cont(0.50) WITHIN GROUP (ORDER BY value)::text AS p50,
           percentile_cont(0.90) WITHIN GROUP (ORDER BY value)::text AS p90,
           ARRAY(SELECT id FROM cohort)            AS member_record_ids
      FROM cohort
  `)) as Array<{
    n: number;
    p10: string | null;
    p50: string | null;
    p90: string | null;
    member_record_ids: string[];
  }>;

  const row = rows[0];
  if (!row || row.n === 0) return null;
  return {
    cohortHash: ch,
    dimension: d.name,
    cohortSpec: spec,
    p10: row.p10 ?? '0',
    p50: row.p50 ?? '0',
    p90: row.p90 ?? '0',
    n: row.n,
    memberRecordIds: row.member_record_ids ?? [],
  };
}
