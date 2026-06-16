import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import * as Sentry from '@sentry/nextjs';
import { and, eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { completeJob, failJob, startJob } from '@/lib/investigation/job-state';
import type { HypothesisCapKind } from '@korr/shared';
import { inngest } from '../client';

const TOOL_DEFS = [
  {
    name: 'read_cached_external_record',
    description:
      'Olvasd vissza egy korábban gyűjtött külső rekordot a DB-ből. Soha nem hív hálózatot.',
    input_schema: {
      type: 'object',
      required: ['sourceSystem', 'externalId'],
      properties: {
        sourceSystem: { type: 'string' },
        externalId: { type: 'string' },
      },
    },
  },
  {
    name: 'fetch_external_record',
    description:
      'Élő lekérés egy free-tier forrásból. Egy (sourceSystem, externalId) párral csak egyszer hívható ezen a futáson.',
    input_schema: {
      type: 'object',
      required: ['sourceSystem', 'externalId'],
      properties: {
        sourceSystem: { type: 'string' },
        externalId: { type: 'string' },
      },
    },
  },
  {
    name: 'compute_benchmark',
    description:
      'Számold ki a megadott dimenzió p10/p50/p90 értékét a már gyűjtött rekordokból.',
    input_schema: {
      type: 'object',
      required: ['dimension'],
      properties: { dimension: { type: 'string' } },
    },
  },
  {
    name: 'record_lead',
    description:
      'Rögzítsd a hipotézist és a megállapítást egy InvestigationLead sorban.',
    input_schema: {
      type: 'object',
      required: ['question', 'finding'],
      properties: {
        question: { type: 'string' },
        finding: { type: 'string' },
      },
    },
  },
] as const;

export const investigationHypothesisLoop = inngest.createFunction(
  {
    id: 'investigation.hypothesis-loop',
    concurrency: [
      { key: 'event.data.investigationId', limit: 1 },
      { limit: parseInt(process.env.HYPOTHESIS_CONCURRENCY ?? '2', 10) },
    ],
    retries: 0,
  },
  { event: 'investigation.hypothesis.requested' },
  async ({ event, step }) => {
    const { investigationId, requestedByEditorId } = event.data;
    const startedAt = Date.now();
    const MAX_TOOL_CALLS = Number.parseInt(
      process.env.HYPOTHESIS_MAX_TOOL_CALLS ?? '8',
      10,
    );
    const MAX_TOKENS = Number.parseInt(
      process.env.HYPOTHESIS_MAX_TOKENS ?? '50000',
      10,
    );
    const MAX_WALL_MS = Number.parseInt(
      process.env.HYPOTHESIS_MAX_WALL_MS ?? '90000',
      10,
    );
    const MODEL = process.env.HYPOTHESIS_MODEL ?? 'claude-haiku-4-5';

    Sentry.addBreadcrumb({
      category: 'investigation.hypothesis-loop',
      message: 'start',
      data: { investigationId, MAX_TOOL_CALLS, MAX_TOKENS, MAX_WALL_MS, MODEL },
    });

    await step.run('mark-running', async () => {
      await startJob({ investigationId, jobKind: 'hypothesis_loop' });
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await step.run('mark-missing-key', async () => {
        await failJob({
          investigationId,
          jobKind: 'hypothesis_loop',
          codeOrMessage: 'internal_error',
        });
      });
      throw new Error('ANTHROPIC_API_KEY not set');
    }
    const client = new Anthropic({ apiKey });

    let toolCalls = 0;
    let totalTokens = 0;
    const seenLiveCalls = new Set<string>();

    let result: { capFired: HypothesisCapKind | null; finding: string };
    try {
    result = await step.run('loop', async () => {
      const db = getDb();
      const inv = await db
        .select()
        .from(schema.investigations)
        .where(eq(schema.investigations.id, investigationId))
        .limit(1);
      if (!inv[0]) return { capFired: null as null, finding: 'investigation_missing' };

      const systemPrompt =
        'Te a Korruptométer hipotézis-ellenőrző ágense vagy. Csak a rendelkezésre álló '
        + 'eszközökkel dolgozhatsz. Soha ne találd ki a tényeket. Add fel a hurkot, ha a '
        + 'tool-output nem hoz új információt.';
      const messages: Anthropic.MessageParam[] = [
        {
          role: 'user',
          content:
            `Vizsgáld meg az investigationId=${investigationId} nyomozást. `
            + 'Adott a primary név: '
            + (inv[0].primaryPersonName ?? 'ismeretlen')
            + '. Adj meg legfeljebb 2 hipotézist, és tesztelj. Maximum '
            + `${MAX_TOOL_CALLS} tool hívás, ${Math.round(MAX_TOKENS / 1000)}k token, `
            + `${Math.round(MAX_WALL_MS / 1000)}s wall clock.`,
        },
      ];

      for (let turn = 0; turn < 16; turn += 1) {
        if (toolCalls >= MAX_TOOL_CALLS) {
          return capOut(db, investigationId, requestedByEditorId, 'tool_calls');
        }
        if (totalTokens >= MAX_TOKENS) {
          return capOut(db, investigationId, requestedByEditorId, 'tokens');
        }
        if (Date.now() - startedAt >= MAX_WALL_MS) {
          return capOut(db, investigationId, requestedByEditorId, 'wall_clock');
        }
        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          tools: TOOL_DEFS as unknown as Anthropic.Tool[],
          messages,
        });
        totalTokens += (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0);

        // Find any tool_use blocks; if none, the model is done.
        const toolUses = res.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );
        if (toolUses.length === 0) {
          // Persist the final finding as one lead.
          await db.insert(schema.investigationLeads).values({
            investigationId,
            kind: 'hypothesis',
            status: 'tested',
            question: 'Hipotézis-hurok futás összegzése',
            finding: res.content
              .filter((b): b is Anthropic.TextBlock => b.type === 'text')
              .map((b) => b.text)
              .join('\n')
              .slice(0, 4000),
            createdBy: 'agent',
            actorEditorId: null,
            resolvedAt: new Date(),
          });
          return { capFired: null as null, finding: 'completed' };
        }
        messages.push({ role: 'assistant', content: res.content });
        const toolResults: Anthropic.MessageParam['content'] = [];
        for (const tu of toolUses) {
          toolCalls += 1;
          const out = await runTool(tu, seenLiveCalls);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: out,
          });
          if (toolCalls >= MAX_TOOL_CALLS) break;
        }
        messages.push({ role: 'user', content: toolResults });
      }
      return capOut(db, investigationId, requestedByEditorId, 'tool_calls');
    });
    } catch (err) {
      await step.run('mark-failed', async () => {
        await failJob({
          investigationId,
          jobKind: 'hypothesis_loop',
          codeOrMessage: 'internal_error',
        });
      });
      throw err;
    }

    await step.run('mark-done', async () => {
      const summary = result.capFired
        ? `Cap kilőtt: ${result.capFired}.`
        : result.finding === 'investigation_missing'
        ? 'A nyomozás már nem létezik.'
        : 'A hipotézis-hurok lezárt — a megállapítás a leads-panelben.';
      await completeJob({
        investigationId,
        jobKind: 'hypothesis_loop',
        summaryHu: summary,
      });
    });

    return { investigationId, ...result };
  },
);

