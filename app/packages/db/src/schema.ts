import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
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
    isBreakingCandidate: boolean('isBreakingCandidate').notNull().default(false),
    breakingOverride: boolean('breakingOverride'),
    // Kézzel kitűzött BREAKING, időkorláttal védve — amíg a jövőben van, a
    // legmagasabb prioritási szint (breaking.ts / breaking-pick.ts), a
    // refresh-daily-breaking cron sem írja felül. Ugyanaz a minta, mint a
    // PodcastVideo.pinnedUntil.
    breakingPinnedUntil: timestamp('breakingPinnedUntil', { withTimezone: true }),
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
    breakingPinnedUntilIdx: index('NewsArticle_breakingPinnedUntil_idx').on(t.breakingPinnedUntil),
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
    /** Canonical outlet URL + dedup hash (same canonicalUrl()/dedupHash() the
     *  scraper uses) — the shared identity with NewsArticle. */
    canonicalUrl: text('canonicalUrl'),
    urlHash: text('urlHash'),
    /** Set when this kmdb article duplicates a scraped NewsArticle; such rows
     *  are enrichment, not a separate engine extraction input. */
    matchedNewsArticleId: uuid('matchedNewsArticleId').references(
      () => newsArticles.id,
      { onDelete: 'set null' },
    ),
  },
  (t) => ({
    pubTimeIdx: index('KMonitorArticle_pubTime_idx').on(t.pubTime),
    newspaperIdx: index('KMonitorArticle_newspaper_idx').on(t.newspaper),
    urlHashIdx: index('KMonitorArticle_urlHash_idx').on(t.urlHash),
    matchedIdx: index('KMonitorArticle_matched_idx').on(t.matchedNewsArticleId),
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

// ─── 002-investigation-engine — schema mirror of 0011_investigation_engine.sql ─

export const articleSourceEnum = pgEnum('article_source', [
  'news',
  'kmonitor',
]);

export const corruptionMechanismEnum = pgEnum('corruption_mechanism', [
  'overpricing',
  'no_bid',
  'kickback',
  'amendment_inflation',
  'phantom_service',
  'related_party',
  'other',
]);

export const amountBasisEnum = pgEnum('amount_basis', [
  'stated',
  'computed',
  'estimated',
]);

export const investigationStatusEnum = pgEnum('investigation_status', [
  'new',
  'dismissed',
  'merged',
]);

export const disclosureTierEnum = pgEnum('disclosure_tier', [
  'internal',
  'journalist',
  'prosecutor',
  'public',
]);

export const externalSourceSystemEnum = pgEnum('external_source_system', [
  'TED',
  'EKR',
  'KE',
  'palyazat',
  'ecegjegyzek',
  'opencorporates',
  'integritas',
  'olaf',
  'ksh',
  'eurostat',
  'kmonitor',
  'atlatszo',
  'webarchive',
  'manual_opten',
  'manual_other',
]);

export const relevanceEnum = pgEnum('relevance', [
  'corroborates',
  'contradicts',
  'context',
  'benchmark',
]);

export const evidenceGradeEnum = pgEnum('evidence_grade', [
  'rumor',
  'opinion_press',
  'opposition_politician',
  'investigative_journalism',
  'prosecutor_statement',
  'audit_report',
  'court_document',
]);

export const redflagSeverityEnum = pgEnum('redflag_severity', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const redflagVerdictEnum = pgEnum('redflag_verdict', [
  'pass',
  'fail',
  'not_applicable',
]);

export const leadKindEnum = pgEnum('lead_kind', [
  'hypothesis',
  'search_lead',
  'reviewer_question',
  'escalation',
  'cluster_ambiguous',
]);

export const leadStatusEnum = pgEnum('lead_status', [
  'open',
  'tested',
  'resolved',
  'rejected',
]);

export const leadActorKindEnum = pgEnum('lead_actor_kind', [
  'agent',
  'reviewer',
  'system',
]);

export const partyKindEnum = pgEnum('party_kind', ['person', 'entity']);

// ─── Case-catalog classification layer ───────────────────────────────────────
// Authority-grade axes folded onto Investigation: legal offence type (Axis 1),
// procedural stage (Axis 5), competent authority + matter tier (Axis 4), and the
// canonical case key that makes case identity idempotent (no duplicate cases).

// Axis 5 — procedural stage ladder (criminal-justice pipeline). A case is "open"
// while its stage is not one of the terminal states (final_verdict / acquitted /
// closed_no_charge); openness is decided in app logic, not encoded here.
export const proceduralStageEnum = pgEnum('procedural_stage', [
  'reported',
  'investigating',
  'suspect_charged',
  'indicted',
  'on_trial',
  'verdict_first_instance',
  'final_verdict',
  'closed_no_charge',
  'acquitted',
]);

// Axis 4 — competent authority. Hungary is not an EPPO participant; 'eppo' is
// retained for completeness/cross-border matters but HU cases route through
// prosecution / integrity_authority / olaf.
export const competentAuthorityEnum = pgEnum('competent_authority', [
  'national_police',
  'prosecution',
  'integrity_authority',
  'state_audit_asz',
  'olaf',
  'eppo',
  'court',
  'eu_commission',
  'other',
  'unknown',
]);

// Axis 4 — OLAF crime/irregularity split.
export const matterTierEnum = pgEnum('matter_tier', [
  'fraud',
  'corruption',
  'conflict_of_interest',
  'irregularity',
  'unknown',
]);

// Axis 1 — two-level offence-type vocabulary. The controlled list of legal
// offence codes keyed to the Hungarian Criminal Code (Btk.) and UNCAC, each
// mapped to a plain-Hungarian public label and to the K-Monitor topics that
// bootstrap-classify articles deterministically before any LLM step.
// Btk. section references are indicative and must be verified against the
// current Act C of 2012 text during backfill.
export const offenceTypeRefs = pgTable('OffenceTypeRef', {
  code: text('code').primaryKey(),
  labelHu: text('labelHu').notNull(),
  labelEn: text('labelEn'),
  btkSection: text('btkSection'),
  uncacCategory: text('uncacCategory'),
  matterTierDefault: matterTierEnum('matterTierDefault')
    .notNull()
    .default('unknown'),
  kmonitorTopics: jsonb('kmonitorTopics')
    .notNull()
    .default(sql`'[]'::jsonb`),
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const articleExtractionRuns = pgTable(
  'ArticleExtractionRun',
  {
    articleSource: articleSourceEnum('articleSource').notNull(),
    articleId: text('articleId').notNull(),
    extractorVersion: text('extractorVersion').notNull(),
    claimCount: integer('claimCount').notNull(),
    extractedAt: timestamp('extractedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    model: text('model').notNull(),
    inputTokens: integer('inputTokens').notNull(),
    outputTokens: integer('outputTokens').notNull(),
    estimatedHufSpend: numeric('estimatedHufSpend', {
      precision: 14,
      scale: 2,
    }).notNull(),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.articleSource, t.articleId, t.extractorVersion],
    }),
    extractedAtIdx: index('ArticleExtractionRun_article_extractedAt_idx').on(
      t.articleSource,
      t.articleId,
      t.extractedAt,
    ),
  }),
);

export const articleClaims = pgTable(
  'ArticleClaim',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    articleSource: articleSourceEnum('articleSource').notNull(),
    articleId: text('articleId').notNull(),
    claimOrdinal: integer('claimOrdinal').notNull(),
    extractorVersion: text('extractorVersion').notNull(),
    mechanism: corruptionMechanismEnum('mechanism').notNull(),
    allegedAmountHuf: bigint('allegedAmountHuf', { mode: 'bigint' }),
    amountBasis: amountBasisEnum('amountBasis'),
    parties: jsonb('parties').notNull(),
    evidenceQuote: text('evidenceQuote').notNull(),
    sourceUrl: text('sourceUrl').notNull(),
    paragraphLocator: text('paragraphLocator').notNull(),
    model: text('model').notNull(),
    confidence: integer('confidence').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    idempotencyUq: uniqueIndex('ArticleClaim_idempotency_uq').on(
      t.articleSource,
      t.articleId,
      t.claimOrdinal,
      t.extractorVersion,
    ),
    articleIdx: index('ArticleClaim_article_idx').on(
      t.articleSource,
      t.articleId,
    ),
  }),
);

