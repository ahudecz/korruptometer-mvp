import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

type Table = 'resignation' | 'closure' | 'verdict';

async function setStatus(table: Table, id: string, reviewStatus: 'approved' | 'rejected') {
  const db = getDb();
  const now = new Date();
  if (table === 'resignation') {
    await db.update(schema.politicalResignations).set({ reviewStatus, updatedAt: now })
      .where(eq(schema.politicalResignations.id, id));
  } else if (table === 'closure') {
    await db.update(schema.mediaClosures).set({ reviewStatus, updatedAt: now })
      .where(eq(schema.mediaClosures.id, id));
  } else {
    await db.update(schema.courtVerdicts).set({ reviewStatus, updatedAt: now })
      .where(eq(schema.courtVerdicts.id, id));
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { table?: string; id?: string; action?: string }
    | null;
  const table = body?.table;
  const id = body?.id;
  const action = body?.action;

  if (
    (table !== 'resignation' && table !== 'closure' && table !== 'verdict') ||
    typeof id !== 'string' ||
    !id ||
    (action !== 'approve' && action !== 'reject')
  ) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 });
  }

  await setStatus(table, id, action === 'approve' ? 'approved' : 'rejected');

  // Frissítsük a publikus oldalakat, hogy az elfogadott elem azonnal megjelenjen.
  revalidatePath('/');
  revalidatePath('/lemondasok');
  revalidatePath('/megszunt');
  revalidatePath('/birosagi-iteletek');

  return NextResponse.json({ ok: true });
}
