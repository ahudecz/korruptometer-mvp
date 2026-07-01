import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const auditInserts: Array<Record<string, unknown>> = [];
const surveys: Array<{ id: string; expected: Date }> = [];
let updateReturnRows: Array<{ updatedAt: Date }> = [];
let selectRows: Array<{ updatedAt: Date }> = [];

vi.mock('@/lib/admin/auth', () => ({
  requireEditor: vi.fn(async () => ({ email: 'e@e', editor: { id: 'editor-1' } })),
}));

vi.mock('@/lib/db', () => {
  const builder: () => unknown = () => {
    const obj = {
      select: () => obj,
      from: () => obj,
      where: () => obj,
      limit: () => Promise.resolve(selectRows),
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          auditInserts.push(v);
          return Promise.resolve();
        },
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve(updateReturnRows),
          }),
        }),
      }),
    };
    return obj;
  };
  return {
    getDb: () => builder(),
    schema: {
      investigations: {
        id: 'id',
        updatedAt: 'updatedAt',
        _: { name: 'Investigation' },
      },
      auditLogs: { _: { name: 'AuditLog' } },
    },
  };
});

beforeEach(() => {
  auditInserts.length = 0;
  surveys.length = 0;
  updateReturnRows = [];
  selectRows = [];
});

async function callPost(
  id: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  const mod = await import('../../../app/api/admin/investigations/[id]/status/route');
  return mod.POST(
    new Request(`http://localhost/api/admin/investigations/${id}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe('POST /api/admin/investigations/:id/status (T027)', () => {
  it('428 without If-Match', async () => {
    const res = await callPost('inv1', { status: 'dismissed' });
    expect(res.status).toBe(428);
  });

  it('dismisses on a happy path with If-Match', async () => {
    updateReturnRows = [{ updatedAt: new Date('2026-05-16T00:00:00Z') }];
    const res = await callPost(
      'inv1',
      { status: 'dismissed' },
      { 'If-Match': new Date('2026-05-15T00:00:00Z').toISOString() },
    );
    expect(res.status).toBe(200);
    expect(auditInserts).toHaveLength(1);
    expect(auditInserts[0]!.action).toBe('investigation.status.changed');
  });

  it('returns 409 stale when the update affects 0 rows', async () => {
    updateReturnRows = [];
    selectRows = [{ updatedAt: new Date('2026-05-16T12:00:00Z') }];
    const res = await callPost(
      'inv1',
      { status: 'dismissed' },
      { 'If-Match': new Date('2026-05-15T00:00:00Z').toISOString() },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('stale');
  });

  it('422 invalid_transition when mergedIntoId equals the row id', async () => {
    const sameId = '11111111-1111-1111-1111-111111111111';
    const res = await callPost(
      sameId,
      { status: 'merged', mergedIntoId: sameId },
      { 'If-Match': new Date('2026-05-15T00:00:00Z').toISOString() },
    );
    expect(res.status).toBe(422);
  });

  void surveys;
});
