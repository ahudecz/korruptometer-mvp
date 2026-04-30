import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const caseStatusEnum = pgEnum('case_status', [
  'Lezárva',
  'Vádemelés',
  'Folyamatban',
]);

export const sectorEnum = pgEnum('sector', [
  'Közbeszerzés',
  'Önkormányzat',
  'Állami vállalat',
  'EU pályázat',
  'Egészségügy',
  'Egyéb',
]);

export const detentionEnum = pgEnum('detention', [
  'loose',
  'wanted',
  'busted',
  'pretrial',
  'investig',
]);

export const sourceTagEnum = pgEnum('source_tag', [
  'investigative',
  'national',
  'regional',
  'agency',
  'newsletter',
]);

export const cases = pgTable(
  'Case',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    position: text('position').notNull(),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    sentenceYears: integer('sentenceYears').notNull(),
    caseYear: integer('caseYear').notNull(),
    status: caseStatusEnum('status').notNull(),
    region: text('region').notNull(),
    sector: sectorEnum('sector').notNull(),
    summary: text('summary'),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    amountIdx: index('Case_amount_idx').on(t.amount),
    yearIdx: index('Case_year_idx').on(t.caseYear),
    sectorIdx: index('Case_sector_idx').on(t.sector),
    regionIdx: index('Case_region_idx').on(t.region),
    statusIdx: index('Case_status_idx').on(t.status),
  }),
);

export const rogueProfiles = pgTable(
  'RogueProfile',
  {
    caseId: text('caseId')
      .primaryKey()
      .references(() => cases.id, { onDelete: 'cascade' }),
    variant: integer('variant').notNull(),
    glasses: boolean('glasses').notNull().default(false),
    hair: text('hair').notNull(),
    detention: detentionEnum('detention').notNull(),
    detentionLabel: text('detentionLabel').notNull(),
    crimes: text('crimes').array().notNull(),
    extraStatus: text('extraStatus'),
    mugshotUrl: text('mugshotUrl'),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const sources = pgTable('Source', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  homepage: text('homepage').notNull(),
  tag: sourceTagEnum('tag').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  lastScrapedAt: timestamp('lastScrapedAt', { withTimezone: true }),
  lastSuccessAt: timestamp('lastSuccessAt', { withTimezone: true }),
  consecutiveFailures: integer('consecutiveFailures').notNull().default(0),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const newsArticles = pgTable(
  'NewsArticle',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceId: uuid('sourceId')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    headline: text('headline').notNull(),
    excerpt: text('excerpt').notNull(),
    sourceUrl: text('sourceUrl').notNull(),
    sourceUrlHash: text('sourceUrlHash').notNull(),
    publishedAt: timestamp('publishedAt', { withTimezone: true }).notNull(),
    tag: text('tag'),
    relatedCaseId: text('relatedCaseId').references(() => cases.id, {
      onDelete: 'set null',
    }),
    linkConfidence: integer('linkConfidence'),
    linkOverridden: boolean('linkOverridden').notNull().default(false),
    featured: boolean('featured').notNull().default(false),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    urlHashIdx: uniqueIndex('NewsArticle_sourceUrlHash_idx').on(
      t.sourceUrlHash,
    ),
    publishedIdx: index('NewsArticle_publishedAt_idx').on(t.publishedAt),
    relatedCaseIdx: index('NewsArticle_relatedCaseId_idx').on(t.relatedCaseId),
  }),
);

export const kpiSnapshots = pgTable('KpiSnapshot', {
  id: text('id').primaryKey().default('singleton'),
  computedAt: timestamp('computedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  totalDamage: bigint('totalDamage', { mode: 'bigint' }).notNull(),
  totalPrisonYears: integer('totalPrisonYears').notNull(),
  activeCases: integer('activeCases').notNull(),
  newIndictmentsThisWeek: integer('newIndictmentsThisWeek').notNull(),
  partnerCount: integer('partnerCount').notNull(),
  bySector: jsonb('bySector').notNull(),
});

// ─── Phase 2: submissions + admin ─────────────────────────────────────────

export const submissionStatusEnum = pgEnum('submission_status', [
  'received',
  'in_review',
  'approved',
  'rejected',
  'duplicate',
]);

export const virusScanStatusEnum = pgEnum('virus_scan_status', [
  'pending',
  'clean',
  'infected',
  'error',
]);

export const editorRoleEnum = pgEnum('editor_role', ['admin', 'editor']);

export const submissions = pgTable(
  'Submission',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ref: text('ref').notNull().unique(),
    suspectName: text('suspectName').notNull(),
    suspectPosition: text('suspectPosition'),
    suspectRegion: text('suspectRegion'),
    period: text('period'),
    crimes: text('crimes').array().notNull(),
    estimatedAmount: bigint('estimatedAmount', { mode: 'bigint' }),
    summary: text('summary'),
    sourceUrls: text('sourceUrls').array().notNull().default(sql`ARRAY[]::text[]`),
    anonymous: boolean('anonymous').notNull().default(true),
    allowContact: boolean('allowContact').notNull().default(false),
    reporterEmailEnc: text('reporterEmailEnc'),
    reporterNameEnc: text('reporterNameEnc'),
    status: submissionStatusEnum('status').notNull().default('received'),
    purgePiiAt: timestamp('purgePiiAt', { withTimezone: true }),
    createdCaseId: text('createdCaseId').references(() => cases.id, {
      onDelete: 'set null',
    }),
    bodyCipher: text('bodyCipher'),
    reporterEmailCipher: text('reporterEmailCipher'),
    reporterNameCipher: text('reporterNameCipher'),
    recipientFingerprints: text('recipientFingerprints').array(),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusCreatedIdx: index('Submission_status_createdAt_idx').on(
      t.status,
      t.createdAt,
    ),
    purgeIdx: index('Submission_purgePiiAt_idx').on(t.purgePiiAt),
  }),
);

