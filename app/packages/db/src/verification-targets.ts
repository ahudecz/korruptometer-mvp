/**
 * 010-post-publish-verification — per-table adapters over the generic
 * `VerificationTarget` interface. `verify-published-records.ts` (the
 * Inngest function) loops over `ALL_TARGETS` without knowing anything
 * table-specific; all the per-table shape differences (single vs. array
 * `sourceUrl`, presence/absence of `reviewStatus`/`updatedAt`, which fields
 * are correctable) are isolated here.
 *
 * `applyCorrection` uses `COALESCE` against a fixed, per-table field
 * whitelist rather than building a dynamic SET clause from LLM-supplied
 * field names — an unrecognized field name from `correctedFields` is
 * silently ignored, never interpolated into SQL as a column identifier.
 */
import { sql } from 'drizzle-orm';

type Executable = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

export type VerificationCandidate = {
  id: string;
  entityName: string;
  eventDateIso: string;
  sourceUrls: string[];
  fields: Record<string, string>;
};

export type VerificationTarget = {
  /** Matches VerificationCheck.targetTable — a stable slug, not the SQL table name. */
  tableName: string;
  getCandidates(db: Executable, limit: number): Promise<VerificationCandidate[]>;
  applyCorrection(db: Executable, id: string, fields: Record<string, string>): Promise<void>;
  applyDelete(db: Executable, id: string): Promise<void>;
};

const TERMINAL_OUTCOMES = sql`('ok','corrected','approved_by_human')`;

export const politicalResignationTarget: VerificationTarget = {
  tableName: 'political_resignation',

  async getCandidates(db, limit) {
    const rows = (await db.execute(sql`
      SELECT
        pr."id",
        pr."name",
        pr."position",
        pr."institution",
        pr."resignationType",
        pr."resignationDate",
        pr."description",
        pr."sourceUrls"
      FROM "PoliticalResignation" pr
      WHERE pr."reviewStatus" != 'rejected'
        AND pr."updatedAt" > COALESCE(
          (SELECT MAX(vc."checkedAt") FROM "VerificationCheck" vc
           WHERE vc."targetTable" = 'political_resignation' AND vc."targetId" = pr."id"
             AND vc."outcome" IN ${TERMINAL_OUTCOMES}),
          '-infinity'::timestamptz
        )
      ORDER BY pr."updatedAt" ASC
      LIMIT ${limit}
    `)) as unknown as Array<{
      id: string;
      name: string;
      position: string;
      institution: string;
      resignationType: string;
      resignationDate: string;
      description: string | null;
      sourceUrls: string[];
    }>;

    return rows.map((r) => ({
      id: r.id,
      entityName: r.name,
      eventDateIso: new Date(r.resignationDate).toISOString().slice(0, 10),
      sourceUrls: r.sourceUrls ?? [],
      fields: {
        name: r.name,
        position: r.position,
        institution: r.institution,
        resignationType: r.resignationType,
        description: r.description ?? '',
      },
    }));
  },

  async applyCorrection(db, id, fields) {
    await db.execute(sql`
      UPDATE "PoliticalResignation" SET
        "name" = COALESCE(${fields.name ?? null}, "name"),
        "position" = COALESCE(${fields.position ?? null}, "position"),
        "institution" = COALESCE(${fields.institution ?? null}, "institution"),
        "resignationType" = COALESCE(${fields.resignationType ?? null}::"resignation_type", "resignationType"),
        "description" = COALESCE(${fields.description ?? null}, "description"),
        "updatedAt" = now()
      WHERE "id" = ${id}
    `);
  },

  async applyDelete(db, id) {
    await db.execute(sql`DELETE FROM "PoliticalResignation" WHERE "id" = ${id}`);
  },
};

