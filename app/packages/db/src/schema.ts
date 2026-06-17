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
    imageUrl: text('imageUrl'),
    relatedCaseId: text('relatedCaseId').references(() => cases.id, {
      onDelete: 'set null',
    }),
    linkConfidence: integer('linkConfidence'),
    linkOverridden: boolean('linkOverridden').notNull().default(false),
    featured: boolean('featured').notNull().default(false),
    viaArchive: boolean('viaArchive').notNull().default(false),
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

// ─── Phase 3: K-Monitor case discovery (FR-076..080) ──────────────────────

export const kmonitorApprovalStateEnum = pgEnum('kmonitor_approval_state', [
  'pending',
  'approved',
  'rejected',
]);

export const kMonitorPersonCandidates = pgTable(
  'KMonitorPersonCandidate',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Name as rendered in kmdb_base persons[]. */
    displayName: text('displayName').notNull(),
    /** Lowercased, accent-stripped key for dedup. */
    normalizedName: text('normalizedName').notNull().unique(),
    /** Total kmdb_base articles mentioning this person. */
    mentionCount: integer('mentionCount').notNull().default(0),
    /** Subset of mentionCount where at least one HUF amount was extracted. */
    articleCountWithAmount: integer('articleCountWithAmount').notNull().default(0),
    /** Median HUF amount across articles-with-amount. Legacy — superseded by p50. */
    medianAmountHuf: bigint('medianAmountHuf', { mode: 'bigint' }),
    /** 75th-percentile amount. Legacy. */
    p75AmountHuf: bigint('p75AmountHuf', { mode: 'bigint' }),
    /** 1st percentile — the floor of credible amounts attributed to this person. */
    p1AmountHuf: bigint('p1AmountHuf', { mode: 'bigint' }),
    /** 10th percentile — conservative floor. */
    p10AmountHuf: bigint('p10AmountHuf', { mode: 'bigint' }),
    /** 50th percentile — median; identical to `medianAmountHuf` going forward. */
    p50AmountHuf: bigint('p50AmountHuf', { mode: 'bigint' }),
    /** 90th percentile — upper-typical figure. */
    p90AmountHuf: bigint('p90AmountHuf', { mode: 'bigint' }),
    /** 99th percentile — the headline-figure ceiling. */
    p99AmountHuf: bigint('p99AmountHuf', { mode: 'bigint' }),
    /** Top topics from per-article `others[]` rolled up: [{topic, count}]. */
    topTopics: jsonb('topTopics'),
    /** Single biggest mentioned amount. Often noisy. */
    maxAmountHuf: bigint('maxAmountHuf', { mode: 'bigint' }),
    /** Top co-occurring institutions as [{institution, count}]. */
    topInstitutions: jsonb('topInstitutions'),
    /** Top co-occurring persons as [{person, count}]. */
    topPersons: jsonb('topPersons'),
    /** Up to 5 evidence URLs: [{newsId, sourceUrl, title}]. */
    sampleArticles: jsonb('sampleArticles'),
    /** LLM-refined HUF amount (Slice 10 — Haiku 4.5 with structured output). */
    llmAmountHuf: bigint('llmAmountHuf', { mode: 'bigint' }),
    /** Self-reported confidence 0..1 from the LLM. */
    llmConfidence: integer('llmConfidence'),
    /** Short evidence quote / rationale from the LLM. */
    llmEvidence: text('llmEvidence'),
    /** Set to now() on each LLM pass — null means 'not yet checked'. */
    llmCheckedAt: timestamp('llmCheckedAt', { withTimezone: true }),
    firstSeenAt: timestamp('firstSeenAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('lastSeenAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    approvalState: kmonitorApprovalStateEnum('approvalState')
      .notNull()
      .default('pending'),
    caseId: text('caseId').references(() => cases.id, { onDelete: 'set null' }),
    /** Timestamp of the most recent approve/reject decision; null while pending. */
    decidedAt: timestamp('decidedAt', { withTimezone: true }),
    /** Editor who made the most recent approve/reject decision; null while pending. */
    decidedBy: uuid('decidedBy').references(() => editors.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    approvalIdx: index('KMonitorPersonCandidate_approvalState_idx').on(
      t.approvalState,
    ),
    mentionIdx: index('KMonitorPersonCandidate_mentionCount_idx').on(
      t.mentionCount,
    ),
    decidedAtIdx: index('KMonitorPersonCandidate_decidedAt_idx').on(t.decidedAt),
  }),
);

