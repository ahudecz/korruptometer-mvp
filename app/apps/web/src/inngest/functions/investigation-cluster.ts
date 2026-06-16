import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import {
  findCandidates,
  resolveCluster,
  type ClaimForCluster,
} from '@/lib/investigation/cluster';
import { normalizeName } from '@/lib/investigation/normalize-name';
import { inngest } from '../client';

type TxClient = Parameters<
  Parameters<ReturnType<typeof getDb>['transaction']>[0]
>[0];

/**
 * investigation.cluster (T029, FR-008..FR-011a).
 *
 * Triggered by `investigation.claims.extracted`. For each new claim on
 * the article, applies the deterministic cluster predicate; attaches the
 * claim to one existing investigation, writes a `cluster_ambiguous` lead
 * if 2+ pass, or creates a fresh investigation if 0 pass.
 *
 * Takes a Postgres advisory lock keyed on the deterministic sorted list
 * of primary normalized names so two concurrent clusterer runs that
 * touch the same name cluster serialize cleanly.
 */
export const investigationCluster = inngest.createFunction(
  {
    id: 'investigation.cluster',
    concurrency: [
      { key: 'event.data.claimIds', limit: 1 },
      { limit: 1 },
    ],
    retries: 3,
  },
  { event: 'investigation.claims.extracted' },
  async ({ event, step }) => {
    const { articleSource, articleId, claimIds } = event.data;
    Sentry.addBreadcrumb({
      category: 'investigation.cluster',
      message: 'start',
      data: { articleSource, articleId, claimCount: claimIds.length },
    });

    if (claimIds.length === 0) {
      return { skipped: 'zero_claims' };
    }

    const result = await step.run('cluster', async () => {
      const db = getDb();
      return db.transaction(async (tx) => clusterClaims(
        tx,
        articleSource,
        articleId,
        claimIds,
      ));
    });

    if (result.createdInvestigationId) {
      await step.run('emit-created-audit', async () => {
        const db = getDb();
        await db.insert(schema.auditLogs).values({
          actorEditorId: null,
          action: 'investigation.created',
          entityType: 'Investigation',
          entityId: result.createdInvestigationId!,
          detail: { articleSource, articleId },
        });
      });
    }
    // Addendum 2026-05-19 (T113): notify the damage-recompute pipeline of
    // every investigation whose claim set just changed. Debounced upstream
    // by investigationId, so per-claim events collapse into one recompute.
    for (const investigationId of result.attached) {
      await step.sendEvent(`emit-claim-changed-${investigationId}`, {
        name: 'investigation.claim.changed',
        data: { investigationId },
      });
    }
    return result;
  },
);