export const investigations = pgTable(
  'Investigation',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    status: investigationStatusEnum('status').notNull().default('new'),
    mergedIntoId: uuid('mergedIntoId'),
    primaryPersonName: text('primaryPersonName'),
    primaryPersonNormalized: text('primaryPersonNormalized'),
    primaryEntityName: text('primaryEntityName'),
    primaryEntityNormalized: text('primaryEntityNormalized'),
    caseName: text('caseName'),
    scandalKey: text('scandalKey'),
    scandalName: text('scandalName'),
    summary: text('summary'),
    quantityScore: numeric('quantityScore', { precision: 6, scale: 2 })
      .notNull()
      .default('0'),
    qualityScore: evidenceGradeEnum('qualityScore'),
    disclosureTier: disclosureTierEnum('disclosureTier')
      .notNull()
      .default('internal'),
    publicCaseId: text('publicCaseId').references(() => cases.id, {
      onDelete: 'set null',
    }),
    articleCount: integer('articleCount').notNull().default(0),
    oldestExternalRecordFetchedAt: timestamp('oldestExternalRecordFetchedAt', {
      withTimezone: true,
    }),
    // ── Catalog classification axes (nullable until classified) ──
    offenceTypes: text('offenceTypes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    proceduralStage: proceduralStageEnum('proceduralStage'),
    competentAuthority: competentAuthorityEnum('competentAuthority'),
    matterTier: matterTierEnum('matterTier'),
    // ── Idempotency anchor: stable case identity derived from the strongest
    //    available identifier (court no. > procurement ID > entity+contract
    //    hash). On re-ingestion a claim resolves to the existing case by this
    //    key instead of spawning a duplicate. caseKeySource records which kind
    //    of identifier produced it.
    canonicalCaseKey: text('canonicalCaseKey'),
    caseKeySource: text('caseKeySource'),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusIdx: index('Investigation_status_idx').on(t.status),
    tierStatusIdx: index('Investigation_tier_status_idx').on(
      t.disclosureTier,
      t.status,
    ),
    refreshPriorityIdx: index('Investigation_refresh_priority_idx').on(
      t.articleCount,
      t.oldestExternalRecordFetchedAt,
    ),
    // One live case per canonical key — merged duplicates are exempt so a
    // collapsed case never collides with its survivor.
    canonicalCaseKeyUq: uniqueIndex('Investigation_canonicalCaseKey_uq')
      .on(t.canonicalCaseKey)
      .where(sql`"canonicalCaseKey" IS NOT NULL AND status <> 'merged'`),
    offenceTypesIdx: index('Investigation_offenceTypes_idx').using(
      'gin',
      t.offenceTypes,
    ),
    proceduralStageIdx: index('Investigation_proceduralStage_idx').on(
      t.proceduralStage,
    ),
  }),
);