export const courtVerdictTarget: VerificationTarget = {
  tableName: 'court_verdict',

  async getCandidates(db, limit) {
    const rows = (await db.execute(sql`
      SELECT cv."id", cv."personName", cv."position", cv."verdictType", cv."court",
             cv."summary", cv."description", cv."verdictDate", cv."sourceUrls"
      FROM "CourtVerdict" cv
      WHERE cv."reviewStatus" != 'rejected'
        AND cv."updatedAt" > COALESCE(
          (SELECT MAX(vc."checkedAt") FROM "VerificationCheck" vc
           WHERE vc."targetTable" = 'court_verdict' AND vc."targetId" = cv."id"
             AND vc."outcome" IN ${TERMINAL_OUTCOMES}),
          '-infinity'::timestamptz
        )
      ORDER BY cv."updatedAt" ASC
      LIMIT ${limit}
    `)) as unknown as Array<{
      id: string;
      personName: string;
      position: string;
      verdictType: string;
      court: string;
      summary: string;
      description: string | null;
      verdictDate: string;
      sourceUrls: string[];
    }>;

    return rows.map((r) => ({
      id: r.id,
      entityName: r.personName,
      eventDateIso: new Date(r.verdictDate).toISOString().slice(0, 10),
      sourceUrls: r.sourceUrls ?? [],
      fields: {
        personName: r.personName,
        position: r.position,
        verdictType: r.verdictType,
        court: r.court,
        summary: r.summary,
        description: r.description ?? '',
      },
    }));
  },

  // `verdictType` is plain text (not a Postgres enum) — no cast needed, unlike
  // PoliticalResignation.resignationType.
  async applyCorrection(db, id, fields) {
    await db.execute(sql`
      UPDATE "CourtVerdict" SET
        "personName" = COALESCE(${fields.personName ?? null}, "personName"),
        "position" = COALESCE(${fields.position ?? null}, "position"),
        "verdictType" = COALESCE(${fields.verdictType ?? null}, "verdictType"),
        "court" = COALESCE(${fields.court ?? null}, "court"),
        "summary" = COALESCE(${fields.summary ?? null}, "summary"),
        "description" = COALESCE(${fields.description ?? null}, "description"),
        "updatedAt" = now()
      WHERE "id" = ${id}
    `);
  },

  async applyDelete(db, id) {
    await db.execute(sql`DELETE FROM "CourtVerdict" WHERE "id" = ${id}`);
  },
};

export const mediaClosureTarget: VerificationTarget = {
  tableName: 'media_closure',

  async getCandidates(db, limit) {
    // MediaClosure.sourceUrl is a single nullable column, not an array like
    // the other 4 tables — getCandidates always returns a 0-or-1-element
    // sourceUrls list here, same shape the rest of the pipeline expects.
    const rows = (await db.execute(sql`
      SELECT mc."id", mc."name", mc."eventType", mc."description", mc."eventDate", mc."sourceUrl"
      FROM "MediaClosure" mc
      WHERE mc."reviewStatus" != 'rejected'
        AND mc."updatedAt" > COALESCE(
          (SELECT MAX(vc."checkedAt") FROM "VerificationCheck" vc
           WHERE vc."targetTable" = 'media_closure' AND vc."targetId" = mc."id"
             AND vc."outcome" IN ${TERMINAL_OUTCOMES}),
          '-infinity'::timestamptz
        )
      ORDER BY mc."updatedAt" ASC
      LIMIT ${limit}
    `)) as unknown as Array<{
      id: string;
      name: string;
      eventType: string;
      description: string | null;
      eventDate: string;
      sourceUrl: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      entityName: r.name,
      eventDateIso: new Date(r.eventDate).toISOString().slice(0, 10),
      sourceUrls: r.sourceUrl ? [r.sourceUrl] : [],
      fields: {
        name: r.name,
        eventType: r.eventType,
        description: r.description ?? '',
      },
    }));
  },

  async applyCorrection(db, id, fields) {
    await db.execute(sql`
      UPDATE "MediaClosure" SET
        "name" = COALESCE(${fields.name ?? null}, "name"),
        "eventType" = COALESCE(${fields.eventType ?? null}::"media_closure_type", "eventType"),
        "description" = COALESCE(${fields.description ?? null}, "description"),
        "updatedAt" = now()
      WHERE "id" = ${id}
    `);
  },

  async applyDelete(db, id) {
    await db.execute(sql`DELETE FROM "MediaClosure" WHERE "id" = ${id}`);
  },
};

/**
 * AssetRecovery has NO `reviewStatus` and NO `updatedAt` column (see
 * detect-asset-recoveries.ts header comment — every insert here is
 * immediately public by design, no pending/review concept at all). Two
 * consequences, both accepted trade-offs rather than bugs:
 *  - The watermark uses `createdAt` instead of `updatedAt` — fine, since
 *    these rows are INSERT-only in practice (never updated by the detector).
 *  - A `pending_approval` outcome on this table CANNOT actually hide the
 *    row from the public page (no reviewStatus gate exists to flip) — it
 *    stays visible while awaiting the Telegram Igen/Nem answer, same as it
 *    already would with zero verification at all. This only weakens SC-003
 *    for THIS one table; the other 4 keep the full guarantee.
 */
