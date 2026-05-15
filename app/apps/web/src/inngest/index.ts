import 'server-only';
import { aggregateKpiRollup } from './functions/aggregate-kpi-rollup';
import { aggregateLinkArticles } from './functions/aggregate-link-articles';
import { auditlogPartitionMaintenance } from './functions/auditlog-partition-maintenance';
import { gdprRetentionSweep } from './functions/gdpr-retention-sweep';
import { kmonitorDiscoverTags } from './functions/kmonitor-discover-tags';
import { kmonitorTraverseApprovedTags } from './functions/kmonitor-traverse-approved-tags';
import { kmonitorTraverseTag } from './functions/kmonitor-traverse-tag';
import { scrapeNews } from './functions/scrape-news';
import { sealedBoxRotation } from './functions/sealed-box-rotation';
import { submissionIntake } from './functions/submission-intake';
import { submissionPublish } from './functions/submission-publish';
import { workerHeartbeat } from './functions/heartbeat';

export { inngest } from './client';

/**
 * The single source of truth for which Inngest functions ship in this
 * deployment. The serve handler at app/api/inngest/route.ts registers
 * exactly this list with Inngest.
 */
export const functions = [
  scrapeNews,
  aggregateLinkArticles,
  aggregateKpiRollup,
  workerHeartbeat,
  submissionIntake,
  submissionPublish,
  gdprRetentionSweep,
  auditlogPartitionMaintenance,
  sealedBoxRotation,
  kmonitorDiscoverTags,
  kmonitorTraverseApprovedTags,
  kmonitorTraverseTag,
];