export const investigationArticleLinks = pgTable(
  'InvestigationArticleLink',
  {
    investigationId: uuid('investigationId')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    articleSource: articleSourceEnum('articleSource').notNull(),
    articleId: text('articleId').notNull(),
    role: text('role').notNull().default('primary'),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.investigationId, t.articleSource, t.articleId],
    }),
    articleIdx: index('InvestigationArticleLink_article_idx').on(
      t.articleSource,
      t.articleId,
    ),
  }),
);

export const externalRecords = pgTable(
  'ExternalRecord',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigationId')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    sourceSystem: externalSourceSystemEnum('sourceSystem').notNull(),
    externalId: text('externalId').notNull(),
    canonicalUrl: text('canonicalUrl').notNull(),
    fetchedAt: timestamp('fetchedAt', { withTimezone: true }).notNull(),
    fetchHash: text('fetchHash').notNull(),
    recordType: text('recordType').notNull(),
    rawPayload: jsonb('rawPayload').notNull(),
    relevance: relevanceEnum('relevance'),
    evidenceGrade: evidenceGradeEnum('evidenceGrade'),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex('ExternalRecord_uq').on(
      t.investigationId,
      t.sourceSystem,
      t.externalId,
    ),
    sourceFetchedIdx: index('ExternalRecord_source_fetched_idx').on(
      t.sourceSystem,
      t.fetchedAt,
    ),
    investigationSourceIdx: index('ExternalRecord_investigation_source_idx').on(
      t.investigationId,
      t.sourceSystem,
    ),
  }),
);

export const redFlagChecks = pgTable(
  'RedFlagCheck',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigationId')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    ruleId: text('ruleId').notNull(),
    severity: redflagSeverityEnum('severity').notNull(),
    verdict: redflagVerdictEnum('verdict').notNull(),
    observationHu: text('observationHu').notNull(),
    supportingRecordIds: uuid('supportingRecordIds')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    evaluatedAt: timestamp('evaluatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ruleUq: uniqueIndex('RedFlagCheck_rule_uq').on(t.investigationId, t.ruleId),
    severityIdx: index('RedFlagCheck_investigation_severity_idx').on(
      t.investigationId,
      t.severity,
    ),
  }),
);

export const investigationLeads = pgTable(
  'InvestigationLead',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigationId')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    kind: leadKindEnum('kind').notNull(),
    status: leadStatusEnum('status').notNull().default('open'),
    question: text('question').notNull(),
    testedAgainst: jsonb('testedAgainst'),
    finding: text('finding'),
    createdBy: leadActorKindEnum('createdBy').notNull(),
    actorEditorId: uuid('actorEditorId').references(() => editors.id, {
      onDelete: 'set null',
    }),
    capFired: text('capFired'),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp('resolvedAt', { withTimezone: true }),
  },
  (t) => ({
    investigationStatusIdx: index(
      'InvestigationLead_investigation_status_idx',
    ).on(t.investigationId, t.status),
    statusCreatedIdx: index('InvestigationLead_status_createdAt_idx').on(
      t.status,
      t.createdAt,
    ),
  }),
);

export const investigationPublicCaseLinks = pgTable(
  'InvestigationPublicCaseLink',
  {
    investigationId: uuid('investigationId')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    publicCaseId: text('publicCaseId').notNull(),
    promotedAt: timestamp('promotedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    depromotedAt: timestamp('depromotedAt', { withTimezone: true }),
    promotedByEditorId: uuid('promotedByEditorId').references(() => editors.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.investigationId, t.publicCaseId] }),
    historyIdx: index('InvestigationPublicCaseLink_history_idx').on(
      t.investigationId,
      t.promotedAt,
    ),
  }),
);

