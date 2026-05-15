/**
 * Reads the three JSONL files emitted by scripts/kmdb/import.py and
 * upserts into KMonitorPersonCandidate + KMonitorArticle +
 * KMonitorPersonArticle. Idempotent — editor-set approvalState and
 * caseId are never overwritten.
 *
 * Usage:
 *   pnpm kmdb:import   (runs the Python script first, then this)
 * or:
 *   KMDB_OUT=/path pnpm --filter @korr/db kmdb:upsert
 */
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

import * as schema from './schema';

type PersonRecord = {
  displayName: string;
  normalizedName: string;
  mentionCount: number;
  articleCountWithAmount: number;
  p1AmountHuf: number | null;
  p10AmountHuf: number | null;
  p50AmountHuf: number | null;
  p90AmountHuf: number | null;
  p99AmountHuf: number | null;
  topInstitutions: { institution: string; count: number }[];
  topPersons: { person: string; count: number }[];
  topTopics: { topic: string; count: number }[];
  firstSeenPub: string | null;
  lastSeenPub: string | null;
};

type ArticleRecord = {
  newsId: number;
  sourceUrl: string;
  archiveUrl: string | null;
  title: string;
  pubTime: string | null;
  amountHuf: number | null;
  newspaper: string | null;
  category: string | null;
  topics: string[];
  institutions: string[];
  places: string[];
};

type PaLink = {
  normalizedName: string;
  newsId: number;
  amountHuf: number | null;
};

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter((s) => s.length > 0)
    .map((s) => JSON.parse(s) as T);
}

function toBig(n: number | null): bigint | null {
  return n == null ? null : BigInt(Math.round(n));
}

async function main() {
  const outDir = process.env.KMDB_OUT ?? '/tmp/kmdb-out';
  const persons = readJsonl<PersonRecord>(`${outDir}/persons.jsonl`);
  const articles = readJsonl<ArticleRecord>(`${outDir}/articles.jsonl`);
  const paLinks = readJsonl<PaLink>(`${outDir}/person_articles.jsonl`);
  console.log(
    `[upsert] persons=${persons.length} articles=${articles.length} links=${paLinks.length}`,
  );

  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const conn = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(conn, { schema });

  const now = new Date();

  // --- 1. Upsert persons. -------------------------------------------------
  let pInserted = 0;
  let pUpdated = 0;
  for (const r of persons) {
    const result = await db
      .insert(schema.kMonitorPersonCandidates)
      .values({
        displayName: r.displayName,
        normalizedName: r.normalizedName,
        mentionCount: r.mentionCount,
        articleCountWithAmount: r.articleCountWithAmount,
        // Keep legacy median/p75/max in sync for any old reader.
        medianAmountHuf: toBig(r.p50AmountHuf),
        p1AmountHuf: toBig(r.p1AmountHuf),
        p10AmountHuf: toBig(r.p10AmountHuf),
        p50AmountHuf: toBig(r.p50AmountHuf),
        p90AmountHuf: toBig(r.p90AmountHuf),
        p99AmountHuf: toBig(r.p99AmountHuf),
        topInstitutions: r.topInstitutions,
        topPersons: r.topPersons,
        topTopics: r.topTopics,
        firstSeenAt: now,
        lastSeenAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.kMonitorPersonCandidates.normalizedName,
        set: {
          displayName: r.displayName,
          mentionCount: r.mentionCount,
          articleCountWithAmount: r.articleCountWithAmount,
          medianAmountHuf: toBig(r.p50AmountHuf),
          p1AmountHuf: toBig(r.p1AmountHuf),
          p10AmountHuf: toBig(r.p10AmountHuf),
          p50AmountHuf: toBig(r.p50AmountHuf),
          p90AmountHuf: toBig(r.p90AmountHuf),
          p99AmountHuf: toBig(r.p99AmountHuf),
          topInstitutions: r.topInstitutions,
          topPersons: r.topPersons,
          topTopics: r.topTopics,
          lastSeenAt: now,
          updatedAt: now,
          // approvalState + caseId intentionally NOT touched.
        },
      })
      .returning({
        firstSeenAt: schema.kMonitorPersonCandidates.firstSeenAt,
      });
    if (result[0] && result[0].firstSeenAt.getTime() === now.getTime()) {
      pInserted += 1;
    } else {
      pUpdated += 1;
    }
  }
  console.log(`[upsert] persons: inserted=${pInserted} updated=${pUpdated}`);

  // --- 2. Map normalizedName -> personId (single fetch). ------------------
  const idRows = await db
    .select({
      id: schema.kMonitorPersonCandidates.id,
      normalizedName: schema.kMonitorPersonCandidates.normalizedName,
    })
    .from(schema.kMonitorPersonCandidates);
  const idByName = new Map<string, string>();
  for (const r of idRows) idByName.set(r.normalizedName, r.id);
  console.log(`[upsert] resolved ${idByName.size} person IDs`);

  // --- 3. Upsert articles in batches. -------------------------------------
  const BATCH = 500;
  let aInserted = 0;
  for (let i = 0; i < articles.length; i += BATCH) {
    const chunk = articles.slice(i, i + BATCH);
    await db
      .insert(schema.kMonitorArticles)
      .values(
        chunk.map((a) => ({
          newsId: a.newsId,
          sourceUrl: a.sourceUrl,
          archiveUrl: a.archiveUrl,
          title: a.title,
          pubTime: a.pubTime ? new Date(a.pubTime) : null,
          amountHuf: toBig(a.amountHuf),
          newspaper: a.newspaper,
          category: a.category,
          topics: a.topics,
          institutions: a.institutions,
          places: a.places,
        })),
      )
      .onConflictDoUpdate({
        target: schema.kMonitorArticles.newsId,
        set: {
          sourceUrl: sql`EXCLUDED."sourceUrl"`,
          archiveUrl: sql`EXCLUDED."archiveUrl"`,
          title: sql`EXCLUDED.title`,
          pubTime: sql`EXCLUDED."pubTime"`,
          amountHuf: sql`EXCLUDED."amountHuf"`,
          newspaper: sql`EXCLUDED.newspaper`,
          category: sql`EXCLUDED.category`,
          topics: sql`EXCLUDED.topics`,
          institutions: sql`EXCLUDED.institutions`,
          places: sql`EXCLUDED.places`,
        },
      });
    aInserted += chunk.length;
  }
  console.log(`[upsert] articles upserted: ${aInserted}`);

  // --- 4. Replace person↔article links in batches. ------------------------
  // Simpler than diffing: truncate + bulk insert. This is fast because all the
  // links are derived from the parquet, not editor-curated.
  await db.execute(sql`TRUNCATE "KMonitorPersonArticle"`);
  let lInserted = 0;
  let lSkipped = 0;
  for (let i = 0; i < paLinks.length; i += BATCH) {
    const chunk = paLinks.slice(i, i + BATCH);
    const rows = chunk
      .map((l) => {
        const personId = idByName.get(l.normalizedName);
        if (!personId) {
          lSkipped += 1;
          return null;
        }
        return { personId, newsId: l.newsId, amountHuf: toBig(l.amountHuf) };
      })
      .filter((r): r is { personId: string; newsId: number; amountHuf: bigint | null } => r !== null);
    if (rows.length === 0) continue;
    await db
      .insert(schema.kMonitorPersonArticles)
      .values(rows)
      .onConflictDoNothing();
    lInserted += rows.length;
  }
  console.log(`[upsert] person↔article links: inserted=${lInserted} skipped=${lSkipped}`);

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
