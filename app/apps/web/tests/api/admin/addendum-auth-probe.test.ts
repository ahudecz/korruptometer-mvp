import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/admin/auth', () => ({
  requireEditor: vi.fn(async () => {
    throw new Error('no_session');
  }),
}));
vi.mock('@/lib/db', () => ({
  getDb: () => ({}),
  schema: {
    damageEstimates: { _: { name: 'DamageEstimate' } },
    signalContributions: { _: { name: 'SignalContribution' } },
    investigations: { _: { name: 'Investigation' } },
  },
}));
vi.mock('@/lib/investigation/job-state', () => ({
  readJobStates: vi.fn(async () => []),
}));

/**
 * T156 — every new admin endpoint introduced by the damage-evidence
 * spine addendum MUST reject unauthenticated callers with 401, matching
 * the existing admin-API floor. Probes each endpoint with no session and
 * asserts the auth gate fires before any DB access.
 */
async function probe(path: string): Promise<Response> {
  const mod = await import(
    `../../../app/api/admin/investigations/[id]/${path}/route`
  );
  return mod.GET(
    new Request(`http://localhost/api/admin/investigations/x/${path}`),
    { params: Promise.resolve({ id: 'x' }) },
  );
}

describe('addendum endpoints — RLS / auth posture (T156)', () => {
  it('damage-estimate returns 401 without a session', async () => {
    const res = await probe('damage-estimate');
    expect(res.status).toBe(401);
  });

  it('signal-contributions returns 401 without a session', async () => {
    const res = await probe('signal-contributions');
    expect(res.status).toBe(401);
  });

  it('job-state returns 401 without a session', async () => {
    const res = await probe('job-state');
    expect(res.status).toBe(401);
  });
});