export const benchmarks = pgTable(
  'Benchmark',
  {
    cohortHash: text('cohortHash').primaryKey(),
    dimension: text('dimension').notNull(),
    cohortSpec: jsonb('cohortSpec').notNull(),
    p10: numeric('p10').notNull(),
    p50: numeric('p50').notNull(),
    p90: numeric('p90').notNull(),
    n: integer('n').notNull(),
    memberRecordIds: uuid('memberRecordIds').array().notNull(),
    computedAt: timestamp('computedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    dimensionIdx: index('Benchmark_dimension_computedAt_idx').on(
      t.dimension,
      t.computedAt,
    ),
  }),
);

export const dailyLlmUsage = pgTable(
  'DailyLlmUsage',
  {
    day: date('day').notNull(),
    model: text('model').notNull(),
    inputTokens: bigint('inputTokens', { mode: 'bigint' }).notNull().default(0n),
    outputTokens: bigint('outputTokens', { mode: 'bigint' })
      .notNull()
      .default(0n),
    estimatedHufSpend: numeric('estimatedHufSpend', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    callCount: integer('callCount').notNull().default(0),
    firstCallAt: timestamp('firstCallAt', { withTimezone: true }),
    lastCallAt: timestamp('lastCallAt', { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.day, t.model] }),
    dayIdx: index('DailyLlmUsage_day_idx').on(t.day),
  }),
);

// 2026-07-21 — dedup marker for the "napi LLM-limit elérve" Telegram
// riasztáshoz (llm-budget-alert.ts). A napi ceiling-gate minden refuse-olt
// hívásnál újra megnézi, hogy spent >= ceiling — ez egy magas forgalmú napon
// akár százszor is igaz lehet ugyanarra a napra, de a riasztást csak EGYSZER
// akarjuk elküldeni. day PRIMARY KEY-re ON CONFLICT DO NOTHING RETURNING-gal
// pontosan egyszeri (idempotens) küldést ad, a már meglévő napi advisory
// lock alatt (l. llm.ts), külön zárolás nélkül.
export const llmBudgetAlerts = pgTable('LlmBudgetAlert', {
  day: date('day').notNull().primaryKey(),
  sentAt: timestamp('sentAt', { withTimezone: true }).notNull().defaultNow(),
});

// 2026-07-22 — a hash-alapú "már ismerjük" szűrő (scrape-news.ts,
// 2026-07-21) csak a korábban BEILLESZTETT (tier='in' vagy AI-elfogadott)
// cikkeket ismeri fel újra a NewsArticle.sourceUrlHash-en keresztül. Amit
// az AI korábban IRRELEVÁNSNAK ítélt, sosem kerül be a NewsArticle-be —
// arról eddig semmi nyilvántartás nem volt, úgyhogy minden órában újra
// fizetős classify-hívást kapott, amíg a forrás feedjéből ki nem csúszott.
// Ez a tábla zárja be ezt a maradék rést: minden AI-elutasítást (nem a
// tranziens hibákat, csak a valódi "nem releváns" választ) elmentünk, és a
// scrape-news előszűrője ezt is ellenőrzi a klasszifikáció előtt —
// szimmetrikusan a NewsArticle-alapú elfogadás-cache-sel (ami szintén
// permanens, sosem évül el).
export const scrapeClassifyRejects = pgTable('ScrapeClassifyReject', {
  sourceUrlHash: text('sourceUrlHash').notNull().primaryKey(),
  checkedAt: timestamp('checkedAt', { withTimezone: true }).notNull().defaultNow(),
});

export type ArticleExtractionRun = typeof articleExtractionRuns.$inferSelect;
export type NewArticleExtractionRun =
  typeof articleExtractionRuns.$inferInsert;
export type ArticleClaim = typeof articleClaims.$inferSelect;
export type NewArticleClaim = typeof articleClaims.$inferInsert;
export type Investigation = typeof investigations.$inferSelect;
export type NewInvestigation = typeof investigations.$inferInsert;
export type InvestigationArticleLink =
  typeof investigationArticleLinks.$inferSelect;
export type NewInvestigationArticleLink =
  typeof investigationArticleLinks.$inferInsert;
export type ExternalRecord = typeof externalRecords.$inferSelect;
export type NewExternalRecord = typeof externalRecords.$inferInsert;
export type RedFlagCheck = typeof redFlagChecks.$inferSelect;
export type NewRedFlagCheck = typeof redFlagChecks.$inferInsert;
export type InvestigationLead = typeof investigationLeads.$inferSelect;
export type NewInvestigationLead = typeof investigationLeads.$inferInsert;
export type InvestigationPublicCaseLink =
  typeof investigationPublicCaseLinks.$inferSelect;
export type NewInvestigationPublicCaseLink =
  typeof investigationPublicCaseLinks.$inferInsert;
