import { NextResponse } from 'next/server';

import { getFeltaro } from '@app/_home/rendszervaltas-config';
import { previewUrl, verifyDicsosegfalRequest } from '@/lib/dicsosegfal-publish';
import { sendTelegramMessage } from '@/lib/telegram';

/**
 * POST /api/dicsosegfal/draft  { slug }
 *
 * A napi felhős futás hívja, miután a tervezetet (`live: false`) pusholta és
 * a deploy kint van. Telegramra küldi a titkos előnézeti linket és a
 * „🚀 Élesít" gombot (l. lib/dicsosegfal-publish.ts). CRON_SECRET-tel vagy DICSOSEGFAL_API_SECRET-tel védett.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!verifyDicsosegfalRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { slug?: unknown; summary?: unknown } | null;
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const f = getFeltaro(slug);
  if (!f) return NextResponse.json({ error: 'unknown_slug' }, { status: 404 });
  if (f.live) return NextResponse.json({ error: 'already_live' }, { status: 409 });
  if (!f.detail) return NextResponse.json({ error: 'no_detail' }, { status: 409 });

  const url = previewUrl(f.id);
  if (!url) return NextResponse.json({ error: 'no_secret' }, { status: 500 });

  const summary = typeof body?.summary === 'string' ? body.summary.slice(0, 1500) : '';
  const messageId = await sendTelegramMessage(
    [`📝 Dicsőségfal-tervezet: ${f.name}`, summary, `Előnézet: ${url}`, 'Ha rendben van, nyomd meg az Élesít gombot — a következő napi futás teszi ki.']
      .filter(Boolean)
      .join('\n\n'),
    { inline_keyboard: [[{ text: '🚀 Élesít', callback_data: `fal:a:${f.id}` }]] },
  );
  return NextResponse.json({ ok: messageId !== null, previewUrl: url }, { headers: { 'Cache-Control': 'no-store' } });
}
