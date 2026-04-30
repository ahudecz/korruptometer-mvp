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

export type Case = typeof cases.$inferSelect;
export type NewCase = typeof cases.$inferInsert;
export type RogueProfile = typeof rogueProfiles.$inferSelect;
export type NewsArticle = typeof newsArticles.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type KpiSnapshot = typeof kpiSnapshots.$inferSelect;
export type SectorBreakdown = { name: string; value: number }[];

// Use placate-typescript export for the singleton cap (no client cares but Drizzle plays nice).
export const _unused = sql`1`;
