/**
 * T156 — proves any admin write that changes or clears
 * NewsArticle.relatedCaseId sets linkOverridden = true in the same
 * transaction (FR-051, US 11 acceptance scenario 3).
 *
 * The route handler reads the JSON body with `req.json()` and writes via the
 * Drizzle client. We mock the DB client (and the auth helper) so the test
 * doesn't need a live Postgres.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/admin/auth', () => ({
  requireEditor: vi.fn(async () => ({
    email: 'editor@test.local',
    editor: { id: 'ed-1', role: 'editor', active: true },
  })),
}));

const updateSpy = vi.fn();
const setSpy = vi.fn();
const whereSpy = vi.fn(async () => undefined);
const insertSpy = vi.fn();
const valuesSpy = vi.fn(async () => undefined);
const deleteSpy = vi.fn();

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    update: (...a: unknown[]) => {
      updateSpy(...a);
      return { set: (s: unknown) => (setSpy(s), { where: whereSpy }) };
    },
    insert: (...a: unknown[]) => {
      insertSpy(...a);
      return { values: valuesSpy };
    },
    delete: (...a: unknown[]) => {
      deleteSpy(...a);
      return { where: async () => undefined };
    },
  }),
  schema: {
    newsArticles: { id: 'newsArticles.id' },
    auditLogs: 'auditLogs',
  },
}));

vi.mock('@/inngest/client', () => ({
  inngest: { send: vi.fn(async () => undefined) },
}));

import { PATCH } from './route';

describe('admin news PATCH', () => {
  beforeEach(() => {
    setSpy.mockClear();
    insertSpy.mockClear();
  });

  it('sets linkOverridden=true when relatedCaseId is changed', async () => {
    const req = new Request('http://localhost/api/admin/news', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', relatedCaseId: 'KM-001' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const setArgs = setSpy.mock.calls[0]?.[0] ?? {};
    expect((setArgs as Record<string, unknown>).linkOverridden).toBe(true);
    expect((setArgs as Record<string, unknown>).relatedCaseId).toBe('KM-001');
  });

  it('sets linkOverridden=true when relatedCaseId is cleared', async () => {
    const req = new Request('http://localhost/api/admin/news', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', relatedCaseId: null }),
    });
    await PATCH(req);
    const setArgs = setSpy.mock.calls[0]?.[0] ?? {};
    expect((setArgs as Record<string, unknown>).linkOverridden).toBe(true);
  });

  it('does NOT auto-set linkOverridden when only featured changes', async () => {
    const req = new Request('http://localhost/api/admin/news', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', featured: true }),
    });
    await PATCH(req);
    const setArgs = setSpy.mock.calls[0]?.[0] ?? {};
    expect('linkOverridden' in (setArgs as Record<string, unknown>)).toBe(false);
  });

  it('respects explicit linkOverridden=false override (admin reset path)', async () => {
    const req = new Request('http://localhost/api/admin/news', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        relatedCaseId: 'KM-002',
        linkOverridden: false,
      }),
    });
    await PATCH(req);
    const setArgs = setSpy.mock.calls[0]?.[0] ?? {};
    expect((setArgs as Record<string, unknown>).linkOverridden).toBe(false);
  });
});
