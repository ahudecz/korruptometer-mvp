import 'server-only';

import { fetchKMonitorTagIndex } from '@korr/scrapers';
import { getDb, schema } from '@/lib/db';

import { inngest } from '../client';

/**
 * kmonitor.discover-tags (FR-076) — daily cron. Fetches K-Monitor's
 * `/hirek` index page and upserts a KMonitorTagCandidate row for each
 * observed tag slug. firstSeenAt is set on insert and never updated;
 * lastSeenAt is bumped on every run. Editor-set approvalState and
 * caseId are never overwritten (FR-077 — editor decisions are sticky).
 */
export const kmonitorDiscoverTags = inngest.createFunction(
  { id: 'kmonitor-discover-tags', name: 'K-Monitor: discover tags', concurrency: 1 },
  { cron: '30 2 * * *' },
  async ({ step }) => {
    const { tagSlugs } = await step.run('fetch-index', async () =>
      fetchKMonitorTagIndex(),
    );

    if (tagSlugs.length === 0) return { observed: 0, inserted: 0 };

    const result = await step.run('upsert-candidates', async () => {
      const db = getDb();
      const now = new Date();
      let inserted = 0;
      for (const slug of tagSlugs) {
        const rows = await db
          .insert(schema.kMonitorTagCandidates)
          .values({ slug, firstSeenAt: now, lastSeenAt: now, updatedAt: now })
          .onConflictDoUpdate({
            target: schema.kMonitorTagCandidates.slug,
            set: { lastSeenAt: now, updatedAt: now },
          })
          .returning({
            id: schema.kMonitorTagCandidates.id,
            firstSeenAt: schema.kMonitorTagCandidates.firstSeenAt,
          });
        if (rows[0] && rows[0].firstSeenAt.getTime() === now.getTime()) {
          inserted += 1;
        }
      }
      return { observed: tagSlugs.length, inserted };
    });

    return result;
  },
);