/**
 * One row per unique kmdb_base article. Articles link many-to-many to
 * KMonitorPersonCandidate through KMonitorPersonArticle. We store the
 * editorially-relevant slice of kmdb_base — not the full body — so the
 * admin side-panel can show evidence URLs, topics, and the extracted HUF
 * amount without re-fetching from Hugging Face.
 */
export const kMonitorArticles = pgTable(
  'KMonitorArticle',
  {
    newsId: integer('newsId').primaryKey(),
    sourceUrl: text('sourceUrl').notNull().default(''),
    archiveUrl: text('archiveUrl'),
    title: text('title').notNull().default(''),
    pubTime: timestamp('pubTime', { withTimezone: true }),
    /** Largest HUF amount extracted from the article text (regex). */
    amountHuf: bigint('amountHuf', { mode: 'bigint' }),
    /** Newspaper as recorded by kmdb_base (e.g. "Telex", "444"). */
    newspaper: text('newspaper'),
    /** K-Monitor's coarse `category` field. */
    category: text('category'),
    /** Topic tags from kmdb_base `others[]` — építőipar, sport, energia, etc. */
    topics: jsonb('topics'),
    institutions: jsonb('institutions'),
    places: jsonb('places'),
    importedAt: timestamp('importedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pubTimeIdx: index('KMonitorArticle_pubTime_idx').on(t.pubTime),
    newspaperIdx: index('KMonitorArticle_newspaper_idx').on(t.newspaper),
  }),
);

/**
 * Person ↔ article join. amountHuf duplicates KMonitorArticle.amountHuf
 * for ordering convenience (so the side-panel "top 20 by claimed amount"
 * query is a simple sort on this join row).
 */
export const kMonitorPersonArticles = pgTable(
  'KMonitorPersonArticle',
  {
    personId: uuid('personId')
      .notNull()
      .references(() => kMonitorPersonCandidates.id, { onDelete: 'cascade' }),
    newsId: integer('newsId')
      .notNull()
      .references(() => kMonitorArticles.newsId, { onDelete: 'cascade' }),
    amountHuf: bigint('amountHuf', { mode: 'bigint' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.personId, t.newsId] }),
    personAmountIdx: index('KMonitorPersonArticle_personId_amount_idx').on(
      t.personId,
      t.amountHuf,
    ),
  }),
);

export const kMonitorTagCandidates = pgTable(
  'KMonitorTagCandidate',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    firstSeenAt: timestamp('firstSeenAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('lastSeenAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    approvalState: kmonitorApprovalStateEnum('approvalState')
      .notNull()
      .default('pending'),
    caseId: text('caseId').references(() => cases.id, { onDelete: 'set null' }),
    articleCount: integer('articleCount').notNull().default(0),
    lastTraversedAt: timestamp('lastTraversedAt', { withTimezone: true }),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    approvalIdx: index('KMonitorTagCandidate_approvalState_idx').on(
      t.approvalState,
    ),
    firstSeenIdx: index('KMonitorTagCandidate_firstSeenAt_idx').on(
      t.firstSeenAt,
    ),
  }),
);

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
export type KMonitorTagCandidate = typeof kMonitorTagCandidates.$inferSelect;
export type NewKMonitorTagCandidate = typeof kMonitorTagCandidates.$inferInsert;
export type KMonitorPersonCandidate = typeof kMonitorPersonCandidates.$inferSelect;
export type NewKMonitorPersonCandidate = typeof kMonitorPersonCandidates.$inferInsert;
export type KMonitorArticle = typeof kMonitorArticles.$inferSelect;
export type NewKMonitorArticle = typeof kMonitorArticles.$inferInsert;
export type KMonitorPersonArticle = typeof kMonitorPersonArticles.$inferSelect;
export type NewKMonitorPersonArticle = typeof kMonitorPersonArticles.$inferInsert;
export type SectorBreakdown = { name: string; value: number }[];

