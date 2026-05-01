import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * T053 — signed internal revalidate endpoint. Phase 3's KPI rollup worker
 * calls this with an HMAC over the tag name + a unix-second timestamp so the
 * homepage cache (`s-maxage=120`) can be busted immediately on a successful
 * recompute (FR-011).
 *
 * Body shape: `{ "tag": "stats", "ts": 1714500000, "sig": "<hex>" }`
 * Signature: `HMAC-SHA256(INTERNAL_REVALIDATE_SECRET, `${tag}:${ts}`).hex`
 *
 * Rejects requests where |now - ts| > 5 min so a leaked signature has at
 * most a 5-minute attack window.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TAGS = new Set(['stats']);

export async function POST(req: Request) {
  const secret = process.env.INTERNAL_REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  let body: { tag?: string; ts?: number; sig?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const { tag, ts, sig } = body;
  if (!tag || typeof ts !== 'number' || !sig) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  if (!ALLOWED_TAGS.has(tag)) {
    return NextResponse.json({ error: 'tag not allowed' }, { status: 400 });
  }
  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (skew > 300) {
    return NextResponse.json({ error: 'timestamp out of window' }, { status: 400 });
  }
  const expected = createHmac('sha256', secret).update(`${tag}:${ts}`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sig, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 403 });
  }
  revalidateTag(tag);
  return NextResponse.json({ ok: true, tag });
}
