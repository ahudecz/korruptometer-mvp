import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

let selectRows: Array<Record<string, unknown>> = [];

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
    };
    return obj;
  };
  return {
    getDb: () => builder(),
    schema: {
      damageEstimates: {
        investigationId: 'investigationId',
        _: { name: 'DamageEstimate' },
      },
    },
  };
});

beforeEach(() => {
  selectRows = [];
});

async function callGet(id: string): Promise<Response> {
  const mod = await import(
    '../../../app/api/admin/investigations/[id]/damage-estimate/route'
  );
  return mod.GET(
    new Request(
      `http://localhost/api/admin/investigations/${id}/damage-estimate`,
    ),
    { params: Promise.resolve({ id }) },
  );
}

describe('GET /api/admin/investigations/:id/damage-estimate (T118)', () => {
  it('returns 404 when no estimate exists', async () => {
    const res = await callGet('inv-missing');
    expect(res.status).toBe(404);
  });

  it('returns 200 + DTO + Last-Modified header on a happy path', async () => {
    const computedAt = new Date('2026-05-19T12:00:00Z');
    selectRows = [
      {
        investigationId: 'inv-1',
        totalLowHuf: 100_000_000n,
        totalHighHuf: 300_000_000n,
        confidence: 'medium',
        components: [
          {
            mechanism: 'overpricing',
            lowHuf: '100000000',
            highHuf: '300000000',
            method: 'benchmark_deviation',
            inputs: {
              externalRecordIds: ['ext-1'],
              benchmarkCohortHash: 'h1',
              formula: '1 Mrd Ft − p10/p90',
            },
            notes: '',
          },
        ],
        inputsHash:
          'a'.repeat(64),
        computedAt,
      },
    ];
    const res = await callGet('inv-1');
    expect(res.status).toBe(200);
    expect(res.headers.get('last-modified')).toBe(computedAt.toUTCString());
    const body = (await res.json()) as { totalLowHuf: string; components: unknown[] };
    expect(body.totalLowHuf).toBe('100000000');
    expect(body.components).toHaveLength(1);
  });
});
