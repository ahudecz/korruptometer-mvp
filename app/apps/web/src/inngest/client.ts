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
};

export const inngest = new Inngest({
  id: 'korruptometer',
  schemas: new EventSchemas().fromRecord<Events>(),
  // The Inngest SDK reads INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY from
  // process.env automatically. INNGEST_DEV=1 makes the local dev server
  // route to http://127.0.0.1:8288.
});
