import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

export const revalidate = 60;

/**
 * Public-half of the editor recipient list (Phase 4 / T191). Returns the
 * libsodium box public keys + fingerprints of every active, non-revoked
 * editor key. Only public material — no secrets.
 */
export async function GET() {
  const db = getDb();
  const rows = await db
    .select({
      fingerprint: schema.editorKeys.fingerprint,
      publicKey: schema.editorKeys.publicKey,
    })
    .from(schema.editorKeys)
    .innerJoin(schema.editors, eq(schema.editorKeys.editorId, schema.editors.id))
    .where(
      and(
        isNull(schema.editorKeys.revokedAt),
        eq(schema.editors.active, true),
      ),
    );

  return NextResponse.json(
    { recipients: rows },
    { headers: { 'Cache-Control': 'public, s-maxage=60' } },
  );
}
