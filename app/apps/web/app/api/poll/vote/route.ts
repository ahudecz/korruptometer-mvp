import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { pollVoteIpLimiter } from '@korr/shared/ratelimit';
import { verifyTurnstile } from '@korr/shared/turnstile';

import { getDb } from '@/lib/db';
import { getPollWithResults, insertVote } from '@/lib/poll-queries';
import {
  checkHoneypot,
  checkOptionsBelongToQuestion,
  checkSelectionCount,
} from '@/lib/poll-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}

function votedCookieName(slug: string): string {
  return `poll_${slug}_voted`;
}

/**
 * POST /api/poll/vote — lásd contracts/poll-api.md a validációs sorrendért.
 * A "PollVote.id" maga a cookie értéke: mivel véletlen UUIDv4 (nem
 * kitalálható, és nem gate-el semmilyen bizalmas adatot — legrosszabb
 * esetben valaki más eredmény-nézetét látná a szavazóform helyett), egy
 * külön HMAC-aláírás felesleges komplexitás lenne erre a use case-re.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Érvénytelen kérés.' }, { status: 400 });
  }
  const { questionSlug, optionIds, turnstileToken, honeypot } = body as Record<string, unknown>;
  if (typeof questionSlug !== 'string' || !questionSlug) {
    return NextResponse.json({ error: 'Hiányzó kérdés-azonosító.' }, { status: 400 });
  }

  // 1) Honeypot — a legolcsóbb ellenőrzés, azonnal kizár egyszerű botokat (FR-014).
  const honeypotCheck = checkHoneypot(honeypot);
  if (!honeypotCheck.valid) {
    // Szándékosan generikus válasz — nem áruljuk el a botnak, hogy a
    // csali-mezőn bukott el.
    return NextResponse.json({ error: 'A beküldés nem sikerült.' }, { status: 400 });
  }

  const poll = await getPollWithResults(getDb(), questionSlug);
  if (!poll) {
    return NextResponse.json({ error: 'A szavazás nem található.' }, { status: 404 });
  }
  if (poll.question.status === 'closed') {
    return NextResponse.json({ error: 'Ez a szavazás már lezárult.' }, { status: 409 });
  }

  // 2) "Már szavaztál" cookie — az elsődleges, böngészőnkénti védelem (FR-011).
  const cookieName = votedCookieName(poll.question.slug);
  const jar = await cookies();
  if (jar.get(cookieName)?.value) {
    return NextResponse.json(
      { error: 'Ezzel a böngészővel már szavaztál ezen a kérdésen.' },
      { status: 409 },
    );
  }

  // 3) IP-alapú, nagyvonalú napi küszöb — csak tömeges-visszaélés elleni
  // védőháló, szándékosan megengedő megosztott hálózatokra (FR-012).
  const ip = getClientIp(req);
  const ipLimiter = pollVoteIpLimiter();
  const ipRes = await ipLimiter.limit(`pollv:${ip}`);
  if (!ipRes.success) {
    return NextResponse.json(
      { error: 'Túl sok szavazat érkezett erről a hálózatról ma. Próbáld újra holnap.' },
      { status: 429 },
    );
  }

  // 4) Turnstile — a tényleges bot-védelem (FR-013).
  const turnstile = await verifyTurnstile(
    typeof turnstileToken === 'string' ? turnstileToken : undefined,
    ip,
  );
  if (!turnstile.success) {
    return NextResponse.json(
      { error: 'A bot-ellenőrzés nem sikerült. Frissítsd az oldalt, és próbáld újra.' },
      { status: 403 },
    );
  }

  // 5) 1-5 tartomány + minden id valóban a kérdéshez tartozik-e (FR-005).
  const countCheck = checkSelectionCount(optionIds, poll.question.minSelect, poll.question.maxSelect);
  if (!countCheck.valid) {
    return NextResponse.json({ error: countCheck.error }, { status: 400 });
  }
  const validIds = new Set(poll.options.map((o) => o.id));
  const belongCheck = checkOptionsBelongToQuestion(optionIds as string[], validIds);
  if (!belongCheck.valid) {
    return NextResponse.json({ error: belongCheck.error }, { status: 400 });
  }

  // 6-7) Tranzakciós beszúrás + cache-invalidálás.
  const voteId = await insertVote(getDb(), poll.question.id, optionIds as string[]);
  const { revalidateTag } = await import('next/cache');
  revalidateTag('poll-results');

  // 8) Cookie beállítása és sikeres válasz.
  jar.set(cookieName, voteId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  });

  return NextResponse.json({ success: true, voteId }, { status: 201 });
}
