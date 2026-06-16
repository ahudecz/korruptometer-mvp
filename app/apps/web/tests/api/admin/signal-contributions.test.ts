import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

let invRows: Array<{ quantityScore: unknown }> = [];
let sigRows: Array<Record<string, unknown>> = [];

vi.mock('@/lib/admin/auth', () => ({
  requireEditor: vi.fn(async () => ({ email: 'e@e', editor: { id: 'editor-1' } })),
}));

vi.mock('@/lib/db', () => {
  // Two-table mock: the first call lands on investigations (limit→invRows);
  // the second skips the limit and yields sigRows directly via `where`.
  const factory: () => unknown = () => {
    let phase: 'inv' | 'sig' = 'inv';
    const obj = {
      select: () => obj,
      from: (_t: unknown) => {
        return obj;
      },
      where: () => {
        if (phase === 'sig') return Promise.resolve(sigRows);
        return obj;
      },
      limit: () => {
        phase = 'sig';
        return Promise.resolve(invRows);
      },
    };
    return obj;
  };
  return {
    getDb: () => factory(),
    schema: {
      investigations: {
        id: 'id',
        quantityScore: 'quantityScore',
        _: { name: 'Investigation' },
      },
      signalContributions: {
        investigationId: 'investigationId',
        _: { name: 'SignalContribution' },
      },
    },
  };
});

beforeEach(() => {
  invRows = [];
  sigRows = [];
});

async function callGet(id: string): Promise<Response> {
  const mod = await import(
    '../../../app/api/admin/investigations/[id]/signal-contributions/route'
  );
  return mod.GET(
    new Request(
      `http://localhost/api/admin/investigations/${id}/signal-contributions`,
    ),
    { params: Promise.resolve({ id }) },
  );
}

describe('GET /api/admin/investigations/:id/signal-contributions (T125)', () => {
  it('returns 404 when the investigation does not exist', async () => {
    const res = await callGet('missing');
    expect(res.status).toBe(404);
  });

  it('returns 200 with quantityScore + rows', async () => {
    invRows = [{ quantityScore: '2.40' }];
    sigRows = [
      {
        id: 'sc-1',
        sourceKind: 'external_record',
        sourceId: 'ext-1',
        baseWeight: '1.00',
        stalenessMultiplier: '1.00',
        effectiveWeight: '1.00',
        addedAt: new Date('2026-05-19T00:00:00Z'),
      },
    ];
    const res = await callGet('inv-1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { quantityScore: string; rows: unknown[] };
    expect(body.quantityScore).toBe('2.40');
    expect(body.rows).toHaveLength(1);
  });
});
