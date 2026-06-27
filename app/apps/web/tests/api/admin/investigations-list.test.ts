import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/admin/auth', () => ({
  requireEditor: vi.fn(async () => ({ email: 'e@e', editor: { id: 'e1' } })),
}));

type Row = {
  id: string;
  status: 'new' | 'dismissed' | 'merged';
  primaryPersonName: string | null;
  primaryEntityName: string | null;
  articleCount: number;
  quantityScore: string;
  qualityScore: string | null;
  disclosureTier: 'internal' | 'journalist' | 'prosecutor' | 'public';
  publicCaseId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const fakeRows: Row[] = [];
let lastWhere: unknown = null;
let lastOrder: unknown[] = [];
let lastLimit = 0;

vi.mock('@/lib/db', () => {
  const builder: () => unknown = () => {
    const obj = {
      select: () => builder(),
      from: () => builder(),
      where: (w: unknown) => {
        lastWhere = w;
        return obj;
      },
      orderBy: (...o: unknown[]) => {
        lastOrder = o;
        return obj;
      },
      limit: (n: number) => {
        lastLimit = n;
        return Promise.resolve(fakeRows.map((r) => ({ ...r })));
      },
    };
    return obj;
  };
  return {
    getDb: () => builder(),
    schema: {
      investigations: {
        id: 'id',
        status: 'status',
        disclosureTier: 'tier',
        primaryPersonNormalized: 'p',
        updatedAt: 'updatedAt',
        quantityScore: 'qs',
        articleCount: 'ac',
      },
    },
  };
});

beforeEach(() => {
  fakeRows.length = 0;
  lastWhere = null;
  lastOrder = [];
  lastLimit = 0;
});

async function callGet(qs: string): Promise<Response> {
  const mod = await import('../../../app/api/admin/investigations/route');
  return mod.GET(new Request(`http://localhost/api/admin/investigations?${qs}`));
}

describe('GET /api/admin/investigations (T026)', () => {
  it('returns empty list with nextCursor=null', async () => {
    const res = await callGet('status=new');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeNull();
  });

  it('400 on invalid filter value', async () => {
    const res = await callGet('status=garbage');
    expect(res.status).toBe(400);
  });

  it('renders 20 items by default and surfaces a cursor when more rows exist', async () => {
    for (let i = 0; i < 21; i += 1) {
      fakeRows.push({
        id: `i${i}`,
        status: 'new',
        primaryPersonName: `Person ${i}`,
        primaryEntityName: null,
        articleCount: i,
        quantityScore: String(i),
        qualityScore: null,
        disclosureTier: 'internal',
        publicCaseId: null,
        createdAt: new Date(),
        updatedAt: new Date(Date.now() - i * 1000),
      });
    }
    const res = await callGet('status=new');
    expect(res.status).toBe(200);
    expect(lastLimit).toBe(21);
    const body = await res.json();
    expect(body.items).toHaveLength(20);
    expect(typeof body.nextCursor).toBe('string');
  });

  it('respects the article_count sort by setting an explicit orderBy chain', async () => {
    fakeRows.push({
      id: 'a',
      status: 'new',
      primaryPersonName: null,
      primaryEntityName: null,
      articleCount: 3,
      quantityScore: '0',
      qualityScore: null,
      disclosureTier: 'internal',
      publicCaseId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await callGet('sort=article_count');
    expect(lastOrder.length).toBeGreaterThan(0);
  });

  void lastWhere;
});
