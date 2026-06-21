import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const body = await req.json();
  const { name, eventType, description, eventDate, sourceUrl, sourceName } = body;

  if (!name || !eventType || !eventDate) {
    return NextResponse.json({ error: 'name, eventType, eventDate kötelező' }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .insert(schema.mediaClosures)
    .values({ name, eventType, description, eventDate: new Date(eventDate), sourceUrl, sourceName })
    .returning();

  return NextResponse.json({ ok: true, id: row.id });
}