async function clusterClaims(
  tx: TxClient,
  articleSource: 'news' | 'kmonitor',
  articleId: string,
  claimIds: string[],
): Promise<{
  attached: string[];
  ambiguous: number;
  createdInvestigationId: string | null;
}> {
  const claims = (await tx
    .select()
    .from(schema.articleClaims)
    .where(
      and(
        eq(schema.articleClaims.articleSource, articleSource),
        inArray(schema.articleClaims.id, claimIds),
      ),
    )) as Array<typeof schema.articleClaims.$inferSelect>;

  // Article publish date (used in date-window predicate).
  let articlePublishedAt: Date | null = null;
  if (articleSource === 'news') {
    const rows = (await tx
      .select({ publishedAt: schema.newsArticles.publishedAt })
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.id, articleId))
      .limit(1)) as Array<{ publishedAt: Date | null }>;
    articlePublishedAt = rows[0]?.publishedAt ?? null;
  } else {
    const newsId = Number.parseInt(articleId, 10);
    if (Number.isFinite(newsId)) {
      const rows = (await tx
        .select({ pubTime: schema.kMonitorArticles.pubTime })
        .from(schema.kMonitorArticles)
        .where(eq(schema.kMonitorArticles.newsId, newsId))
        .limit(1)) as Array<{ pubTime: Date | null }>;
      articlePublishedAt = rows[0]?.pubTime ?? null;
    }
  }

  let createdInvestigationId: string | null = null;
  const attached: string[] = [];
  let ambiguous = 0;

  // Advisory lock keyed on the sorted list of normalized primary names
  // across the article's claims. This serialises concurrent clusterer
  // runs that touch the same name space.
  const allNames = new Set<string>();
  for (const c of claims) {
    const parties = (c.parties as Array<{ normalizedName?: string; name: string }>) ?? [];
    for (const p of parties) {
      const n = normalizeName(p.normalizedName || p.name);
      if (n) allNames.add(n);
    }
  }
  const lockKey = Array.from(allNames).sort().join('|') || `art:${articleSource}:${articleId}`;
  await tx.execute(sql`
    SELECT pg_advisory_xact_lock(hashtext(${`investigation-cluster:${lockKey}`}))
  `);

  for (const claim of claims) {
    const parties = (claim.parties as Array<{
      kind: 'person' | 'entity';
      name: string;
      normalizedName: string;
      role: string;
    }>) ?? [];
    const claimForCluster: ClaimForCluster = {
      id: claim.id,
      articleSource: claim.articleSource as 'news' | 'kmonitor',
      articleId: claim.articleId,
      allegedAmountHuf: claim.allegedAmountHuf,
      parties,
      articlePublishedAt,
    };

    const candidates = await findCandidates(claimForCluster, undefined, tx);
    const resolution = resolveCluster(claimForCluster, candidates);

    if (resolution.kind === 'attach') {
      await attachToInvestigation(
        tx,
        resolution.investigationId,
        articleSource,
        articleId,
        parties,
      );
      attached.push(resolution.investigationId);
      continue;
    }
    if (resolution.kind === 'ambiguous') {
      // Pick one of the candidates as the lead-owner (the first), and
      // write a cluster_ambiguous lead referencing every candidate.
      const ownerId = resolution.candidateIds[0]!;
      await tx.insert(schema.investigationLeads).values({
        investigationId: ownerId,
        kind: 'cluster_ambiguous',
        status: 'open',
        question:
          'Ez az állítás több nyitott nyomozással is egyezik. Reviewer döntse el a kapcsolódást.',
        testedAgainst: {
          claimId: claim.id,
          articleSource,
          articleId,
          candidateInvestigationIds: resolution.candidateIds,
        },
        createdBy: 'system',
      });
      ambiguous += 1;
      continue;
    }
    // kind === 'new'
    if (createdInvestigationId) {
      // Already created for an earlier claim from the same article —
      // attach to that one rather than spawning another fresh row.
      await attachToInvestigation(
        tx,
        createdInvestigationId,
        articleSource,
        articleId,
        parties,
      );
      attached.push(createdInvestigationId);
      continue;
    }
    const primaryName = parties[0]?.name ?? null;
    const primaryNorm = primaryName ? normalizeName(primaryName) : null;
    const primaryEntity = parties.find((p) => p.kind === 'entity')?.name ?? null;
    const inserted = (await tx
      .insert(schema.investigations)
      .values({
        status: 'new',
        primaryPersonName: primaryName,
        primaryPersonNormalized: primaryNorm,
        primaryEntityName: primaryEntity,
        articleCount: 0,
      })
      .returning({ id: schema.investigations.id })) as Array<{ id: string }>;
    createdInvestigationId = inserted[0]?.id ?? null;
    if (createdInvestigationId) {
      await attachToInvestigation(
        tx,
        createdInvestigationId,
        articleSource,
        articleId,
        parties,
      );
      attached.push(createdInvestigationId);
    }
  }

  return {
    attached: Array.from(new Set(attached)),
    ambiguous,
    createdInvestigationId,
  };
}

async function attachToInvestigation(
  tx: TxClient,
  investigationId: string,
  articleSource: 'news' | 'kmonitor',
  articleId: string,
  parties: Array<{ kind: 'person' | 'entity'; name: string; normalizedName: string; role: string }>,
): Promise<void> {
  // Insert the link only if it doesn't already exist.
  await tx
    .insert(schema.investigationArticleLinks)
    .values({ investigationId, articleSource, articleId })
    .onConflictDoNothing();

  // Recompute articleCount as the distinct article count via the join.
  await tx.execute(sql`
    UPDATE "Investigation"
       SET "articleCount" = (
             SELECT COUNT(*)
               FROM "InvestigationArticleLink"
              WHERE "investigationId" = ${investigationId}
           ),
           "updatedAt" = now()
     WHERE id = ${investigationId}
  `);

  // Bump the denormalized primary names if currently null.
  const primaryName = parties[0]?.name ?? null;
  if (primaryName) {
    await tx.execute(sql`
      UPDATE "Investigation"
         SET "primaryPersonName" =
                COALESCE("primaryPersonName", ${primaryName}),
             "primaryPersonNormalized" =
                COALESCE("primaryPersonNormalized", ${normalizeName(primaryName)})
       WHERE id = ${investigationId}
    `);
  }
}
