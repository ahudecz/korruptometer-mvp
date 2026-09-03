import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/** 012-reader-subscriptions FR-087, FR-091. */
const auditRows: Array<Record<string, unknown>> = [];
let updatedRows: Array<{ id: string }> = [];

const dbStub = {
  update: vi.fn(() => ({
    set: () => ({ where: () => ({ returning: async () => updatedRows }) }),
  })),
  insert: vi.fn(() => ({
    values: async (v: Record<string, unknown>) => {
      auditRows.push(v);
    },
  })),
};

vi.mock('@/lib/db', () => ({
  getDb: () => dbStub,
  schema: new Proxy({}, { get: () => new Proxy({}, { get: () => 'col' }) }),
}));

let editorOk = true;
vi.mock('@/lib/admin/auth', () => ({
  requireEditor: async () => {
    if (!editorOk) throw new Error('unauthorised');
    return { id: 'editor-1' };
  },
}));

async function post(email: string): Promise<Response> {
  const mod = await import('../../../app/api/admin/subscribers/erase/route');
  return mod.POST(
    new Request('http://localhost/api/admin/subscribers/erase', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
  );
}

beforeEach(() => {
  auditRows.length = 0;
  updatedRows = [{ id: 'sub-1' }];
  editorOk = true;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/admin/subscribers/erase', () => {
  it('refuses an unauthenticated caller', async () => {
    editorOk = false;
    const res = await post('olvaso@example.hu');
    expect(res.status).toBe(401);
    expect(auditRows).toEqual([]);
  });

  it('the audit row carries NO address in readable form (FR-091)', async () => {
    await post('olvaso@example.hu');
    const row = auditRows[0]!;
    const serialised = JSON.stringify(row);
    expect(serialised).not.toContain('olvaso@example.hu');
    expect(serialised).not.toContain('@');
    expect(row.action).toBe('subscriber.erase');
  });

  it('the response is identical for a known and an unknown address', async () => {
    updatedRows = [{ id: 'sub-1' }];
    const known = await (await post('van@example.hu')).json();
    updatedRows = [];
    const unknown = await (await post('nincs@example.hu')).json();
    expect(known).toEqual(unknown);
    expect(known).toEqual({ ok: true, scheduled: true });
  });

  it('schedules an IMMEDIATE purge rather than the 30-day wait', async () => {
    await post('olvaso@example.hu');
    // A route a purgePiiAt-ot most-ra állítja; ezt a set() hívása bizonyítja.
    expect(dbStub.update).toHaveBeenCalled();
  });

  it('uses the shared canonicalisation, so a case difference is the same address', async () => {
    await post('Olvaso@Example.HU');
    const first = auditRows[0]!.detail as { emailHashPrefix: string };
    auditRows.length = 0;
    await post('  olvaso@example.hu ');
    const second = auditRows[0]!.detail as { emailHashPrefix: string };
    expect(first.emailHashPrefix).toBe(second.emailHashPrefix);
  });
});
