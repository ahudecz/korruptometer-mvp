import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

import { getDb } from '@/lib/db';
import { getPollWithResults } from '@/lib/poll-queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/poll — kérdés + opciók + élő eredmény-összesítés, lásd
 * contracts/poll-api.md. Edge-cache-elt (Constitution VI), a `revalidateTag`
 * a POST /api/poll/vote route-ból invalidál (research.md #3) — a request
 * path nem futtat szinkron újraszámítást minden olvasásnál.
 */
const cachedPoll = unstable_cache(
  async (slug: string) => getPollWithResults(getDb(), slug),
  ['poll-results'],
  { tags: ['poll-results'], revalidate: 30 },
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug') ?? 'nvvh-elso-5-ugye';

  const poll = await cachedPoll(slug);
  if (!poll) {
    return NextResponse.json({ error: 'A szavazás nem található.' }, { status: 404 });
  }

  // A natív JSON.stringify nem tud bigint-et szerializálni (`amountHuf`) —
  // ez élesben 500-as hibát okozott (a Turnstile-dev-bypass-os élő tesztnél
  // derült ki), ezért a válasz előtt stringgé alakítjuk.
  const serialized = {
    ...poll,
    options: poll.options.map((o) => ({
      ...o,
      amountHuf: o.amountHuf === null ? null : o.amountHuf.toString(),
    })),
  };

  return NextResponse.json(serialized, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
    },
  });
}
