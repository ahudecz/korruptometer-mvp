import { NextResponse } from 'next/server';
import { and, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import type {
  DisclosureTier,
  InvestigationListItem,
  InvestigationStatus,
} from '@korr/shared';

const SORTS = ['recent', 'quantity', 'article_count'] as const;
type Sort = (typeof SORTS)[number];
const STATUSES: Array<InvestigationStatus | 'all'> = [
  'new',
  'dismissed',
  'merged',
  'all',
];
const TIERS: Array<DisclosureTier | 'all'> = [
  'internal',
  'journalist',
  'prosecutor',
  'public',
  'all',
];

type Cursor = { sort: Sort; k: string; id: string };

function encode(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decode(token: string | null): Cursor | null {
  if (!token) return null;
  try {
    const padded = token
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(token.length + ((4 - (token.length % 4)) % 4), '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const v = JSON.parse(json) as Cursor;
    if (!SORTS.includes(v.sort)) return null;
    return v;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const status = (url.searchParams.get('status') ?? 'new') as
    | InvestigationStatus
    | 'all';
  const tier = (url.searchParams.get('tier') ?? 'all') as DisclosureTier | 'all';
  const q = url.searchParams.get('q') ?? null;
  const sortParam = (url.searchParams.get('sort') ?? 'recent') as Sort;
  const sort: Sort = SORTS.includes(sortParam) ? sortParam : 'recent';
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);
  const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 20));
  if (!STATUSES.includes(status) || !TIERS.includes(tier)) {
    return NextResponse.json({ error: 'invalid_filter' }, { status: 400 });
  }
  const cursor = decode(url.searchParams.get('cursor'));

  const db = getDb();
  const conditions = [] as ReturnType<typeof eq>[];
  if (status !== 'all') {
    conditions.push(eq(schema.investigations.status, status));
  }
  if (tier !== 'all') {
    conditions.push(eq(schema.investigations.disclosureTier, tier));
  }
  if (q) {
    conditions.push(
      ilike(schema.investigations.primaryPersonNormalized, `%${q.toLowerCase()}%`),
    );
  }

  // Cursor predicate: ( key, id ) lexicographic on the requested sort.
  if (cursor && cursor.sort === sort) {
    if (sort === 'recent') {
      conditions.push(
        or(
          lt(schema.investigations.updatedAt, new Date(cursor.k)),
          and(
            eq(schema.investigations.updatedAt, new Date(cursor.k)),
            lt(schema.investigations.id, cursor.id),
          ),
        )!,
      );
    } else if (sort === 'quantity') {
      conditions.push(
        or(
          lt(schema.investigations.quantityScore, cursor.k),
          and(
            eq(schema.investigations.quantityScore, cursor.k),
            lt(schema.investigations.id, cursor.id),
          ),
        )!,
      );
    } else if (sort === 'article_count') {
      conditions.push(
        or(
          lt(schema.investigations.articleCount, Number(cursor.k)),
          and(
            eq(schema.investigations.articleCount, Number(cursor.k)),
            lt(schema.investigations.id, cursor.id),
          ),
        )!,
      );
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  let orderBy;
  if (sort === 'recent') {
    orderBy = [desc(schema.investigations.updatedAt), desc(schema.investigations.id)];
  } else if (sort === 'quantity') {
    orderBy = [desc(schema.investigations.quantityScore), desc(schema.investigations.id)];
  } else {
    orderBy = [desc(schema.investigations.articleCount), desc(schema.investigations.id)];
  }

  const rows = await db
    .select()
    .from(schema.investigations)
    .where(where as unknown as undefined)
    .orderBy(...orderBy)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const items: InvestigationListItem[] = page.map((r) => ({
    id: r.id,
    status: r.status as InvestigationStatus,
    primaryPersonName: r.primaryPersonName,
    primaryEntityName: r.primaryEntityName,
    articleCount: r.articleCount,
    quantityScore: r.quantityScore.toString(),
    qualityScore: r.qualityScore,
    disclosureTier: r.disclosureTier as DisclosureTier,
    publicCaseId: r.publicCaseId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  let nextCursor: string | null = null;
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1]!;
    if (sort === 'recent') {
      nextCursor = encode({ sort, k: last.updatedAt.toISOString(), id: last.id });
    } else if (sort === 'quantity') {
      nextCursor = encode({ sort, k: last.quantityScore.toString(), id: last.id });
    } else {
      nextCursor = encode({ sort, k: String(last.articleCount), id: last.id });
    }
  }

  void sql;
  return NextResponse.json({ items, nextCursor });
}
