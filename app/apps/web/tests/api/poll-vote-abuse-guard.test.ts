import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const OPEN_POLL = {
  question: {
    id: 'q-1',
    slug: 'nvvh-elso-5-ugye',
    questionText: 'Kérdés?',
    minSelect: 1,
    maxSelect: 5,
    status: 'open' as const,
  },
  totalVotes: 0,
  options: [
    { id: 'opt-1', title: 'A', shortDescription: '', longDescription: null, amountHuf: null, amountLabel: null, sourceUrl: 'https://x', sourceOutlet: 'X', isAreaNotCase: false, touchesEuFunds: false, alreadyReported: false, votes: 0, sharePct: 0 },
    { id: 'opt-2', title: 'B', shortDescription: '', longDescription: null, amountHuf: null, amountLabel: null, sourceUrl: 'https://x', sourceOutlet: 'X', isAreaNotCase: false, touchesEuFunds: false, alreadyReported: false, votes: 0, sharePct: 0 },
  ],
};

let cookieStore: Map<string, string>;
let ipLimitResult = { success: true, remaining: 10, reset: 0 };

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
  })),
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(() => ({})) }));

vi.mock('@/lib/poll-queries', () => ({
  getPollWithResults: vi.fn(async () => OPEN_POLL),
  insertVote: vi.fn(async () => 'new-vote-id'),
}));

vi.mock('@korr/shared/ratelimit', () => ({
  pollVoteIpLimiter: vi.fn(() => ({ limit: vi.fn(async () => ipLimitResult) })),
}));

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

beforeEach(() => {
  cookieStore = new Map();
  ipLimitResult = { success: true, remaining: 10, reset: 0 };
});

async function post(body: Record<string, unknown>): Promise<Response> {
  const mod = await import('../../app/api/poll/vote/route');
  return mod.POST(
    new Request('http://localhost/api/poll/vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/poll/vote — abuse guard (US4)', () => {
  it('rejects a repeat vote from a browser that already has the "voted" cookie', async () => {
    cookieStore.set('poll_nvvh-elso-5-ugye_voted', 'prior-vote-id');
    const res = await post({ questionSlug: 'nvvh-elso-5-ugye', optionIds: ['opt-1'], turnstileToken: 'tok', honeypot: '' });
    expect(res.status).toBe(409);
  });

  it('rejects when the IP daily rate limit is exceeded', async () => {
    ipLimitResult = { success: false, remaining: 0, reset: 0 };
    const res = await post({ questionSlug: 'nvvh-elso-5-ugye', optionIds: ['opt-1'], turnstileToken: 'tok', honeypot: '' });
    expect(res.status).toBe(429);
  });

  it('rejects a filled honeypot field before touching the DB', async () => {
    const { insertVote } = await import('@/lib/poll-queries');
    const res = await post({ questionSlug: 'nvvh-elso-5-ugye', optionIds: ['opt-1'], turnstileToken: 'tok', honeypot: 'im-a-bot' });
    expect(res.status).toBe(400);
    expect(insertVote).not.toHaveBeenCalled();
  });

  it('accepts a valid vote when every guard passes', async () => {
    const res = await post({ questionSlug: 'nvvh-elso-5-ugye', optionIds: ['opt-1', 'opt-2'], turnstileToken: 'tok', honeypot: '' });
    expect(res.status).toBe(201);
  });
});
