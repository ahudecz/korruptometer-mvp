import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/admin/auth', () => ({
  requireEditor: vi.fn(async () => ({ email: 'e@e', editor: { id: 'editor-1' } })),
}));

const auditInserts: Array<Record<string, unknown>> = [];
let leadRow: { investigationId: string } | null = null;
const updates: Array<Record<string, unknown>> = [];

vi.mock('@/lib/db', () => {
  const builder: () => unknown = () => {
    const obj = {
      select: () => obj,
      from: () => obj,
      where: () => obj,
      limit: () => Promise.resolve(leadRow ? [leadRow] : []),
      update: () => ({
        set: (v: Record<string, unknown>) => ({
          where: () => {
            updates.push(v);
            return Promise.resolve();
          },
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
    schema: { investigationLeads: { id: 'id', investigationId: 'i' }, auditLogs: {} },
  };
});

beforeEach(() => {
  auditInserts.length = 0;
  updates.length = 0;
  leadRow = null;
});

async function callPost(leadId: string, body: unknown): Promise<Response> {
  const mod = await import('../../../app/api/admin/investigations/leads/[leadId]/resolve/route');
  return mod.POST(
    new Request(`http://localhost/api/admin/investigations/leads/${leadId}/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ leadId }) },
  );
}

describe('POST /api/admin/investigations/leads/:leadId/resolve (T066)', () => {
  it('404 when the lead does not exist', async () => {
    leadRow = null;
    const res = await callPost('lead-1', { status: 'resolved', finding: 'ok' });
    expect(res.status).toBe(404);
  });

  it('resolves and writes one audit row', async () => {
    leadRow = { investigationId: 'inv-1' };
    const res = await callPost('lead-1', { status: 'resolved', finding: 'ok' });
    expect(res.status).toBe(200);
    expect(updates).toHaveLength(1);
    expect(auditInserts).toHaveLength(1);
    expect(auditInserts[0]!.action).toBe('investigation.lead.resolved');
  });

  it('rejects body without status', async () => {
    leadRow = { investigationId: 'inv-1' };
    const res = await callPost('lead-1', { finding: 'ok' });
    expect(res.status).toBe(400);
  });
});