export const assetRecoveryTarget: VerificationTarget = {
  tableName: 'asset_recovery',

  async getCandidates(db, limit) {
    const rows = (await db.execute(sql`
      SELECT ar."id", ar."caseLabel", ar."description", ar."recoveredAt", ar."sourceUrl"
      FROM "AssetRecovery" ar
      WHERE ar."createdAt" > COALESCE(
        (SELECT MAX(vc."checkedAt") FROM "VerificationCheck" vc
         WHERE vc."targetTable" = 'asset_recovery' AND vc."targetId" = ar."id"
           AND vc."outcome" IN ${TERMINAL_OUTCOMES}),
        '-infinity'::timestamptz
      )
      ORDER BY ar."createdAt" ASC
      LIMIT ${limit}
    `)) as unknown as Array<{
      id: string;
      caseLabel: string;
      description: string;
      recoveredAt: string;
      sourceUrl: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      entityName: r.caseLabel,
      eventDateIso: new Date(r.recoveredAt).toISOString().slice(0, 10),
      sourceUrls: r.sourceUrl ? [r.sourceUrl] : [],
      fields: {
        caseLabel: r.caseLabel,
        description: r.description,
      },
    }));
  },

  // Intentionally does not offer amountFt for correction — a bigint typo-fix
  // from LLM-supplied text is out of scope for this pass; if the amount
  // itself is wrong, "delete" (and manual re-entry) is the safer path.
  async applyCorrection(db, id, fields) {
    await db.execute(sql`
      UPDATE "AssetRecovery" SET
        "caseLabel" = COALESCE(${fields.caseLabel ?? null}, "caseLabel"),
        "description" = COALESCE(${fields.description ?? null}, "description")
      WHERE "id" = ${id}
    `);
  },

  async applyDelete(db, id) {
    await db.execute(sql`DELETE FROM "AssetRecovery" WHERE "id" = ${id}`);
  },
};

export const criminalComplaintTarget: VerificationTarget = {
  tableName: 'criminal_complaint',

  async getCandidates(db, limit) {
    const rows = (await db.execute(sql`
      SELECT cc."id", cc."targetName", cc."filerName", cc."description", cc."amountLabel",
             cc."eventDate", cc."sourceUrls"
      FROM "CriminalComplaint" cc
      WHERE cc."reviewStatus" != 'rejected'
        AND cc."updatedAt" > COALESCE(
          (SELECT MAX(vc."checkedAt") FROM "VerificationCheck" vc
           WHERE vc."targetTable" = 'criminal_complaint' AND vc."targetId" = cc."id"
             AND vc."outcome" IN ${TERMINAL_OUTCOMES}),
          '-infinity'::timestamptz
        )
      ORDER BY cc."updatedAt" ASC
      LIMIT ${limit}
    `)) as unknown as Array<{
      id: string;
      targetName: string;
      filerName: string;
      description: string | null;
      amountLabel: string | null;
      eventDate: string;
      sourceUrls: string[];
    }>;

    return rows.map((r) => ({
      id: r.id,
      entityName: r.targetName,
      eventDateIso: new Date(r.eventDate).toISOString().slice(0, 10),
      sourceUrls: r.sourceUrls ?? [],
      fields: {
        targetName: r.targetName,
        filerName: r.filerName,
        description: r.description ?? '',
        amountLabel: r.amountLabel ?? '',
      },
    }));
  },

  // `status` is deliberately NOT correctable here — its lifecycle is owned
  // by decideComplaintTransition()'s dedicated monotonic state machine
  // (review.ts); this verifier only fixes factual/typo fields, never
  // status transitions, to avoid fighting that other mechanism.
  async applyCorrection(db, id, fields) {
    await db.execute(sql`
      UPDATE "CriminalComplaint" SET
        "targetName" = COALESCE(${fields.targetName ?? null}, "targetName"),
        "filerName" = COALESCE(${fields.filerName ?? null}, "filerName"),
        "description" = COALESCE(${fields.description ?? null}, "description"),
        "amountLabel" = COALESCE(${fields.amountLabel || null}, "amountLabel"),
        "updatedAt" = now()
      WHERE "id" = ${id}
    `);
  },

  async applyDelete(db, id) {
    await db.execute(sql`DELETE FROM "CriminalComplaint" WHERE "id" = ${id}`);
  },
};

export const ALL_VERIFICATION_TARGETS: VerificationTarget[] = [
  politicalResignationTarget,
  courtVerdictTarget,
  mediaClosureTarget,
  assetRecoveryTarget,
  criminalComplaintTarget,
];
