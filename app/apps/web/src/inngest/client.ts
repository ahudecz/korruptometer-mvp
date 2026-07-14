import 'server-only';
import { Inngest, EventSchemas } from 'inngest';

export type Events = {
  'scrape.news': { data: { sourceSlug?: string } };
  'aggregate.link-articles': { data: { articleIds: string[] } };
  'aggregate.kpi-rollup': { data: Record<string, never> };
  'kpi.recompute': { data: { reason: string } };
  'submission.intake': { data: { submissionId: string } };
  'submission.publish': { data: { submissionId: string } };
  'gdpr.retention-sweep': { data: Record<string, never> };
  'submissions.rotate-seal': { data: { triggeredBy: string } };
  'worker.heartbeat': { data: Record<string, never> };
  'auditlog.partition-maintenance': { data: Record<string, never> };
  'kmonitor.discover-tags': { data: Record<string, never> };
  'kmonitor.traverse-tag': { data: { candidateId: string; slug: string } };
  // 002-investigation-engine events.
  'investigation.article.ingested': {
    data: { articleSource: 'news' | 'kmonitor'; articleId: string };
  };
  'investigation.claims.extracted': {
    data: {
      articleSource: 'news' | 'kmonitor';
      articleId: string;
      claimIds: string[];
      extractorVersion: string;
    };
  };
  'investigation.xref.requested': {
    data: {
      investigationId: string;
      requestedByEditorId: string;
      runId: string;
    };
  };
  'investigation.xref.source.completed': {
    data: {
      investigationId: string;
      sourceSystem: string;
      recordsWritten: number;
    };
  };
  'investigation.hypothesis.requested': {
    data: {
      investigationId: string;
      requestedByEditorId: string;
      runId: string;
    };
  };
  'investigation.benchmarks.computed': {
    data: {
      investigationId: string;
      dimensionsComputed: string[];
      outlierCount: number;
    };
  };
  'investigation.score.requested': {
    data: { investigationId: string; reason: string };
  };
  'investigation.promote.public.requested': {
    data: {
      investigationId: string;
      requestedByEditorId: string;
      expectedUpdatedAt: string;
    };
  };
  'investigation.dsr.deletion.upheld': {
    data: { dsrRequestId: string; subjectNormalizedName: string };
  };
  'investigation.extraction.paused': {
    data: {
      day: string;
      model: string;
      estimatedHufSpend: string;
      ceilingHuf: string;
    };
  };
  'investigation.redflags.requested': {
    data: { investigationId: string };
  };
  // Addendum 2026-05-19: Damage→Evidence Spine
  'investigation.claim.changed': {
    data: { investigationId: string };
  };
  'investigation.external-record.changed': {
    data: { investigationId: string };
  };
  'investigation.redflag.changed': {
    data: { investigationId: string };
  };
  'investigation.benchmark.changed': {
    data: { investigationId: string };
  };
  'investigation.damage-backfill': {
    data: Record<string, never>;
  };
  'resignation.detect': { data: Record<string, never> };
  'facebook.sync': { data: Record<string, never> };
  'breaking.recompute': { data: { reason: string } };
};

export const inngest = new Inngest({
  id: 'korruptometer',
  schemas: new EventSchemas().fromRecord<Events>(),
  // The Inngest SDK reads INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY from
  // process.env automatically. INNGEST_DEV=1 makes the local dev server
  // route to http://127.0.0.1:8288.
});
