import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

let readResult: Array<Record<string, unknown>> = [];

vi.mock('@/lib/admin/auth', () => ({
  requireEditor: vi.fn(async () => ({ email: 'e@e', editor: { id: 'editor-1' } })),
}));

vi.mock('@/lib/investigation/job-state', () => ({
  readJobStates: vi.fn(async () => readResult),
}));

beforeEach(() => {
  readResult = [];
});

async function callGet(id: string, accept = 'application/json'): Promise<Response> {
  const mod = await import(
    '../../../app/api/admin/investigations/[id]/job-state/route'
  );
  return mod.GET(
    new Request(`http://localhost/api/admin/investigations/${id}/job-state`, {
      headers: { accept },
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe('GET /api/admin/investigations/:id/job-state (T128)', () => {
  it('returns the snapshot JSON array', async () => {
    readResult = [
      {
        jobKind: 'xref',
        state: 'running',
        startedAt: '2026-05-19T00:00:00Z',
        finishedAt: null,
        inngestRunId: 'run-1',
        summary: null,
        errorMessage: null,
        updatedAt: '2026-05-19T00:00:00Z',
      },
    ];
    const res = await callGet('inv-1', 'application/json');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ jobKind: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]!.jobKind).toBe('xref');
  });

  it('responds within 100ms in process (in-memory mock)', async () => {
    const start = Date.now();
    await callGet('inv-1');
    expect(Date.now() - start).toBeLessThan(100);
  });
});