export type Benchmark = typeof benchmarks.$inferSelect;
export type NewBenchmark = typeof benchmarks.$inferInsert;
export type DailyLlmUsage = typeof dailyLlmUsage.$inferSelect;
export type NewDailyLlmUsage = typeof dailyLlmUsage.$inferInsert;

// ─── Addendum 2026-05-19: Damage→Evidence Spine ─────────────────────────────
// Migration: 0012_damage_evidence_spine.sql
// Spec: specs/002-investigation-engine/data-model.md §"Addendum 2026-05-19"

export const damageConfidenceEnum = pgEnum('damage_confidence', [
  'low',
  'medium',
  'high',
]);

export const damageMethodEnum = pgEnum('damage_method', [
  'benchmark_deviation',
  'claim_consolidation',
  'amendment_delta',
  'industry_estimate',
]);

export const signalSourceKindEnum = pgEnum('signal_source_kind', [
  'external_record',
  'red_flag',
  'claim_corroboration',
  'benchmark_deviation',
]);

export const jobKindEnum = pgEnum('job_kind', [
  'xref',
  'redflags',
  'hypothesis_loop',
  'benchmarks',
  'damage_recompute',
]);

export const jobStateEnum = pgEnum('job_state', [
  'idle',
  'running',
  'done',
  'failed',
]);

export const damageEstimates = pgTable(
  'DamageEstimate',
  {
    investigationId: uuid('investigationId')
      .primaryKey()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    totalLowHuf: bigint('totalLowHuf', { mode: 'bigint' }).notNull(),
    totalHighHuf: bigint('totalHighHuf', { mode: 'bigint' }).notNull(),
    confidence: damageConfidenceEnum('confidence').notNull(),
    components: jsonb('components').notNull(),
    inputsHash: text('inputsHash').notNull(),
    computedAt: timestamp('computedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    componentCount: integer('componentCount').generatedAlwaysAs(
      sql`jsonb_array_length(components)`,
    ),
  },
  (t) => ({
    computedAtIdx: index('DamageEstimate_computedAt_idx').on(t.computedAt),
    emptyComponentsIdx: index('DamageEstimate_empty_components_idx')
      .on(t.investigationId)
      .where(sql`"componentCount" = 0`),
    totalsNonneg: check(
      'DamageEstimate_totals_nonneg',
      sql`"totalLowHuf" >= 0 AND "totalHighHuf" >= "totalLowHuf"`,
    ),
    componentsIsArray: check(
      'DamageEstimate_components_is_array',
      sql`jsonb_typeof(components) = 'array'`,
    ),
    inputsHashSha256: check(
      'DamageEstimate_inputsHash_sha256',
      sql`length("inputsHash") = 64`,
    ),
  }),
);

export const signalContributions = pgTable(
  'SignalContribution',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigationId')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    sourceKind: signalSourceKindEnum('sourceKind').notNull(),
    sourceId: text('sourceId').notNull(),
    baseWeight: numeric('baseWeight', { precision: 4, scale: 2 }).notNull(),
    stalenessMultiplier: numeric('stalenessMultiplier', {
      precision: 3,
      scale: 2,
    }).notNull(),
    effectiveWeight: numeric('effectiveWeight', {
      precision: 5,
      scale: 2,
    }).generatedAlwaysAs(sql`"baseWeight" * "stalenessMultiplier"`),
    addedAt: timestamp('addedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    investigationIdx: index('SignalContribution_investigation_idx').on(
      t.investigationId,
    ),
    uq: uniqueIndex('SignalContribution_uq').on(
      t.investigationId,
      t.sourceKind,
      t.sourceId,
    ),
    sourceIdx: index('SignalContribution_source_idx').on(
      t.sourceKind,
      t.sourceId,
    ),
    baseWeightRange: check(
      'SignalContribution_baseWeight_range',
      sql`"baseWeight" >= 0 AND "baseWeight" <= 5.00`,
    ),
    stalenessRange: check(
      'SignalContribution_staleness_range',
      sql`"stalenessMultiplier" > 0 AND "stalenessMultiplier" <= 1.00`,
    ),
  }),
);

export const investigationJobStates = pgTable(
  'InvestigationJobState',
  {
    investigationId: uuid('investigationId')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    jobKind: jobKindEnum('jobKind').notNull(),
    state: jobStateEnum('state').notNull().default('idle'),
    startedAt: timestamp('startedAt', { withTimezone: true }),
    finishedAt: timestamp('finishedAt', { withTimezone: true }),
    inngestRunId: text('inngestRunId'),
    summary: text('summary'),
    errorMessage: text('errorMessage'),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.investigationId, t.jobKind] }),
    runningIdx: index('InvestigationJobState_running_idx')
      .on(t.investigationId, t.updatedAt)
      .where(sql`state = 'running'`),
    startedWhenActive: check(
      'InvestigationJobState_started_when_active',
      sql`(state IN ('running', 'done', 'failed')) = ("startedAt" IS NOT NULL)`,
    ),
    finishedWhenTerminal: check(
      'InvestigationJobState_finished_when_terminal',
      sql`(state IN ('done', 'failed')) = ("finishedAt" IS NOT NULL)`,
    ),
    doneHasSummary: check(
      'InvestigationJobState_done_has_summary',
      sql`state <> 'done' OR summary IS NOT NULL`,
    ),
    failedHasError: check(
      'InvestigationJobState_failed_has_error',
      sql`state <> 'failed' OR "errorMessage" IS NOT NULL`,
    ),
  }),
);

