import { NextResponse } from 'next/server';

import { listApprovedUnpublished, verifyDicsosegfalRequest } from '@/lib/dicsosegfal-publish';

/**
 * GET /api/dicsosegfal/approved — a Telegramon jóváhagyott, de még nem
 * élesített profiltervezetek. A napi felhős futás ebből tudja, mit írjon át
 * `live: true`-ra. CRON_SECRET-tel vagy DICSOSEGFAL_API_SECRET-tel védett.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!verifyDicsosegfalRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const approved = await listApprovedUnpublished();
  return NextResponse.json({ approved }, { headers: { 'Cache-Control': 'no-store' } });
}
