import { NextResponse } from 'next/server';

import { getFeltaro } from '@app/_home/rendszervaltas-config';
import { liveUrl, markPublished, submitIndexNow, verifyDicsosegfalRequest } from '@/lib/dicsosegfal-publish';
import { sendTelegramMessage } from '@/lib/telegram';

/**
 * POST /api/dicsosegfal/published  { slugs: string[] }
 *
 * A napi felhős futás hívja, miután a `live: true` átírás deployja kint van.
 * Csak azt a profilt zárja le, ami ebben a deployban TÉNYLEG él — így egy
 * félrement push nem küld halott linket se Telegramra, se IndexNow-ba.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!verifyDicsosegfalRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { slugs?: unknown } | null;
  const requested = Array.isArray(body?.slugs) ? body.slugs.filter((s): s is string => typeof s === 'string') : [];
  const live = requested.map((s) => getFeltaro(s)).filter((f) => f?.live);
  const notLive = requested.filter((s) => !getFeltaro(s)?.live);

  const slugs = live.map((f) => f!.id);
  await markPublished(slugs);
  const urls = slugs.map(liveUrl);
  const indexNow = await submitIndexNow(urls);

  for (const f of live) {
    await sendTelegramMessage(`✅ Kikerült a Dicsőségfalra: ${f!.name}\n${liveUrl(f!.id)}`);
  }
  if (notLive.length > 0) {
    await sendTelegramMessage(`⚠️ Dicsőségfal: jóváhagyva, de a deployban még nem él: ${notLive.join(', ')}`);
  }
  return NextResponse.json({ published: slugs, notLive, indexNow }, { headers: { 'Cache-Control': 'no-store' } });
}