export type DamageEstimate = typeof damageEstimates.$inferSelect;
export type NewDamageEstimate = typeof damageEstimates.$inferInsert;
export type SignalContribution = typeof signalContributions.$inferSelect;
export type NewSignalContribution = typeof signalContributions.$inferInsert;
export type InvestigationJobState = typeof investigationJobStates.$inferSelect;
export type NewInvestigationJobState =
  typeof investigationJobStates.$inferInsert;

// Use placate-typescript export for the singleton cap (no client cares but Drizzle plays nice).
export const _unused = sql`1`;

// ─── Detection Review (003-detection-review-engine) ──────────────────────
// Jóváhagyási állapot a hírekből detektált sorokhoz. Alapból 'approved' (a
// meglévő, kézzel felvitt sorok és a ≥0.90 auto-publikált találatok); a
// detektor a 'pending'/'rejected' értéket kifejezetten állítja be.
export const reviewStatusEnum = pgEnum('review_status', [
  'approved',
  'pending',
  'rejected',
]);

// ─── Political Resignations Tracker ──────────────────────────────────────

export const resignationTypeEnum = pgEnum('resignation_type', [
  'lemondás',
  'kirúgás',
  'felmentés',
  'egyéb',
  'Hivatalban van',
]);

export const resignationSectorEnum = pgEnum('resignation_sector', [
  'nemzetbiztonság',
  'fegyveres és rendvédelmi szervek',
  'ügyészség',
  'honvédség',
  'hatóságok, hivatalok, állami cégek',
  'egészségügy',
  'média',
  'sport és civil szervezetek',
  'kultúra',
  'közigazgatás',
  'egyéb',
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
    // Nullable — filled in by a one-time backfill + manual curation, not
    // auto-assigned by the detectors, so older/auto-detected rows can be NULL.
    sector: resignationSectorEnum('sector'),
    pinned: boolean('pinned').notNull().default(false),
    sourceUrls: text('sourceUrls').array().notNull().default(sql`ARRAY[]::text[]`),
    sourceNames: text('sourceNames').array().notNull().default(sql`ARRAY[]::text[]`),
    relatedCaseId: text('relatedCaseId').references(() => cases.id, { onDelete: 'set null' }),
    reviewStatus: reviewStatusEnum('reviewStatus').notNull().default('approved'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    resignationDateIdx: index('PoliticalResignation_resignationDate_idx').on(t.resignationDate),
    institutionIdx: index('PoliticalResignation_institution_idx').on(t.institution),
    typeIdx: index('PoliticalResignation_resignationType_idx').on(t.resignationType),
    reviewStatusIdx: index('PoliticalResignation_reviewStatus_idx').on(t.reviewStatus),
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
    reviewStatus: reviewStatusEnum('reviewStatus').notNull().default('approved'),
    pinned: boolean('pinned').notNull().default(false),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    eventDateIdx: index('MediaClosure_eventDate_idx').on(t.eventDate),
    typeIdx: index('MediaClosure_eventType_idx').on(t.eventType),
    reviewStatusIdx: index('MediaClosure_reviewStatus_idx').on(t.reviewStatus),
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

// ─── Court Verdicts Tracker ───────────────────────────────────────────────────

export const courtVerdicts = pgTable(
  'CourtVerdict',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    personName: text('personName').notNull(),
    personGaleriaId: text('personGaleriaId'),
    personUgyId: text('personUgyId'),
    position: text('position').notNull(),
    crimes: text('crimes').array().notNull().default(sql`ARRAY[]::text[]`),
    sentenceYears: integer('sentenceYears').notNull().default(0),
    sentenceMonths: integer('sentenceMonths'),
    sentenceLabel: text('sentenceLabel'),
    verdictType: text('verdictType').notNull().default('elsőfokú'),
    verdictDate: timestamp('verdictDate', { withTimezone: true }).notNull(),
    court: text('court').notNull(),
    summary: text('summary').notNull(),
    // Ultra-short (max 6 word) teaser for the homepage/birosagi-iteletek
    // "legfrissebb" summary blocks — see 0035_court_verdict_description.sql.
    // Distinct from `summary` above, which stays a full 1-2 sentence recap.
    description: text('description'),
    sourceUrls: text('sourceUrls').array().notNull().default(sql`ARRAY[]::text[]`),
    sourceNames: text('sourceNames').array().notNull().default(sql`ARRAY[]::text[]`),
    sourceHeadlines: text('sourceHeadlines').array().notNull().default(sql`ARRAY[]::text[]`),
    sourceDates: text('sourceDates').array().notNull().default(sql`ARRAY[]::text[]`),
    videoId: text('videoId'),
    videoChannel: text('videoChannel'),
    videoTitle: text('videoTitle'),
    videoSummary: text('videoSummary'),
    reviewStatus: reviewStatusEnum('reviewStatus').notNull().default('approved'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    verdictDateIdx: index('CourtVerdict_verdictDate_idx').on(t.verdictDate),
    personNameIdx: index('CourtVerdict_personName_idx').on(t.personName),
    reviewStatusIdx: index('CourtVerdict_reviewStatus_idx').on(t.reviewStatus),
  }),
);

export type CourtVerdict = typeof courtVerdicts.$inferSelect;
export type NewCourtVerdict = typeof courtVerdicts.$inferInsert;

// ─── Criminal Complaint Tracker (009) ─────────────────────────────────────

export const complaintStatusEnum = pgEnum('complaint_status', [
  'feljelentés',
  'nyomozás',
  'vádemelés',
  'ítélet',
  'elutasítva',
]);

export const criminalComplaints = pgTable(
  'CriminalComplaint',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    targetName: text('targetName').notNull(),
    filerName: text('filerName').notNull(),
    description: text('description'),
    // Rövid magyar címke (pl. "106 milliárd Ft") — NULL, ha a feljelentés nem
    // konkrét összeghez kötődik, vagy nincs elérhető adat; a publikus oldalon
    // ilyenkor "–" jelenik meg. Csak beszúráskor töltjük, frissítésnél nem
    // írjuk felül (l. review.ts decideComplaintTransition kommentje: egy
    // fejlemény-cikk nem feltétlenül ismétli meg az eredeti összeget).
    amountLabel: text('amountLabel'),
    status: complaintStatusEnum('status').notNull().default('feljelentés'),
    // A legutóbbi státuszváltás dátuma (a CourtVerdict.verdictDate mintájára) —
    // ez a publikus oldalon a "Dátum" oszlop.
    eventDate: timestamp('eventDate', { withTimezone: true }).notNull(),
    // Az eredeti feljelentés dátuma, ha ismert — nullable, mert néha csak egy
    // KÉSŐBBI fejlemény-cikk kerül elő elsőként (l. plan.md Phase 0).
    filedAt: timestamp('filedAt', { withTimezone: true }),
    sourceUrls: text('sourceUrls').array().notNull().default(sql`ARRAY[]::text[]`),
    sourceNames: text('sourceNames').array().notNull().default(sql`ARRAY[]::text[]`),
    sourceHeadlines: text('sourceHeadlines').array().notNull().default(sql`ARRAY[]::text[]`),
    sourceDates: text('sourceDates').array().notNull().default(sql`ARRAY[]::text[]`),
    reviewStatus: reviewStatusEnum('reviewStatus').notNull().default('approved'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    eventDateIdx: index('CriminalComplaint_eventDate_idx').on(t.eventDate),
    targetNameIdx: index('CriminalComplaint_targetName_idx').on(t.targetName),
    reviewStatusIdx: index('CriminalComplaint_reviewStatus_idx').on(t.reviewStatus),
    statusIdx: index('CriminalComplaint_status_idx').on(t.status),
  }),
);

export type CriminalComplaint = typeof criminalComplaints.$inferSelect;
export type NewCriminalComplaint = typeof criminalComplaints.$inferInsert;

// ─── Detection Pipeline Reliability (006) ────────────────────────────────
//
// One row per (article, detector) pair, written ONLY after a real
// (non-transient) decision — never on an LLM/API error. This is both the
// "already checked" backlog marker (a detector re-scans an article until a
// row exists) and the audit trail for why a candidate did or didn't become
// a public row. See specs/006-detection-pipeline-reliability/.

export const detectionOutcomeEnum = pgEnum('detection_outcome', [
  'inserted',
  'discarded',
]);

export const detectionChecks = pgTable(
  'DetectionCheck',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    articleId: uuid('articleId')
      .notNull()
      .references(() => newsArticles.id, { onDelete: 'cascade' }),
    detectorType: text('detectorType').notNull(),
    outcome: detectionOutcomeEnum('outcome').notNull(),
    reason: text('reason'),
    extractedName: text('extractedName'),
    confidence: real('confidence'),
    checkedAt: timestamp('checkedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    articleDetectorUq: uniqueIndex('DetectionCheck_articleId_detectorType_uq').on(
      t.articleId,
      t.detectorType,
    ),
    detectorTypeIdx: index('DetectionCheck_detectorType_idx').on(t.detectorType),
    checkedAtIdx: index('DetectionCheck_checkedAt_idx').on(t.checkedAt),
  }),
);