export const submissionAttachments = pgTable(
  'SubmissionAttachment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    submissionId: uuid('submissionId')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    storageKey: text('storageKey').notNull(),
    fileName: text('fileName').notNull(),
    mimeType: text('mimeType').notNull(),
    sizeBytes: bigint('sizeBytes', { mode: 'number' }).notNull(),
    virusScanStatus: virusScanStatusEnum('virusScanStatus')
      .notNull()
      .default('pending'),
    virusScanDetail: text('virusScanDetail'),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    submissionIdx: index('SubmissionAttachment_submissionId_idx').on(
      t.submissionId,
    ),
  }),
);

export const editors = pgTable('Editor', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('displayName'),
  role: editorRoleEnum('role').notNull().default('editor'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const editorKeys = pgTable('EditorKey', {
  id: uuid('id').defaultRandom().primaryKey(),
  editorId: uuid('editorId')
    .notNull()
    .references(() => editors.id, { onDelete: 'cascade' }),
  publicKey: text('publicKey').notNull(),
  fingerprint: text('fingerprint').notNull(),
  revokedAt: timestamp('revokedAt', { withTimezone: true }),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditLogs = pgTable(
  'AuditLog',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorEditorId: uuid('actorEditorId').references(() => editors.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    entityType: text('entityType').notNull(),
    entityId: text('entityId').notNull(),
    detail: jsonb('detail'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorAtIdx: index('AuditLog_actorAt_idx').on(t.actorEditorId, t.at),
    entityIdx: index('AuditLog_entity_idx').on(t.entityType, t.entityId, t.at),
  }),
);

export const dsrKindEnum = pgEnum('dsr_kind', ['access', 'deletion']);
export const dsrStatusEnum = pgEnum('dsr_status', [
  'received',
  'verified',
  'fulfilled',
  'closed',
]);

export const dsrRequests = pgTable('DsrRequest', {
  id: uuid('id').defaultRandom().primaryKey(),
  subjectEmailHash: text('subjectEmailHash').notNull(),
  kind: dsrKindEnum('kind').notNull(),
  status: dsrStatusEnum('status').notNull().default('received'),
  slaDeadline: timestamp('slaDeadline', { withTimezone: true }).notNull(),
  assignedEditorId: uuid('assignedEditorId').references(() => editors.id, {
    onDelete: 'set null',
  }),
  notes: text('notes'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Phase 3: scraper observability ───────────────────────────────────────

export const scraperRunStatusEnum = pgEnum('scraper_run_status', [
  'running',
  'success',
  'failure',
]);

export const scraperRuns = pgTable(
  'ScraperRun',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceId: uuid('sourceId')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    startedAt: timestamp('startedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp('finishedAt', { withTimezone: true }),
    status: scraperRunStatusEnum('status').notNull().default('running'),
    articlesFound: integer('articlesFound').notNull().default(0),
    articlesNew: integer('articlesNew').notNull().default(0),
    errorMessage: text('errorMessage'),
  },
  (t) => ({
    sourceStartIdx: index('ScraperRun_sourceId_startedAt_idx').on(
      t.sourceId,
      t.startedAt,
    ),
  }),
);

export const workerHeartbeats = pgTable('WorkerHeartbeat', {
  id: text('id').primaryKey().default('singleton'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

export type Case = typeof cases.$inferSelect;
export type NewCase = typeof cases.$inferInsert;
export type RogueProfile = typeof rogueProfiles.$inferSelect;
export type NewsArticle = typeof newsArticles.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type KpiSnapshot = typeof kpiSnapshots.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type SubmissionAttachment = typeof submissionAttachments.$inferSelect;
export type Editor = typeof editors.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type EditorKey = typeof editorKeys.$inferSelect;
export type ScraperRun = typeof scraperRuns.$inferSelect;
export type DsrRequest = typeof dsrRequests.$inferSelect;
export type SectorBreakdown = { name: string; value: number }[];

// Use placate-typescript export for the singleton cap (no client cares but Drizzle plays nice).
export const _unused = sql`1`;
