import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

/**
 * T069 — WebAuthn assertion endpoint. The client posts a fresh assertion
 * (signed by the editor's authenticator) and the server sets a 30-min
 * step-up cookie. The middleware in `apps/web/middleware.ts` reads this
 * cookie to gate admin-only routes (FR-041).
 *
 * Until SimpleWebAuthn is wired in, the route trusts the assertion shape
 * and writes the cookie — the cookie is HttpOnly + Secure + 30-min.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  credentialId: z.string().min(8),
  signature: z.string().min(8),
});

const COOKIE = 'korr-step-up';

export async function POST(req: Request) {
  let session;
  try {
    session = await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'érvénytelen assertion' }, { status: 400 });
  }
  const db = getDb();
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'webauthn.assert',
    entityType: 'Editor',
    entityId: session.editor.id,
  });
  const jar = await cookies();
  jar.set(COOKIE, `${session.editor.id}:${Date.now()}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 60,
  });
  return NextResponse.json({ ok: true, expiresInSeconds: 30 * 60 });
}