export type DetectionCheck = typeof detectionChecks.$inferSelect;
export type NewDetectionCheck = typeof detectionChecks.$inferInsert;

// ─── Breaking Monitor ────────────────────────────────────────────────────────

export const breakingMonitor = pgTable('BreakingMonitor', {
  id: uuid('id').defaultRandom().primaryKey(),
  keyword: text('keyword').notNull(),
  type: text('type').notNull().default('keyword'),
  label: text('label').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
});

export type BreakingMonitor = typeof breakingMonitor.$inferSelect;
export type NewBreakingMonitor = typeof breakingMonitor.$inferInsert;

// ─── Social Feed Posts ────────────────────────────────────────────────────────

export const socialPosts = pgTable(
  'SocialPost',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    authorName: text('authorName').notNull(),
    authorHandle: text('authorHandle'),
    platform: text('platform').notNull().default('facebook'),
    postUrl: text('postUrl').notNull().unique(),
    content: text('content').notNull(),
    imageUrl: text('imageUrl'),
    postedAt: timestamp('postedAt', { withTimezone: true }),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    hidden: boolean('hidden').notNull().default(false),
  },
  (t) => ({
    postedAtIdx: index('SocialPost_postedAt_idx').on(t.postedAt),
  }),
);

export type SocialPost = typeof socialPosts.$inferSelect;
export type NewSocialPost = typeof socialPosts.$inferInsert;

