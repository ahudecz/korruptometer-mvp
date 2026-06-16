import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/admin/auth', () => ({
  requireEditor: vi.fn(async () => ({ email: 'e@e', editor: { id: 'editor-1' } })),
}));

let invRow: {
  id: string;
  updatedAt: Date;
  quantityScore: string;
  qualityScore: string | null;
  publicCaseId: string | null;
  disclosureTier: 'internal' | 'journalist' | 'prosecutor' | 'public';
} | null = null;
let updateReturns: Array<{ updatedAt: Date }> = [];
const sentEvents: Array<{ name: string; data: unknown }> = [];
const auditInserts: Array<Record<string, unknown>> = [];

vi.mock('@/lib/db', () => {
  const builder: () => unknown = () => {
    const obj = {
      select: () => obj,
      from: () => obj,
      where: () => obj,
      limit: () => Promise.resolve(invRow ? [invRow] : []),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve(updateReturns),
          }),
        }),
      }),
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          auditInserts.push(v);
          return Promise.resolve();
        },
      }),
    };
    return obj;
  };
  return {
    getDb: () => builder(),
    schema: {
      investigations: { id: 'id', updatedAt: 'updatedAt', _: { name: 'Investigation' } },
      auditLogs: {},
    },
  };
});

vi.mock('@/inngest/client', () => ({
  inngest: {
    send: async (e: { name: string; data: unknown }) => {
      sentEvents.push(e);
    },
  },
}));

beforeEach(() => {
  invRow = null;
  updateReturns = [];
  sentEvents.length = 0;
  auditInserts.length = 0;
});

async function callPost(
  id: string,
  body: unknown,
  ifMatch: string,
): Promise<Response> {
  const mod = await import('../../../app/api/admin/investigations/[id]/promote/route');
  return mod.POST(
    new Request(`http://localhost/api/admin/investigations/${id}/promote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'If-Match': ifMatch },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe('POST /api/admin/investigations/:id/promote (T084)', () => {
  it('422 predicate_failed when scores are insufficient', async () => {
    const updatedAt = new Date('2026-05-15T00:00:00Z');
    invRow = {
      id: 'i1',
      updatedAt,
      quantityScore: '1.50',
      qualityScore: 'opinion_press',
      publicCaseId: null,
      disclosureTier: 'internal',
    };
    const res = await callPost('i1', { tier: 'journalist' }, updatedAt.toISOString());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('predicate_failed');
  });

  it('409 stale on If-Match mismatch', async () => {
    const updatedAt = new Date('2026-05-15T00:00:00Z');
    invRow = {
      id: 'i1',
      updatedAt,
      quantityScore: '2',
      qualityScore: 'investigative_journalism',
      publicCaseId: null,
      disclosureTier: 'internal',
    };
    const res = await callPost(
      'i1',
      { tier: 'journalist' },
      new Date('2025-01-01T00:00:00Z').toISOString(),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('stale');
  });

  it('journalist promote happy path: synchronous, audit logged', async () => {
    const updatedAt = new Date('2026-05-15T00:00:00Z');
    invRow = {
      id: 'i1',
      updatedAt,
      quantityScore: '2',
      qualityScore: 'investigative_journalism',
      publicCaseId: null,
      disclosureTier: 'internal',
    };
    updateReturns = [{ updatedAt: new Date('2026-05-15T01:00:00Z') }];
    const res = await callPost('i1', { tier: 'journalist' }, updatedAt.toISOString());
    expect(res.status).toBe(200);
    expect(auditInserts).toHaveLength(1);
    expect(auditInserts[0]!.action).toBe('investigation.tier.promoted.journalist');
  });

  it('public promote dispatches the atomic-write event (202)', async () => {
    const updatedAt = new Date('2026-05-15T00:00:00Z');
    invRow = {
      id: 'i1',
      updatedAt,
      quantityScore: '3',
      qualityScore: 'audit_report',
      publicCaseId: null,
      disclosureTier: 'internal',
    };
    const res = await callPost('i1', { tier: 'public' }, updatedAt.toISOString());
    expect(res.status).toBe(202);
    expect(sentEvents).toHaveLength(1);
    expect(sentEvents[0]!.name).toBe('investigation.promote.public.requested');
  });
});