async function runTool(
  tu: Anthropic.ToolUseBlock,
  seenLiveCalls: Set<string>,
): Promise<string> {
  // For T069 the four tools are wired with safe stubs. The
  // `fetch_external_record` tool short-circuits on a repeated key per
  // FR-022 / Acceptance Scenario S4.2; the live fetch is dispatched to
  // the xref function in a future revision (kept out of this PR to
  // preserve the 90s wall-clock budget — the hurok agent reads
  // cached rows).
  const input = tu.input as Record<string, unknown>;
  switch (tu.name) {
    case 'read_cached_external_record': {
      const db = (await import('@/lib/db')).getDb();
      const schemaMod = (await import('@/lib/db')).schema;
      const rows = await db
        .select({
          rawPayload: schemaMod.externalRecords.rawPayload,
          canonicalUrl: schemaMod.externalRecords.canonicalUrl,
          fetchedAt: schemaMod.externalRecords.fetchedAt,
        })
        .from(schemaMod.externalRecords)
        .where(
          and(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eq(schemaMod.externalRecords.sourceSystem, String(input.sourceSystem) as any),
            eq(schemaMod.externalRecords.externalId, String(input.externalId)),
          ),
        )
        .limit(1);
      return JSON.stringify(rows[0] ?? null);
    }
    case 'fetch_external_record': {
      const key = `${input.sourceSystem}:${input.externalId}`;
      if (seenLiveCalls.has(key)) {
        return JSON.stringify({ error: 'already_called_this_run' });
      }
      seenLiveCalls.add(key);
      // Live adapter calls are intentionally NOT dispatched inside this
      // turn — the agent should rely on the cached records gathered by
      // a prior `Run cross-reference`. We return a structured response
      // explaining that.
      return JSON.stringify({
        error: 'live_fetch_disabled',
        note: 'futtass cross-reference-et az akciósorból; ez a tool csak a cache-be tölti vissza.',
      });
    }
    case 'compute_benchmark': {
      return JSON.stringify({
        dimension: String(input.dimension),
        status: 'use_admin_benchmark_panel',
      });
    }
    case 'record_lead': {
      const db = (await import('@/lib/db')).getDb();
      const schemaMod = (await import('@/lib/db')).schema;
      const inserted = await db
        .insert(schemaMod.investigationLeads)
        .values({
          investigationId:
            (input.investigationId as string | undefined)
            ?? '',
          kind: 'hypothesis',
          status: 'open',
          question: String(input.question ?? '').slice(0, 4000) || 'Hipotézis',
          finding: String(input.finding ?? '').slice(0, 4000) || null,
          createdBy: 'agent',
        })
        .returning({ id: schemaMod.investigationLeads.id });
      return JSON.stringify({ leadId: inserted[0]?.id ?? null });
    }
    default:
      return JSON.stringify({ error: 'unknown_tool', name: tu.name });
  }
}

async function capOut(
  db: ReturnType<typeof getDb>,
  investigationId: string,
  requestedByEditorId: string | null,
  capFired: HypothesisCapKind,
): Promise<{ capFired: HypothesisCapKind; finding: string }> {
  await db.insert(schema.investigationLeads).values({
    investigationId,
    kind: 'hypothesis',
    status: 'open',
    question: 'Hipotézis-hurok cap-fire',
    finding: `cap fired: ${capFired}`,
    createdBy: 'agent',
    capFired,
    actorEditorId: null,
  });
  void requestedByEditorId;
  return { capFired, finding: `cap_fired:${capFired}` };
}
