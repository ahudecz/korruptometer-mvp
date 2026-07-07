import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('Missing url', { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Referer': parsed.origin,
        'Accept': 'image/*',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!upstream.ok) return new NextResponse('Upstream error', { status: 502 });

    const ct = upstream.headers.get('content-type') ?? '';
    if (!ALLOWED_CONTENT_TYPES.some((t) => ct.startsWith(t))) {
      return new NextResponse('Not an image', { status: 400 });
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_SIZE) return new NextResponse('Too large', { status: 413 });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Fetch failed', { status: 502 });
  }
}
