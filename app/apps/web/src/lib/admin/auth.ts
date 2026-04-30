import 'server-only';
import { eq } from 'drizzle-orm';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDb, schema } from '@/lib/db';

export type EditorSession = {
  email: string;
  editor: typeof schema.editors.$inferSelect;
};

export class NotAllowlistedError extends Error {
  constructor() {
    super('not on editor allowlist');
  }
}

export class NotSignedInError extends Error {
  constructor() {
    super('not signed in');
  }
}

/**
 * Resolve the signed-in editor for the current request. Throws if the user
 * is not signed in or not on the Editor allowlist with active=true (FR-040).
 */
export async function requireEditor(): Promise<EditorSession> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) throw new NotSignedInError();

  const db = getDb();
  const editor = await db.query.editors.findFirst({
    where: eq(schema.editors.email, user.email),
  });
  if (!editor || !editor.active) {
    throw new NotAllowlistedError();
  }
  return { email: user.email, editor };
}

export async function requireAdmin(): Promise<EditorSession> {
  const session = await requireEditor();
  if (session.editor.role !== 'admin') {
    throw new NotAllowlistedError();
  }
  return session;
}
