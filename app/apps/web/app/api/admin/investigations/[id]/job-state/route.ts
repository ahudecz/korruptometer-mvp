import { NextResponse } from 'next/server';

import { requireEditor } from '@/lib/admin/auth';
import { readJobStates } from '@/lib/investigation/job-state';
import type { InvestigationJobStateDto } from '@korr/shared';

/**
 * GET /api/admin/investigations/:id/job-state
 *
 * Two response modes:
 *   - `Accept: text/event-stream` → an SSE stream that polls the snapshot
 *     once per `JOB_STATE_POLL_INTERVAL_MS` and emits a `JobStateChanged`
 *     event when any row changes (or on first connect). Auto-closes after
 *     60 s so Vercel's request timeout does not kill the stream mid-flight;
 *     clients reconnect automatically.
 *   - Anything else → a JSON snapshot of `InvestigationJobStateDto[]`.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const accept = req.headers.get('accept') ?? '';

  if (accept.includes('text/event-stream')) {
    const intervalMs = Math.max(
      1000,
      Number(process.env.JOB_STATE_POLL_INTERVAL_MS ?? '2000'),
    );
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data: InvestigationJobStateDto) => {
          controller.enqueue(
            encoder.encode(
              `event: JobStateChanged\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        };
        const lastByKind = new Map<string, string>();
        const tick = async () => {
          try {
            const states = await readJobStates(id);
            for (const s of states) {
              const sig = `${s.state}|${s.startedAt}|${s.finishedAt}|${s.summary}|${s.errorMessage}`;
              if (lastByKind.get(s.jobKind) !== sig) {
                lastByKind.set(s.jobKind, sig);
                send(s as InvestigationJobStateDto);
              }
            }
          } catch (err) {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({
                  message: (err as Error).message,
                })}\n\n`,
              ),
            );
          }
        };
        await tick();
        const interval = setInterval(tick, intervalMs);
        const closeAfter = setTimeout(() => {
          clearInterval(interval);
          controller.close();
        }, 60_000);
        req.signal.addEventListener('abort', () => {
          clearInterval(interval);
          clearTimeout(closeAfter);
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
      },
    });
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    });
  }

  const states = await readJobStates(id);
  return NextResponse.json(states satisfies InvestigationJobStateDto[]);
}