// Use placate-typescript export for the singleton cap (no client cares but Drizzle plays nice).
export const _unused = sql`1`;

// ─── Political Resignations Tracker ──────────────────────────────────────

export const resignationTypeEnum = pgEnum('resignation_type', [
  'lemondás',
  'kirúgás',
  'felmentés',
  'egyéb',
  'Hivatalban van',
]);

export const politicalResignations = pgTable(
  'PoliticalResignation',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    position: text('position').notNull(),
    institution: text('institution').notNull(),
    resignationType: resignationTypeEnum('resignationType').notNull(),
    resignationDate: timestamp('resignationDate', { withTimezone: true }).notNull(),
    description: text('description'),
    pinned: boolean('pinned').notNull().default(false),
    sourceUrls: text('sourceUrls').array().notNull().default(sql`ARRAY[]::text[]`),
    sourceNames: text('sourceNames').array().notNull().default(sql`ARRAY[]::text[]`),
    relatedCaseId: text('relatedCaseId').references(() => cases.id, { onDelete: 'set null' }),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    resignationDateIdx: index('PoliticalResignation_resignationDate_idx').on(t.resignationDate),
    institutionIdx: index('PoliticalResignation_institution_idx').on(t.institution),
    typeIdx: index('PoliticalResignation_resignationType_idx').on(t.resignationType),
  }),
);

export type PoliticalResignation = typeof politicalResignations.$inferSelect;
export type NewPoliticalResignation = typeof politicalResignations.$inferInsert;

// ─── Media Closures Tracker ───────────────────────────────────────────────

export const mediaClosureTypeEnum = pgEnum('media_closure_type', [
  'megszűnés',
  'leépítés',
  'elmaradt esemény',
  'egyéb',
]);

export const mediaClosures = pgTable(
  'MediaClosure',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    eventType: mediaClosureTypeEnum('eventType').notNull(),
    description: text('description'),
    eventDate: timestamp('eventDate', { withTimezone: true }).notNull(),
    sourceUrl: text('sourceUrl'),
    sourceName: text('sourceName'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    eventDateIdx: index('MediaClosure_eventDate_idx').on(t.eventDate),
    typeIdx: index('MediaClosure_eventType_idx').on(t.eventType),
  }),
);

export type MediaClosure = typeof mediaClosures.$inferSelect;
export type NewMediaClosure = typeof mediaClosures.$inferInsert;

// ─── Asset Recoveries Tracker ─────────────────────────────────────────────

export const assetRecoveries = pgTable(
  'AssetRecovery',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    caseId: text('caseId').notNull(),
    caseLabel: text('caseLabel').notNull(),
    description: text('description').notNull(),
    amountFt: bigint('amountFt', { mode: 'bigint' }).notNull(),
    recoveredAt: timestamp('recoveredAt', { withTimezone: true }).notNull(),
    sourceUrl: text('sourceUrl'),
    sourceName: text('sourceName'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    caseIdIdx: index('AssetRecovery_caseId_idx').on(t.caseId),
    recoveredAtIdx: index('AssetRecovery_recoveredAt_idx').on(t.recoveredAt),
    amountIdx: index('AssetRecovery_amountFt_idx').on(t.amountFt),
  }),
);

export type AssetRecovery = typeof assetRecoveries.$inferSelect;
export type NewAssetRecovery = typeof assetRecoveries.$inferInsert;
