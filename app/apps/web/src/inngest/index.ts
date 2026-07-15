import 'server-only';
import { aggregateKpiRollup } from './functions/aggregate-kpi-rollup';
import { aggregateLinkArticles } from './functions/aggregate-link-articles';
import { auditlogPartitionMaintenance } from './functions/auditlog-partition-maintenance';
import { detectResignations } from './functions/detect-resignations';
import { detectMediaClosures } from './functions/detect-media-closures';
import { detectVerdicts } from './functions/detect-verdicts';
import { detectAssetRecoveries } from './functions/detect-asset-recoveries';
import { syncFacebookPosts } from './functions/sync-facebook-posts';
import { refreshDailyBreaking } from './functions/refresh-daily-breaking';
import { detectWatchlistRemovals } from './functions/detect-watchlist-removals';
import { gdprRetentionSweep } from './functions/gdpr-retention-sweep';
import { kmonitorDiscoverTags } from './functions/kmonitor-discover-tags';
import { kmonitorTraverseApprovedTags } from './functions/kmonitor-traverse-approved-tags';
import { kmonitorTraverseTag } from './functions/kmonitor-traverse-tag';
import { scrapeNews } from './functions/scrape-news';
import { scrapeYoutube } from './functions/scrape-youtube';
import { sealedBoxRotation } from './functions/sealed-box-rotation';
import { submissionIntake } from './functions/submission-intake';
import { submissionPublish } from './functions/submission-publish';
import { workerHeartbeat } from './functions/heartbeat';
// 002-investigation-engine
import { investigationExtractClaims } from './functions/investigation-extract-claims';
import { investigationCluster } from './functions/investigation-cluster';
import { investigationXref } from './functions/investigation-xref';
import { investigationBenchmarksCompute } from './functions/investigation-benchmarks-compute';
import { investigationRedflags } from './functions/investigation-redflags';
import { investigationHypothesisLoop } from './functions/investigation-hypothesis-loop';
import { investigationScore } from './functions/investigation-score';
import { investigationPromotePublic } from './functions/investigation-promote-public';
import { investigationAnonymizeDsr } from './functions/investigation-anonymize-dsr';
import { investigationRefreshStaleExternal } from './functions/investigation-refresh-stale-external';
import { investigationOrphanCleanup } from './functions/investigation-orphan-cleanup';
// 002-investigation-engine addendum 2026-05-19: Damage→Evidence Spine
import { investigationDamageRecompute } from './functions/investigation-damage-recompute';
import { investigationDamageBackfill } from './functions/investigation-damage-backfill';

export { inngest } from './client';

/**
 * The single source of truth for which Inngest functions ship in this
 * deployment. The serve handler at app/api/inngest/route.ts registers
 * exactly this list with Inngest.
 */
export const functions = [
  scrapeNews,
  scrapeYoutube,
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
  // Investigation Engine (Phase 2 stubs; real bodies land per-slice).
  investigationExtractClaims,
  investigationCluster,
  investigationXref,
  investigationBenchmarksCompute,
  investigationRedflags,
  investigationHypothesisLoop,
  investigationScore,
  investigationPromotePublic,
  investigationAnonymizeDsr,
  investigationRefreshStaleExternal,
  investigationOrphanCleanup,
  // Addendum: damage→evidence spine.
  investigationDamageRecompute,
  investigationDamageBackfill,
  detectResignations,
  detectMediaClosures,
  detectVerdicts,
  detectAssetRecoveries,
  syncFacebookPosts,
  refreshDailyBreaking,
  detectWatchlistRemovals,
];
