import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

/**
 * T069 — WebAuthn registration endpoint. The client requests a credential
 * creation `options` shape, then POSTs the navigator.credentials.create
 * result back to be persisted on the Editor row.
 *
 * NOTE: full SimpleWebAuthn integration ships with the Phase-2 launch
 * gates. This endpoint is the persistence half — verifying the attestation
 * + producing real challenges lives behind `WEBAUTHN_RP_ID` /
 * `WEBAUTHN_RP_NAME` env vars and the `@simplewebauthn/server` package.
 * For staging without those secrets, the route persists the credential as
 * "registered" so admin gating can be exercised end-to-end.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  credentialId: z.string().min(8),
  publicKey: z.string().min(8),
  attestation: z.string().optional(),
  userVerification: z.string().optional(),
});

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
    return NextResponse.json({ error: 'érvénytelen adat' }, { status: 400 });
  }

  const db = getDb();
  await db.insert(schema.editorKeys).values({
    editorId: session.editor.id,
    publicKey: parsed.data.publicKey,
    fingerprint: parsed.data.credentialId.slice(0, 32),
  });
  await db.insert(schema.auditLogs).values({
    actorEditorId: session.editor.id,
    action: 'webauthn.register',
    entityType: 'Editor',
    entityId: session.editor.id,
  });
  return NextResponse.json({ ok: true });
}
