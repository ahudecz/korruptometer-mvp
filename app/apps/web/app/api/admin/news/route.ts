import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { inngest } from '@/inngest/client';

/**
 * T158 — POST/PATCH/DELETE /api/admin/news. Editor-role-gated. Every
 * mutation that changes or clears `relatedCaseId` MUST set
 * `linkOverridden = true` in the same transaction (FR-051 / FR-066,
 * US 11 acceptance scenario 3) — covered by T156.
 */

const createSchema = z.object({
  sourceId: z.string().uuid(),
  headline: z.string().min(1).max(280),
  excerpt: z.string().min(1).max(280),
  sourceUrl: z.string().url(),
  sourceUrlHash: z.string().min(8),
  publishedAt: z.string(),
  tag: z.string().max(80).nullable().optional(),
  featured: z.boolean().optional(),
  relatedCaseId: z.string().nullable().optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  relatedCaseId: z.string().nullable().optional(),
  linkOverridden: z.boolean().optional(),
  featured: z.boolean().optional(),
  headline: z.string().min(1).max(280).optional(),
  excerpt: z.string().min(1).max(280).optional(),
  tag: z.string().max(80).nullable().optional(),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }
  const data = parsed.data;
  const db = getDb();
  const inserted = await db
    .insert(schema.newsArticles)
    .values({
      sourceId: data.sourceId,
      headline: data.headline,
      excerpt: data.excerpt,
      sourceUrl: data.sourceUrl,
      sourceUrlHash: data.sourceUrlHash,
      publishedAt: new Date(data.publishedAt),
      tag: data.tag ?? null,
      featured: data.featured ?? false,
      relatedCaseId: data.relatedCaseId ?? null,
      linkOverridden: data.relatedCaseId != null, // editor explicitly set the link
    })
    .returning({ id: schema.newsArticles.id });
  const id = inserted[0]?.id;
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'news.create',
    entityType: 'NewsArticle',
    entityId: id ?? '(unknown)',
    detail: { headline: data.headline },
  });
  await inngest.send({ name: 'kpi.recompute', data: { reason: 'news.create' } });
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid patch' }, { status: 400 });
  }
  const { id, ...patch } = parsed.data;
  const db = getDb();

  // FR-051 / FR-066: any mutation that touches relatedCaseId MUST set
  // linkOverridden = true in the same transaction so the aggregator skips
  // the row on subsequent runs. Editors can also explicitly set the flag to
  // false to opt back into auto-linking.
  const touchesLink = Object.prototype.hasOwnProperty.call(patch, 'relatedCaseId');
  const finalPatch: Record<string, unknown> = { ...patch };
  if (touchesLink && patch.linkOverridden !== false) {
    finalPatch.linkOverridden = true;
  }

  await db
    .update(schema.newsArticles)
    .set(finalPatch)
    .where(eq(schema.newsArticles.id, id));
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'news.patch',
    entityType: 'NewsArticle',
    entityId: id,
    detail: touchesLink ? { relinked: true } : null,
  });
  // Featured/linked-case changes affect the public news rail rather than KPI
  // totals, but the spec wants the rollup re-fired so /api/stats stays in
  // sync with editorial state (FR-070).
  await inngest.send({ name: 'kpi.recompute', data: { reason: 'news.patch' } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const db = getDb();
  await db.delete(schema.newsArticles).where(eq(schema.newsArticles.id, id));
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'news.delete',
    entityType: 'NewsArticle',
    entityId: id,
  });
  await inngest.send({ name: 'kpi.recompute', data: { reason: 'news.delete' } });
  return NextResponse.json({ ok: true });
}