// ─── Podcast Videos (YouTube) ─────────────────────────────────────────────────

export const podcastVideos = pgTable(
  'PodcastVideo',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    videoId: text('videoId').notNull().unique(),
    channelSlug: text('channelSlug').notNull(),
    channelName: text('channelName').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    publishedAt: timestamp('publishedAt', { withTimezone: true }).notNull(),
    viewCount: integer('viewCount'),
    viewThresholdMet: boolean('viewThresholdMet').notNull().default(false),
    lastViewCheckAt: timestamp('lastViewCheckAt', { withTimezone: true }),
    reviewStatus: reviewStatusEnum('reviewStatus').notNull().default('pending'),
    // Kézzel kitűzött "kiemelt" videó, időkorláttal (pl. "ez legyen a hero 1
    // hétig") — a lekérdezés ezt részesíti előnyben a legfrissebb helyett,
    // amíg a jövőben van; utána automatikusan visszaáll a normál sorrend.
    pinnedUntil: timestamp('pinnedUntil', { withTimezone: true }),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    publishedAtIdx: index('PodcastVideo_publishedAt_idx').on(t.publishedAt),
    reviewStatusIdx: index('PodcastVideo_reviewStatus_idx').on(t.reviewStatus),
    pinnedUntilIdx: index('PodcastVideo_pinnedUntil_idx').on(t.pinnedUntil),
  }),
);

export type PodcastVideo = typeof podcastVideos.$inferSelect;
export type NewPodcastVideo = typeof podcastVideos.$inferInsert;

// ─── Facebook Pages (sync target list) ───────────────────────────────────────

export const facebookPages = pgTable(
  'FacebookPage',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pageId: text('pageId').notNull().unique(),
    pageName: text('pageName').notNull(),
    pageHandle: text('pageHandle'),
    enabled: boolean('enabled').notNull().default(true),
    lastSyncedAt: timestamp('lastSyncedAt', { withTimezone: true }),
    consecutiveFailures: integer('consecutiveFailures').notNull().default(0),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    enabledIdx: index('FacebookPage_enabled_idx').on(t.enabled),
  }),
);

// ─── Watchlist Removal Detections ──────────────────────────────────────────
// A WATCH_LIST (watchlist-config.ts) 8 fője kézzel írt statikus configban él
// (config-as-code, sosem írja a pipeline) — ez a tábla a runtime "eltávolítva"
// felismerés eredményét tárolja, amit a lemondasok/[id]/page.tsx és a
// watchlist-grid.tsx a statikus adat FÖLÉ olvas be. Lásd
// detect-watchlist-removals.ts: csak akkor ír ide, ha legalább 2 független
// forrású cikk egyértelműen megerősíti, hogy a megbízatás TÉNYLEGESEN (nem
// csak tervezetten) megszűnt.
export const watchlistRemovals = pgTable(
  'WatchlistRemoval',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    personId: text('personId').notNull().unique(), // WATCH_LIST.id
    removalType: text('removalType').notNull(), // 'removed' | 'resigned'
    detectedAt: timestamp('detectedAt', { withTimezone: true }).notNull().defaultNow(),
    sourceHeadline: text('sourceHeadline').notNull(),
    sourceName: text('sourceName'),
    sourceUrl: text('sourceUrl').notNull(),
    sourceDateLabel: text('sourceDateLabel'),
    lead: text('lead'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  },
);

export type WatchlistRemoval = typeof watchlistRemovals.$inferSelect;
export type NewWatchlistRemoval = typeof watchlistRemovals.$inferInsert;

export type FacebookPage = typeof facebookPages.$inferSelect;
export type NewFacebookPage = typeof facebookPages.$inferInsert;
