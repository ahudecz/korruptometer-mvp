import { NextResponse } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

/**
 * T099 — GET /api/admin/submissions
 *
 * Supabase-session-gated, allowlist-checked. Returns ciphertext columns to
 * the client; decryption only happens server-side when an editor explicitly
 * opens a row in T100. Role-aware filters + pagination.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = z.object({
  status: z
    .enum(['received', 'in_review', 'approved', 'rejected', 'duplicate'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export async function GET(req: Request) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid query' }, { status: 400 });
  }
  const { status, limit, cursor } = parsed.data;

  const conditions = [];
  if (status) conditions.push(eq(schema.submissions.status, status));
  if (cursor) conditions.push(sql`"createdAt" < ${cursor}`);
  const where = conditions.length === 1
    ? conditions[0]
    : conditions.length > 1
      ? and(...conditions)
      : undefined;

  const db = getDb();
  const rows = await db
    .select({
      id: schema.submissions.id,
      ref: schema.submissions.ref,
      suspectName: schema.submissions.suspectName,
      crimes: schema.submissions.crimes,
      status: schema.submissions.status,
      createdAt: schema.submissions.createdAt,
      anonymous: schema.submissions.anonymous,
      hasReporterPii: sql<boolean>`(${schema.submissions.reporterEmailEnc} IS NOT NULL OR ${schema.submissions.reporterNameEnc} IS NOT NULL)`,
      hasSealedBox: sql<boolean>`${schema.submissions.bodyCipher} IS NOT NULL`,
      recipientFingerprints: schema.submissions.recipientFingerprints,
    })
    .from(schema.submissions)
    .where(where)
    .orderBy(desc(schema.submissions.createdAt))
    .limit(limit);

  const nextCursor = rows.length === limit ? rows[rows.length - 1]!.createdAt.toISOString() : null;

  return NextResponse.json(
    { items: rows, nextCursor, viewer: { id: session.editor.id, role: session.editor.role } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
